import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PageLoadingOverlay } from "./components/loading"
import { Toaster } from "@/components/ui/sonner"

// Lazy-loaded pages for code-splitting
const LandingPage = lazy(() => import('./pages/landing'))
const AuthPage = lazy(() => import('./pages/auth/auth'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/forgot-password'))
const ResetPasswordPage = lazy(() => import('./pages/auth/reset-password'))
const VerifyEmailPage = lazy(() => import('./pages/auth/verify-email'))
const VerifyEmailCallbackPage = lazy(() => import('./pages/auth/verify-email-callback'))

// const StudentDashboard = lazy(() => import('./pages/dashboard/student/dashboard'))
const NotFoundPage = lazy(() => import('./pages/404'))

function App() {
  return (
    <BrowserRouter>
      {/* Global toast portal (Sonner) */}
      <Toaster position="top-center" richColors closeButton theme="dark" />

      <Suspense fallback={<PageLoadingOverlay label="Loading page…" />}>
        <Routes>
          {/* Public / Landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/verify-email/callback" element={<VerifyEmailCallbackPage />} />

          {/* Dashboards */}
          <Route path="/dashboard" element={<Navigate to="/dashboard/student" replace />} />
          {/* <Route path="/dashboard/student" element={<StudentDashboard />} /> */}

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
