import { useEffect, useState } from "react"
import type { UserDTO } from "@/lib/authentication"
import { me as apiMe } from "@/lib/authentication"

/**
 * Role type alias based on backend UserDTO
 * "student" | "librarian" | "faculty" | "admin" | "other"
 */
export type Role = UserDTO["accountType"]

/** Map a role to its dashboard route */
export function dashboardForRole(
  role: Role
): "/dashboard" | "/dashboard/librarian" | "/dashboard/faculty" | "/dashboard/admin" {
  switch (role) {
    case "student":
    case "other":
      // Student & "other" share the same dashboard route
      return "/dashboard"
    case "librarian":
      return "/dashboard/librarian"
    case "faculty":
      return "/dashboard/faculty"
    case "admin":
      return "/dashboard/admin"
    default:
      // Fallback if an unknown role logs in
      return "/dashboard"
  }
}

/* ------------------------------------------------------------------
   Global session cache so we DON'T keep calling /api/auth/me
   from every component that uses useSession().
------------------------------------------------------------------- */

let cachedUser: UserDTO | null = null
let hasResolved = false
let inFlight: Promise<UserDTO | null> | null = null
let lastFetchAt = 0

type SessionSnapshot = { user: UserDTO | null; hasResolved: boolean }
type SessionListener = (s: SessionSnapshot) => void
const listeners = new Set<SessionListener>()

function emit() {
  const snap: SessionSnapshot = { user: cachedUser, hasResolved }
  for (const fn of listeners) fn(snap)
}

/**
 * Fetch session using cache (only once) — used by useSession()
 */
async function fetchSessionOnce(): Promise<UserDTO | null> {
  // If we've already resolved a session in this tab, reuse it
  if (hasResolved) return cachedUser

  // If a request is already in flight, reuse that promise
  if (!inFlight) {
    inFlight = apiMe()
      .then((u) => {
        setSessionUser(u)
        return u
      })
      .catch(() => {
        setSessionUser(null)
        return null
      })
      .finally(() => {
        inFlight = null
      })
  }

  return inFlight
}

/**
 * Force refresh session from the server (bypasses cache).
 * ✅ This is the key fix so Navicat role changes can be picked up immediately.
 */
export async function refreshSession(): Promise<UserDTO | null> {
  const u = await apiMe() // apiMe already returns null on error/unauth
  setSessionUser(u)
  return u
}

/**
 * Ensure session is fresh enough; if too old, refresh.
 * Useful if you want to reduce refresh calls.
 */
export async function ensureFreshSession(maxAgeMs = 15_000): Promise<UserDTO | null> {
  if (!hasResolved) return fetchSessionOnce()
  const age = Date.now() - lastFetchAt
  if (age <= maxAgeMs) return cachedUser
  return refreshSession()
}

/** Hook: fetch current session once per browser tab (cached) */
export function useSession(): { loading: boolean; user: UserDTO | null } {
  // Start with cached values (if any)
  const [user, setUser] = useState<UserDTO | null>(cachedUser)
  const [loading, setLoading] = useState(!hasResolved)

  useEffect(() => {
    let cancelled = false

    const onChange: SessionListener = (snap) => {
      if (cancelled) return
      setUser(snap.user)
      setLoading(!snap.hasResolved)
    }

    // Subscribe so updates (role changes, login, logout) propagate everywhere
    listeners.add(onChange)

    // Sync immediately with current snapshot
    onChange({ user: cachedUser, hasResolved })

    // If we haven't resolved yet, fetch once
    if (!hasResolved) {
      fetchSessionOnce().catch(() => {
        // fetchSessionOnce already sets user via setSessionUser(null)
      })
    }

    return () => {
      cancelled = true
      listeners.delete(onChange)
    }
  }, [])

  return { loading, user }
}

/** ✅ Called after LOGIN to update the global cache immediately */
export function setSessionUser(u: UserDTO | null) {
  cachedUser = u
  hasResolved = true
  inFlight = null
  lastFetchAt = Date.now()
  emit()
}

/** Optional helper: call this after LOGOUT if you want to reset the cache */
export function clearSessionCache() {
  cachedUser = null
  hasResolved = false
  inFlight = null
  lastFetchAt = 0
  emit()
}
