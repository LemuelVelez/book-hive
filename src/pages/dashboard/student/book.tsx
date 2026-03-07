/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BookOpen,
    RefreshCcw,
    Loader2,
    Search,
    ArrowUpDown,
    Filter,
    X,
} from "lucide-react";
import { toast } from "sonner";

import { fetchBooks, type BookDTO } from "@/lib/books";
import {
    fetchMyBorrowRecords,
    createSelfBorrowRecords,
    type BorrowRecordDTO,
} from "@/lib/borrows";

import type { BookWithStatus } from "@/components/student-books/types";
import {
    buildCatalogSortKey,
    compareNullableNumber,
    compareText,
    fmtDate,
    fmtLibraryArea,
    getRemainingCopies,
    getSubjects,
    isBorrowable,
    matchesAllTokens,
    normalizeSearchText,
    sortRecordsNewestFirst,
    tokenizeSearch,
} from "@/components/student-books/utils";
import StudentBooksTable from "@/components/student-books/StudentBooksTable";
import StudentBooksCardList from "@/components/student-books/StudentBooksCardList";

type FilterMode =
    | "all"
    | "available"
    | "unavailable"
    | "borrowedByMe"
    | "history";

type CatalogAvailabilityFilter = "all" | "available" | "unavailable";
type CatalogSortOption =
    | "catalog"
    | "call_no_asc"
    | "call_no_desc"
    | "accession_asc"
    | "accession_desc"
    | "title_asc"
    | "title_desc"
    | "pub_year_desc"
    | "pub_year_asc";

