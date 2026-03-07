/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    BookOpen,
    RefreshCcw,
    Loader2,
    Search,
    CheckCircle2,
    CircleOff,
    Clock3,
    AlertTriangle,
    Plus,
    Minus,
    ArrowUpDown,
    Filter,
    X,
} from "lucide-react"
import { toast } from "sonner"

import { fetchBooks, type BookDTO } from "@/lib/books"
import {
    fetchMyBorrowRecords,
    createSelfBorrow,
    type BorrowRecordDTO,
} from "@/lib/borrows"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type FilterMode =
    | "all"
    | "available"
    | "unavailable"
    | "borrowedByMe"
    | "history"

type AvailabilityFilter = "all" | "available" | "unavailable"

type FacultySortOption =
    | "catalog"
    | "call_no_asc"
    | "call_no_desc"
    | "accession_asc"
    | "accession_desc"
    | "title_asc"
    | "title_desc"
    | "author_asc"
    | "author_desc"
    | "pub_year_desc"
    | "pub_year_asc"

type BookWithStatus = BookDTO & {
    myStatus: "never" | "active" | "returned"
    activeRecords: BorrowRecordDTO[]
    lastReturnedRecord?: BorrowRecordDTO | null
    lastRecord?: BorrowRecordDTO | null
}

/**
 * Format a date string as YYYY-MM-DD in the *local* timezone.
 * This avoids the off-by-one day bug from using toISOString() / UTC.
 */
function fmtDate(d?: string | null) {
    if (!d) return "—"
    try {
        const date = new Date(d)
        if (Number.isNaN(date.getTime())) return d
        return date.toLocaleDateString("en-CA")
    } catch {
        return d
    }
}

