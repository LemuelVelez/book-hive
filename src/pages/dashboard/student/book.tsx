/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
    CheckCircle2,
    CircleOff,
    Clock3,
} from "lucide-react";
import { toast } from "sonner";

import { fetchBooks, type BookDTO } from "@/lib/books";
import {
    fetchMyBorrowRecords,
    createSelfBorrow,
    type BorrowRecordDTO,
} from "@/lib/borrows";

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
} from "@/components/ui/alert-dialog";

type FilterMode =
    | "all"
    | "available"
    | "unavailable"
    | "borrowedByMe"
    | "history";

type BookWithStatus = BookDTO & {
    myStatus: "never" | "active" | "returned";
    activeRecord?: BorrowRecordDTO | null;
    lastRecord?: BorrowRecordDTO | null;
};

/**
 * Format a date string as YYYY-MM-DD in the *local* timezone.
 * This avoids the off-by-one day bug from using toISOString() / UTC.
 */
function fmtDate(d?: string | null) {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        // en-CA locale => YYYY-MM-DD format (e.g., 2025-11-13)
        return date.toLocaleDateString("en-CA");
    } catch {
        return d;
    }
}

function peso(n: number) {
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

export default function StudentBooksPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [myRecords, setMyRecords] = React.useState<BorrowRecordDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [filterMode, setFilterMode] = React.useState<FilterMode>("all");
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
        loadAll();
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
            const activeRecord =
                recordsForBook.find((r) => r.status === "borrowed") ?? null;
            const lastRecord = recordsForBook[0] ?? null;

            const myStatus: "never" | "active" | "returned" = activeRecord
                ? "active"
                : recordsForBook.length > 0
                    ? "returned"
                    : "never";

            return {
                ...book,
                myStatus,
                activeRecord,
                lastRecord,
            };
        });

        let filtered = byBook;

        switch (filterMode) {
            case "available":
                filtered = filtered.filter((b) => b.available);
                break;
            case "unavailable":
                filtered = filtered.filter((b) => !b.available);
                break;
            case "borrowedByMe":
                filtered = filtered.filter((b) => b.myStatus === "active");
                break;
            case "history":
                filtered = filtered.filter((b) => b.myStatus !== "never");
                break;
            case "all":
            default:
                break;
        }

        const q = search.trim().toLowerCase();
        if (q) {
            filtered = filtered.filter((b) => {
                const haystack =
                    `${b.title} ${b.author} ${b.genre} ${b.isbn}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        // Sort by title A–Z for a stable order
        return [...filtered].sort((a, b) =>
            a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
        );
    }, [books, myRecords, filterMode, search]);

    async function handleBorrow(book: BookWithStatus) {
        if (!book.available) {
            toast.info("Book is not available right now.", {
                description: "You can only borrow books marked as Available.",
            });
            return;
        }

        if (book.myStatus === "active") {
            toast.info("Already borrowed", {
                description: "You already have an active borrow for this book.",
            });
            return;
        }

        setBorrowBusyId(book.id);
        try {
            const record = await createSelfBorrow(book.id);
            toast.success("Book borrowed", {
                description: `"${book.title}" has been borrowed. Due on ${fmtDate(
                    record.dueDate
                )}.`,
            });

            // Optimistic: mark as unavailable on the client
            setBooks((prev) =>
                prev.map((b) =>
                    b.id === book.id ? { ...b, available: false } : b
                )
            );
            setMyRecords((prev) => [record, ...prev]);
        } catch (err: any) {
            const msg =
                err?.message ||
                "Could not borrow this book right now. Please try again later.";
            toast.error("Borrow failed", { description: msg });
        } finally {
            setBorrowBusyId(null);
        }
    }

    return (
        <DashboardLayout title="Browse Books">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">
                            Library catalog
                        </h2>
                        <p className="text-xs text-white/70">
                            Browse all books, see availability, and borrow titles you need.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="border-white/20 text-white/90 hover:bg-white/10"
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                    >
                        {refreshing || loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCcw className="h-4 w-4" />
                        )}
                        <span className="sr-only">Refresh</span>
                    </Button>
                </div>
            </div>

            {/* Controls + table */}
            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <CardTitle>Books you can borrow</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            {/* Search */}
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by title, author, ISBN…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            {/* Filter */}
                            <div className="w-full md:w-[220px]">
                                <Select
                                    value={filterMode}
                                    onValueChange={(v) => setFilterMode(v as FilterMode)}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Filter books" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="all">All books</SelectItem>
                                        <SelectItem value="available">Available only</SelectItem>
                                        <SelectItem value="unavailable">Unavailable only</SelectItem>
                                        <SelectItem value="borrowedByMe">
                                            Borrowed by me (active)
                                        </SelectItem>
                                        <SelectItem value="history">
                                            My history (borrowed/returned)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="overflow-x-auto">
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
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {rows.length} {rows.length === 1 ? "book" : "books"}.
                                You can only borrow books marked as{" "}
                                <span className="font-semibold text-emerald-300">
                                    Available
                                </span>
                                .
                            </TableCaption>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                        ID
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Title
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Author
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        ISBN
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Genre
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Pub. year
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Availability
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        My status
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                                        Action
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((book) => {
                                    const { myStatus, activeRecord, lastRecord } = book;

                                    return (
                                        <TableRow
                                            key={book.id}
                                            className="border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell className="text-xs opacity-80">
                                                {book.id}
                                            </TableCell>
                                            <TableCell className="text-sm font-medium">
                                                {book.title}
                                            </TableCell>
                                            <TableCell className="text-sm opacity-90">
                                                {book.author}
                                            </TableCell>
                                            <TableCell className="text-sm opacity-80">
                                                {book.isbn || <span className="opacity-50">—</span>}
                                            </TableCell>
                                            <TableCell className="text-sm opacity-80">
                                                {book.genre || <span className="opacity-50">—</span>}
                                            </TableCell>
                                            <TableCell className="text-sm opacity-80">
                                                {book.publicationYear || (
                                                    <span className="opacity-50">—</span>
                                                )}
                                            </TableCell>

                                            {/* Availability */}
                                            <TableCell>
                                                <Badge
                                                    variant={book.available ? "default" : "outline"}
                                                    className={
                                                        book.available
                                                            ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80"
                                                            : "border-red-400/70 text-red-200 hover:bg-red-500/10"
                                                    }
                                                >
                                                    {book.available ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Available
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1">
                                                            <CircleOff className="h-3 w-3" />
                                                            Unavailable
                                                        </span>
                                                    )}
                                                </Badge>
                                            </TableCell>

                                            {/* My status */}
                                            <TableCell>
                                                {myStatus === "never" && (
                                                    <span className="text-xs text-white/60">
                                                        Not yet borrowed
                                                    </span>
                                                )}

                                                {myStatus === "active" && activeRecord && (
                                                    <div className="flex flex-col gap-0.5 text-xs">
                                                        <span className="inline-flex items-center gap-1 text-amber-200">
                                                            <Clock3 className="h-3 w-3" />
                                                            Borrowed by you
                                                        </span>
                                                        <span className="text-white/70">
                                                            Borrowed:{" "}
                                                            <span className="font-medium">
                                                                {fmtDate(activeRecord.borrowDate)}
                                                            </span>
                                                            {" · "}
                                                            Due:{" "}
                                                            <span className="font-medium">
                                                                {fmtDate(activeRecord.dueDate)}
                                                            </span>
                                                        </span>
                                                        {activeRecord.fine > 0 && (
                                                            <span className="text-red-300">
                                                                Current fine: {peso(activeRecord.fine)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {myStatus === "returned" && lastRecord && (
                                                    <div className="flex flex-col gap-0.5 text-xs text-white/70">
                                                        <span className="inline-flex items-center gap-1 text-emerald-200">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Returned
                                                        </span>
                                                        <span>
                                                            Last returned:{" "}
                                                            <span className="font-medium">
                                                                {fmtDate(lastRecord.returnDate)}
                                                            </span>
                                                        </span>
                                                    </div>
                                                )}
                                            </TableCell>

                                            {/* Action */}
                                            <TableCell className="text-right">
                                                {book.available ? (
                                                    <AlertDialog>
                                                        {/* Trigger button */}
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                                                                disabled={borrowBusyId === book.id}
                                                            >
                                                                Borrow
                                                            </Button>
                                                        </AlertDialogTrigger>

                                                        {/* Confirmation dialog */}
                                                        <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Confirm borrow
                                                                </AlertDialogTitle>
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
                                                                    <span className="text-white/60">ISBN:</span>{" "}
                                                                    {book.isbn || "—"}
                                                                </p>
                                                                <p>
                                                                    <span className="text-white/60">Genre:</span>{" "}
                                                                    {book.genre || "—"}
                                                                </p>
                                                                <p>
                                                                    <span className="text-white/60">
                                                                        Publication year:
                                                                    </span>{" "}
                                                                    {book.publicationYear || "—"}
                                                                </p>
                                                                <p className="text-xs text-white/60 mt-2">
                                                                    The due date will be set automatically based
                                                                    on the library policy. Any overdue days may
                                                                    incur fines.
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
                                                                    disabled={borrowBusyId === book.id}
                                                                    onClick={() => void handleBorrow(book)}
                                                                >
                                                                    {borrowBusyId === book.id ? (
                                                                        <span className="inline-flex items-center gap-2">
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                            Borrowing…
                                                                        </span>
                                                                    ) : (
                                                                        "Confirm borrow"
                                                                    )}
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                ) : myStatus === "active" ? (
                                                    <span className="inline-flex flex-col items-end text-xs text-amber-200">
                                                        <span className="inline-flex items-center gap-1">
                                                            <Clock3 className="h-3 w-3" />
                                                            Borrowed by you
                                                        </span>
                                                        <span className="text-white/60">
                                                            Claim the physical book from the librarian.
                                                        </span>
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
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
