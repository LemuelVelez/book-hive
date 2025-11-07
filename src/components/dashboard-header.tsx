import * as React from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Bell, Plus, Search } from "lucide-react"
import { toast } from "sonner"

/** Top header shown inside the dashboard content area */
export function DashboardHeader({ title = "Dashboard" }: { title?: string }) {
    const [q, setQ] = React.useState("")

    return (
        <header className="sticky top-0 z-10 bg-slate-800/60 backdrop-blur supports-backdrop-filter:bg-slate-800/60 border-b border-white/10">
            <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-3">
                <SidebarTrigger />

                <div className="flex-1 min-w-0">
                    <h1 className="text-base md:text-lg font-semibold tracking-tight truncate">
                        {title}
                    </h1>
                </div>

                {/* Search (compact) */}
                <div className="hidden md:flex items-center gap-2 w-[340px]">
                    <div className="relative w-full">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search books, authors, tags…"
                            className="pl-8 h-8 bg-slate-900/70 border-white/10 text-white placeholder:text-white/60"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    toast.message("Search (mock)", { description: `You searched: ${q || "—"}` })
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1.5">
                    <Button
                        size="sm"
                        variant="outline"
                        className="hidden md:inline-flex border-white/20 text-white/90 hover:bg-white/10"
                        onClick={() => toast.info("New reservation (mock)")}
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Reserve
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="relative hover:bg-white/10"
                        onClick={() => toast.message("Notifications (mock)")}
                    >
                        <Bell className="h-5 w-5" />
                        {/* Mock unread dot */}
                        <span className="absolute right-1 top-1 inline-flex h-2 w-2 rounded-full bg-pink-500" />
                        <span className="sr-only">Notifications</span>
                    </Button>
                </div>
            </div>
        </header>
    )
}
