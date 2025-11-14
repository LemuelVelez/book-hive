/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  ListChecks,
  ShieldAlert,
  MessageSquare,
  Users2,
  BarChart2,
  RefreshCcw,
  Loader2,
  Star,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/api/auth/route";

// Existing client helpers
import { fetchBooks, type BookDTO } from "@/lib/books";
import {
  fetchBorrowRecords,
  type BorrowRecordDTO,
} from "@/lib/borrows";
import { fetchFeedbacks, type FeedbackDTO } from "@/lib/feedbacks";

// Recharts (for the bar chart)
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* ------------------------------ Types ------------------------------ */

type BooksOverview = {
  total: number;
  available: number;
  unavailable: number;
};

type BorrowOverview = {
  total: number;
  borrowed: number;
  pending: number;
  returned: number;
  totalFine: number;
};

type RatingValue = 1 | 2 | 3 | 4 | 5;
type RatingBuckets = Record<RatingValue, number>;

type FeedbackOverview = {
  total: number;
  avgRating: number;
  buckets: RatingBuckets;
};

type DamageStatus = "pending" | "assessed" | "paid";

type DamageOverview = {
  total: number;
  pending: number;
  assessed: number;
  paid: number;
};

type Role = "student" | "librarian" | "faculty" | "admin" | "other";

type UsersOverview = {
  total: number;
  byRole: Record<Role, number>;
};

/* -------------------------- Default states ------------------------- */

const EMPTY_BOOKS_OVERVIEW: BooksOverview = {
  total: 0,
  available: 0,
  unavailable: 0,
};

const EMPTY_BORROW_OVERVIEW: BorrowOverview = {
  total: 0,
  borrowed: 0,
  pending: 0,
  returned: 0,
  totalFine: 0,
};

const EMPTY_FEEDBACK_OVERVIEW: FeedbackOverview = {
  total: 0,
  avgRating: 0,
  buckets: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const EMPTY_DAMAGE_OVERVIEW: DamageOverview = {
  total: 0,
  pending: 0,
  assessed: 0,
  paid: 0,
};

const EMPTY_USERS_OVERVIEW: UsersOverview = {
  total: 0,
  byRole: {
    student: 0,
    librarian: 0,
    faculty: 0,
    admin: 0,
    other: 0,
  },
};

/* ------------------------ Local summarizers ------------------------ */

function summarizeBooks(books: BookDTO[]): BooksOverview {
  const total = books.length;
  let available = 0;
  let unavailable = 0;
  for (const b of books) {
    if (b.available) available += 1;
    else unavailable += 1;
  }
  return { total, available, unavailable };
}

function summarizeBorrows(records: BorrowRecordDTO[]): BorrowOverview {
  let borrowed = 0;
  let pending = 0;
  let returned = 0;
  let totalFine = 0;

  for (const r of records) {
    const status = String(r.status ?? "").toLowerCase();
    if (status === "returned") returned += 1;
    else if (status === "pending") pending += 1;
    else if (status === "borrowed") borrowed += 1;

    const fineVal = Number((r as any).fine ?? 0);
    if (!Number.isNaN(fineVal) && fineVal > 0) {
      totalFine += fineVal;
    }
  }

  return {
    total: records.length,
    borrowed,
    pending,
    returned,
    totalFine,
  };
}

function summarizeFeedbacks(feedbacks: FeedbackDTO[]): FeedbackOverview {
  const buckets: RatingBuckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;

  for (const f of feedbacks) {
    const raw = Number((f as any).rating ?? 0);
    if (!Number.isFinite(raw)) continue;

    const roundedRaw = Math.round(raw);
    if (roundedRaw < 1 || roundedRaw > 5) continue;
    const rounded = roundedRaw as RatingValue;

    sum += rounded;
    count += 1;
    buckets[rounded] += 1;
  }

  const avgRating = count ? sum / count : 0;

  return {
    total: feedbacks.length,
    avgRating,
    buckets,
  };
}

/* --------------------- API helpers (overview) ---------------------- */

async function fetchDamageOverview(): Promise<DamageOverview> {
  const res = await fetch(`${API_BASE}/api/damage-reports`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => "")) || `HTTP ${res.status}`;
    throw new Error(`Failed to fetch damage reports. ${text}`);
  }

  const data: any = await res.json().catch(() => null);
  const list: any[] = Array.isArray(data?.reports)
    ? data.reports
    : Array.isArray(data)
      ? data
      : [];

  const summary: DamageOverview = {
    total: list.length,
    pending: 0,
    assessed: 0,
    paid: 0,
  };

  for (const item of list) {
    const status = String(item?.status ?? "").toLowerCase() as DamageStatus;
    if (status === "pending") summary.pending += 1;
    else if (status === "assessed") summary.assessed += 1;
    else if (status === "paid") summary.paid += 1;
  }

  return summary;
}

