import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { PageLoadingOverlay } from "./loading";
import {
    useSession,
    dashboardForRole,
    refreshSession,
    getUserRole,
} from "@/hooks/use-session";

/**
 * Guard for auth pages:
 * If user is already authenticated, redirect them to their dashboard.
 *
 * ✅ Fix: redirect uses ROLE (user.role) not accountType
 * ✅ Also refresh once so DB role changes are picked up.
 */
export function AuthRedirectIfAuthed({ children }: { children: ReactNode }) {
    const { loading, user } = useSession();
    const [syncing, setSyncing] = useState(false);
    const didRefreshRef = useRef(false);

    useEffect(() => {
        if (loading) return;

        if (!user) {
            didRefreshRef.current = false;
            return;
        }

        if (didRefreshRef.current) return;
        didRefreshRef.current = true;

        setSyncing(true);
        refreshSession().finally(() => setSyncing(false));
    }, [loading, user]);

    if (loading || syncing) return <PageLoadingOverlay label="Checking session…" />;

    if (user) {
        const role = getUserRole(user) ?? "student";
        return <Navigate to={dashboardForRole(role)} replace />;
    }

    return <>{children}</>;
}
