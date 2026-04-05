/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import {
  fetchBorrowRecords,
  fetchBorrowNotificationSummary,
  markBorrowReturned,
  updateBorrowDueDate,
  markBorrowAsBorrowed,
  approveBorrowExtensionRequest,
  disapproveBorrowExtensionRequest,
  requestBorrowReturnByLibrarian,
  type BorrowNotificationSummaryDTO,
  type BorrowRecordDTO,
} from "@/lib/borrows";

import { Calendar } from "@/components/ui/calendar";
import ExportPreviewBorrowRecords, {
  type PrintableBorrowRecord,
} from "@/components/borrow-preview/export-preview-borrow-records";

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

function getStaffActorLabel(
  name?: string | null,
  actorId?: string | number | null
): string {
  const cleanName = (name || "").trim();
  if (cleanName) return cleanName;

  if (actorId !== null && actorId !== undefined && String(actorId).trim()) {
    return `Staff account #${actorId} (account removed)`;
  }

  return "Library staff";
}

function hasPendingExtensionRequest(rec: BorrowRecordDTO) {
  return (rec.extensionRequestStatus ?? "none").toLowerCase().trim() === "pending";
}

function isReturnedBorrowRecord(rec: BorrowRecordDTO) {
  return rec.status === "returned" || Boolean(rec.returnDate);
}

function isBorrowRecordActionRequired(
  rec: BorrowRecordDTO,
  canManageExtensions: boolean
) {
  if (isReturnedBorrowRecord(rec)) {
    return false;
  }

  if (
    rec.status === "pending_pickup" ||
    rec.status === "pending_return" ||
    rec.status === "pending"
  ) {
    return true;
  }

  if (canManageExtensions && hasPendingExtensionRequest(rec)) {
    return true;
  }

  return false;
}

function buildFallbackNotificationSummary(
  rows: BorrowRecordDTO[],
  canManageExtensions: boolean
): BorrowNotificationSummaryDTO {
  const pendingPickupCount = rows.filter(
    (rec) => rec.status === "pending_pickup"
  ).length;

  const pendingReturnCount = rows.filter(
    (rec) => rec.status === "pending_return" || rec.status === "pending"
  ).length;

  const pendingExtensionCount = canManageExtensions
    ? rows.filter((rec) => !isReturnedBorrowRecord(rec) && hasPendingExtensionRequest(rec))
        .length
    : 0;

  const actionRequiredCount = rows.filter((rec) =>
    isBorrowRecordActionRequired(rec, canManageExtensions)
  ).length;

  const totalRecords = rows.length;
  const handledCount = Math.max(0, totalRecords - actionRequiredCount);

  return {
    role: canManageExtensions ? "librarian" : "assistant_librarian",
    canManageExtensions,
    totalRecords,
    actionRequiredCount,
    unreadCount: actionRequiredCount,
    handledCount,
    readCount: handledCount,
    pendingPickupCount,
    pendingReturnCount,
    pendingExtensionCount,
  };
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

type DetailItemProps = {
  label: string;
  value: React.ReactNode;
};

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/45">
        {label}
      </div>
      <div className="mt-1 text-sm text-white/90">{value}</div>
    </div>
  );
}

