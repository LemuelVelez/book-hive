import type { BookDTO } from "@/lib/books";
import type { BorrowRecordDTO } from "@/lib/borrows";
import type { BookWithStatus } from "@/components/student-books/types";

/**
 * Format a date string as YYYY-MM-DD in the local timezone.
 * This avoids the off-by-one day bug from using toISOString() / UTC.
 */
export function fmtDate(d?: string | null) {
    if (!d) return "—";

    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        return date.toLocaleDateString("en-CA");
    } catch {
        return d;
    }
}

export function peso(n: number) {
    if (typeof n !== "number" || Number.isNaN(n)) return "₱0.00";

    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 2,
        }).format(n);
    } catch {
        return `₱${n.toFixed(2)}`;
    }
}

/**
 * Compute how many full days a book is overdue based on due date and today
 * in the local timezone. Returns 0 if not overdue or if the date is invalid.
 */
export function computeOverdueDays(d?: string | null) {
    if (!d) return 0;

    const due = new Date(d);
    if (Number.isNaN(due.getTime())) return 0;

    const now = new Date();
    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayLocal = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const diffMs = todayLocal.getTime() - dueLocal.getTime();
    const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return rawDays > 0 ? rawDays : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object") return {};
    return value as Record<string, unknown>;
}

function firstFiniteNumber(values: unknown[]): number | null {
    for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string" && value.trim() !== "") {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
    }

    return null;
}

function firstTruthyString(values: unknown[]): string {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }

    return "";
}

export function fmtLibraryArea(area?: BookDTO["libraryArea"] | null) {
    if (!area) return "—";

    if (String(area) === "maritime") return "—";

    const map: Record<string, string> = {
        filipiniana: "Filipiniana",
        general_circulation: "General Circulation",
        periodicals: "Periodicals",
        thesis_dissertations: "Thesis & Dissertations",
        rizaliana: "Rizaliana",
        special_collection: "Special Collection",
        fil_gen_reference: "Fil/Gen Reference",
        general_reference: "General Reference",
        fiction: "Fiction",
    };

    return map[String(area)] ?? "—";
}

export function fmtDurationDays(days?: number | null) {
    if (days === null || days === undefined) return "—";
    if (typeof days !== "number" || Number.isNaN(days) || days <= 0) return "—";
    return `${days} day${days === 1 ? "" : "s"}`;
}

export function clampInt(n: number, min: number, max: number) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
}

export function getSubjects(book: Pick<BookDTO, "subjects" | "genre" | "category">) {
    const v =
        (typeof book.subjects === "string" && book.subjects.trim()) ||
        (typeof book.genre === "string" && book.genre.trim()) ||
        (typeof book.category === "string" && book.category.trim()) ||
        "";

    return v || "—";
}

export function getTotalCopies(book: BookDTO): number {
    const raw = asRecord(book);

    const explicitTotal = firstFiniteNumber([
        raw.totalCopies,
        raw.total_copies,
        raw.copyTotal,
        raw.copy_total,
        raw.totalStock,
        raw.total_stock,
    ]);

    if (explicitTotal !== null) {
        return Math.max(0, Math.floor(explicitTotal));
    }

    if (typeof book.numberOfCopies === "number" && Number.isFinite(book.numberOfCopies)) {
        return Math.max(0, Math.floor(book.numberOfCopies));
    }

    const borrowed = firstFiniteNumber([
        raw.borrowedCopies,
        raw.borrowed_copies,
        raw.activeBorrowedCopies,
        raw.active_borrowed_copies,
        raw.currentBorrowedCopies,
        raw.current_borrowed_copies,
    ]);

    if (borrowed !== null) {
        return Math.max(0, Math.floor(borrowed));
    }

    return book.available ? 1 : 0;
}

export function getBorrowedCopies(book: BookDTO): number {
    const raw = asRecord(book);

    const explicitBorrowed = firstFiniteNumber([
        raw.borrowedCopies,
        raw.borrowed_copies,
        raw.activeBorrowedCopies,
        raw.active_borrowed_copies,
        raw.currentBorrowedCopies,
        raw.current_borrowed_copies,
    ]);

    if (explicitBorrowed !== null) {
        const total = getTotalCopies(book);
        const safeBorrowed = Math.max(0, Math.floor(explicitBorrowed));
        return total > 0 ? Math.min(total, safeBorrowed) : safeBorrowed;
    }

    const explicitTotal = firstFiniteNumber([
        raw.totalCopies,
        raw.total_copies,
        raw.copyTotal,
        raw.copy_total,
        raw.totalStock,
        raw.total_stock,
    ]);

    if (
        explicitTotal !== null &&
        typeof book.numberOfCopies === "number" &&
        Number.isFinite(book.numberOfCopies)
    ) {
        return Math.max(0, Math.floor(explicitTotal) - Math.floor(book.numberOfCopies));
    }

    return 0;
}

export function getHistoricalBorrowCount(book: BookDTO): number | null {
    const raw = asRecord(book);

    const count = firstFiniteNumber([
        raw.borrowCount,
        raw.borrow_count,
        raw.timesBorrowed,
        raw.times_borrowed,
        raw.totalBorrows,
        raw.total_borrows,
        raw.totalBorrowCount,
        raw.total_borrow_count,
        raw.borrowedCount,
        raw.borrowed_count,
    ]);

    if (count === null) return null;

    return Math.max(0, Math.floor(count));
}

