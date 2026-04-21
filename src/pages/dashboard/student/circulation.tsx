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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowUpDown,
  BellRing,
  CheckCircle2,
  Clock3,
  Filter,
  Layers,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { BORROW_ROUTES } from "@/api/borrows/route";
import {
  requestBorrowExtension,
  requestBorrowReturn,
  syncBorrowEmailNotifications,
  type BorrowEmailNotificationSyncDTO,
  type BorrowRecordDTO,
} from "@/lib/borrows";
import { fetchMyFines, type FineDTO } from "@/lib/fines";

type StatusFilter = "all" | "active" | "overdue" | "pending" | "returned";
type SortOption =
  | "priority"
  | "due_asc"
  | "due_desc"
  | "borrow_newest"
  | "borrow_oldest";

type BorrowRecordsResponse = {
  ok?: boolean;
  records?: BorrowRecordDTO[];
  message?: string;
};

type EmailSyncState = {
  status: BorrowEmailNotificationSyncDTO | null;
  error: string | null;
  syncedAt: string | null;
};

type RecordSortMeta = {
  finalFineAmount: number;
  serverNow: string | null;
};

type CirculationRecordUiState = {
  linkedFineStatus: string;
  finalFineAmount: number;
  isReturned: boolean;
  isBorrowed: boolean;
  isPendingPickup: boolean;
  isPendingReturn: boolean;
  isLegacyPending: boolean;
  isAnyPending: boolean;
  isActiveBorrow: boolean;
  overdueDays: number;
  isOverdue: boolean;
  extensionCount: number;
  extensionTotalDays: number;
  lastExtensionDays: number | null;
  lastExtendedAt: string | null;
  reqStatus: string;
  reqDays: number | null;
  reqAt: string | null;
  decidedAt: string | null;
  extensionDecisionNote: string;
  extensionPending: boolean;
  librarianRequestNote: string;
  hasReturnRequestMetadata: boolean;
  isBorrowerReturnRequest: boolean;
  showLibrarianReturnRequest: boolean;
  librarianRequesterName: string;
};

export type StudentCirculationPageProps = {
  dashboardTitle?: string;
  heading?: string;
};

const FIXED_EXTENSION_DAYS = 1;
const APP_TIME_ZONE = "Asia/Manila";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 1000 * 60 * 60 * 24;
const MAX_SORT_TIME = Number.MAX_SAFE_INTEGER;

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

function getBorrowRecordCopyLabel(
  record: Pick<BorrowRecordDTO, "copyNumber" | "accessionNumber">
) {
  const parts: string[] = [];

  if (typeof record.copyNumber === "number" && Number.isFinite(record.copyNumber)) {
    parts.push(`Copy ${record.copyNumber}`);
  }

  const accessionNumber = String(record.accessionNumber ?? "").trim();
  if (accessionNumber) {
    parts.push(`Accession ${accessionNumber}`);
  }

  return parts.join(" • ");
}