function peso(n: number) {
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

/**
 * Compute how many full days a book is overdue based on due date and today
 * in the local timezone. Returns 0 if not overdue or if the date is invalid.
 */
function computeOverdueDays(d?: string | null) {
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

function getSubjects(book: BookDTO) {
    const s =
        (typeof book.subjects === "string" && book.subjects.trim()) ||
        (typeof book.genre === "string" && book.genre.trim()) ||
        (typeof book.category === "string" && book.category.trim()) ||
        ""
    return s || "—"
}

function fmtDurationDays(days?: number | null) {
    if (days === null || days === undefined) return "—"
    if (typeof days !== "number" || Number.isNaN(days) || days <= 0) return "—"
    return `${days} day${days === 1 ? "" : "s"}`
}

function clampInt(n: number, min: number, max: number) {
    const v = Math.floor(Number(n))
    if (!Number.isFinite(v)) return min
    return Math.min(max, Math.max(min, v))
}

/**
 * ✅ Remaining copies helper:
 * BookDTO.numberOfCopies is REMAINING/AVAILABLE copies (backend deducts as users borrow).
 * If it’s missing, fall back to 1 if `available`, else 0.
 */
function getRemainingCopies(book: BookDTO): number {
    if (
        typeof book.numberOfCopies === "number" &&
        Number.isFinite(book.numberOfCopies)
    ) {
        return Math.max(0, Math.floor(book.numberOfCopies))
    }
    return book.available ? 1 : 0
}

/**
 * ✅ A book is borrowable only if:
 * - backend says available AND
 * - there is at least 1 remaining copy
 */
function isBorrowable(book: BookDTO): boolean {
    return Boolean(book.available) && getRemainingCopies(book) > 0
}

function sortRecordsNewestFirst(records: BorrowRecordDTO[]) {
    return [...records].sort((a, b) => {
        const ad = new Date(a.borrowDate).getTime()
        const bd = new Date(b.borrowDate).getTime()
        if (Number.isFinite(ad) && Number.isFinite(bd)) return bd - ad
        return String(b.id).localeCompare(String(a.id))
    })
}

function minDateStr(records: BorrowRecordDTO[], key: "dueDate" | "borrowDate") {
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

function normalizeSearchText(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (Array.isArray(value)) return value.map(normalizeSearchText).filter(Boolean).join(" ")
    if (typeof value === "string") return value.trim().toLowerCase().replace(/\s+/g, " ")
    return String(value).trim().toLowerCase().replace(/\s+/g, " ")
}

function tokenizeSearch(query: string): string[] {
    return normalizeSearchText(query)
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
}

function matchesAllTokens(hay: string, tokens: string[]): boolean {
    if (tokens.length === 0) return true
    return tokens.every((t) => hay.includes(t))
}

function compareText(a: unknown, b: unknown) {
    const av = normalizeSearchText(a)
    const bv = normalizeSearchText(b)

    if (!av && !bv) return 0
    if (!av) return 1
    if (!bv) return -1

    return av.localeCompare(bv, undefined, { sensitivity: "base" })
}

function compareNullableNumber(
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

function buildCatalogSortKey(book: BookDTO): string {
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

function shouldIgnoreHorizontalDrag(target: EventTarget | null) {
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

export default function FacultyBooksPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([])
    const [myRecords, setMyRecords] = React.useState<BorrowRecordDTO[]>([])
    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const [search, setSearch] = React.useState("")
    const [filterMode, setFilterMode] = React.useState<FilterMode>("all")
    const [availabilityFilter, setAvailabilityFilter] =
        React.useState<AvailabilityFilter>("all")
    const [sortOption, setSortOption] = React.useState<FacultySortOption>("catalog")
    const [borrowBusyId, setBorrowBusyId] = React.useState<string | null>(null)

    // ✅ copies-to-borrow state (shared; only one dialog open at a time)
    const [borrowDialogBookId, setBorrowDialogBookId] = React.useState<string | null>(
        null
    )
    const [borrowCopies, setBorrowCopies] = React.useState<number>(1)

    const tableScrollRef = React.useRef<HTMLDivElement | null>(null)
    const tableDragPointerIdRef = React.useRef<number | null>(null)
    const tableDragStartXRef = React.useRef(0)
    const tableDragStartScrollLeftRef = React.useRef(0)
    const [isTableDragging, setIsTableDragging] = React.useState(false)

    const stopTableDrag = React.useCallback(() => {
        const el = tableScrollRef.current
        const pointerId = tableDragPointerIdRef.current

        if (el && pointerId !== null) {
            try {
                el.releasePointerCapture(pointerId)
            } catch {
                // noop
            }
        }

        tableDragPointerIdRef.current = null
        setIsTableDragging(false)
    }, [])

    const handleTablePointerDown = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const el = tableScrollRef.current
            if (!el) return
            if (e.pointerType === "mouse" && e.button !== 0) return
            if (shouldIgnoreHorizontalDrag(e.target)) return

            tableDragPointerIdRef.current = e.pointerId
            tableDragStartXRef.current = e.clientX
            tableDragStartScrollLeftRef.current = el.scrollLeft

            try {
                el.setPointerCapture(e.pointerId)
            } catch {
                // noop
            }

            setIsTableDragging(true)
        },
        []
    )

    const handleTablePointerMove = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const el = tableScrollRef.current
            if (!el) return
            if (!isTableDragging) return
            if (tableDragPointerIdRef.current !== e.pointerId) return

            const deltaX = e.clientX - tableDragStartXRef.current
            el.scrollLeft = tableDragStartScrollLeftRef.current - deltaX
            e.preventDefault()
        },
        [isTableDragging]
    )

    const handleTablePointerUp = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (tableDragPointerIdRef.current !== e.pointerId) return
            stopTableDrag()
        },
        [stopTableDrag]
    )

    React.useEffect(() => {
        return () => {
            stopTableDrag()
        }
    }, [stopTableDrag])

    const loadAll = React.useCallback(async () => {
        setError(null)
        setLoading(true)
        try {
            const [booksData, myRecordsData] = await Promise.all([
                fetchBooks(),
                fetchMyBorrowRecords(),
            ])
            setBooks(booksData)
            setMyRecords(myRecordsData)
        } catch (err: any) {
            const msg = err?.message || "Failed to load books. Please try again later."
            setError(msg)
            toast.error("Failed to load books", { description: msg })
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void loadAll()
    }, [loadAll])

    async function handleRefresh() {
        setRefreshing(true)
        try {
            await loadAll()
        } finally {
            setRefreshing(false)
        }
    }

    const clearCatalogControls = React.useCallback(() => {
        setSearch("")
        setFilterMode("all")
        setAvailabilityFilter("all")
        setSortOption("catalog")
    }, [])

    const hasCatalogControlsApplied =
        search.trim().length > 0 ||
        filterMode !== "all" ||
        availabilityFilter !== "all" ||
        sortOption !== "catalog"

    const rows: BookWithStatus[] = React.useMemo(() => {
        const tokens = tokenizeSearch(search)

        const withStatus: BookWithStatus[] = books.map((book) => {
            const recordsForBook = myRecords.filter((r) => r.bookId === book.id)
            const sorted = sortRecordsNewestFirst(recordsForBook)

            const activeRecords = sorted.filter(
                (r) =>
                    r.status === "borrowed" ||
                    r.status === "pending" ||
                    r.status === "pending_pickup" ||
                    r.status === "pending_return"
            )

            const returnedRecords = sorted.filter((r) => r.status === "returned")
            const lastReturnedRecord = returnedRecords[0] ?? null
            const lastRecord = sorted[0] ?? null

            const myStatus: "never" | "active" | "returned" =
                activeRecords.length > 0 ? "active" : sorted.length > 0 ? "returned" : "never"

            return {
                ...book,
                myStatus,
                activeRecords,
                lastReturnedRecord,
                lastRecord,
            }
        })

        const filtered = withStatus.filter((book) => {
            const borrowable = isBorrowable(book)

            switch (filterMode) {
                case "available":
                    if (!borrowable) return false
                    break
                case "unavailable":
                    if (borrowable) return false
                    break
                case "borrowedByMe":
                    if (book.activeRecords.length === 0) return false
                    break
                case "history":
                    if (!book.lastRecord) return false
                    break
                case "all":
                default:
                    break
            }

            if (availabilityFilter === "available" && !borrowable) return false
            if (availabilityFilter === "unavailable" && borrowable) return false

            if (tokens.length === 0) return true

            const hay = [
                book.callNumber,
                book.accessionNumber,
                book.title,
                book.subtitle,
                book.author,
                book.isbn,
                book.issn,
                book.publisher,
                book.placeOfPublication,
                book.subjects,
                book.genre,
                book.category,
                book.series,
                book.barcode,
                book.edition,
                book.volumeNumber,
                String(typeof book.publicationYear === "number" ? book.publicationYear : ""),
                String(getRemainingCopies(book)),
                String(typeof book.totalCopies === "number" ? book.totalCopies : ""),
                String(typeof book.borrowedCopies === "number" ? book.borrowedCopies : ""),
                borrowable ? "available" : "unavailable",
                book.activeRecords.length > 0 ? "borrowed" : "",
                book.myStatus,
            ]
                .map(normalizeSearchText)
                .filter(Boolean)
                .join(" ")

            return matchesAllTokens(hay, tokens)
        })

        return [...filtered].sort((a, b) => {
            switch (sortOption) {
                case "call_no_asc":
                    return (
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        compareText(a.author, b.author) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "call_no_desc":
                    return (
                        compareText(b.callNumber, a.callNumber) ||
                        compareText(b.accessionNumber, a.accessionNumber) ||
                        compareText(b.title, a.title) ||
                        compareText(b.author, a.author) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "accession_asc":
                    return (
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.title, b.title) ||
                        compareText(a.author, b.author) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "accession_desc":
                    return (
                        compareText(b.accessionNumber, a.accessionNumber) ||
                        compareText(b.callNumber, a.callNumber) ||
                        compareText(b.title, a.title) ||
                        compareText(b.author, a.author) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "title_asc":
                    return (
                        compareText(a.title, b.title) ||
                        compareText(a.subtitle, b.subtitle) ||
                        compareText(a.author, b.author) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "title_desc":
                    return (
                        compareText(b.title, a.title) ||
                        compareText(b.subtitle, a.subtitle) ||
                        compareText(b.author, a.author) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "author_asc":
                    return (
                        compareText(a.author, b.author) ||
                        compareText(a.title, b.title) ||
                        compareText(a.callNumber, b.callNumber) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "author_desc":
                    return (
                        compareText(b.author, a.author) ||
                        compareText(b.title, a.title) ||
                        compareText(b.callNumber, a.callNumber) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "pub_year_desc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "desc") ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "pub_year_asc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "asc") ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    )

                case "catalog":
                default:
                    return buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                        sensitivity: "base",
                    })
            }
        })
    }, [books, myRecords, filterMode, availabilityFilter, sortOption, search])

    /**
     * ✅ UPDATED BEHAVIOR:
     * - Faculty can borrow as many copies as they want, as long as there are remaining copies.
     * - We DO NOT block borrowing just because the user already has an active borrow for the same book.
     */
    async function handleBorrow(book: BookWithStatus, copiesRequested = 1) {
        const remaining = getRemainingCopies(book)

        if (!isBorrowable(book) || remaining <= 0) {
            toast.info("Book is not available right now.", {
                description: "There are no remaining copies to borrow.",
            })
            return
        }

        const requestedCopies = clampInt(copiesRequested, 1, remaining)

        setBorrowBusyId(book.id)

        try {
            const created: BorrowRecordDTO[] = []

            for (let i = 0; i < requestedCopies; i++) {
                try {
                    const record = await createSelfBorrow(book.id, 1)
                    created.push(record)
                } catch (err: any) {
                    if (created.length === 0) throw err

                    const msg = err?.message || "Some copies could not be borrowed."
                    toast.warning("Partial borrow completed", {
                        description: `Borrowed ${created.length} of ${requestedCopies} copies. ${msg}`,
                    })
                    break
                }
            }

            if (created.length === 0) return

            const due = fmtDate(created[0]?.dueDate)

            toast.success("Borrow request submitted", {
                description: `${created.length} cop${created.length === 1 ? "y" : "ies"
                    } of "${book.title}" ${created.length === 1 ? "is" : "are"} now pending pickup. Earliest due date: ${due}.`,
            })

            setMyRecords((prev) => [...created.slice().reverse(), ...prev])

            try {
                const [booksLatest, myLatest] = await Promise.all([
                    fetchBooks(),
                    fetchMyBorrowRecords(),
                ])
                setBooks(booksLatest)
                setMyRecords(myLatest)
            } catch {
                // optimistic state already applied
            }
        } catch (err: any) {
            const msg =
                err?.message ||
                "Could not borrow this book right now. Please try again later."
            toast.error("Borrow failed", { description: msg })
        } finally {
            setBorrowBusyId(null)
        }
    }

    return (
        <DashboardLayout title="Browse Books">
            <div className="w-full overflow-x-hidden">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" aria-hidden="true" />
                        <div>
                            <h2 className="text-lg font-semibold leading-tight">
                                Library catalog
                            </h2>
                            <p className="text-xs text-white/70">
                                Browse all books, see availability, and borrow as many copies as
                                you need while copies remain.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            aria-label="Refresh books"
                        >
                            {refreshing || loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                            )}
                            <span className="sr-only">Refresh</span>
                        </Button>
                    </div>
                </div>

                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <CardTitle>Books you can borrow</CardTitle>
                                <p className="text-xs text-white/70">
                                    Showing {rows.length} of {books.length}{" "}
                                    {books.length === 1 ? "book" : "books"}.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                                <div className="relative min-w-0 md:col-span-2 xl:col-span-4">
                                    <Search
                                        className="absolute left-3 top-2.5 h-4 w-4 text-white/50"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search call no., accession, title, subtitle, author, ISBN, subjects…"
                                        autoComplete="off"
                                        aria-label="Search books"
                                        className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                    />
                                </div>

                                <Select
                                    value={filterMode}
                                    onValueChange={(v) => setFilterMode(v as FilterMode)}
                                >
                                    <SelectTrigger
                                        className="w-full bg-slate-900/70 border-white/20 text-white"
                                        aria-label="Filter my books"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="My records filter" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="all">All books</SelectItem>
                                        <SelectItem value="available">Available only</SelectItem>
                                        <SelectItem value="unavailable">Unavailable only</SelectItem>
                                        <SelectItem value="borrowedByMe">
                                            Borrowed by me
                                        </SelectItem>
                                        <SelectItem value="history">
                                            My history
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={availabilityFilter}
                                    onValueChange={(v) => setAvailabilityFilter(v as AvailabilityFilter)}
                                >
                                    <SelectTrigger
                                        className="w-full bg-slate-900/70 border-white/20 text-white"
                                        aria-label="Availability filter"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="Availability" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="all">All availability</SelectItem>
                                        <SelectItem value="available">Available only</SelectItem>
                                        <SelectItem value="unavailable">Unavailable only</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={sortOption}
                                    onValueChange={(v) => setSortOption(v as FacultySortOption)}
                                >
                                    <SelectTrigger
                                        className="w-full bg-slate-900/70 border-white/20 text-white"
                                        aria-label="Sort books"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <ArrowUpDown className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="Sort books" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="catalog">
                                            Catalog order
                                        </SelectItem>
                                        <SelectItem value="call_no_asc">
                                            Call no. (A–Z)
                                        </SelectItem>
                                        <SelectItem value="call_no_desc">
                                            Call no. (Z–A)
                                        </SelectItem>
                                        <SelectItem value="accession_asc">
                                            Accession no. (A–Z)
                                        </SelectItem>
                                        <SelectItem value="accession_desc">
                                            Accession no. (Z–A)
                                        </SelectItem>
                                        <SelectItem value="title_asc">
                                            Title (A–Z)
                                        </SelectItem>
                                        <SelectItem value="title_desc">
                                            Title (Z–A)
                                        </SelectItem>
                                        <SelectItem value="author_asc">
                                            Author (A–Z)
                                        </SelectItem>
                                        <SelectItem value="author_desc">
                                            Author (Z–A)
                                        </SelectItem>
                                        <SelectItem value="pub_year_desc">
                                            Publication year (Newest first)
                                        </SelectItem>
                                        <SelectItem value="pub_year_asc">
                                            Publication year (Oldest first)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-4 sm:flex-row sm:flex-wrap">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-white/20 text-white/90 hover:bg-white/10"
                                        onClick={clearCatalogControls}
                                        disabled={!hasCatalogControlsApplied}
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <p className="mt-2 text-[11px] text-white/60">
                            When you borrow a book online, its status starts as{" "}
                            <span className="font-semibold text-amber-200">
                                Pending pickup
                            </span>{" "}
                            until a librarian confirms pickup. After confirmation it will
                            appear as{" "}
                            <span className="font-semibold text-emerald-200">Borrowed</span>.
                        </p>
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ) : error ? (
                            <div className="py-6 text-center text-sm text-red-300">
                                {error}
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="py-10 text-center text-sm text-white/70">
                                No books matched your filters.
                                <br />
                                <span className="text-xs opacity-80">
                                    Try clearing the search or changing the filter.
                                </span>
                            </div>
                        ) : (
                            <>
                                <div className="mb-2 hidden md:flex items-center justify-between gap-2 text-[11px] text-white/60">
                                    <span>
                                        Drag the table left or right to view more columns.
                                    </span>
                                    <span>
                                        You can still use the horizontal scrollbar if needed.
                                    </span>
                                </div>

                                <Table
                                    ref={tableScrollRef}
                                    className="min-w-[1380px]"
                                    containerClassName={`hidden md:block rounded-md ${isTableDragging ? "cursor-grabbing select-none" : "cursor-grab"
                                        }`}
                                    containerProps={{
                                        onPointerDown: handleTablePointerDown,
                                        onPointerMove: handleTablePointerMove,
                                        onPointerUp: handleTablePointerUp,
                                        onPointerCancel: stopTableDrag,
                                        onLostPointerCapture: stopTableDrag,
                                    }}
                                >
                                    <TableCaption className="text-xs text-white/60">
                                        Showing {rows.length} {rows.length === 1 ? "book" : "books"}.
                                        Sorted and filtered catalog view for faculty borrowers.
                                    </TableCaption>
                                    <TableHeader>
                                        <TableRow className="border-white/10">
                                            <TableHead className="min-w-[140px] text-xs font-semibold text-white/70">
                                                Call no.
                                            </TableHead>
                                            <TableHead className="min-w-[130px] text-xs font-semibold text-white/70">
                                                Acc. no.
                                            </TableHead>
                                            <TableHead className="min-w-[220px] text-xs font-semibold text-white/70">
                                                Title
                                            </TableHead>
                                            <TableHead className="min-w-[180px] text-xs font-semibold text-white/70">
                                                Sub.
                                            </TableHead>
                                            <TableHead className="min-w-[90px] text-xs font-semibold text-white/70">
                                                Pub. year
                                            </TableHead>
                                            <TableHead className="min-w-[170px] text-xs font-semibold text-white/70">
                                                Author
                                            </TableHead>
                                            <TableHead className="min-w-[140px] text-xs font-semibold text-white/70">
                                                ISBN
                                            </TableHead>
                                            <TableHead className="min-w-[180px] text-xs font-semibold text-white/70">
                                                Subjects
                                            </TableHead>
                                            <TableHead className="min-w-[140px] text-xs font-semibold text-white/70">
                                                Availability
                                            </TableHead>
                                            <TableHead className="min-w-[120px] text-xs font-semibold text-white/70">
                                                Due date
                                            </TableHead>
                                            <TableHead className="min-w-[260px] text-xs font-semibold text-white/70">
                                                My status
                                            </TableHead>
                                            <TableHead className="min-w-[220px] text-right text-xs font-semibold text-white/70">
                                                Action
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {rows.map((book) => {
                                            const remaining = getRemainingCopies(book)
                                            const borrowableNow = isBorrowable(book)

                                            const activeRecords = book.activeRecords || []
                                            const pendingPickupRecords = activeRecords.filter(
                                                (r) =>
                                                    r.status === "pending" ||
                                                    r.status === "pending_pickup"
                                            )
                                            const borrowedRecords = activeRecords.filter(
                                                (r) => r.status === "borrowed"
                                            )
                                            const pendingReturnRecords = activeRecords.filter(
                                                (r) => r.status === "pending_return"
                                            )

                                            const totalFine = activeRecords.reduce(
                                                (sum, r) =>
                                                    sum + (typeof r.fine === "number" ? r.fine : 0),
                                                0
                                            )

                                            const earliestDueRaw = minDateStr(activeRecords, "dueDate")
                                            const earliestDue = earliestDueRaw ? fmtDate(earliestDueRaw) : "—"

                                            const overdueDaysMax =
                                                borrowedRecords.length > 0
                                                    ? Math.max(
                                                        0,
                                                        ...borrowedRecords.map((r) =>
                                                            computeOverdueDays(r.dueDate)
                                                        )
                                                    )
                                                    : 0

                                            const hasOverdue = overdueDaysMax > 0

                                            const dueCell =
                                                activeRecords.length === 0
                                                    ? "—"
                                                    : activeRecords.length === 1
                                                        ? earliestDue
                                                        : `${earliestDue} (+${activeRecords.length - 1} more)`

                                            const maxCopies = remaining
                                            const isThisDialog = borrowDialogBookId === book.id
                                            const qty = isThisDialog
                                                ? clampInt(borrowCopies, 1, Math.max(1, maxCopies))
                                                : 1

                                            const borrowBtnLabel =
                                                activeRecords.length > 0 ? "Borrow more" : "Borrow"

                                            return (
                                                <TableRow
                                                    key={book.id}
                                                    className="border-white/5 hover:bg-white/5 transition-colors"
                                                >
                                                    <TableCell className="align-top text-sm text-white/85 whitespace-normal wrap-break-word">
                                                        {book.callNumber || (
                                                            <span className="opacity-50">—</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="align-top text-sm text-white/85 whitespace-normal wrap-break-word">
                                                        {book.accessionNumber || (
                                                            <span className="opacity-50">—</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="align-top">
                                                        <div className="text-sm font-medium text-white whitespace-normal wrap-break-word">
                                                            {book.title}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="align-top text-sm text-white/80 whitespace-normal wrap-break-word">
                                                        {book.subtitle || (
                                                            <span className="opacity-50">—</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="align-top text-sm text-white/80">
                                                        {book.publicationYear || (
                                                            <span className="opacity-50">—</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="align-top text-sm text-white/90 whitespace-normal wrap-break-word">
                                                        {book.author || (
                                                            <span className="opacity-50">—</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="align-top text-sm text-white/80 whitespace-normal wrap-break-word">
                                                        {book.isbn || (
                                                            <span className="opacity-50">—</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="align-top text-sm text-white/80 whitespace-normal wrap-break-word">
                                                        {getSubjects(book)}
                                                    </TableCell>

                                                    <TableCell className="align-top text-xs">
                                                        <Badge
                                                            variant={borrowableNow ? "default" : "outline"}
                                                            className={
                                                                borrowableNow
                                                                    ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80"
                                                                    : "border-red-400/70 text-red-200 hover:bg-red-500/10"
                                                            }
                                                        >
                                                            {borrowableNow ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                                                    Available{" "}
                                                                    <span className="opacity-80">({remaining} left)</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <CircleOff className="h-3 w-3" aria-hidden="true" />
                                                                    Unavailable
                                                                </span>
                                                            )}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="align-top text-sm text-white/80 whitespace-normal wrap-break-word">
                                                        {dueCell === "—" ? (
                                                            <span className="opacity-50">—</span>
                                                        ) : (
                                                            dueCell
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="align-top text-xs whitespace-normal wrap-break-word">
                                                        {activeRecords.length === 0 && book.myStatus === "never" && (
                                                            <span className="text-white/60">Not yet borrowed</span>
                                                        )}

                                                        {activeRecords.length > 0 && (
                                                            <div className="space-y-1">
                                                                {pendingPickupRecords.length > 0 && (
                                                                    <div className="inline-flex items-center gap-1 text-amber-200">
                                                                        <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                                        <span>
                                                                            Pending pickup ×{pendingPickupRecords.length}
                                                                            {" · "}Earliest due:{" "}
                                                                            <span className="font-medium">{earliestDue}</span>
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {borrowedRecords.length > 0 && !hasOverdue && (
                                                                    <div className="inline-flex items-center gap-1 text-amber-200">
                                                                        <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                                        <span>
                                                                            Borrowed ×{borrowedRecords.length}
                                                                            {" · "}Earliest due:{" "}
                                                                            <span className="font-medium">{earliestDue}</span>
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {borrowedRecords.length > 0 && hasOverdue && (
                                                                    <div className="inline-flex items-center gap-1 text-red-300">
                                                                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                                        <span>
                                                                            Overdue ×{borrowedRecords.length}
                                                                            {" · "}Max overdue:{" "}
                                                                            <span className="font-semibold">
                                                                                {overdueDaysMax} day{overdueDaysMax === 1 ? "" : "s"}
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {pendingReturnRecords.length > 0 && (
                                                                    <div className="text-white/70">
                                                                        Return requested ×{pendingReturnRecords.length}
                                                                    </div>
                                                                )}

                                                                {totalFine > 0 && (
                                                                    <div className="text-red-300">
                                                                        Fine total: {peso(totalFine)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {activeRecords.length === 0 &&
                                                            book.myStatus === "returned" &&
                                                            book.lastReturnedRecord && (
                                                                <span className="inline-flex items-center gap-1 text-white/70">
                                                                    <CheckCircle2
                                                                        className="h-3 w-3 text-emerald-300 shrink-0"
                                                                        aria-hidden="true"
                                                                    />
                                                                    <span>
                                                                        Returned · Last returned:{" "}
                                                                        <span className="font-medium">
                                                                            {fmtDate(book.lastReturnedRecord.returnDate)}
                                                                        </span>
                                                                    </span>
                                                                </span>
                                                            )}
                                                    </TableCell>

                                                    <TableCell className="align-top text-right">
                                                        {borrowableNow ? (
                                                            <AlertDialog
                                                                onOpenChange={(open) => {
                                                                    if (open) {
                                                                        setBorrowDialogBookId(book.id)
                                                                        setBorrowCopies(1)
                                                                    } else {
                                                                        setBorrowDialogBookId(null)
                                                                        setBorrowCopies(1)
                                                                    }
                                                                }}
                                                            >
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                                                                        disabled={borrowBusyId === book.id || maxCopies <= 0}
                                                                    >
                                                                        {borrowBtnLabel}
                                                                    </Button>
                                                                </AlertDialogTrigger>

                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Confirm borrow</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            You are about to borrow{" "}
                                                                            <span className="font-semibold text-white">
                                                                                “{book.title}”
                                                                            </span>{" "}
                                                                            by{" "}
                                                                            <span className="font-semibold text-white">
                                                                                {book.author}
                                                                            </span>
                                                                            . Please confirm the details below.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>

                                                                    <div className="mt-3 text-sm text-white/80 space-y-1">
                                                                        <p>
                                                                            <span className="text-white/60">Call no.:</span>{" "}
                                                                            {book.callNumber || "—"}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">Accession #:</span>{" "}
                                                                            {book.accessionNumber || "—"}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">Subtitle:</span>{" "}
                                                                            {book.subtitle || "—"}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">Publication year:</span>{" "}
                                                                            {book.publicationYear || "—"}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">ISBN:</span>{" "}
                                                                            {book.isbn || "—"}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">Edition:</span>{" "}
                                                                            {book.edition || "—"}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">Publisher:</span>{" "}
                                                                            {book.publisher || "—"}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">Subjects:</span>{" "}
                                                                            {getSubjects(book)}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">
                                                                                Default loan duration:
                                                                            </span>{" "}
                                                                            {fmtDurationDays(book.borrowDurationDays)}
                                                                        </p>

                                                                        <div className="pt-3">
                                                                            <div className="text-xs font-medium text-white/80 mb-1">
                                                                                Copies to borrow
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <Button
                                                                                    type="button"
                                                                                    size="icon"
                                                                                    variant="outline"
                                                                                    className="border-white/20 text-white hover:bg-white/10"
                                                                                    onClick={() =>
                                                                                        setBorrowCopies((v) =>
                                                                                            clampInt(v - 1, 1, Math.max(1, maxCopies))
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        borrowBusyId === book.id ||
                                                                                        !isThisDialog ||
                                                                                        qty <= 1
                                                                                    }
                                                                                    aria-label="Decrease copies"
                                                                                >
                                                                                    <Minus className="h-4 w-4" aria-hidden="true" />
                                                                                </Button>

                                                                                <Input
                                                                                    value={String(qty)}
                                                                                    onChange={(e) =>
                                                                                        setBorrowCopies(
                                                                                            clampInt(
                                                                                                Number(e.target.value),
                                                                                                1,
                                                                                                Math.max(1, maxCopies)
                                                                                            )
                                                                                        )
                                                                                    }
                                                                                    inputMode="numeric"
                                                                                    className="w-16 h-9 text-center bg-slate-900/70 border-white/20 text-white"
                                                                                    aria-label="Copies to borrow"
                                                                                    disabled={borrowBusyId === book.id || !isThisDialog}
                                                                                />

                                                                                <Button
                                                                                    type="button"
                                                                                    size="icon"
                                                                                    variant="outline"
                                                                                    className="border-white/20 text-white hover:bg-white/10"
                                                                                    onClick={() =>
                                                                                        setBorrowCopies((v) =>
                                                                                            clampInt(v + 1, 1, Math.max(1, maxCopies))
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        borrowBusyId === book.id ||
                                                                                        !isThisDialog ||
                                                                                        qty >= maxCopies
                                                                                    }
                                                                                    aria-label="Increase copies"
                                                                                >
                                                                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                                                                </Button>

                                                                                <span className="text-xs text-white/60">
                                                                                    Max {maxCopies}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[11px] text-white/60 mt-1">
                                                                                Remaining copies available right now: {maxCopies}.
                                                                            </p>
                                                                        </div>

                                                                        <p className="text-xs text-white/60 mt-2">
                                                                            The due date will be set automatically based on the
                                                                            library policy. Any overdue days may incur fines.
                                                                        </p>
                                                                    </div>

                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel
                                                                            className="border-white/20 text-white hover:bg-black/20"
                                                                            disabled={borrowBusyId === book.id}
                                                                        >
                                                                            Cancel
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-purple-600 hover:bg-purple-700 text-white"
                                                                            disabled={borrowBusyId === book.id || maxCopies <= 0}
                                                                            onClick={() => void handleBorrow(book, qty)}
                                                                        >
                                                                            {borrowBusyId === book.id ? (
                                                                                <span className="inline-flex items-center gap-2">
                                                                                    <Loader2
                                                                                        className="h-4 w-4 animate-spin"
                                                                                        aria-hidden="true"
                                                                                    />
                                                                                    Borrowing…
                                                                                </span>
                                                                            ) : (
                                                                                "Confirm borrow"
                                                                            )}
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        ) : activeRecords.length > 0 ? (
                                                            <span className="inline-flex flex-col items-end text-xs text-amber-200 whitespace-normal wrap-break-word">
                                                                {pendingPickupRecords.length > 0 && (
                                                                    <>
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                                            Pending pickup ×{pendingPickupRecords.length}
                                                                        </span>
                                                                        <span className="text-white/60">
                                                                            Go to the librarian to receive the physical book.
                                                                        </span>
                                                                    </>
                                                                )}

                                                                {borrowedRecords.length > 0 && !hasOverdue && (
                                                                    <>
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                                            Borrowed ×{borrowedRecords.length}
                                                                        </span>
                                                                        <span className="text-white/60">
                                                                            Earliest due on{" "}
                                                                            <span className="font-semibold">{earliestDue}</span>.
                                                                        </span>
                                                                    </>
                                                                )}

                                                                {borrowedRecords.length > 0 && hasOverdue && (
                                                                    <>
                                                                        <span className="inline-flex items-center gap-1 text-red-300">
                                                                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                                                            Overdue
                                                                        </span>
                                                                        <span className="text-white/60">
                                                                            Max overdue by{" "}
                                                                            <span className="font-semibold">
                                                                                {overdueDaysMax} day{overdueDaysMax === 1 ? "" : "s"}
                                                                            </span>
                                                                            .
                                                                        </span>
                                                                    </>
                                                                )}

                                                                {pendingReturnRecords.length > 0 && (
                                                                    <span className="text-white/60">
                                                                        Return requested ×{pendingReturnRecords.length}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                disabled
                                                                className="border-white/20 text-white/60"
                                                            >
                                                                Not available
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>

                                <div className="md:hidden space-y-3 mt-2">
                                    {rows.map((book) => {
                                        const remaining = getRemainingCopies(book)
                                        const borrowableNow = isBorrowable(book)

                                        const activeRecords = book.activeRecords || []
                                        const pendingPickupRecords = activeRecords.filter(
                                            (r) => r.status === "pending" || r.status === "pending_pickup"
                                        )
                                        const borrowedRecords = activeRecords.filter((r) => r.status === "borrowed")
                                        const pendingReturnRecords = activeRecords.filter(
                                            (r) => r.status === "pending_return"
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

                                        const maxCopies = remaining
                                        const isThisDialog = borrowDialogBookId === book.id
                                        const qty = isThisDialog
                                            ? clampInt(borrowCopies, 1, Math.max(1, maxCopies))
                                            : 1

                                        const borrowBtnLabel = activeRecords.length > 0 ? "Borrow more" : "Borrow"

                                        return (
                                            <div
                                                key={book.id}
                                                className="rounded-lg border border-white/10 bg-slate-900/80 p-3 space-y-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-white wrap-break-word">
                                                            {book.title}
                                                        </div>
                                                        {book.subtitle ? (
                                                            <div className="text-[11px] text-white/60 wrap-break-word">
                                                                {book.subtitle}
                                                            </div>
                                                        ) : null}
                                                        <div className="text-[11px] text-white/60 wrap-break-word">
                                                            {book.author}
                                                        </div>
                                                    </div>

                                                    <Badge
                                                        variant={borrowableNow ? "default" : "outline"}
                                                        className={
                                                            borrowableNow
                                                                ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80 shrink-0"
                                                                : "border-red-400/70 text-red-200 hover:bg-red-500/10 shrink-0"
                                                        }
                                                    >
                                                        {borrowableNow ? (
                                                            <span className="inline-flex items-center gap-1">
                                                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                                                Available <span className="opacity-80">({remaining} left)</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1">
                                                                <CircleOff className="h-3 w-3" aria-hidden="true" />
                                                                Unavailable
                                                            </span>
                                                        )}
                                                    </Badge>
                                                </div>

                                                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-white/70">
                                                    <div>
                                                        <div className="uppercase text-white/40">Call no.</div>
                                                        <div className="text-white/85 wrap-break-word">
                                                            {book.callNumber || <span className="opacity-50">—</span>}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="uppercase text-white/40">Acc. no.</div>
                                                        <div className="text-white/85 wrap-break-word">
                                                            {book.accessionNumber || <span className="opacity-50">—</span>}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="uppercase text-white/40">Sub.</div>
                                                        <div className="text-white/85 wrap-break-word">
                                                            {book.subtitle || <span className="opacity-50">—</span>}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="uppercase text-white/40">Pub. year</div>
                                                        <div className="text-white/85">
                                                            {book.publicationYear || <span className="opacity-50">—</span>}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="uppercase text-white/40">ISBN</div>
                                                        <div className="text-white/85 wrap-break-word">
                                                            {book.isbn || <span className="opacity-50">—</span>}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="uppercase text-white/40">Subjects</div>
                                                        <div className="text-white/85 wrap-break-word">
                                                            {getSubjects(book)}
                                                        </div>
                                                    </div>

                                                    <div className="col-span-2">
                                                        <div className="uppercase text-white/40">Due date</div>
                                                        <div className="text-white/85 wrap-break-word">
                                                            {dueCell === "—" ? <span className="opacity-50">—</span> : dueCell}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-[11px] text-white/70">
                                                    {activeRecords.length === 0 && book.myStatus === "never" && (
                                                        <span>Not yet borrowed</span>
                                                    )}

                                                    {activeRecords.length > 0 && (
                                                        <>
                                                            {pendingPickupRecords.length > 0 && (
                                                                <span>
                                                                    <span className="inline-flex items-center gap-1 text-amber-200">
                                                                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                                        Pending pickup ×{pendingPickupRecords.length}
                                                                    </span>
                                                                    <br />
                                                                    Earliest due: <span className="font-medium">{earliestDue}</span>
                                                                </span>
                                                            )}

                                                            {borrowedRecords.length > 0 && !hasOverdue && (
                                                                <span>
                                                                    <span className="inline-flex items-center gap-1 text-amber-200">
                                                                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                                        Borrowed ×{borrowedRecords.length}
                                                                    </span>
                                                                    <br />
                                                                    Earliest due: <span className="font-medium">{earliestDue}</span>
                                                                </span>
                                                            )}

                                                            {borrowedRecords.length > 0 && hasOverdue && (
                                                                <span>
                                                                    <span className="inline-flex items-center gap-1 text-red-300">
                                                                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                                                        Overdue
                                                                    </span>
                                                                    <br />
                                                                    Max overdue by{" "}
                                                                    <span className="font-semibold">
                                                                        {overdueDaysMax} day{overdueDaysMax === 1 ? "" : "s"}
                                                                    </span>
                                                                    .
                                                                </span>
                                                            )}

                                                            {pendingReturnRecords.length > 0 && (
                                                                <>
                                                                    <br />
                                                                    <span className="text-white/60">
                                                                        Return requested ×{pendingReturnRecords.length}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </>
                                                    )}

                                                    {activeRecords.length === 0 &&
                                                        book.myStatus === "returned" &&
                                                        book.lastReturnedRecord && (
                                                            <span>
                                                                <span className="inline-flex items-center gap-1 text-emerald-200">
                                                                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                                                    Returned
                                                                </span>
                                                                <br />
                                                                Last returned:{" "}
                                                                <span className="font-medium">
                                                                    {fmtDate(book.lastReturnedRecord.returnDate)}
                                                                </span>
                                                            </span>
                                                        )}
                                                </div>

                                                <div className="flex justify-end pt-1">
                                                    {borrowableNow ? (
                                                        <AlertDialog
                                                            onOpenChange={(open) => {
                                                                if (open) {
                                                                    setBorrowDialogBookId(book.id)
                                                                    setBorrowCopies(1)
                                                                } else {
                                                                    setBorrowDialogBookId(null)
                                                                    setBorrowCopies(1)
                                                                }
                                                            }}
                                                        >
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                                                                    disabled={borrowBusyId === book.id || maxCopies <= 0}
                                                                >
                                                                    {borrowBtnLabel}
                                                                </Button>
                                                            </AlertDialogTrigger>

                                                            <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Confirm borrow</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-white/70">
                                                                        You are about to borrow{" "}
                                                                        <span className="font-semibold text-white">“{book.title}”</span>{" "}
                                                                        by{" "}
                                                                        <span className="font-semibold text-white">{book.author}</span>.
                                                                        Please confirm the details below.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>

                                                                <div className="mt-3 text-sm text-white/80 space-y-1">
                                                                    <p>
                                                                        <span className="text-white/60">Call no.:</span>{" "}
                                                                        {book.callNumber || "—"}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/60">Accession #:</span>{" "}
                                                                        {book.accessionNumber || "—"}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/60">Subtitle:</span>{" "}
                                                                        {book.subtitle || "—"}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/60">Publication year:</span>{" "}
                                                                        {book.publicationYear || "—"}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/60">ISBN:</span> {book.isbn || "—"}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/60">Edition:</span>{" "}
                                                                        {book.edition || "—"}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/60">Publisher:</span>{" "}
                                                                        {book.publisher || "—"}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/60">Subjects:</span>{" "}
                                                                        {getSubjects(book)}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/60">Default loan duration:</span>{" "}
                                                                        {fmtDurationDays(book.borrowDurationDays)}
                                                                    </p>

                                                                    <div className="pt-3">
                                                                        <div className="text-xs font-medium text-white/80 mb-1">
                                                                            Copies to borrow
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Button
                                                                                type="button"
                                                                                size="icon"
                                                                                variant="outline"
                                                                                className="border-white/20 text-white hover:bg-white/10"
                                                                                onClick={() =>
                                                                                    setBorrowCopies((v) =>
                                                                                        clampInt(v - 1, 1, Math.max(1, maxCopies))
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    borrowBusyId === book.id || !isThisDialog || qty <= 1
                                                                                }
                                                                                aria-label="Decrease copies"
                                                                            >
                                                                                <Minus className="h-4 w-4" aria-hidden="true" />
                                                                            </Button>

                                                                            <Input
                                                                                value={String(qty)}
                                                                                onChange={(e) =>
                                                                                    setBorrowCopies(
                                                                                        clampInt(
                                                                                            Number(e.target.value),
                                                                                            1,
                                                                                            Math.max(1, maxCopies)
                                                                                        )
                                                                                    )
                                                                                }
                                                                                inputMode="numeric"
                                                                                className="w-16 h-9 text-center bg-slate-900/70 border-white/20 text-white"
                                                                                aria-label="Copies to borrow"
                                                                                disabled={borrowBusyId === book.id || !isThisDialog}
                                                                            />

                                                                            <Button
                                                                                type="button"
                                                                                size="icon"
                                                                                variant="outline"
                                                                                className="border-white/20 text-white hover:bg-white/10"
                                                                                onClick={() =>
                                                                                    setBorrowCopies((v) =>
                                                                                        clampInt(v + 1, 1, Math.max(1, maxCopies))
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    borrowBusyId === book.id || !isThisDialog || qty >= maxCopies
                                                                                }
                                                                                aria-label="Increase copies"
                                                                            >
                                                                                <Plus className="h-4 w-4" aria-hidden="true" />
                                                                            </Button>

                                                                            <span className="text-xs text-white/60">Max {maxCopies}</span>
                                                                        </div>
                                                                        <p className="text-[11px] text-white/60 mt-1">
                                                                            Remaining copies available right now: {maxCopies}.
                                                                        </p>
                                                                    </div>

                                                                    <p className="text-xs text-white/60 mt-2">
                                                                        The due date will be set automatically based on the library
                                                                        policy. Any overdue days may incur fines.
                                                                    </p>
                                                                </div>

                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel
                                                                        className="border-white/20 text-white hover:bg-black/20"
                                                                        disabled={borrowBusyId === book.id}
                                                                    >
                                                                        Cancel
                                                                    </AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                                                        disabled={borrowBusyId === book.id || maxCopies <= 0}
                                                                        onClick={() => void handleBorrow(book, qty)}
                                                                    >
                                                                        {borrowBusyId === book.id ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                                                Borrowing…
                                                                            </span>
                                                                        ) : (
                                                                            "Confirm borrow"
                                                                        )}
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    ) : activeRecords.length > 0 ? (
                                                        <span className="inline-flex flex-col items-end text-xs text-amber-200">
                                                            {pendingPickupRecords.length > 0 && (
                                                                <>
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                                        Pending pickup ×{pendingPickupRecords.length}
                                                                    </span>
                                                                    <span className="text-white/60">
                                                                        Go to the librarian to receive the physical book.
                                                                    </span>
                                                                </>
                                                            )}

                                                            {borrowedRecords.length > 0 && !hasOverdue && (
                                                                <>
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                                        Borrowed ×{borrowedRecords.length}
                                                                    </span>
                                                                    <span className="text-white/60">
                                                                        Earliest due on{" "}
                                                                        <span className="font-semibold">{earliestDue}</span>.
                                                                    </span>
                                                                </>
                                                            )}

                                                            {borrowedRecords.length > 0 && hasOverdue && (
                                                                <>
                                                                    <span className="inline-flex items-center gap-1 text-red-300">
                                                                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                                                        Overdue
                                                                    </span>
                                                                    <span className="text-white/60">
                                                                        Max overdue by{" "}
                                                                        <span className="font-semibold">
                                                                            {overdueDaysMax} day{overdueDaysMax === 1 ? "" : "s"}
                                                                        </span>
                                                                        .
                                                                    </span>
                                                                </>
                                                            )}

                                                            {pendingReturnRecords.length > 0 && (
                                                                <span className="text-white/60">
                                                                    Return requested ×{pendingReturnRecords.length}
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled
                                                            className="border-white/20 text-white/60"
                                                        >
                                                            Not available
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}