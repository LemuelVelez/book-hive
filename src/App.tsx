import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { PageLoadingOverlay } from "./components/loading"
import { Toaster } from "@/components/ui/sonner"
import type { UserDTO } from "@/lib/authentication"
import { me as apiMe } from "@/lib/authentication"
import NotFoundPage from './pages/404'

// Lazy-loaded pages for code-splitting
const LandingPage = lazy(() => import('./pages/landing'))
const AuthPage = lazy(() => import('./pages/auth/auth'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/forgot-password'))
const ResetPasswordPage = lazy(() => import('./pages/auth/reset-password'))
const VerifyEmailPage = lazy(() => import('./pages/auth/verify-email'))
const VerifyEmailCallbackPage = lazy(() => import('./pages/auth/verify-email-callback'))

// Dashboards
const StudentDashboard = lazy(() => import('./pages/dashboard/student/dashboard'))
const LibrarianDashboard = lazy(() => import('./pages/dashboard/librarian/dashboard'))
// const FacultyDashboard = lazy(() => import('./pages/dashboard/faculty'))
// const AdminDashboard = lazy(() => import('./pages/dashboard/admin'))

type Role = UserDTO["accountType"]; // "student" | "librarian" | "faculty" | "admin" | "other"

/** Map a role to its dashboard route */
function dashboardForRole(role: Role) {
  switch (role) {
    case "student":
      return "/dashboard/student"
    case "librarian":
      return "/dashboard/librarian"
    case "faculty":
      return "/dashboard/faculty"
    case "admin":
      return "/dashboard/admin"
    default:
      // Fallback if an unknown/other role logs in
      return "/dashboard/student"
  }
}

/** Hook: fetch current session once */
function useSession() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserDTO | null>(null)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const u = await apiMe()
          if (!cancelled) setUser(u)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => { cancelled = true }
  }, [])

  return { loading, user }
}

/** Guard: if user is authenticated, redirect away from auth pages to their dashboard */
function AuthRedirectIfAuthed({ children }: { children: ReactNode }) {
  const { loading, user } = useSession()
  if (loading) return <PageLoadingOverlay label="Checking session…" />
  if (user) return <Navigate to={dashboardForRole(user.accountType)} replace />
  return <>{children}</>
}

/** Guard: require auth, else send to /auth?next=…; enforce role access */
function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { loading, user } = useSession()
  const location = useLocation()

  if (loading) return <PageLoadingOverlay label="Loading…" />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/auth?next=${next}`} replace />
  }

  // If logged in but role doesn't match, bounce to their dashboard
  if (!allow.includes(user.accountType)) {
    return <Navigate to={dashboardForRole(user.accountType)} replace />
  }

  return <>{children}</>
}

/** Route component: /dashboard root decides where to send user */
function DashboardIndex() {
  const { loading, user } = useSession()
  if (loading) return <PageLoadingOverlay label="Loading dashboard…" />
  if (!user) return <Navigate to="/auth?next=%2Fdashboard" replace />
  return <Navigate to={dashboardForRole(user.accountType)} replace />
}

function App() {
  return (
    <BrowserRouter>
      {/* Global toast portal (Sonner) */}
      <Toaster position="top-center" richColors closeButton theme="dark" />

      <Suspense fallback={<PageLoadingOverlay label="Loading page…" />}>
        <Routes>
          {/* Public / Landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth (auto-redirect if already logged in) */}
          <Route
            path="/auth"
            element={
              <AuthRedirectIfAuthed>
                <AuthPage />
              </AuthRedirectIfAuthed>
            }
          />
          <Route
            path="/auth/forgot-password"
            element={
              <AuthRedirectIfAuthed>
                <ForgotPasswordPage />
              </AuthRedirectIfAuthed>
            }
          />
          <Route
            path="/auth/reset-password"
            element={
              <AuthRedirectIfAuthed>
                <ResetPasswordPage />
              </AuthRedirectIfAuthed>
            }
          />
          <Route
            path="/auth/verify-email"
            element={
              <AuthRedirectIfAuthed>
                <VerifyEmailPage />
              </AuthRedirectIfAuthed>
            }
          />
          <Route
            path="/auth/verify-email/callback"
            element={
              <AuthRedirectIfAuthed>
                <VerifyEmailCallbackPage />
              </AuthRedirectIfAuthed>
            }
          />

          {/* Dashboards root decides based on role */}
          <Route path="/dashboard" element={<DashboardIndex />} />

          {/* Role-scoped dashboards */}
          <Route
            path="/dashboard/student"
            element={
              <RequireRole allow={["student"]}>
                <StudentDashboard />
              </RequireRole>
            }
          />
          <Route path="/dashboard/librarian" element={
            <RequireRole allow={["librarian"]}>
              <LibrarianDashboard />
            </RequireRole>
          } />
          {/* <Route path="/dashboard/faculty" element={
            <RequireRole allow={["faculty"]}>
              <FacultyDashboard />
            </RequireRole>
          } />
          <Route path="/dashboard/admin" element={
            <RequireRole allow={["admin"]}>
              <AdminDashboard />
            </RequireRole>
          } /> */}

          {/* 404 */}
          <Route path="*" element={<Navigate to="/404" replace />} />
          <Route
            path="/404"
            element={
              <Suspense fallback={<PageLoadingOverlay label="Loading…" />}>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
