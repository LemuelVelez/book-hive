/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import {
    LayoutDashboard,
    BookOpen,
    Layers,
    ReceiptText,
    MessageSquare,
    RefreshCcw,
    Loader2,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
} from "recharts";

import { fetchMyBorrowRecords, type BorrowRecordDTO } from "@/lib/borrows";
import { fetchMyFines, type FineDTO, type FineStatus } from "@/lib/fines";
import { fetchMyFeedbacks, type FeedbackDTO } from "@/lib/feedbacks";
import { fetchMyDamageReports, type DamageReportDTO } from "@/lib/damageReports";

/* ----------------------------- helpers ----------------------------- */

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

function normalizeFineStatus(raw: any): FineStatus {
    const v = String(raw ?? "").toLowerCase();
    if (v === "paid") return "paid";
    if (v === "cancelled") return "cancelled";
    return "active";
}

/**
 * LOCAL date overdue calculation to avoid timezone off-by-one:
 * returns full days overdue (>= 0)
 */
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

/**
 * Days until due in LOCAL date:
 * - 0 if due today
 * - positive if upcoming
 * - negative if overdue
 */
function daysUntilDue(dueDate?: string | null): number | null {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;

    const now = new Date();
    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffMs = dueLocal.getTime() - todayLocal.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function fmtMonthKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function shortMonthLabel(monthKey: string) {
    // monthKey: YYYY-MM
    const [y, m] = monthKey.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-CA", { month: "short" }); // Jan, Feb...
}

function SimpleTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: any[];
    label?: any;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-md border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-white shadow">
            {label != null && (
                <div className="mb-1 font-semibold text-white/90">{String(label)}</div>
            )}
            <div className="space-y-0.5">
                {payload.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3">
                        <span className="text-white/70">{p.name ?? p.dataKey}</span>
                        <span className="font-semibold text-white">{String(p.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ----------------------------- page ----------------------------- */

export default function FacultyDashboardPage() {
    const [records, setRecords] = React.useState<BorrowRecordDTO[]>([]);
    const [fines, setFines] = React.useState<FineDTO[]>([]);
    const [feedbacks, setFeedbacks] = React.useState<FeedbackDTO[]>([]);
    const [damageReports, setDamageReports] = React.useState<DamageReportDTO[]>([]);

    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const loadAll = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const [r, f, fb, dr] = await Promise.all([
                fetchMyBorrowRecords(),
                fetchMyFines(),
                fetchMyFeedbacks(),
                fetchMyDamageReports(),
            ]);

            setRecords(Array.isArray(r) ? r : []);
            setFines(Array.isArray(f) ? f : []);
            setFeedbacks(Array.isArray(fb) ? fb : []);
            setDamageReports(Array.isArray(dr) ? dr : []);
        } catch (err: any) {
            const msg = err?.message || "Failed to load dashboard data.";
            setError(msg);
            toast.error("Failed to load dashboard", { description: msg });
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
            toast.success("Dashboard refreshed");
        } finally {
            setRefreshing(false);
        }
    }

    /* ----------------------------- KPIs ----------------------------- */

    const activeBorrows = React.useMemo(
        () => records.filter((r) => r.status !== "returned"),
        [records]
    );

    const overdueActiveBorrows = React.useMemo(
        () =>
            activeBorrows.filter((r) => {
                if (r.status !== "borrowed") return false;
                return computeOverdueDays(r.dueDate) > 0;
            }),
        [activeBorrows]
    );

    const dueSoonActiveBorrows = React.useMemo(() => {
        // due within next 3 days (including today), and not already overdue
        return activeBorrows.filter((r) => {
            if (r.status !== "borrowed") return false;
            const d = daysUntilDue(r.dueDate);
            if (d == null) return false;
            return d >= 0 && d <= 3;
        });
    }, [activeBorrows]);

    const totalActiveFines = React.useMemo(() => {
        return fines.reduce((sum, fine) => {
            const status = normalizeFineStatus((fine as any).status);
            if (status !== "active") return sum;
            const amt = normalizeFine(fine.amount);
            return amt > 0 ? sum + amt : sum;
        }, 0);
    }, [fines]);

    const avgRating = React.useMemo(() => {
        if (!feedbacks.length) return 0;
        const sum = feedbacks.reduce((s, fb) => s + (Number(fb.rating) || 0), 0);
        return sum / feedbacks.length;
    }, [feedbacks]);

    const damageStatusSummary = React.useMemo(() => {
        const counts: Record<string, number> = { Pending: 0, Assessed: 0, Paid: 0 };
        for (const r of damageReports) {
            const s = String((r as any).status ?? "").toLowerCase();
            if (s === "paid") counts.Paid += 1;
            else if (s === "assessed") counts.Assessed += 1;
            else counts.Pending += 1;
        }
        return counts;
    }, [damageReports]);

    /* ----------------------------- charts ----------------------------- */

    const borrowStatusChart = React.useMemo(() => {
        const counts = {
            Borrowed: 0,
            "Pending pickup": 0,
            "Pending return": 0,
            Returned: 0,
        };

        for (const r of records) {
            if (r.status === "returned") counts.Returned += 1;
            else if (r.status === "borrowed") counts.Borrowed += 1;
            else if (r.status === "pending_pickup" || r.status === "pending")
                counts["Pending pickup"] += 1;
            else if (r.status === "pending_return") counts["Pending return"] += 1;
            else counts["Pending pickup"] += 1;
        }

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [records]);

    const borrowTrendChart = React.useMemo(() => {
        // last 6 months (including current)
        const now = new Date();
        const months: string[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(fmtMonthKey(d));
        }

        const map: Record<string, number> = {};
        for (const m of months) map[m] = 0;

        for (const r of records) {
            const t = new Date(r.borrowDate);
            if (Number.isNaN(t.getTime())) continue;
            const key = fmtMonthKey(new Date(t.getFullYear(), t.getMonth(), 1));
            if (key in map) map[key] += 1;
        }

        return months.map((m) => ({
            month: shortMonthLabel(m),
            Borrows: map[m] ?? 0,
        }));
    }, [records]);

    const fineStatusChart = React.useMemo(() => {
        const counts: Record<string, number> = { Active: 0, Paid: 0, Cancelled: 0 };
        for (const f of fines) {
            const s = normalizeFineStatus((f as any).status);
            if (s === "active") counts.Active += 1;
            else if (s === "paid") counts.Paid += 1;
            else counts.Cancelled += 1;
        }
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [fines]);

    // Palette (tries to use CSS vars if defined; otherwise falls back)
    const chartPalette = [
        "hsl(var(--chart-1, 262 83% 58%))",
        "hsl(var(--chart-2, 199 89% 48%))",
        "hsl(var(--chart-3, 142 71% 45%))",
        "hsl(var(--chart-4, 38 92% 50%))",
        "hsl(var(--chart-5, 0 84% 60%))",
    ];

    /* ----------------------------- render ----------------------------- */

    return (
        <DashboardLayout title="Faculty Dashboard">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Overview</h2>
                        <p className="text-xs text-white/70">
                            Quick stats about your borrows, fines, feedback, and damage reports.
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
                        aria-label="Refresh dashboard"
                    >
                        {refreshing || loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="sr-only">Refresh</span>
                    </Button>
                </div>
            </div>

            {error && !loading ? (
                <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            {/* KPI cards */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Layers className="h-4 w-4 text-sky-200" aria-hidden="true" />
                            Active borrows
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <>
                                <div className="text-2xl font-semibold text-white">
                                    {activeBorrows.length}
                                </div>
                                <div className="mt-1 text-xs text-white/60">
                                    Due soon:{" "}
                                    <span className="font-semibold text-amber-200">
                                        {dueSoonActiveBorrows.length}
                                    </span>{" "}
                                    • Overdue:{" "}
                                    <span className="font-semibold text-red-300">
                                        {overdueActiveBorrows.length}
                                    </span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ReceiptText className="h-4 w-4 text-amber-200" aria-hidden="true" />
                            Active fines
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <>
                                <div className="text-2xl font-semibold text-white">
                                    {peso(totalActiveFines)}
                                </div>
                                <div className="mt-1 text-xs text-white/60">
                                    Total fine records:{" "}
                                    <span className="font-semibold text-white/80">
                                        {fines.length}
                                    </span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-purple-200" aria-hidden="true" />
                            Feedback
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <>
                                <div className="text-2xl font-semibold text-white">
                                    {feedbacks.length}
                                </div>
                                <div className="mt-1 text-xs text-white/60">
                                    Avg rating:{" "}
                                    <span className="font-semibold text-yellow-200">
                                        {avgRating ? avgRating.toFixed(2) : "—"}
                                    </span>{" "}
                                    / 5
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-200" aria-hidden="true" />
                            Damage reports
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <>
                                <div className="text-2xl font-semibold text-white">
                                    {damageReports.length}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/70">
                                    <Badge className="bg-slate-700/70 border-white/10">
                                        Pending: {damageStatusSummary.Pending}
                                    </Badge>
                                    <Badge className="bg-amber-600/70 border-amber-400/20">
                                        Assessed: {damageStatusSummary.Assessed}
                                    </Badge>
                                    <Badge className="bg-emerald-600/70 border-emerald-400/20">
                                        Paid: {damageStatusSummary.Paid}
                                    </Badge>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Quick actions (routes verified from your App.tsx) */}
            <Card className="mt-4 bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                        Quick actions
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row flex-wrap gap-2">
                    <Button
                        asChild
                        className="bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    >
                        <Link to="/dashboard/faculty/books">
                            <BookOpen className="h-4 w-4 mr-2" aria-hidden="true" />
                            Browse books
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                    >
                        <Link to="/dashboard/faculty/circulation">
                            <Layers className="h-4 w-4 mr-2" aria-hidden="true" />
                            My circulation
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                    >
                        <Link to="/dashboard/faculty/fines">
                            <ReceiptText className="h-4 w-4 mr-2" aria-hidden="true" />
                            My fines
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                    >
                        <Link to="/dashboard/faculty/insights">
                            <MessageSquare className="h-4 w-4 mr-2" aria-hidden="true" />
                            Insights Hub
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Charts */}
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Borrow status breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-56 w-full" />
                        ) : (
                            <div className="h-60">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={borrowStatusChart}>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="rgba(255,255,255,0.08)"
                                        />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                        />
                                        <RechartsTooltip content={<SimpleTooltip />} />
                                        <Legend />
                                        <Bar
                                            dataKey="value"
                                            name="Records"
                                            fill={chartPalette[0]}
                                            radius={[6, 6, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Borrow trend (last 6 months)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-56 w-full" />
                        ) : (
                            <div className="h-60">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={borrowTrendChart}>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="rgba(255,255,255,0.08)"
                                        />
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                        />
                                        <RechartsTooltip content={<SimpleTooltip />} />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="Borrows"
                                            stroke={chartPalette[1]}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-white/10 lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Fines status distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-60 w-full" />
                        ) : fines.length === 0 ? (
                            <div className="py-10 text-center text-sm text-white/70">
                                No fines found.
                            </div>
                        ) : (
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <RechartsTooltip content={<SimpleTooltip />} />
                                        <Legend />
                                        <Pie
                                            data={fineStatusChart}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                        >
                                            {fineStatusChart.map((_, idx) => (
                                                <Cell
                                                    key={idx}
                                                    fill={chartPalette[idx % chartPalette.length]}
                                                />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