export default function LibrarianBorrowRecordsPage() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [records, setRecords] = React.useState<BorrowRecordDTO[]>([]);
  const [notificationSummary, setNotificationSummary] =
    React.useState<BorrowNotificationSummaryDTO | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "needs_action" | "borrowed" | "returned"
  >("all");
  const [previewOpen, setPreviewOpen] = React.useState(false);

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

  const [requestReturnDialogOpen, setRequestReturnDialogOpen] =
    React.useState(false);
  const [detailGroupKey, setDetailGroupKey] = React.useState<string | null>(null);
  const [requestReturnRecord, setRequestReturnRecord] =
    React.useState<BorrowRecordDTO | null>(null);
  const [requestReturnNoteInput, setRequestReturnNoteInput] =
    React.useState<string>("");
  const [submittingRequestReturn, setSubmittingRequestReturn] =
    React.useState(false);

  const loadRecords = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [data, summary] = await Promise.all([
        fetchBorrowRecords(),
        fetchBorrowNotificationSummary().catch(() => null),
      ]);

      setRecords(data);
      setNotificationSummary(
        summary ?? buildFallbackNotificationSummary(data, true)
      );
    } catch (err: any) {
      const msg = err?.message || "Failed to load borrow records.";
      setError(msg);
      toast.error("Failed to load", { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNotificationSummary = React.useCallback(async () => {
    try {
      const summary = await fetchBorrowNotificationSummary();
      setNotificationSummary(summary);
    } catch {
      setNotificationSummary((prev) =>
        prev
          ? buildFallbackNotificationSummary(records, prev.canManageExtensions)
          : buildFallbackNotificationSummary(records, true)
      );
    }
  }, [records]);


  const replaceRecordInState = React.useCallback((updated: BorrowRecordDTO) => {
    setRecords((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? updated : r));

      setNotificationSummary((summary) =>
        summary
          ? buildFallbackNotificationSummary(next, summary.canManageExtensions)
          : buildFallbackNotificationSummary(next, true)
      );

      return next;
    });
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

  function openRequestReturnDialog(rec: BorrowRecordDTO) {
    setRequestReturnRecord(rec);
    setRequestReturnNoteInput("");
    setSubmittingRequestReturn(false);
    setRequestReturnDialogOpen(true);
  }

  function closeRequestReturnDialog() {
    setRequestReturnDialogOpen(false);
    setRequestReturnRecord(null);
    setRequestReturnNoteInput("");
    setSubmittingRequestReturn(false);
  }

  async function handleMarkBorrowed(rec: BorrowRecordDTO) {
    setMarkBorrowBusyId(rec.id);
    try {
      const updated = await markBorrowAsBorrowed(rec.id);

      replaceRecordInState(updated);
      await refreshNotificationSummary();

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

      replaceRecordInState(updated);
      await refreshNotificationSummary();

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

  async function handleConfirmRequestReturn() {
    if (!requestReturnRecord) return;

    setSubmittingRequestReturn(true);
    try {
      const { record: updated, message } = await requestBorrowReturnByLibrarian(
        requestReturnRecord.id,
        requestReturnNoteInput.trim()
          ? requestReturnNoteInput.trim()
          : undefined
      );

      replaceRecordInState(updated);
      await refreshNotificationSummary();

      toast.success("Return requested", {
        description:
          message ||
          `A return request was sent for “${
            updated.bookTitle ?? `Book #${updated.bookId}`
          }”.`,
      });

      closeRequestReturnDialog();
    } catch (err: any) {
      const msg = err?.message || "Failed to request return.";
      toast.error("Request failed", { description: msg });
      setSubmittingRequestReturn(false);
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

      replaceRecordInState(updated);

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

      replaceRecordInState(updated);
      await refreshNotificationSummary();

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

      replaceRecordInState(updated);
      await refreshNotificationSummary();

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

  const canManageExtensions =
    notificationSummary?.canManageExtensions ?? true;

  const effectiveNotificationSummary = React.useMemo(
    () =>
      notificationSummary ??
      buildFallbackNotificationSummary(records, canManageExtensions),
    [notificationSummary, records, canManageExtensions]
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = records;

    if (statusFilter === "needs_action") {
      rows = rows.filter((r) =>
        isBorrowRecordActionRequired(r, canManageExtensions)
      );
    } else if (statusFilter === "borrowed") {
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
      const returnRequestMeta =
        (r.returnRequestedByName || "") + " " + (r.returnRequestNote || "");
      return (
        String(r.id).includes(q) ||
        student.toLowerCase().includes(q) ||
        book.toLowerCase().includes(q) ||
        returnRequestMeta.toLowerCase().includes(q) ||
        String(r.userId).includes(q)
      );
    });

    return matched.sort((a, b) =>
      (b.borrowDate ?? "").localeCompare(a.borrowDate ?? "")
    );
  }, [records, statusFilter, search, canManageExtensions]);

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
      const actionRequiredCount = rows.filter((r) =>
        isBorrowRecordActionRequired(r, canManageExtensions)
      ).length;

      return {
        key: g.userId,
        userId: g.userId,
        name: g.name,
        rows,
        activeCount,
        returnedCount,
        actionRequiredCount,
      };
    });

    groups.sort(
      (a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId)
    );

    return groups;
  }, [filtered, canManageExtensions]);

  const printableBorrowRecords = React.useMemo<PrintableBorrowRecord[]>(
    () =>
      filtered.map((rec) => ({
        id: rec.id,
        userId: rec.userId,
        studentId: rec.studentId ?? null,
        studentName: rec.studentName ?? null,
        studentEmail: rec.studentEmail ?? null,
        bookTitle: rec.bookTitle ?? null,
        bookId: rec.bookId ?? null,
        status: rec.status,
        borrowDate: rec.borrowDate ?? null,
        dueDate: rec.dueDate ?? null,
        returnDate: rec.returnDate ?? null,
        fine: normalizeFine(rec.fine),
        extensionRequestStatus: rec.extensionRequestStatus ?? null,
        returnRequestedAt: rec.returnRequestedAt ?? null,
        returnRequestNote: rec.returnRequestNote ?? null,
      })),
    [filtered]
  );

  const borrowPdfSubtitle = React.useMemo(() => {
    const statusLabel =
      statusFilter === "all"
        ? "All records"
        : statusFilter === "needs_action"
          ? "Needs action"
          : statusFilter === "borrowed"
            ? "Active (Borrowed + Pending)"
            : "Returned only";

    const searchLabel = search.trim()
      ? ` • Search: "${search.trim()}"`
      : "";

    return `Current filtered borrow records view • ${statusLabel}${searchLabel}`;
  }, [statusFilter, search]);

  const dialogScrollbarClasses =
    "[scrollbar-width:thin] [scrollbar-color:#334155_transparent] " +
    "[&::-webkit-scrollbar]:w-2 " +
    "[&::-webkit-scrollbar-track]:bg-transparent " +
    "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
    "[&::-webkit-scrollbar-thumb]:rounded-full " +
    "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

  return (
    <DashboardLayout title="Borrow Records">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Borrow &amp; Return Logs
            </h2>

            <p className="text-xs text-white/70">
              Manage active loans, returns, due dates, fines, and return
              requests.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="border-sky-400/30 text-sky-100 hover:bg-sky-500/10"
            onClick={() => setPreviewOpen(true)}
            disabled={loading || filtered.length === 0}
          >
            <FileText className="mr-2 h-4 w-4" />
            Preview PDF
          </Button>

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

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-amber-400/20 bg-amber-500/10">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-amber-100/70">
              Unread / Needs action
            </div>
            <div className="mt-2 text-2xl font-semibold text-amber-100">
              {effectiveNotificationSummary.unreadCount}
            </div>
            <div className="mt-1 text-xs text-amber-50/70">
              Transactions or requests still waiting for staff.
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-400/20 bg-emerald-500/10">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-emerald-100/70">
              Read / Handled
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-100">
              {effectiveNotificationSummary.readCount}
            </div>
            <div className="mt-1 text-xs text-emerald-50/70">
              Records not currently waiting on staff action.
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-400/20 bg-sky-500/10">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-sky-100/70">
              Pending pickup
            </div>
            <div className="mt-2 text-2xl font-semibold text-sky-100">
              {effectiveNotificationSummary.pendingPickupCount}
            </div>
            <div className="mt-1 text-xs text-sky-50/70">
              Borrow requests waiting to be released.
            </div>
          </CardContent>
        </Card>

        <Card className="border-fuchsia-400/20 bg-fuchsia-500/10">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-fuchsia-100/70">
              Pending return
              {canManageExtensions
                ? " + extension"
                : ""}
            </div>
            <div className="mt-2 text-2xl font-semibold text-fuchsia-100">
              {effectiveNotificationSummary.pendingReturnCount +
                (canManageExtensions
                  ? effectiveNotificationSummary.pendingExtensionCount
                  : 0)}
            </div>
            <div className="mt-1 text-xs text-fuchsia-50/70">
              {canManageExtensions
                ? `${effectiveNotificationSummary.pendingReturnCount} return request(s) and ${effectiveNotificationSummary.pendingExtensionCount} extension request(s).`
                : "Return requests waiting for confirmation."}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-800/60">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Borrow records</CardTitle>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, user, book…"
                  className="border-white/20 bg-slate-900/70 pl-9 text-white"
                />
              </div>

              <div className="w-full md:w-[200px]">
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(
                      v as "all" | "needs_action" | "borrowed" | "returned"
                    )
                  }
                >
                  <SelectTrigger className="h-9 w-full border-white/20 bg-slate-900/70 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900 text-white">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="needs_action">Needs action</SelectItem>
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
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
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
                    Needs action
                  </span>{" "}
                  to focus on unread borrow workflow notifications.
                </span>
              </div>

              <Accordion
                type="multiple"
                className="w-full space-y-3"
                defaultValue={
                  groupedByUser.length === 1 ? [groupedByUser[0].key] : []
                }
              >
                {groupedByUser.map((group) => {
                  const primaryRecord = group.rows[0];

                  return (
                    <AccordionItem
                      key={group.key}
                      value={group.key}
                      className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/35"
                    >
                      <AccordionTrigger className="px-4 py-4 text-white/90 hover:bg-white/5 hover:no-underline">
                        <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          {group.actionRequiredCount > 0 ? (
                            <Badge className="shrink-0 border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/15">
                              {group.actionRequiredCount} needs action
                            </Badge>
                          ) : null}
                          <span className="min-w-0 truncate text-sm font-semibold text-white">
                            {group.name} • {group.activeCount} active • {group.returnedCount} returned • {group.rows.length} total
                          </span>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="border-t border-white/10 px-4 pb-4 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-white/20 text-white/90 hover:bg-white/10 sm:w-auto"
                          onClick={() => setDetailGroupKey(group.key)}
                        >
                          Details
                        </Button>
                      </AccordionContent>

                      <Dialog
                        open={detailGroupKey === group.key}
                        onOpenChange={(open) => setDetailGroupKey(open ? group.key : null)}
                      >
                        <DialogContent
                          className={`w-[96vw] max-h-[95svh] overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-6xl ${dialogScrollbarClasses}`}
                        >
                          <DialogHeader>
                            <DialogTitle className="pr-6">{group.name}</DialogTitle>
                            <DialogDescription className="text-white/70">
                              Review borrow records, due dates, extension requests, and return actions for this user.
                            </DialogDescription>
                          </DialogHeader>

                        <div className="mb-4 grid gap-3 md:grid-cols-3">
                          <DetailItem label="User" value={group.name} />
                          <DetailItem
                            label="Student ID"
                            value={primaryRecord?.studentId || "—"}
                          />
                          <DetailItem
                            label="Email"
                            value={primaryRecord?.studentEmail || "—"}
                          />
                        </div>

                        <div className="grid gap-3">
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

                            const canEditDueDate = true;

                            const hasReturnRequest =
                              !isReturned && Boolean(rec.returnRequestedAt);
                            const canRequestReturn =
                              isBorrowed && !hasReturnRequest;

                            const hasReturnRequester =
                              Boolean((rec.returnRequestedByName || "").trim()) ||
                              (rec.returnRequestedBy !== null &&
                                rec.returnRequestedBy !== undefined);

                            return (
                              <Card
                                key={rec.id}
                                className="border-white/10 bg-slate-950/40 shadow-none"
                              >
                                <CardHeader className="gap-3 pb-4">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-1">
                                      <div className="text-xs uppercase tracking-wide text-white/45">
                                        Borrow record #{rec.id}
                                      </div>
                                      <div className="text-base font-semibold text-white">
                                        {bookLabel}
                                      </div>
                                      <div className="text-sm text-white/60">
                                        Borrower: {studentLabel}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {isReturned ? (
                                        <Badge className="border-emerald-400/80 bg-emerald-500/80 text-white hover:bg-emerald-500">
                                          <span className="inline-flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Returned
                                          </span>
                                        </Badge>
                                      ) : isPendingPickup ? (
                                        <Badge className="border-amber-400/80 bg-amber-500/80 text-white hover:bg-amber-500">
                                          <span className="inline-flex items-center gap-1">
                                            <Clock3 className="h-3 w-3" />
                                            Pending pickup
                                          </span>
                                        </Badge>
                                      ) : isPendingReturn || isLegacyPending ? (
                                        <Badge className="border-amber-400/80 bg-amber-500/80 text-white hover:bg-amber-500">
                                          <span className="inline-flex items-center gap-1">
                                            <Clock3 className="h-3 w-3" />
                                            Pending return
                                          </span>
                                        </Badge>
                                      ) : isOverdue ? (
                                        <Badge className="border-red-400/80 bg-red-500/80 text-white hover:bg-red-500">
                                          <span className="inline-flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Overdue
                                          </span>
                                        </Badge>
                                      ) : (
                                        <Badge className="border-amber-400/80 bg-amber-500/90 text-white hover:bg-amber-500">
                                          <span className="inline-flex items-center gap-1">
                                            <CornerDownLeft className="h-3 w-3" />
                                            Borrowed
                                          </span>
                                        </Badge>
                                      )}

                                      {extensionPending ? (
                                        <Badge className="border-purple-400/40 bg-purple-500/15 text-purple-100 hover:bg-purple-500/15">
                                          Extension pending
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <DetailItem
                                      label="Borrow Date"
                                      value={fmtDate(rec.borrowDate)}
                                    />
                                    <DetailItem
                                      label="Due Date"
                                      value={fmtDate(rec.dueDate)}
                                    />
                                    <DetailItem
                                      label="Return Date"
                                      value={fmtDate(rec.returnDate)}
                                    />
                                    <DetailItem
                                      label="Fine"
                                      value={
                                        <div className="space-y-1">
                                          <div>{peso(fineAmount)}</div>
                                          {isBorrowed || isAnyPending ? (
                                            isOverdue && autoFine > 0 ? (
                                              <div className="text-xs text-amber-200">
                                                Accruing overdue fine (
                                                {peso(autoFine)})
                                              </div>
                                            ) : (
                                              <div className="text-xs text-white/45">
                                                No overdue fine yet
                                              </div>
                                            )
                                          ) : fineAmount > 0 ? (
                                            <div className="text-xs text-emerald-200">
                                              Fine assessed for this borrow
                                            </div>
                                          ) : (
                                            <div className="text-xs text-white/45">
                                              No fine recorded
                                            </div>
                                          )}
                                        </div>
                                      }
                                    />
                                  </div>

                                  {hasReturnRequest ? (
                                    <div className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                                      <div className="font-semibold">
                                        Return requested
                                      </div>
                                      <div className="mt-1">
                                        Requested at:{" "}
                                        {fmtDateTime(rec.returnRequestedAt)}
                                      </div>
                                      {hasReturnRequester ? (
                                        <div className="mt-1">
                                          By:{" "}
                                          {getStaffActorLabel(
                                            rec.returnRequestedByName,
                                            rec.returnRequestedBy ?? null
                                          )}
                                        </div>
                                      ) : null}
                                      {rec.returnRequestNote ? (
                                        <div className="mt-1 whitespace-normal wrap-break-word text-amber-50/90">
                                          Note: {rec.returnRequestNote}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="rounded-md border border-white/10 bg-slate-900/50 p-3">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">
                                      Actions
                                    </div>

                                    {isReturned ? (
                                      <div className="inline-flex items-center gap-1 text-xs text-white/60">
                                        <XCircle className="h-3.5 w-3.5" />
                                        No actions available
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="inline-flex items-center gap-1 border-white/25 text-xs text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                                          disabled={!canEditDueDate}
                                          title={
                                            extensionPending
                                              ? `Review extension request (+${FIXED_EXTENSION_DAYS} day) / Edit due date`
                                              : "Edit due date"
                                          }
                                          onClick={() => openDueDialog(rec)}
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                          Edit due date
                                        </Button>

                                        {isBorrowed && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="text-amber-300 hover:bg-amber-500/15 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={!canRequestReturn}
                                            onClick={() =>
                                              openRequestReturnDialog(rec)
                                            }
                                            title={
                                              canRequestReturn
                                                ? "Notify borrower to return this book"
                                                : "A return request has already been sent for this borrow."
                                            }
                                          >
                                            Request return
                                          </Button>
                                        )}

                                        {isPendingPickup && (
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-100"
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
                                            <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
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

                                              <div className="mt-3 space-y-1 text-sm text-white/80">
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
                                                <p className="pt-1 text-xs text-white/70">
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
                                                  className="bg-emerald-600 text-white hover:bg-emerald-700"
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
                                            className="text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-100"
                                            onClick={() => openReturnDialog(rec)}
                                          >
                                            Mark as returned
                                          </Button>
                                        )}
                                      </div>
                                    )}

                                    {!isReturned ? (
                                      <div className="mt-2 flex flex-col gap-1 text-[11px] text-white/55">
                                        <span>
                                          {extensionPending
                                            ? `Extension request pending (+${FIXED_EXTENSION_DAYS} day).`
                                            : "No extension request required."}
                                        </span>
                                        {isBorrowed ? (
                                          <span>
                                            {hasReturnRequest
                                              ? "A return request has already been sent."
                                              : "You can send a return request reminder to the borrower."}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>

                        </DialogContent>
                      </Dialog>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={requestReturnDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeRequestReturnDialog();
          } else {
            setRequestReturnDialogOpen(true);
          }
        }}
      >
        {requestReturnRecord && (
          <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Request book return?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                This will notify{" "}
                <span className="font-semibold text-white">
                  {studentFullName(requestReturnRecord)}
                </span>{" "}
                that{" "}
                <span className="font-semibold text-white">
                  “
                  {requestReturnRecord.bookTitle ??
                    `Book #${requestReturnRecord.bookId}`}
                  ”
                </span>{" "}
                should be returned.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-3 space-y-1 text-sm text-white/80">
              <p>
                <span className="text-white/60">Borrowed on:</span>{" "}
                {fmtDate(requestReturnRecord.borrowDate)}
              </p>
              <p>
                <span className="text-white/60">Due date:</span>{" "}
                {fmtDate(requestReturnRecord.dueDate)}
              </p>
              <p>
                <span className="text-white/60">Current status:</span>{" "}
                {requestReturnRecord.status}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-white/80">
                Note to borrower (optional)
              </p>
              <Input
                value={requestReturnNoteInput}
                onChange={(e) => setRequestReturnNoteInput(e.target.value)}
                placeholder="Optional message, reminder, or reason…"
                className="border-white/20 bg-slate-900/70 text-white"
                disabled={submittingRequestReturn}
              />
              <p className="text-[11px] text-white/60">
                The borrower will be able to see that library staff requested the
                return of this book.
              </p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                className="border-white/20 text-white hover:bg-black/20"
                disabled={submittingRequestReturn}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 text-white hover:bg-amber-700"
                disabled={submittingRequestReturn}
                onClick={handleConfirmRequestReturn}
              >
                {submittingRequestReturn ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  "Send return request"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

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
          <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
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

            <div className="mt-3 space-y-1 text-sm text-white/80">
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
              <p className="pt-1 text-xs text-white/70">
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
                    className="border-white/20 bg-slate-900/70 pl-6 text-white"
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
                className="bg-emerald-600 text-white hover:bg-emerald-700"
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
              "max-h-[70vh] overflow-y-auto border-white/10 bg-slate-900 text-white " +
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

            <div className="mt-3 space-y-1 text-sm text-white/80">
              <p>
                <span className="text-white/60">Borrowed on:</span>{" "}
                {fmtDate(dueRecord.borrowDate)}
              </p>
              <p>
                <span className="text-white/60">Current due date:</span>{" "}
                {fmtDate(dueRecord.dueDate)}
              </p>
            </div>

            <div className="mt-4 space-y-2 rounded-md border border-white/10 bg-slate-950/40 p-3">
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
                      <Badge className="border-amber-400/80 bg-amber-500/80 text-white hover:bg-amber-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          Pending
                        </span>
                      </Badge>
                    );
                  }
                  if (s === "approved") {
                    return (
                      <Badge className="border-emerald-400/80 bg-emerald-500/80 text-white hover:bg-emerald-500">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Extension Added
                        </span>
                      </Badge>
                    );
                  }
                  if (s === "disapproved") {
                    return (
                      <Badge className="border-rose-400/80 bg-rose-500/80 text-white hover:bg-rose-500">
                        <span className="inline-flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Disapproved
                        </span>
                      </Badge>
                    );
                  }
                  return (
                    <Badge className="border-white/10 bg-slate-500/30 text-white/80 hover:bg-slate-500/30">
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
                per approved request. Renew only if no next borrower and book
                remains available.
              </p>

              {(dueRecord.extensionRequestStatus ?? "none")
                .toLowerCase()
                .trim() === "pending" && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-white/80">
                    Decision note (optional)
                  </p>
                  <Input
                    value={decisionNoteInput}
                    onChange={(e) => setDecisionNoteInput(e.target.value)}
                    placeholder="Optional note for approval/disapproval…"
                    className="border-white/20 bg-slate-900/70 text-white"
                    disabled={submittingDecision !== null || submittingDue}
                  />

                  <div className="flex flex-col gap-2 sm:flex-row">
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
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
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

            {(dueRecord.extensionRequestStatus ?? "none")
              .toLowerCase()
              .trim() !== "pending" && (
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
                  Extending the due date can reduce (or remove) overdue fines
                  while this record is still active.
                </p>
              </div>
            )}

            {(dueRecord.extensionRequestStatus ?? "none")
              .toLowerCase()
              .trim() === "pending" && (
              <p className="mt-4 text-[11px] text-white/60">
                Manual due date editing is disabled while an extension request is
                pending. Decide using Approve/Disapprove above.
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel
                className="border-white/20 text-white hover:bg-black/20"
                disabled={submittingDue || submittingDecision !== null}
              >
                {(dueRecord.extensionRequestStatus ?? "none")
                  .toLowerCase()
                  .trim() === "pending"
                  ? "Close"
                  : "Cancel"}
              </AlertDialogCancel>

              {(dueRecord.extensionRequestStatus ?? "none")
                .toLowerCase()
                .trim() !== "pending" && (
                <AlertDialogAction
                  className="bg-purple-600 text-white hover:bg-purple-700"
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

      <ExportPreviewBorrowRecords
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        records={printableBorrowRecords}
        fileNamePrefix="bookhive-borrow-records"
        reportTitle="BookHive Library • Borrow Records Report"
        reportSubtitle={borrowPdfSubtitle}
      />
    </DashboardLayout>
  );
}