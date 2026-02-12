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
} from "lucide-react";
import { toast } from "sonner";

import {
  fetchMyBorrowRecords,
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

const FIXED_EXTENSION_DAYS = 1;

/**
 * Format date as YYYY-MM-DD in *local* timezone
 * to avoid off-by-one issues from UTC conversions.
 */
function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-CA"); // 2025-11-13
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

function computeOverdueDays(dueDate?: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;

  const now = new Date();

  const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = todayLocal.getTime() - dueLocal.getTime();
  const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return rawDays > 0 ? rawDays : 0;
}

export default function StudentCirculationPage() {
  const [records, setRecords] = React.useState<BorrowRecordDTO[]>([]);
  const [fines, setFines] = React.useState<FineDTO[]>([]);
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
      const [recordsData, finesData] = await Promise.all([
        fetchMyBorrowRecords(),
        fetchMyFines(),
      ]);
      setRecords(recordsData);
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
        const haystack =
          `${r.bookTitle ?? ""} ${r.bookId} ${r.studentName ?? ""}`.toLowerCase();
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

    const currentReqStatus = (record.extensionRequestStatus ?? "none").toLowerCase();
    if (currentReqStatus === "pending") {
      toast.info("Extension already requested", {
        description: "You already have a pending extension request for this record.",
      });
      return;
    }

    // Fixed extension policy: exactly 1 day (not user-editable)
    const days = FIXED_EXTENSION_DAYS;
    const reason = (extendReasonById[record.id] ?? "").trim();

    setExtendBusyId(record.id);
    try {
      const res = await requestBorrowExtension(record.id, days, reason);
      const updated = res.record;

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      const newReqStatus = (updated.extensionRequestStatus ?? "none").toLowerCase();

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
          description: res.message || `Current due date: ${fmtDate(updated.dueDate)}`,
        });
      }
    } catch (err: any) {
      const msg = err?.message || "Could not request an extension. Please try again.";
      toast.error("Extension failed", { description: msg });
    } finally {
      setExtendBusyId(null);
    }
  }

  const wrapCellClasses = "whitespace-normal break-words";
  const badgeWrapClasses = "max-w-full whitespace-normal break-words leading-tight text-right";
  const actionButtonBaseClasses =
    "w-full min-h-9 h-auto py-2 whitespace-normal break-words leading-tight text-center";

  return (
    <DashboardLayout title="My Circulation">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Borrowed books (circulation)
            </h2>
            <p className="text-xs text-white/70">
              View your borrowed books, due dates, returns, extensions, and fines.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-white/70">
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

      <Card className="bg-slate-800/60 border-white/10">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>Circulation history</CardTitle>

            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title…"
                  className="pl-9 bg-slate-900/70 border-white/20 text-white"
                />
              </div>

              <div className="w-full md:w-[200px]">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                    <SelectValue placeholder="Filter by status" />
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

          <p className="mt-2 text-[11px] text-white/60">
            Return requests and extension requests apply to{" "}
            <span className="font-semibold text-amber-200">Borrowed</span>{" "}
            records. Pending records are waiting for librarian confirmation.
          </p>

          <p className="mt-1 text-[11px] text-white/60">
            The{" "}
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-400/40">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Active fine
            </span>{" "}
            tag indicates an unpaid fine.
          </p>
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
                              <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                Borrow ID
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-white/70">
                                Book
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-white/70">
                                Borrowed
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-white/70">
                                Due
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-white/70">
                                Returned
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-white/70">
                                Status
                              </TableHead>
                              <TableHead className="w-44 text-xs font-semibold text-white/70 text-right">
                                ₱Fine
                              </TableHead>
                              <TableHead className="w-56 text-xs font-semibold text-white/70 text-right">
                                Action
                              </TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {group.rows.map((record) => {
                              const isReturned = record.status === "returned";
                              const isBorrowed = record.status === "borrowed";
                              const isPendingPickup =
                                record.status === "pending_pickup";
                              const isPendingReturn =
                                record.status === "pending_return";
                              const isLegacyPending = record.status === "pending";
                              const isAnyPending =
                                isPendingPickup || isPendingReturn || isLegacyPending;

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
                              const overdueDays = computeOverdueDays(record.dueDate);
                              const isOverdue = isActiveBorrow && overdueDays > 0;

                              const extensionCount = (record.extensionCount ?? 0) as number;
                              const extensionTotalDays = (record.extensionTotalDays ?? 0) as number;
                              const lastExtensionDays = record.lastExtensionDays ?? null;
                              const lastExtendedAt = record.lastExtendedAt ?? null;

                              const reqStatus = (
                                record.extensionRequestStatus ?? "none"
                              ).toLowerCase();
                              const reqDays =
                                typeof record.extensionRequestedDays === "number"
                                  ? record.extensionRequestedDays
                                  : null;
                              const reqAt = record.extensionRequestedAt ?? null;
                              const decidedAt = record.extensionDecidedAt ?? null;

                              const extensionPending =
                                isBorrowed && reqStatus === "pending";

                              return (
                                <TableRow
                                  key={record.id}
                                  className="border-white/5 hover:bg-white/5 transition-colors"
                                >
                                  <TableCell className="text-xs opacity-80">
                                    {record.id}
                                  </TableCell>

                                  <TableCell className="text-sm font-medium">
                                    {record.bookTitle ?? (
                                      <span className="opacity-70">
                                        Book #{record.bookId}
                                      </span>
                                    )}
                                  </TableCell>

                                  <TableCell className="text-sm opacity-80">
                                    {fmtDate(record.borrowDate)}
                                  </TableCell>

                                  <TableCell className="text-sm opacity-80">
                                    <div className="flex flex-col gap-0.5">
                                      <span>{fmtDate(record.dueDate)}</span>

                                      {extensionCount > 0 && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200 border border-sky-300/30 w-fit">
                                          <span className="h-1.5 w-1.5 rounded-full bg-sky-200" />
                                          Extended {extensionCount}× (+{extensionTotalDays}d)
                                        </span>
                                      )}

                                      {extensionCount > 0 && lastExtendedAt && (
                                        <span className="text-[10px] text-white/60">
                                          Last: {fmtDateTime(lastExtendedAt)}
                                          {typeof lastExtensionDays === "number"
                                            ? ` (+${lastExtensionDays}d)`
                                            : ""}
                                        </span>
                                      )}

                                      {reqStatus === "pending" && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-400/40 w-fit">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                          Extension pending{" "}
                                          {typeof reqDays === "number"
                                            ? `(+${reqDays}d)`
                                            : ""}
                                        </span>
                                      )}

                                      {reqStatus === "approved" && reqAt && (
                                        <span className="text-[10px] text-white/60">
                                          Extension approved: {fmtDateTime(reqAt)}
                                        </span>
                                      )}

                                      {reqStatus === "disapproved" && decidedAt && (
                                        <span className="text-[10px] text-white/60">
                                          Extension disapproved: {fmtDateTime(decidedAt)}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>

                                  <TableCell className="text-sm opacity-80">
                                    {fmtDate(record.returnDate)}
                                  </TableCell>

                                  <TableCell>
                                    {isReturned ? (
                                      <Badge className="bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80">
                                        <span className="inline-flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Returned
                                        </span>
                                      </Badge>
                                    ) : isAnyPending ? (
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
                                      <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80">
                                        <span className="inline-flex items-center gap-1">
                                          <Clock3 className="h-3 w-3" />
                                          Borrowed
                                        </span>
                                      </Badge>
                                    )}
                                  </TableCell>

                                  <TableCell
                                    className={
                                      "text-right align-top w-44 max-w-44 " +
                                      wrapCellClasses
                                    }
                                  >
                                    <div className="flex w-full flex-col items-end gap-1">
                                      <span>{peso(finalFineAmount)}</span>

                                      {isActiveBorrow &&
                                        isOverdue &&
                                        finalFineAmount > 0 && (
                                          <span
                                            className={
                                              "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-400/40 " +
                                              badgeWrapClasses
                                            }
                                          >
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                            Accruing overdue fine ({peso(finalFineAmount)})
                                          </span>
                                        )}

                                      {linkedFine && linkedFineStatus === "active" && (
                                        <span
                                          className={
                                            "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-400/40 " +
                                            badgeWrapClasses
                                          }
                                        >
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                          Active fine (unpaid)
                                        </span>
                                      )}

                                      {linkedFine &&
                                        linkedFineStatus === "pending_verification" && (
                                          <span
                                            className={
                                              "inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200 border border-slate-400/40 " +
                                              badgeWrapClasses
                                            }
                                          >
                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                            Awaiting librarian update
                                          </span>
                                        )}

                                      {linkedFine && linkedFineStatus === "paid" && (
                                        <span
                                          className={
                                            "inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-400/40 " +
                                            badgeWrapClasses
                                          }
                                        >
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                          Fine paid
                                        </span>
                                      )}

                                      {linkedFine &&
                                        linkedFineStatus === "cancelled" && (
                                          <span
                                            className={
                                              "inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200 border border-slate-400/40 " +
                                              badgeWrapClasses
                                            }
                                          >
                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                            Fine cancelled
                                          </span>
                                        )}
                                    </div>
                                  </TableCell>

                                  <TableCell
                                    className={
                                      "text-right align-top w-56 max-w-56 " +
                                      wrapCellClasses
                                    }
                                  >
                                    {isBorrowed ? (
                                      <div className="flex w-full flex-col gap-2 items-stretch">
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              type="button"
                                              size="sm"
                                              className={
                                                "bg-purple-600 hover:bg-purple-700 text-white " +
                                                actionButtonBaseClasses
                                              }
                                              disabled={returnBusyId === record.id}
                                            >
                                              {returnBusyId === record.id ? (
                                                <span className="inline-flex items-center gap-2">
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                  Sending…
                                                </span>
                                              ) : (
                                                "Request return"
                                              )}
                                            </Button>
                                          </AlertDialogTrigger>

                                          <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
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

                                            <div className="mt-3 text-sm text-white/80 space-y-1">
                                              <p>
                                                <span className="text-white/60">
                                                  Book:
                                                </span>{" "}
                                                <span className="font-semibold text-white">
                                                  {record.bookTitle ?? `Book #${record.bookId}`}
                                                </span>
                                              </p>
                                              <p>
                                                <span className="text-white/60">
                                                  Borrowed on:
                                                </span>{" "}
                                                {fmtDate(record.borrowDate)}
                                              </p>
                                              <p>
                                                <span className="text-white/60">Due date:</span>{" "}
                                                {fmtDate(record.dueDate)}
                                              </p>
                                              {finalFineAmount > 0 && (
                                                <p className="text-red-300">
                                                  Estimated fine if returned today:{" "}
                                                  <span className="font-semibold">
                                                    {peso(finalFineAmount)}
                                                  </span>
                                                </p>
                                              )}
                                            </div>

                                            <AlertDialogFooter>
                                              <AlertDialogCancel
                                                className="border-white/20 text-white hover:bg-black/20"
                                                disabled={returnBusyId === record.id}
                                              >
                                                Cancel
                                              </AlertDialogCancel>
                                              <AlertDialogAction
                                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                                disabled={returnBusyId === record.id}
                                                onClick={() => void handleRequestReturn(record)}
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
                                              size="sm"
                                              variant="outline"
                                              className={
                                                "border-sky-300/40 text-sky-200 hover:bg-sky-500/10 " +
                                                actionButtonBaseClasses
                                              }
                                              disabled={extendBusyId === record.id || extensionPending}
                                              onClick={() => {
                                                setExtendReasonById((prev) => ({
                                                  ...prev,
                                                  [record.id]: prev[record.id] ?? "",
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

                                          <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
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
                                              <div className="text-sm text-white/80 space-y-1">
                                                <p>
                                                  <span className="text-white/60">
                                                    Current due date:
                                                  </span>{" "}
                                                  {fmtDate(record.dueDate)}
                                                </p>

                                                {extensionCount > 0 && (
                                                  <p className="text-xs text-white/60">
                                                    Approved extensions:{" "}
                                                    <span className="font-semibold text-sky-200">
                                                      {extensionCount}×
                                                    </span>{" "}
                                                    (total +{extensionTotalDays} days)
                                                  </p>
                                                )}

                                                {reqStatus === "pending" && (
                                                  <p className="text-xs text-amber-200/90">
                                                    You already have a pending request{" "}
                                                    {typeof reqDays === "number"
                                                      ? `(+${reqDays} days)`
                                                      : ""}{" "}
                                                    {reqAt ? `submitted at ${fmtDateTime(reqAt)}.` : "."}
                                                  </p>
                                                )}
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
                                                  value={extendReasonById[record.id] ?? ""}
                                                  onChange={(e) =>
                                                    setExtendReasonById((prev) => ({
                                                      ...prev,
                                                      [record.id]: e.target.value,
                                                    }))
                                                  }
                                                  placeholder="e.g. Research requirement"
                                                  className="bg-slate-950/60 border-white/20 text-white"
                                                  disabled={extendBusyId === record.id || extensionPending}
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
                                                className="bg-sky-600 hover:bg-sky-700 text-white"
                                                disabled={extendBusyId === record.id || extensionPending}
                                                onClick={() => void handleRequestExtension(record)}
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
                                        size="sm"
                                        variant="outline"
                                        disabled
                                        className={
                                          "border-amber-400/50 text-amber-200/80 " +
                                          actionButtonBaseClasses
                                        }
                                      >
                                        Pending return
                                      </Button>
                                    ) : record.status === "pending_pickup" ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled
                                        className={
                                          "border-amber-400/50 text-amber-200/80 " +
                                          actionButtonBaseClasses
                                        }
                                      >
                                        Pending pickup
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled
                                        className={
                                          "border-white/20 text-white/60 " + actionButtonBaseClasses
                                        }
                                      >
                                        Already returned
                                      </Button>
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
    </DashboardLayout>
  );
}