function getBorrowRecordDisplayTitle(
  record: Pick<BorrowRecordDTO, "bookTitle" | "bookId" | "copyNumber" | "accessionNumber">
) {
  const baseTitle = record.bookTitle ?? `Book #${record.bookId}`;
  const copyLabel = getBorrowRecordCopyLabel(record);
  return copyLabel ? `${baseTitle} (${copyLabel})` : baseTitle;
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

function getDateSortValue(value?: string | null): number {
  if (!value) return MAX_SORT_TIME;

  if (isDateOnly(value)) {
    return dateOnlyToUtcMs(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return MAX_SORT_TIME;
  return parsed.getTime();
}

function getRecordSortPriority(
  record: BorrowRecordDTO,
  meta: RecordSortMeta
): number {
  const status = String(record.status ?? "").toLowerCase().trim();
  const isReturned = status === "returned";
  const isPendingPickup = status === "pending_pickup";
  const isPendingReturn = status === "pending_return" || status === "pending";
  const isBorrowed = status === "borrowed";
  const isActiveBorrow =
    !isReturned && (isBorrowed || isPendingPickup || isPendingReturn);
  const isOverdue =
    isActiveBorrow &&
    (computeOverdueDays(record.dueDate, meta.serverNow) > 0 ||
      meta.finalFineAmount > 0);

  if (isOverdue) return 0;
  if (isPendingPickup) return 1;
  if (isPendingReturn) return 2;
  if (isBorrowed) return 3;
  if (isReturned) return 5;
  return 4;
}

function compareBorrowRecords(
  a: BorrowRecordDTO,
  b: BorrowRecordDTO,
  metaById: Record<string, RecordSortMeta>
): number {
  const metaA = metaById[a.id] ?? { finalFineAmount: 0, serverNow: null };
  const metaB = metaById[b.id] ?? { finalFineAmount: 0, serverNow: null };

  const priorityDiff =
    getRecordSortPriority(a, metaA) - getRecordSortPriority(b, metaB);
  if (priorityDiff !== 0) return priorityDiff;

  const dueDiff = getDateSortValue(a.dueDate) - getDateSortValue(b.dueDate);
  if (dueDiff !== 0) return dueDiff;

  const borrowDiff =
    getDateSortValue(a.borrowDate) - getDateSortValue(b.borrowDate);
  if (borrowDiff !== 0) return borrowDiff;

  const returnDiff =
    getDateSortValue(a.returnDate) - getDateSortValue(b.returnDate);
  if (returnDiff !== 0) return returnDiff;

  return String(a.id).localeCompare(String(b.id));
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
    throw new Error(`Cannot reach the borrowed books API right now.${suffix}`);
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

function getRecordUiState(
  record: BorrowRecordDTO,
  linkedFine: FineDTO | undefined,
  serverNow: string | null
): CirculationRecordUiState {
  const status = String(record.status ?? "").toLowerCase().trim();
  const isReturned = status === "returned";
  const isBorrowed = status === "borrowed";
  const isPendingPickup = status === "pending_pickup";
  const isPendingReturn = status === "pending_return";
  const isLegacyPending = status === "pending";
  const isAnyPending = isPendingPickup || isPendingReturn || isLegacyPending;
  const linkedFineStatus = linkedFine
    ? String((linkedFine as any).status ?? "").toLowerCase()
    : "";

  const fineAmountFromRecord = normalizeFine((record as any).fine);
  const finalFineAmount = linkedFine
    ? normalizeFine(linkedFine.amount)
    : fineAmountFromRecord;

  const isActiveBorrow = !isReturned && (isBorrowed || isAnyPending);
  const overdueDays = computeOverdueDays(record.dueDate, serverNow);
  const isOverdue =
    isActiveBorrow && (overdueDays > 0 || finalFineAmount > 0);

  const extensionCount = Number(record.extensionCount ?? 0) || 0;
  const extensionTotalDays = Number(record.extensionTotalDays ?? 0) || 0;
  const lastExtensionDays =
    typeof record.lastExtensionDays === "number"
      ? record.lastExtensionDays
      : null;
  const lastExtendedAt = record.lastExtendedAt ?? null;

  const reqStatus = (record.extensionRequestStatus ?? "none")
    .toLowerCase()
    .trim();
  const reqDays =
    typeof record.extensionRequestedDays === "number"
      ? record.extensionRequestedDays
      : null;
  const reqAt = record.extensionRequestedAt ?? null;
  const decidedAt = record.extensionDecidedAt ?? null;
  const extensionDecisionNote = (record.extensionDecisionNote ?? "").trim();
  const extensionPending = isBorrowed && reqStatus === "pending";

  const librarianRequestNote = (record.returnRequestNote ?? "").trim();

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
      String(record.returnRequestedBy) === String(record.userId)
  );

  const showLibrarianReturnRequest = Boolean(
    !isReturned && hasReturnRequestMetadata && !isBorrowerReturnRequest
  );

  const librarianRequesterName =
    record.returnRequestedByName?.trim() || "Librarian";

  return {
    linkedFineStatus,
    finalFineAmount,
    isReturned,
    isBorrowed,
    isPendingPickup,
    isPendingReturn,
    isLegacyPending,
    isAnyPending,
    isActiveBorrow,
    overdueDays,
    isOverdue,
    extensionCount,
    extensionTotalDays,
    lastExtensionDays,
    lastExtendedAt,
    reqStatus,
    reqDays,
    reqAt,
    decidedAt,
    extensionDecisionNote,
    extensionPending,
    librarianRequestNote,
    hasReturnRequestMetadata,
    isBorrowerReturnRequest,
    showLibrarianReturnRequest,
    librarianRequesterName,
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

function CirculationStatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-500/5"
      : tone === "warning"
        ? "border-amber-400/20 bg-amber-500/5"
        : tone === "danger"
          ? "border-rose-400/20 bg-rose-500/5"
          : "border-white/10 bg-slate-800/60";

  const iconToneClasses =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-200"
      : tone === "warning"
        ? "bg-amber-500/15 text-amber-200"
        : tone === "danger"
          ? "bg-rose-500/15 text-rose-200"
          : "bg-white/10 text-white";

  return (
    <Card className={toneClasses}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-white/55">
            {label}
          </div>
          <div className="mt-2 text-xl font-semibold text-white">{value}</div>
        </div>
        <div
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconToneClasses}`.trim()}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
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
      <Badge className="border-emerald-400/80 bg-emerald-500/80 text-white hover:bg-emerald-500">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Returned
        </span>
      </Badge>
    );
  }

  if (isAnyPending) {
    return (
      <Badge className="border-amber-400/80 bg-amber-500/80 text-white hover:bg-amber-500">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          Pending
        </span>
      </Badge>
    );
  }

  if (hasLibrarianReturnRequest) {
    return (
      <Badge className="border-rose-400/80 bg-rose-500/80 text-white hover:bg-rose-500">
        <span className="inline-flex items-center gap-1">
          <BellRing className="h-3 w-3" />
          Return requested
        </span>
      </Badge>
    );
  }

  if (isOverdue) {
    return (
      <Badge className="border-red-400/80 bg-red-500/80 text-white hover:bg-red-500">
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </span>
      </Badge>
    );
  }

  return (
    <Badge className="border-amber-400/80 bg-amber-500/80 text-white hover:bg-amber-500">
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3 w-3" />
        Borrowed
      </span>
    </Badge>
  );
}

function CirculationFineBadges({ ui }: { ui: CirculationRecordUiState }) {
  return (
    <>
      {ui.isActiveBorrow && ui.isOverdue && ui.finalFineAmount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          Accruing overdue fine
        </span>
      ) : null}

      {ui.linkedFineStatus === "active" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          Active fine
        </span>
      ) : null}

      {ui.linkedFineStatus === "pending_verification" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          Awaiting librarian update
        </span>
      ) : null}

      {ui.linkedFineStatus === "paid" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Fine paid
        </span>
      ) : null}

      {ui.linkedFineStatus === "cancelled" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          Fine cancelled
        </span>
      ) : null}
    </>
  );
}

function CirculationRecordNotice({
  record,
  ui,
}: {
  record: BorrowRecordDTO;
  ui: CirculationRecordUiState;
}) {
  if (ui.showLibrarianReturnRequest) {
    return (
      <LibrarianReturnRequestNotice
        requesterName={ui.librarianRequesterName}
        requestedAt={record.returnRequestedAt}
        note={ui.librarianRequestNote}
      />
    );
  }

  if (ui.isPendingReturn || ui.isLegacyPending) {
    return (
      <BorrowerReturnRequestNotice requestedAt={record.returnRequestedAt} />
    );
  }

  if (ui.extensionDecisionNote) {
    return (
      <ExtensionDecisionNotice
        status={ui.reqStatus}
        decidedAt={ui.decidedAt ?? ui.reqAt}
        note={ui.extensionDecisionNote}
      />
    );
  }

  return null;
}

function CirculationDetailGrid({
  record,
  ui,
}: {
  record: BorrowRecordDTO;
  ui: CirculationRecordUiState;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <CirculationDetail label="Borrow ID" value={record.id} />
      <CirculationDetail
        label="Book"
        value={getBorrowRecordDisplayTitle(record)}
      />
      <CirculationDetail
        label="Borrower"
        value={record.studentName?.trim() || "You"}
      />
      <CirculationDetail label="Borrowed on" value={fmtDate(record.borrowDate)} />
      <CirculationDetail label="Due date">
        <div className="space-y-2">
          <div>{fmtDate(record.dueDate)}</div>

          {ui.extensionCount > 0 ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-200" />
              Extended {ui.extensionCount}× (+{ui.extensionTotalDays}d)
            </div>
          ) : null}

          {ui.extensionCount > 0 && ui.lastExtendedAt ? (
            <div className="text-xs text-white/60">
              Last: {fmtDateTime(ui.lastExtendedAt)}
              {typeof ui.lastExtensionDays === "number"
                ? ` (+${ui.lastExtensionDays}d)`
                : ""}
            </div>
          ) : null}

          {ui.reqStatus === "pending" ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Extension pending
              {typeof ui.reqDays === "number" ? ` (+${ui.reqDays}d)` : ""}
            </div>
          ) : null}

          {ui.reqStatus === "approved" ? (
            <div className="text-xs text-white/60">
              Extension approved: {fmtDateTime(ui.decidedAt ?? ui.reqAt)}
            </div>
          ) : null}

          {ui.reqStatus === "disapproved" ? (
            <div className="text-xs text-white/60">
              Extension disapproved: {fmtDateTime(ui.decidedAt ?? ui.reqAt)}
            </div>
          ) : null}

          {ui.extensionDecisionNote ? (
            <ExtensionDecisionNotice
              status={ui.reqStatus}
              decidedAt={ui.decidedAt ?? ui.reqAt}
              note={ui.extensionDecisionNote}
            />
          ) : null}
        </div>
      </CirculationDetail>

      <CirculationDetail label="Returned on" value={fmtDate(record.returnDate)} />

      <CirculationDetail label="Status">
        <div className="flex flex-wrap items-center gap-2">
          <RecordStatusBadge
            isReturned={ui.isReturned}
            isAnyPending={ui.isAnyPending}
            hasLibrarianReturnRequest={ui.showLibrarianReturnRequest}
            isOverdue={ui.isOverdue}
          />
          <CirculationFineBadges ui={ui} />
        </div>
      </CirculationDetail>

      <CirculationDetail label="Fine summary">
        <div className="space-y-2">
          <div className="text-sm text-white/90">{peso(ui.finalFineAmount)}</div>
          <div className="flex flex-wrap gap-2">
            <CirculationFineBadges ui={ui} />
          </div>
        </div>
      </CirculationDetail>

      <CirculationDetail label="Overdue">
        {ui.isOverdue ? (
          <span className="text-red-300">
            {ui.overdueDays > 0
              ? `${ui.overdueDays} day${ui.overdueDays === 1 ? "" : "s"} overdue`
              : "Overdue fine already recorded"}
          </span>
        ) : (
          <span className="text-white/60">Not overdue</span>
        )}
      </CirculationDetail>

      <CirculationDetail
        label={
          ui.showLibrarianReturnRequest
            ? "Librarian note"
            : ui.isPendingReturn || ui.isLegacyPending
              ? "Return request status"
              : "Latest note"
        }
        className="md:col-span-2 xl:col-span-2 2xl:col-span-2"
      >
        <CirculationRecordNotice record={record} ui={ui} />
      </CirculationDetail>
    </div>
  );
}

function CirculationRequestButtons({
  record,
  ui,
  returnBusyId,
  extendBusyId,
  extendReason,
  onExtendReasonChange,
  onRequestReturn,
  onRequestExtension,
  actionButtonBaseClasses,
  includeDetailsTrigger = false,
}: {
  record: BorrowRecordDTO;
  ui: CirculationRecordUiState;
  returnBusyId: string | null;
  extendBusyId: string | null;
  extendReason: string;
  onExtendReasonChange: (value: string) => void;
  onRequestReturn: (record: BorrowRecordDTO) => Promise<void>;
  onRequestExtension: (record: BorrowRecordDTO) => Promise<void>;
  actionButtonBaseClasses: string;
  includeDetailsTrigger?: boolean;
}) {
  const detailsTrigger = includeDetailsTrigger ? (
    <CirculationDetailsDialog
      record={record}
      ui={ui}
      returnBusyId={returnBusyId}
      extendBusyId={extendBusyId}
      extendReason={extendReason}
      onExtendReasonChange={onExtendReasonChange}
      onRequestReturn={onRequestReturn}
      onRequestExtension={onRequestExtension}
      actionButtonBaseClasses={actionButtonBaseClasses}
      triggerClassName={
        "border-white/20 text-white/90 hover:bg-white/10 " +
        actionButtonBaseClasses
      }
      triggerLabel="View details"
    />
  ) : null;

  if (ui.isBorrowed) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {detailsTrigger}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              className={
                "bg-purple-600 text-white hover:bg-purple-700 sm:min-w-44 " +
                actionButtonBaseClasses
              }
              disabled={returnBusyId === record.id}
            >
              {returnBusyId === record.id ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : ui.showLibrarianReturnRequest ? (
                "Respond to return request"
              ) : (
                "Request return"
              )}
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-900 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Request to return this book?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                This will change the status to{" "}
                <span className="font-semibold text-amber-200">Pending</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-3 space-y-2 text-sm text-white/80">
              <p>
                <span className="text-white/60">Book:</span>{" "}
                <span className="font-semibold text-white">
                  {getBorrowRecordDisplayTitle(record)}
                </span>
              </p>
              <p>
                <span className="text-white/60">Borrowed on:</span>{" "}
                {fmtDate(record.borrowDate)}
              </p>
              <p>
                <span className="text-white/60">Due date:</span>{" "}
                {fmtDate(record.dueDate)}
              </p>

              {ui.showLibrarianReturnRequest ? (
                <LibrarianReturnRequestNotice
                  requesterName={ui.librarianRequesterName}
                  requestedAt={record.returnRequestedAt}
                  note={ui.librarianRequestNote}
                  className="mt-2"
                />
              ) : null}

              {ui.finalFineAmount > 0 ? (
                <p className="text-red-300">
                  Estimated fine if returned today:{" "}
                  <span className="font-semibold">
                    {peso(ui.finalFineAmount)}
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
                onClick={() => void onRequestReturn(record)}
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
                "border-sky-300/40 text-sky-200 hover:bg-sky-500/10 sm:min-w-44 " +
                actionButtonBaseClasses
              }
              disabled={extendBusyId === record.id || ui.extensionPending}
            >
              {ui.extensionPending ? (
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

          <AlertDialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-900 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Request due date extension</AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                Extension is fixed to{" "}
                <span className="font-semibold text-sky-200">+1 day</span> and
                cannot be changed.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-3 space-y-3">
              <div className="space-y-1 text-sm text-white/80">
                <p>
                  <span className="text-white/60">Current due date:</span>{" "}
                  {fmtDate(record.dueDate)}
                </p>

                {ui.extensionCount > 0 ? (
                  <p className="text-xs text-white/60">
                    Approved extensions:{" "}
                    <span className="font-semibold text-sky-200">
                      {ui.extensionCount}×
                    </span>{" "}
                    (total +{ui.extensionTotalDays} days)
                  </p>
                ) : null}

                {ui.reqStatus === "pending" ? (
                  <p className="text-xs text-amber-200/90">
                    You already have a pending request
                    {typeof ui.reqDays === "number" ? ` (+${ui.reqDays} days)` : ""}
                    {ui.reqAt ? ` submitted at ${fmtDateTime(ui.reqAt)}.` : "."}
                  </p>
                ) : null}

                {ui.extensionDecisionNote ? (
                  <ExtensionDecisionNotice
                    status={ui.reqStatus}
                    decidedAt={ui.decidedAt ?? ui.reqAt}
                    note={ui.extensionDecisionNote}
                    className="mt-2"
                  />
                ) : null}
              </div>

              <div className="rounded-md border border-sky-300/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                Extension days:{" "}
                <span className="font-semibold">{FIXED_EXTENSION_DAYS} day</span>{" "}
                (fixed)
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-xs text-white/70">Reason (optional)</label>
                <Input
                  value={extendReason}
                  onChange={(e) => onExtendReasonChange(e.target.value)}
                  placeholder="e.g. Research requirement"
                  className="border-white/20 bg-slate-950/60 text-white"
                  disabled={extendBusyId === record.id || ui.extensionPending}
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
                disabled={extendBusyId === record.id || ui.extensionPending}
                onClick={() => void onRequestExtension(record)}
              >
                {extendBusyId === record.id ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </span>
                ) : ui.extensionPending ? (
                  "Already pending"
                ) : (
                  "Submit request"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (ui.isPendingReturn || ui.isLegacyPending) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {detailsTrigger}
        <Button
          type="button"
          variant="outline"
          disabled
          className={
            "border-amber-400/50 text-amber-200/80 sm:min-w-44 " +
            actionButtonBaseClasses
          }
        >
          Pending return
        </Button>
      </div>
    );
  }

  if (ui.isPendingPickup) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {detailsTrigger}
        <Button
          type="button"
          variant="outline"
          disabled
          className={
            "border-amber-400/50 text-amber-200/80 sm:min-w-44 " +
            actionButtonBaseClasses
          }
        >
          Pending pickup
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {detailsTrigger}
      <Button
        type="button"
        variant="outline"
        disabled
        className={
          "border-white/20 text-white/60 sm:min-w-44 " +
          actionButtonBaseClasses
        }
      >
        Already returned
      </Button>
    </div>
  );
}

function CirculationDetailsDialog({
  record,
  ui,
  returnBusyId,
  extendBusyId,
  extendReason,
  onExtendReasonChange,
  onRequestReturn,
  onRequestExtension,
  actionButtonBaseClasses,
  triggerClassName,
  triggerLabel = "View details",
}: {
  record: BorrowRecordDTO;
  ui: CirculationRecordUiState;
  returnBusyId: string | null;
  extendBusyId: string | null;
  extendReason: string;
  onExtendReasonChange: (value: string) => void;
  onRequestReturn: (record: BorrowRecordDTO) => Promise<void>;
  onRequestExtension: (record: BorrowRecordDTO) => Promise<void>;
  actionButtonBaseClasses: string;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={
            triggerClassName ||
            "border-white/20 text-white/90 hover:bg-white/10"
          }
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-950 text-white sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="pr-6 text-left">
            {getBorrowRecordDisplayTitle(record)}
          </DialogTitle>
          <DialogDescription className="text-left text-white/65">
            Borrow ID {record.id} • {record.studentName ?? "You"} • Due{" "}
            {fmtDate(record.dueDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(95svh-8rem)] overflow-y-auto pr-1">
          <div className="space-y-4">
            <CirculationDetailGrid record={record} ui={ui} />

            <CirculationDetail label="Actions">
              <CirculationRequestButtons
                record={record}
                ui={ui}
                returnBusyId={returnBusyId}
                extendBusyId={extendBusyId}
                extendReason={extendReason}
                onExtendReasonChange={onExtendReasonChange}
                onRequestReturn={onRequestReturn}
                onRequestExtension={onRequestExtension}
                actionButtonBaseClasses={actionButtonBaseClasses}
              />
            </CirculationDetail>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CirculationDesktopCard({
  record,
  ui,
  returnBusyId,
  extendBusyId,
  extendReason,
  onExtendReasonChange,
  onRequestReturn,
  onRequestExtension,
  actionButtonBaseClasses,
}: {
  record: BorrowRecordDTO;
  ui: CirculationRecordUiState;
  returnBusyId: string | null;
  extendBusyId: string | null;
  extendReason: string;
  onExtendReasonChange: (value: string) => void;
  onRequestReturn: (record: BorrowRecordDTO) => Promise<void>;
  onRequestExtension: (record: BorrowRecordDTO) => Promise<void>;
  actionButtonBaseClasses: string;
}) {
  return (
    <Card className="hidden overflow-hidden rounded-2xl border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 shadow-sm sm:block">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <RecordStatusBadge
                isReturned={ui.isReturned}
                isAnyPending={ui.isAnyPending}
                hasLibrarianReturnRequest={ui.showLibrarianReturnRequest}
                isOverdue={ui.isOverdue}
              />
              <CirculationFineBadges ui={ui} />
            </div>

            <h3 className="wrap-break-word whitespace-normal text-base font-semibold leading-snug text-white">
              {getBorrowRecordDisplayTitle(record)}
            </h3>
          </div>

          <div className="w-full max-w-sm lg:w-auto">
            <CirculationDetailsDialog
              record={record}
              ui={ui}
              returnBusyId={returnBusyId}
              extendBusyId={extendBusyId}
              extendReason={extendReason}
              onExtendReasonChange={onExtendReasonChange}
              onRequestReturn={onRequestReturn}
              onRequestExtension={onRequestExtension}
              actionButtonBaseClasses={actionButtonBaseClasses}
              triggerClassName={
                "border-white/20 text-white/90 hover:bg-white/10 " +
                actionButtonBaseClasses
              }
              triggerLabel="Details"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CirculationMobileCard({
  record,
  ui,
  returnBusyId,
  extendBusyId,
  extendReason,
  onExtendReasonChange,
  onRequestReturn,
  onRequestExtension,
  actionButtonBaseClasses,
}: {
  record: BorrowRecordDTO;
  ui: CirculationRecordUiState;
  returnBusyId: string | null;
  extendBusyId: string | null;
  extendReason: string;
  onExtendReasonChange: (value: string) => void;
  onRequestReturn: (record: BorrowRecordDTO) => Promise<void>;
  onRequestExtension: (record: BorrowRecordDTO) => Promise<void>;
  actionButtonBaseClasses: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 p-4 shadow-sm sm:hidden">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <RecordStatusBadge
            isReturned={ui.isReturned}
            isAnyPending={ui.isAnyPending}
            hasLibrarianReturnRequest={ui.showLibrarianReturnRequest}
            isOverdue={ui.isOverdue}
          />
          <CirculationFineBadges ui={ui} />
        </div>

        <h3 className="wrap-break-word whitespace-normal text-sm font-semibold leading-snug text-white">
          {getBorrowRecordDisplayTitle(record)}
        </h3>

        <CirculationDetailsDialog
          record={record}
          ui={ui}
          returnBusyId={returnBusyId}
          extendBusyId={extendBusyId}
          extendReason={extendReason}
          onExtendReasonChange={onExtendReasonChange}
          onRequestReturn={onRequestReturn}
          onRequestExtension={onRequestExtension}
          actionButtonBaseClasses={actionButtonBaseClasses}
          triggerClassName={
            "border-white/20 text-white/90 hover:bg-white/10 " +
            actionButtonBaseClasses
          }
          triggerLabel="Details"
        />
      </div>
    </div>
  );
}

export default function StudentCirculationPage({
  dashboardTitle = "My Borrowed Books"
}: StudentCirculationPageProps) {
  const [records, setRecords] = React.useState<BorrowRecordDTO[]>([]);
  const [fines, setFines] = React.useState<FineDTO[]>([]);
  const [serverNow, setServerNow] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [sortOption, setSortOption] = React.useState<SortOption>("priority");
  const [returnBusyId, setReturnBusyId] = React.useState<string | null>(null);
  const [extendBusyId, setExtendBusyId] = React.useState<string | null>(null);
  const [extendReasonById, setExtendReasonById] = React.useState<
    Record<string, string>
  >({});
  const [emailSyncState, setEmailSyncState] = React.useState<EmailSyncState>({
    status: null,
    error: null,
    syncedAt: null,
  });

  const runAutomaticEmailSync = React.useCallback(async () => {
    try {
      const sync = await syncBorrowEmailNotifications();
      setEmailSyncState({
        status: sync,
        error: null,
        syncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const msg =
        err?.message ||
        "Automatic email reminders are currently unavailable for your account.";
      setEmailSyncState((prev) => ({
        status: prev.status,
        error: msg,
        syncedAt: prev.syncedAt,
      }));
    }
  }, []);

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

      void runAutomaticEmailSync();
    } catch (err: any) {
      const msg =
        err?.message ||
        "Failed to load your borrowed books. Please try again.";
      setError(msg);
      toast.error("Failed to load borrowed books", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [runAutomaticEmailSync]);

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

  const finesByBorrowId = React.useMemo(() => {
    const map: Record<string, FineDTO> = {};
    for (const fine of fines) {
      if (fine.borrowRecordId) {
        map[fine.borrowRecordId] = fine;
      }
    }
    return map;
  }, [fines]);

  const recordUiById = React.useMemo(() => {
    const map: Record<string, CirculationRecordUiState> = {};
    for (const record of records) {
      map[record.id] = getRecordUiState(
        record,
        finesByBorrowId[record.id],
        serverNow
      );
    }
    return map;
  }, [records, finesByBorrowId, serverNow]);

  const filteredRecords = React.useMemo(() => {
    let rows = [...records];

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((record) => {
        const haystack = [
          getBorrowRecordDisplayTitle(record),
          getBorrowRecordCopyLabel(record),
          record.bookTitle ?? "",
          record.bookId ?? "",
          record.studentName ?? "",
          record.status ?? "",
          record.returnRequestedByName ?? "",
          record.returnRequestNote ?? "",
          record.extensionRequestStatus ?? "",
          record.extensionRequestedReason ?? "",
          record.extensionDecisionNote ?? "",
          record.id ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    if (statusFilter !== "all") {
      rows = rows.filter((record) => {
        const ui = recordUiById[record.id];
        if (!ui) return false;

        if (statusFilter === "active") return !ui.isReturned;
        if (statusFilter === "overdue") return ui.isOverdue && !ui.isReturned;
        if (statusFilter === "pending") return ui.isAnyPending;
        if (statusFilter === "returned") return ui.isReturned;
        return true;
      });
    }

    const metaById: Record<string, RecordSortMeta> = {};
    for (const row of rows) {
      const ui = recordUiById[row.id];
      metaById[row.id] = {
        finalFineAmount: ui?.finalFineAmount ?? 0,
        serverNow,
      };
    }

    rows.sort((a, b) => {
      if (sortOption === "due_asc") {
        return getDateSortValue(a.dueDate) - getDateSortValue(b.dueDate);
      }

      if (sortOption === "due_desc") {
        return getDateSortValue(b.dueDate) - getDateSortValue(a.dueDate);
      }

      if (sortOption === "borrow_newest") {
        return getDateSortValue(b.borrowDate) - getDateSortValue(a.borrowDate);
      }

      if (sortOption === "borrow_oldest") {
        return getDateSortValue(a.borrowDate) - getDateSortValue(b.borrowDate);
      }

      return compareBorrowRecords(a, b, metaById);
    });

    return rows;
  }, [records, search, statusFilter, sortOption, recordUiById, serverNow]);

  const activeRecords = React.useMemo(
    () => filteredRecords.filter((record) => !recordUiById[record.id]?.isReturned),
    [filteredRecords, recordUiById]
  );

  const returnedRecords = React.useMemo(
    () => filteredRecords.filter((record) => recordUiById[record.id]?.isReturned),
    [filteredRecords, recordUiById]
  );

  const dashboardSummary = React.useMemo(() => {
    return records.reduce(
      (acc, record) => {
        const ui = recordUiById[record.id];
        if (!ui) return acc;

        if (!ui.isReturned) acc.activeCount += 1;
        if (ui.isReturned) acc.returnedCount += 1;
        if (ui.isAnyPending) acc.pendingCount += 1;
        if (ui.isOverdue && !ui.isReturned) acc.overdueCount += 1;
        if (ui.finalFineAmount > 0) acc.totalRecordedFine += ui.finalFineAmount;
        return acc;
      },
      {
        activeCount: 0,
        returnedCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        totalRecordedFine: 0,
      }
    );
  }, [records, recordUiById]);

  const totalActiveFine = React.useMemo(
    () =>
      fines.reduce((sum, fine) => {
        if (String((fine as any).status ?? "").toLowerCase() !== "active") {
          return sum;
        }
        const amount = normalizeFine(fine.amount);
        return amount > 0 ? sum + amount : sum;
      }, 0),
    [fines]
  );

  const latestBorrowerEmailSync = emailSyncState.status;
  const borrowerEmailSyncStatusLabel = emailSyncState.error
    ? "Automatic reminders unavailable"
    : latestBorrowerEmailSync?.suppressed
      ? "Email reminders currently suppressed"
      : latestBorrowerEmailSync?.emailSent
        ? "Automatic reminders active"
        : latestBorrowerEmailSync
          ? "No new reminder email was needed"
          : "Checking automatic reminders";

  const clearControls = React.useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setSortOption("priority");
  }, []);

  const hasControlsApplied =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    sortOption !== "priority";

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
      setRecords((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

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
      const response = await requestBorrowExtension(record.id, days, reason);
      const updated = response.record;

      setRecords((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

      const newReqStatus = (
        updated.extensionRequestStatus ?? "none"
      ).toLowerCase();

      if (newReqStatus === "pending") {
        toast.success("Extension request submitted", {
          description:
            response.message ||
            `Requested +${updated.extensionRequestedDays ?? days} day(s). Waiting for librarian approval.`,
        });
      } else if (newReqStatus === "approved") {
        toast.success("Extension approved", {
          description: `New due date: ${fmtDate(updated.dueDate)}`,
        });
      } else {
        toast.success("Extension processed", {
          description:
            response.message || `Current due date: ${fmtDate(updated.dueDate)}`,
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
    <DashboardLayout title={dashboardTitle}>
      <div className="w-full overflow-x-hidden">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
          </div>

          <div className="flex flex-col gap-2 text-xs text-white/70 sm:flex-row sm:items-center sm:text-sm">
            <div className="flex flex-col items-start sm:items-end">
              <span>
                Active borrows:{" "}
                <span className="font-semibold text-emerald-300">
                  {dashboardSummary.activeCount}
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

        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CirculationStatCard
            icon={Layers}
            label="Active records"
            value={dashboardSummary.activeCount}
            tone="default"
          />
          <CirculationStatCard
            icon={AlertTriangle}
            label="Overdue"
            value={dashboardSummary.overdueCount}
            tone="danger"
          />
          <CirculationStatCard
            icon={Clock3}
            label="Pending"
            value={dashboardSummary.pendingCount}
            tone="warning"
          />
          <CirculationStatCard
            icon={CheckCircle2}
            label="Returned"
            value={dashboardSummary.returnedCount}
            tone="success"
          />
        </div>

        <Card className="mb-4 border-white/10 bg-slate-800/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-white/55">
                  Email status
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {borrowerEmailSyncStatusLabel}
                </div>
              </div>

              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                {latestBorrowerEmailSync?.recipient || "Recipient not available"}
              </Badge>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <CirculationDetail
                label="Due today"
                value={String(latestBorrowerEmailSync?.dueTodayCount ?? 0)}
              />
              <CirculationDetail
                label="Overdue"
                value={String(latestBorrowerEmailSync?.overdueCount ?? 0)}
              />
              <CirculationDetail
                label="Return requests"
                value={String(latestBorrowerEmailSync?.pendingReturnCount ?? 0)}
              />
            </div>

            <p className="mt-2 text-[11px] text-white/45">
              Last checked:{" "}
              {emailSyncState.syncedAt
                ? fmtDateTime(emailSyncState.syncedAt)
                : "Waiting for automatic check"}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4 border-white/10 bg-slate-800/60">
          <CardHeader className="pb-2">
            <CardTitle>Find and organize records</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative w-full xl:flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, borrow ID, status, or note…"
                  className="border-white/20 bg-slate-900/70 pl-9 text-white"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-2">
                <div className="w-full xl:min-w-52">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger className="h-9 w-full border-white/20 bg-slate-900/70 text-white">
                      <div className="inline-flex items-center gap-2">
                        <Filter className="h-4 w-4 text-white/50" />
                        <SelectValue placeholder="Filter status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="all">All records</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="overdue">Overdue only</SelectItem>
                      <SelectItem value="pending">Pending only</SelectItem>
                      <SelectItem value="returned">Returned only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full xl:min-w-52">
                  <Select
                    value={sortOption}
                    onValueChange={(value) => setSortOption(value as SortOption)}
                  >
                    <SelectTrigger className="h-9 w-full border-white/20 bg-slate-900/70 text-white">
                      <div className="inline-flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4 text-white/50" />
                        <SelectValue placeholder="Sort records" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="priority">Priority order</SelectItem>
                      <SelectItem value="due_asc">Due date: earliest first</SelectItem>
                      <SelectItem value="due_desc">Due date: latest first</SelectItem>
                      <SelectItem value="borrow_newest">
                        Borrowed: newest first
                      </SelectItem>
                      <SelectItem value="borrow_oldest">
                        Borrowed: oldest first
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Layers className="h-3.5 w-3.5" />
                {filteredRecords.length} matching{" "}
                {filteredRecords.length === 1 ? "record" : "records"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Clock3 className="h-3.5 w-3.5" />
                Server clock: {serverNow ? fmtDateTime(serverNow) : "Waiting"}
              </span>
              {hasControlsApplied ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-white/20 text-white/80 hover:bg-white/10"
                  onClick={clearControls}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear controls
                </Button>
              ) : null}
            </div>

          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-800/60">
          <CardHeader className="pb-2">
            <CardTitle>Active circulation</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-28 w-full rounded-2xl" />
              </div>
            ) : error ? (
              <div className="py-6 text-center text-sm text-red-300">{error}</div>
            ) : activeRecords.length === 0 ? (
              <div className="py-10 text-center text-sm text-white/70">
                No active circulation records matched your controls.
              </div>
            ) : (
              <section className="space-y-2">
                <div className="space-y-3 sm:hidden">
                  {activeRecords.map((record) => {
                    const ui = recordUiById[record.id];
                    return (
                      <CirculationMobileCard
                        key={record.id}
                        record={record}
                        ui={ui}
                        returnBusyId={returnBusyId}
                        extendBusyId={extendBusyId}
                        extendReason={extendReasonById[record.id] ?? ""}
                        onExtendReasonChange={(value) =>
                          setExtendReasonById((prev) => ({
                            ...prev,
                            [record.id]: value,
                          }))
                        }
                        onRequestReturn={handleRequestReturn}
                        onRequestExtension={handleRequestExtension}
                        actionButtonBaseClasses={actionButtonBaseClasses}
                      />
                    );
                  })}
                </div>

                <div className="hidden space-y-3 sm:block">
                  {activeRecords.map((record) => {
                    const ui = recordUiById[record.id];
                    return (
                      <CirculationDesktopCard
                        key={record.id}
                        record={record}
                        ui={ui}
                        returnBusyId={returnBusyId}
                        extendBusyId={extendBusyId}
                        extendReason={extendReasonById[record.id] ?? ""}
                        onExtendReasonChange={(value) =>
                          setExtendReasonById((prev) => ({
                            ...prev,
                            [record.id]: value,
                          }))
                        }
                        onRequestReturn={handleRequestReturn}
                        onRequestExtension={handleRequestExtension}
                        actionButtonBaseClasses={actionButtonBaseClasses}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </CardContent>
        </Card>

        {(!loading && !error && returnedRecords.length > 0) ||
        (!loading && !error && statusFilter === "returned") ? (
          <Card className="mt-4 border-emerald-400/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-emerald-100">
                Returned history
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {returnedRecords.length === 0 ? (
                <div className="py-8 text-center text-sm text-emerald-100/70">
                  No returned records matched your current controls.
                </div>
              ) : (
                <section className="space-y-2">
                  <div className="space-y-3 sm:hidden">
                    {returnedRecords.map((record) => {
                      const ui = recordUiById[record.id];
                      return (
                        <CirculationMobileCard
                          key={record.id}
                          record={record}
                          ui={ui}
                          returnBusyId={returnBusyId}
                          extendBusyId={extendBusyId}
                          extendReason={extendReasonById[record.id] ?? ""}
                          onExtendReasonChange={(value) =>
                            setExtendReasonById((prev) => ({
                              ...prev,
                              [record.id]: value,
                            }))
                          }
                          onRequestReturn={handleRequestReturn}
                          onRequestExtension={handleRequestExtension}
                          actionButtonBaseClasses={actionButtonBaseClasses}
                        />
                      );
                    })}
                  </div>

                  <div className="hidden space-y-3 sm:block">
                    {returnedRecords.map((record) => {
                      const ui = recordUiById[record.id];
                      return (
                        <CirculationDesktopCard
                          key={record.id}
                          record={record}
                          ui={ui}
                          returnBusyId={returnBusyId}
                          extendBusyId={extendBusyId}
                          extendReason={extendReasonById[record.id] ?? ""}
                          onExtendReasonChange={(value) =>
                            setExtendReasonById((prev) => ({
                              ...prev,
                              [record.id]: value,
                            }))
                          }
                          onRequestReturn={handleRequestReturn}
                          onRequestExtension={handleRequestExtension}
                          actionButtonBaseClasses={actionButtonBaseClasses}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error ? (
          <div className="mt-4 text-[11px] text-white/50">
            Total recorded fine across all visible records:{" "}
            <span className="font-semibold text-white/75">
              {peso(
                filteredRecords.reduce((sum, record) => {
                  return sum + (recordUiById[record.id]?.finalFineAmount ?? 0);
                }, 0)
              )}
            </span>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}