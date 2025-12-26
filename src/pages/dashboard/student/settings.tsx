/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import DashboardLayout from "@/components/dashboard-layout"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { toast } from "sonner"
import { me as apiMe } from "@/lib/authentication"
import * as auth from "@/lib/authentication"

import { Loader2, Eye, EyeOff, KeyRound, UserRound } from "lucide-react"

type Role = "student" | "other" | "faculty" | "librarian" | "admin"

function fmtValue(v: unknown) {
    if (v === null || v === undefined) return "—"
    const s = String(v).trim()
    return s ? s : "—"
}

function roleLabel(raw: string | undefined) {
    const map: Record<string, string> = {
        student: "Student",
        other: "Guest",
        librarian: "Librarian",
        faculty: "Faculty",
        admin: "Admin",
    }
    if (!raw) return "—"
    return map[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
}

async function tryChangePassword(currentPassword: string, newPassword: string) {
    // Prefer an exported helper if your lib has it (safe, no TS errors)
    const anyAuth = auth as any

    if (typeof anyAuth.changePassword === "function") {
        return await anyAuth.changePassword(currentPassword, newPassword)
    }
    if (typeof anyAuth.updatePassword === "function") {
        return await anyAuth.updatePassword(currentPassword, newPassword)
    }

    // Fallback to common endpoints (first one that works wins)
    const endpoints = [
        "/api/auth/change-password",
        "/api/auth/changePassword",
        "/api/auth/password/change",
        "/api/users/me/password",
    ]

    let lastErr: string | null = null

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            })

            if (res.status === 404 || res.status === 405) {
                lastErr = `Endpoint not found: ${url}`
                continue
            }

            const text = await res.text()
            let data: any = null
            try {
                data = text ? JSON.parse(text) : null
            } catch {
                data = null
            }

            if (!res.ok) {
                const msg =
                    data?.message ||
                    data?.error ||
                    text ||
                    "Failed to change password. Please try again."
                throw new Error(msg)
            }

            return data ?? { ok: true }
        } catch (e: any) {
            lastErr = String(e?.message || e)
            // keep trying other endpoints if it *looks* like routing mismatch
            if (/endpoint not found/i.test(lastErr)) continue
            // otherwise fail fast
            throw e
        }
    }

    throw new Error(
        lastErr ||
        "Password change endpoint is not available. Please add an API endpoint or export changePassword() in lib/authentication."
    )
}

