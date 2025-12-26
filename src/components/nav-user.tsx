/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { me as apiMe, logout as apiLogout, type UserDTO } from "@/lib/authentication"
import { Loader2 } from "lucide-react"
import { clearSessionCache } from "@/hooks/use-session"

type Role = "student" | "other" | "faculty" | "librarian" | "admin"

type UserWithAvatar = UserDTO & {
    avatarUrl?: string | null
    avatar_url?: string | null
    avatar?: string | null
    photoURL?: string | null
    photoUrl?: string | null
    imageUrl?: string | null
    image?: string | null
}

/** ---------- small helpers ---------- */
function initialsFrom(fullName?: string | null, email?: string | null) {
    const src = (fullName && fullName.trim()) || (email && email.trim()) || ""
    if (!src) return "U"
    const parts = src.split(/\s+/).filter(Boolean)
    const raw =
        parts.length >= 2
            ? (parts[0][0] || "") + (parts[1][0] || "")
            : (src[0] || "") + (src[1] || "")
    return raw.toUpperCase()
}

function displayName(user: UserDTO | null) {
    if (!user) return "Guest"
    return user.fullName?.trim() || user.email?.split("@")[0] || "User"
}

function displayEmail(user: UserDTO | null) {
    if (!user) return "Not signed in"
    return user.email
}

function resolveAvatarUrl(u: UserWithAvatar | null): string | undefined {
    const v =
        u?.avatarUrl ??
        u?.avatar_url ??
        u?.avatar ??
        u?.photoURL ??
        u?.photoUrl ??
        u?.imageUrl ??
        u?.image ??
        null
    const s = typeof v === "string" ? v.trim() : ""
    return s ? s : undefined
}

function inferRoleFromPath(path: string): Role | undefined {
    if (path.startsWith("/dashboard/librarian")) return "librarian"
    if (path.startsWith("/dashboard/faculty")) return "faculty"
    if (path.startsWith("/dashboard/admin")) return "admin"
    if (path.startsWith("/dashboard")) return "student"
    return undefined
}

function dashboardHomeForRole(role?: Role): string {
    if (role === "librarian") return "/dashboard/librarian"
    if (role === "faculty") return "/dashboard/faculty"
    if (role === "admin") return "/dashboard/admin"
    // student + other share /dashboard in your routes
    return "/dashboard"
}

function settingsPathForRole(role?: Role): string | null {
    // ✅ only route that exists in your App.tsx
    if (role === "student" || role === "other" || role === undefined) return "/dashboard/settings"
    return null
}

/** ---------- module-level cache to avoid refetch flicker across routes ---------- */
let cachedUser: UserWithAvatar | null = null
let cachedUserLoaded = false

