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
  type BorrowRecordDTO,
} from "@/lib/borrows";

import {
  fetchMyFines,
  type FineDTO,
} from "@/lib/fines";

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

// Normalize any "fine-like" value into a safe number
function normalizeFine(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
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
      // Treat both "borrowed" and "pending" as active borrows for filtering
      rows = rows.filter(
        (r) => r.status === "borrowed" || r.status === "pending"
      );
    } else if (statusFilter === "returned") {
      rows = rows.filter((r) => r.status === "returned");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const haystack = `${r.bookTitle ?? ""} ${r.bookId} ${r.studentName ?? ""
          }`.toLowerCase();
        return haystack.includes(q);
      });
    }

    // Newest borrow first
    return rows.sort((a, b) => b.borrowDate.localeCompare(a.borrowDate));
  }, [records, statusFilter, search]);

  const activeBorrows = React.useMemo(
    () =>
      records.filter(
        (r) => r.status === "borrowed" || r.status === "pending"
      ),
    [records]
  );

  // Map fines by borrow_record_id for quick lookup
  const finesByBorrowId = React.useMemo(() => {
    const map: Record<string, FineDTO> = {};
    for (const f of fines) {
      if (f.borrowRecordId) {
        map[f.borrowRecordId] = f;
      }
    }
    return map;
  }, [fines]);

  // Active fines = fines table rows whose status === 'active' (unpaid)
  const totalActiveFine = React.useMemo(
    () =>
      fines.reduce((sum, f) => {
        if (f.status !== "active") return sum;
        const amount = normalizeFine(f.amount);
        return amount > 0 ? sum + amount : sum;
      }, 0),
    [fines]
  );

  async function handleRequestReturn(record: BorrowRecordDTO) {
    if (record.status !== "borrowed") {
      toast.info("Return request not needed", {
        description:
          record.status === "pending"
            ? "This book already has a pending return request."
            : "This book is already marked as returned.",
      });
      return;
    }

    setReturnBusyId(record.id);
    try {
      const updated = await requestBorrowReturn(record.id);

      setRecords((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );

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

  // Reusable scrollbar styling for dark, thin horizontal scrollbars
  const cellScrollbarClasses =
    "overflow-x-auto whitespace-nowrap " +
    "[scrollbar-width:thin] [scrollbar-color:#111827_transparent] " +
    "[&::-webkit-scrollbar]:h-1.5 " +
    "[&::-webkit-scrollbar-track]:bg-transparent " +
    "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
    "[&::-webkit-scrollbar-thumb]:rounded-full " +
    "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

  return (
    <DashboardLayout title="My Circulation">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Borrowed books (circulation)
            </h2>
            <p className="text-xs text-white/70">
              View all books you&apos;ve borrowed, track due dates and fines,
              and send online return requests.
            </p>
            <p className="mt-1 text-[11px] text-amber-200/90">
              Books <span className="font-semibold">cannot be auto-returned</span>. When
              you request a return, the status becomes{" "}
              <span className="font-semibold">Pending verification</span>. A
              librarian must verify the{" "}
              <span className="font-semibold">physical book</span> before it
              changes to <span className="font-semibold">Returned</span>.
            </p>
            <p className="mt-1 text-[11px] text-emerald-200/90">
              To <span className="font-semibold">pay any fines</span>, use your{" "}
              <span className="font-semibold">Fines</span> page, where you can upload
              payment receipts and track verification.
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
              {/* Search */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title…"
                  className="pl-9 bg-slate-900/70 border-white/20 text-white"
                />
              </div>

              {/* Status filter */}
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
            You can only{" "}
            <span className="font-semibold text-purple-200">
              request a return
            </span>{" "}
            for books that are still{" "}
            <span className="font-semibold text-amber-200">Borrowed</span>. Once
            requested, the status becomes{" "}
            <span className="font-semibold text-amber-200">Pending</span> until a
            librarian confirms the physical return.
          </p>
          <p className="mt-1 text-[11px] text-white/60">
            Returned rows with the{" "}
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-400/40">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Active fine
            </span>{" "}
            tag indicate fines that are still active (unpaid). You can pay those
            from your <span className="font-semibold">Fines</span> page.
          </p>
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
              No circulation records matched your filters.
              <br />
              <span className="text-xs opacity-80">
                Try clearing the search or changing the status filter.
              </span>
            </div>
          ) : (
            <Table>
              <TableCaption className="text-xs text-white/60">
                Showing {filtered.length}{" "}
                {filtered.length === 1 ? "record" : "records"}. Returned rows
                with an{" "}
                <span className="font-semibold text-amber-200">
                  Active fine
                </span>{" "}
                tag have unpaid fines you can pay from your{" "}
                <span className="font-semibold">Fines</span> page. Payments
                there move into{" "}
                <span className="font-semibold">Pending verification</span>{" "}
                until a librarian confirms them.
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
                  <TableHead className="text-xs font-semibold text-white/70">
                    ₱Fine
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-white/70 text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((record) => {
                  const isBorrowed = record.status === "borrowed";
                  const isPending = record.status === "pending";
                  const isActiveBorrow = isBorrowed || isPending;

                  const linkedFine = finesByBorrowId[record.id];
                  const fineAmountFromRecord = normalizeFine(
                    (record as any).fine
                  );
                  const finalFineAmount = linkedFine
                    ? normalizeFine(linkedFine.amount)
                    : fineAmountFromRecord;

                  const isOverdue =
                    isActiveBorrow && finalFineAmount > 0;

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
                        {fmtDate(record.dueDate)}
                      </TableCell>
                      <TableCell className="text-sm opacity-80">
                        {fmtDate(record.returnDate)}
                      </TableCell>
                      <TableCell>
                        {record.status === "returned" ? (
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
                          "text-right align-top w-[100px] max-w-[100px] " +
                          cellScrollbarClasses
                        }
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span>{peso(finalFineAmount)}</span>
                          {linkedFine && linkedFine.status === "active" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-400/40">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                              Active fine (unpaid)
                            </span>
                          )}
                          {linkedFine &&
                            linkedFine.status === "pending_verification" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100 border border-amber-300/40">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
                                Payment pending verification
                              </span>
                            )}
                          {linkedFine && linkedFine.status === "paid" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-400/40">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                              Fine paid
                            </span>
                          )}
                          {linkedFine && linkedFine.status === "cancelled" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200 border border-slate-400/40">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                              Fine cancelled
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={
                          "text-right align-top w-[120px] max-w-[120px] " +
                          cellScrollbarClasses
                        }
                      >
                        {/* Borrow-related actions only */}
                        {record.status === "borrowed" ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white w-full md:w-auto"
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
                                  You&apos;re about to submit an online return
                                  request for{" "}
                                  <span className="font-semibold text-white">
                                    “
                                    {record.bookTitle ??
                                      `Book #${record.bookId}`}”
                                  </span>
                                  . The status will change to{" "}
                                  <span className="font-semibold text-amber-200">
                                    Pending verification
                                  </span>
                                  .
                                </AlertDialogDescription>
                              </AlertDialogHeader>

                              <div className="mt-3 text-sm text-white/80 space-y-1">
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
                                <p className="text-xs text-white/70">
                                  You{" "}
                                  <span className="font-semibold">
                                    must still bring the physical book
                                  </span>{" "}
                                  to the library. A librarian will verify the
                                  book and then mark it as{" "}
                                  <span className="font-semibold text-emerald-200">
                                    Returned
                                  </span>
                                  .
                                </p>
                                {finalFineAmount > 0 && (
                                  <p className="text-red-300">
                                    If you returned the book today, your
                                    estimated overdue fine would be{" "}
                                    <span className="font-semibold">
                                      {peso(finalFineAmount)}
                                    </span>
                                    .
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
                        ) : record.status === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled
                            className="border-amber-400/50 text-amber-200/80 w-full md:w-auto"
                          >
                            Pending verification
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled
                            className="border-white/20 text-white/60 w-full md:w-auto mx-1"
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
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
