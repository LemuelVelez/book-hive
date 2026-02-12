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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  fetchBorrowRecords,
  markBorrowReturned,
  updateBorrowDueDate,
  markBorrowAsBorrowed,
  approveBorrowExtensionRequest,
  disapproveBorrowExtensionRequest,
  type BorrowRecordDTO,
} from "@/lib/borrows";

import { Calendar } from "@/components/ui/calendar";

const FINE_PER_DAY = 5;
const FIXED_EXTENSION_DAYS = 1;

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

function normalizeFine(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-CA");
  } catch {
    return d;
  }
}

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function studentFullName(rec: BorrowRecordDTO): string {
  const name = (rec.studentName || "").trim();
  if (name) return name;
  return `User #${rec.userId}`;
}

function computeAutoFine(dueDate?: string | null) {
  if (!dueDate) return { overdueDays: 0, autoFine: 0 };

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return { overdueDays: 0, autoFine: 0 };

  const now = new Date();
  const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = todayLocal.getTime() - dueLocal.getTime();
  const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const overdueDays = rawDays > 0 ? rawDays : 0;
  const autoFine = overdueDays > 0 ? overdueDays * FINE_PER_DAY : 0;

  return { overdueDays, autoFine };
}

function parseYmdToDate(d?: string | null): Date | undefined {
  if (!d) return undefined;
  const parts = d.split("-");
  if (parts.length !== 3) return undefined;
  const [yStr, mStr, dayStr] = parts;
  const y = Number(yStr);
  const m = Number(mStr);
  const day = Number(dayStr);
  if (!y || !m || !day) return undefined;
  const date = new Date(y, m - 1, day);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function formatDateForApi(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

  const [markBorrowBusyId, setMarkBorrowBusyId] =
    React.useState<string | null>(null);

  const [returnDialogOpen, setReturnDialogOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] =
    React.useState<BorrowRecordDTO | null>(null);
  const [fineInput, setFineInput] = React.useState<string>("0.00");
  const [overduePreview, setOverduePreview] = React.useState<number>(0);
  const [autoFinePreview, setAutoFinePreview] = React.useState<number>(0);
  const [submittingReturn, setSubmittingReturn] = React.useState(false);

  const [dueDialogOpen, setDueDialogOpen] = React.useState(false);
  const [dueRecord, setDueRecord] = React.useState<BorrowRecordDTO | null>(null);
  const [dueDateInput, setDueDateInput] = React.useState<Date | undefined>(
    undefined
  );
  const [submittingDue, setSubmittingDue] = React.useState(false);

  const [decisionNoteInput, setDecisionNoteInput] = React.useState<string>("");
  const [submittingDecision, setSubmittingDecision] = React.useState<
    "approve" | "disapprove" | null
  >(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setDueDateInput(parseYmdToDate(rec.dueDate));
    setDecisionNoteInput("");
    setSubmittingDecision(null);
    setDueDialogOpen(true);
  }

  function closeDueDialog() {
    setDueDialogOpen(false);
    setDueRecord(null);
    setDueDateInput(undefined);
    setDecisionNoteInput("");
    setSubmittingDue(false);
    setSubmittingDecision(null);
  }

  function openReturnDialog(rec: BorrowRecordDTO) {
    const { overdueDays, autoFine } = computeAutoFine(rec.dueDate);

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

  async function handleMarkBorrowed(rec: BorrowRecordDTO) {
    setMarkBorrowBusyId(rec.id);
    try {
      const updated = await markBorrowAsBorrowed(rec.id);

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      toast.success("Marked as borrowed", {
        description: `Record #${updated.id} is now marked as Borrowed.`,
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to mark as borrowed.";
      toast.error("Update failed", { description: msg });
    } finally {
      setMarkBorrowBusyId(null);
    }
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

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

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

    const ymd = formatDateForApi(dueDateInput);

    setSubmittingDue(true);
    try {
      const updated = await updateBorrowDueDate(dueRecord.id, ymd);

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

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

  async function handleApproveExtension() {
    if (!dueRecord) return;

    setSubmittingDecision("approve");
    try {
      const updated = await approveBorrowExtensionRequest(
        dueRecord.id,
        decisionNoteInput.trim() ? decisionNoteInput.trim() : undefined
      );

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      toast.success("Extension approved", {
        description: `Extension Added (+${FIXED_EXTENSION_DAYS} day). New due date: ${fmtDate(
          updated.dueDate
        )}.`,
      });

      closeDueDialog();
    } catch (err: any) {
      const msg = err?.message || "Failed to approve extension request.";
      toast.error("Approval failed", { description: msg });
      setSubmittingDecision(null);
    }
  }

  async function handleDisapproveExtension() {
    if (!dueRecord) return;

    setSubmittingDecision("disapprove");
    try {
      const updated = await disapproveBorrowExtensionRequest(
        dueRecord.id,
        decisionNoteInput.trim() ? decisionNoteInput.trim() : undefined
      );

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      toast.success("Extension disapproved", {
        description: "The extension request has been disapproved.",
      });

      closeDueDialog();
    } catch (err: any) {
      const msg = err?.message || "Failed to disapprove extension request.";
      toast.error("Disapproval failed", { description: msg });
      setSubmittingDecision(null);
    }
  }

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = records;

    if (statusFilter === "borrowed") {
      rows = rows.filter((r) => r.status !== "returned");
    } else if (statusFilter === "returned") {
      rows = rows.filter((r) => r.status === "returned");
    }

    if (!q) {
      return [...rows].sort((a, b) =>
        (b.borrowDate ?? "").localeCompare(a.borrowDate ?? "")
      );
    }

    const matched = rows.filter((r) => {
      const student =
        (r.studentName || "") +
        " " +
        (r.studentEmail || "") +
        " " +
        (r.studentId || "");
      const book = (r.bookTitle || "") + " " + r.bookId;
      return (
        String(r.id).includes(q) ||
        student.toLowerCase().includes(q) ||
        book.toLowerCase().includes(q) ||
        String(r.userId).includes(q)
      );
    });

    return matched.sort((a, b) =>
      (b.borrowDate ?? "").localeCompare(a.borrowDate ?? "")
    );
  }, [records, statusFilter, search]);

  const groupedByUser = React.useMemo(() => {
    const map = new Map<
      string,
      { userId: string; name: string; rows: BorrowRecordDTO[] }
    >();

    for (const r of filtered) {
      const uid = String(r.userId ?? "unknown");
      if (!map.has(uid)) {
        map.set(uid, { userId: uid, name: studentFullName(r), rows: [] });
      }
      map.get(uid)!.rows.push(r);
    }

    const groups = Array.from(map.values()).map((g) => {
      const rows = [...g.rows].sort((a, b) =>
        (b.borrowDate ?? "").localeCompare(a.borrowDate ?? "")
      );
      const activeCount = rows.filter((r) => r.status !== "returned").length;
      const returnedCount = rows.length - activeCount;
      return {
        key: g.userId,
        userId: g.userId,
        name: g.name,
        rows,
        activeCount,
        returnedCount,
      };
    });

    groups.sort(
      (a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId)
    );

    return groups;
  }, [filtered]);

  const cellScrollbarClasses =
    "overflow-x-auto whitespace-nowrap " +
    "[scrollbar-width:thin] [scrollbar-color:#111827_transparent] " +
    "[&::-webkit-scrollbar]:h-1.5 " +
    "[&::-webkit-scrollbar-track]:bg-transparent " +
    "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
    "[&::-webkit-scrollbar-thumb]:rounded-full " +
    "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

  const dialogScrollbarClasses =
    "[scrollbar-width:thin] [scrollbar-color:#334155_transparent] " +
    "[&::-webkit-scrollbar]:w-2 " +
    "[&::-webkit-scrollbar-track]:bg-transparent " +
    "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
    "[&::-webkit-scrollbar-thumb]:rounded-full " +
    "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

  return (
    <DashboardLayout title="Borrow Records">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Borrow &amp; Return Logs
            </h2>

            <p className="text-xs text-white/70">
              Manage active loans, returns, due dates, and fines.
            </p>

            <div className="mt-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] text-white/70">
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <span className="font-semibold text-amber-200">
                      Pending pickup:
                    </span>{" "}
                    hand the book to the student, then click{" "}
                    <span className="font-semibold text-white">
                      Confirm pickup → Mark borrowed
                    </span>
                    .
                  </li>
                  <li>
                    <span className="font-semibold text-amber-200">
                      Pending return:
                    </span>{" "}
                    verify the physical return, then click{" "}
                    <span className="font-semibold text-white">
                      Mark as returned
                    </span>{" "}
                    and set the final fine (if any).
                  </li>
                  <li>
                    Extension requests are processed as{" "}
                    <span className="font-semibold text-white">Pending</span> →{" "}
                    <span className="font-semibold text-white">Approved/Disapproved</span>.
                    Approval adds{" "}
                    <span className="font-semibold text-sky-200">
                      +{FIXED_EXTENSION_DAYS} day
                    </span>{" "}
                    per request.
                  </li>
                  <li>
                    Renew only when there is{" "}
                    <span className="font-semibold text-white">
                      no next borrower
                    </span>{" "}
                    and the book is still available.
                  </li>
                  <li>
                    Payment status is handled in the{" "}
                    <span className="font-semibold text-white">Fines</span> page.
                  </li>
                </ul>
              </div>
            </div>
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>Borrow records</CardTitle>

            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, user, book…"
                  className="pl-9 bg-slate-900/70 border-white/20 text-white"
                />
              </div>

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

        <CardContent className="space-y-3">
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
            <>
              <div className="text-xs text-white/60">
                Showing{" "}
                <span className="font-semibold text-white/80">
                  {filtered.length}
                </span>{" "}
                {filtered.length === 1 ? "record" : "records"} across{" "}
                <span className="font-semibold text-white/80">
                  {groupedByUser.length}
                </span>{" "}
                {groupedByUser.length === 1 ? "user" : "users"}.
                <span className="ml-2">
                  Tip: use{" "}
                  <span className="font-semibold text-amber-200">
                    Active (Borrowed + Pending)
                  </span>{" "}
                  to focus on items that still need action.
                </span>
              </div>

              <Accordion
                type="multiple"
                className="w-full"
                defaultValue={
                  groupedByUser.length === 1 ? [groupedByUser[0].key] : []
                }
              >
                {groupedByUser.map((group) => (
                  <AccordionItem
                    key={group.key}
                    value={group.key}
                    className="border-white/10"
                  >
                    <div className="rounded-md bg-white/4 px-3">
                      <AccordionTrigger className="py-3 text-white/90 hover:no-underline items-center">
                        <div className="flex w-full items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white">
                              {group.name}
                            </span>
                            <span className="text-xs text-white/60">
                              {group.activeCount} active • {group.returnedCount}{" "}
                              returned • {group.rows.length} total
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                    </div>

                    <AccordionContent className="pb-2">
                      <div className="mb-3 rounded-md px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-white/50">
                          User
                        </div>
                        <div className="text-sm font-semibold text-white/90">
                          {group.name}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableCaption className="text-xs text-white/60">
                            {group.rows.length}{" "}
                            {group.rows.length === 1 ? "record" : "records"} for{" "}
                            <span className="font-semibold text-white/80">
                              {group.name}
                            </span>
                            .
                          </TableCaption>

                          <TableHeader>
                            <TableRow className="border-white/10">
                              <TableHead className="w-[90px] text-xs font-semibold text-white/70">
                                Borrow ID
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
                            {group.rows.map((rec) => {
                              const studentLabel = studentFullName(rec);
                              const bookLabel =
                                rec.bookTitle || `Book #${rec.bookId}`;

                              const isReturned = rec.status === "returned";
                              const isPendingPickup =
                                rec.status === "pending_pickup";
                              const isPendingReturn =
                                rec.status === "pending_return";
                              const isLegacyPending = rec.status === "pending";
                              const isAnyPending =
                                isPendingPickup ||
                                isPendingReturn ||
                                isLegacyPending;
                              const isBorrowed = rec.status === "borrowed";

                              const { overdueDays, autoFine } = computeAutoFine(
                                rec.dueDate
                              );

                              const isOverdue =
                                (isBorrowed ||
                                  isPendingReturn ||
                                  isLegacyPending) &&
                                overdueDays > 0;

                              const fineAmount = normalizeFine(rec.fine as any);

                              const reqStatus = (
                                rec.extensionRequestStatus ?? "none"
                              )
                                .toLowerCase()
                                .trim();
                              const extensionPending = reqStatus === "pending";

                              const extensionCount = Number(
                                rec.extensionCount ?? 0
                              );
                              const everRequestedExtension =
                                reqStatus !== "none" && reqStatus !== "";
                              const canEditDueDate =
                                extensionCount > 0 || everRequestedExtension;

                              return (
                                <TableRow
                                  key={rec.id}
                                  className="border-white/5 hover:bg-white/5 transition-colors"
                                >
                                  <TableCell className="text-xs opacity-80">
                                    {rec.id}
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

                                  <TableCell
                                    className={
                                      "w-[130px] max-w-[130px] " +
                                      cellScrollbarClasses
                                    }
                                  >
                                    {isReturned ? (
                                      <Badge className="bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80">
                                        <span className="inline-flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Returned
                                        </span>
                                      </Badge>
                                    ) : isPendingPickup ? (
                                      <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80">
                                        <span className="inline-flex items-center gap-1">
                                          <Clock3 className="h-3 w-3" />
                                          Pending pickup
                                        </span>
                                      </Badge>
                                    ) : isPendingReturn || isLegacyPending ? (
                                      <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80">
                                        <span className="inline-flex items-center gap-1">
                                          <Clock3 className="h-3 w-3" />
                                          Pending
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
                                      <Badge className="bg-amber-500/90 hover:bg-amber-500 text-white border-amber-400/80">
                                        <span className="inline-flex items-center gap-1">
                                          <CornerDownLeft className="h-3 w-3" />
                                          Borrowed
                                        </span>
                                      </Badge>
                                    )}
                                  </TableCell>

                                  <TableCell
                                    className={
                                      "text-right text-sm w-[120px] max-w-[120px] " +
                                      cellScrollbarClasses
                                    }
                                  >
                                    <div className="inline-flex flex-col items-end gap-0.5">
                                      <span>{peso(fineAmount)}</span>
                                      {isBorrowed || isAnyPending ? (
                                        isOverdue && autoFine > 0 ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-400/40">
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                            Accruing overdue fine (
                                            {peso(autoFine)})
                                          </span>
                                        ) : null
                                      ) : fineAmount > 0 ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-400/40">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                          Fine assessed for this borrow
                                        </span>
                                      ) : null}
                                    </div>
                                  </TableCell>

                                  <TableCell
                                    className={
                                      "text-right w-40 max-w-40 " +
                                      cellScrollbarClasses
                                    }
                                  >
                                    {isReturned ? (
                                      <span className="inline-flex items-center gap-1 text-white/60 text-xs">
                                        <XCircle className="h-3.5 w-3.5" /> No
                                        actions
                                      </span>
                                    ) : (
                                      <div className="inline-flex flex-col items-end gap-1">
                                        <div className="flex flex-col items-end gap-0.5">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="border-white/25 text-xs text-white/80 inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!canEditDueDate}
                                            title={
                                              canEditDueDate
                                                ? extensionPending
                                                  ? `Review extension request (+${FIXED_EXTENSION_DAYS} day) / Edit due date`
                                                  : "Edit due date"
                                                : "Disabled until the borrower requests an extension."
                                            }
                                            onClick={() => openDueDialog(rec)}
                                          >
                                            <Edit className="h-3.5 w-3.5" />
                                            <span>Edit due date</span>
                                          </Button>

                                          {!canEditDueDate ? (
                                            <span className="text-[10px] text-white/50">
                                              Needs extension request
                                            </span>
                                          ) : extensionPending ? (
                                            <span className="text-[10px] text-amber-200/80">
                                              Extension pending (+{FIXED_EXTENSION_DAYS}d)
                                            </span>
                                          ) : null}
                                        </div>

                                        {isPendingPickup && (
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="text-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/15"
                                                disabled={
                                                  markBorrowBusyId === rec.id
                                                }
                                              >
                                                {markBorrowBusyId === rec.id ? (
                                                  <span className="inline-flex items-center gap-1">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    <span>Marking…</span>
                                                  </span>
                                                ) : (
                                                  "Confirm pickup → Mark borrowed"
                                                )}
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                  Confirm pickup &amp; mark as
                                                  borrowed?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription className="text-white/70">
                                                  Confirm that{" "}
                                                  <span className="font-semibold text-white">
                                                    {studentLabel}
                                                  </span>{" "}
                                                  received{" "}
                                                  <span className="font-semibold text-white">
                                                    “{bookLabel}”
                                                  </span>{" "}
                                                  and change the status from{" "}
                                                  <span className="font-semibold text-amber-200">
                                                    Pending pickup
                                                  </span>{" "}
                                                  to{" "}
                                                  <span className="font-semibold text-emerald-200">
                                                    Borrowed
                                                  </span>
                                                  .
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>

                                              <div className="mt-3 text-sm text-white/80 space-y-1">
                                                <p>
                                                  <span className="text-white/60">
                                                    Borrowed on:
                                                  </span>{" "}
                                                  {fmtDate(rec.borrowDate)}
                                                </p>
                                                <p>
                                                  <span className="text-white/60">
                                                    Due date:
                                                  </span>{" "}
                                                  {fmtDate(rec.dueDate)}
                                                </p>
                                                <p className="text-xs text-white/70 pt-1">
                                                  The book stays unavailable
                                                  until it’s marked as{" "}
                                                  <span className="font-semibold text-emerald-200">
                                                    Returned
                                                  </span>
                                                  .
                                                </p>
                                              </div>

                                              <AlertDialogFooter>
                                                <AlertDialogCancel
                                                  className="border-white/20 text-white hover:bg-black/20"
                                                  disabled={
                                                    markBorrowBusyId === rec.id
                                                  }
                                                >
                                                  Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                  disabled={
                                                    markBorrowBusyId === rec.id
                                                  }
                                                  onClick={() =>
                                                    void handleMarkBorrowed(rec)
                                                  }
                                                >
                                                  {markBorrowBusyId === rec.id ? (
                                                    <span className="inline-flex items-center gap-2">
                                                      <Loader2 className="h-4 w-4 animate-spin" />
                                                      Marking…
                                                    </span>
                                                  ) : (
                                                    "Confirm & mark borrowed"
                                                  )}
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        )}

                                        {(isPendingReturn || isLegacyPending) && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="text-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/15"
                                            onClick={() => openReturnDialog(rec)}
                                          >
                                            Mark as returned
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}
        </CardContent>
      </Card>

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
              <AlertDialogTitle>Mark as returned?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                You&apos;re about to mark{" "}
                <span className="font-semibold text-white">
                  “
                  {selectedRecord.bookTitle ??
                    `Book #${selectedRecord.bookId}`}
                  ”
                </span>{" "}
                as <span className="font-semibold">Returned</span> for{" "}
                <span className="font-semibold">
                  {studentFullName(selectedRecord)}
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
              <p className="text-xs font-medium text-white/80">
                Final fine amount (editable)
              </p>
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
                The fine you set here becomes the{" "}
                <span className="font-semibold">official fine</span> for this
                borrow. Payment status is managed in the{" "}
                <span className="font-semibold">Fines</span> page.
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
          <AlertDialogContent
            className={
              "bg-slate-900 border-white/10 text-white " +
              "max-h-[70vh] overflow-y-auto " +
              dialogScrollbarClasses
            }
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Edit due date</AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                You&apos;re updating the due date for{" "}
                <span className="font-semibold text-white">
                  “{dueRecord.bookTitle ?? `Book #${dueRecord.bookId}`}”
                </span>{" "}
                borrowed by{" "}
                <span className="font-semibold">
                  {studentFullName(dueRecord)}
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

            <div className="mt-4 rounded-md border border-white/10 bg-slate-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white/80">
                  Extension request
                </p>

                {(() => {
                  const s = (dueRecord.extensionRequestStatus ?? "none")
                    .toLowerCase()
                    .trim();

                  if (s === "pending") {
                    return (
                      <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          Pending
                        </span>
                      </Badge>
                    );
                  }
                  if (s === "approved") {
                    return (
                      <Badge className="bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Extension Added
                        </span>
                      </Badge>
                    );
                  }
                  if (s === "disapproved") {
                    return (
                      <Badge className="bg-rose-500/80 hover:bg-rose-500 text-white border-rose-400/80">
                        <span className="inline-flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Disapproved
                        </span>
                      </Badge>
                    );
                  }
                  return (
                    <Badge className="bg-slate-500/30 hover:bg-slate-500/30 text-white/80 border-white/10">
                      None
                    </Badge>
                  );
                })()}
              </div>

              {(() => {
                const s = (dueRecord.extensionRequestStatus ?? "none")
                  .toLowerCase()
                  .trim();

                if (s === "none" || !s) {
                  return (
                    <p className="text-[11px] text-white/60">
                      No extension request found for this record.
                    </p>
                  );
                }

                const reqDays =
                  typeof dueRecord.extensionRequestedDays === "number"
                    ? dueRecord.extensionRequestedDays
                    : FIXED_EXTENSION_DAYS;

                return (
                  <div className="space-y-1 text-[11px] text-white/70">
                    <p>
                      <span className="text-white/60">Requested:</span>{" "}
                      <span className="font-semibold text-amber-200">
                        +{reqDays} day{reqDays === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p>
                      <span className="text-white/60">Requested at:</span>{" "}
                      {fmtDateTime(dueRecord.extensionRequestedAt ?? null)}
                    </p>
                    {dueRecord.extensionRequestedReason ? (
                      <p>
                        <span className="text-white/60">Reason:</span>{" "}
                        {dueRecord.extensionRequestedReason}
                      </p>
                    ) : null}
                    {dueRecord.extensionDecidedAt ? (
                      <p>
                        <span className="text-white/60">Decided at:</span>{" "}
                        {fmtDateTime(dueRecord.extensionDecidedAt)}
                      </p>
                    ) : null}
                    {dueRecord.extensionDecisionNote ? (
                      <p>
                        <span className="text-white/60">Decision note:</span>{" "}
                        {dueRecord.extensionDecisionNote}
                      </p>
                    ) : null}
                  </div>
                );
              })()}

              <p className="text-[11px] text-white/60">
                Policy: extension is{" "}
                <span className="font-semibold text-sky-200">
                  +{FIXED_EXTENSION_DAYS} day
                </span>{" "}
                per approved request. Renew only if no next borrower and book remains available.
              </p>

              {((dueRecord.extensionRequestStatus ?? "none")
                .toLowerCase()
                .trim() === "pending") && (
                  <div className="pt-2 space-y-2">
                    <p className="text-xs font-medium text-white/80">
                      Decision note (optional)
                    </p>
                    <Input
                      value={decisionNoteInput}
                      onChange={(e) => setDecisionNoteInput(e.target.value)}
                      placeholder="Optional note for approval/disapproval…"
                      className="bg-slate-900/70 border-white/20 text-white"
                      disabled={submittingDecision !== null || submittingDue}
                    />

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-rose-400/50 text-rose-200 hover:bg-rose-500/10"
                        disabled={submittingDecision !== null || submittingDue}
                        onClick={() => void handleDisapproveExtension()}
                      >
                        {submittingDecision === "disapprove" ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Disapproving…
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <X className="h-4 w-4" />
                            Disapprove
                          </span>
                        )}
                      </Button>

                      <Button
                        type="button"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={submittingDecision !== null || submittingDue}
                        onClick={() => void handleApproveExtension()}
                      >
                        {submittingDecision === "approve" ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Approving…
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            Approve (+{FIXED_EXTENSION_DAYS} day)
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
            </div>

            {((dueRecord.extensionRequestStatus ?? "none")
              .toLowerCase()
              .trim() !== "pending") && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-white/80">
                    New due date
                  </p>
                  <div className="flex flex-col gap-2">
                    <Calendar
                      mode="single"
                      selected={dueDateInput}
                      onSelect={setDueDateInput}
                      captionLayout="dropdown"
                      className="rounded-md border border-white/10 bg-slate-900/70"
                      autoFocus
                    />
                    <p className="text-[11px] text-white/60">
                      Selected date:{" "}
                      <span className="font-semibold">
                        {dueDateInput
                          ? dueDateInput.toLocaleDateString("en-CA")
                          : "—"}
                      </span>
                    </p>
                  </div>
                  <p className="text-[11px] text-white/60">
                    Extending the due date can reduce (or remove) overdue fines while
                    this record is still active.
                  </p>
                </div>
              )}

            {((dueRecord.extensionRequestStatus ?? "none")
              .toLowerCase()
              .trim() === "pending") && (
                <p className="mt-4 text-[11px] text-white/60">
                  Manual due date editing is disabled while an extension request is pending.
                  Decide using Approve/Disapprove above.
                </p>
              )}

            <AlertDialogFooter>
              <AlertDialogCancel
                className="border-white/20 text-white hover:bg-black/20"
                disabled={submittingDue || submittingDecision !== null}
              >
                {((dueRecord.extensionRequestStatus ?? "none")
                  .toLowerCase()
                  .trim() === "pending")
                  ? "Close"
                  : "Cancel"}
              </AlertDialogCancel>

              {((dueRecord.extensionRequestStatus ?? "none")
                .toLowerCase()
                .trim() !== "pending") && (
                  <AlertDialogAction
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={submittingDue || submittingDecision !== null}
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
                )}
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </DashboardLayout>
  );
}
