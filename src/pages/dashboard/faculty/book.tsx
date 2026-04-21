/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import {
    BookOpen,
    Loader2,
    RefreshCcw,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard-layout"
import { FacultyBooksCatalogControls } from "@/components/faculty-books/catalog-controls"
import { FacultyBorrowConfirmDialog } from "@/components/faculty-books/borrow-confirm-dialog"
import {
    FacultyBookActionState,
    FacultyBookStatus,
} from "@/components/faculty-books/book-status"
import type {
    AvailabilityFilter,
    BookWithStatus,
    FacultySortOption,
    FilterMode,
} from "@/components/faculty-books/types"
import {
    buildCatalogSortKey,
    clampInt,
    compareNullableNumber,
    compareText,
    fmtDate,
    fmtDurationDays,
    getActiveBorrowCount,
    getBookBorrowMeta,
    getRemainingCopies,
    getSubjects,
    getTotalBorrowCount,
    isBorrowable,
    isLibraryUseOnlyBook,
    matchesAllTokens,
    normalizeSearchText,
    sortRecordsNewestFirst,
    tokenizeSearch,
} from "@/components/faculty-books/utils"

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { fetchBooks, type BookDTO } from "@/lib/books"
import {
    createSelfBorrow,
    fetchMyBorrowRecords,
    getFacultyBorrowDurationDays,
    getFacultyBorrowMaxBooks,
    isBorrowRecordCurrentlyActive,
    type BorrowRecordDTO,
} from "@/lib/borrows"

function formatDetailValue(value: unknown, fallback = "—") {
    if (typeof value === "number") return String(value)
    if (typeof value === "string") {
        const normalized = value.trim()
        return normalized || fallback
    }
    return fallback
}

function getBorrowRecordCopyLabel(record: Pick<BorrowRecordDTO, "copyNumber" | "accessionNumber">) {
    const parts: string[] = []

    if (typeof record.copyNumber === "number" && Number.isFinite(record.copyNumber)) {
        parts.push(`Copy ${record.copyNumber}`)
    }

    const accessionNumber = String(record.accessionNumber ?? "").trim()
    if (accessionNumber) {
        parts.push(`Accession ${accessionNumber}`)
    }

    return parts.join(" • ")
}

function getStatusMeta(book: BookWithStatus): { label: string; classes: string } {
    if (isLibraryUseOnlyBook(book)) {
        return {
            label: "Library Use Only",
            classes: "border-amber-400/30 bg-amber-500/15 text-amber-100",
        }
    }

    if (isBorrowable(book)) {
        return {
            label: "Available",
            classes: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
        }
    }

    return {
        label: "Unavailable",
        classes: "border-rose-400/30 bg-rose-500/15 text-rose-100",
    }
}

function CatalogDetail({
    label,
    value,
    children,
    className = "",
}: {
    label: string
    value?: React.ReactNode
    children?: React.ReactNode
    className?: string
}) {
    return (
        <div className={`rounded-xl border border-white/10 bg-black/20 p-3 ${className}`.trim()}>
            <div className="text-[11px] uppercase tracking-wide text-white/55">{label}</div>
            <div className="mt-1 text-sm text-white/90 wrap-break-word">
                {children ?? value ?? "—"}
            </div>
        </div>
    )
}

function FacultyBookActionControls({
    book,
    borrowBusyId,
    borrowDialogBookId,
    borrowCopies,
    onBorrowDialogBookChange,
    onBorrowCopiesChange,
    onBorrow,
    facultyMaxActiveBorrows,
    defaultBorrowDurationDays,
    remainingBorrowSlots,
    className = "flex flex-col gap-2 sm:flex-row sm:flex-wrap",
}: {
    book: BookWithStatus
    borrowBusyId: string | null
    borrowDialogBookId: string | null
    borrowCopies: number
    onBorrowDialogBookChange: (bookId: string | null) => void
    onBorrowCopiesChange: (value: number) => void
    onBorrow: (book: BookWithStatus, copiesRequested: number) => void | Promise<void>
    facultyMaxActiveBorrows: number
    defaultBorrowDurationDays: number
    remainingBorrowSlots: number
    className?: string
}) {
    const remaining = getRemainingCopies(book)
    const borrowableNow = isBorrowable(book)
    const libraryUseOnly = isLibraryUseOnlyBook(book)
    const maxCopies = Math.min(remaining, remainingBorrowSlots)
    const canBorrowThisBook = borrowableNow && maxCopies > 0
    const borrowBtnLabel = book.activeRecords.length > 0 ? "Borrow more" : "Borrow"
    const busy = borrowBusyId === book.id

    return (
        <div className={className}>
            {canBorrowThisBook ? (
                <FacultyBorrowConfirmDialog
                    book={book}
                    open={borrowDialogBookId === book.id}
                    onOpenChange={(open) => {
                        onBorrowDialogBookChange(open ? book.id : null)
                        if (open) {
                            onBorrowCopiesChange(
                                clampInt(borrowCopies, 1, Math.max(1, maxCopies))
                            )
                        }
                    }}
                    quantity={borrowDialogBookId === book.id ? borrowCopies : 1}
                    onQuantityChange={onBorrowCopiesChange}
                    busy={busy}
                    onConfirm={(quantity) => onBorrow(book, quantity)}
                    maxCopies={maxCopies}
                    remainingBorrowSlots={remainingBorrowSlots}
                    facultyMaxActiveBorrows={facultyMaxActiveBorrows}
                    defaultBorrowDurationDays={defaultBorrowDurationDays}
                    triggerLabel={borrowBtnLabel}
                />
            ) : libraryUseOnly ? (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    className="border-amber-400/30 text-amber-100 hover:bg-transparent"
                >
                    In-library only
                </Button>
            ) : remainingBorrowSlots <= 0 ? (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    className="border-white/20 text-white/60 hover:bg-transparent"
                >
                    Limit reached
                </Button>
            ) : (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    className="border-white/20 text-white/60 hover:bg-transparent"
                >
                    Not available
                </Button>
            )}
        </div>
    )
}

function FacultyBookDetailGrid({
    book,
    dueCell,
    activeBorrowingNow,
    totalBorrowedTimes,
    remaining,
    borrowBusyId,
    borrowDialogBookId,
    borrowCopies,
    onBorrowDialogBookChange,
    onBorrowCopiesChange,
    onBorrow,
    facultyMaxActiveBorrows,
    defaultBorrowDurationDays,
    remainingBorrowSlots,
    showActions = true,
    className = "grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
}: {
    book: BookWithStatus
    dueCell: React.ReactNode
    activeBorrowingNow: number
    totalBorrowedTimes: number
    remaining: number
    borrowBusyId: string | null
    borrowDialogBookId: string | null
    borrowCopies: number
    onBorrowDialogBookChange: (bookId: string | null) => void
    onBorrowCopiesChange: (value: number) => void
    onBorrow: (book: BookWithStatus, copiesRequested: number) => void | Promise<void>
    facultyMaxActiveBorrows: number
    defaultBorrowDurationDays: number
    remainingBorrowSlots: number
    showActions?: boolean
    className?: string
}) {
    return (
        <div className={className}>
            <CatalogDetail label="Call no." value={formatDetailValue(book.callNumber)} />
            <CatalogDetail label="Accession #" value={formatDetailValue(book.accessionNumber)} />
            <CatalogDetail label="Title" value={formatDetailValue(book.title)} />
            <CatalogDetail label="Subtitle" value={formatDetailValue(book.subtitle)} />
            <CatalogDetail label="Author" value={formatDetailValue(book.author)} />
            <CatalogDetail label="Publication year" value={formatDetailValue(book.publicationYear)} />
            <CatalogDetail label="ISBN" value={formatDetailValue(book.isbn)} />
            <CatalogDetail label="ISSN" value={formatDetailValue(book.issn)} />
            <CatalogDetail label="Publisher" value={formatDetailValue(book.publisher)} />
            <CatalogDetail label="Subjects" value={getSubjects(book)} />
            <CatalogDetail label="Loan duration" value={fmtDurationDays(book.borrowDurationDays)} />
            <CatalogDetail label="Due / earliest due" value={dueCell} />
            <CatalogDetail label="Inventory">
                <span>
                    Available: {remaining} · Active borrows: {activeBorrowingNow} · All-time: {totalBorrowedTimes}
                </span>
            </CatalogDetail>
            <CatalogDetail label="Last returned">
                {book.lastReturnedRecord ? fmtDate(book.lastReturnedRecord.returnDate) : "—"}
            </CatalogDetail>
            <CatalogDetail label="My activity">
                <div className="space-y-1 text-xs leading-relaxed text-white/75">
                    <FacultyBookStatus book={book} />
                    <div className="flex flex-col gap-1 text-white/60">
                        <FacultyBookActionState book={book} />
                    </div>
                </div>
            </CatalogDetail>
            {showActions ? (
                <CatalogDetail label="Actions">
                    <FacultyBookActionControls
                        book={book}
                        borrowBusyId={borrowBusyId}
                        borrowDialogBookId={borrowDialogBookId}
                        borrowCopies={borrowCopies}
                        onBorrowDialogBookChange={onBorrowDialogBookChange}
                        onBorrowCopiesChange={onBorrowCopiesChange}
                        onBorrow={onBorrow}
                        facultyMaxActiveBorrows={facultyMaxActiveBorrows}
                        defaultBorrowDurationDays={defaultBorrowDurationDays}
                        remainingBorrowSlots={remainingBorrowSlots}
                    />
                </CatalogDetail>
            ) : null}
        </div>
    )
}

function FacultyBookMobileCard({
    book,
    borrowBusyId,
    borrowDialogBookId,
    borrowCopies,
    onBorrowDialogBookChange,
    onBorrowCopiesChange,
    onBorrow,
    facultyMaxActiveBorrows,
    defaultBorrowDurationDays,
    remainingBorrowSlots,
}: {
    book: BookWithStatus
    borrowBusyId: string | null
    borrowDialogBookId: string | null
    borrowCopies: number
    onBorrowDialogBookChange: (bookId: string | null) => void
    onBorrowCopiesChange: (value: number) => void
    onBorrow: (book: BookWithStatus, copiesRequested: number) => void | Promise<void>
    facultyMaxActiveBorrows: number
    defaultBorrowDurationDays: number
    remainingBorrowSlots: number
}) {
    const status = getStatusMeta(book)
    const remaining = getRemainingCopies(book)
    const activeBorrowingNow = getActiveBorrowCount(book)
    const totalBorrowedTimes = getTotalBorrowCount(book)
    const { dueCell } = getBookBorrowMeta(book)

    return (
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 p-4 shadow-sm sm:hidden">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                            {formatDetailValue(book.callNumber)}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.classes}`}>
                            {status.label}
                        </span>
                    </div>
                    <h3 className="wrap-break-word whitespace-normal text-sm font-semibold leading-snug text-white">
                        {formatDetailValue(book.title)}
                    </h3>
                    <p className="wrap-break-word text-xs text-white/60">
                        {formatDetailValue(book.author)}
                    </p>
                </div>
            </div>

            <div className="mt-3 grid gap-2">
                <CatalogDetail label="Available copies" value={`${remaining}`} />
                <CatalogDetail label="My status">
                    <div className="space-y-1 text-xs leading-relaxed text-white/85">
                        <FacultyBookStatus book={book} />
                        <div className="text-white/60">
                            <FacultyBookActionState book={book} />
                        </div>
                    </div>
                </CatalogDetail>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                        >
                            View full details
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-950 text-white sm:max-w-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="pr-6 text-left">
                                {formatDetailValue(book.title)}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-left text-white/65">
                                {formatDetailValue(book.author)} · Call no. {formatDetailValue(book.callNumber)}
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="max-h-screen overflow-y-auto pr-1">
                            <FacultyBookDetailGrid
                                book={book}
                                dueCell={dueCell}
                                activeBorrowingNow={activeBorrowingNow}
                                totalBorrowedTimes={totalBorrowedTimes}
                                remaining={remaining}
                                borrowBusyId={borrowBusyId}
                                borrowDialogBookId={borrowDialogBookId}
                                borrowCopies={borrowCopies}
                                onBorrowDialogBookChange={onBorrowDialogBookChange}
                                onBorrowCopiesChange={onBorrowCopiesChange}
                                onBorrow={onBorrow}
                                facultyMaxActiveBorrows={facultyMaxActiveBorrows}
                                defaultBorrowDurationDays={defaultBorrowDurationDays}
                                remainingBorrowSlots={remainingBorrowSlots}
                                showActions={false}
                                className="grid gap-3"
                            />
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                                Close
                            </AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <FacultyBookActionControls
                    book={book}
                    borrowBusyId={borrowBusyId}
                    borrowDialogBookId={borrowDialogBookId}
                    borrowCopies={borrowCopies}
                    onBorrowDialogBookChange={onBorrowDialogBookChange}
                    onBorrowCopiesChange={onBorrowCopiesChange}
                    onBorrow={onBorrow}
                    facultyMaxActiveBorrows={facultyMaxActiveBorrows}
                    defaultBorrowDurationDays={defaultBorrowDurationDays}
                    remainingBorrowSlots={remainingBorrowSlots}
                    className="flex flex-col gap-2"
                />
            </div>
        </div>
    )
}

function FacultyBookDesktopCard({
    book,
    borrowBusyId,
    borrowDialogBookId,
    borrowCopies,
    onBorrowDialogBookChange,
    onBorrowCopiesChange,
    onBorrow,
    facultyMaxActiveBorrows,
    defaultBorrowDurationDays,
    remainingBorrowSlots,
}: {
    book: BookWithStatus
    borrowBusyId: string | null
    borrowDialogBookId: string | null
    borrowCopies: number
    onBorrowDialogBookChange: (bookId: string | null) => void
    onBorrowCopiesChange: (value: number) => void
    onBorrow: (book: BookWithStatus, copiesRequested: number) => void | Promise<void>
    facultyMaxActiveBorrows: number
    defaultBorrowDurationDays: number
    remainingBorrowSlots: number
}) {
    const status = getStatusMeta(book)
    const remaining = getRemainingCopies(book)
    const activeBorrowingNow = getActiveBorrowCount(book)
    const totalBorrowedTimes = getTotalBorrowCount(book)
    const { dueCell } = getBookBorrowMeta(book)

    return (
        <Dialog>
            <div className="hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 p-4 shadow-sm transition-colors hover:border-white/20 sm:block">
                <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                                {formatDetailValue(book.callNumber)}
                            </span>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.classes}`}>
                                {status.label}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <h3 className="wrap-break-word text-sm font-semibold text-white/90">
                                {formatDetailValue(book.title)}
                            </h3>
                            <p className="wrap-break-word text-xs text-white/60">
                                {formatDetailValue(book.author)}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
                            <span>Available: {remaining}</span>
                            <span>Active borrows: {activeBorrowingNow}</span>
                            <span>All-time: {totalBorrowedTimes}</span>
                        </div>

                        <div className="space-y-1 text-xs leading-relaxed text-white/75">
                            <FacultyBookStatus book={book} />
                            <div className="text-white/60">
                                <FacultyBookActionState book={book} />
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-start">
                        <DialogTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                className="border-white/20 text-white/90 hover:bg-white/10"
                            >
                                Details
                            </Button>
                        </DialogTrigger>
                    </div>
                </div>
            </div>

            <DialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-950 text-white sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="pr-6 text-left">
                        {formatDetailValue(book.title)}
                    </DialogTitle>
                    <DialogDescription className="text-left text-white/65">
                        {formatDetailValue(book.author)} · Call no. {formatDetailValue(book.callNumber)}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[calc(95svh-8rem)] overflow-y-auto pr-1">
                    <FacultyBookDetailGrid
                        book={book}
                        dueCell={dueCell}
                        activeBorrowingNow={activeBorrowingNow}
                        totalBorrowedTimes={totalBorrowedTimes}
                        remaining={remaining}
                        borrowBusyId={borrowBusyId}
                        borrowDialogBookId={borrowDialogBookId}
                        borrowCopies={borrowCopies}
                        onBorrowDialogBookChange={onBorrowDialogBookChange}
                        onBorrowCopiesChange={onBorrowCopiesChange}
                        onBorrow={onBorrow}
                        facultyMaxActiveBorrows={facultyMaxActiveBorrows}
                        defaultBorrowDurationDays={defaultBorrowDurationDays}
                        remainingBorrowSlots={remainingBorrowSlots}
                        showActions
                        className="grid gap-3"
                    />
                </div>
            </DialogContent>
        </Dialog>
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
    const [sortOption, setSortOption] =
        React.useState<FacultySortOption>("catalog")

    const [borrowBusyId, setBorrowBusyId] = React.useState<string | null>(null)
    const [borrowDialogBookId, setBorrowDialogBookId] = React.useState<string | null>(
        null
    )
    const [borrowCopies, setBorrowCopies] = React.useState<number>(1)

    const facultyBorrowMaxBooks = getFacultyBorrowMaxBooks()
    const facultyBorrowDurationDays = getFacultyBorrowDurationDays()

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

    const activeBorrowCount = React.useMemo(() => {
        return myRecords.filter((record) => isBorrowRecordCurrentlyActive(record)).length
    }, [myRecords])

    const remainingBorrowSlots = Math.max(0, facultyBorrowMaxBooks - activeBorrowCount)

    const myRecordsByBookId = React.useMemo(() => {
        const map = new Map<string, BorrowRecordDTO[]>()

        for (const record of myRecords) {
            const key = String(record.bookId)
            const list = map.get(key)
            if (list) {
                list.push(record)
            } else {
                map.set(key, [record])
            }
        }

        return map
    }, [myRecords])

    const rows: BookWithStatus[] = React.useMemo(() => {
        const tokens = tokenizeSearch(search)

        const withStatus: BookWithStatus[] = books.map((book) => {
            const recordsForBook = myRecordsByBookId.get(String(book.id)) ?? []
            const sorted = sortRecordsNewestFirst(recordsForBook)

            const activeRecords = sorted.filter((record) =>
                isBorrowRecordCurrentlyActive(record)
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
            const libraryUseOnly = isLibraryUseOnlyBook(book)

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
                String(typeof book.activeBorrowCount === "number" ? book.activeBorrowCount : 0),
                String(typeof book.totalBorrowCount === "number" ? book.totalBorrowCount : 0),
                borrowable ? "available borrowable" : "unavailable not borrowable",
                libraryUseOnly ? "library use only in library read only reference" : "",
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
    }, [availabilityFilter, books, filterMode, myRecordsByBookId, search, sortOption])

    const regularRows = React.useMemo(
        () => rows.filter((book) => !isLibraryUseOnlyBook(book)),
        [rows]
    )

    const libraryUseOnlyRows = React.useMemo(
        () => rows.filter((book) => isLibraryUseOnlyBook(book)),
        [rows]
    )

    async function handleBorrow(book: BookWithStatus, copiesRequested = 1) {
        const remaining = getRemainingCopies(book)

        if (!isBorrowable(book) || remaining <= 0) {
            toast.info("Book is not available right now.", {
                description: book.isLibraryUseOnly || book.canBorrow === false
                    ? "This title is marked as library use only and cannot be borrowed for take-home use."
                    : "There are no remaining copies to borrow.",
            })
            return
        }

        if (remainingBorrowSlots <= 0) {
            toast.info("Faculty borrow limit reached", {
                description: `You already have ${activeBorrowCount} active book${activeBorrowCount === 1 ? "" : "s"}. Faculty can only have up to ${facultyBorrowMaxBooks} active books at a time.`,
            })
            return
        }

        const maxAllowedNow = Math.min(remaining, remainingBorrowSlots)
        const requestedCopies = clampInt(copiesRequested, 1, maxAllowedNow)

        if (copiesRequested > maxAllowedNow) {
            toast.info("Borrow quantity adjusted", {
                description: `You can only borrow up to ${maxAllowedNow} more book${maxAllowedNow === 1 ? "" : "s"} right now because faculty is limited to ${facultyBorrowMaxBooks} active books.`,
            })
        }

        setBorrowBusyId(book.id)

        try {
            const created: BorrowRecordDTO[] = []

            for (let i = 0; i < requestedCopies; i++) {
                try {
                    const record = await createSelfBorrow(book.id, 1, "faculty")
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

            const due =
                created[0]?.dueDate
                    ? new Date(created[0].dueDate).toLocaleDateString("en-CA")
                    : "—"
            const assignedCopies = created
                .map((record) => getBorrowRecordCopyLabel(record))
                .filter(Boolean)
                .join(", ")
            const assignedCopiesSuffix = assignedCopies
                ? ` Assigned copy order: ${assignedCopies}.`
                : ""

            toast.success("Borrow request submitted", {
                description: `${created.length} cop${created.length === 1 ? "y" : "ies"} of "${book.title}" ${created.length === 1 ? "is" : "are"} now reserved for pickup for 24 hours. Earliest due date: ${due}.${assignedCopiesSuffix} Faculty may keep up to ${facultyBorrowMaxBooks} active books for ${facultyBorrowDurationDays} days by default.`,
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
                            <h2 className="text-lg font-semibold leading-tight">Library catalog</h2>
                            <p className="text-xs text-white/70">
                                Faculty may borrow up to {facultyBorrowMaxBooks} active books, with
                                a default duration of {facultyBorrowDurationDays} days per borrow.
                                Titles tagged as <span className="font-semibold text-amber-200">Library use only</span>{" "}
                                are shown separately and cannot be taken home.
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
                        <FacultyBooksCatalogControls
                            rowsCount={rows.length}
                            booksCount={books.length}
                            regularRowsCount={regularRows.length}
                            libraryUseOnlyRowsCount={libraryUseOnlyRows.length}
                            search={search}
                            onSearchChange={setSearch}
                            filterMode={filterMode}
                            onFilterModeChange={setFilterMode}
                            availabilityFilter={availabilityFilter}
                            onAvailabilityFilterChange={setAvailabilityFilter}
                            sortOption={sortOption}
                            onSortOptionChange={setSortOption}
                            onClear={clearCatalogControls}
                            hasCatalogControlsApplied={hasCatalogControlsApplied}
                            maxActiveBorrows={facultyBorrowMaxBooks}
                            defaultBorrowDurationDays={facultyBorrowDurationDays}
                            activeBorrowCount={activeBorrowCount}
                            remainingBorrowSlots={remainingBorrowSlots}
                        />
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-28 w-full rounded-2xl" />
                                <Skeleton className="h-28 w-full rounded-2xl" />
                                <Skeleton className="h-28 w-full rounded-2xl" />
                            </div>
                        ) : error ? (
                            <div className="py-6 text-center text-sm text-red-300">{error}</div>
                        ) : rows.length === 0 ? (
                            <div className="py-10 text-center text-sm text-white/70">
                                No books matched your filters.
                                <br />
                                <span className="text-xs opacity-80">
                                    Try clearing the search or changing the filter.
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {regularRows.length > 0 && (
                                    <section className="space-y-2">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold text-white">
                                                Borrowable and regular catalog
                                            </h3>
                                            <p className="text-xs text-white/60">
                                                {regularRows.length} matching
                                                {" "}
                                                {regularRows.length === 1 ? "title" : "titles"} that
                                                faculty may borrow, subject to remaining copy counts
                                                and your active borrow limit.
                                            </p>
                                        </div>

                                        <div className="space-y-3 sm:hidden">
                                            {regularRows.map((book) => (
                                                <FacultyBookMobileCard
                                                    key={book.id}
                                                    book={book}
                                                    borrowBusyId={borrowBusyId}
                                                    borrowDialogBookId={borrowDialogBookId}
                                                    borrowCopies={borrowCopies}
                                                    onBorrowDialogBookChange={setBorrowDialogBookId}
                                                    onBorrowCopiesChange={setBorrowCopies}
                                                    onBorrow={handleBorrow}
                                                    facultyMaxActiveBorrows={facultyBorrowMaxBooks}
                                                    defaultBorrowDurationDays={facultyBorrowDurationDays}
                                                    remainingBorrowSlots={remainingBorrowSlots}
                                                />
                                            ))}
                                        </div>

                                        <div className="hidden space-y-3 sm:block">
                                            {regularRows.map((book) => (
                                                <FacultyBookDesktopCard
                                                    key={book.id}
                                                    book={book}
                                                    borrowBusyId={borrowBusyId}
                                                    borrowDialogBookId={borrowDialogBookId}
                                                    borrowCopies={borrowCopies}
                                                    onBorrowDialogBookChange={setBorrowDialogBookId}
                                                    onBorrowCopiesChange={setBorrowCopies}
                                                    onBorrow={handleBorrow}
                                                    facultyMaxActiveBorrows={facultyBorrowMaxBooks}
                                                    defaultBorrowDurationDays={facultyBorrowDurationDays}
                                                    remainingBorrowSlots={remainingBorrowSlots}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {libraryUseOnlyRows.length > 0 && (
                                    <section
                                        className={`space-y-2 ${
                                            regularRows.length > 0
                                                ? "border-t border-white/10 pt-4"
                                                : ""
                                        }`}
                                    >
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold text-amber-200">
                                                Library use only
                                            </h3>
                                            <p className="text-xs text-white/60">
                                                {libraryUseOnlyRows.length} matching
                                                {" "}
                                                {libraryUseOnlyRows.length === 1 ? "title is" : "titles are"}
                                                {" "}included in the catalog for reference, but these
                                                cannot be borrowed for take-home use.
                                            </p>
                                        </div>

                                        <div className="space-y-3 sm:hidden">
                                            {libraryUseOnlyRows.map((book) => (
                                                <FacultyBookMobileCard
                                                    key={book.id}
                                                    book={book}
                                                    borrowBusyId={borrowBusyId}
                                                    borrowDialogBookId={borrowDialogBookId}
                                                    borrowCopies={borrowCopies}
                                                    onBorrowDialogBookChange={setBorrowDialogBookId}
                                                    onBorrowCopiesChange={setBorrowCopies}
                                                    onBorrow={handleBorrow}
                                                    facultyMaxActiveBorrows={facultyBorrowMaxBooks}
                                                    defaultBorrowDurationDays={facultyBorrowDurationDays}
                                                    remainingBorrowSlots={remainingBorrowSlots}
                                                />
                                            ))}
                                        </div>

                                        <div className="hidden space-y-3 sm:block">
                                            {libraryUseOnlyRows.map((book) => (
                                                <FacultyBookDesktopCard
                                                    key={book.id}
                                                    book={book}
                                                    borrowBusyId={borrowBusyId}
                                                    borrowDialogBookId={borrowDialogBookId}
                                                    borrowCopies={borrowCopies}
                                                    onBorrowDialogBookChange={setBorrowDialogBookId}
                                                    onBorrowCopiesChange={setBorrowCopies}
                                                    onBorrow={handleBorrow}
                                                    facultyMaxActiveBorrows={facultyBorrowMaxBooks}
                                                    defaultBorrowDurationDays={facultyBorrowDurationDays}
                                                    remainingBorrowSlots={remainingBorrowSlots}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}