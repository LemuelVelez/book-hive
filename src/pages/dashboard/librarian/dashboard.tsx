/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  BookOpen,
  ListChecks,
  MessageSquare,
  RefreshCcw,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Star,
} from "lucide-react";

import { fetchBooks, type BookDTO } from "@/lib/books";
import { fetchBorrowRecords, type BorrowRecordDTO } from "@/lib/borrows";
import { fetchFeedbacks, type FeedbackDTO } from "@/lib/feedbacks";
import { API_BASE } from "@/api/auth/route";

async function fetchDamageReportsCount(): Promise<number> {
  try {
    const resp = await fetch(`${API_BASE}/api/damage-reports`, {
      method: "GET",
      credentials: "include",
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const list =
      (Array.isArray(data.damageReports) && data.damageReports) ||
      (Array.isArray(data.reports) && data.reports) ||
      (Array.isArray(data.items) && data.items) ||
      [];

    return list.length;
  } catch (err) {
    console.warn("[LibrarianDashboard] Failed to fetch damage reports count", err);
    return 0;
  }
}

export default function LibrarianDashboard() {
  const [books, setBooks] = React.useState<BookDTO[]>([]);
  const [borrows, setBorrows] = React.useState<BorrowRecordDTO[]>([]);
  const [feedbacks, setFeedbacks] = React.useState<FeedbackDTO[]>([]);
  const [damageCount, setDamageCount] = React.useState<number | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const booksData = await fetchBooks();
      const borrowsData = await fetchBorrowRecords();
      const feedbackData = await fetchFeedbacks();
      const damageTotal = await fetchDamageReportsCount();

      setBooks(booksData);
      setBorrows(borrowsData);
      setFeedbacks(feedbackData);
      setDamageCount(damageTotal);
    } catch (err: any) {
      const msg =
        err?.message ||
        "Failed to load overview data. Please try again in a moment.";
      setError(msg);
      toast.error("Failed to load librarian overview", { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadOverview();
    } finally {
      setRefreshing(false);
    }
  };

  const metrics = React.useMemo(() => {
    const totalBooks = books.length;
    const availableBooks = books.filter((b) => b.available).length;

    const activeBorrows = borrows.filter((r) => r.status === "borrowed").length;
    const returnedBorrows = borrows.filter((r) => r.status === "returned").length;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const overdueBorrows = borrows.filter(
      (r) => r.status === "borrowed" && r.dueDate < today
    ).length;

    const feedbackCount = feedbacks.length;
    const avgRating =
      feedbackCount > 0
        ? feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / feedbackCount
        : null;

    return {
      totalBooks,
      availableBooks,
      activeBorrows,
      returnedBorrows,
      overdueBorrows,
      feedbackCount,
      avgRating,
      damageReports: damageCount ?? 0,
    };
  }, [books, borrows, feedbacks, damageCount]);

  const recentBorrowRecords = React.useMemo(() => {
    const sorted = [...borrows].sort((a, b) =>
      b.borrowDate.localeCompare(a.borrowDate)
    );
    return sorted.slice(0, 5);
  }, [borrows]);

  const latestFeedbacks = React.useMemo(() => {
    const sorted = [...feedbacks].sort((a, b) => {
      const da = a.createdAt ?? "";
      const db = b.createdAt ?? "";
      return db.localeCompare(da);
    });
    return sorted.slice(0, 5);
  }, [feedbacks]);

  return (
    <DashboardLayout title="Librarian Overview">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-purple-600/20 text-purple-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight">
                Library operations overview
              </h2>
              <p className="text-xs text-white/70">
                Quick snapshot of books, borrow activity, feedback, and damage reports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              <span className="sr-only">Refresh overview</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {/* Total books */}
          <Card className="bg-slate-800/60 border-white/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-white/80">
                Books in catalog
              </CardTitle>
              <BookOpen className="h-4 w-4 text-white/60" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-semibold">
                  {metrics.totalBooks.toLocaleString()}
                </div>
              )}
              <p className="text-xs text-white/60 mt-1">
                Available:{" "}
                {loading ? (
                  <Skeleton className="h-4 w-16 inline-block align-middle" />
                ) : (
                  metrics.availableBooks.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>

          {/* Borrow activity */}
          <Card className="bg-slate-800/60 border-white/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-white/80">
                Active borrows
              </CardTitle>
              <ListChecks className="h-4 w-4 text-white/60" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-semibold">
                  {metrics.activeBorrows.toLocaleString()}
                </div>
              )}
              <p className="text-xs text-white/60 mt-1">
                Returned so far:{" "}
                {loading ? (
                  <Skeleton className="h-4 w-20 inline-block align-middle" />
                ) : (
                  metrics.returnedBorrows.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>

          {/* Overdue items */}
          <Card className="bg-slate-800/60 border-white/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-white/80">
                Overdue items
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-300" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-semibold text-amber-200">
                  {metrics.overdueBorrows.toLocaleString()}
                </div>
              )}
              <p className="text-xs text-white/60 mt-1">
                Items still not returned past due date.
              </p>
            </CardContent>
          </Card>

          {/* Damage reports */}
          <Card className="bg-slate-800/60 border-white/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-white/80">
                Damage reports
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-300" />
            </CardHeader>
            <CardContent>
              {loading && damageCount === null ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-semibold text-red-200">
                  {metrics.damageReports.toLocaleString()}
                </div>
              )}
              <p className="text-xs text-white/60 mt-1">
                Total reports filed for damaged items.
              </p>
            </CardContent>
          </Card>

          {/* Feedback / rating */}
          <Card className="bg-slate-800/60 border-white/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-white/80">
                Student feedback
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-white/60" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-7 w-24" />
              ) : metrics.avgRating != null ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">
                    {metrics.avgRating.toFixed(1)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-yellow-200">
                    <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
                    / 5.0
                  </span>
                </div>
              ) : (
                <div className="text-sm text-white/70">No ratings yet</div>
              )}
              <p className="text-xs text-white/60 mt-1">
                Total feedback:{" "}
                {loading ? (
                  <Skeleton className="h-4 w-16 inline-block align-middle" />
                ) : (
                  metrics.feedbackCount.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Activity panels */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent borrow activity */}
          <Card className="bg-slate-800/60 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-white/70" />
                Recent borrow activity
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
              ) : recentBorrowRecords.length === 0 ? (
                <div className="py-6 text-xs text-white/70 text-center">
                  No borrow activity recorded yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-xs text-white/70">
                        Student
                      </TableHead>
                      <TableHead className="text-xs text-white/70">
                        Book
                      </TableHead>
                      <TableHead className="text-xs text-white/70">
                        Status
                      </TableHead>
                      <TableHead className="text-xs text-white/70">
                        Due date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentBorrowRecords.map((r) => {
                      const studentLabel =
                        r.studentName ||
                        r.studentEmail ||
                        r.studentId ||
                        "Unknown";
                      const status = r.status;
                      const statusClasses =
                        status === "returned"
                          ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80"
                          : "bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80";
                      const statusLabel =
                        status === "returned" ? "Returned" : "Borrowed";

                      return (
                        <TableRow
                          key={r.id}
                          className="border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <TableCell className="text-xs text-white/80">
                            {studentLabel}
                          </TableCell>
                          <TableCell className="text-xs text-white/90">
                            {r.bookTitle || r.bookId || "Unknown book"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              className={statusClasses}
                              variant="outline"
                            >
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-white/80">
                            {r.dueDate || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Latest feedback */}
          <Card className="bg-slate-800/60 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-white/70" />
                Latest feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              ) : latestFeedbacks.length === 0 ? (
                <div className="py-6 text-xs text-white/70 text-center">
                  No feedback submitted yet.
                </div>
              ) : (
                latestFeedbacks.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-white/90 truncate">
                        {f.bookTitle || `Book #${f.bookId}`}
                      </div>
                      <div className="inline-flex items-center gap-1 text-yellow-200">
                        <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
                        <span>{f.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    {f.comment && (
                      <p className="text-white/80 wrap-break-word">
                        {f.comment}
                      </p>
                    )}
                    {f.createdAt && (
                      <p className="text-[10px] text-white/50">
                        {new Date(f.createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
