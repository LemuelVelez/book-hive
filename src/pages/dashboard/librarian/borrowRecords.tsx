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
    Clock3,
    AlertTriangle,
    Edit,
} from "lucide-react";
import { toast } from "sonner";

import {
    fetchBorrowRecords,
    markBorrowReturned,
    updateBorrowDueDate,
    type BorrowRecordDTO,
} from "@/lib/borrows";

// === CONFIG: adjust fine per day here if needed ===
const FINE_PER_DAY = 5; // ₱5.00 per overdue day

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

/**
 * Compute overdue days and automatic fine based on due date and today (local).
 */
function computeAutoFine(dueDate?: string | null) {
    if (!dueDate) {
        return { overdueDays: 0, autoFine: 0 };
    }

    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
        return { overdueDays: 0, autoFine: 0 };
    }

    const now = new Date();

    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayLocal = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const diffMs = todayLocal.getTime() - dueLocal.getTime();
    const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const overdueDays = rawDays > 0 ? rawDays : 0;
    const autoFine = overdueDays > 0 ? overdueDays * FINE_PER_DAY : 0;

    return { overdueDays, autoFine };
}

export default function LibrarianBorrowRecordsPage() {
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [records, setRecords] = React.useState<BorrowRecordDTO[]>([]);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<
        "all" | "borrowed" | "returned"
    >("all");

    // --- Return dialog state (for marking as returned / verifying pending) ---
    const [returnDialogOpen, setReturnDialogOpen] = React.useState(false);
    const [selectedRecord, setSelectedRecord] =
        React.useState<BorrowRecordDTO | null>(null);
    const [fineInput, setFineInput] = React.useState<string>("0.00");
    const [overduePreview, setOverduePreview] = React.useState<number>(0);
    const [autoFinePreview, setAutoFinePreview] = React.useState<number>(0);
    const [submittingReturn, setSubmittingReturn] = React.useState(false);

    // --- Edit due date dialog state ---
    const [dueDialogOpen, setDueDialogOpen] = React.useState(false);
    const [dueRecord, setDueRecord] = React.useState<BorrowRecordDTO | null>(
        null
    );
    const [dueDateInput, setDueDateInput] = React.useState<string>("");
    const [submittingDue, setSubmittingDue] = React.useState(false);

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
        void loadRecords();
    }, [loadRecords]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await loadRecords();
        } finally {
            setRefreshing(false);
        }
    }

    function openDueDialog(rec: BorrowRecordDTO) {
        setDueRecord(rec);
        setDueDateInput(rec.dueDate ?? "");
        setDueDialogOpen(true);
    }

    function closeDueDialog() {
        setDueDialogOpen(false);
        setDueRecord(null);
        setSubmittingDue(false);
    }

    /**
     * Open dialog to mark a record as returned (for both borrowed + pending).
     * Auto-compute fine (if overdue), but allow librarian to edit it.
     */
    function openReturnDialog(rec: BorrowRecordDTO) {
        const { overdueDays, autoFine } = computeAutoFine(rec.dueDate);

        // If there's already a fine stored, prefer that as initial value.
        const initialFine =
            typeof rec.fine === "number" && rec.fine > 0 ? rec.fine : autoFine;

        setSelectedRecord(rec);
        setOverduePreview(overdueDays);
        setAutoFinePreview(autoFine);
        setFineInput(initialFine.toFixed(2));
        setReturnDialogOpen(true);
    }

    function closeReturnDialog() {
        setReturnDialogOpen(false);
        setSelectedRecord(null);
        setSubmittingReturn(false);
    }

    async function handleConfirmReturn() {
        if (!selectedRecord) return;

        const trimmed = fineInput.trim();
        const parsed = trimmed === "" ? 0 : Number(trimmed);

        if (Number.isNaN(parsed) || parsed < 0) {
            toast.error("Invalid fine amount", {
                description: "Fine must be a non-negative number.",
            });
            return;
        }

        setSubmittingReturn(true);
        try {
            const updated = await markBorrowReturned(selectedRecord.id, {
                fine: parsed,
            });

            setRecords((prev) =>
                prev.map((r) => (r.id === updated.id ? updated : r))
            );

            toast.success("Marked as returned", {
                description: `Record #${updated.id} marked as returned with fine ${peso(
                    updated.fine ?? parsed
                )}.`,
            });

            closeReturnDialog();
        } catch (err: any) {
            const msg = err?.message || "Failed to mark as returned.";
            toast.error("Update failed", { description: msg });
            setSubmittingReturn(false);
        }
    }

    async function handleSaveDueDate() {
        if (!dueRecord) return;

        if (!dueDateInput) {
            toast.error("Invalid due date", {
                description: "Please pick a due date.",
            });
            return;
        }

        setSubmittingDue(true);
        try {
            const updated = await updateBorrowDueDate(dueRecord.id, dueDateInput);

            setRecords((prev) =>
                prev.map((r) => (r.id === updated.id ? updated : r))
            );

            toast.success("Due date updated", {
                description: `New due date: ${fmtDate(updated.dueDate)}.`,
            });

            closeDueDialog();
        } catch (err: any) {
            const msg = err?.message || "Failed to update due date.";
            toast.error("Update failed", { description: msg });
            setSubmittingDue(false);
        }
    }

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = records;

        // "Borrowed" filter: treat both borrowed + pending as "active"
        if (statusFilter === "borrowed") {
            rows = rows.filter(
                (r) => r.status === "borrowed" || r.status === "pending"
            );
        } else if (statusFilter === "returned") {
            rows = rows.filter((r) => r.status === "returned");
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
                        <h2 className="text-lg font-semibold leading-tight">
                            Borrow &amp; Return Logs
                        </h2>
                        <p className="text-xs text-white/70">
                            Track who borrowed which book, due dates, returns, and fines.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-200/90">
                            For{" "}
                            <span className="font-semibold">pending verification</span>{" "}
                            records, use this page to confirm the{" "}
                            <span className="font-semibold">physical return</span>, auto-
                            compute fines, and mark them as{" "}
                            <span className="font-semibold">Returned</span>. This will keep
                            the student&apos;s circulation status in sync.
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
                            <div className="w-full md:w-[200px]">
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
                                        <SelectItem value="borrowed">
                                            Active (Borrowed + Pending)
                                        </SelectItem>
                                        <SelectItem value="returned">Returned only</SelectItem>
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
                            No borrow records found.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableCaption className="text-xs text-white/60">
                                    Showing {filtered.length}{" "}
                                    {filtered.length === 1 ? "record" : "records"}. Use the{" "}
                                    <span className="font-semibold text-amber-200">
                                        Active (Borrowed + Pending)
                                    </span>{" "}
                                    filter to quickly see records that still need attention.
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

                                        const isReturned = rec.status === "returned";
                                        const isPending = rec.status === "pending";
                                        const isBorrowed = rec.status === "borrowed";

                                        const { overdueDays } = computeAutoFine(rec.dueDate);
                                        const isOverdue =
                                            (isBorrowed || isPending) && overdueDays > 0;

                                        return (
                                            <TableRow
                                                key={rec.id}
                                                className="border-white/5 hover:bg-white/5 transition-colors"
                                            >
                                                <TableCell className="text-xs opacity-80">
                                                    {rec.id}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {studentLabel}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {bookLabel}
                                                </TableCell>
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
                                                    {isReturned ? (
                                                        <Badge className="bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80">
                                                            <span className="inline-flex items-center gap-1">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Returned
                                                            </span>
                                                        </Badge>
                                                    ) : isPending ? (
                                                        <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Clock3 className="h-3 w-3" />
                                                                Pending verification
                                                            </span>
                                                        </Badge>
                                                    ) : isOverdue ? (
                                                        <Badge className="bg-red-500/80 hover:bg-red-500 text-white border-red-400/80">
                                                            <span className="inline-flex items-center gap-1">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                Overdue
                                                            </span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-amber-500/90 hover:bg-amber-500 text-black border-amber-400/80">
                                                            <span className="inline-flex items-center gap-1">
                                                                <CornerDownLeft className="h-3 w-3" />
                                                                Borrowed
                                                            </span>
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {peso(rec.fine as number)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {isBorrowed || isPending ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            {/* ✏️ Edit due date button with Lucide Edit icon */}
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-white/25 text-xs text-white/80 inline-flex items-center gap-1"
                                                                onClick={() => openDueDialog(rec)}
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                                <span>Edit due date</span>
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/15"
                                                                onClick={() => openReturnDialog(rec)}
                                                            >
                                                                {isPending
                                                                    ? "Verify & mark returned"
                                                                    : "Mark returned"}
                                                            </Button>
                                                        </div>
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
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Global dialog for confirming return & fine computation */}
            <AlertDialog
                open={returnDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeReturnDialog();
                    } else {
                        setReturnDialogOpen(true);
                    }
                }}
            >
                {selectedRecord && (
                    <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {selectedRecord.status === "pending"
                                    ? "Verify and mark as returned?"
                                    : "Mark as returned?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-white/70">
                                You&apos;re about to mark{" "}
                                <span className="font-semibold text-white">
                                    “{selectedRecord.bookTitle ??
                                        `Book #${selectedRecord.bookId}`}”
                                </span>{" "}
                                as <span className="font-semibold">Returned</span> for{" "}
                                <span className="font-semibold">
                                    {selectedRecord.studentEmail ??
                                        selectedRecord.studentId ??
                                        `User #${selectedRecord.userId}`}
                                </span>
                                .
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="mt-3 text-sm text-white/80 space-y-1">
                            <p>
                                <span className="text-white/60">Borrowed on:</span>{" "}
                                {fmtDate(selectedRecord.borrowDate)}
                            </p>
                            <p>
                                <span className="text-white/60">Due date:</span>{" "}
                                {fmtDate(selectedRecord.dueDate)}
                            </p>
                            <p>
                                <span className="text-white/60">Assumed return date:</span>{" "}
                                {fmtDate(new Date().toISOString())}{" "}
                                <span className="text-xs text-white/50">
                                    (today, for fine computation)
                                </span>
                            </p>
                            <p className="text-xs text-white/70 pt-1">
                                Overdue days:{" "}
                                <span className="font-semibold">
                                    {overduePreview} day{overduePreview === 1 ? "" : "s"}
                                </span>
                                {overduePreview > 0 ? (
                                    <>
                                        {" "}
                                        · Auto fine @ {peso(FINE_PER_DAY)} per day:{" "}
                                        <span className="font-semibold">
                                            {peso(autoFinePreview)}
                                        </span>
                                    </>
                                ) : (
                                    " (No overdue days → auto fine is ₱0.00)"
                                )}
                            </p>
                        </div>

                        <div className="mt-4 space-y-2">
                            <label className="text-xs font-medium text-white/80">
                                Final fine amount (editable)
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="relative w-full">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/60">
                                        ₱
                                    </span>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={fineInput}
                                        onChange={(e) => setFineInput(e.target.value)}
                                        className="pl-6 bg-slate-900/70 border-white/20 text-white"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-white/30 text-xs text-white/80"
                                    onClick={() => setFineInput(autoFinePreview.toFixed(2))}
                                >
                                    Use auto
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-white/30 text-xs text-white/80"
                                    onClick={() =>
                                        setFineInput((selectedRecord.fine ?? 0).toFixed(2))
                                    }
                                >
                                    Use existing
                                </Button>
                            </div>
                            <p className="text-[11px] text-white/60">
                                The fine above will be saved with this record. You may set it
                                to <span className="font-semibold">0</span> for waivers or
                                adjust it manually if needed.
                            </p>
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel
                                className="border-white/20 text-white hover:bg-black/20"
                                disabled={submittingReturn}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={submittingReturn}
                                onClick={handleConfirmReturn}
                            >
                                {submittingReturn ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving…
                                    </span>
                                ) : (
                                    "Confirm return"
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
            </AlertDialog>

            {/* Dialog for editing due date */}
            <AlertDialog
                open={dueDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeDueDialog();
                    } else {
                        setDueDialogOpen(true);
                    }
                }}
            >
                {dueRecord && (
                    <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Edit due date</AlertDialogTitle>
                            <AlertDialogDescription className="text-white/70">
                                You&apos;re updating the due date for{" "}
                                <span className="font-semibold text-white">
                                    “{dueRecord.bookTitle ?? `Book #${dueRecord.bookId}`}”
                                </span>{" "}
                                borrowed by{" "}
                                <span className="font-semibold">
                                    {dueRecord.studentEmail ??
                                        dueRecord.studentId ??
                                        `User #${dueRecord.userId}`}
                                </span>
                                .
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="mt-3 text-sm text-white/80 space-y-1">
                            <p>
                                <span className="text-white/60">Borrowed on:</span>{" "}
                                {fmtDate(dueRecord.borrowDate)}
                            </p>
                            <p>
                                <span className="text-white/60">Current due date:</span>{" "}
                                {fmtDate(dueRecord.dueDate)}
                            </p>
                        </div>

                        <div className="mt-4 space-y-2">
                            <label className="text-xs font-medium text-white/80">
                                New due date
                            </label>
                            <Input
                                type="date"
                                value={dueDateInput}
                                onChange={(e) => setDueDateInput(e.target.value)}
                                className="bg-slate-900/70 border-white/20 text-white"
                            />
                            <p className="text-[11px] text-white/60">
                                Extending the due date will automatically reduce or remove
                                overdue fines for this record while it is still active.
                            </p>
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel
                                className="border-white/20 text-white hover:bg-black/20"
                                disabled={submittingDue}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                disabled={submittingDue}
                                onClick={handleSaveDueDate}
                            >
                                {submittingDue ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving…
                                    </span>
                                ) : (
                                    "Save due date"
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
            </AlertDialog>
        </DashboardLayout>
    );
}
