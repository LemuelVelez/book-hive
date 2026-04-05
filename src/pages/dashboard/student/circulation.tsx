/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  Layers,
  RefreshCcw,
  Loader2,
  Search,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  BellRing,
  MessageSquareText,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { BORROW_ROUTES } from "@/api/borrows/route";
import {
  requestBorrowReturn,
  requestBorrowExtension,
  type BorrowRecordDTO,
} from "@/lib/borrows";

import { fetchMyFines, type FineDTO } from "@/lib/fines";

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

type StatusFilter = "all" | "borrowed" | "returned";

type BorrowRecordsResponse = {
  ok?: boolean;
  records?: BorrowRecordDTO[];
  message?: string;
};

const FIXED_EXTENSION_DAYS = 1;
const APP_TIME_ZONE = "Asia/Manila";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 1000 * 60 * 60 * 24;

function getErrorMessage(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e) {
    const message = (e as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function isDateOnly(value?: string | null): value is string {
  return Boolean(value && DATE_ONLY_RE.test(String(value).trim()));
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const value = String(d).trim();

  if (isDateOnly(value)) {
    return value;
  }

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return value;
  }
}

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
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

function normalizeFine(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function getServerNowDate(serverNow?: string | null): Date | null {
  if (!serverNow) return null;
  const parsed = new Date(serverNow);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateOnlyToUtcMs(dateOnly: string): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function toUtcDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeOverdueDays(
  dueDate?: string | null,
  serverNow?: string | null
): number {
  if (!isDateOnly(dueDate)) return 0;

  const referenceDate = getServerNowDate(serverNow);
  if (!referenceDate) return 0;

  const todayDateOnly = toUtcDateOnlyString(referenceDate);
  const diffMs = dateOnlyToUtcMs(todayDateOnly) - dateOnlyToUtcMs(dueDate);
  const rawDays = Math.floor(diffMs / DAY_MS);

  return rawDays > 0 ? rawDays : 0;
}

async function fetchBorrowRecordsSnapshot(): Promise<{
  records: BorrowRecordDTO[];
  serverNow: string | null;
}> {
  let response: Response;

  try {
    response = await fetch(BORROW_ROUTES.my, {
      credentials: "include",
      method: "GET",
    });
  } catch (error) {
    const details = getErrorMessage(error);
    const suffix = details ? ` Details: ${details}` : "";
    throw new Error(
      `Cannot reach the circulation API right now.${suffix}`
    );
  }

  const serverNow = response.headers.get("date");
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    if (isJson) {
      try {
        const data = (await response.json()) as BorrowRecordsResponse;
        if (data && typeof data.message === "string" && data.message.trim()) {
          message = data.message;
        }
      } catch {
        // ignore malformed JSON error payloads
      }
    } else {
      try {
        const text = await response.text();
        if (text.trim()) message = text;
      } catch {
        // ignore unreadable text payloads
      }
    }

    throw new Error(message);
  }

  const payload = isJson
    ? ((await response.json()) as BorrowRecordsResponse)
    : null;

  return {
    records: Array.isArray(payload?.records) ? payload.records : [],
    serverNow,
  };
}

function CirculationDetail({
  label,
  value,
  children,
  className = "",
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/20 p-3 ${className}`.trim()}
    >
      <div className="text-[11px] uppercase tracking-wide text-white/55">
        {label}
      </div>
      <div className="mt-1 text-sm text-white/90 wrap-break-word">
        {children ?? value ?? "—"}
      </div>
    </div>
  );
}

function LibrarianReturnRequestNotice({
  requesterName,
  requestedAt,
  note,
  className = "",
}: {
  requesterName?: string | null;
  requestedAt?: string | null;
  note?: string | null;
  className?: string;
}) {
  const displayRequesterName = (requesterName ?? "").trim() || "Librarian";
  const trimmedNote = (note ?? "").trim();

  return (
    <div
      className={
        "rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-left text-[11px] text-rose-100 " +
        className
      }
    >
      <div className="inline-flex items-center gap-1 font-semibold">
        <BellRing className="h-3.5 w-3.5" />
        Librarian return request
      </div>

      <div className="mt-1 text-rose-100/90">
        Requested by {displayRequesterName}
        {requestedAt ? ` • ${fmtDateTime(requestedAt)}` : ""}
      </div>

      {trimmedNote ? (
        <div className="mt-1 whitespace-normal wrap-break-word leading-relaxed text-rose-50">
          <span className="font-semibold">Note:</span> {trimmedNote}
        </div>
      ) : (
        <div className="mt-1 text-rose-100/70">No note from librarian.</div>
      )}
    </div>
  );
}

function BorrowerReturnRequestNotice({
  requestedAt,
  className = "",
}: {
  requestedAt?: string | null;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-left text-[11px] text-amber-100 " +
        className
      }
    >
      <div className="inline-flex items-center gap-1 font-semibold">
        <Clock3 className="h-3.5 w-3.5" />
        Return request submitted
      </div>

      <div className="mt-1 text-amber-100/90">
        Waiting for librarian confirmation.
        {requestedAt ? ` • ${fmtDateTime(requestedAt)}` : ""}
      </div>
    </div>
  );
}

function ExtensionDecisionNotice({
  status,
  decidedAt,
  note,
  className = "",
}: {
  status?: string | null;
  decidedAt?: string | null;
  note?: string | null;
  className?: string;
}) {
  const trimmedNote = (note ?? "").trim();
  const normalizedStatus = (status ?? "").toLowerCase().trim();

  if (!trimmedNote) return null;

  const isApproved = normalizedStatus === "approved";
  const isDisapproved = normalizedStatus === "disapproved";

  const toneClasses = isApproved
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
    : isDisapproved
      ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
      : "border-sky-400/30 bg-sky-500/10 text-sky-100";

  return (
    <div
      className={
        "rounded-md px-3 py-2 text-left text-[11px] " +
        toneClasses +
        " " +
        className
      }
    >
      <div className="inline-flex items-center gap-1 font-semibold">
        {isDisapproved ? (
          <XCircle className="h-3.5 w-3.5" />
        ) : (
          <MessageSquareText className="h-3.5 w-3.5" />
        )}
        Extension decision note
      </div>

      <div className="mt-1">
        {isApproved
          ? "Approved"
          : isDisapproved
            ? "Disapproved"
            : "Decision updated"}
        {decidedAt ? ` • ${fmtDateTime(decidedAt)}` : ""}
      </div>

      <div className="mt-1 whitespace-normal wrap-break-word leading-relaxed">
        <span className="font-semibold">Note:</span> {trimmedNote}
      </div>
    </div>
  );
}

function RecordStatusBadge({
  isReturned,
  isAnyPending,
  hasLibrarianReturnRequest,
  isOverdue,
}: {
  isReturned: boolean;
  isAnyPending: boolean;
  hasLibrarianReturnRequest: boolean;
  isOverdue: boolean;
}) {
  if (isReturned) {
    return (
      <Badge className="bg-emerald-500/80 text-white border-emerald-400/80 hover:bg-emerald-500">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Returned
        </span>
      </Badge>
    );
  }

  if (isAnyPending) {
    return (
      <Badge className="bg-amber-500/80 text-white border-amber-400/80 hover:bg-amber-500">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          Pending
        </span>
      </Badge>
    );
  }

  if (hasLibrarianReturnRequest) {
    return (
      <Badge className="bg-rose-500/80 text-white border-rose-400/80 hover:bg-rose-500">
        <span className="inline-flex items-center gap-1">
          <BellRing className="h-3 w-3" />
          Return requested
        </span>
      </Badge>
    );
  }

  if (isOverdue) {
    return (
      <Badge className="bg-red-500/80 text-white border-red-400/80 hover:bg-red-500">
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </span>
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-500/80 text-white border-amber-400/80 hover:bg-amber-500">
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3 w-3" />
        Borrowed
      </span>
    </Badge>
  );
}

export default function StudentCirculationPage() {
  const [records, setRecords] = React.useState<BorrowRecordDTO[]>([]);
  const [fines, setFines] = React.useState<FineDTO[]>([]);
  const [serverNow, setServerNow] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [returnBusyId, setReturnBusyId] = React.useState<string | null>(null);

  const [extendBusyId, setExtendBusyId] = React.useState<string | null>(null);
  const [extendReasonById, setExtendReasonById] = React.useState<
    Record<string, string>
  >({});

  const loadAll = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [recordsSnapshot, finesData] = await Promise.all([
        fetchBorrowRecordsSnapshot(),
        fetchMyFines(),
      ]);

      setRecords(recordsSnapshot.records);
      setServerNow(recordsSnapshot.serverNow);
      setFines(finesData);
    } catch (err: any) {
      const msg =
        err?.message ||
        "Failed to load your circulation records. Please try again.";
      setError(msg);
      toast.error("Failed to load circulation", { description: msg });
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

  const filtered = React.useMemo(() => {
    let rows = [...records];

    if (statusFilter === "borrowed") {
      rows = rows.filter((r) => r.status !== "returned");
    } else if (statusFilter === "returned") {
      rows = rows.filter((r) => r.status === "returned");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const haystack = [
          r.bookTitle ?? "",
          r.bookId ?? "",
          r.studentName ?? "",
          r.status ?? "",
          r.returnRequestedByName ?? "",
          r.returnRequestNote ?? "",
          r.extensionRequestStatus ?? "",
          r.extensionRequestedReason ?? "",
          r.extensionDecisionNote ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    return rows.sort((a, b) => b.borrowDate.localeCompare(a.borrowDate));
  }, [records, statusFilter, search]);

  const activeBorrows = React.useMemo(
    () => records.filter((r) => r.status !== "returned"),
    [records]
  );

  const finesByBorrowId = React.useMemo(() => {
    const map: Record<string, FineDTO> = {};
    for (const f of fines) {
      if (f.borrowRecordId) {
        map[f.borrowRecordId] = f;
      }
    }
    return map;
  }, [fines]);

  const totalActiveFine = React.useMemo(
    () =>
      fines.reduce((sum, f) => {
        if (String((f as any).status) !== "active") return sum;
        const amount = normalizeFine(f.amount);
        return amount > 0 ? sum + amount : sum;
      }, 0),
    [fines]
  );

  const groupedByUser = React.useMemo(() => {
    const map = new Map<string, BorrowRecordDTO[]>();

    for (const r of filtered) {
      const name = (r.studentName ?? "").trim() || "You";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(r);
    }

    const groups = Array.from(map.entries()).map(([name, rows]) => {
      const activeCount = rows.filter((r) => r.status !== "returned").length;
      const returnedCount = rows.length - activeCount;
      return {
        key: name,
        name,
        rows,
        activeCount,
        returnedCount,
      };
    });

    groups.sort((a, b) => {
      if (a.name === "You" && b.name !== "You") return -1;
      if (b.name === "You" && a.name !== "You") return 1;
      return a.name.localeCompare(b.name);
    });

    return groups;
  }, [filtered]);

  async function handleRequestReturn(record: BorrowRecordDTO) {
    if (record.status !== "borrowed") {
      toast.info("Return request not needed", {
        description:
          record.status === "pending_return" || record.status === "pending"
            ? "This book already has a pending return request."
            : record.status === "pending_pickup"
              ? "This book is still pending pickup. Please get the book from the librarian first."
              : "This book is already marked as returned.",
      });
      return;
    }

    setReturnBusyId(record.id);
    try {
      const updated = await requestBorrowReturn(record.id);

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      toast.success("Return request submitted", {
        description:
          "Your online return request is now pending. Please bring the physical book to the librarian for verification.",
      });
    } catch (err: any) {
      const msg =
        err?.message ||
        "Could not submit your return request. Please try again later.";
      toast.error("Return request failed", { description: msg });
    } finally {
      setReturnBusyId(null);
    }
  }

  async function handleRequestExtension(record: BorrowRecordDTO) {
    if (record.status !== "borrowed") {
      toast.info("Extension not available", {
        description:
          record.status === "returned"
            ? "This record is already returned."
            : "Only records with status 'Borrowed' can be extended.",
      });
      return;
    }

    const currentReqStatus = (
      record.extensionRequestStatus ?? "none"
    ).toLowerCase();
    if (currentReqStatus === "pending") {
      toast.info("Extension already requested", {
        description:
          "You already have a pending extension request for this record.",
      });
      return;
    }

    const days = FIXED_EXTENSION_DAYS;
    const reason = (extendReasonById[record.id] ?? "").trim();

    setExtendBusyId(record.id);
    try {
      const res = await requestBorrowExtension(record.id, days, reason);
      const updated = res.record;

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      const newReqStatus = (
        updated.extensionRequestStatus ?? "none"
      ).toLowerCase();

      if (newReqStatus === "pending") {
        toast.success("Extension request submitted", {
          description:
            res.message ||
            `Requested +${updated.extensionRequestedDays ?? days} day(s). Waiting for librarian approval.`,
        });
      } else if (newReqStatus === "approved") {
        toast.success("Extension approved", {
          description: `New due date: ${fmtDate(updated.dueDate)}`,
        });
      } else {
        toast.success("Extension processed", {
          description:
            res.message || `Current due date: ${fmtDate(updated.dueDate)}`,
        });
      }
    } catch (err: any) {
      const msg =
        err?.message || "Could not request an extension. Please try again.";
      toast.error("Extension failed", { description: msg });
    } finally {
      setExtendBusyId(null);
    }
  }

  const actionButtonBaseClasses =
    "w-full min-h-9 h-auto py-2 whitespace-normal break-words leading-tight text-center";

  return (
    <DashboardLayout title="My Circulation">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Borrowed books (circulation)
            </h2>
            <p className="text-xs text-white/70">
              View your borrowed books, due dates, returns, extensions, and
              fines.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-xs text-white/70 sm:flex-row sm:items-center sm:text-sm">
          <div className="flex flex-col items-start sm:items-end">
            <span>
              Active borrows:{" "}
              <span className="font-semibold text-emerald-300">
                {activeBorrows.length}
              </span>
            </span>
            <span>
              Active fines (unpaid):{" "}
              <span className="font-semibold text-amber-300">
                {peso(totalActiveFine)}
              </span>
            </span>
          </div>

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

      <Card className="border-white/10 bg-slate-800/60">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Circulation history</CardTitle>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, status, or note…"
                  className="border-white/20 bg-slate-900/70 pl-9 text-white"
                />
              </div>

              <div className="w-full md:w-52">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger className="h-9 w-full border-white/20 bg-slate-900/70 text-white">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900 text-white">
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

          <p className="mt-2 text-[11px] text-white/60">
            Return requests and extension requests apply to{" "}
            <span className="font-semibold text-amber-200">Borrowed</span>{" "}
            records. Pending records are waiting for librarian confirmation.
          </p>

          <p className="mt-1 text-[11px] text-white/60">
            The{" "}
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Active fine
            </span>{" "}
            tag indicates an unpaid fine.
          </p>

          <p className="mt-1 text-[11px] text-white/60">
            The{" "}
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
              <BellRing className="h-3 w-3" />
              Return requested by librarian
            </span>{" "}
            tag means the librarian has asked you to bring back the physical
            book.
          </p>

          <p className="mt-1 text-[11px] text-white/60">
            Circulation timing now follows the server response clock instead of
            the current device clock.
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-red-300">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/70">
              No circulation records matched your filters.
              <br />
              <span className="text-xs opacity-80">
                Try clearing the search or changing the status filter.
              </span>
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
              </div>

              <Accordion
                type="multiple"
                className="space-y-3"
                defaultValue={
                  groupedByUser.length === 1 ? [groupedByUser[0].key] : []
                }
              >
                {groupedByUser.map((group) => (
                  <AccordionItem
                    key={group.key}
                    value={group.key}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-0"
                  >
                    <AccordionTrigger className="px-4 py-4 text-white hover:no-underline [&>svg]:mt-0.5">
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                                User
                              </span>
                              <span className="rounded-full border border-sky-300/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
                                {group.rows.length} total
                              </span>
                            </div>
                            <h3 className="wrap-break-word whitespace-normal text-sm font-semibold leading-snug text-white">
                              {group.name}
                            </h3>
                            <p className="text-xs text-white/60">
                              {group.activeCount} active • {group.returnedCount} returned
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-96">
                            <CirculationDetail
                              label="Active"
                              value={String(group.activeCount)}
                            />
                            <CirculationDetail
                              label="Returned"
                              value={String(group.returnedCount)}
                            />
                            <CirculationDetail
                              label="Total records"
                              value={String(group.rows.length)}
                            />
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="border-t border-white/10 px-4 pb-4 pt-4">
                      <div className="space-y-3">
                        {group.rows.map((record) => {
                          const isReturned = record.status === "returned";
                          const isBorrowed = record.status === "borrowed";
                          const isPendingPickup =
                            record.status === "pending_pickup";
                          const isPendingReturn =
                            record.status === "pending_return";
                          const isLegacyPending = record.status === "pending";
                          const isAnyPending =
                            isPendingPickup ||
                            isPendingReturn ||
                            isLegacyPending;

                          const linkedFine = finesByBorrowId[record.id];
                          const linkedFineStatus = linkedFine
                            ? String((linkedFine as any).status ?? "")
                            : "";

                          const fineAmountFromRecord = normalizeFine(
                            (record as any).fine
                          );
                          const finalFineAmount = linkedFine
                            ? normalizeFine(linkedFine.amount)
                            : fineAmountFromRecord;

                          const isActiveBorrow = isBorrowed || isAnyPending;
                          const overdueDays = computeOverdueDays(
                            record.dueDate,
                            serverNow
                          );
                          const isOverdue =
                            isActiveBorrow &&
                            (overdueDays > 0 || finalFineAmount > 0);

                          const extensionCount = (record.extensionCount ??
                            0) as number;
                          const extensionTotalDays =
                            (record.extensionTotalDays ?? 0) as number;
                          const lastExtensionDays =
                            record.lastExtensionDays ?? null;
                          const lastExtendedAt =
                            record.lastExtendedAt ?? null;

                          const reqStatus = (
                            record.extensionRequestStatus ?? "none"
                          ).toLowerCase();
                          const reqDays =
                            typeof record.extensionRequestedDays === "number"
                              ? record.extensionRequestedDays
                              : null;
                          const reqAt = record.extensionRequestedAt ?? null;
                          const decidedAt = record.extensionDecidedAt ?? null;
                          const extensionDecisionNote = (
                            record.extensionDecisionNote ?? ""
                          ).trim();

                          const extensionPending =
                            isBorrowed && reqStatus === "pending";

                          const librarianRequestNote = (
                            record.returnRequestNote ?? ""
                          ).trim();

                          const hasReturnRequestMetadata = Boolean(
                            record.returnRequestedAt ||
                              librarianRequestNote ||
                              record.returnRequestedByName ||
                              (record.returnRequestedBy !== null &&
                                record.returnRequestedBy !== undefined)
                          );

                          const isBorrowerReturnRequest = Boolean(
                            hasReturnRequestMetadata &&
                              record.returnRequestedBy !== null &&
                              record.returnRequestedBy !== undefined &&
                              String(record.returnRequestedBy) ===
                                String(record.userId)
                          );

                          const showLibrarianReturnRequest = Boolean(
                            !isReturned &&
                              hasReturnRequestMetadata &&
                              !isBorrowerReturnRequest
                          );

                          const librarianRequesterName =
                            record.returnRequestedByName?.trim() || "Librarian";

                          const detailValue = `record-${record.id}`;

                          return (
                            <Card
                              key={record.id}
                              className="overflow-hidden rounded-2xl border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 shadow-sm"
                            >
                              <Accordion type="single" collapsible>
                                <AccordionItem
                                  value={detailValue}
                                  className="border-0"
                                >
                                  <AccordionTrigger className="px-4 py-4 text-white hover:no-underline [&>svg]:mt-0.5">
                                    <div className="min-w-0 flex-1 text-left">
                                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="min-w-0 space-y-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                                              Borrow ID {record.id}
                                            </span>
                                            <RecordStatusBadge
                                              isReturned={isReturned}
                                              isAnyPending={isAnyPending}
                                              hasLibrarianReturnRequest={showLibrarianReturnRequest}
                                              isOverdue={isOverdue}
                                            />
                                            {linkedFine &&
                                            linkedFineStatus === "active" ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                                Active fine
                                              </span>
                                            ) : null}
                                          </div>

                                          <h3 className="wrap-break-word whitespace-normal text-sm font-semibold leading-snug text-white">
                                            {record.bookTitle ?? `Book #${record.bookId}`}
                                          </h3>

                                          <p className="text-xs text-white/60">
                                            Borrowed: {fmtDate(record.borrowDate)} • Due:{" "}
                                            {fmtDate(record.dueDate)} • Returned:{" "}
                                            {fmtDate(record.returnDate)}
                                          </p>
                                        </div>

                                        <div className="grid gap-2 sm:grid-cols-2 xl:min-w-96 xl:grid-cols-4">
                                          <CirculationDetail
                                            label="Borrowed"
                                            value={fmtDate(record.borrowDate)}
                                          />
                                          <CirculationDetail
                                            label="Due"
                                            value={fmtDate(record.dueDate)}
                                          />
                                          <CirculationDetail
                                            label="Returned"
                                            value={fmtDate(record.returnDate)}
                                          />
                                          <CirculationDetail
                                            label="Fine"
                                            value={peso(finalFineAmount)}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </AccordionTrigger>

                                  <AccordionContent className="border-t border-white/10 px-4 pb-4 pt-4">
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                      <CirculationDetail
                                        label="Borrow ID"
                                        value={record.id}
                                      />
                                      <CirculationDetail
                                        label="Book"
                                        value={record.bookTitle ?? `Book #${record.bookId}`}
                                      />
                                      <CirculationDetail
                                        label="Borrowed on"
                                        value={fmtDate(record.borrowDate)}
                                      />

                                      <CirculationDetail label="Due details">
                                        <div className="space-y-2 text-sm text-white/90">
                                          <div>{fmtDate(record.dueDate)}</div>

                                          {extensionCount > 0 ? (
                                            <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                                              <span className="h-1.5 w-1.5 rounded-full bg-sky-200" />
                                              Extended {extensionCount}× (+{extensionTotalDays}d)
                                            </div>
                                          ) : null}

                                          {extensionCount > 0 && lastExtendedAt ? (
                                            <div className="text-xs text-white/60">
                                              Last: {fmtDateTime(lastExtendedAt)}
                                              {typeof lastExtensionDays === "number"
                                                ? ` (+${lastExtensionDays}d)`
                                                : ""}
                                            </div>
                                          ) : null}

                                          {reqStatus === "pending" ? (
                                            <div className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                              Extension pending
                                              {typeof reqDays === "number"
                                                ? ` (+${reqDays}d)`
                                                : ""}
                                            </div>
                                          ) : null}

                                          {reqStatus === "approved" ? (
                                            <div className="text-xs text-white/60">
                                              Extension approved:{" "}
                                              {fmtDateTime(decidedAt ?? reqAt)}
                                            </div>
                                          ) : null}

                                          {reqStatus === "disapproved" ? (
                                            <div className="text-xs text-white/60">
                                              Extension disapproved:{" "}
                                              {fmtDateTime(decidedAt ?? reqAt)}
                                            </div>
                                          ) : null}

                                          {extensionDecisionNote ? (
                                            <ExtensionDecisionNotice
                                              status={reqStatus}
                                              decidedAt={decidedAt ?? reqAt}
                                              note={extensionDecisionNote}
                                              className="mt-1"
                                            />
                                          ) : null}
                                        </div>
                                      </CirculationDetail>

                                      <CirculationDetail
                                        label="Returned on"
                                        value={fmtDate(record.returnDate)}
                                      />

                                      <CirculationDetail label="Status">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <RecordStatusBadge
                                            isReturned={isReturned}
                                            isAnyPending={isAnyPending}
                                            hasLibrarianReturnRequest={showLibrarianReturnRequest}
                                            isOverdue={isOverdue}
                                          />
                                          {showLibrarianReturnRequest ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                                              <BellRing className="h-3 w-3" />
                                              Requested by librarian
                                            </span>
                                          ) : null}
                                        </div>
                                      </CirculationDetail>

                                      <CirculationDetail label="Fine summary">
                                        <div className="space-y-2">
                                          <div className="text-sm text-white/90">
                                            {peso(finalFineAmount)}
                                          </div>

                                          <div className="flex flex-wrap gap-2">
                                            {isActiveBorrow &&
                                            isOverdue &&
                                            finalFineAmount > 0 ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                                Accruing overdue fine
                                              </span>
                                            ) : null}

                                            {linkedFine &&
                                            linkedFineStatus === "active" ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                                Active fine (unpaid)
                                              </span>
                                            ) : null}

                                            {linkedFine &&
                                            linkedFineStatus ===
                                              "pending_verification" ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                                Awaiting librarian update
                                              </span>
                                            ) : null}

                                            {linkedFine &&
                                            linkedFineStatus === "paid" ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                                Fine paid
                                              </span>
                                            ) : null}

                                            {linkedFine &&
                                            linkedFineStatus === "cancelled" ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                                Fine cancelled
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      </CirculationDetail>

                                      <CirculationDetail
                                        label={
                                          showLibrarianReturnRequest
                                            ? "Librarian note"
                                            : isPendingReturn || isLegacyPending
                                              ? "Return request status"
                                              : "Librarian note"
                                        }
                                        className="xl:col-span-2"
                                      >
                                        {showLibrarianReturnRequest ? (
                                          <LibrarianReturnRequestNotice
                                            requesterName={librarianRequesterName}
                                            requestedAt={record.returnRequestedAt}
                                            note={librarianRequestNote}
                                          />
                                        ) : isPendingReturn || isLegacyPending ? (
                                          <BorrowerReturnRequestNotice
                                            requestedAt={record.returnRequestedAt}
                                          />
                                        ) : (
                                          <span className="text-xs text-white/50">
                                            No librarian note for this record.
                                          </span>
                                        )}
                                      </CirculationDetail>

                                      <CirculationDetail
                                        label="Actions"
                                        className="xl:col-span-3"
                                      >
                                        {isBorrowed ? (
                                          <div className="flex flex-col gap-2 lg:flex-row">
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  type="button"
                                                  className={
                                                    "bg-purple-600 text-white hover:bg-purple-700 lg:min-w-48 " +
                                                    actionButtonBaseClasses
                                                  }
                                                  disabled={returnBusyId === record.id}
                                                >
                                                  {returnBusyId === record.id ? (
                                                    <span className="inline-flex items-center gap-2">
                                                      <Loader2 className="h-4 w-4 animate-spin" />
                                                      Sending…
                                                    </span>
                                                  ) : showLibrarianReturnRequest ? (
                                                    "Respond with return request"
                                                  ) : (
                                                    "Request return"
                                                  )}
                                                </Button>
                                              </AlertDialogTrigger>

                                              <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>
                                                    Request to return this book?
                                                  </AlertDialogTitle>
                                                  <AlertDialogDescription className="text-white/70">
                                                    This will change the status to{" "}
                                                    <span className="font-semibold text-amber-200">
                                                      Pending
                                                    </span>
                                                    .
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>

                                                <div className="mt-3 space-y-1 text-sm text-white/80">
                                                  <p>
                                                    <span className="text-white/60">
                                                      Book:
                                                    </span>{" "}
                                                    <span className="font-semibold text-white">
                                                      {record.bookTitle ??
                                                        `Book #${record.bookId}`}
                                                    </span>
                                                  </p>
                                                  <p>
                                                    <span className="text-white/60">
                                                      Borrowed on:
                                                    </span>{" "}
                                                    {fmtDate(record.borrowDate)}
                                                  </p>
                                                  <p>
                                                    <span className="text-white/60">
                                                      Due date:
                                                    </span>{" "}
                                                    {fmtDate(record.dueDate)}
                                                  </p>

                                                  {showLibrarianReturnRequest ? (
                                                    <LibrarianReturnRequestNotice
                                                      requesterName={librarianRequesterName}
                                                      requestedAt={record.returnRequestedAt}
                                                      note={librarianRequestNote}
                                                      className="mt-2"
                                                    />
                                                  ) : null}

                                                  {finalFineAmount > 0 ? (
                                                    <p className="text-red-300">
                                                      Estimated fine if returned
                                                      today:{" "}
                                                      <span className="font-semibold">
                                                        {peso(finalFineAmount)}
                                                      </span>
                                                    </p>
                                                  ) : null}
                                                </div>

                                                <AlertDialogFooter>
                                                  <AlertDialogCancel
                                                    className="border-white/20 text-white hover:bg-black/20"
                                                    disabled={returnBusyId === record.id}
                                                  >
                                                    Cancel
                                                  </AlertDialogCancel>
                                                  <AlertDialogAction
                                                    className="bg-purple-600 text-white hover:bg-purple-700"
                                                    disabled={returnBusyId === record.id}
                                                    onClick={() =>
                                                      void handleRequestReturn(record)
                                                    }
                                                  >
                                                    {returnBusyId === record.id ? (
                                                      <span className="inline-flex items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Sending…
                                                      </span>
                                                    ) : (
                                                      "Submit request"
                                                    )}
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>

                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  className={
                                                    "border-sky-300/40 text-sky-200 hover:bg-sky-500/10 lg:min-w-48 " +
                                                    actionButtonBaseClasses
                                                  }
                                                  disabled={
                                                    extendBusyId === record.id ||
                                                    extensionPending
                                                  }
                                                  onClick={() => {
                                                    setExtendReasonById((prev) => ({
                                                      ...prev,
                                                      [record.id]:
                                                        prev[record.id] ?? "",
                                                    }));
                                                  }}
                                                >
                                                  {extensionPending ? (
                                                    "Extension pending"
                                                  ) : extendBusyId === record.id ? (
                                                    <span className="inline-flex items-center gap-2">
                                                      <Loader2 className="h-4 w-4 animate-spin" />
                                                      Sending…
                                                    </span>
                                                  ) : (
                                                    "Request extension"
                                                  )}
                                                </Button>
                                              </AlertDialogTrigger>

                                              <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>
                                                    Request due date extension
                                                  </AlertDialogTitle>
                                                  <AlertDialogDescription className="text-white/70">
                                                    Extension is fixed to{" "}
                                                    <span className="font-semibold text-sky-200">
                                                      +1 day
                                                    </span>{" "}
                                                    and cannot be changed.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>

                                                <div className="mt-3 space-y-3">
                                                  <div className="space-y-1 text-sm text-white/80">
                                                    <p>
                                                      <span className="text-white/60">
                                                        Current due date:
                                                      </span>{" "}
                                                      {fmtDate(record.dueDate)}
                                                    </p>

                                                    {extensionCount > 0 ? (
                                                      <p className="text-xs text-white/60">
                                                        Approved extensions:{" "}
                                                        <span className="font-semibold text-sky-200">
                                                          {extensionCount}×
                                                        </span>{" "}
                                                        (total +{extensionTotalDays} days)
                                                      </p>
                                                    ) : null}

                                                    {reqStatus === "pending" ? (
                                                      <p className="text-xs text-amber-200/90">
                                                        You already have a pending
                                                        request{" "}
                                                        {typeof reqDays === "number"
                                                          ? `(+${reqDays} days)`
                                                          : ""}{" "}
                                                        {reqAt
                                                          ? `submitted at ${fmtDateTime(
                                                              reqAt
                                                            )}.`
                                                          : "."}
                                                      </p>
                                                    ) : null}

                                                    {extensionDecisionNote ? (
                                                      <ExtensionDecisionNotice
                                                        status={reqStatus}
                                                        decidedAt={decidedAt ?? reqAt}
                                                        note={extensionDecisionNote}
                                                        className="mt-2"
                                                      />
                                                    ) : null}
                                                  </div>

                                                  <div className="rounded-md border border-sky-300/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                                                    Extension days:{" "}
                                                    <span className="font-semibold">
                                                      {FIXED_EXTENSION_DAYS} day
                                                    </span>{" "}
                                                    (fixed)
                                                  </div>

                                                  <div className="grid grid-cols-1 gap-2">
                                                    <label className="text-xs text-white/70">
                                                      Reason (optional)
                                                    </label>
                                                    <Input
                                                      value={
                                                        extendReasonById[record.id] ??
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        setExtendReasonById((prev) => ({
                                                          ...prev,
                                                          [record.id]:
                                                            e.target.value,
                                                        }))
                                                      }
                                                      placeholder="e.g. Research requirement"
                                                      className="border-white/20 bg-slate-950/60 text-white"
                                                      disabled={
                                                        extendBusyId === record.id ||
                                                        extensionPending
                                                      }
                                                    />
                                                  </div>
                                                </div>

                                                <AlertDialogFooter>
                                                  <AlertDialogCancel
                                                    className="border-white/20 text-white hover:bg-black/20"
                                                    disabled={extendBusyId === record.id}
                                                  >
                                                    Cancel
                                                  </AlertDialogCancel>
                                                  <AlertDialogAction
                                                    className="bg-sky-600 text-white hover:bg-sky-700"
                                                    disabled={
                                                      extendBusyId === record.id ||
                                                      extensionPending
                                                    }
                                                    onClick={() =>
                                                      void handleRequestExtension(record)
                                                    }
                                                  >
                                                    {extendBusyId === record.id ? (
                                                      <span className="inline-flex items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Submitting…
                                                      </span>
                                                    ) : extensionPending ? (
                                                      "Already pending"
                                                    ) : (
                                                      "Submit request"
                                                    )}
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        ) : isPendingReturn || isLegacyPending ? (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            disabled
                                            className={
                                              "border-amber-400/50 text-amber-200/80 lg:min-w-48 " +
                                              actionButtonBaseClasses
                                            }
                                          >
                                            Pending return
                                          </Button>
                                        ) : record.status === "pending_pickup" ? (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            disabled
                                            className={
                                              "border-amber-400/50 text-amber-200/80 lg:min-w-48 " +
                                              actionButtonBaseClasses
                                            }
                                          >
                                            Pending pickup
                                          </Button>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            disabled
                                            className={
                                              "border-white/20 text-white/60 lg:min-w-48 " +
                                              actionButtonBaseClasses
                                            }
                                          >
                                            Already returned
                                          </Button>
                                        )}
                                      </CirculationDetail>
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </Card>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}