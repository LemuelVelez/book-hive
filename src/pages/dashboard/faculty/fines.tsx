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
  BookOpen,
  CheckCircle2,
  Filter,
  Layers,
  Loader2,
  ReceiptText,
  RefreshCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMyFines, type FineDTO, type FineStatus } from "@/lib/fines";
import {
  fetchMyDamageReports,
  type DamageReportDTO,
} from "@/lib/damageReports";

type StatusFilter = "all" | FineStatus;
type SortOption =
  | "priority"
  | "amount_desc"
  | "amount_asc"
  | "created_desc"
  | "created_asc";

type DamageReportRow = DamageReportDTO & {
  photoUrl?: string | null;
};

type FineUiState = {
  status: FineStatus;
  amount: number;
  isActive: boolean;
  isPaid: boolean;
  isCancelled: boolean;
  isDamage: boolean;
  isOverdue: boolean;
  overdueDays: number | null;
  primaryLabel: string;
  reasonText: string;
  damageReportId?: string;
  damageDescription: string;
  referenceEndDate: string | null;
};

const APP_TIME_ZONE = "Asia/Manila";

async function fetchDamageReportsForFines(): Promise<DamageReportRow[]> {
  const reports = await fetchMyDamageReports();
  if (!Array.isArray(reports)) return [];
  return reports as DamageReportRow[];
}

function enrichFinesWithDamageReports(
  fines: FineDTO[],
  reports: DamageReportRow[]
): FineDTO[] {
  if (!fines.length || !reports.length) return fines;

  const damageMap = new Map<string, DamageReportRow>();
  for (const report of reports) {
    damageMap.set(String(report.id), report);
  }

  return fines.map((fine) => {
    const anyFine = fine as any;
    const damageKey =
      anyFine.damageReportId ?? anyFine.damageId ?? anyFine.damageReportID ?? null;

    if (damageKey == null) return fine;

    const report = damageMap.get(String(damageKey));
    if (!report) return fine;

    const currentTitle =
      typeof fine.bookTitle === "string" ? fine.bookTitle.trim() : "";

    const merged: FineDTO = {
      ...fine,
      bookTitle:
        currentTitle &&
        currentTitle.length > 0 &&
        currentTitle.toLowerCase() !== "general fine"
          ? fine.bookTitle
          : (report.bookTitle ?? fine.bookTitle),
      bookId: (fine.bookId ?? report.bookId) as any,
    };

    const mergedAny = merged as any;

    if (mergedAny.damageReportId == null) {
      mergedAny.damageReportId = report.id;
    }

    const existingDamageDescription =
      mergedAny.damageDescription ||
      mergedAny.damageDetails ||
      mergedAny.damageType;

    if (!existingDamageDescription) {
      const notes = report.notes && String(report.notes).trim();
      const damageType =
        (report as any).damageType && String((report as any).damageType).trim();

      if (notes) {
        mergedAny.damageDescription = notes;
      } else if (damageType) {
        mergedAny.damageDescription = damageType;
      }
    }

    return merged;
  });
}

function normalizeStatus(raw: any): FineStatus {
  const value = String(raw ?? "").toLowerCase().trim();
  if (value === "paid") return "paid";
  if (value === "cancelled") return "cancelled";
  return "active";
}

