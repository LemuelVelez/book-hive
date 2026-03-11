import type { BorrowRecordDTO } from "@/lib/borrows"
import type { BookDTO } from "@/lib/books"
import type { BookWithStatus } from "@/components/faculty-books/types"

export function fmtDate(d?: string | null) {
    if (!d) return "—"
    try {
        const date = new Date(d)
        if (Number.isNaN(date.getTime())) return d
        return date.toLocaleDateString("en-CA")
    } catch {
        return d
    }
}

export function peso(n: number) {
    if (typeof n !== "number" || Number.isNaN(n)) return "₱0.00"
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 2,
        }).format(n)
    } catch {
        return `₱${n.toFixed(2)}`
    }
}

export function computeOverdueDays(d?: string | null) {
    if (!d) return 0
    const due = new Date(d)
    if (Number.isNaN(due.getTime())) return 0

    const now = new Date()
    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate())
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const diffMs = todayLocal.getTime() - dueLocal.getTime()
    const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    return rawDays > 0 ? rawDays : 0
}

export function getSubjects(book: BookDTO) {
    const s =
        (typeof book.subjects === "string" && book.subjects.trim()) ||
        (typeof book.genre === "string" && book.genre.trim()) ||
        (typeof book.category === "string" && book.category.trim()) ||
        ""
    return s || "—"
}

export function fmtDurationDays(days?: number | null) {
    if (days === null || days === undefined) return "—"
    if (typeof days !== "number" || Number.isNaN(days) || days <= 0) return "—"
    return `${days} day${days === 1 ? "" : "s"}`
}

export function clampInt(n: number, min: number, max: number) {
    const v = Math.floor(Number(n))
    if (!Number.isFinite(v)) return min
    return Math.min(max, Math.max(min, v))
}

export function getRemainingCopies(book: BookDTO): number {
    if (
        typeof book.numberOfCopies === "number" &&
        Number.isFinite(book.numberOfCopies)
    ) {
        return Math.max(0, Math.floor(book.numberOfCopies))
    }
    return book.available ? 1 : 0
}

export function isLibraryUseOnlyBook(book: BookDTO): boolean {
    return Boolean(book.isLibraryUseOnly || book.canBorrow === false)
}

export function isBorrowable(book: BookDTO): boolean {
    if (isLibraryUseOnlyBook(book)) return false
    if (book.canBorrow === false) return false
    return Boolean(book.available) && getRemainingCopies(book) > 0
}

export function getActiveBorrowCount(book: BookDTO): number {
    if (
        typeof book.activeBorrowCount === "number" &&
        Number.isFinite(book.activeBorrowCount)
    ) {
        return Math.max(0, Math.floor(book.activeBorrowCount))
    }
    return 0
}

export function getTotalBorrowCount(book: BookDTO): number {
    const active = getActiveBorrowCount(book)

    if (
        typeof book.totalBorrowCount === "number" &&
        Number.isFinite(book.totalBorrowCount)
    ) {
        return Math.max(active, Math.floor(book.totalBorrowCount))
    }

    return active
}

export function sortRecordsNewestFirst(records: BorrowRecordDTO[]) {
    return [...records].sort((a, b) => {
        const ad = new Date(a.borrowDate).getTime()
        const bd = new Date(b.borrowDate).getTime()
        if (Number.isFinite(ad) && Number.isFinite(bd)) return bd - ad
        return String(b.id).localeCompare(String(a.id))
    })
}

export function minDateStr(records: BorrowRecordDTO[], key: "dueDate" | "borrowDate") {
    if (records.length === 0) return null
    let min: { t: number; s: string } | null = null

    for (const r of records) {
        const raw = r[key]
        const t = new Date(raw).getTime()
        if (!Number.isFinite(t)) continue
        if (!min || t < min.t) min = { t, s: raw }
    }

    return min ? min.s : records[0]?.[key] ?? null
}

export function normalizeSearchText(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (Array.isArray(value)) return value.map(normalizeSearchText).filter(Boolean).join(" ")
    if (typeof value === "string") return value.trim().toLowerCase().replace(/\s+/g, " ")
    return String(value).trim().toLowerCase().replace(/\s+/g, " ")
}

export function tokenizeSearch(query: string): string[] {
    return normalizeSearchText(query)
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
}

export function matchesAllTokens(hay: string, tokens: string[]): boolean {
    if (tokens.length === 0) return true
    return tokens.every((t) => hay.includes(t))
}

export function compareText(a: unknown, b: unknown) {
    const av = normalizeSearchText(a)
    const bv = normalizeSearchText(b)

    if (!av && !bv) return 0
    if (!av) return 1
    if (!bv) return -1

    return av.localeCompare(bv, undefined, { sensitivity: "base" })
}

export function compareNullableNumber(
    a: number | null | undefined,
    b: number | null | undefined,
    direction: "asc" | "desc" = "asc"
) {
    const av = typeof a === "number" && Number.isFinite(a) ? a : null
    const bv = typeof b === "number" && Number.isFinite(b) ? b : null

    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1

    return direction === "asc" ? av - bv : bv - av
}

export function buildCatalogSortKey(book: BookDTO): string {
    return [
        normalizeSearchText(book.callNumber),
        normalizeSearchText(book.accessionNumber),
        normalizeSearchText(book.title),
        normalizeSearchText(book.subtitle),
        normalizeSearchText(book.author),
    ]
        .filter(Boolean)
        .join("|")
}

export function shouldIgnoreHorizontalDrag(target: EventTarget | null) {
    if (!(target instanceof Element)) return false

    return Boolean(
        target.closest(
            [
                "button",
                "a",
                "input",
                "textarea",
                "select",
                "[role='button']",
                "[role='link']",
                "[data-state]",
                "[data-radix-collection-item]",
            ].join(",")
        )
    )
}

export function getBookBorrowMeta(book: BookWithStatus) {
    const activeRecords = book.activeRecords || []

    const pendingPickupRecords = activeRecords.filter(
        (r) => r.status === "pending" || r.status === "pending_pickup"
    )
    const borrowedRecords = activeRecords.filter((r) => r.status === "borrowed")
    const pendingReturnRecords = activeRecords.filter((r) => r.status === "pending_return")

    const totalFine = activeRecords.reduce(
        (sum, r) => sum + (typeof r.fine === "number" ? r.fine : 0),
        0
    )

    const earliestDueRaw = minDateStr(activeRecords, "dueDate")
    const earliestDue = earliestDueRaw ? fmtDate(earliestDueRaw) : "—"

    const overdueDaysMax =
        borrowedRecords.length > 0
            ? Math.max(0, ...borrowedRecords.map((r) => computeOverdueDays(r.dueDate)))
            : 0

    const hasOverdue = overdueDaysMax > 0

    const dueCell =
        activeRecords.length === 0
            ? "—"
            : activeRecords.length === 1
                ? earliestDue
                : `${earliestDue} (+${activeRecords.length - 1} more)`

    return {
        activeRecords,
        pendingPickupRecords,
        borrowedRecords,
        pendingReturnRecords,
        totalFine,
        earliestDue,
        overdueDaysMax,
        hasOverdue,
        dueCell,
    }
}