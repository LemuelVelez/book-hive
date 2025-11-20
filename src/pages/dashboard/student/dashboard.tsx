/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link } from "react-router-dom"

import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import {
    BookOpen,
    Layers,
    MessageSquare,
    RefreshCcw,
    Loader2,
    Clock3,
    CheckCircle2,
    AlertTriangle,
    ArrowRight,
} from "lucide-react"
import { toast } from "sonner"

import { fetchBooks, type BookDTO } from "@/lib/books"
import {
    fetchMyBorrowRecords,
    type BorrowRecordDTO,
} from "@/lib/borrows"
import {
    fetchMyFeedbacks,
    type FeedbackDTO,
} from "@/lib/feedbacks"
import {
    fetchMyDamageReports,
    type DamageReportDTO,
} from "@/lib/damageReports"

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts"

/**
 * Format date as YYYY-MM-DD in *local* timezone
 * to avoid off-by-one issues from UTC conversions.
 */
function fmtDate(d?: string | null) {
    if (!d) return "—"
    try {
        const date = new Date(d)
        if (Number.isNaN(date.getTime())) return d
        // en-CA -> 2025-11-13 (YYYY-MM-DD)
        return date.toLocaleDateString("en-CA")
    } catch {
        return d
    }
}

function peso(n: number) {
    if (typeof n !== "number" || Number.isNaN(n)) return "₱0.00"
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 2,
        }).format(n)
    } catch {
        return `₱${n.toFixed(2)}`
    }
}

// Normalize any "fine-like" value into a safe number
function normalizeFine(value: any): number {
    if (value === null || value === undefined) return 0
    const num = typeof value === "number" ? value : Number(value)
    return Number.isNaN(num) ? 0 : num
}

function isActiveStatus(status: any): boolean {
    const s = String(status ?? "").toLowerCase()
    return s === "borrowed" || s === "pending"
}

function isReturnedStatus(status: any): boolean {
    return String(status ?? "").toLowerCase() === "returned"
}

const FEEDBACK_COLORS = ["#22c55e", "#a855f7", "#f97316", "#38bdf8", "#f43f5e"]

const CIRCULATION_COLORS: Record<string, string> = {
    Active: "#22c55e",
    Returned: "#a855f7",
    Overdue: "#f97316",
}

