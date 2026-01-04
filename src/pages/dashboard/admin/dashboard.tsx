/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "@/components/dashboard-layout";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import {
    BarChart3,
    RefreshCcw,
    Users2,
    BookOpen,
    ListChecks,
    CircleDollarSign,
    MessageSquare,
    ArrowRight,
    ShieldAlert,
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

function roleBadgeClasses(role: Role) {
    switch (role) {
        case "admin":
            return "bg-red-600/80 hover:bg-red-600 text-white border-red-500/70";
        case "librarian":
            return "bg-purple-600/80 hover:bg-purple-600 text-white border-purple-500/70";
        case "faculty":
            return "bg-amber-600/80 hover:bg-amber-600 text-white border-amber-500/70";
        case "other":
            return "bg-slate-600/80 hover:bg-slate-600 text-white border-slate-500/70";
        default:
            return "bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500/70";
    }
}

export default function AdminDashboard() {
    const [range, setRange] = React.useState<TimeRange>("12m");

    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);

    const [users, setUsers] = React.useState<UserListItemDTO[]>([]);
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [borrows, setBorrows] = React.useState<BorrowRecordDTO[]>([]);
    const [fines, setFines] = React.useState<FineDTO[]>([]);
    const [damageReports, setDamageReports] = React.useState<DamageReportDTO[]>([]);
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
        else errors.push(borrowsRes.reason?.message || "Failed to load borrow records.");

        if (finesRes.status === "fulfilled") setFines(finesRes.value);
        else errors.push(finesRes.reason?.message || "Failed to load fines.");

        if (damageRes.status === "fulfilled") setDamageReports(damageRes.value);
        else errors.push(damageRes.reason?.message || "Failed to load damage reports.");

        if (feedbacksRes.status === "fulfilled") setFeedbacks(feedbacksRes.value);
        else errors.push(feedbacksRes.reason?.message || "Failed to load feedbacks.");

        if (errors.length) {
            setPartialErrors(errors);
            toast.error("Some dashboard data failed to load", {
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
            toast.success("Dashboard refreshed");
        } catch {
            // handled in loadAll
        } finally {
            setRefreshing(false);
        }
    };

    const monthsBack = React.useMemo(() => {
        if (range === "6m") return 6;
        if (range === "24m") return 24;
        return 12;
    }, [range]);

    // ---------- Users overview (from users.tsx) ----------
    const pendingUsers = React.useMemo(
        () => users.filter((u) => !u.isApproved).length,
        [users]
    );

    const approvedUsers = React.useMemo(
        () => users.filter((u) => u.isApproved).length,
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
        for (const u of users) m[u.accountType] = (m[u.accountType] ?? 0) + 1;
        return m;
    }, [users]);

    const usersByRoleChart = React.useMemo(() => {
        return ROLE_ORDER.map((r) => ({
            name: r,
            value: countsByRole[r] ?? 0,
        })).filter((x) => x.value > 0);
    }, [countsByRole]);

    const approvalChart = React.useMemo(
        () => [
            { status: "approved", value: approvedUsers },
            { status: "pending", value: pendingUsers },
        ],
        [approvedUsers, pendingUsers]
    );

    const pendingPreview = React.useMemo(() => {
        // If createdAt doesn't exist in DTO, this still behaves deterministically.
        const withDate = users
            .filter((u) => !u.isApproved)
            .map((u) => ({ u, d: safeParseDate((u as any).createdAt ?? null) }))
            .sort((a, b) => (b.d?.getTime() ?? 0) - (a.d?.getTime() ?? 0))
            .slice(0, 8)
            .map((x) => x.u);
        return withDate;
    }, [users]);

    // ---------- Analytics overview (from analytics.tsx) ----------
    const activeBorrows = React.useMemo(
        () => borrows.filter((b) => b.status !== "returned").length,
        [borrows]
    );

    const booksTotals = React.useMemo(() => {
        const titles = books.length;
        const totalCopies = sum(
            books.map((b) => {
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

    const totalDamageFees = React.useMemo(
        () => sum(damageReports.map((r) => Number((r as any).fee || 0))),
        [damageReports]
    );

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
            const dd = safeParseDate((r as any).reportedAt ?? (r as any).createdAt ?? null);
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

    const borrowStatusChart = React.useMemo(() => {
        const m: Record<BorrowStatus, number> = {
            borrowed: 0,
            pending: 0,
            pending_pickup: 0,
            pending_return: 0,
            returned: 0,
        };
        for (const b of borrows) m[b.status] = (m[b.status] ?? 0) + 1;

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
            .map((k) => ({ status: label(k), value: m[k] ?? 0 }))
            .filter((x) => x.value > 0);
    }, [borrows]);

    // ---------- UI ----------
    return (
        <DashboardLayout title="Admin Overview">
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Admin dashboard</h2>
                        <p className="text-xs text-white/70">
                            Snapshot of <span className="text-white/85">Users</span> and{" "}
                            <span className="text-white/85">Analytics</span> (charts powered by Recharts).
                        </p>
                        {partialErrors.length ? (
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-200/90">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                <span>
                                    Partial data loaded ({partialErrors.length}). Some widgets may be incomplete.
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="w-[170px]">
                        <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
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
                            className={`h-4 w-4 mr-2 ${refreshing || loading ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </Button>

                    <Button asChild className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600">
                        <Link to="/dashboard/admin/analytics">
                            Analytics <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                    </Button>

                    <Button asChild variant="outline" className="border-white/20 text-white/90 hover:bg-white/10">
                        <Link to="/dashboard/admin/users">
                            Users <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                    </Button>
                </div>
            </div>

            {/* KPI row (blends analytics + users page intent) */}
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
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">{users.length}</div>
                                <div className="mt-1 text-xs text-white/70 flex items-center gap-2 flex-wrap">
                                    <Badge className="bg-emerald-600/80 border-emerald-500/60 text-white">
                                        approved: {approvedUsers}
                                    </Badge>
                                    <Badge className="bg-orange-600/80 border-orange-500/60 text-white">
                                        pending: {pendingUsers}
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
                                <div className="text-2xl font-semibold">{booksTotals.titles}</div>
                                <div className="mt-1 text-xs text-white/70">
                                    Copies tracked:{" "}
                                    <span className="text-white/85 font-medium">{booksTotals.totalCopies}</span>
                                    {booksTotals.borrowedCopies ? (
                                        <>
                                            {" "}
                                            • Borrowed:{" "}
                                            <span className="text-white/85 font-medium">{booksTotals.borrowedCopies}</span>
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
                                <div className="text-2xl font-semibold">{activeBorrows}</div>
                                <div className="mt-1 text-xs text-white/70">Active borrow records (not returned)</div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-800/60 border-white/10">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold inline-flex items-center gap-2">
                                    <CircleDollarSign className="h-4 w-4" />
                                    Finance & Reports
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">
                                    ₱{(finesByStatus.active.amount ?? 0).toFixed(2)}
                                </div>
                                <div className="mt-1 text-xs text-white/70">
                                    Active fines:{" "}
                                    <span className="text-white/85 font-medium">{finesByStatus.active.count}</span>
                                    {" "}
                                    • Damage fees total:{" "}
                                    <span className="text-white/85 font-medium">₱{totalDamageFees.toFixed(2)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Charts: overview of analytics + users */}
            <div className="grid gap-3 lg:grid-cols-2 mb-4">
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-sm">Users by role</CardTitle>
                            <div className="text-xs text-white/60">From Admin Users overview</div>
                        </div>
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
                                                key={`role-cell-${idx}`}
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
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-sm">Monthly activity (selected range)</CardTitle>
                            <div className="text-xs text-white/60">
                                Borrows • Returns • Fines • Damage reports
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-80">
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
            </div>

            <div className="grid gap-3 lg:grid-cols-2 mb-4">
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-sm">Approval status</CardTitle>
                            <div className="text-xs text-white/60">Quick view from Users page</div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-72">
                        {loading ? (
                            <Skeleton className="h-full w-full" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={approvalChart}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis
                                        dataKey="status"
                                        tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                    />
                                    <YAxis
                                        tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                                        allowDecimals={false}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{
                                            background: "hsl(var(--background))",
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            color: "hsl(var(--foreground))",
                                        }}
                                    />
                                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                    <Separator className="bg-white/10" />
                    <CardContent className="pt-3 text-xs text-white/70">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-emerald-600/20 border-emerald-500/30 text-emerald-100">
                                approved: {approvedUsers}
                            </Badge>
                            <Badge className="bg-orange-600/20 border-orange-500/30 text-orange-100">
                                pending: {pendingUsers}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-sm inline-flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                Feedback rating distribution
                            </CardTitle>
                            <div className="text-xs text-white/60">Snapshot from Analytics</div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-72">
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
                                        allowDecimals={false}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{
                                            background: "hsl(var(--background))",
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            color: "hsl(var(--foreground))",
                                        }}
                                    />
                                    <Bar dataKey="value" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Extra: small circulation snapshot + pending users table */}
            <div className="grid gap-3 lg:grid-cols-2">
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-sm">Borrow status breakdown</CardTitle>
                            <div className="text-xs text-white/60">Snapshot from Analytics</div>
                        </div>
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
                                        allowDecimals={false}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{
                                            background: "hsl(var(--background))",
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            color: "hsl(var(--foreground))",
                                        }}
                                    />
                                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-sm">Pending approvals (preview)</CardTitle>
                            <Button asChild variant="outline" className="border-white/20 text-white/90 hover:bg-white/10">
                                <Link to="/dashboard/admin/users">
                                    Manage <ArrowRight className="h-4 w-4 ml-2" />
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="overflow-x-auto">
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ) : pendingPreview.length === 0 ? (
                            <div className="py-10 text-center text-sm text-white/70">
                                No pending users 🎉
                            </div>
                        ) : (
                            <Table>
                                <TableCaption className="text-xs text-white/60">
                                    Showing up to {pendingPreview.length} pending users.
                                </TableCaption>
                                <TableHeader>
                                    <TableRow className="border-white/10">
                                        <TableHead className="text-xs font-semibold text-white/70 w-[120px]">
                                            User ID
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-white/70">Email</TableHead>
                                        <TableHead className="text-xs font-semibold text-white/70">Role</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingPreview.map((u) => (
                                        <TableRow
                                            key={u.id}
                                            className="border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell className="text-xs opacity-80 max-w-[180px] truncate font-mono">
                                                {u.id}
                                            </TableCell>
                                            <TableCell className="text-sm opacity-90">{u.email}</TableCell>
                                            <TableCell>
                                                <Badge className={roleBadgeClasses(u.accountType)}>{u.accountType}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
