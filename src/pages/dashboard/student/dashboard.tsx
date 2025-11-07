import * as React from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
    BookOpen,
    Bookmark,
    CreditCard,
    MessageSquare,
    CalendarDays,
    Clock,
    ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

// ---- Mock data ----
const STATS = [
    { label: "Active Loans", value: 2, icon: BookOpen },
    { label: "Reservations", value: 1, icon: Bookmark },
    { label: "Late Fines", value: "₱90", icon: CreditCard },
    { label: "Messages", value: 3, icon: MessageSquare },
]

const DUE_SOON = [
    {
        id: "bk-1001",
        title: "Clean Code",
        author: "Robert C. Martin",
        due: "Nov 12, 2025",
        daysLeft: 5,
    },
    {
        id: "bk-1002",
        title: "Introduction to Algorithms",
        author: "Cormen, Leiserson, Rivest, Stein",
        due: "Nov 15, 2025",
        daysLeft: 8,
    },
    {
        id: "bk-1003",
        title: "Designing Data-Intensive Applications",
        author: "Martin Kleppmann",
        due: "Nov 20, 2025",
        daysLeft: 13,
    },
]

const ACTIVITY = [
    { id: "act-1", when: "Today, 7:10 AM", text: "Reservation confirmed: Clean Code" },
    { id: "act-2", when: "Yesterday, 3:22 PM", text: "Loan renewed: Pragmatic Programmer" },
    { id: "act-3", when: "Nov 4, 2025", text: "Overdue notice: Database System Concepts" },
]

// Simple stat block
function StatCard({
    label,
    value,
    icon: Icon,
}: {
    label: string
    value: number | string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}) {
    return (
        <Card className="bg-slate-800/60 border-white/10">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium opacity-80">{label}</CardTitle>
                    <Icon className="h-4 w-4 opacity-70" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
        </Card>
    )
}

export default function StudentDashboardPage() {
    const [loadingRecs, setLoadingRecs] = React.useState(true)

    React.useEffect(() => {
        const t = setTimeout(() => setLoadingRecs(false), 900) // mock load
        return () => clearTimeout(t)
    }, [])

    return (
        <DashboardLayout title="Student Dashboard">
            {/* KPIs */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {STATS.map((s) => (
                    <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
                ))}
            </section>

            {/* Main grid */}
            <section className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Due soon */}
                <Card className="lg:col-span-3 bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Due soon
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {DUE_SOON.map((b) => (
                            <div
                                key={b.id}
                                className="rounded-md border border-white/10 p-3 flex items-start justify-between bg-slate-900/40"
                            >
                                <div>
                                    <div className="font-medium leading-tight">{b.title}</div>
                                    <div className="text-sm opacity-70">{b.author}</div>
                                    <div className="mt-1 flex items-center gap-2 text-xs opacity-80">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>Due {b.due}</span>
                                        <span className="opacity-60">•</span>
                                        <span>{b.daysLeft} day{b.daysLeft === 1 ? "" : "s"} left</span>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-white/20 text-white/90 hover:bg-white/10"
                                        onClick={() => toast.info("Renew (mock)", { description: b.title })}
                                    >
                                        Renew
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="hover:bg-white/10"
                                        onClick={() => toast.message("Open details (mock)")}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                        <span className="sr-only">Open</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Recent activity */}
                <Card className="lg:col-span-2 bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Recent activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-4">
                            {ACTIVITY.map((a) => (
                                <li key={a.id} className="relative pl-6">
                                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-pink-500" />
                                    <div className="text-sm">{a.text}</div>
                                    <div className="text-xs opacity-70">{a.when}</div>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            </section>

            {/* Recommendations (mock skeleton) */}
            <section className="mt-6">
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle>Recommended for you</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingRecs ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-32 w-full rounded-lg" />
                                        <Skeleton className="h-4 w-4/5" />
                                        <Skeleton className="h-3 w-2/5" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { t: "Refactoring UI", a: "Steve Schoger" },
                                    { t: "You Don’t Know JS Yet", a: "Kyle Simpson" },
                                    { t: "Eloquent JavaScript", a: "Marijn Haverbeke" },
                                    { t: "The Pragmatic Programmer", a: "Andrew Hunt" },
                                ].map((r) => (
                                    <div
                                        key={r.t}
                                        className="rounded-md border border-white/10 p-3 hover:bg-white/5 transition"
                                    >
                                        <div className="font-medium leading-tight">{r.t}</div>
                                        <div className="text-xs opacity-70">{r.a}</div>
                                        <Button
                                            size="sm"
                                            className="mt-3 bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                            onClick={() => toast.success("Added to reservations (mock)", { description: r.t })}
                                        >
                                            Reserve
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </DashboardLayout>
    )
}
