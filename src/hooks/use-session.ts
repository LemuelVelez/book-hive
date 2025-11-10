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

/** Hook: fetch current session once */
export function useSession(): { loading: boolean; user: UserDTO | null } {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserDTO | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const u = await apiMe()
        if (!cancelled) setUser(u)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { loading, user }
}