async function fetchUsersOverview(): Promise<UsersOverview> {
  const endpoint = `${API_BASE}/api/users`;
  const res = await fetch(endpoint, { method: "GET", credentials: "include" });

  if (!res.ok) {
    const text = (await res.text().catch(() => "")) || `HTTP ${res.status}`;
    throw new Error(`Failed to fetch users from ${endpoint}. ${text}`);
  }

  const data: any = await res.json().catch(() => null);
  const list: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.users)
      ? data.users
      : [];

  const byRole: UsersOverview["byRole"] = {
    student: 0,
    librarian: 0,
    faculty: 0,
    admin: 0,
    other: 0,
  };

  for (const u of list) {
    const raw = String(u?.accountType ?? u?.role ?? "student").toLowerCase();
    const role: Role =
      raw === "librarian" ||
        raw === "faculty" ||
        raw === "admin" ||
        raw === "other"
        ? (raw as Role)
        : "student";

    byRole[role] += 1;
  }

  return {
    total: list.length,
    byRole,
  };
}

/* --------------------------- Page component ------------------------ */

export default function LibrarianDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [booksOverview, setBooksOverview] =
    React.useState<BooksOverview>(EMPTY_BOOKS_OVERVIEW);
  const [borrowOverview, setBorrowOverview] =
    React.useState<BorrowOverview>(EMPTY_BORROW_OVERVIEW);
  const [damageOverview, setDamageOverview] =
    React.useState<DamageOverview>(EMPTY_DAMAGE_OVERVIEW);
  const [feedbackOverview, setFeedbackOverview] =
    React.useState<FeedbackOverview>(EMPTY_FEEDBACK_OVERVIEW);
  const [usersOverview, setUsersOverview] =
    React.useState<UsersOverview>(EMPTY_USERS_OVERVIEW);

  const loadOverview = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [booksList, borrowList, feedbackList, damage, users] =
        await Promise.all([
          fetchBooks(),
          fetchBorrowRecords(),
          fetchFeedbacks(),
          fetchDamageOverview(),
          fetchUsersOverview(),
        ]);

      setBooksOverview(summarizeBooks(booksList));
      setBorrowOverview(summarizeBorrows(borrowList));
      setFeedbackOverview(summarizeFeedbacks(feedbackList));
      setDamageOverview(damage);
      setUsersOverview(users);
    } catch (err: any) {
      const msg =
        err?.message || "Failed to load overview data. Please try again.";
      setError(msg);
      toast.error("Failed to load librarian overview", {
        description: msg,
      });
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

  const borrowChartData = React.useMemo(
    () => [
      { name: "Borrowed", value: borrowOverview.borrowed },
      { name: "Pending", value: borrowOverview.pending },
      { name: "Returned", value: borrowOverview.returned },
    ],
    [
      borrowOverview.borrowed,
      borrowOverview.pending,
      borrowOverview.returned,
    ]
  );

  const activeBorrowCount =
    borrowOverview.borrowed + borrowOverview.pending;

  const avgRatingLabel =
    feedbackOverview.avgRating > 0
      ? feedbackOverview.avgRating.toFixed(1)
      : "—";

  const topPositive =
    feedbackOverview.buckets[5] + feedbackOverview.buckets[4];
  const neutral = feedbackOverview.buckets[3];
  const negative =
    feedbackOverview.buckets[2] + feedbackOverview.buckets[1];

  return (
    <DashboardLayout title="Librarian Overview">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-tight">
            <BookOpen className="h-5 w-5" />
            Librarian overview
          </h2>
          <p className="text-xs text-white/70">
            Snapshot of the library catalog, borrowing activity, damage
            reports, feedbacks, and user roles.
          </p>
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
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <>
          {/* Skeleton cards */}
          <div className="mb-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card
                key={i}
                className="bg-slate-800/60 border-white/10"
              >
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-2 h-8 w-16" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-slate-800/60 border-white/10">
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Top stats grid: Books, Borrows, Damage, Feedbacks, Users */}
          <div className="mb-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {/* Books */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">
                    Books
                  </CardTitle>
                  <p className="text-[11px] text-white/60">
                    Catalog size &amp; availability
                  </p>
                </div>
                <div className="rounded-full border border-emerald-400/40 bg-emerald-500/15 p-2">
                  <BookOpen className="h-4 w-4 text-emerald-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">
                  {booksOverview.total}
                  <span className="ml-1 text-xs text-white/60">
                    books
                  </span>
                </div>
                <p className="text-xs text-white/70">
                  {booksOverview.available} available ·{" "}
                  {booksOverview.unavailable} unavailable
                </p>
                <Link
                  to="/dashboard/librarian/books"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-200 hover:text-emerald-100"
                >
                  Open books page
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Borrow records */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">
                    Borrow records
                  </CardTitle>
                  <p className="text-[11px] text-white/60">
                    Active vs returned loans
                  </p>
                </div>
                <div className="rounded-full border border-sky-400/40 bg-sky-500/15 p-2">
                  <ListChecks className="h-4 w-4 text-sky-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">
                    {activeBorrowCount}
                  </span>
                  <span className="text-xs text-white/60">
                    active
                  </span>
                </div>
                <p className="text-[11px] text-white/70">
                  {borrowOverview.total} total ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    {borrowOverview.returned} returned
                  </span>{" "}
                  ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3 text-amber-300" />
                    {borrowOverview.pending} pending
                  </span>
                </p>
                {!!borrowOverview.totalFine && (
                  <p className="text-[11px] text-white/60">
                    Recorded fines:{" "}
                    <span className="font-medium text-amber-200">
                      ₱{borrowOverview.totalFine.toFixed(2)}
                    </span>
                  </p>
                )}
                <Link
                  to="/dashboard/librarian/borrow-records"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-200 hover:text-sky-100"
                >
                  Open borrow records
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Damage reports */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">
                    Damage reports
                  </CardTitle>
                  <p className="text-[11px] text-white/60">
                    Pending vs assessed vs paid
                  </p>
                </div>
                <div className="rounded-full border border-red-400/40 bg-red-500/15 p-2">
                  <ShieldAlert className="h-4 w-4 text-red-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">
                  {damageOverview.total}
                  <span className="ml-1 text-xs text-white/60">
                    reports
                  </span>
                </div>
                <p className="text-[11px] text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-300" />
                    {damageOverview.pending} pending
                  </span>{" "}
                  ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <BarChart2 className="h-3 w-3 text-sky-300" />
                    {damageOverview.assessed} assessed
                  </span>{" "}
                  ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    {damageOverview.paid} paid
                  </span>
                </p>
                <Link
                  to="/dashboard/librarian/damage-reports"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-200 hover:text-red-100"
                >
                  Open damage reports
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Feedbacks */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">
                    Feedbacks
                  </CardTitle>
                  <p className="text-[11px] text-white/60">
                    Ratings &amp; reviews
                  </p>
                </div>
                <div className="rounded-full border border-yellow-400/40 bg-yellow-500/15 p-2">
                  <MessageSquare className="h-4 w-4 text-yellow-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">
                    {avgRatingLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-white/70">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    avg rating
                  </span>
                </div>
                <p className="text-[11px] text-white/70">
                  {feedbackOverview.total} feedback
                  {feedbackOverview.total === 1 ? "" : "s"} ·{" "}
                  {topPositive} positive · {neutral} neutral ·{" "}
                  {negative} negative
                </p>
                <Link
                  to="/dashboard/librarian/feedbacks"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-yellow-200 hover:text-yellow-100"
                >
                  Open feedback list
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Users */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">
                    Users
                  </CardTitle>
                  <p className="text-[11px] text-white/60">
                    Roles &amp; access
                  </p>
                </div>
                <div className="rounded-full border border-indigo-400/40 bg-indigo-500/15 p-2">
                  <Users2 className="h-4 w-4 text-indigo-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold">
                  {usersOverview.total}
                  <span className="ml-1 text-xs text-white/60">
                    users
                  </span>
                </div>
                <div className="space-y-0.5 text-[11px] text-white/70">
                  {(
                    [
                      "student",
                      "librarian",
                      "faculty",
                      "admin",
                      "other",
                    ] as Role[]
                  ).map((role) => {
                    const count = usersOverview.byRole[role] ?? 0;
                    if (!count) return null;
                    const label =
                      role === "other"
                        ? "Other / guest"
                        : role.charAt(0).toUpperCase() +
                        role.slice(1);
                    return (
                      <div
                        key={role}
                        className="flex items-center justify-between"
                      >
                        <span>{label}</span>
                        <span className="font-mono">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Link
                  to="/dashboard/librarian/users"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-200 hover:text-indigo-100"
                >
                  Open users directory
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Chart + quick notes row */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Borrowing status bar chart */}
            <Card className="bg-slate-800/60 border-white/10 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart2 className="h-4 w-4" />
                    Borrowing status overview
                  </CardTitle>
                  <p className="text-[11px] text-white/60">
                    Distribution of borrowed, pending, and returned
                    records.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-white/20 text-[11px] text-white/70"
                >
                  {borrowOverview.total} records
                </Badge>
              </CardHeader>
              <CardContent className="pt-1">
                {borrowOverview.total === 0 ? (
                  <p className="py-10 text-center text-xs text-white/60">
                    No borrow records yet. Once students start
                    borrowing books, you&apos;ll see the status
                    distribution here.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={borrowChartData}
                        margin={{
                          top: 10,
                          right: 16,
                          left: -16,
                          bottom: 4,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1f2937"
                        />
                        <XAxis
                          dataKey="name"
                          stroke="#e5e7eb"
                          tickLine={false}
                          axisLine={{ stroke: "#1f2937" }}
                          tick={{
                            fill: "#e5e7eb",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          allowDecimals={false}
                          stroke="#e5e7eb"
                          tickLine={false}
                          axisLine={{ stroke: "#1f2937" }}
                          tick={{
                            fill: "#e5e7eb",
                            fontSize: 12,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#020617",
                            borderRadius: 8,
                            border: "1px solid #1f2937",
                            fontSize: 12,
                            color: "#e5e7eb",
                          }}
                          labelStyle={{ color: "#e5e7eb" }}
                          itemStyle={{ color: "#e5e7eb" }}
                        />
                        <Bar
                          dataKey="value"
                          radius={[4, 4, 0, 0]}
                          fill="#38bdf8"
                          activeBar={{ fill: "#0ea5e9" }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick actions / summary notes */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Quick librarian actions
                </CardTitle>
                <p className="text-[11px] text-white/60">
                  Jump directly to the sections that usually need
                  attention.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-white/80">
                <Link
                  to="/dashboard/librarian/borrow-records"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-sky-400/70 hover:bg-sky-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      Verify returns &amp; fines
                    </span>
                    <span className="text-[11px] text-white/60">
                      Manage pending and overdue borrow records.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-sky-200" />
                </Link>

                <Link
                  to="/dashboard/librarian/damage-reports"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-red-400/70 hover:bg-red-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      Assess damage reports
                    </span>
                    <span className="text-[11px] text-white/60">
                      Review photos, set severity, and assign fees.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-red-200" />
                </Link>

                <Link
                  to="/dashboard/librarian/feedbacks"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-yellow-400/70 hover:bg-yellow-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      Read student feedback
                    </span>
                    <span className="text-[11px] text-white/60">
                      See which books students love—or struggle with.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-yellow-200" />
                </Link>

                <Link
                  to="/dashboard/librarian/books"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-emerald-400/70 hover:bg-emerald-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      Manage catalog
                    </span>
                    <span className="text-[11px] text-white/60">
                      Add new titles and keep availability up to date.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-emerald-200" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
