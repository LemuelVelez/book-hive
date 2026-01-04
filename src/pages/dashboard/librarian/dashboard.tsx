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
  ReceiptText,
  Coins,
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

type RatingBuckets = Record<1 | 2 | 3 | 4 | 5, number>;

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

type FineStatus = "active" | "pending_verification" | "paid" | "cancelled";

type FinesOverview = {
  total: number;
  active: number;
  pendingVerification: number;
  paid: number;
  cancelled: number;
  totalAmount: number;
  activeAmount: number;
  pendingAmount: number;
};

type DamageSeverity = "minor" | "moderate" | "major";

type IncomeOverview = {
  paidTotal: number;
  paidCount: number;
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

const EMPTY_FINES_OVERVIEW: FinesOverview = {
  total: 0,
  active: 0,
  pendingVerification: 0,
  paid: 0,
  cancelled: 0,
  totalAmount: 0,
  activeAmount: 0,
  pendingAmount: 0,
};

const EMPTY_INCOME_OVERVIEW: IncomeOverview = {
  paidTotal: 0,
  paidCount: 0,
};

/* ------------------------ Local helpers ------------------------ */

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
    if (status === "borrowed") borrowed += 1;
    else if (status === "pending") pending += 1;
    else if (status === "returned") returned += 1;

    const fine = Number((r as any)?.fine ?? 0);
    if (!Number.isNaN(fine) && fine > 0) totalFine += fine;
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
    const raw = Number((f as any)?.rating ?? 0);
    const rating =
      raw >= 1 && raw <= 5 && Number.isFinite(raw) ? (raw as 1 | 2 | 3 | 4 | 5) : null;

    if (rating) {
      buckets[rating] += 1;
      sum += rating;
      count += 1;
    }
  }

  return {
    total: feedbacks.length,
    avgRating: count ? sum / count : 0,
    buckets,
  };
}

