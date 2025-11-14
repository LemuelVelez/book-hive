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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { Loader2, RefreshCcw, Search, Star } from "lucide-react";
import { toast } from "sonner";

import { fetchFeedbacks, type FeedbackDTO } from "@/lib/feedbacks";

/**
 * Format date as YYYY-MM-DD in *local* timezone
 * to avoid off-by-one issues from UTC conversions.
 */
function fmtDate(d?: string | null) {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        // en-CA -> 2025-11-13 (YYYY-MM-DD)
        return date.toLocaleDateString("en-CA");
    } catch {
        return d;
    }
}

/** Render up to 5 stars; filled according to rating */
function Stars({ rating = 0 }: { rating?: number }) {
    const full = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return (
        <div className="inline-flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    className={
                        "h-4 w-4 " +
                        (i < full ? "fill-yellow-400 text-yellow-400" : "text-white/30")
                    }
                />
            ))}
            <span className="text-xs opacity-70 ml-0.5">{full}/5</span>
        </div>
    );
}

export default function LibrarianFeedbacksPage() {
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [rows, setRows] = React.useState<FeedbackDTO[]>([]);
    const [search, setSearch] = React.useState("");
    const [ratingFilter, setRatingFilter] = React.useState<
        "all" | "5" | "4" | "3" | "2" | "1"
    >("all");

    const load = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchFeedbacks();
            setRows(data);
        } catch (err: any) {
            const msg = err?.message || "Failed to load feedbacks.";
            setError(msg);
            toast.error("Failed to load", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    }

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = rows;

        if (ratingFilter !== "all") {
            const n = Number(ratingFilter);
            list = list.filter((f) => Math.round(Number(f.rating) || 0) === n);
        }

        if (!q) return list;

        return list.filter((f) => {
            const student =
                (f.studentEmail || "") +
                " " +
                (f.studentId || "") +
                " " +
                (f.userId || "");
            const book = (f.bookTitle || "") + " " + String(f.bookId || "");
            const comment = f.comment || "";
            return (
                String(f.id).includes(q) ||
                student.toLowerCase().includes(q) ||
                book.toLowerCase().includes(q) ||
                comment.toLowerCase().includes(q)
            );
        });
    }, [rows, ratingFilter, search]);

    return (
        <DashboardLayout title="Feedbacks">
            {/* Header: vertical on mobile, horizontal on desktop */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-lg font-semibold leading-tight">Book Feedbacks</h2>
                    <p className="text-xs text-white/70">
                        Reviews submitted by students for borrowed books.
                    </p>
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

            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    {/* Controls: vertical on mobile, horizontal on desktop */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <CardTitle>Feedback list</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            {/* Search (full width on mobile) */}
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by ID, user, book, comment…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            {/* Rating filter (full width on mobile) */}
                            <div className="w-full md:w-40">
                                <Select
                                    value={ratingFilter}
                                    onValueChange={(v) =>
                                        setRatingFilter(
                                            v as "all" | "5" | "4" | "3" | "2" | "1"
                                        )
                                    }
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Rating" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="all">All ratings</SelectItem>
                                        <SelectItem value="5">5 stars</SelectItem>
                                        <SelectItem value="4">4 stars</SelectItem>
                                        <SelectItem value="3">3 stars</SelectItem>
                                        <SelectItem value="2">2 stars</SelectItem>
                                        <SelectItem value="1">1 star</SelectItem>
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
                        <div className="py-6 text-center text-sm text-red-300">
                            {error}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            No feedbacks found.
                        </div>
                    ) : (
                        <>
                            {/* Desktop: Table (horizontal layout) */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableCaption className="text-xs text-white/60">
                                        Showing {filtered.length}{" "}
                                        {filtered.length === 1 ? "entry" : "entries"}.
                                    </TableCaption>
                                    <TableHeader>
                                        <TableRow className="border-white/10">
                                            <TableHead className="w-[90px] text-xs font-semibold text-white/70">
                                                Feedback ID
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Student Email (or ID)
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Book Title (or ID)
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Rating
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Comment
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((f) => {
                                            const student =
                                                f.studentEmail ||
                                                f.studentId ||
                                                `User #${f.userId}`;
                                            const book =
                                                f.bookTitle || `Book #${f.bookId}`;
                                            const comment = f.comment || "—";
                                            return (
                                                <TableRow
                                                    key={f.id}
                                                    className="border-white/5 hover:bg-white/5 transition-colors"
                                                >
                                                    <TableCell className="text-xs opacity-80">
                                                        {f.id}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {student}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {book}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <Stars rating={f.rating} />
                                                    </TableCell>
                                                    <TableCell className="text-sm max-w-[520px]">
                                                        <div className="flex flex-col gap-0.5">
                                                            {f.createdAt && (
                                                                <span className="text-[11px] text-white/50">
                                                                    {fmtDate(f.createdAt as any)}
                                                                </span>
                                                            )}
                                                            <span
                                                                className="truncate"
                                                                title={comment}
                                                            >
                                                                {comment}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile: Stacked cards (vertical layout) */}
                            <div className="md:hidden space-y-3">
                                {filtered.map((f) => {
                                    const student =
                                        f.studentEmail ||
                                        f.studentId ||
                                        `User #${f.userId}`;
                                    const book =
                                        f.bookTitle || `Book #${f.bookId}`;
                                    const comment = f.comment || "—";
                                    return (
                                        <div
                                            key={f.id}
                                            className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs text-white/60">
                                                    Feedback ID
                                                </div>
                                                <div className="text-xs font-semibold">
                                                    {f.id}
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Student
                                                </div>
                                                <div className="text-sm">{student}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Book
                                                </div>
                                                <div className="text-sm">{book}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Rating
                                                </div>
                                                <div className="text-sm">
                                                    <Stars rating={f.rating} />
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Submitted
                                                </div>
                                                <div className="text-sm">
                                                    {f.createdAt
                                                        ? fmtDate(f.createdAt as any)
                                                        : "—"}
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Comment
                                                </div>
                                                <div className="text-sm">{comment}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
