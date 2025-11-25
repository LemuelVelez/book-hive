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
): "/dashboard/student" | "/dashboard/librarian" | "/dashboard/faculty" | "/dashboard/admin" {
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

/* ------------------------------------------------------------------
   Global session cache so we DON'T keep calling /api/auth/me
   from every component that uses useSession().
------------------------------------------------------------------- */

let cachedUser: UserDTO | null = null
let hasResolved = false
let inFlight: Promise<UserDTO | null> | null = null

async function fetchSessionOnce(): Promise<UserDTO | null> {
  // If we've already resolved a session in this tab, reuse it
  if (hasResolved) return cachedUser

  // If a request is already in flight, reuse that promise
  if (!inFlight) {
    inFlight = apiMe()
      .then((u) => {
        cachedUser = u
        hasResolved = true
        return u
      })
      .catch(() => {
        cachedUser = null
        hasResolved = true
        return null
      })
      .finally(() => {
        inFlight = null
      })
  }

  return inFlight
}

/** Hook: fetch current session once per browser tab (cached) */
export function useSession(): { loading: boolean; user: UserDTO | null } {
  // Start with cached values (if any)
  const [user, setUser] = useState<UserDTO | null>(cachedUser)
  const [loading, setLoading] = useState(!hasResolved)

  useEffect(() => {
    let cancelled = false

    // If we already know the session, sync the state and bail
    if (hasResolved) {
      setUser(cachedUser)
      setLoading(false)
      return
    }

    fetchSessionOnce()
      .then((u) => {
        if (cancelled) return
        setUser(u)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { loading, user }
}

/** ✅ Called after LOGIN to update the global cache immediately */
export function setSessionUser(u: UserDTO | null) {
  cachedUser = u
  hasResolved = true
  inFlight = null
}

/** Optional helper: call this after LOGOUT if you want to reset the cache */
export function clearSessionCache() {
  cachedUser = null
  hasResolved = false
  inFlight = null
}