function peso(n: number): string {
  if (typeof n !== "number" || Number.isNaN(n)) n = 0;
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

function normalizeAmount(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Simple suggested fee policy (fallback only):
 * - minor: ₱50
 * - moderate: ₱150
 * - major: ₱300
 */
function suggestedFineFromSeverity(severity?: DamageSeverity | null): number {
  switch (severity) {
    case "minor":
      return 50;
    case "moderate":
      return 150;
    case "major":
      return 300;
    default:
      return 0;
  }
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

/**
 * Fines overview for librarian dashboard.
 * Fetches all fines from /api/fines and aggregates by status + amounts.
 */
async function fetchFinesOverview(): Promise<FinesOverview> {
  const endpoint = `${API_BASE}/api/fines`;
  const res = await fetch(endpoint, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => "")) || `HTTP ${res.status}`;
    throw new Error(`Failed to fetch fines from ${endpoint}. ${text}`);
  }

  const data: any = await res.json().catch(() => null);
  const list: any[] = Array.isArray(data?.fines)
    ? data.fines
    : Array.isArray(data)
      ? data
      : [];

  const summary: FinesOverview = {
    total: list.length,
    active: 0,
    pendingVerification: 0,
    paid: 0,
    cancelled: 0,
    totalAmount: 0,
    activeAmount: 0,
    pendingAmount: 0,
  };

  for (const item of list) {
    const status = String(item?.status ?? "").toLowerCase() as FineStatus;
    const amount = Number(item?.amount ?? 0);
    const amt = !Number.isNaN(amount) && amount > 0 ? amount : 0;

    if (status === "active") summary.active += 1;
    else if (status === "pending_verification") summary.pendingVerification += 1;
    else if (status === "paid") summary.paid += 1;
    else if (status === "cancelled") summary.cancelled += 1;

    if (amt > 0) {
      summary.totalAmount += amt;
      if (status === "active") summary.activeAmount += amt;
      if (status === "pending_verification") summary.pendingAmount += amt;
    }
  }

  return summary;
}

/**
 * Income overview for librarian dashboard.
 * - sums PAID fines from /api/fines
 * - plus PAID damage-report fees that are not yet represented by a fine row
 */
async function fetchIncomeOverview(): Promise<IncomeOverview> {
  const finesEndpoint = `${API_BASE}/api/fines`;
  const finesRes = await fetch(finesEndpoint, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!finesRes.ok) {
    const text = (await finesRes.text().catch(() => "")) || `HTTP ${finesRes.status}`;
    throw new Error(`Failed to fetch fines from ${finesEndpoint}. ${text}`);
  }

  const finesData: any = await finesRes.json().catch(() => null);
  const fineList: any[] = Array.isArray(finesData?.fines)
    ? finesData.fines
    : Array.isArray(finesData)
      ? finesData
      : [];

  let paidTotal = 0;
  let paidCount = 0;
  const existingDamageIds = new Set<string>();

  for (const f of fineList) {
    const anyFine = f as any;
    const status = String(anyFine?.status ?? "").toLowerCase() as FineStatus;
    const amt = normalizeAmount(anyFine?.amount);

    if (status === "paid") {
      paidCount += 1;
      if (amt > 0) paidTotal += amt;
    }

    const drId =
      anyFine?.damageReportId ?? anyFine?.damageId ?? anyFine?.damageReportID ?? null;
    if (drId !== null && drId !== undefined && String(drId).trim() !== "") {
      existingDamageIds.add(String(drId));
    }
  }

  // Try to include paid damage fees if backend hasn't created a fine row yet.
  try {
    const drRes = await fetch(`${API_BASE}/api/damage-reports`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!drRes.ok) {
      // Do not fail the dashboard if damage reports are temporarily unavailable.
      return { paidTotal, paidCount };
    }

    const drData: any = await drRes.json().catch(() => null);
    const reports: any[] = Array.isArray(drData?.reports)
      ? drData.reports
      : Array.isArray(drData)
        ? drData
        : [];

    for (const r of reports) {
      const anyReport = r as any;
      const status = String(anyReport?.status ?? "").toLowerCase() as DamageStatus;
      if (status !== "paid") continue;

      const idStr = String(anyReport?.id ?? "").trim();
      if (!idStr) continue;
      if (existingDamageIds.has(idStr)) continue;

      let fee = normalizeAmount(anyReport?.fee);
      if (fee <= 0) {
        fee = suggestedFineFromSeverity(anyReport?.severity as DamageSeverity);
      }
      if (fee <= 0) continue;

      paidCount += 1;
      paidTotal += fee;
    }
  } catch {
    // ignore - fines-based income still works
  }

  return { paidTotal, paidCount };
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
  const [finesOverview, setFinesOverview] =
    React.useState<FinesOverview>(EMPTY_FINES_OVERVIEW);

  const [incomeOverview, setIncomeOverview] =
    React.useState<IncomeOverview>(EMPTY_INCOME_OVERVIEW);

  const loadOverview = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [booksList, borrowList, feedbackList, damage, users, fines, income] =
        await Promise.all([
          fetchBooks(),
          fetchBorrowRecords(),
          fetchFeedbacks(),
          fetchDamageOverview(),
          fetchUsersOverview(),
          fetchFinesOverview(),
          fetchIncomeOverview(),
        ]);

      setBooksOverview(summarizeBooks(booksList));
      setBorrowOverview(summarizeBorrows(borrowList));
      setFeedbackOverview(summarizeFeedbacks(feedbackList));
      setDamageOverview(damage);
      setUsersOverview(users);
      setFinesOverview(fines);
      setIncomeOverview(income);
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
    [borrowOverview.borrowed, borrowOverview.pending, borrowOverview.returned]
  );

  const activeBorrowCount = borrowOverview.borrowed + borrowOverview.pending;

  const avgRatingLabel =
    feedbackOverview.avgRating > 0
      ? feedbackOverview.avgRating.toFixed(1)
      : "—";

  return (
    <DashboardLayout>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Librarian dashboard
          </h1>
          <p className="text-sm text-white/60">
            Overview of catalog health, circulation, fines, and student
            activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-white/10 bg-red-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-200">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-100">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <>
          {/* Skeleton cards */}
          <div className="mb-4 grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <Card key={i} className="bg-slate-800/60 border-white/10">
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

          {/* Skeleton chart + quick action card */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="bg-slate-800/60 border-white/10 lg:col-span-2">
              <CardHeader>
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          {/* Top stats grid: Books, Borrows, Fines, Income, Damage, Feedbacks, Users */}
          <div className="mb-4 grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {/* Books */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">Books</CardTitle>
                  <p className="text-[11px] text-white/60">Catalog at a glance</p>
                </div>
                <div className="rounded-full border border-emerald-400/40 bg-emerald-500/15 p-2">
                  <BookOpen className="h-4 w-4 text-emerald-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">
                  {booksOverview.total}
                  <span className="ml-1 text-xs text-white/60">titles</span>
                </div>
                <p className="text-[11px] text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    {booksOverview.available} available
                  </span>{" "}
                  ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-300" />
                    {booksOverview.unavailable} unavailable
                  </span>
                </p>
                <Link
                  to="/dashboard/librarian/books"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-200 hover:text-emerald-100"
                >
                  Open catalog
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Borrow records */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">Borrow records</CardTitle>
                  <p className="text-[11px] text-white/60">
                    Active &amp; pending circulation
                  </p>
                </div>
                <div className="rounded-full border border-sky-400/40 bg-sky-500/15 p-2">
                  <ListChecks className="h-4 w-4 text-sky-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">
                  {borrowOverview.total}
                  <span className="ml-1 text-xs text-white/60">records</span>
                </div>
                <p className="text-[11px] text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3 text-sky-300" />
                    {activeBorrowCount} active
                  </span>{" "}
                  ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    {borrowOverview.returned} returned
                  </span>
                </p>
                {borrowOverview.totalFine > 0 && (
                  <p className="text-[11px] text-white/60">
                    Total fines recorded:{" "}
                    <span className="font-medium text-amber-200">
                      {peso(borrowOverview.totalFine)}
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

            {/* Fines */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">Fines</CardTitle>
                  <p className="text-[11px] text-white/60">
                    Active &amp; pending payments
                  </p>
                </div>
                <div className="rounded-full border border-amber-400/40 bg-amber-500/15 p-2">
                  <ReceiptText className="h-4 w-4 text-amber-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">
                  {finesOverview.total}
                  <span className="ml-1 text-xs text-white/60">fines</span>
                </div>
                <p className="text-[11px] text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-300" />
                    {finesOverview.active} active
                  </span>{" "}
                  ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3 text-yellow-300" />
                    {finesOverview.pendingVerification} pending verification
                  </span>{" "}
                  ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    {finesOverview.paid} paid
                  </span>
                </p>
                {finesOverview.totalAmount > 0 && (
                  <p className="text-[11px] text-white/60">
                    Active:{" "}
                    <span className="font-medium text-amber-200">
                      {peso(finesOverview.activeAmount)}
                    </span>{" "}
                    · Pending:{" "}
                    <span className="font-medium text-yellow-200">
                      {peso(finesOverview.pendingAmount)}
                    </span>
                    <br />
                    Total recorded:{" "}
                    <span className="font-medium text-emerald-200">
                      {peso(finesOverview.totalAmount)}
                    </span>
                  </p>
                )}
                <Link
                  to="/dashboard/librarian/fines"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-200 hover:text-amber-100"
                >
                  Open fines &amp; payments
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Income */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">Income</CardTitle>
                  <p className="text-[11px] text-white/60">
                    Paid fines &amp; damage fees
                  </p>
                </div>
                <div className="rounded-full border border-emerald-400/40 bg-emerald-500/15 p-2">
                  <Coins className="h-4 w-4 text-emerald-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">
                  {peso(incomeOverview.paidTotal)}
                </div>
                <p className="text-[11px] text-white/70">
                  {incomeOverview.paidCount} paid transaction
                  {incomeOverview.paidCount === 1 ? "" : "s"}
                </p>
                <Link
                  to="/dashboard/librarian/income"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-200 hover:text-emerald-100"
                >
                  Open income summary
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Damage reports */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">Damage reports</CardTitle>
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
                  <span className="ml-1 text-xs text-white/60">reports</span>
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
                  <CardTitle className="text-sm">Feedback</CardTitle>
                  <p className="text-[11px] text-white/60">
                    Ratings &amp; comments
                  </p>
                </div>
                <div className="rounded-full border border-yellow-400/40 bg-yellow-500/15 p-2">
                  <MessageSquare className="h-4 w-4 text-yellow-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">{avgRatingLabel}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-white/70">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    avg rating
                  </span>
                </div>
                <p className="text-[11px] text-white/70">
                  {feedbackOverview.total}
                  <span className="ml-1 text-xs text-white/60">entries</span>
                </p>
                <Link
                  to="/dashboard/librarian/feedbacks"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-yellow-200 hover:text-yellow-100"
                >
                  Open feedback
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Users */}
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm">Users</CardTitle>
                  <p className="text-[11px] text-white/60">Roles &amp; access</p>
                </div>
                <div className="rounded-full border border-indigo-400/40 bg-indigo-500/15 p-2">
                  <Users2 className="h-4 w-4 text-indigo-300" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold">
                  {usersOverview.total}
                  <span className="ml-1 text-xs text-white/60">users</span>
                </div>
                <div className="space-y-0.5 text-[11px] text-white/70">
                  {(
                    ["student", "librarian", "faculty", "admin", "other"] as Role[]
                  ).map((role) => {
                    const count = usersOverview.byRole[role] ?? 0;
                    if (!count) return null;
                    const label =
                      role === "other"
                        ? "Other / guest"
                        : role.charAt(0).toUpperCase() + role.slice(1);
                    return (
                      <div key={role} className="flex items-center justify-between">
                        <span>{label}</span>
                        <span className="font-mono">{count}</span>
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
                    Distribution of borrowed, pending, and returned records.
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
                    No borrow records yet. Once students start borrowing books,
                    you&apos;ll see the status distribution here.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={borrowChartData}
                        margin={{ top: 10, right: 16, left: -16, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                          dataKey="name"
                          stroke="#e5e7eb"
                          tickLine={false}
                          axisLine={{ stroke: "#1f2937" }}
                          tick={{ fill: "#e5e7eb", fontSize: 12 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          stroke="#e5e7eb"
                          tickLine={false}
                          axisLine={{ stroke: "#1f2937" }}
                          tick={{ fill: "#e5e7eb", fontSize: 12 }}
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
                <CardTitle className="text-sm">Quick librarian actions</CardTitle>
                <p className="text-[11px] text-white/60">
                  Jump directly to the sections that usually need attention.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-white/80">
                <Link
                  to="/dashboard/librarian/borrow-records"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-sky-400/70 hover:bg-sky-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">Verify returns &amp; fines</span>
                    <span className="text-[11px] text-white/60">
                      Manage pending and overdue borrow records.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-sky-200" />
                </Link>

                <Link
                  to="/dashboard/librarian/fines"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-amber-400/70 hover:bg-amber-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">Review fines &amp; payments</span>
                    <span className="text-[11px] text-white/60">
                      Track active fines and verify student payments.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-amber-200" />
                </Link>

                <Link
                  to="/dashboard/librarian/damage-reports"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-red-400/70 hover:bg-red-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">Assess damage reports</span>
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
                    <span className="font-medium">Read student feedback</span>
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
                    <span className="font-medium">Manage catalog</span>
                    <span className="text-[11px] text-white/60">
                      Add new titles and keep availability up to date.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-emerald-200" />
                </Link>

                <Link
                  to="/dashboard/librarian/income"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-emerald-400/70 hover:bg-emerald-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">View income summary</span>
                    <span className="text-[11px] text-white/60">
                      See paid fines and assessed damage fees.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-emerald-200" />
                </Link>

                <Link
                  to="/dashboard/librarian/settings"
                  className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 hover:border-slate-300/70 hover:bg-slate-500/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">Librarian settings</span>
                    <span className="text-[11px] text-white/60">
                      Configure your dashboard preferences.
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-200" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