export default function StudentDashboardPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([])
    const [records, setRecords] = React.useState<BorrowRecordDTO[]>([])
    const [feedbacks, setFeedbacks] = React.useState<FeedbackDTO[]>([])
    const [damageReports, setDamageReports] = React.useState<DamageReportDTO[]>([])

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const loadAll = React.useCallback(async () => {
        setError(null)
        setLoading(true)
        try {
            const [booksData, recordsData, feedbacksData, damageData] =
                await Promise.all([
                    fetchBooks(),
                    fetchMyBorrowRecords(),
                    fetchMyFeedbacks(),
                    fetchMyDamageReports(),
                ])

            // Use the records as-is from the API; we normalize fines only when computing
            setBooks(booksData)
            setRecords(recordsData)
            setFeedbacks(feedbacksData)
            setDamageReports(damageData)
        } catch (err: any) {
            const msg =
                err?.message ||
                "Failed to load your overview data. Please try again later."
            setError(msg)
            toast.error("Failed to load overview", { description: msg })
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void loadAll()
    }, [loadAll])

    async function handleRefresh() {
        setRefreshing(true)
        try {
            await loadAll()
        } finally {
            setRefreshing(false)
        }
    }

    // ---- Derived metrics ----
    const totalBooks = books.length
    const availableBooks = books.filter((b) => b.available).length

    // Make status handling tolerant (borrowed / pending / returned etc, any casing)
    const activeRecords = React.useMemo(
        () => records.filter((r) => isActiveStatus(r.status)),
        [records],
    )

    const returnedRecords = React.useMemo(
        () => records.filter((r) => isReturnedStatus(r.status)),
        [records],
    )

    // Overdue = active record with a positive fine
    const overdueCount = React.useMemo(
        () =>
            activeRecords.filter((r) => normalizeFine((r as any).fine) > 0).length,
        [activeRecords],
    )

    // Active fines = unpaid fines on active (borrowed + pending) records.
    const activeFineTotal = React.useMemo(
        () =>
            activeRecords.reduce((sum, r) => {
                const fine = normalizeFine((r as any).fine)
                return fine > 0 ? sum + fine : sum
            }, 0),
        [activeRecords],
    )

    // All recorded fines (any status, positive amounts only) – historical total.
    const totalFineAll = React.useMemo(
        () =>
            records.reduce((sum, r) => {
                const fine = normalizeFine((r as any).fine)
                return fine > 0 ? sum + fine : sum
            }, 0),
        [records],
    )

    const totalFeedbacks = feedbacks.length
    const totalDamageReports = damageReports.length

    const recentBorrows = React.useMemo(
        () =>
            [...records]
                .sort(
                    (a, b) =>
                        (a.borrowDate ?? "").localeCompare(b.borrowDate ?? "") * -1,
                )
                .slice(0, 5),
        [records],
    )

    const recentFeedbacks = React.useMemo(
        () =>
            [...feedbacks]
                .sort((a, b) =>
                    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
                )
                .slice(0, 3),
        [feedbacks],
    )

    const recentDamageReports = React.useMemo(
        () =>
            [...damageReports]
                .sort((a, b) =>
                    (b.reportedAt ?? "").localeCompare(a.reportedAt ?? ""),
                )
                .slice(0, 3),
        [damageReports],
    )

    // ---- Chart data ----
    const circulationChartData = React.useMemo(
        () => [
            { name: "Active", value: activeRecords.length },
            { name: "Returned", value: returnedRecords.length },
            { name: "Overdue", value: overdueCount },
        ],
        [activeRecords.length, returnedRecords.length, overdueCount],
    )

    const feedbackChartData = React.useMemo(() => {
        if (!feedbacks.length) return []
        const counts: Record<number, number> = {}
        feedbacks.forEach((f) => {
            const r = Number((f as any).rating)
            if (!r || Number.isNaN(r)) return
            counts[r] = (counts[r] || 0) + 1
        })
        return Array.from({ length: 5 }, (_, i) => {
            const rating = i + 1
            return {
                name: `${rating}★`,
                value: counts[rating] || 0,
            }
        }).filter((d) => d.value > 0)
    }, [feedbacks])

    return (
        <DashboardLayout title="My Library overview">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">
                            My Library overview
                        </h2>
                        <p className="text-xs text-white/70">
                            Quick snapshot of your books, circulation, feedback, and damage
                            reports.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
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

                    {/* Buttons: vertical on mobile, horizontal on desktop */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                            asChild
                            size="sm"
                            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white justify-center"
                        >
                            <Link to="/dashboard/books">
                                Browse books
                                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto border-white/20 text-white/90 hover:bg-white/10 justify-center"
                        >
                            <Link to="/dashboard/circulation">
                                My circulation
                                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {error && !loading && (
                <div className="mb-4 text-sm text-red-300">{error}</div>
            )}

            {/* Top summary cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-6">
                {/* Books summary */}
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-semibold">
                                Books overview
                            </CardTitle>
                            <p className="text-[11px] text-white/60">
                                Snapshot from <span className="font-medium">Browse Books</span>.
                            </p>
                        </div>
                        <div className="rounded-full bg-purple-500/20 p-2">
                            <BookOpen className="h-4 w-4 text-purple-200" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {loading ? (
                            <Skeleton className="h-8 w-20" />
                        ) : (
                            <p className="text-3xl font-bold">
                                {availableBooks}/{totalBooks}
                            </p>
                        )}
                        <p className="text-xs text-white/70">
                            <span className="font-medium text-emerald-300">
                                {availableBooks}
                            </span>{" "}
                            available to borrow out of{" "}
                            <span className="font-medium">{totalBooks}</span> books.
                        </p>
                        <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="px-0 text-xs text-purple-200 hover:text-purple-100 hover:bg-transparent"
                        >
                            <Link to="/dashboard/books">
                                View catalog
                                <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* Circulation summary */}
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-semibold">
                                Circulation
                            </CardTitle>
                            <p className="text-[11px] text-white/60">
                                From <span className="font-medium">My Circulation</span>.
                            </p>
                        </div>
                        <div className="rounded-full bg-emerald-500/20 p-2">
                            <Layers className="h-4 w-4 text-emerald-200" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {loading ? (
                            <>
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-4 w-36" />
                            </>
                        ) : (
                            <>
                                <p>
                                    Active borrows:{" "}
                                    <span className="font-semibold text-emerald-300">
                                        {activeRecords.length}
                                    </span>
                                </p>
                                <p>
                                    Returned history:{" "}
                                    <span className="font-semibold text-white">
                                        {returnedRecords.length}
                                    </span>
                                </p>
                                <p>
                                    Active fines (unpaid):{" "}
                                    <span className="font-semibold text-amber-300">
                                        {peso(activeFineTotal)}
                                    </span>
                                    {overdueCount > 0 && (
                                        <span className="ml-1 text-[11px] text-red-300">
                                            ({overdueCount} overdue)
                                        </span>
                                    )}
                                </p>
                                <p>
                                    All recorded fines:{" "}
                                    <span className="font-semibold text-amber-200">
                                        {peso(totalFineAll)}
                                    </span>
                                </p>
                                <p className="text-[11px] text-white/60">
                                    Active fines are fines on books that are still{" "}
                                    <span className="font-semibold">borrowed or pending</span>{" "}
                                    and have not yet been paid.
                                </p>
                            </>
                        )}
                        <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="px-0 text-xs text-emerald-200 hover:text-emerald-100 hover:bg-transparent"
                        >
                            <Link to="/dashboard/circulation">
                                View circulation
                                <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* Insights summary */}
                <Card className="bg-slate-800/60 border-white/10 hidden xl:block">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-semibold">
                                Insights Hub
                            </CardTitle>
                            <p className="text-[11px] text-white/60">
                                From feedback & damage reports.
                            </p>
                        </div>
                        <div className="rounded-full bg-amber-500/20 p-2">
                            <MessageSquare className="h-4 w-4 text-amber-200" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {loading ? (
                            <>
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-36" />
                            </>
                        ) : (
                            <>
                                <p>
                                    Feedback entries:{" "}
                                    <span className="font-semibold text-purple-200">
                                        {totalFeedbacks}
                                    </span>
                                </p>
                                <p>
                                    Damage reports:{" "}
                                    <span className="font-semibold text-amber-200">
                                        {totalDamageReports}
                                    </span>
                                </p>
                            </>
                        )}
                        <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="px-0 text-xs text-amber-200 hover:text-amber-100 hover:bg-transparent"
                        >
                            <Link to="/dashboard/insights">
                                Open Insights Hub
                                <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Charts section */}
            <div className="grid gap-6 lg:grid-cols-2 mb-6">
                {/* Circulation bar chart */}
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-semibold">
                                Circulation status (bar graph)
                            </CardTitle>
                            <p className="text-[11px] text-white/60">
                                Visual breakdown of your current and past borrow records.
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="h-64">
                        {loading ? (
                            <div className="flex flex-col gap-2 h-full justify-center">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : records.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-xs text-white/60 text-center px-4">
                                No circulation data yet. Borrow some books to see the chart.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={circulationChartData}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <XAxis
                                        dataKey="name"
                                        stroke="#cbd5f5"
                                        fontSize={12}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        stroke="#cbd5f5"
                                        fontSize={12}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: "rgba(148,163,184,0.15)" }}
                                        contentStyle={{
                                            backgroundColor: "#020617",
                                            border: "1px solid rgba(148,163,184,0.4)",
                                            borderRadius: "0.375rem",
                                            fontSize: "0.75rem",
                                            color: "#e5e7eb",
                                        }}
                                        itemStyle={{ color: "#e5e7eb" }}
                                        labelStyle={{ color: "#e5e7eb" }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {circulationChartData.map((entry) => (
                                            <Cell
                                                key={entry.name}
                                                fill={CIRCULATION_COLORS[entry.name] ?? "#e5e7eb"}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Feedback pie chart */}
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-semibold">
                                Feedback rating distribution (pie chart)
                            </CardTitle>
                            <p className="text-[11px] text-white/60">
                                How your submitted ratings are distributed across 1–5 stars.
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="h-64">
                        {loading ? (
                            <div className="flex flex-col gap-2 h-full justify-center">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : !feedbackChartData.length ? (
                            <div className="flex items-center justify-center h-full text-xs text-white/60 text-center px-4">
                                You haven&apos;t submitted any rated feedback yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#020617",
                                            border: "1px solid rgba(148,163,184,0.4)",
                                            borderRadius: "0.375rem",
                                            fontSize: "0.75rem",
                                            color: "#e5e7eb",
                                        }}
                                        itemStyle={{ color: "#e5e7eb" }}
                                        labelStyle={{ color: "#e5e7eb" }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={24}
                                        formatter={(value) => (
                                            <span className="text-[11px] text-slate-100">
                                                {value}
                                            </span>
                                        )}
                                    />
                                    <Pie
                                        data={feedbackChartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={2}
                                    >
                                        {feedbackChartData.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    FEEDBACK_COLORS[index % FEEDBACK_COLORS.length]
                                                }
                                            />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Main content: circulation & insights previews */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)]">
                {/* Recent circulation */}
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-emerald-300" />
                                <CardTitle className="text-sm font-semibold">
                                    Recent circulation
                                </CardTitle>
                            </div>
                            <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="border-white/20 text-xs text-white/80 hover:bg-white/10"
                            >
                                <Link to="/dashboard/circulation">View all</Link>
                            </Button>
                        </div>
                        <p className="mt-1 text-[11px] text-white/60">
                            Direct overview from your{" "}
                            <span className="font-medium">My Circulation</span> page.
                        </p>
                    </CardHeader>
                    <CardContent className="overflow-x-hidden md:overflow-x-auto">
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ) : recentBorrows.length === 0 ? (
                            <div className="py-8 text-center text-sm text-white/70">
                                No circulation activity yet.
                                <br />
                                <span className="text-xs opacity-80">
                                    Borrow a book from the catalog to see it here.
                                </span>
                            </div>
                        ) : (
                            <>
                                {/* Mobile: vertical cards */}
                                <div className="flex flex-col gap-2 md:hidden">
                                    <p className="text-xs text-white/60">
                                        Showing your {recentBorrows.length} most recent{" "}
                                        {recentBorrows.length === 1 ? "record" : "records"}.
                                    </p>
                                    {recentBorrows.map((r) => {
                                        const isBorrowed = isActiveStatus(r.status) &&
                                            String(r.status ?? "").toLowerCase() === "borrowed"
                                        const isPending =
                                            String(r.status ?? "").toLowerCase() === "pending"
                                        const isReturned = isReturnedStatus(r.status)
                                        const isActive = isBorrowed || isPending

                                        const fine = normalizeFine((r as any).fine)
                                        const isOverdue = isActive && fine > 0

                                        let badgeColor =
                                            "bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80"
                                        let badgeLabel = "Borrowed"
                                        let badgeIcon = <Clock3 className="h-3 w-3" />

                                        if (isReturned) {
                                            badgeColor =
                                                "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80"
                                            badgeLabel = "Returned"
                                            badgeIcon = <CheckCircle2 className="h-3 w-3" />
                                        } else if (isPending) {
                                            badgeColor =
                                                "bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80"
                                            badgeLabel = "Pending"
                                            badgeIcon = <Clock3 className="h-3 w-3" />
                                        }
                                        if (isOverdue) {
                                            badgeColor =
                                                "bg-red-500/80 hover:bg-red-500 text-white border-red-400/80"
                                            badgeLabel = "Overdue"
                                            badgeIcon = <AlertTriangle className="h-3 w-3" />
                                        }

                                        return (
                                            <div
                                                key={r.id}
                                                className="rounded-md border border-white/10 bg-slate-900/80 px-3 py-2 text-xs space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-medium text-white text-sm wrap-break-word">
                                                        {r.bookTitle ?? (
                                                            <span className="opacity-70">
                                                                Book #{r.bookId}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Badge className={badgeColor}>
                                                        <span className="inline-flex items-center gap-1">
                                                            {badgeIcon}
                                                            {badgeLabel}
                                                        </span>
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-white/70">
                                                    <div>
                                                        <span className="text-white/50">Borrowed:</span>{" "}
                                                        {fmtDate(r.borrowDate)}
                                                    </div>
                                                    <div>
                                                        <span className="text-white/50">Due:</span>{" "}
                                                        {fmtDate(r.dueDate)}
                                                    </div>
                                                    <div>
                                                        <span className="text-white/50">Status:</span>{" "}
                                                        {badgeLabel}
                                                    </div>
                                                    <div>
                                                        <span className="text-white/50">Fine:</span>{" "}
                                                        {peso(fine)}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Desktop: table layout */}
                                <div className="hidden md:block">
                                    <Table>
                                        <TableCaption className="text-xs text-white/60">
                                            Showing your {recentBorrows.length} most recent{" "}
                                            {recentBorrows.length === 1 ? "record" : "records"}.
                                        </TableCaption>
                                        <TableHeader>
                                            <TableRow className="border-white/10">
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
                                                    Status
                                                </TableHead>
                                                <TableHead className="text-xs font-semibold text-white/70">
                                                    ₱Fine
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {recentBorrows.map((r) => {
                                                const statusStr = String(r.status ?? "").toLowerCase()
                                                const isBorrowed = statusStr === "borrowed"
                                                const isPending = statusStr === "pending"
                                                const isReturned = statusStr === "returned"
                                                const isActive = isBorrowed || isPending

                                                const fine = normalizeFine((r as any).fine)
                                                const isOverdue = isActive && fine > 0

                                                let badgeColor =
                                                    "bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80"
                                                let badgeLabel = "Borrowed"
                                                let badgeIcon = <Clock3 className="h-3 w-3" />

                                                if (isReturned) {
                                                    badgeColor =
                                                        "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80"
                                                    badgeLabel = "Returned"
                                                    badgeIcon = <CheckCircle2 className="h-3 w-3" />
                                                } else if (isPending) {
                                                    badgeColor =
                                                        "bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80"
                                                    badgeLabel = "Pending"
                                                    badgeIcon = <Clock3 className="h-3 w-3" />
                                                }
                                                if (isOverdue) {
                                                    badgeColor =
                                                        "bg-red-500/80 hover:bg-red-500 text-white border-red-400/80"
                                                    badgeLabel = "Overdue"
                                                    badgeIcon = <AlertTriangle className="h-3 w-3" />
                                                }

                                                return (
                                                    <TableRow
                                                        key={r.id}
                                                        className="border-white/5 hover:bg-white/5 transition-colors"
                                                    >
                                                        <TableCell className="text-sm font-medium">
                                                            {r.bookTitle ?? (
                                                                <span className="opacity-70">
                                                                    Book #{r.bookId}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-sm opacity-80">
                                                            {fmtDate(r.borrowDate)}
                                                        </TableCell>
                                                        <TableCell className="text-sm opacity-80">
                                                            {fmtDate(r.dueDate)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={badgeColor}>
                                                                <span className="inline-flex items-center gap-1">
                                                                    {badgeIcon}
                                                                    {badgeLabel}
                                                                </span>
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {peso(fine)}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Insights snapshot: feedback + damage reports */}
                <div className="space-y-4">
                    {/* Feedback */}
                    <Card className="bg-slate-800/60 border-white/10">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-purple-300" />
                                    <CardTitle className="text-sm font-semibold">
                                        Recent feedback
                                    </CardTitle>
                                </div>
                                <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="border-white/20 text-xs text-white/80 hover:bg-white/10"
                                >
                                    <Link to="/dashboard/insights">Open Insights Hub</Link>
                                </Button>
                            </div>
                            <p className="mt-1 text-[11px] text-white/60">
                                Overview from your{" "}
                                <span className="font-medium">book feedback</span>.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-56 overflow-y-auto pr-1 support-scroll w-full">
                            {loading ? (
                                <>
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </>
                            ) : recentFeedbacks.length === 0 ? (
                                <div className="rounded-md border border-dashed border-white/20 px-3 py-4 text-xs text-white/60">
                                    You haven&apos;t submitted any feedback yet.
                                </div>
                            ) : (
                                recentFeedbacks.map((fb) => (
                                    <div
                                        key={fb.id}
                                        className="rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-xs wrap-break-word"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-white">
                                                    {fb.bookTitle ?? `Book #${fb.bookId}`}
                                                </span>
                                                <span className="text-[10px] text-white/50">
                                                    {fmtDate(fb.createdAt)}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-yellow-300 font-semibold">
                                                {fb.rating} / 5
                                            </span>
                                        </div>
                                        {fb.comment && (
                                            <p className="mt-1 text-[11px] text-white/80 wrap-break-word">
                                                {fb.comment}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Damage reports */}
                    <Card className="bg-slate-800/60 border-white/10">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-300" />
                                <CardTitle className="text-sm font-semibold">
                                    Recent damage reports
                                </CardTitle>
                            </div>
                            <p className="mt-1 text-[11px] text-white/60">
                                Overview from your{" "}
                                <span className="font-medium">damage reports</span>.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-56 overflow-y-auto pr-1 support-scroll w-full">
                            {loading ? (
                                <>
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </>
                            ) : recentDamageReports.length === 0 ? (
                                <div className="rounded-md border border-dashed border-white/20 px-3 py-4 text-xs text-white/60">
                                    You haven&apos;t submitted any damage reports yet.
                                </div>
                            ) : (
                                recentDamageReports.map((r) => (
                                    <div
                                        key={r.id}
                                        className="rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-xs wrap-break-word"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="space-y-0.5">
                                                <div className="font-medium text-white wrap-break-word">
                                                    {r.bookTitle ?? `Book #${r.bookId}`}
                                                </div>
                                                <div className="text-[10px] text-white/50">
                                                    Reported: {fmtDate(r.reportedAt)}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge
                                                    className={
                                                        r.status === "paid"
                                                            ? "text-white bg-emerald-600/80 border-emerald-400/70"
                                                            : r.status === "assessed"
                                                                ? "text-white bg-amber-600/80 border-amber-400/70"
                                                                : "text-white bg-slate-700/80 border-slate-500/70"
                                                    }
                                                >
                                                    {r.status === "pending"
                                                        ? "Pending"
                                                        : r.status === "assessed"
                                                            ? "Assessed"
                                                            : "Paid"}
                                                </Badge>
                                                {r.fee > 0 && (
                                                    <span className="text-[11px] text-red-300 font-medium">
                                                        ₱{r.fee.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="mt-1 text-[11px] text-white/80 wrap-break-word">
                                            {r.damageType}
                                        </p>
                                        {r.notes && (
                                            <p className="mt-0.5 text-[11px] text-white/70 wrap-break-word">
                                                Notes: {r.notes}
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
    )
}
