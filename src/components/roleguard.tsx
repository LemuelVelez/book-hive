import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { PageLoadingOverlay } from "./loading"
import { useSession, dashboardForRole, type Role } from "@/hooks/use-session"

type RequireRoleProps = {
    /** Which roles are allowed to access the wrapped children */
    allow: Role[]
    children: ReactNode
}

/**
 * Route guard:
 * - If not logged in → /auth?next={current-path}
 * - If logged in but role not allowed → redirect to their own dashboard
 */
export function RequireRole({ allow, children }: RequireRoleProps) {
    const { loading, user } = useSession()
    const location = useLocation()

    if (loading) return <PageLoadingOverlay label="Loading…" />

    // Not authenticated → send to /auth with ?next
    if (!user) {
        const next = encodeURIComponent(location.pathname + location.search)
        return <Navigate to={`/auth?next=${next}`} replace />
    }

    // Logged in but wrong role → bounce to their dashboard
    if (!allow.includes(user.accountType)) {
        return <Navigate to={dashboardForRole(user.accountType)} replace />
    }

    return <>{children}</>
}

/**
 * Route component for `/dashboard` root:
 * - If not logged in → /auth?next=%2Fdashboard
 * - If logged in → redirect to their role-specific dashboard
 */
export function DashboardIndex() {
    const { loading, user } = useSession()

    if (loading) return <PageLoadingOverlay label="Loading dashboard…" />

    if (!user) {
        return <Navigate to="/auth?next=%2Fdashboard" replace />
    }

    return <Navigate to={dashboardForRole(user.accountType)} replace />
}