export function NavUser() {
    const navigate = useNavigate()
    const location = useLocation()
    const { state } = useSidebar()
    const collapsed = state === "collapsed"

    const [user, setUser] = React.useState<UserWithAvatar | null>(cachedUser)
    const [loading, setLoading] = React.useState<boolean>(() => !cachedUserLoaded)

    const [menuOpen, setMenuOpen] = React.useState(false)
    const [confirmOpen, setConfirmOpen] = React.useState(false)
    const [loggingOut, setLoggingOut] = React.useState(false)

    React.useEffect(() => {
        setMenuOpen(false)
        setConfirmOpen(false)
    }, [location.pathname])

    React.useEffect(() => {
        if (cachedUserLoaded) {
            setLoading(false)
            return
        }

        let cancelled = false
            ; (async () => {
                try {
                    const u = (await apiMe()) as any
                    if (!cancelled) {
                        cachedUser = u
                        cachedUserLoaded = true
                        setUser(u)
                    }
                } catch {
                    if (!cancelled) cachedUserLoaded = true
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()

        return () => {
            cancelled = true
        }
    }, [])

    const rawRole: Role | undefined =
        (user?.accountType as Role | undefined) ??
        (user?.role as Role | undefined) ??
        inferRoleFromPath(location.pathname)

    const dashboardHome = dashboardHomeForRole(rawRole)
    const settingsPath = settingsPathForRole(rawRole)

    async function onLogoutConfirmed() {
        try {
            setLoggingOut(true)

            await apiLogout()
            clearSessionCache()
            cachedUser = null
            cachedUserLoaded = false
            setUser(null)
            setLoading(false)

            toast.success("You’ve been logged out.")
            setMenuOpen(false)
            setConfirmOpen(false)
            navigate("/", { replace: true })
        } catch (err: any) {
            const msg = String(err?.message || "Failed to log out. Please try again.")
            toast.error("Logout failed", { description: msg })
        } finally {
            setLoggingOut(false)
        }
    }

    function openLogoutConfirm() {
        setMenuOpen(false)
        setConfirmOpen(true)
    }

    function goDashboard() {
        setMenuOpen(false)
        navigate(dashboardHome)
    }

    function goSettings() {
        setMenuOpen(false)
        if (settingsPath) {
            navigate(settingsPath)
            return
        }
        toast.info("Settings", {
            description: "Settings is only available for Student/Guest accounts right now.",
        })
    }

    const name = displayName(user)
    const email = displayEmail(user)
    const initials = initialsFrom(user?.fullName, user?.email)
    const avatarSrc = resolveAvatarUrl(user)

    if (collapsed) {
        return (
            <SidebarMenu>
                <SidebarMenuItem className="flex justify-center">
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                aria-label={`${name} account menu`}
                            >
                                <Avatar className="h-8 w-8">
                                    {/* ✅ crop instead of stretch */}
                                    <AvatarImage src={avatarSrc} alt={name} className="object-cover object-center" />
                                    <AvatarFallback>
                                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : initials}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align="start"
                            side="top"
                            className="w-[220px] bg-slate-900 text-white border-white/10"
                        >
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                        <AvatarImage src={avatarSrc} alt={name} className="object-cover object-center" />
                                        <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-xs">
                                        <div className="font-medium">{name}</div>
                                        <div className="opacity-70">{email}</div>
                                    </div>
                                </div>
                            </DropdownMenuLabel>

                            <DropdownMenuSeparator className="bg-white/10" />

                            {user ? (
                                <>
                                    <DropdownMenuItem onClick={goDashboard} className="focus:bg-white/10">
                                        My dashboard
                                    </DropdownMenuItem>

                                    <DropdownMenuItem onClick={goSettings} className="focus:bg-white/10">
                                        Settings
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-white/10" />

                                    <DropdownMenuItem
                                        onClick={openLogoutConfirm}
                                        className="text-red-400 focus:bg-red-500/10"
                                    >
                                        Log out
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                <DropdownMenuItem onClick={() => navigate("/auth")} className="focus:bg-white/10">
                                    Sign in
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>

                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <AlertDialogContent className="bg-slate-900 text-white border-white/10">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Log out of Book-Hive?</AlertDialogTitle>
                            <AlertDialogDescription className="text-white/70">
                                You’ll be signed out from this device and will need to sign in again to access your
                                dashboard.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={loggingOut} className="bg-slate-800 border-white/10">
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                disabled={loggingOut}
                                onClick={onLogoutConfirmed}
                                className="bg-red-600 hover:bg-red-600/90 text-white focus:ring-red-500"
                            >
                                {loggingOut ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Logging out…
                                    </span>
                                ) : (
                                    "Log out"
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </SidebarMenu>
        )
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[active=true]:bg-transparent">
                            <Avatar className="h-6 w-6">
                                {/* ✅ crop instead of stretch */}
                                <AvatarImage src={avatarSrc} alt={name} className="object-cover object-center" />
                                <AvatarFallback>
                                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{loading ? "Loading…" : name}</span>
                                <span className="truncate text-xs opacity-70">{loading ? " " : email}</span>
                            </div>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="start"
                        side="top"
                        className="w-[220px] bg-slate-900 text-white border-white/10"
                    >
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                    <AvatarImage src={avatarSrc} alt={name} className="object-cover object-center" />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="text-xs">
                                    <div className="font-medium">{name}</div>
                                    <div className="opacity-70">{email}</div>
                                </div>
                            </div>
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator className="bg-white/10" />

                        {user ? (
                            <>
                                <DropdownMenuItem onClick={goDashboard} className="focus:bg-white/10">
                                    My dashboard
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={goSettings} className="focus:bg-white/10">
                                    Settings
                                </DropdownMenuItem>

                                <DropdownMenuSeparator className="bg-white/10" />

                                <DropdownMenuItem
                                    onClick={openLogoutConfirm}
                                    className="text-red-400 focus:bg-red-500/10"
                                >
                                    Log out
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <DropdownMenuItem onClick={() => navigate("/auth")} className="focus:bg-white/10">
                                Sign in
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="bg-slate-900 text-white border-white/10">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Log out of Book-Hive?</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/70">
                            You’ll be signed out from this device and will need to sign in again to access your
                            dashboard.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loggingOut} className="bg-slate-800 border-white/10">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={loggingOut}
                            onClick={onLogoutConfirmed}
                            className="bg-red-600 hover:bg-red-600/90 text-white focus:ring-red-500"
                        >
                            {loggingOut ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Logging out…
                                </span>
                            ) : (
                                "Log out"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SidebarMenu>
    )
}
