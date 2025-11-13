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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    Loader2,
    RefreshCcw,
    CornerDownLeft,
    CheckCircle2,
    XCircle,
    Search,
} from "lucide-react";
import { toast } from "sonner";

import {
    fetchBorrowRecords,
    markBorrowReturned,
    type BorrowRecordDTO,
} from "@/lib/borrows";

function peso(n: number) {
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
 * Format date as YYYY-MM-DD in *local* timezone
 * to avoid off-by-one issues from UTC conversions.
 */
function fmtDate(d?: string | null) {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        return date.toLocaleDateString("en-CA"); // YYYY-MM-DD
    } catch {
        return d;
    }
}

export default function LibrarianBorrowRecordsPage() {
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [records, setRecords] = React.useState<BorrowRecordDTO[]>([]);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<"all" | "borrowed" | "returned">("all");

    const loadRecords = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchBorrowRecords();
            setRecords(data);
        } catch (err: any) {
            const msg = err?.message || "Failed to load borrow records.";
            setError(msg);
            toast.error("Failed to load", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await loadRecords();
        } finally {
            setRefreshing(false);
        }
    }

    async function handleMarkReturned(rec: BorrowRecordDTO) {
        try {
            const updated = await markBorrowReturned(rec.id);
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            toast.success("Marked as returned", {
                description: `Record #${rec.id} returned.`,
            });
        } catch (err: any) {
            const msg = err?.message || "Failed to mark as returned.";
            toast.error("Update failed", { description: msg });
        }
    }

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = records;

        if (statusFilter !== "all") {
            rows = rows.filter((r) => r.status === statusFilter);
        }

        if (!q) return rows;

        return rows.filter((r) => {
            const student =
                (r.studentEmail || "") +
                " " +
                (r.studentId || "") +
                " " +
                (r.studentName || "");
            const book = (r.bookTitle || "") + " " + r.bookId;
            return (
                String(r.id).includes(q) ||
                student.toLowerCase().includes(q) ||
                book.toLowerCase().includes(q) ||
                String(r.userId).includes(q)
            );
        });
    }, [records, statusFilter, search]);

    return (
        <DashboardLayout title="Borrow Records">
            {/* Header: vertical on mobile, horizontal on desktop */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Borrow &amp; Return Logs</h2>
                        <p className="text-xs text-white/70">
                            Track who borrowed which book, due dates, returns, and fines.
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

            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    {/* Controls row: vertical on mobile, horizontal on desktop */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <CardTitle>Borrow records</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            {/* Search: full width on mobile */}
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by ID, user, book…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            {/* Status filter (shadcn Select): full width on mobile */}
                            <div className="w-full md:w-[180px]">
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) =>
                                        setStatusFilter(v as "all" | "borrowed" | "returned")
                                    }
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="borrowed">Borrowed</SelectItem>
                                        <SelectItem value="returned">Returned</SelectItem>
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
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            No borrow records found.
                        </div>
                    ) : (
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {filtered.length} {filtered.length === 1 ? "record" : "records"}.
                            </TableCaption>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[90px] text-xs font-semibold text-white/70">
                                        Borrow ID
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Student Email (or ID)
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Book Title (or ID)
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Borrow Date
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Due Date
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Return Date
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Status
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                                        ₱Fine
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((rec) => {
                                    const studentLabel =
                                        rec.studentEmail ||
                                        rec.studentId ||
                                        rec.studentName ||
                                        `User #${rec.userId}`;
                                    const bookLabel = rec.bookTitle || `Book #${rec.bookId}`;

                                    return (
                                        <TableRow
                                            key={rec.id}
                                            className="border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell className="text-xs opacity-80">
                                                {rec.id}
                                            </TableCell>
                                            <TableCell className="text-sm">{studentLabel}</TableCell>
                                            <TableCell className="text-sm">{bookLabel}</TableCell>
                                            <TableCell className="text-sm opacity-90">
                                                {fmtDate(rec.borrowDate)}
                                            </TableCell>
                                            <TableCell className="text-sm opacity-90">
                                                {fmtDate(rec.dueDate)}
                                            </TableCell>
                                            <TableCell className="text-sm opacity-90">
                                                {fmtDate(rec.returnDate)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        rec.status === "borrowed" ? "default" : "outline"
                                                    }
                                                    className={
                                                        rec.status === "borrowed"
                                                            ? "bg-amber-500/90 hover:bg-amber-500 text-black border-amber-400/80"
                                                            : "border-emerald-400/70 text-emerald-200 hover:bg-emerald-500/10"
                                                    }
                                                >
                                                    {rec.status === "borrowed" ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <CornerDownLeft className="h-3 w-3" />
                                                            Borrowed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Returned
                                                        </span>
                                                    )}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {peso(rec.fine)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {rec.status === "borrowed" ? (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/15"
                                                            >
                                                                Mark returned
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Mark as returned?
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription className="text-white/70">
                                                                    This will set <b>Return Date</b> to today and
                                                                    free the book’s availability.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                                                                    Cancel
                                                                </AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                    onClick={() => handleMarkReturned(rec)}
                                                                >
                                                                    Confirm
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-white/60 text-xs">
                                                        <XCircle className="h-3.5 w-3.5" /> No actions
                                                    </span>
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