function normalizeFine(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";

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

function fmtDateTime(value?: string | null) {
  if (!value) return "—";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

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
    return value;
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

function computeOverdueDays(
  dueDate?: string | null,
  endDate?: string | null
): number | null {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(end.getTime())) return null;

  const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diffMs = endLocal.getTime() - dueLocal.getTime();
  const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return rawDays > 0 ? rawDays : 0;
}

function overdueDaysLabel(days: number | null): string {
  if (days == null) return "—";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function isDamageFine(fine: FineDTO): boolean {
  const anyFine = fine as any;
  const reason = (fine.reason || "").toLowerCase();

  return Boolean(
    fine.damageReportId ||
      anyFine.damageId ||
      anyFine.damageType ||
      anyFine.damageDescription ||
      anyFine.damageDetails ||
      reason.includes("damage") ||
      reason.includes("lost book")
  );
}

function getFinePrimaryLabel(fine: FineDTO): string {
  const rawTitle = fine.bookTitle;
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";

  const rawReason = (fine as any).reason;
  const reason = typeof rawReason === "string" ? rawReason.trim() : "";

  if (title && title.toLowerCase() !== "general fine") {
    return title;
  }

  if (reason) {
    return reason;
  }

  if (title) {
    return title;
  }

  if ((fine as any).borrowRecordId != null) {
    return `General fine for borrow #${(fine as any).borrowRecordId}`;
  }

  return "General fine";
}

function getDateSortValue(value?: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getFineReferenceEndDate(
  fine: FineDTO,
  status: FineStatus
): string | null {
  if (fine.borrowReturnDate) return fine.borrowReturnDate;

  if (status !== "active") {
    return (fine as any).resolvedAt ?? fine.createdAt ?? null;
  }

  return new Date().toISOString();
}

function getFineSortRank(fine: FineDTO): number {
  const status = normalizeStatus((fine as any).status);
  const damage = isDamageFine(fine);
  const overdueDays = computeOverdueDays(
    fine.borrowDueDate ?? null,
    getFineReferenceEndDate(fine, status)
  );

  if (status === "active") {
    if (!damage && (overdueDays ?? 0) > 0) return 0;
    if (damage) return 1;
    return 2;
  }

  if (status === "paid") return 3;
  return 4;
}

function compareFinesByPriority(a: FineDTO, b: FineDTO): number {
  const rankDiff = getFineSortRank(a) - getFineSortRank(b);
  if (rankDiff !== 0) return rankDiff;

  const statusA = normalizeStatus((a as any).status);
  const statusB = normalizeStatus((b as any).status);

  const overdueA =
    computeOverdueDays(a.borrowDueDate ?? null, getFineReferenceEndDate(a, statusA)) ??
    0;
  const overdueB =
    computeOverdueDays(b.borrowDueDate ?? null, getFineReferenceEndDate(b, statusB)) ??
    0;
  const overdueDiff = overdueB - overdueA;
  if (overdueDiff !== 0) return overdueDiff;

  const amountDiff = normalizeFine(b.amount) - normalizeFine(a.amount);
  if (amountDiff !== 0) return amountDiff;

  return getDateSortValue(b.createdAt ?? null) - getDateSortValue(a.createdAt ?? null);
}

function getFineUiState(fine: FineDTO): FineUiState {
  const anyFine = fine as any;
  const status = normalizeStatus(anyFine.status);
  const amount = normalizeFine(fine.amount);
  const isDamage = isDamageFine(fine);
  const primaryLabel = getFinePrimaryLabel(fine);
  const reasonText = typeof fine.reason === "string" ? fine.reason.trim() : "";
  const damageReportId = (
    fine.damageReportId ?? anyFine.damageId ?? anyFine.damageReportId
  )?.toString();
  const damageDescription =
    String(
      anyFine.damageDescription || anyFine.damageDetails || anyFine.damageType || ""
    ).trim();
  const referenceEndDate = getFineReferenceEndDate(fine, status);
  const overdueDays = computeOverdueDays(fine.borrowDueDate ?? null, referenceEndDate);
  const isActive = status === "active";
  const isPaid = status === "paid";
  const isCancelled = status === "cancelled";
  const isOverdue = isActive && !isDamage && (overdueDays ?? 0) > 0;

  return {
    status,
    amount,
    isActive,
    isPaid,
    isCancelled,
    isDamage,
    isOverdue,
    overdueDays,
    primaryLabel,
    reasonText,
    damageReportId,
    damageDescription,
    referenceEndDate,
  };
}

function FineDetail({
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
    <div className={`rounded-xl border border-white/10 bg-black/20 p-3 ${className}`.trim()}>
      <div className="text-[11px] uppercase tracking-wide text-white/55">{label}</div>
      <div className="mt-1 text-sm text-white/90 wrap-break-word">
        {children ?? value ?? "—"}
      </div>
    </div>
  );
}

function FineStatCard({
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
          <div className="text-[11px] uppercase tracking-wide text-white/55">{label}</div>
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

function FineStatusBadge({ ui }: { ui: FineUiState }) {
  if (ui.isPaid) {
    return (
      <Badge className="border-emerald-400/80 bg-emerald-500/80 text-white hover:bg-emerald-500">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Paid
        </span>
      </Badge>
    );
  }

  if (ui.isCancelled) {
    return (
      <Badge className="border-slate-400/80 bg-slate-500/80 text-white hover:bg-slate-500">
        <span className="inline-flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Cancelled
        </span>
      </Badge>
    );
  }

  return (
    <Badge className="border-amber-400/80 bg-amber-500/80 text-white hover:bg-amber-500">
      <span className="inline-flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Active (unpaid)
      </span>
    </Badge>
  );
}

function FineTypeBadges({ ui }: { ui: FineUiState }) {
  return (
    <>
      {ui.isDamage && ui.isActive ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
          Damage fine
        </span>
      ) : !ui.isDamage ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
          Borrow-based fine
        </span>
      ) : null}

      {ui.isOverdue ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          {overdueDaysLabel(ui.overdueDays)} overdue
        </span>
      ) : null}
    </>
  );
}

function FinePaymentAction({
  fine,
  ui,
  className = "",
}: {
  fine: FineDTO;
  ui: FineUiState;
  className?: string;
}) {
  if (ui.isActive) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            className={
              "bg-emerald-600 text-white hover:bg-emerald-700 " + className
            }
          >
            How to pay (OTC)
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-900 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Pay over the counter</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Online payments are not available. Please pay this fine physically at
              the library counter.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-3 space-y-2 text-sm text-white/80">
            <p>
              <span className="text-white/60">Fine ID:</span> {fine.id}
            </p>
            <p>
              <span className="text-white/60">Amount:</span>{" "}
              <span className="font-semibold text-amber-200">{peso(ui.amount)}</span>
            </p>
            {!ui.isDamage && ui.overdueDays != null ? (
              <p>
                <span className="text-white/60">Days:</span>{" "}
                <span className="font-semibold">{overdueDaysLabel(ui.overdueDays)}</span>
              </p>
            ) : null}
            {fine.bookTitle ? (
              <p>
                <span className="text-white/60">Book:</span> {fine.bookTitle}
              </p>
            ) : null}
            {fine.borrowRecordId ? (
              <p>
                <span className="text-white/60">Borrow ID:</span> {fine.borrowRecordId}
              </p>
            ) : null}
            {ui.damageReportId ? (
              <p>
                <span className="text-white/60">Damage report:</span> #{ui.damageReportId}
              </p>
            ) : null}

            <div className="mt-3 space-y-1 rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/80">
              <p className="font-semibold text-emerald-200">Steps</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Go to the library counter.</li>
                <li>Provide your Fine ID and related reference to the librarian.</li>
                <li>Pay the amount shown.</li>
                <li>Refresh this page later to see the status update to Paid.</li>
              </ol>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
              Close
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-slate-700 text-white hover:bg-slate-600"
              onClick={() =>
                toast.info("Over-the-counter payment", {
                  description:
                    "Please proceed to the library counter to pay this fine.",
                })
              }
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (ui.isPaid) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className={
          "border-emerald-400/50 text-emerald-200/90 " + className
        }
      >
        Fine paid
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled
      className={"border-slate-400/50 text-slate-200/90 " + className}
    >
      Fine cancelled
    </Button>
  );
}

function FineDetailGrid({ fine, ui }: { fine: FineDTO; ui: FineUiState }) {
  const referenceLabel = fine.borrowRecordId
    ? "Borrow ID"
    : ui.damageReportId
      ? "Damage report"
      : "Reference";

  const referenceValue = fine.borrowRecordId
    ? fine.borrowRecordId
    : ui.damageReportId
      ? `#${ui.damageReportId}`
      : "No linked record";

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <FineDetail label="Fine ID" value={fine.id} />
      <FineDetail label="Title / label" value={ui.primaryLabel} />
      <FineDetail label="Amount" value={peso(ui.amount)} />
      <FineDetail label="Created" value={fmtDateTime(fine.createdAt)} />
      <FineDetail label="Status">
        <div className="flex flex-wrap items-center gap-2">
          <FineStatusBadge ui={ui} />
          <FineTypeBadges ui={ui} />
        </div>
      </FineDetail>
      <FineDetail label="Reason" value={ui.reasonText || "—"} />
      <FineDetail label={referenceLabel} value={referenceValue} />
      <FineDetail label="Due date" value={fmtDate(fine.borrowDueDate)} />
      <FineDetail label="Return / resolved" value={fmtDate(fine.borrowReturnDate ?? ui.referenceEndDate)} />
      <FineDetail label="Overdue">
        {ui.isDamage ? (
          <span className="text-white/60">Damage-related fine</span>
        ) : ui.overdueDays != null ? (
          <span className={ui.isOverdue ? "text-red-300" : "text-white/80"}>
            {overdueDaysLabel(ui.overdueDays)}
          </span>
        ) : (
          <span className="text-white/60">Not available</span>
        )}
      </FineDetail>
      <FineDetail label="Book ID" value={fine.bookId ?? "—"} />
      <FineDetail
        label="Damage description"
        className="md:col-span-2 xl:col-span-2 2xl:col-span-2"
      >
        {ui.damageDescription ? (
          <div className="rounded-md border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {ui.damageDescription}
          </div>
        ) : (
          <span className="text-white/60">No additional damage details.</span>
        )}
      </FineDetail>
    </div>
  );
}