export default function StudentBooksPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [myRecords, setMyRecords] = React.useState<BorrowRecordDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [filterMode, setFilterMode] = React.useState<FilterMode>("all");
    const [availabilityFilter, setAvailabilityFilter] =
        React.useState<CatalogAvailabilityFilter>("all");
    const [libraryAreaFilter, setLibraryAreaFilter] = React.useState("all");
    const [sortOption, setSortOption] = React.useState<CatalogSortOption>("catalog");
    const [borrowBusyId, setBorrowBusyId] = React.useState<string | null>(null);

    const loadAll = React.useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            const [booksData, myRecordsData] = await Promise.all([
                fetchBooks(),
                fetchMyBorrowRecords(),
            ]);

            setBooks(booksData);
            setMyRecords(myRecordsData);
        } catch (err: any) {
            const msg =
                err?.message || "Failed to load books. Please try again later.";
            setError(msg);
            toast.error("Failed to load books", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadAll();
    }, [loadAll]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await loadAll();
        } finally {
            setRefreshing(false);
        }
    }

    const rows: BookWithStatus[] = React.useMemo(() => {
        const byBook: BookWithStatus[] = books.map((book) => {
            const recordsForBook = myRecords.filter((r) => r.bookId === book.id);
            const sorted = sortRecordsNewestFirst(recordsForBook);

            const activeRecords = sorted.filter(
                (r) =>
                    r.status === "borrowed" ||
                    r.status === "pending" ||
                    r.status === "pending_pickup" ||
                    r.status === "pending_return"
            );

            const returnedRecords = sorted.filter((r) => r.status === "returned");
            const lastReturnedRecord = returnedRecords[0] ?? null;
            const lastRecord = sorted[0] ?? null;

            const myStatus: "never" | "active" | "returned" =
                activeRecords.length > 0
                    ? "active"
                    : sorted.length > 0
                        ? "returned"
                        : "never";

            return {
                ...book,
                myStatus,
                activeRecords,
                lastReturnedRecord,
                lastRecord,
            };
        });

        let filtered = byBook;

        switch (filterMode) {
            case "available":
                filtered = filtered.filter((b) => isBorrowable(b));
                break;
            case "unavailable":
                filtered = filtered.filter((b) => !isBorrowable(b));
                break;
            case "borrowedByMe":
                filtered = filtered.filter((b) => b.activeRecords.length > 0);
                break;
            case "history":
                filtered = filtered.filter((b) => Boolean(b.lastRecord));
                break;
            case "all":
            default:
                break;
        }

        if (libraryAreaFilter !== "all") {
            filtered = filtered.filter(
                (b) => String(b.libraryArea ?? "").trim() === libraryAreaFilter
            );
        }

        if (availabilityFilter === "available") {
            filtered = filtered.filter((b) => isBorrowable(b));
        } else if (availabilityFilter === "unavailable") {
            filtered = filtered.filter((b) => !isBorrowable(b));
        }

        const tokens = tokenizeSearch(search);
        if (tokens.length > 0) {
            filtered = filtered.filter((b) => {
                const hay = [
                    b.callNumber,
                    b.accessionNumber,
                    b.title,
                    b.subtitle,
                    getSubjects(b),
                    typeof b.publicationYear === "number" ? String(b.publicationYear) : "",
                    b.author,
                    b.isbn,
                    b.issn,
                    b.publisher,
                    b.placeOfPublication,
                    b.edition,
                    b.barcode,
                    b.series,
                    b.volumeNumber,
                    b.libraryArea ? fmtLibraryArea(b.libraryArea) : "",
                    String(getRemainingCopies(b)),
                    String(typeof b.totalCopies === "number" ? b.totalCopies : ""),
                    String(typeof b.borrowedCopies === "number" ? b.borrowedCopies : ""),
                    b.activeRecords.length > 0 ? "borrowed" : "",
                    b.myStatus,
                ]
                    .map(normalizeSearchText)
                    .filter(Boolean)
                    .join(" ");

                return matchesAllTokens(hay, tokens);
            });
        }

        return [...filtered].sort((a, b) => {
            switch (sortOption) {
                case "call_no_asc":
                    return (
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "call_no_desc":
                    return (
                        compareText(b.callNumber, a.callNumber) ||
                        compareText(b.accessionNumber, a.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "accession_asc":
                    return (
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "accession_desc":
                    return (
                        compareText(b.accessionNumber, a.accessionNumber) ||
                        compareText(b.callNumber, a.callNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "title_asc":
                    return (
                        compareText(a.title, b.title) ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "title_desc":
                    return (
                        compareText(b.title, a.title) ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "pub_year_desc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "desc") ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "pub_year_asc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "asc") ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "catalog":
                default:
                    return buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                        sensitivity: "base",
                    });
            }
        });
    }, [books, myRecords, filterMode, search, availabilityFilter, libraryAreaFilter, sortOption]);

    const libraryAreaChoices = React.useMemo(() => {
        const values = new Set<string>();

        books.forEach((book) => {
            const area = book.libraryArea ? String(book.libraryArea).trim() : "";
            if (area) values.add(area);
        });

        return Array.from(values).sort((a, b) =>
            fmtLibraryArea(a as BookDTO["libraryArea"]).localeCompare(
                fmtLibraryArea(b as BookDTO["libraryArea"]),
                undefined,
                { sensitivity: "base" }
            )
        );
    }, [books]);

    React.useEffect(() => {
        if (libraryAreaFilter !== "all" && !libraryAreaChoices.includes(libraryAreaFilter)) {
            setLibraryAreaFilter("all");
        }
    }, [libraryAreaChoices, libraryAreaFilter]);

    const clearCatalogControls = React.useCallback(() => {
        setSearch("");
        setFilterMode("all");
        setAvailabilityFilter("all");
        setLibraryAreaFilter("all");
        setSortOption("catalog");
    }, []);

    const hasCatalogControlsApplied =
        search.trim().length > 0 ||
        filterMode !== "all" ||
        availabilityFilter !== "all" ||
        libraryAreaFilter !== "all" ||
        sortOption !== "catalog";

    async function handleBorrow(
        book: BookWithStatus,
        copiesRequested = 1
    ): Promise<boolean> {
        const remaining = getRemainingCopies(book);

        if (!isBorrowable(book) || remaining <= 0) {
            toast.info("Book is not available right now.", {
                description: "There are no remaining copies to borrow.",
            });
            return false;
        }

        const requestedCopies = Math.min(
            Math.max(Math.floor(Number(copiesRequested) || 1), 1),
            remaining
        );

        setBorrowBusyId(book.id);

        try {
            const created = await createSelfBorrowRecords(book.id, requestedCopies);

            if (created.length === 0) {
                toast.error("Borrow failed", {
                    description:
                        "The borrow request did not return any created record. Please try again.",
                });
                return false;
            }

            const due = fmtDate(created[0]?.dueDate);

            if (created.length < requestedCopies) {
                toast.warning("Partial borrow completed", {
                    description: `Borrowed ${created.length} of ${requestedCopies} copies of "${book.title}". Earliest due date: ${due}.`,
                });
            } else {
                toast.success("Borrow request submitted", {
                    description: `${created.length} cop${created.length === 1 ? "y" : "ies"} of "${book.title}" ${created.length === 1 ? "is" : "are"
                        } now pending pickup. Earliest due date: ${due}.`,
                });
            }

            setMyRecords((prev) => [...created.slice().reverse(), ...prev]);

            try {
                const [booksLatest, myLatest] = await Promise.all([
                    fetchBooks(),
                    fetchMyBorrowRecords(),
                ]);
                setBooks(booksLatest);
                setMyRecords(myLatest);
            } catch {
                // ignore refresh failure
            }

            return true;
        } catch (err: any) {
            const msg =
                err?.message ||
                "Could not borrow this book right now. Please try again later.";
            toast.error("Borrow failed", { description: msg });
            return false;
        } finally {
            setBorrowBusyId(null);
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
                                <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                            )}
                            <span className="sr-only">Refresh</span>
                        </Button>
                    </div>
                </div>

                <Card className="border-white/10 bg-slate-800/60">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <CardTitle>Books you can borrow</CardTitle>
                                <p className="text-xs text-white/70">
                                    Showing {rows.length} of {books.length}{" "}
                                    {books.length === 1 ? "book" : "books"}.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                <div className="relative min-w-0 md:col-span-2 xl:col-span-3">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                    <Input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search call no., accession no., title, subject, publication year, author…"
                                        autoComplete="off"
                                        aria-label="Search books"
                                        className="border-white/20 bg-slate-900/70 pl-9 text-white"
                                    />
                                </div>

                                <Select
                                    value={libraryAreaFilter}
                                    onValueChange={(value) => setLibraryAreaFilter(value)}
                                >
                                    <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="Library area" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="all">All library areas</SelectItem>
                                        {libraryAreaChoices.map((area) => (
                                            <SelectItem key={area} value={area}>
                                                {fmtLibraryArea(area as BookDTO["libraryArea"])}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={availabilityFilter}
                                    onValueChange={(value) =>
                                        setAvailabilityFilter(value as CatalogAvailabilityFilter)
                                    }
                                >
                                    <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="Availability" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="all">All availability</SelectItem>
                                        <SelectItem value="available">Available only</SelectItem>
                                        <SelectItem value="unavailable">Unavailable only</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filterMode}
                                    onValueChange={(value) => setFilterMode(value as FilterMode)}
                                >
                                    <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="My books" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="all">All books</SelectItem>
                                        <SelectItem value="borrowedByMe">Borrowed by me (active)</SelectItem>
                                        <SelectItem value="history">My history</SelectItem>
                                        <SelectItem value="available">Available only (my view)</SelectItem>
                                        <SelectItem value="unavailable">Unavailable only (my view)</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={sortOption}
                                    onValueChange={(value) => setSortOption(value as CatalogSortOption)}
                                >
                                    <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                                        <div className="flex items-center gap-2 truncate">
                                            <ArrowUpDown className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="Sort books" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="catalog">Catalog order</SelectItem>
                                        <SelectItem value="call_no_asc">Call no. (A–Z)</SelectItem>
                                        <SelectItem value="call_no_desc">Call no. (Z–A)</SelectItem>
                                        <SelectItem value="accession_asc">Accession no. (A–Z)</SelectItem>
                                        <SelectItem value="accession_desc">Accession no. (Z–A)</SelectItem>
                                        <SelectItem value="title_asc">Title (A–Z)</SelectItem>
                                        <SelectItem value="title_desc">Title (Z–A)</SelectItem>
                                        <SelectItem value="pub_year_desc">
                                            Publication year (Newest first)
                                        </SelectItem>
                                        <SelectItem value="pub_year_asc">
                                            Publication year (Oldest first)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="flex flex-col gap-2 xl:col-span-3 sm:flex-row sm:flex-wrap">
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
                                <StudentBooksTable
                                    rows={rows}
                                    borrowBusyId={borrowBusyId}
                                    onBorrow={handleBorrow}
                                />

                                <StudentBooksCardList
                                    rows={rows}
                                    borrowBusyId={borrowBusyId}
                                    onBorrow={handleBorrow}
                                />
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}