/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * API base resolution:
 * 1) Use VITE_API_BASE_URL if provided (best for production).
 * 2) If running on Vite dev server (localhost:5173 or 127.0.0.1:5173), default to http://localhost:5000.
 * 3) Otherwise fall back to window.location.origin (same-origin deployments / reverse proxy).
 */
const raw = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;

function stripTrailingSlash(u: string) {
  return u.replace(/\/+$/, "");
}

function guessDevApi() {
  if (typeof window === "undefined") return undefined;
  const origin = window.location.origin;
  const isViteDev = /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin);
  return isViteDev ? "http://localhost:5000" : undefined;
}

const base =
  (raw && stripTrailingSlash(String(raw))) ||
  (guessDevApi() && stripTrailingSlash(String(guessDevApi()))) ||
  (typeof window !== "undefined" ? stripTrailingSlash(window.location.origin) : "");

export const API_BASE = base;

// Helper to build absolute path to `/api/*`
const api = (p: string) => `${API_BASE}/api${p}`;

if (import.meta.env.DEV) {
  console.info("[Book-Hive] API_BASE ->", API_BASE);
}

export const ROUTES = {
  health: api("/health"),
  auth: {
    me: api("/auth/me"),
    login: api("/auth/login"),
    logout: api("/auth/logout"),
    register: api("/auth/register"),
    verifyEmail: api("/auth/verify-email"), // POST (re-send)
    verifyConfirm: api("/auth/verify-email/confirm"), // POST token
    forgotPassword: api("/auth/forgot-password"),
    resetPassword: api("/auth/reset-password"),
  },
  users: {
    checkStudentId: (studentId: string) =>
      api(`/users/check-student-id?studentId=${encodeURIComponent(studentId)}`),

    me: api("/users/me"), // PATCH
    meAvatar: api("/users/me/avatar"), // POST/DELETE
    mePassword: api("/users/me/password"), // PATCH

    // ✅ manual verification send for logged-in user
    meVerifyEmail: api("/users/me/verify-email"), // POST

    // ✅ NEW: librarian/admin user management
    list: api("/users"), // GET
    pending: api("/users/pending"), // GET
    approve: (id: string) => api(`/users/${encodeURIComponent(id)}/approve`), // PATCH
    delete: (id: string) => api(`/users/${encodeURIComponent(id)}`), // DELETE
  },
  support: {
    ticket: api("/support/ticket"),
  },
} as const;
