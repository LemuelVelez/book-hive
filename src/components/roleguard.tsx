import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { PageLoadingOverlay } from "./loading"
import {
    useSession,
    dashboardForRole,
    type Role,
    refreshSession,
} from "@/hooks/use-session"

type RequireRoleProps = {
    /** Which roles are allowed to access the wrapped children */
    allow: Role[]
    children: ReactNode
}

/**
 * Route guard:
 * - If not logged in → /auth?next={current-path}
 * - If logged in but role not allowed → refresh session once, then:
 *    - if still not allowed → redirect to their own dashboard
 *
 * ✅ Fix: When role is changed in DB (Navicat), the cached session may still say "student".
 * This refresh makes sure we re-check /api/auth/me before redirecting.
 */
export function RequireRole({ allow, children }: RequireRoleProps) {
    const { loading, user } = useSession()
    const location = useLocation()

    const [syncing, setSyncing] = useState(false)

    // Prevent infinite refresh loops per "mismatch situation"
    const attemptedForKeyRef = useRef<string>("")

    const allowKey = useMemo(() => allow.join("|"), [allow])
    const currentPathKey = `${location.pathname}${location.search}`

    const mismatch = !!user && !allow.includes(user.accountType)

    useEffect(() => {
        if (loading) return
        if (!user) {
            attemptedForKeyRef.current = ""
            return
        }

        // If role is OK, reset so future mismatches can refresh again
        if (!mismatch) {
            attemptedForKeyRef.current = ""
            return
        }

        // If role mismatch, refresh ONCE for this route+allow set
        const key = `${allowKey}::${currentPathKey}`
        if (attemptedForKeyRef.current === key) return
        attemptedForKeyRef.current = key

        setSyncing(true)
        refreshSession().finally(() => setSyncing(false))
    }, [loading, user, mismatch, allowKey, currentPathKey])

    if (loading || syncing) return <PageLoadingOverlay label="Loading…" />

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
 * - If logged in → refresh session once then redirect to role dashboard
 */
export function DashboardIndex() {
    const { loading, user } = useSession()
    const [syncing, setSyncing] = useState(false)
    const didRefreshRef = useRef(false)

    useEffect(() => {
        if (loading) return

        if (!user) {
            didRefreshRef.current = false
            return
        }

        if (didRefreshRef.current) return
        didRefreshRef.current = true

        setSyncing(true)
        refreshSession().finally(() => setSyncing(false))
    }, [loading, user])

    if (loading || syncing) return <PageLoadingOverlay label="Loading dashboard…" />

    if (!user) {
        return <Navigate to="/auth?next=%2Fdashboard" replace />
    }

    return <Navigate to={dashboardForRole(user.accountType)} replace />
}
