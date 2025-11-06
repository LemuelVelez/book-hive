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
  // Support both localhost and 127.0.0.1 on standard Vite port
  const isViteDev = /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin);
  return isViteDev ? "http://localhost:5000" : undefined;
}

const base =
  (raw && stripTrailingSlash(String(raw))) ||
  (guessDevApi() && stripTrailingSlash(String(guessDevApi()))) ||
  (typeof window !== "undefined"
    ? stripTrailingSlash(window.location.origin)
    : "");

export const API_BASE = base;

// Helper to build absolute path to `/api/*`
const api = (p: string) => `${API_BASE}/api${p}`;

if (import.meta.env.DEV) {
  // Helpful during dev to ensure we're talking to the right server
  console.info("[Book-Hive] API_BASE ->", API_BASE);
}

export const ROUTES = {
  health: api("/health"),
  auth: {
    login: api("/auth/login"),
    register: api("/auth/register"),
    // FIX: these must include `/auth`
    verifyEmail: api("/auth/verify-email"), // POST (re-send)
    verifyConfirm: api("/auth/verify-email/confirm"), // GET/POST with ?token=...
  },
  users: {
    checkStudentId: (studentId: string) =>
      api(`/users/check-student-id?studentId=${encodeURIComponent(studentId)}`),
  },
  support: {
    ticket: api("/support/ticket"),
  },
} as const;
