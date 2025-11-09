import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Users,
  AlertTriangle,
  ClipboardList,
  CalendarDays,
  Clock,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ---- Mock data ----
const STATS = [
  { label: "Books in catalog", value: 1240, icon: BookOpen },
  { label: "Active borrowers", value: 312, icon: Users },
  { label: "Overdue items", value: 18, icon: AlertTriangle },
  { label: "Reservations today", value: 27, icon: ClipboardList },
];

const DUE_TODAY = [
  {
    id: "loan-1001",
    title: "Clean Code",
    borrower: "Juan Dela Cruz",
    due: "Today • 5:00 PM",
    hoursLeft: 6,
  },
  {
    id: "loan-1002",
    title: "Designing Data-Intensive Applications",
    borrower: "Maria Santos",
    due: "Today • 4:30 PM",
    hoursLeft: 5,
  },
  {
    id: "loan-1003",
    title: "Introduction to Algorithms",
    borrower: "John Cena",
    due: "Today • 7:00 PM",
    hoursLeft: 8,
  },
];

const PENDING_RESERVATIONS = [
  {
    id: "res-2001",
    title: "Refactoring UI",
    borrower: "Ana Dizon",
    requestedAt: "Today, 8:10 AM",
  },
  {
    id: "res-2002",
    title: "You Don’t Know JS Yet",
    borrower: "Mark Reyes",
    requestedAt: "Today, 7:42 AM",
  },
  {
    id: "res-2003",
    title: "Database System Concepts",
    borrower: "Kyla Lim",
    requestedAt: "Yesterday, 4:18 PM",
  },
];

const RECENT_ACTIVITY = [
  {
    id: "act-1",
    when: "Today, 9:15 AM",
    text: "Marked 5 books as returned.",
  },
  {
    id: "act-2",
    when: "Today, 8:30 AM",
    text: "Approved reservation: Clean Architecture (for BSCS-3A).",
  },
  {
    id: "act-3",
    when: "Yesterday, 3:45 PM",
    text: "Added 12 new titles to the CCS collection.",
  },
];

// Simple stat block
function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
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
  );
}

export default function LibrarianDashboardPage() {
  const [loadingQuickActions, setLoadingQuickActions] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setLoadingQuickActions(false), 900); // mock load
    return () => clearTimeout(t);
  }, []);

  return (
    <DashboardLayout title="Librarian Dashboard">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
        ))}
      </section>

      {/* Main grid */}
      <section className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Due today */}
        <Card className="lg:col-span-3 bg-slate-800/60 border-white/10">
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Due today
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white/90 hover:bg-white/10"
              onClick={() =>
                toast.info("This is mock data.", {
                  description: "Hook this action to a real filter later.",
                })
              }
            >
              View full loans list
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {DUE_TODAY.map((loan) => (
              <div
                key={loan.id}
                className="rounded-md border border-white/10 p-3 flex items-start justify-between bg-slate-900/40"
              >
                <div>
                  <div className="font-medium leading-tight">{loan.title}</div>
                  <div className="text-sm opacity-80">
                    Borrower: <span className="font-medium opacity-90">{loan.borrower}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs opacity-80">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{loan.due}</span>
                    <span className="opacity-60">•</span>
                    <span>{loan.hoursLeft} hours left</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white/90 hover:bg-white/10"
                    onClick={() =>
                      toast.success("Marked as returned (mock)", {
                        description: loan.title,
                      })
                    }
                  >
                    Mark returned
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:bg-white/10"
                    onClick={() => toast.message("Open loan details (mock)")}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Open</span>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending reservations */}
        <Card className="lg:col-span-2 bg-slate-800/60 border-white/10">
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Pending reservations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {PENDING_RESERVATIONS.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border border-white/10 p-3 bg-slate-900/40 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="font-medium leading-tight">{r.title}</div>
                    <div className="text-sm opacity-80">
                      Requestor:{" "}
                      <span className="font-medium opacity-90">{r.borrower}</span>
                    </div>
                    <div className="text-xs opacity-70">{r.requestedAt}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      onClick={() =>
                        toast.success("Reservation approved (mock)", {
                          description: r.title,
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-white/90 hover:bg-white/10"
                      onClick={() =>
                        toast.warning("Reservation declined (mock)", {
                          description: r.title,
                        })
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Quick actions / recent activity */}
      <section className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Quick actions (mock skeleton) */}
        <Card className="lg:col-span-2 bg-slate-800/60 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingQuickActions ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="justify-start border-white/20 text-white/90 hover:bg-white/10"
                  onClick={() =>
                    toast.message("Navigate to Books Management (mock)", {
                      description: "Wire this button to /dashboard/librarian/books.",
                    })
                  }
                >
                  Add or edit books
                </Button>
                <Button
                  variant="outline"
                  className="justify-start border-white/20 text-white/90 hover:bg-white/10"
                  onClick={() => toast.message("Run inventory report (mock)")}
                >
                  Run inventory report
                </Button>
                <Button
                  variant="outline"
                  className="justify-start border-white/20 text-white/90 hover:bg-white/10"
                  onClick={() => toast.message("Export overdue list (mock)")}
                >
                  Export overdue list
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-3 bg-slate-800/60 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent librarian activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {RECENT_ACTIVITY.map((a) => (
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
    </DashboardLayout>
  );
}
