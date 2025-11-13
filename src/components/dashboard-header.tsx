/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { me as apiMe } from "@/lib/authentication"

// Simple module-level cache so we only call /api/auth/me once per page load
let cachedUser: any | null = null
let cachedUserLoaded = false

/** Top header shown inside the dashboard content area */
export function DashboardHeader({ title = "Dashboard" }: { title?: string }) {
    const location = useLocation()
    const pathname = location.pathname

    const [user, setUser] = React.useState<any | null>(cachedUser)

    React.useEffect(() => {
        // If we've already loaded user once, reuse it (no flicker on route changes)
        if (cachedUserLoaded) return

        let cancelled = false

            ; (async () => {
                try {
                    const u = await apiMe()
                    if (!cancelled) {
                        cachedUser = u
                        cachedUserLoaded = true
                        setUser(u)
                    }
                } catch {
                    // silently ignore – header will just not show the name
                    if (!cancelled) {
                        cachedUserLoaded = true
                    }
                }
            })()

        return () => {
            cancelled = true
        }
    }, [])

    function inferRoleFromPath(path: string): string | undefined {
        // Check more specific sub-sections first
        if (path.startsWith("/dashboard/librarian")) return "librarian"
        if (path.startsWith("/dashboard/faculty")) return "faculty"
        if (path.startsWith("/dashboard/admin")) return "admin"
        // Generic borrower section (/dashboard, /dashboard/books, /dashboard/circulation, /dashboard/insights)
        if (path.startsWith("/dashboard")) return "student" // fallback label for borrower area
        return undefined
    }

    function formatRole(raw: string | undefined): string {
        if (!raw) return ""
        const map: Record<string, string> = {
            student: "Student",
            other: "Guest", // ✅ show "Guest" for role "other"
            librarian: "Librarian",
            faculty: "Faculty",
            admin: "Admin",
        }
        return map[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
    }

    const rawRole =
        (user?.accountType as string | undefined) ?? inferRoleFromPath(pathname)
    const roleLabel = formatRole(rawRole)

    const displayName =
        user?.fullName ||
        user?.name ||
        user?.full_name ||
        user?.student_name ||
        user?.email ||
        ""

    const showWelcome = !!roleLabel || !!displayName

    // ✅ Student and Other share the same quick actions (plus faculty)
    const showReserve =
        rawRole === "student" || rawRole === "other" || rawRole === "faculty"

    return (
        <header className="sticky top-0 z-10 bg-slate-800/60 backdrop-blur supports-backdrop-filter:bg-slate-800/60 border-b border-white/10">
            <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-3">
                <SidebarTrigger />

                <div className="flex-1 min-w-0">
                    <h1 className="text-base md:text-lg font-semibold tracking-tight truncate">
                        {title}
                    </h1>
                    {showWelcome && (
                        <p className="mt-0.5 text-xs md:text-sm text-white/70 truncate">
                            Welcome
                            {roleLabel && (
                                <>
                                    , <span className="font-medium">{roleLabel}</span>
                                </>
                            )}
                            {displayName && (
                                <>
                                    {" "}
                                    <span className="font-medium">{displayName}</span>
                                </>
                            )}
                        </p>
                    )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1.5">
                    {showReserve && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="hidden md:inline-flex border-white/20 text-white/90 hover:bg-white/10"
                            onClick={() => toast.info("New reservation (mock)")}
                        >
                            <Plus className="h-4 w-4 mr-1.5" />
                            Reserve
                        </Button>
                    )}
                </div>
            </div>
        </header>
    )
}
