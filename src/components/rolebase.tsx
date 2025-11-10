import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { PageLoadingOverlay } from "./loading"
import { useSession, dashboardForRole } from "@/hooks/use-session"

/**
 * Guard for auth pages:
 * If user is already authenticated, redirect them to their dashboard.
 */
export function AuthRedirectIfAuthed({ children }: { children: ReactNode }) {
    const { loading, user } = useSession()

    if (loading) return <PageLoadingOverlay label="Checking session…" />
    if (user) return <Navigate to={dashboardForRole(user.accountType)} replace />

    return <>{children}</>
}