export function getRemainingCopies(book: BookDTO): number {
    const raw = asRecord(book);

    const explicitTotal = firstFiniteNumber([
        raw.totalCopies,
        raw.total_copies,
        raw.copyTotal,
        raw.copy_total,
        raw.totalStock,
        raw.total_stock,
    ]);

    const explicitBorrowed = firstFiniteNumber([
        raw.borrowedCopies,
        raw.borrowed_copies,
        raw.activeBorrowedCopies,
        raw.active_borrowed_copies,
        raw.currentBorrowedCopies,
        raw.current_borrowed_copies,
    ]);

    if (explicitTotal !== null && explicitBorrowed !== null) {
        return Math.max(
            0,
            Math.floor(explicitTotal) - Math.floor(explicitBorrowed)
        );
    }

    if (typeof book.numberOfCopies === "number" && Number.isFinite(book.numberOfCopies)) {
        return Math.max(0, Math.floor(book.numberOfCopies));
    }

    return book.available ? 1 : 0;
}

export function isLibraryUseOnly(book: BookDTO): boolean {
    const raw = asRecord(book);

    const booleanFlags = [
        raw.libraryUseOnly,
        raw.library_use_only,
        raw.isLibraryUseOnly,
        raw.is_library_use_only,
        raw.referenceOnly,
        raw.reference_only,
    ];

    if (booleanFlags.some((value) => value === true)) {
        return true;
    }

    const policyText = normalizeSearchText(
        firstTruthyString([
            raw.borrowingPolicy,
            raw.borrowing_policy,
            raw.borrowPolicy,
            raw.borrow_policy,
            raw.circulationType,
            raw.circulation_type,
            raw.policy,
            raw.policyLabel,
            raw.policy_label,
            raw.availabilityLabel,
            raw.availability_label,
            raw.remarks,
            raw.note,
            raw.notes,
            raw.status,
            raw.statusLabel,
            raw.status_label,
        ])
    );

    return (
        policyText.includes("library use only") ||
        policyText.includes("reference only") ||
        policyText.includes("not for borrowing") ||
        policyText.includes("for room use only") ||
        policyText.includes("in library use only")
    );
}

export function isBorrowable(book: BookDTO): boolean {
    return !isLibraryUseOnly(book) && Boolean(book.available) && getRemainingCopies(book) > 0;
}

export function sortRecordsNewestFirst(records: BorrowRecordDTO[]) {
    return [...records].sort((a, b) => {
        const ad = new Date(a.borrowDate).getTime();
        const bd = new Date(b.borrowDate).getTime();

        if (Number.isFinite(ad) && Number.isFinite(bd)) return bd - ad;
        return String(b.id).localeCompare(String(a.id));
    });
}

export function minDateStr(records: BorrowRecordDTO[], key: "dueDate" | "borrowDate") {
    if (records.length === 0) return null;

    let min: { t: number; s: string } | null = null;

    for (const r of records) {
        const raw = r[key];
        const t = new Date(raw).getTime();

        if (!Number.isFinite(t)) continue;
        if (!min || t < min.t) min = { t, s: raw };
    }

    return min ? min.s : records[0]?.[key] ?? null;
}

export function normalizeSearchText(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) {
        return value.map(normalizeSearchText).filter(Boolean).join(" ");
    }
    if (typeof value === "string") {
        return value.trim().toLowerCase().replace(/\s+/g, " ");
    }
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

export function buildCatalogSortKey(b: BookDTO): string {
    return [
        normalizeSearchText(b.callNumber),
        normalizeSearchText(b.accessionNumber),
        normalizeSearchText(b.title),
        normalizeSearchText(getSubjects(b)),
        normalizeSearchText(
            typeof b.publicationYear === "number" ? String(b.publicationYear) : ""
        ),
        normalizeSearchText(b.author),
    ]
        .filter(Boolean)
        .join("|");
}

export function getBookBorrowMeta(book: BookWithStatus) {
    const activeRecords = book.activeRecords || [];

    const pendingPickupRecords = activeRecords.filter(
        (r) => r.status === "pending" || r.status === "pending_pickup"
    );
    const borrowedRecords = activeRecords.filter((r) => r.status === "borrowed");
    const pendingReturnRecords = activeRecords.filter(
        (r) => r.status === "pending_return"
    );

    const totalFine = activeRecords.reduce(
        (sum, r) => sum + (typeof r.fine === "number" ? r.fine : 0),
        0
    );

    const earliestDueRaw = minDateStr(activeRecords, "dueDate");
    const earliestDue = earliestDueRaw ? fmtDate(earliestDueRaw) : "—";

    const overdueDaysMax =
        borrowedRecords.length > 0
            ? Math.max(
                0,
                ...borrowedRecords.map((r) => computeOverdueDays(r.dueDate))
            )
            : 0;

    const hasOverdue = overdueDaysMax > 0;

    const dueCell =
        activeRecords.length === 0
            ? "—"
            : activeRecords.length === 1
                ? earliestDue
                : `${earliestDue} (+${activeRecords.length - 1} more)`;

    const remaining = getRemainingCopies(book);
    const borrowableNow = isBorrowable(book);
    const borrowBtnLabel = activeRecords.length > 0 ? "Borrow more" : "Borrow";

    return {
        activeRecords,
        pendingPickupRecords,
        borrowedRecords,
        pendingReturnRecords,
        totalFine,
        earliestDueRaw,
        earliestDue,
        overdueDaysMax,
        hasOverdue,
        dueCell,
        remaining,
        borrowableNow,
        borrowBtnLabel,
    };
}