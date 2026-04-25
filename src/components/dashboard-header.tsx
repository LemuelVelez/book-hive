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
import { createSelfBorrow, formatBorrowReservationExpiry } from "@/lib/borrows"

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
    return "/dashboard" // student + other (guest)
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
        return undefined
    }

    function formatRole(raw: string | undefined): string {
        if (!raw) return ""
        const map: Record<string, string> = {
            student: "Student",
            other: "Guest", // ✅ "other" is still Guest
            librarian: "Librarian",
            faculty: "Faculty",
            admin: "Admin",
        }
        return map[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
    }

    /**
     * ✅ Use ROLE (not accountType) as the effective role everywhere in the header.
     * We only fall back to path/accountType if role is missing.
     */
    const rawRole: Role | undefined =
        (user?.role as Role | undefined) ??
        inferRoleFromPath(pathname) ??
        (user?.accountType as Role | undefined) ??
        undefined

    const roleLabel = formatRole(rawRole)

    const displayName =
        user?.fullName ||
        user?.name ||
        user?.full_name ||
        user?.student_name ||
        user?.admin_name ||
        user?.staff_name ||
        user?.email ||
        ""

    const showWelcome = !!roleLabel || !!displayName
    const showReserve = rawRole === "student" || rawRole === "other" || rawRole === "faculty"

    const borrowableBooks = React.useMemo(
        () => books.filter((b) => b.available && !b.isLibraryUseOnly && b.canBorrow !== false),
        [books]
    )

    const libraryUseOnlyBooks = React.useMemo(
        () => books.filter((b) => b.isLibraryUseOnly || b.canBorrow === false),
        [books]
    )

    const hasBookChoices = books.length > 0

    const selectedBook = React.useMemo(() => {
        if (!selectedBookId) return null
        return books.find((b) => b.id === selectedBookId) ?? null
    }, [books, selectedBookId])

    const selectedBookIsLibraryUseOnly = React.useMemo(() => {
        return !!selectedBook && (selectedBook.isLibraryUseOnly || selectedBook.canBorrow === false)
    }, [selectedBook])

    const selectedBookIsBorrowable = React.useMemo(() => {
        return !!selectedBook && selectedBook.available && !selectedBookIsLibraryUseOnly
    }, [selectedBook, selectedBookIsLibraryUseOnly])

    const selectedBookAvailableCopies = React.useMemo(() => {
        if (!selectedBook) return 0
        const n = selectedBook.numberOfCopies
        if (typeof n === "number" && n >= 0) return n
        return selectedBook.available ? 1 : 0
    }, [selectedBook])

    const selectedBookTotalCopies = React.useMemo(() => {
        if (!selectedBook) return 0
        const total = selectedBook.totalCopies
        if (typeof total === "number" && total >= 0) return total
        const remaining = selectedBook.numberOfCopies
        if (typeof remaining === "number" && remaining >= 0) return remaining
        return 0
    }, [selectedBook])

    const selectedBookActiveBorrowCount = React.useMemo(() => {
        if (!selectedBook) return 0
        const active = selectedBook.activeBorrowCount
        if (typeof active === "number" && active >= 0) return active
        const borrowed = selectedBook.borrowedCopies
        if (typeof borrowed === "number" && borrowed >= 0) return borrowed
        return 0
    }, [selectedBook])

    const selectedBookTotalBorrowCount = React.useMemo(() => {
        if (!selectedBook) return 0
        const total = selectedBook.totalBorrowCount
        return typeof total === "number" && total >= 0 ? total : 0
    }, [selectedBook])

    const maxReserveCopies = React.useMemo(() => {
        if (!selectedBook || !selectedBookIsBorrowable) return 1
        const n = selectedBook.numberOfCopies
        return typeof n === "number" && n > 0 ? n : 1
    }, [selectedBook, selectedBookIsBorrowable])

    const reserveQty = clampInt(reserveCopies, 1, maxReserveCopies)
    const reserveActorRole = rawRole === "faculty" ? "faculty" : rawRole === "other" ? "other" : "student"

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

        if (chosen.isLibraryUseOnly || chosen.canBorrow === false) {
            toast.info("Library use only", {
                description: `"${chosen.title}" is marked as Library use only and cannot be reserved or borrowed.`,
            })
            return
        }

        if (!chosen.available) {
            toast.info("Book is not available right now.", {
                description: "You can only reserve books marked as Available.",
            })
            return
        }

        const maxCopies =
            typeof chosen.numberOfCopies === "number" && chosen.numberOfCopies > 0
                ? chosen.numberOfCopies
                : 1

        const requestedCopies = clampInt(reserveCopies, 1, maxCopies)

        setReserveSubmitting(true)
        try {
            const created: any[] = []

            // Borrow/reserve copies one-by-one (works even if API only supports 1 per call)
            for (let i = 0; i < requestedCopies; i++) {
                try {
                    const record = await createSelfBorrow(selectedBookId, 1, reserveActorRole)
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
            const reserveUntil = formatBorrowReservationExpiry(created[0])
            const reserveWindowText = reserveUntil
                ? ` Pickup must be confirmed before ${reserveUntil}.`
                : " Pickup must be confirmed within 24 hours."

            if (created.length === requestedCopies) {
                toast.success("Reserve submitted", {
                    description: `${created.length} cop${created.length === 1 ? "y" : "ies"} of "${chosen.title}" has been reserved for pickup. Due on ${due}.${reserveWindowText}`,
                })
            } else {
                toast.warning("Reserve partially submitted", {
                    description: `${created.length} cop${created.length === 1 ? "y" : "ies"} of "${chosen.title}" has been reserved for pickup. Due on ${due}.${reserveWindowText}`,
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
                                    className="inline-flex shrink-0 border-white/20 px-2 text-xs text-white/90 hover:bg-white/10 sm:px-3 md:text-sm"
                                >
                                    <Plus className="h-4 w-4 shrink-0 sm:mr-1.5" />
                                    <span className="ml-1 sm:ml-0">Reserve</span>
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden border-white/10 bg-slate-900 p-0 text-white sm:max-w-lg md:max-w-xl">
                                <DialogHeaderUI className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6">
                                    <DialogTitle className="pr-8 text-sm md:text-base">Quick reserve</DialogTitle>
                                    <DialogDescription className="text-xs text-white/70 md:text-sm">
                                        Choose a book to reserve/borrow. Borrowable books are listed first, while{" "}
                                        <span className="font-semibold text-amber-300">Library use only</span> books are
                                        shown in a separate section for reference.
                                    </DialogDescription>
                                </DialogHeaderUI>

                                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm sm:px-6">
                                    {reserveLoading ? (
                                        <p className="text-xs text-white/60">Loading books…</p>
                                    ) : !hasBookChoices ? (
                                        <p className="text-xs text-white/60">
                                            There are currently no books in the catalog to show here. Try again later or
                                            browse the catalog.
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
                                                    <SelectContent className="max-h-64 w-[calc(100vw-2rem)] max-w-md border-white/10 bg-slate-900 text-white sm:max-h-72 sm:w-(--radix-select-trigger-width)">
                                                        {borrowableBooks.length > 0 && (
                                                            <SelectItem
                                                                value="__borrowable_header"
                                                                disabled
                                                                className="opacity-100 text-[11px] font-semibold uppercase tracking-wide text-emerald-300"
                                                            >
                                                                Available to borrow
                                                            </SelectItem>
                                                        )}
                                                        {borrowableBooks.map((b) => (
                                                            <SelectItem key={b.id} value={b.id}>
                                                                {b.title} — {b.author}
                                                            </SelectItem>
                                                        ))}

                                                        {libraryUseOnlyBooks.length > 0 && (
                                                            <SelectItem
                                                                value="__library_use_only_header"
                                                                disabled
                                                                className="opacity-100 text-[11px] font-semibold uppercase tracking-wide text-amber-300"
                                                            >
                                                                Library use only
                                                            </SelectItem>
                                                        )}
                                                        {libraryUseOnlyBooks.map((b) => (
                                                            <SelectItem key={b.id} value={b.id}>
                                                                {b.title} — {b.author} • Library use only
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                <p className="text-[11px] text-white/50">
                                                    Borrowable books appear first. Books tagged{" "}
                                                    <span className="font-semibold text-amber-300">Library use only</span>{" "}
                                                    stay in the choices but cannot be reserved here.
                                                </p>
                                            </div>

                                            {selectedBook && (
                                                <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/40 p-3">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-white">
                                                                {selectedBook.title}
                                                            </p>
                                                            <p className="truncate text-xs text-white/60">
                                                                {selectedBook.author}
                                                            </p>
                                                        </div>

                                                        <span
                                                            className={[
                                                                "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                                                                selectedBookIsLibraryUseOnly
                                                                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                                                                    : selectedBook.available
                                                                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                                                                        : "bg-red-500/15 text-red-300 border border-red-500/20",
                                                            ].join(" ")}
                                                        >
                                                            {selectedBookIsLibraryUseOnly
                                                                ? "Library use only"
                                                                : selectedBook.available
                                                                    ? "Available"
                                                                    : "Unavailable"}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2 text-xs min-[360px]:grid-cols-2 md:grid-cols-4">
                                                        <div className="rounded-md border border-white/10 bg-slate-900/70 p-2">
                                                            <div className="text-white/50">Available copies</div>
                                                            <div className="mt-1 font-semibold text-white">
                                                                {selectedBookAvailableCopies}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-md border border-white/10 bg-slate-900/70 p-2">
                                                            <div className="text-white/50">Total copies</div>
                                                            <div className="mt-1 font-semibold text-white">
                                                                {selectedBookTotalCopies}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-md border border-white/10 bg-slate-900/70 p-2">
                                                            <div className="text-white/50">Currently borrowed</div>
                                                            <div className="mt-1 font-semibold text-white">
                                                                {selectedBookActiveBorrowCount}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-md border border-white/10 bg-slate-900/70 p-2">
                                                            <div className="text-white/50">Times borrowed</div>
                                                            <div className="mt-1 font-semibold text-white">
                                                                {selectedBookTotalBorrowCount}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {selectedBook.borrowDurationDays ? (
                                                        <p className="text-[11px] text-white/60">
                                                            Default borrow duration:{" "}
                                                            <span className="font-medium text-white">
                                                                {selectedBook.borrowDurationDays} day
                                                                {selectedBook.borrowDurationDays === 1 ? "" : "s"}
                                                            </span>
                                                        </p>
                                                    ) : null}

                                                    {selectedBookIsLibraryUseOnly && (
                                                        <p className="text-[11px] text-amber-300">
                                                            This book is for in-library use only. It appears in the list,
                                                            but reserve/borrow is disabled.
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="pt-1">
                                                <div className="mb-1 text-xs font-medium text-white/80">
                                                    Copies to borrow
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
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
                                                            !selectedBookIsBorrowable ||
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
                                                        className="h-9 w-16 bg-slate-900/70 text-center text-white border-white/20"
                                                        aria-label="Copies to borrow"
                                                        disabled={
                                                            reserveSubmitting ||
                                                            reserveLoading ||
                                                            !selectedBookId ||
                                                            !selectedBookIsBorrowable
                                                        }
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
                                                            !selectedBookIsBorrowable ||
                                                            reserveQty >= maxReserveCopies
                                                        }
                                                        aria-label="Increase copies"
                                                    >
                                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                                    </Button>

                                                    <span className="text-xs text-white/60">
                                                        Max {selectedBookIsBorrowable ? maxReserveCopies : 0}
                                                    </span>
                                                </div>

                                                {selectedBookIsBorrowable ? (
                                                    <p className="mt-1 text-[11px] text-white/60">
                                                        Total physical copies in the library: {selectedBookTotalCopies}.
                                                    </p>
                                                ) : selectedBook ? (
                                                    <p className="mt-1 text-[11px] text-amber-300">
                                                        Copy quantity is disabled because this title cannot be borrowed from
                                                        the quick reserve dialog.
                                                    </p>
                                                ) : (
                                                    <p className="mt-1 text-[11px] text-white/60">
                                                        Select a book first to choose how many copies to borrow.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-white/10 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full border-white/20 text-white hover:bg-black/20 sm:w-auto"
                                        onClick={() => handleReserveOpenChange(false)}
                                        disabled={reserveSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        className="w-full bg-purple-600 text-white hover:bg-purple-700 sm:w-auto"
                                        onClick={() => void handleReserveConfirm()}
                                        disabled={
                                            reserveSubmitting ||
                                            reserveLoading ||
                                            !selectedBookId ||
                                            !selectedBookIsBorrowable
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
                                    <AvatarImage src={avatarSrc} alt={headerName} className="object-cover object-center" />
                                    <AvatarFallback>
                                        {user === undefined ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : initials}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align="end"
                            className="w-[230px] bg-slate-900 text-white border-white/10"
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