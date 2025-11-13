import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PageLoadingOverlay } from './components/loading'
import { Toaster } from '@/components/ui/sonner'
import NotFoundPage from './pages/404'
import { AuthRedirectIfAuthed } from '@/components/rolebase'
import { RequireRole } from '@/components/roleguard'

// Lazy-loaded pages for code-splitting
const LandingPage = lazy(() => import('./pages/landing'))
const AuthPage = lazy(() => import('./pages/auth/auth'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/forgot-password'))
const ResetPasswordPage = lazy(() => import('./pages/auth/reset-password'))
const VerifyEmailPage = lazy(() => import('./pages/auth/verify-email'))
const VerifyEmailCallbackPage = lazy(
  () => import('./pages/auth/verify-email-callback')
)

// Dashboards
const StudentDashboard = lazy(
  () => import('./pages/dashboard/student/dashboard')
)
const StudentBooksPage = lazy(
  () => import('./pages/dashboard/student/book')
)
// ✅ Student Circulation page
const StudentCirculationPage = lazy(
  () => import('./pages/dashboard/student/circulation')
)
// ✅ Student Insights Hub page
const StudentInsightsHubPage = lazy(
  () => import('./pages/dashboard/student/insightsHub')
)

const LibrarianDashboard = lazy(
  () => import('./pages/dashboard/librarian/dashboard')
)
const LibrarianBooksPage = lazy(
  () => import('./pages/dashboard/librarian/books')
)
// ✅ Librarian Users page
const LibrarianUsersPage = lazy(
  () => import('./pages/dashboard/librarian/users')
)
// ✅ Librarian Borrow Records page
const LibrarianBorrowRecordsPage = lazy(
  () => import('./pages/dashboard/librarian/borrowRecords')
)
// ✅ Librarian Feedbacks page
const LibrarianFeedbacksPage = lazy(
  () => import('./pages/dashboard/librarian/feedbacks')
)
// ✅ Librarian Damage Reports page
const LibrarianDamageReportsPage = lazy(
  () => import('./pages/dashboard/librarian/damageReports')
)

const FacultyDashboard = lazy(
  () => import('./pages/dashboard/faculty/dashboard')
)
const AdminDashboard = lazy(
  () => import('./pages/dashboard/admin/dashboard')
)

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

          {/* ✅ Dashboards root: Student & Other overview at /dashboard */}
          <Route
            path="/dashboard"
            element={
              <RequireRole allow={['student', 'other']}>
                <StudentDashboard />
              </RequireRole>
            }
          />

          {/* ✅ Student / Other books page */}
          <Route
            path="/dashboard/books"
            element={
              <RequireRole allow={['student', 'other']}>
                <StudentBooksPage />
              </RequireRole>
            }
          />

          {/* ✅ Student / Other circulation page */}
          <Route
            path="/dashboard/circulation"
            element={
              <RequireRole allow={['student', 'other']}>
                <StudentCirculationPage />
              </RequireRole>
            }
          />

          {/* ✅ Student / Other Insights Hub page */}
          <Route
            path="/dashboard/insights"
            element={
              <RequireRole allow={['student', 'other']}>
                <StudentInsightsHubPage />
              </RequireRole>
            }
          />

          {/* Librarian routes */}
          <Route
            path="/dashboard/librarian"
            element={
              <RequireRole allow={['librarian']}>
                <LibrarianDashboard />
              </RequireRole>
            }
          />

          <Route
            path="/dashboard/librarian/books"
            element={
              <RequireRole allow={['librarian']}>
                <LibrarianBooksPage />
              </RequireRole>
            }
          />

          {/* ✅ Librarian Users (read-only) */}
          <Route
            path="/dashboard/librarian/users"
            element={
              <RequireRole allow={['librarian']}>
                <LibrarianUsersPage />
              </RequireRole>
            }
          />

          {/* ✅ Librarian Borrow Records */}
          <Route
            path="/dashboard/librarian/borrow-records"
            element={
              <RequireRole allow={['librarian']}>
                <LibrarianBorrowRecordsPage />
              </RequireRole>
            }
          />

          {/* ✅ Librarian Feedbacks */}
          <Route
            path="/dashboard/librarian/feedbacks"
            element={
              <RequireRole allow={['librarian']}>
                <LibrarianFeedbacksPage />
              </RequireRole>
            }
          />

          {/* ✅ Librarian Damage Reports */}
          <Route
            path="/dashboard/librarian/damage-reports"
            element={
              <RequireRole allow={['librarian']}>
                <LibrarianDamageReportsPage />
              </RequireRole>
            }
          />

          {/* Faculty & Admin */}
          <Route
            path="/dashboard/faculty"
            element={
              <RequireRole allow={['faculty']}>
                <FacultyDashboard />
              </RequireRole>
            }
          />

          <Route
            path="/dashboard/admin"
            element={
              <RequireRole allow={['admin']}>
                <AdminDashboard />
              </RequireRole>
            }
          />

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
