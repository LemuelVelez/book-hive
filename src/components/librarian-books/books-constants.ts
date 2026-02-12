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

export function isBorrowableByCopies(book: BookDTO) {
    const inv = getInventory(book);
    // If remaining is unknown, fall back to server availability flag.
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
