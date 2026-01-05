import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { Navigate } from "react-router-dom"
import { PageLoadingOverlay } from "./loading"
import { useSession, dashboardForRole, refreshSession } from "@/hooks/use-session"

/**
 * Guard for auth pages:
 * If user is already authenticated, redirect them to their dashboard.
 *
 * ✅ Fix: If role was changed in DB (Navicat), force-refresh session first
 * so redirect uses the updated role.
 */
export function AuthRedirectIfAuthed({ children }: { children: ReactNode }) {
    const { loading, user } = useSession()
    const [syncing, setSyncing] = useState(false)
    const didRefreshRef = useRef(false)

    useEffect(() => {
        if (loading) return

        // If not logged in, reset the "didRefresh" so next login can refresh
        if (!user) {
            didRefreshRef.current = false
            return
        }

        // If logged in and we haven't refreshed yet, refresh once
        if (didRefreshRef.current) return
        didRefreshRef.current = true

        setSyncing(true)
        refreshSession().finally(() => setSyncing(false))
    }, [loading, user])

    if (loading || syncing) return <PageLoadingOverlay label="Checking session…" />
    if (user) return <Navigate to={dashboardForRole(user.accountType)} replace />

    return <>{children}</>
}