export default function StudentSettingsPage() {
    const [user, setUser] = React.useState<any | null | undefined>(undefined)

    const [pwCurrent, setPwCurrent] = React.useState("")
    const [pwNext, setPwNext] = React.useState("")
    const [pwConfirm, setPwConfirm] = React.useState("")
    const [pwBusy, setPwBusy] = React.useState(false)

    const [showCurrent, setShowCurrent] = React.useState(false)
    const [showNext, setShowNext] = React.useState(false)
    const [showConfirm, setShowConfirm] = React.useState(false)

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

    const rawRole: Role | undefined =
        (user?.accountType as Role | undefined) ??
        (user?.role as Role | undefined) ??
        undefined

    const isStudent = rawRole === "student"
    const isGuest = rawRole === "other"

    const fullName =
        user?.fullName ||
        user?.name ||
        user?.full_name ||
        user?.student_name ||
        "—"

    const email = user?.email || "—"

    // Student-only fields (only show if role needs it AND there is a value)
    const studentId =
        user?.studentId || user?.student_id || user?.studentID || user?.idNumber || null
    const program =
        user?.course || user?.program || user?.courseName || user?.department || null
    const yearLevel =
        user?.yearLevel || user?.year_level || user?.year || user?.level || null
    const college =
        user?.college || user?.school || user?.collegeName || null

    async function onSubmitPassword(e: React.FormEvent) {
        e.preventDefault()

        if (!pwCurrent.trim()) {
            toast.warning("Current password required", {
                description: "Please enter your current password.",
            })
            return
        }
        if (pwNext.length < 8) {
            toast.warning("Password too short", {
                description: "New password must be at least 8 characters.",
            })
            return
        }
        if (pwNext !== pwConfirm) {
            toast.warning("Passwords do not match", {
                description: "Please confirm your new password correctly.",
            })
            return
        }

        setPwBusy(true)
        try {
            await tryChangePassword(pwCurrent, pwNext)

            toast.success("Password updated", {
                description: "Your password has been changed successfully.",
            })

            setPwCurrent("")
            setPwNext("")
            setPwConfirm("")
            setShowCurrent(false)
            setShowNext(false)
            setShowConfirm(false)
        } catch (err: any) {
            const msg = String(err?.message || "Failed to change password.")
            toast.error("Password change failed", { description: msg })
        } finally {
            setPwBusy(false)
        }
    }

    return (
        <DashboardLayout title="Settings">
            <div className="space-y-4">
                {/* Personal Info */}
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="inline-flex items-center gap-2">
                            <UserRound className="h-5 w-5" />
                            Personal information
                        </CardTitle>
                        <p className="text-xs text-white/70">
                            This information is based on your registration details.
                            {isGuest ? " (Guest accounts have fewer required fields.)" : ""}
                        </p>
                    </CardHeader>

                    <CardContent className="pt-2">
                        {user === undefined ? (
                            <div className="flex items-center gap-2 text-sm text-white/70">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading your profile…
                            </div>
                        ) : user === null ? (
                            <div className="text-sm text-red-300">
                                Could not load your profile. Please refresh the page.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                    <div className="text-xs text-white/60">Full name</div>
                                    <div className="mt-0.5 font-medium">{fmtValue(fullName)}</div>
                                </div>

                                <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                    <div className="text-xs text-white/60">Email</div>
                                    <div className="mt-0.5 font-medium">{fmtValue(email)}</div>
                                </div>

                                <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                    <div className="text-xs text-white/60">Account type</div>
                                    <div className="mt-0.5 font-medium">{roleLabel(rawRole)}</div>
                                </div>

                                {/* Student-only: show only if role needs it */}
                                {isStudent && (
                                    <>
                                        <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                            <div className="text-xs text-white/60">Student ID</div>
                                            <div className="mt-0.5 font-medium">{fmtValue(studentId)}</div>
                                        </div>

                                        <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                            <div className="text-xs text-white/60">Program / Course</div>
                                            <div className="mt-0.5 font-medium">{fmtValue(program)}</div>
                                        </div>

                                        <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                            <div className="text-xs text-white/60">Year level</div>
                                            <div className="mt-0.5 font-medium">{fmtValue(yearLevel)}</div>
                                        </div>

                                        {/* College is optional; still student-only if it exists */}
                                        {college ? (
                                            <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                                <div className="text-xs text-white/60">College</div>
                                                <div className="mt-0.5 font-medium">{fmtValue(college)}</div>
                                            </div>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Change Password */}
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="inline-flex items-center gap-2">
                            <KeyRound className="h-5 w-5" />
                            Change password
                        </CardTitle>
                        <p className="text-xs text-white/70">
                            For security, you must enter your current password.
                        </p>
                    </CardHeader>

                    <CardContent className="pt-2">
                        <form onSubmit={onSubmitPassword} className="space-y-3 max-w-xl">
                            {/* Current */}
                            <div className="space-y-1">
                                <Label className="text-xs text-white/80">Current password</Label>
                                <div className="relative">
                                    <Input
                                        type={showCurrent ? "text" : "password"}
                                        value={pwCurrent}
                                        onChange={(e) => setPwCurrent(e.target.value)}
                                        className="bg-slate-900/70 border-white/20 text-white pr-10"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrent((s) => !s)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                                        aria-label={showCurrent ? "Hide password" : "Show password"}
                                    >
                                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* New */}
                            <div className="space-y-1">
                                <Label className="text-xs text-white/80">New password</Label>
                                <div className="relative">
                                    <Input
                                        type={showNext ? "text" : "password"}
                                        value={pwNext}
                                        onChange={(e) => setPwNext(e.target.value)}
                                        className="bg-slate-900/70 border-white/20 text-white pr-10"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNext((s) => !s)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                                        aria-label={showNext ? "Hide password" : "Show password"}
                                    >
                                        {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-[11px] text-white/50">Minimum 8 characters.</p>
                            </div>

                            {/* Confirm */}
                            <div className="space-y-1">
                                <Label className="text-xs text-white/80">Confirm new password</Label>
                                <div className="relative">
                                    <Input
                                        type={showConfirm ? "text" : "password"}
                                        value={pwConfirm}
                                        onChange={(e) => setPwConfirm(e.target.value)}
                                        className="bg-slate-900/70 border-white/20 text-white pr-10"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm((s) => !s)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                                        aria-label={showConfirm ? "Hide password" : "Show password"}
                                    >
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>

                                {pwConfirm.length > 0 && pwNext !== pwConfirm ? (
                                    <p className="text-[11px] text-red-300">Passwords do not match.</p>
                                ) : null}
                            </div>

                            <div className="pt-1">
                                <Button
                                    type="submit"
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    disabled={pwBusy}
                                >
                                    {pwBusy ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Updating…
                                        </span>
                                    ) : (
                                        "Update password"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
