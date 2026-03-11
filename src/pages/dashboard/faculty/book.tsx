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
import { FacultyBooksMobileList } from "@/components/faculty-books/books-mobile-list"
import { FacultyBooksTable } from "@/components/faculty-books/books-table"
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
    getRemainingCopies,
    isBorrowable,
    matchesAllTokens,
    normalizeSearchText,
    sortRecordsNewestFirst,
    tokenizeSearch,
} from "@/components/faculty-books/utils"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { fetchBooks, type BookDTO } from "@/lib/books"
import {
    createSelfBorrow,
    fetchMyBorrowRecords,
    type BorrowRecordDTO,
} from "@/lib/borrows"

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
    }, [availabilityFilter, books, filterMode, myRecordsByBookId, search, sortOption])

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
                            <h2 className="text-lg font-semibold leading-tight">Library catalog</h2>
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
                        <FacultyBooksCatalogControls
                            rowsCount={rows.length}
                            booksCount={books.length}
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
                        />
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
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
                            <>
                                <FacultyBooksTable
                                    rows={rows}
                                    borrowBusyId={borrowBusyId}
                                    borrowDialogBookId={borrowDialogBookId}
                                    borrowCopies={borrowCopies}
                                    onBorrowDialogBookChange={setBorrowDialogBookId}
                                    onBorrowCopiesChange={setBorrowCopies}
                                    onBorrow={handleBorrow}
                                />

                                <FacultyBooksMobileList
                                    rows={rows}
                                    borrowBusyId={borrowBusyId}
                                    borrowDialogBookId={borrowDialogBookId}
                                    borrowCopies={borrowCopies}
                                    onBorrowDialogBookChange={setBorrowDialogBookId}
                                    onBorrowCopiesChange={setBorrowCopies}
                                    onBorrow={handleBorrow}
                                />
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}