import type { BookDTO, LibraryArea } from "@/lib/books";

export const LIBRARY_AREA_OPTIONS: LibraryArea[] = [
    "filipiniana",
    "general_circulation",
    "periodicals",
    "thesis_dissertations",
    "rizaliana",
    "special_collection",
    "fil_gen_reference",
    "general_reference",
    "fiction",
];

export const LIBRARY_AREA_OTHER_VALUE = "others";

export type CatalogAvailabilityFilter =
    | "all"
    | "available"
    | "unavailable"
    | "library_use_only";
export type CatalogSortOption =
    | "catalog"
    | "title_asc"
    | "title_desc"
    | "author_asc"
    | "author_desc"
    | "pub_year_desc"
    | "pub_year_asc"
    | "copies_desc"
    | "copies_asc";

export function isKnownLibraryArea(value: string): value is LibraryArea {
    return LIBRARY_AREA_OPTIONS.includes(value as LibraryArea);
}

export function formatLibraryAreaLabel(value: string) {
    return value
        .replaceAll("_", " ")
        .split(" ")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
}

export function normalizeOtherLibraryArea(raw: string) {
    return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function getErrorMessage(err: unknown) {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "Something went wrong. Please try again later.";
}

/**
 * Inventory semantics (per BookDTO docs):
 * - numberOfCopies = REMAINING/AVAILABLE copies (deducts as users borrow)
 * - totalCopies = total inventory copies
 * - borrowedCopies = active borrows (not returned)
 */
export function getInventory(book: BookDTO) {
    const remaining =
        typeof book.numberOfCopies === "number" && Number.isFinite(book.numberOfCopies)
            ? Math.max(0, Math.floor(book.numberOfCopies))
            : null;

    const total =
        typeof book.totalCopies === "number" && Number.isFinite(book.totalCopies)
            ? Math.max(0, Math.floor(book.totalCopies))
            : typeof book.numberOfCopies === "number" && Number.isFinite(book.numberOfCopies)
              ? Math.max(0, Math.floor(book.numberOfCopies))
              : null;

    const borrowed =
        typeof book.borrowedCopies === "number" && Number.isFinite(book.borrowedCopies)
            ? Math.max(0, Math.floor(book.borrowedCopies))
            : total !== null && remaining !== null
              ? Math.max(0, total - remaining)
              : null;

    return { remaining, total, borrowed };
}

export function isLibraryUseOnlyBook(book: BookDTO) {
    return Boolean(book.isLibraryUseOnly);
}

export function getBorrowTracking(book: BookDTO) {
    const inventory = getInventory(book);

    const active =
        typeof book.activeBorrowCount === "number" &&
        Number.isFinite(book.activeBorrowCount)
            ? Math.max(0, Math.floor(book.activeBorrowCount))
            : typeof book.borrowedCopies === "number" &&
                Number.isFinite(book.borrowedCopies)
              ? Math.max(0, Math.floor(book.borrowedCopies))
              : inventory.borrowed;

    const total =
        typeof book.totalBorrowCount === "number" &&
        Number.isFinite(book.totalBorrowCount)
            ? Math.max(0, Math.floor(book.totalBorrowCount))
            : null;

    return { active, total };
}

export function isBorrowableByCopies(book: BookDTO) {
    if (isLibraryUseOnlyBook(book) || book.canBorrow === false) return false;

    const inv = getInventory(book);
    if (inv.remaining === null) return Boolean(book.available);
    return inv.remaining > 0 && Boolean(book.available);
}

export function parseYearOrNull(raw: string): number | null {
    const v = raw.trim();
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1000 || n > 9999) return null;
    return n;
}

export function parsePositiveIntOrNull(raw: string): number | null {
    const v = raw.trim();
    if (!v) return null;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

export function normalizeSearchText(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(normalizeSearchText).filter(Boolean).join(" ");
    if (typeof value === "string") return value.trim().toLowerCase().replace(/\s+/g, " ");
    return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function tokenizeSearch(query: string): string[] {
    return normalizeSearchText(query)
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);
}

export function matchesAllTokens(hay: string, tokens: string[]): boolean {
    if (tokens.length === 0) return true;
    return tokens.every((t) => hay.includes(t));
}

export function buildCatalogSortKey(book: BookDTO): string {
    return [
        normalizeSearchText(book.callNumber),
        normalizeSearchText(book.title),
        normalizeSearchText(book.author),
        normalizeSearchText(book.accessionNumber),
    ]
        .filter(Boolean)
        .join("|");
}

export function compareText(a: unknown, b: unknown) {
    const av = normalizeSearchText(a);
    const bv = normalizeSearchText(b);

    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;

    return av.localeCompare(bv, undefined, { sensitivity: "base" });
}

export function compareNullableNumber(
    a: number | null | undefined,
    b: number | null | undefined,
    direction: "asc" | "desc" = "asc"
) {
    const av = typeof a === "number" && Number.isFinite(a) ? a : null;
    const bv = typeof b === "number" && Number.isFinite(b) ? b : null;

    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;

    return direction === "asc" ? av - bv : bv - av;
}

export type ExcelBookRow = {
    callNumber: string;
    accessionNumber: string;
    title: string;
    author: string;
    publisher: string;
    edition: string;
    copyright: string;
    copies: string;
};

function asSafeText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

export function toExcelRows(books: BookDTO[]): ExcelBookRow[] {
    return books.map((book) => {
        const inv = getInventory(book);

        const copiesValue =
            typeof inv.total === "number"
                ? inv.total
                : typeof inv.remaining === "number"
                  ? inv.remaining
                  : "";

        const copyrightValue =
            typeof book.copyrightYear === "number"
                ? book.copyrightYear
                : typeof book.publicationYear === "number"
                  ? book.publicationYear
                  : "";

        return {
            callNumber: asSafeText(book.callNumber),
            accessionNumber: asSafeText(book.accessionNumber),
            title: asSafeText(book.title),
            author: asSafeText(book.author),
            publisher: asSafeText(book.publisher),
            edition: asSafeText(book.edition),
            copyright: asSafeText(copyrightValue),
            copies: asSafeText(copiesValue),
        };
    });
}