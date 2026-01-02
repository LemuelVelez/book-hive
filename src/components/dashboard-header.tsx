// src/components/dashboard-header.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { me as apiMe, logout as apiLogout } from "@/lib/authentication"
import { clearSessionCache } from "@/hooks/use-session"

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

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader as DialogHeaderUI,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { fetchBooks, type BookDTO } from "@/lib/books"
import { createSelfBorrow } from "@/lib/borrows"

type Role = "student" | "other" | "faculty" | "librarian" | "admin"

function fmtDate(d?: string | null) {
    if (!d) return "—"
    try {
        const date = new Date(d)
        if (Number.isNaN(date.getTime())) return d
        return date.toLocaleDateString("en-CA")
    } catch {
        return d
    }
}

function clampInt(n: number, min: number, max: number) {
    const v = Math.floor(Number(n))
    if (!Number.isFinite(v)) return min
    return Math.min(max, Math.max(min, v))
}

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

function resolveAvatarUrl(u: any): string | undefined {
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

function dashboardHomeForRole(role?: Role): string {
    if (role === "librarian") return "/dashboard/librarian"
    if (role === "faculty") return "/dashboard/faculty"
    if (role === "admin") return "/dashboard/admin"
    return "/dashboard" // student + other
}

function settingsPathForRole(role?: Role): string | null {
    // ✅ only route that exists in your App.tsx
    if (role === "student" || role === "other" || role === undefined) return "/dashboard/settings"
    return null
}

export function DashboardHeader({ title = "Dashboard" }: { title?: string }) {
    const location = useLocation()
    const navigate = useNavigate()
    const pathname = location.pathname

    const [user, setUser] = React.useState<any | null | undefined>(undefined)

    const [userMenuOpen, setUserMenuOpen] = React.useState(false)
    const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false)
    const [loggingOut, setLoggingOut] = React.useState(false)

    const [reserveOpen, setReserveOpen] = React.useState(false)
    const [reserveLoading, setReserveLoading] = React.useState(false)
    const [reserveSubmitting, setReserveSubmitting] = React.useState(false)
    const [books, setBooks] = React.useState<BookDTO[]>([])
    const [selectedBookId, setSelectedBookId] = React.useState<string>("")

    // ✅ NEW: copies-to-borrow in header reserve dialog
    const [reserveCopies, setReserveCopies] = React.useState<number>(1)

    React.useEffect(() => {
        let cancelled = false

            ; (async () => {
                try {
                    const u = await apiMe()
                    if (!cancelled) setUser(u)
                } catch {
                    if (!cancelled) setUser(null)
                }
            })()

        return () => {
            cancelled = true
        }
    }, [])

    React.useEffect(() => {
        setUserMenuOpen(false)
        setLogoutConfirmOpen(false)
    }, [location.pathname])

    function inferRoleFromPath(path: string): Role | undefined {
        if (path.startsWith("/dashboard/librarian")) return "librarian"
        if (path.startsWith("/dashboard/faculty")) return "faculty"
        if (path.startsWith("/dashboard/admin")) return "admin"
        if (path.startsWith("/dashboard")) return "student"
        return undefined
    }

    function formatRole(raw: string | undefined): string {
        if (!raw) return ""
        const map: Record<string, string> = {
            student: "Student",
            other: "Guest",
            librarian: "Librarian",
            faculty: "Faculty",
            admin: "Admin",
        }
        return map[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
    }

    const rawRole: Role | undefined =
        (user?.accountType as Role | undefined) ??
        (user?.role as Role | undefined) ??
        inferRoleFromPath(pathname)

    const roleLabel = formatRole(rawRole)

    const displayName =
        user?.fullName ||
        user?.name ||
        user?.full_name ||
        user?.student_name ||
        user?.email ||
        ""

    const showWelcome = !!roleLabel || !!displayName
    const showReserve = rawRole === "student" || rawRole === "other" || rawRole === "faculty"

    const availableBooks = React.useMemo(() => books.filter((b) => b.available), [books])

    const selectedBook = React.useMemo(() => {
        if (!selectedBookId) return null
        return books.find((b) => b.id === selectedBookId) ?? null
    }, [books, selectedBookId])

    const maxReserveCopies = React.useMemo(() => {
        const n = (selectedBook as any)?.numberOfCopies
        return typeof n === "number" && n > 0 ? n : 1
    }, [selectedBook])

    const reserveQty = clampInt(reserveCopies, 1, maxReserveCopies)

    React.useEffect(() => {
        if (!reserveOpen) return
        if (books.length > 0) return

        let cancelled = false

            ; (async () => {
                setReserveLoading(true)
                try {
                    const data = await fetchBooks()
                    if (!cancelled) setBooks(data)
                } catch (err: any) {
                    const msg = err?.message || "Failed to load books for reservation. Please try again."
                    toast.error("Failed to load books", { description: msg })
                } finally {
                    if (!cancelled) setReserveLoading(false)
                }
            })()

        return () => {
            cancelled = true
        }
    }, [reserveOpen, books.length])

    async function handleReserveConfirm() {
        if (!selectedBookId) {
            toast.warning("Choose a book first", {
                description: "Please select a book you want to reserve.",
            })
            return
        }

        const chosen = books.find((b) => b.id === selectedBookId)
        if (!chosen) {
            toast.error("Invalid selection", { description: "The selected book could not be found." })
            return
        }

        if (!chosen.available) {
            toast.info("Book is not available right now.", {
                description: "You can only reserve books marked as Available.",
            })
            return
        }

        const maxCopies =
            typeof (chosen as any)?.numberOfCopies === "number" && (chosen as any).numberOfCopies > 0
                ? (chosen as any).numberOfCopies
                : 1

        const requestedCopies = clampInt(reserveCopies, 1, maxCopies)

        setReserveSubmitting(true)
        try {
            const created: any[] = []

            // Borrow/reserve copies one-by-one (works even if API only supports 1 per call)
            for (let i = 0; i < requestedCopies; i++) {
                try {
                    const record = await createSelfBorrow(selectedBookId)
                    created.push(record)
                } catch (err: any) {
                    if (created.length === 0) throw err

                    const msg = err?.message || "Some copies could not be borrowed."
                    toast.warning("Partial reserve completed", {
                        description: `Reserved ${created.length} of ${requestedCopies} copies. ${msg}`,
                    })
                    break
                }
            }

            if (created.length === 0) return

            const due = fmtDate(created[0]?.dueDate)

            if (created.length === requestedCopies) {
                toast.success("Reserve submitted", {
                    description: `${created.length} cop${created.length === 1 ? "y" : "ies"} of "${chosen.title}" has been reserved/borrowed. Due on ${due}.`,
                })
            } else {
                toast.warning("Reserve partially submitted", {
                    description: `${created.length} cop${created.length === 1 ? "y" : "ies"} of "${chosen.title}" has been reserved/borrowed. Due on ${due}.`,
                })
            }

            // Best-effort refresh to keep availability/copies accurate
            try {
                const latest = await fetchBooks()
                setBooks(latest)
            } catch {
                // ignore; keep current list
            }

            setReserveOpen(false)
            setSelectedBookId("")
            setReserveCopies(1)
        } catch (err: any) {
            const msg = err?.message || "Could not reserve this book right now. Please try again later."
            toast.error("Reservation failed", { description: msg })
        } finally {
            setReserveSubmitting(false)
        }
    }

    function handleReserveOpenChange(open: boolean) {
        setReserveOpen(open)
        if (!open) {
            setSelectedBookId("")
            setReserveCopies(1)
        }
    }

    const userEmail: string = user?.email || ""
    const userFullName: string = user?.fullName || user?.name || user?.full_name || ""
    const initials = initialsFrom(userFullName, userEmail)
    const headerName =
        (userFullName && userFullName.trim()) ||
        (userEmail ? userEmail.split("@")[0] : "Guest") ||
        "Guest"
    const headerEmail = userEmail || "Not signed in"

    const avatarSrc = resolveAvatarUrl(user)

    function openLogoutConfirm() {
        setUserMenuOpen(false)
        setLogoutConfirmOpen(true)
    }

    function goDashboard() {
        setUserMenuOpen(false)
        navigate(dashboardHomeForRole(rawRole))
    }

    function goSettings() {
        setUserMenuOpen(false)
        const p = settingsPathForRole(rawRole)
        if (p) {
            navigate(p)
            return
        }
        toast.info("Settings", {
            description: "Settings is only available for Student/Guest accounts right now.",
        })
    }

    async function onLogoutConfirmed() {
        try {
            setLoggingOut(true)
            await apiLogout()
            clearSessionCache()
            setUser(null)

            toast.success("You’ve been logged out.")
            setUserMenuOpen(false)
            setLogoutConfirmOpen(false)
            navigate("/", { replace: true })
        } catch (err: any) {
            const msg = String(err?.message || "Failed to log out. Please try again.")
            toast.error("Logout failed", { description: msg })
        } finally {
            setLoggingOut(false)
        }
    }

    return (
        <header className="sticky top-0 z-10 bg-slate-800/60 backdrop-blur supports-backdrop-filter:bg-slate-800/60 border-b border-white/10">
            <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-3">
                <SidebarTrigger />

                <div className="flex-1 min-w-0">
                    <h1 className="text-base md:text-lg font-semibold tracking-tight truncate">{title}</h1>
                    {showWelcome && (
                        <p className="mt-0.5 text-xs md:text-sm text-white/70 truncate">
                            Welcome
                            {roleLabel && (
                                <>
                                    , <span className="font-medium">{roleLabel}</span>
                                </>
                            )}
                            {displayName && (
                                <>
                                    {" "}
                                    <span className="font-medium">{displayName}</span>
                                </>
                            )}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {showReserve && (
                        <Dialog open={reserveOpen} onOpenChange={handleReserveOpenChange}>
                            <DialogTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="hidden md:inline-flex border-white/20 text-white/90 hover:bg-white/10"
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Reserve
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="bg-slate-900 text-white border-white/10">
                                <DialogHeaderUI>
                                    <DialogTitle className="text-sm md:text-base">Quick reserve</DialogTitle>
                                    <DialogDescription className="text-white/70 text-xs md:text-sm">
                                        Choose a book to reserve/borrow. This works the same as borrowing from the{" "}
                                        <span className="font-semibold">Browse Books</span> page.
                                    </DialogDescription>
                                </DialogHeaderUI>

                                <div className="mt-3 space-y-3 text-sm">
                                    {reserveLoading ? (
                                        <p className="text-xs text-white/60">Loading available books…</p>
                                    ) : availableBooks.length === 0 ? (
                                        <p className="text-xs text-white/60">
                                            There are currently no books available to reserve. Try again later or browse
                                            the catalog.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-white/80">
                                                    Select book to reserve
                                                </label>
                                                <Select
                                                    value={selectedBookId}
                                                    onValueChange={(v) => {
                                                        setSelectedBookId(v)
                                                        setReserveCopies(1)
                                                    }}
                                                >
                                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                                        <SelectValue placeholder="Choose a book" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 text-white border-white/10 max-h-64">
                                                        {availableBooks.map((b) => (
                                                            <SelectItem key={b.id} value={b.id}>
                                                                {b.title} — {b.author}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[11px] text-white/50">
                                                    Only books currently marked as{" "}
                                                    <span className="font-semibold text-emerald-300">Available</span> are shown
                                                    here.
                                                </p>
                                            </div>

                                            {/* ✅ NEW: copies selector */}
                                            <div className="pt-1">
                                                <div className="text-xs font-medium text-white/80 mb-1">
                                                    Copies to borrow
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="outline"
                                                        className="border-white/20 text-white hover:bg-white/10"
                                                        onClick={() => setReserveCopies((v) => clampInt(v - 1, 1, maxReserveCopies))}
                                                        disabled={
                                                            reserveSubmitting ||
                                                            reserveLoading ||
                                                            !selectedBookId ||
                                                            reserveQty <= 1
                                                        }
                                                        aria-label="Decrease copies"
                                                    >
                                                        <Minus className="h-4 w-4" aria-hidden="true" />
                                                    </Button>

                                                    <Input
                                                        value={String(reserveQty)}
                                                        onChange={(e) =>
                                                            setReserveCopies(
                                                                clampInt(Number(e.target.value), 1, maxReserveCopies)
                                                            )
                                                        }
                                                        inputMode="numeric"
                                                        className="w-16 h-9 text-center bg-slate-900/70 border-white/20 text-white"
                                                        aria-label="Copies to borrow"
                                                        disabled={reserveSubmitting || reserveLoading || !selectedBookId}
                                                    />

                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="outline"
                                                        className="border-white/20 text-white hover:bg-white/10"
                                                        onClick={() => setReserveCopies((v) => clampInt(v + 1, 1, maxReserveCopies))}
                                                        disabled={
                                                            reserveSubmitting ||
                                                            reserveLoading ||
                                                            !selectedBookId ||
                                                            reserveQty >= maxReserveCopies
                                                        }
                                                        aria-label="Increase copies"
                                                    >
                                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                                    </Button>

                                                    <span className="text-xs text-white/60">Max {maxReserveCopies}</span>
                                                </div>

                                                <p className="text-[11px] text-white/60 mt-1">
                                                    Total physical copies in the library: {maxReserveCopies}.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter className="mt-4 flex flex-row justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-white/20 text-white hover:bg-black/20"
                                        onClick={() => handleReserveOpenChange(false)}
                                        disabled={reserveSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                        onClick={() => void handleReserveConfirm()}
                                        disabled={
                                            reserveSubmitting ||
                                            reserveLoading ||
                                            availableBooks.length === 0 ||
                                            !selectedBookId
                                        }
                                    >
                                        {reserveSubmitting ? (
                                            <span className="inline-flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Reserving…
                                            </span>
                                        ) : (
                                            "Confirm reserve"
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}

                    <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                aria-label={`${headerName} account menu`}
                            >
                                <Avatar className="h-8 w-8">
                                    {/* ✅ crop instead of stretch */}
                                    <AvatarImage src={avatarSrc} alt={headerName} className="object-cover object-center" />
                                    <AvatarFallback>
                                        {user === undefined ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : initials}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align="end"
                            className="w-[220px] bg-slate-900 text-white border-white/10"
                        >
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                        <AvatarImage src={avatarSrc} alt={headerName} className="object-cover object-center" />
                                        <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-xs">
                                        <div className="font-medium">{headerName}</div>
                                        <div className="opacity-70">{headerEmail}</div>
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

                    <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
                        <AlertDialogContent className="bg-slate-900 text-white border-white/10">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Log out of Book-Hive?</AlertDialogTitle>
                                <AlertDialogDescription className="text-white/70">
                                    You’ll be signed out from this device and will need to sign in again to access
                                    your dashboard.
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
                </div>
            </div>
        </header>
    )
}