function FineDetailsDialog({
  fine,
  ui,
  actionButtonBaseClasses,
  triggerClassName,
  triggerLabel = "View details",
}: {
  fine: FineDTO;
  ui: FineUiState;
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
          <DialogTitle className="pr-6 text-left">{ui.primaryLabel}</DialogTitle>
          <DialogDescription className="text-left text-white/65">
            Fine #{fine.id} • {ui.isActive ? "Active (unpaid)" : ui.isPaid ? "Paid" : "Cancelled"} • {peso(ui.amount)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(95svh-8rem)] overflow-y-auto pr-1">
          <div className="space-y-4">
            <FineDetailGrid fine={fine} ui={ui} />

            <FineDetail label="Actions">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <FinePaymentAction
                  fine={fine}
                  ui={ui}
                  className={actionButtonBaseClasses}
                />
              </div>
            </FineDetail>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FineDesktopCard({
  fine,
  ui,
  actionButtonBaseClasses,
}: {
  fine: FineDTO;
  ui: FineUiState;
  actionButtonBaseClasses: string;
}) {
  return (
    <Card className="hidden overflow-hidden rounded-2xl border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 shadow-sm sm:block">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <FineStatusBadge ui={ui} />
              <FineTypeBadges ui={ui} />
            </div>

            <h3 className="wrap-break-word whitespace-normal text-base font-semibold leading-snug text-white">
              {ui.primaryLabel}
            </h3>

            <p className="text-sm text-white/65">
              {peso(ui.amount)} • Created {fmtDate(fine.createdAt)}
              {fine.borrowDueDate ? ` • Due ${fmtDate(fine.borrowDueDate)}` : ""}
            </p>
          </div>

          <div className="w-full max-w-sm lg:w-auto">
            <FineDetailsDialog
              fine={fine}
              ui={ui}
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

function FineMobileCard({
  fine,
  ui,
  actionButtonBaseClasses,
}: {
  fine: FineDTO;
  ui: FineUiState;
  actionButtonBaseClasses: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 p-4 shadow-sm sm:hidden">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <FineStatusBadge ui={ui} />
          <FineTypeBadges ui={ui} />
        </div>

        <h3 className="wrap-break-word whitespace-normal text-sm font-semibold leading-snug text-white">
          {ui.primaryLabel}
        </h3>

        <p className="text-xs text-white/65">
          {peso(ui.amount)} • Created {fmtDate(fine.createdAt)}
          {fine.borrowDueDate ? ` • Due ${fmtDate(fine.borrowDueDate)}` : ""}
        </p>

        <FineDetailsDialog
          fine={fine}
          ui={ui}
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

export default function FacultyFinesPage() {
  const [fines, setFines] = React.useState<FineDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [sortOption, setSortOption] = React.useState<SortOption>("priority");

  const loadFines = React.useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const [fineDataRaw, damageReports] = await Promise.all([
        (async () => (await fetchMyFines()) as any[])(),
        (async () => {
          try {
            return await fetchDamageReportsForFines();
          } catch (err: any) {
            console.error("Failed to load damage reports for fines:", err);
            toast.error("Some damage fine details may be incomplete", {
              description:
                err?.message ||
                "Book titles for certain damage-related fines may not be shown.",
            });
            return [] as DamageReportRow[];
          }
        })(),
      ]);

      const fineData: FineDTO[] = fineDataRaw.map((fine) => ({
        ...(fine as any),
        status: normalizeStatus((fine as any).status),
      })) as FineDTO[];

      setFines(enrichFinesWithDamageReports(fineData, damageReports));
    } catch (err: any) {
      const message = err?.message || "Failed to load fines.";
      setError(message);
      toast.error("Failed to load fines", { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadFines();
  }, [loadFines]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadFines();
    } finally {
      setRefreshing(false);
    }
  }

  const fineUiById = React.useMemo(() => {
    const map: Record<string, FineUiState> = {};
    for (const fine of fines) {
      map[fine.id] = getFineUiState(fine);
    }
    return map;
  }, [fines]);

  const filteredFines = React.useMemo(() => {
    let rows = [...fines];

    if (statusFilter !== "all") {
      rows = rows.filter(
        (fine) => fineUiById[fine.id]?.status === statusFilter
      );
    }

    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((fine) => {
        const ui = fineUiById[fine.id];
        const haystack = [
          fine.id,
          fine.reason ?? "",
          fine.bookTitle ?? "",
          fine.bookId ?? "",
          fine.borrowRecordId ?? "",
          fine.damageReportId ?? "",
          ui?.primaryLabel ?? "",
          ui?.damageDescription ?? "",
          ui?.status ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    }

    rows.sort((a, b) => {
      if (sortOption === "amount_desc") {
        return normalizeFine(b.amount) - normalizeFine(a.amount);
      }

      if (sortOption === "amount_asc") {
        return normalizeFine(a.amount) - normalizeFine(b.amount);
      }

      if (sortOption === "created_desc") {
        return getDateSortValue(b.createdAt ?? null) - getDateSortValue(a.createdAt ?? null);
      }

      if (sortOption === "created_asc") {
        return getDateSortValue(a.createdAt ?? null) - getDateSortValue(b.createdAt ?? null);
      }

      return compareFinesByPriority(a, b);
    });

    return rows;
  }, [fines, fineUiById, search, statusFilter, sortOption]);

  const activeFines = React.useMemo(
    () => filteredFines.filter((fine) => fineUiById[fine.id]?.isActive),
    [filteredFines, fineUiById]
  );

  const resolvedFines = React.useMemo(
    () => filteredFines.filter((fine) => !fineUiById[fine.id]?.isActive),
    [filteredFines, fineUiById]
  );

  const dashboardSummary = React.useMemo(() => {
    return fines.reduce(
      (acc, fine) => {
        const ui = fineUiById[fine.id];
        if (!ui) return acc;

        if (ui.isActive) acc.activeCount += 1;
        if (ui.isPaid) acc.paidCount += 1;
        if (ui.isCancelled) acc.cancelledCount += 1;
        if (ui.isDamage) acc.damageCount += 1;
        if (ui.isOverdue) acc.overdueCount += 1;
        if (ui.isActive) acc.totalActiveFine += ui.amount;
        acc.totalRecordedFine += ui.amount;
        return acc;
      },
      {
        activeCount: 0,
        paidCount: 0,
        cancelledCount: 0,
        damageCount: 0,
        overdueCount: 0,
        totalActiveFine: 0,
        totalRecordedFine: 0,
      }
    );
  }, [fines, fineUiById]);

  const clearControls = React.useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setSortOption("priority");
  }, []);

  const hasControlsApplied =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    sortOption !== "priority";

  const actionButtonBaseClasses =
    "w-full min-h-9 h-auto py-2 whitespace-normal break-words leading-tight text-center";

  return (
    <DashboardLayout title="My Fines">
      <div className="w-full overflow-x-hidden">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight text-white">Fines</h2>
              <p className="text-xs text-white/70">
                Review fines linked to your account for overdue returns and book
                damage.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs text-white/70 sm:flex-row sm:items-center sm:text-sm">
            <div className="flex flex-col items-start sm:items-end">
              <span>
                Active fines:{" "}
                <span className="font-semibold text-amber-300">
                  {dashboardSummary.activeCount}
                </span>
              </span>
              <span>
                Active balance:{" "}
                <span className="font-semibold text-amber-300">
                  {peso(dashboardSummary.totalActiveFine)}
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
          <FineStatCard
            icon={Layers}
            label="Active fines"
            value={dashboardSummary.activeCount}
            tone="warning"
          />
          <FineStatCard
            icon={AlertTriangle}
            label="Overdue"
            value={dashboardSummary.overdueCount}
            tone="danger"
          />
          <FineStatCard
            icon={BookOpen}
            label="Damage fines"
            value={dashboardSummary.damageCount}
            tone="default"
          />
          <FineStatCard
            icon={CheckCircle2}
            label="Paid"
            value={dashboardSummary.paidCount}
            tone="success"
          />
        </div>

        <Card className="mb-4 border-white/10 bg-slate-800/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-white/55">
                  Payment policy
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  Over-the-counter payment only
                </div>
                <p className="mt-2 max-w-3xl text-sm text-white/70">
                  Please go to the library to settle active fines physically. After
                  payment, the librarian will update the status to Paid.
                </p>
              </div>

              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                Total recorded: {peso(dashboardSummary.totalRecordedFine)}
              </Badge>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <FineDetail
                label="Active balance"
                value={peso(dashboardSummary.totalActiveFine)}
              />
              <FineDetail
                label="Resolved fines"
                value={String(dashboardSummary.paidCount + dashboardSummary.cancelledCount)}
              />
              <FineDetail
                label="Cancelled"
                value={String(dashboardSummary.cancelledCount)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 border-white/10 bg-slate-800/60">
          <CardHeader className="pb-2">
            <CardTitle>Find and organize fines</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative w-full xl:flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, reason, damage, or fine ID…"
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
                      <SelectItem value="all">All fines</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="paid">Paid only</SelectItem>
                      <SelectItem value="cancelled">Cancelled only</SelectItem>
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
                        <SelectValue placeholder="Sort fines" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="priority">Priority order</SelectItem>
                      <SelectItem value="amount_desc">Amount: highest first</SelectItem>
                      <SelectItem value="amount_asc">Amount: lowest first</SelectItem>
                      <SelectItem value="created_desc">Created: newest first</SelectItem>
                      <SelectItem value="created_asc">Created: oldest first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Layers className="h-3.5 w-3.5" />
                {filteredFines.length} matching {filteredFines.length === 1 ? "fine" : "fines"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <BookOpen className="h-3.5 w-3.5" />
                Damage fines show report details; borrow fines show due and return dates
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
            <CardTitle>Active fines</CardTitle>
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
            ) : activeFines.length === 0 ? (
              <div className="py-10 text-center text-sm text-white/70">
                No active fines matched your current controls.
              </div>
            ) : (
              <section className="space-y-2">
                <div className="space-y-3 sm:hidden">
                  {activeFines.map((fine) => {
                    const ui = fineUiById[fine.id];
                    return (
                      <FineMobileCard
                        key={fine.id}
                        fine={fine}
                        ui={ui}
                        actionButtonBaseClasses={actionButtonBaseClasses}
                      />
                    );
                  })}
                </div>

                <div className="hidden space-y-3 sm:block">
                  {activeFines.map((fine) => {
                    const ui = fineUiById[fine.id];
                    return (
                      <FineDesktopCard
                        key={fine.id}
                        fine={fine}
                        ui={ui}
                        actionButtonBaseClasses={actionButtonBaseClasses}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </CardContent>
        </Card>

        {(!loading && !error && resolvedFines.length > 0) ||
        (!loading && !error && (statusFilter === "paid" || statusFilter === "cancelled")) ? (
          <Card className="mt-4 border-emerald-400/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-emerald-100">Fine history</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {resolvedFines.length === 0 ? (
                <div className="py-8 text-center text-sm text-emerald-100/70">
                  No paid or cancelled fines matched your current controls.
                </div>
              ) : (
                <section className="space-y-2">
                  <div className="space-y-3 sm:hidden">
                    {resolvedFines.map((fine) => {
                      const ui = fineUiById[fine.id];
                      return (
                        <FineMobileCard
                          key={fine.id}
                          fine={fine}
                          ui={ui}
                          actionButtonBaseClasses={actionButtonBaseClasses}
                        />
                      );
                    })}
                  </div>

                  <div className="hidden space-y-3 sm:block">
                    {resolvedFines.map((fine) => {
                      const ui = fineUiById[fine.id];
                      return (
                        <FineDesktopCard
                          key={fine.id}
                          fine={fine}
                          ui={ui}
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
                filteredFines.reduce((sum, fine) => {
                  return sum + (fineUiById[fine.id]?.amount ?? 0);
                }, 0)
              )}
            </span>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}