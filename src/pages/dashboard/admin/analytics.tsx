/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { toast } from "sonner";
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    CircleDollarSign,
    ListChecks,
    MessageSquare,
    RefreshCcw,
    Users2,
} from "lucide-react";

import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    Tooltip as RechartsTooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LineChart,
    Line,
} from "recharts";

import { type Role, type UserListItemDTO, listUsers } from "@/lib/authentication";
import { fetchBooks, type BookDTO } from "@/lib/books";
import {
    fetchBorrowRecords,
    type BorrowRecordDTO,
    type BorrowStatus,
} from "@/lib/borrows";
import { fetchFines, type FineDTO, type FineStatus } from "@/lib/fines";
import {
    fetchDamageReports,
    type DamageReportDTO,
    type DamageSeverity,
    type DamageStatus,
} from "@/lib/damageReports";
import { fetchFeedbacks, type FeedbackDTO } from "@/lib/feedbacks";

type TimeRange = "6m" | "12m" | "24m";

const ROLE_ORDER: Role[] = ["student", "other", "faculty", "librarian", "admin"];

const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

function safeParseDate(v?: string | null): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
}

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function monthKeyUTC(d: Date) {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function monthLabelFromKey(key: string) {
    // key: YYYY-MM
    const [y, m] = key.split("-").map((x) => Number(x));
    if (!y || !m) return key;
    const d = new Date(Date.UTC(y, m - 1, 1));
    return new Intl.DateTimeFormat(undefined, { month: "short" }).format(d);
}

function buildMonthKeysUTC(monthsBack: number) {
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    start.setUTCMonth(start.getUTCMonth() - (monthsBack - 1));

    const keys: string[] = [];
    const cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
        keys.push(monthKeyUTC(cur));
        cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return keys;
}

function sum(nums: number[]) {
    let s = 0;
    for (const n of nums) s += n;
    return s;
}

export default function AdminAnalyticsPage() {
    const [range, setRange] = React.useState<TimeRange>("12m");

    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);

    const [users, setUsers] = React.useState<UserListItemDTO[]>([]);
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [borrows, setBorrows] = React.useState<BorrowRecordDTO[]>([]);
    const [fines, setFines] = React.useState<FineDTO[]>([]);
    const [damageReports, setDamageReports] = React.useState<DamageReportDTO[]>(
        []
    );
    const [feedbacks, setFeedbacks] = React.useState<FeedbackDTO[]>([]);

    const [partialErrors, setPartialErrors] = React.useState<string[]>([]);

    const loadAll = React.useCallback(async () => {
        setPartialErrors([]);
        const errors: string[] = [];

        const results = await Promise.allSettled([
            listUsers(),
            fetchBooks(),
            fetchBorrowRecords(),
            fetchFines(),
            fetchDamageReports(),
            fetchFeedbacks(),
        ]);

        const [usersRes, booksRes, borrowsRes, finesRes, damageRes, feedbacksRes] =
            results;

        if (usersRes.status === "fulfilled") setUsers(usersRes.value);
        else errors.push(usersRes.reason?.message || "Failed to load users.");

        if (booksRes.status === "fulfilled") setBooks(booksRes.value);
        else errors.push(booksRes.reason?.message || "Failed to load books.");

        if (borrowsRes.status === "fulfilled") setBorrows(borrowsRes.value);
        else
            errors.push(
                borrowsRes.reason?.message || "Failed to load borrow records."
            );

        if (finesRes.status === "fulfilled") setFines(finesRes.value);
        else errors.push(finesRes.reason?.message || "Failed to load fines.");

        if (damageRes.status === "fulfilled") setDamageReports(damageRes.value);
        else
            errors.push(
                damageRes.reason?.message || "Failed to load damage reports."
            );

        if (feedbacksRes.status === "fulfilled") setFeedbacks(feedbacksRes.value);
        else errors.push(feedbacksRes.reason?.message || "Failed to load feedbacks.");

        if (errors.length) {
            setPartialErrors(errors);
            toast.error("Some analytics data failed to load", {
                description: errors[0],
            });
        }
    }, []);

    React.useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                await loadAll();
            } finally {
                setLoading(false);
            }
        })();
    }, [loadAll]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadAll();
            toast.success("Analytics refreshed");
        } catch {
            // handled in loadAll
        } finally {
            setRefreshing(false);
        }
    };

    const pendingUsers = React.useMemo(
        () => users.filter((u) => !u.isApproved).length,
        [users]
    );

    const countsByRole = React.useMemo(() => {
        const m: Record<Role, number> = {
            student: 0,
            other: 0,
            faculty: 0,
            librarian: 0,
            admin: 0,
        };
        for (const u of users) {
            const r = u.accountType;
            m[r] = (m[r] ?? 0) + 1;
        }
        return m;
    }, [users]);

    const usersByRoleChart = React.useMemo(() => {
        return ROLE_ORDER.map((r) => ({
            name: r,
            value: countsByRole[r] ?? 0,
        })).filter((x) => x.value > 0);
    }, [countsByRole]);

    const borrowStatusCounts = React.useMemo(() => {
        const m: Record<BorrowStatus, number> = {
            borrowed: 0,
            pending: 0,
            pending_pickup: 0,
            pending_return: 0,
            returned: 0,
        };
        for (const b of borrows) {
            m[b.status] = (m[b.status] ?? 0) + 1;
        }
        return m;
    }, [borrows]);

    const borrowStatusChart = React.useMemo(() => {
        const order: BorrowStatus[] = [
            "pending_pickup",
            "borrowed",
            "pending_return",
            "returned",
            "pending",
        ];
        const label = (s: BorrowStatus) => {
            if (s === "pending_pickup") return "pending pickup";
            if (s === "pending_return") return "pending return";
            return s;
        };
        return order
            .map((k) => ({ status: label(k), value: borrowStatusCounts[k] ?? 0 }))
            .filter((x) => x.value > 0);
    }, [borrowStatusCounts]);

    const activeBorrows = React.useMemo(() => {
        return borrows.filter((b) => b.status !== "returned").length;
    }, [borrows]);

    const booksTotals = React.useMemo(() => {
        const titles = books.length;
        const totalCopies = sum(
            books.map((b) => {
                // Prefer totalCopies if backend provides it; fallback to numberOfCopies (remaining)
                const tc = (b as any).totalCopies;
                if (typeof tc === "number") return tc;
                const nc = (b as any).numberOfCopies;
                if (typeof nc === "number") return nc;
                return 0;
            })
        );
        const borrowedCopies = sum(
            books.map((b) => {
                const bc = (b as any).borrowedCopies;
                return typeof bc === "number" ? bc : 0;
            })
        );
        return { titles, totalCopies, borrowedCopies };
    }, [books]);

    const finesByStatus = React.useMemo(() => {
        const m: Record<FineStatus, { count: number; amount: number }> = {
            active: { count: 0, amount: 0 },
            paid: { count: 0, amount: 0 },
            cancelled: { count: 0, amount: 0 },
        };
        for (const f of fines) {
            const st = f.status;
            m[st].count += 1;
            m[st].amount += Number(f.amount || 0);
        }
        return m;
    }, [fines]);

    const finesStatusChart = React.useMemo(() => {
        const order: FineStatus[] = ["active", "paid", "cancelled"];
        return order.map((s) => ({
            status: s,
            count: finesByStatus[s].count,
            amount: Math.round(finesByStatus[s].amount * 100) / 100,
        }));
    }, [finesByStatus]);

    const damageByStatus = React.useMemo(() => {
        const m: Record<DamageStatus, number> = {
            pending: 0,
            assessed: 0,
            paid: 0,
        };
        for (const r of damageReports) m[r.status] = (m[r.status] ?? 0) + 1;
        return m;
    }, [damageReports]);

    const damageBySeverity = React.useMemo(() => {
        const m: Record<DamageSeverity, number> = {
            minor: 0,
            moderate: 0,
            major: 0,
        };
        for (const r of damageReports) m[r.severity] = (m[r.severity] ?? 0) + 1;
        return m;
    }, [damageReports]);

    const totalDamageFees = React.useMemo(() => {
        return sum(damageReports.map((r) => Number(r.fee || 0)));
    }, [damageReports]);

    const ratingDistribution = React.useMemo(() => {
        const m: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const f of feedbacks) {
            const r = Math.max(1, Math.min(5, Math.round(Number(f.rating || 0))));
            m[r] = (m[r] ?? 0) + 1;
        }
        return [1, 2, 3, 4, 5].map((r) => ({
            rating: `${r}★`,
            value: m[r] ?? 0,
        }));
    }, [feedbacks]);

    const recentFeedbacks = React.useMemo(() => {
        const withDate = feedbacks
            .map((f) => ({ f, d: safeParseDate(f.createdAt ?? null) }))
            .sort((a, b) => (b.d?.getTime() ?? 0) - (a.d?.getTime() ?? 0))
            .slice(0, 8)
            .map((x) => x.f);
        return withDate;
    }, [feedbacks]);

    const monthsBack = React.useMemo(() => {
        if (range === "6m") return 6;
        if (range === "24m") return 24;
        return 12;
    }, [range]);

    const trends = React.useMemo(() => {
        const keys = buildMonthKeysUTC(monthsBack);

        const borrowCount: Record<string, number> = {};
        const returnCount: Record<string, number> = {};
        const fineCount: Record<string, number> = {};
        const damageCount: Record<string, number> = {};

        for (const k of keys) {
            borrowCount[k] = 0;
            returnCount[k] = 0;
            fineCount[k] = 0;
            damageCount[k] = 0;
        }

        for (const b of borrows) {
            const bd = safeParseDate(b.borrowDate);
            if (bd) {
                const k = monthKeyUTC(bd);
                if (k in borrowCount) borrowCount[k] += 1;
            }
            const rd = safeParseDate(b.returnDate);
            if (rd) {
                const k = monthKeyUTC(rd);
                if (k in returnCount) returnCount[k] += 1;
            }
        }

        for (const f of fines) {
            const cd = safeParseDate(f.createdAt);
            if (cd) {
                const k = monthKeyUTC(cd);
                if (k in fineCount) fineCount[k] += 1;
            }
        }

        for (const r of damageReports) {
            const dd = safeParseDate(r.reportedAt);
            if (dd) {
                const k = monthKeyUTC(dd);
                if (k in damageCount) damageCount[k] += 1;
            }
        }

        return keys.map((k) => ({
            month: monthLabelFromKey(k),
            borrows: borrowCount[k] ?? 0,
            returns: returnCount[k] ?? 0,
            fines: fineCount[k] ?? 0,
            damages: damageCount[k] ?? 0,
        }));
    }, [borrows, fines, damageReports, monthsBack]);

    const kpi = React.useMemo(() => {
        const totalUsers = users.length;
        const approvedUsers = users.filter((u) => u.isApproved).length;

        const activeFineAmount = finesByStatus.active.amount;
        const activeFineCount = finesByStatus.active.count;

        const pendingDamage = damageByStatus.pending ?? 0;
        const assessedDamage = damageByStatus.assessed ?? 0;

        return {
            totalUsers,
            approvedUsers,
            pendingUsers,
            activeBorrows,
            bookTitles: booksTotals.titles,
            totalCopies: booksTotals.totalCopies,
            borrowedCopies: booksTotals.borrowedCopies,
            activeFineAmount,
            activeFineCount,
            pendingDamage,
            assessedDamage,
            totalDamageFees,
        };
    }, [
        users,
        pendingUsers,
        activeBorrows,
        booksTotals,
        finesByStatus,
        damageByStatus,
        totalDamageFees,
    ]);

    return (
        <DashboardLayout title="Analytics">
            <TooltipProvider>
                <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        <div>
                            <h2 className="text-lg font-semibold leading-tight">
                                Admin analytics
                            </h2>
                            <p className="text-xs text-white/70">
                                High-level metrics for users, circulation, fines, feedback, and
                                reports.
                            </p>
                            {partialErrors.length ? (
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-200/90">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span>
                                        Partial data loaded ({partialErrors.length}). Some charts may
                                        be incomplete.
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-[170px]">
                            <Select
                                value={range}
                                onValueChange={(v) => setRange(v as TimeRange)}
                            >
                                <SelectTrigger className="bg-slate-900/70 border-white/15 text-white">
                                    <SelectValue placeholder="Range" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 text-white border-white/10">
                                    <SelectItem value="6m">Last 6 months</SelectItem>
                                    <SelectItem value="12m">Last 12 months</SelectItem>
                                    <SelectItem value="24m">Last 24 months</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                        >
                            <RefreshCcw
                                className={`h-4 w-4 mr-2 ${refreshing || loading ? "animate-spin" : ""
                                    }`}
                            />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* KPI Row */}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
                    {loading ? (
                        <>
                            <Skeleton className="h-[92px] w-full" />
                            <Skeleton className="h-[92px] w-full" />
                            <Skeleton className="h-[92px] w-full" />
                            <Skeleton className="h-[92px] w-full" />
                        </>
                    ) : (
                        <>
                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold inline-flex items-center gap-2">
                                        <Users2 className="h-4 w-4" />
                                        Users
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="ml-1 cursor-help text-white/40">
                                                    ⓘ
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white border-white/10">
                                                Total users and approval backlog.
                                            </TooltipContent>
                                        </Tooltip>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">{kpi.totalUsers}</div>
                                    <div className="mt-1 text-xs text-white/70 flex items-center gap-2 flex-wrap">
                                        <Badge className="bg-emerald-600/80 border-emerald-500/60 text-white">
                                            approved: {kpi.approvedUsers}
                                        </Badge>
                                        <Badge className="bg-orange-600/80 border-orange-500/60 text-white">
                                            pending: {kpi.pendingUsers}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold inline-flex items-center gap-2">
                                        <BookOpen className="h-4 w-4" />
                                        Inventory
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">{kpi.bookTitles}</div>
                                    <div className="mt-1 text-xs text-white/70">
                                        Copies tracked:{" "}
                                        <span className="text-white/85 font-medium">
                                            {kpi.totalCopies}
                                        </span>
                                        {kpi.borrowedCopies ? (
                                            <>
                                                {" "}
                                                • Borrowed:{" "}
                                                <span className="text-white/85 font-medium">
                                                    {kpi.borrowedCopies}
                                                </span>
                                            </>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold inline-flex items-center gap-2">
                                        <ListChecks className="h-4 w-4" />
                                        Circulation
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">
                                        {kpi.activeBorrows}
                                    </div>
                                    <div className="mt-1 text-xs text-white/70">
                                        Active borrow records (not returned)
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold inline-flex items-center gap-2">
                                        <CircleDollarSign className="h-4 w-4" />
                                        Fines
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">
                                        ₱{kpi.activeFineAmount.toFixed(2)}
                                    </div>
                                    <div className="mt-1 text-xs text-white/70">
                                        Active:{" "}
                                        <span className="text-white/85 font-medium">
                                            {kpi.activeFineCount}
                                        </span>{" "}
                                        {kpi.pendingDamage || kpi.assessedDamage ? (
                                            <>
                                                • Damage pending/assessed:{" "}
                                                <span className="text-white/85 font-medium">
                                                    {kpi.pendingDamage}/{kpi.assessedDamage}
                                                </span>
                                            </>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="bg-slate-900/60 border border-white/10">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="trends">Trends</TabsTrigger>
                        <TabsTrigger value="finance">Fines & Reports</TabsTrigger>
                        <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-3 space-y-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Users by role</CardTitle>
                                </CardHeader>
                                <CardContent className="h-80">
                                    {loading ? (
                                        <Skeleton className="h-full w-full" />
                                    ) : usersByRoleChart.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-white/70">
                                            No user data.
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <RechartsTooltip
                                                    contentStyle={{
                                                        background: "hsl(var(--background))",
                                                        border: "1px solid rgba(255,255,255,0.12)",
                                                        color: "hsl(var(--foreground))",
                                                    }}
                                                />
                                                <Legend />
                                                <Pie
                                                    data={usersByRoleChart}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={2}
                                                >
                                                    {usersByRoleChart.map((_, idx) => (
                                                        <Cell
                                                            key={`cell-${idx}`}
                                                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                                        />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Borrow status breakdown</CardTitle>
                                </CardHeader>
                                <CardContent className="h-80">
                                    {loading ? (
                                        <Skeleton className="h-full w-full" />
                                    ) : borrowStatusChart.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-white/70">
                                            No circulation data.
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={borrowStatusChart}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                                <XAxis
                                                    dataKey="status"
                                                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                                />
                                                <YAxis
                                                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                                />
                                                <RechartsTooltip
                                                    contentStyle={{
                                                        background: "hsl(var(--background))",
                                                        border: "1px solid rgba(255,255,255,0.12)",
                                                        color: "hsl(var(--foreground))",
                                                    }}
                                                />
                                                <Bar
                                                    dataKey="value"
                                                    fill="hsl(var(--chart-2))"
                                                    radius={[6, 6, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="bg-slate-800/60 border-white/10">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Quick notes</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-white/70">
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>
                                        Pending approvals:{" "}
                                        <span className="text-white/85 font-medium">
                                            {kpi.pendingUsers}
                                        </span>
                                    </li>
                                    <li>
                                        Active borrow records:{" "}
                                        <span className="text-white/85 font-medium">
                                            {kpi.activeBorrows}
                                        </span>
                                    </li>
                                    <li>
                                        Active fines amount:{" "}
                                        <span className="text-white/85 font-medium">
                                            ₱{kpi.activeFineAmount.toFixed(2)}
                                        </span>
                                    </li>
                                    <li>
                                        Damage fees total (all statuses):{" "}
                                        <span className="text-white/85 font-medium">
                                            ₱{kpi.totalDamageFees.toFixed(2)}
                                        </span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="trends" className="mt-3 space-y-3">
                        <Card className="bg-slate-800/60 border-white/10">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <CardTitle className="text-sm">
                                        Monthly activity (selected range)
                                    </CardTitle>
                                    <div className="text-xs text-white/60">
                                        Borrows • Returns • Fines created • Damage reports
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="h-[360px]">
                                {loading ? (
                                    <Skeleton className="h-full w-full" />
                                ) : trends.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-sm text-white/70">
                                        No trend data.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trends}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                            <XAxis
                                                dataKey="month"
                                                tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                            />
                                            <YAxis
                                                tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                            />
                                            <RechartsTooltip
                                                contentStyle={{
                                                    background: "hsl(var(--background))",
                                                    border: "1px solid rgba(255,255,255,0.12)",
                                                    color: "hsl(var(--foreground))",
                                                }}
                                            />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="borrows"
                                                stroke="hsl(var(--chart-1))"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="returns"
                                                stroke="hsl(var(--chart-2))"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="fines"
                                                stroke="hsl(var(--chart-3))"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="damages"
                                                stroke="hsl(var(--chart-4))"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="finance" className="mt-3 space-y-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Fines status</CardTitle>
                                </CardHeader>
                                <CardContent className="h-80">
                                    {loading ? (
                                        <Skeleton className="h-full w-full" />
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={finesStatusChart}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                                <XAxis
                                                    dataKey="status"
                                                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                                />
                                                <YAxis
                                                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                                />
                                                <RechartsTooltip
                                                    // ✅ removed unused `props` param
                                                    formatter={(value: any, name: any) => {
                                                        if (name === "amount") {
                                                            return [`₱${Number(value).toFixed(2)}`, "amount"];
                                                        }
                                                        return [value, name];
                                                    }}
                                                    contentStyle={{
                                                        background: "hsl(var(--background))",
                                                        border: "1px solid rgba(255,255,255,0.12)",
                                                        color: "hsl(var(--foreground))",
                                                    }}
                                                />
                                                <Legend />
                                                <Bar
                                                    dataKey="count"
                                                    fill="hsl(var(--chart-2))"
                                                    radius={[6, 6, 0, 0]}
                                                />
                                                <Bar
                                                    dataKey="amount"
                                                    fill="hsl(var(--chart-3))"
                                                    radius={[6, 6, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                                <Separator className="bg-white/10" />
                                <CardContent className="pt-3 text-xs text-white/70">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge className="bg-white/10 text-white border-white/10">
                                            active: {finesByStatus.active.count} • ₱
                                            {finesByStatus.active.amount.toFixed(2)}
                                        </Badge>
                                        <Badge className="bg-white/10 text-white border-white/10">
                                            paid: {finesByStatus.paid.count} • ₱
                                            {finesByStatus.paid.amount.toFixed(2)}
                                        </Badge>
                                        <Badge className="bg-white/10 text-white border-white/10">
                                            cancelled: {finesByStatus.cancelled.count} • ₱
                                            {finesByStatus.cancelled.amount.toFixed(2)}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Damage reports</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {loading ? (
                                        <>
                                            <Skeleton className="h-9 w-full" />
                                            <Skeleton className="h-9 w-full" />
                                            <Skeleton className="h-9 w-full" />
                                        </>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="rounded-md border border-white/10 bg-white/5 p-2">
                                                    <div className="text-white/60">pending</div>
                                                    <div className="text-lg font-semibold text-white">
                                                        {damageByStatus.pending ?? 0}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-white/10 bg-white/5 p-2">
                                                    <div className="text-white/60">assessed</div>
                                                    <div className="text-lg font-semibold text-white">
                                                        {damageByStatus.assessed ?? 0}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-white/10 bg-white/5 p-2">
                                                    <div className="text-white/60">paid</div>
                                                    <div className="text-lg font-semibold text-white">
                                                        {damageByStatus.paid ?? 0}
                                                    </div>
                                                </div>
                                            </div>

                                            <Separator className="bg-white/10" />

                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="rounded-md border border-white/10 bg-white/5 p-2">
                                                    <div className="text-white/60">minor</div>
                                                    <div className="text-lg font-semibold text-white">
                                                        {damageBySeverity.minor ?? 0}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-white/10 bg-white/5 p-2">
                                                    <div className="text-white/60">moderate</div>
                                                    <div className="text-lg font-semibold text-white">
                                                        {damageBySeverity.moderate ?? 0}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-white/10 bg-white/5 p-2">
                                                    <div className="text-white/60">major</div>
                                                    <div className="text-lg font-semibold text-white">
                                                        {damageBySeverity.major ?? 0}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-xs text-white/70">
                                                Total damage fees (all):{" "}
                                                <span className="text-white/85 font-medium">
                                                    ₱{totalDamageFees.toFixed(2)}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="feedback" className="mt-3 space-y-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Rating distribution</CardTitle>
                                </CardHeader>
                                <CardContent className="h-80">
                                    {loading ? (
                                        <Skeleton className="h-full w-full" />
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={ratingDistribution}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                                <XAxis
                                                    dataKey="rating"
                                                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                                />
                                                <YAxis
                                                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                                />
                                                <RechartsTooltip
                                                    contentStyle={{
                                                        background: "hsl(var(--background))",
                                                        border: "1px solid rgba(255,255,255,0.12)",
                                                        color: "hsl(var(--foreground))",
                                                    }}
                                                />
                                                <Bar
                                                    dataKey="value"
                                                    fill="hsl(var(--chart-4))"
                                                    radius={[6, 6, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-800/60 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm inline-flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Recent feedback
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="overflow-x-auto">
                                    {loading ? (
                                        <div className="space-y-2">
                                            <Skeleton className="h-9 w-full" />
                                            <Skeleton className="h-9 w-full" />
                                            <Skeleton className="h-9 w-full" />
                                        </div>
                                    ) : recentFeedbacks.length === 0 ? (
                                        <div className="py-10 text-center text-sm text-white/70">
                                            No feedback yet.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableCaption className="text-xs text-white/60">
                                                Showing latest {recentFeedbacks.length} feedback entries.
                                            </TableCaption>
                                            <TableHeader>
                                                <TableRow className="border-white/10">
                                                    <TableHead className="text-xs font-semibold text-white/70">
                                                        Rating
                                                    </TableHead>
                                                    <TableHead className="text-xs font-semibold text-white/70">
                                                        Book
                                                    </TableHead>
                                                    <TableHead className="text-xs font-semibold text-white/70">
                                                        Comment
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {recentFeedbacks.map((f) => (
                                                    <TableRow
                                                        key={String(f.id)}
                                                        className="border-white/5 hover:bg-white/5 transition-colors"
                                                    >
                                                        <TableCell className="text-xs">
                                                            <Badge className="bg-white/10 border-white/10 text-white">
                                                                {Math.round(f.rating)}★
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-white/85 max-w-[220px] truncate">
                                                            {f.bookTitle || (
                                                                <span className="text-white/50">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-white/70 max-w-[360px] truncate">
                                                            {f.comment || (
                                                                <span className="text-white/50">—</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </TooltipProvider>
        </DashboardLayout>
    );
}
