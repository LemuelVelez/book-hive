/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import DashboardLayout from "@/components/dashboard-layout"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
import { me as apiMe } from "@/lib/authentication"
import * as auth from "@/lib/authentication"

import {
    Loader2,
    Eye,
    EyeOff,
    KeyRound,
    UserRound,
    ImagePlus,
    Trash2,
    Save,
    X,
} from "lucide-react"

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

function initialsFromName(name: string) {
    const s = String(name || "").trim()
    if (!s) return "U"
    const parts = s.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? "U"
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
    return (a + b).toUpperCase()
}

function isValidEmail(email: string) {
    // simple, practical validation
    const s = String(email || "").trim()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function extractVerifyToken(input: string) {
    const s = String(input || "").trim()
    if (!s) return null

    // If user pasted a full URL
    try {
        const u = new URL(s)
        const t = u.searchParams.get("token")
        if (t) return t.trim()
    } catch {
        // ignore
    }

    // If user pasted something containing token=...
    const m = s.match(/[?&]token=([a-f0-9]{16,})/i)
    if (m?.[1]) return m[1].trim()

    // If user pasted raw token
    if (/^[a-f0-9]{32,}$/i.test(s)) return s

    return null
}

async function tryChangePassword(currentPassword: string, newPassword: string) {
    const anyAuth = auth as any

    if (typeof anyAuth.changePassword === "function") {
        return await anyAuth.changePassword(currentPassword, newPassword)
    }
    if (typeof anyAuth.updatePassword === "function") {
        return await anyAuth.updatePassword(currentPassword, newPassword)
    }

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
            if (/endpoint not found/i.test(lastErr)) continue
            throw e
        }
    }

    throw new Error(
        lastErr ||
        "Password change endpoint is not available. Please add an API endpoint or export changePassword() in lib/authentication."
    )
}

async function tryUpdateProfile(payload: {
    fullName?: string
    email?: string
    course?: string
    yearLevel?: string
}) {
    const anyAuth = auth as any
    if (typeof anyAuth.updateMyProfile === "function") {
        return await anyAuth.updateMyProfile(payload)
    }

    const res = await fetch("/api/users/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })

    const text = await res.text()
    let data: any = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        data = null
    }

    if (!res.ok) throw new Error(data?.message || text || "Failed to update profile.")
    return data
}

async function tryUploadAvatar(file: File) {
    const anyAuth = auth as any
    if (typeof anyAuth.uploadMyAvatar === "function") {
        return await anyAuth.uploadMyAvatar(file)
    }

    const fd = new FormData()
    fd.append("avatar", file)

    const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        credentials: "include",
        body: fd,
    })

    const text = await res.text()
    let data: any = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        data = null
    }

    if (!res.ok) throw new Error(data?.message || text || "Failed to upload avatar.")
    return data
}

async function tryRemoveAvatar() {
    const anyAuth = auth as any
    if (typeof anyAuth.removeMyAvatar === "function") {
        return await anyAuth.removeMyAvatar()
    }

    const res = await fetch("/api/users/me/avatar", {
        method: "DELETE",
        credentials: "include",
    })

    const text = await res.text()
    let data: any = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        data = null
    }

    if (!res.ok) throw new Error(data?.message || text || "Failed to remove avatar.")
    return data
}

async function tryResendVerifyEmail(email: string) {
    const anyAuth = auth as any

    if (typeof anyAuth.resendVerifyEmail === "function") {
        return await anyAuth.resendVerifyEmail(email)
    }
    if (typeof anyAuth.resendVerificationEmail === "function") {
        return await anyAuth.resendVerificationEmail(email)
    }

    // best-effort fallback endpoints (won't break if missing)
    const endpoints = [
        "/api/auth/resend-verify-email",
        "/api/auth/resendVerifyEmail",
        "/api/auth/verify-email/resend",
        "/api/auth/verify-email",
    ]

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            if (res.status === 404 || res.status === 405) continue
            if (!res.ok) continue
            return { ok: true }
        } catch {
            // ignore and try next
            continue
        }
    }

    return { ok: false }
}

async function tryConfirmVerifyEmail(token: string) {
    const anyAuth = auth as any

    // ✅ preferred: lib/authentication.ts
    if (typeof anyAuth.confirmVerifyEmail === "function") {
        return await anyAuth.confirmVerifyEmail(token)
    }

    // best-effort fallback
    const endpoints = [
        "/api/auth/verify-email/confirm",
        "/api/auth/verifyEmail/confirm",
    ]

    let lastErr: string | null = null

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
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
                const msg = data?.message || data?.error || text || "Failed to verify email."
                throw new Error(msg)
            }

            return data ?? { ok: true }
        } catch (e: any) {
            lastErr = String(e?.message || e)
            if (/endpoint not found/i.test(lastErr)) continue
            throw e
        }
    }

    throw new Error(lastErr || "Verify confirm endpoint is not available.")
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

    // profile edit
    const [editing, setEditing] = React.useState(false)
    const [profileBusy, setProfileBusy] = React.useState(false)

    const [fullNameInput, setFullNameInput] = React.useState("")
    const [emailInput, setEmailInput] = React.useState("")
    const [courseInput, setCourseInput] = React.useState("")
    const [yearLevelInput, setYearLevelInput] = React.useState("")

    // avatar upload
    const fileRef = React.useRef<HTMLInputElement | null>(null)
    const [avatarBusy, setAvatarBusy] = React.useState(false)
    const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)

    // alert dialog state for remove
    const [removeConfirmOpen, setRemoveConfirmOpen] = React.useState(false)

    // ✅ email verification UI state
    const [resendBusy, setResendBusy] = React.useState(false)
    const [resendCooldown, setResendCooldown] = React.useState(0)
    const [verifyDialogOpen, setVerifyDialogOpen] = React.useState(false)
    const [verifyTokenInput, setVerifyTokenInput] = React.useState("")
    const [verifyBusy, setVerifyBusy] = React.useState(false)
    const [refreshBusy, setRefreshBusy] = React.useState(false)

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
        if (resendCooldown <= 0) return
        const t = window.setInterval(() => {
            setResendCooldown((c) => Math.max(0, c - 1))
        }, 1000)
        return () => window.clearInterval(t)
    }, [resendCooldown])

    const rawRole: Role | undefined =
        (user?.accountType as Role | undefined) ??
        (user?.role as Role | undefined) ??
        undefined

    const isStudent = rawRole === "student"
    const isGuest = rawRole === "other"

    const fullName =
        user?.fullName || user?.name || user?.full_name || user?.student_name || "—"

    const email = user?.email || "—"

    const isEmailVerified = Boolean(
        user?.isEmailVerified ??
        user?.is_email_verified ??
        user?.emailVerified ??
        user?.email_verified ??
        false
    )

    const studentId =
        user?.studentId ||
        user?.student_id ||
        user?.studentID ||
        user?.idNumber ||
        null

    const program =
        user?.course || user?.program || user?.courseName || user?.department || null

    const yearLevel =
        user?.yearLevel || user?.year_level || user?.year || user?.level || null

    const college = user?.college || user?.school || user?.collegeName || null

    const avatarUrl = avatarPreview || user?.avatarUrl || user?.avatar_url || null

    // populate inputs from user (avoid overriding while editing)
    React.useEffect(() => {
        if (!user) return
        if (editing) return

        const uFullName =
            user?.fullName || user?.name || user?.full_name || user?.student_name || ""

        setFullNameInput(String(uFullName || ""))
        setEmailInput(String(user?.email || ""))
        setCourseInput(
            String(user?.course || user?.program || user?.courseName || user?.department || "")
        )
        setYearLevelInput(
            String(user?.yearLevel || user?.year_level || user?.year || user?.level || "")
        )
    }, [user, editing])

    // cleanup avatar preview
    React.useEffect(() => {
        if (!avatarPreview) return
        return () => {
            URL.revokeObjectURL(avatarPreview)
        }
    }, [avatarPreview])

    const oldEmailTrim = String(email === "—" ? "" : email || "").trim()
    const newEmailTrim = String(emailInput || "").trim()
    const emailChanged =
        !!oldEmailTrim && !!newEmailTrim && oldEmailTrim.toLowerCase() !== newEmailTrim.toLowerCase()

    const profileDirty =
        String(fullNameInput || "").trim() !==
        String(fullName === "—" ? "" : fullName || "").trim() ||
        String(emailInput || "").trim() !== oldEmailTrim ||
        (isStudent && String(courseInput || "").trim() !== String(program || "").trim()) ||
        (isStudent && String(yearLevelInput || "").trim() !== String(yearLevel || "").trim())

    function resetProfileForm() {
        setFullNameInput(String(fullName === "—" ? "" : fullName || ""))
        setEmailInput(String(oldEmailTrim || ""))
        setCourseInput(String(program || ""))
        setYearLevelInput(String(yearLevel || ""))
        setEditing(false)

        if (avatarPreview) URL.revokeObjectURL(avatarPreview)
        setAvatarPreview(null)
        setAvatarFile(null)
        setRemoveConfirmOpen(false)

        setVerifyDialogOpen(false)
        setVerifyTokenInput("")
    }

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

    async function onSaveProfile() {
        const name = String(fullNameInput || "").trim()
        const nextEmail = String(emailInput || "").trim()

        if (!name) {
            toast.warning("Full name required", { description: "Please enter your full name." })
            return
        }
        if (!nextEmail) {
            toast.warning("Email required", { description: "Please enter your email." })
            return
        }
        if (!isValidEmail(nextEmail)) {
            toast.warning("Invalid email", { description: "Please enter a valid email address." })
            return
        }

        if (isStudent) {
            if (!String(courseInput || "").trim()) {
                toast.warning("Program / Course required", {
                    description: "Please enter your program/course.",
                })
                return
            }
            if (!String(yearLevelInput || "").trim()) {
                toast.warning("Year level required", {
                    description: "Please enter your year level.",
                })
                return
            }
        }

        setProfileBusy(true)
        try {
            const payload: any = { fullName: name, email: nextEmail }
            if (isStudent) {
                payload.course = String(courseInput || "").trim()
                payload.yearLevel = String(yearLevelInput || "").trim()
            }

            const r = await tryUpdateProfile(payload)
            const updatedUser = r?.user ?? null
            if (!updatedUser) throw new Error("Invalid response from server.")

            setUser(updatedUser)
            setEditing(false)

            if (emailChanged) {
                // ✅ FIX: Don't resend here — backend already sends on email change
                toast.success("Profile updated", {
                    description:
                        "Your email was changed and marked as unverified. A verification email should be sent to your new address. You can resend/verify from this Settings page.",
                })
            } else {
                toast.success("Profile updated", {
                    description: "Your personal information has been saved.",
                })
            }
        } catch (err: any) {
            toast.error("Update failed", {
                description: String(err?.message || err || "Failed to update profile."),
            })
        } finally {
            setProfileBusy(false)
        }
    }

    async function onResendVerification() {
        const targetEmail = String(user?.email || "").trim()
        if (!targetEmail || !isValidEmail(targetEmail)) {
            toast.warning("Valid email required", {
                description: "Please make sure your email is saved and valid before sending verification.",
            })
            return
        }
        if (resendCooldown > 0) return

        setResendBusy(true)
        try {
            const r = await tryResendVerifyEmail(targetEmail)
            if (r?.ok === false) {
                throw new Error("Resend endpoint is not available.")
            }

            toast.success("Verification email sent", {
                description: `We sent a verification email to ${targetEmail}.`,
            })
            setResendCooldown(60)
        } catch (err: any) {
            toast.error("Failed to send verification", {
                description: String(err?.message || err || "Could not send verification email."),
            })
        } finally {
            setResendBusy(false)
        }
    }

    async function onVerifyWithToken() {
        const token = extractVerifyToken(verifyTokenInput)
        if (!token) {
            toast.warning("Token required", {
                description: "Paste the verification link or token from your email.",
            })
            return
        }

        setVerifyBusy(true)
        try {
            await tryConfirmVerifyEmail(token)

            toast.success("Email verified", {
                description: "Your email has been verified successfully.",
            })

            setVerifyDialogOpen(false)
            setVerifyTokenInput("")

            // refresh /me to reflect isEmailVerified=true
            const u = await apiMe()
            setUser(u)
        } catch (err: any) {
            toast.error("Verification failed", {
                description: String(err?.message || err || "Could not verify email."),
            })
        } finally {
            setVerifyBusy(false)
        }
    }

    async function onRefreshVerificationStatus() {
        setRefreshBusy(true)
        try {
            const u = await apiMe()
            setUser(u)
            toast.success("Status refreshed", { description: "Your email verification status was refreshed." })
        } catch {
            toast.error("Refresh failed", { description: "Could not refresh your profile. Please try again." })
        } finally {
            setRefreshBusy(false)
        }
    }

    function pickAvatar() {
        fileRef.current?.click()
    }

    function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] || null
        if (!file) return

        if (!file.type.startsWith("image/")) {
            toast.error("Invalid file", { description: "Please select an image file." })
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File too large", { description: "Max avatar size is 5MB." })
            return
        }

        if (avatarPreview) URL.revokeObjectURL(avatarPreview)
        const url = URL.createObjectURL(file)
        setAvatarPreview(url)
        setAvatarFile(file)
    }

    async function onUploadAvatar() {
        if (!avatarFile) {
            toast.warning("No image selected", { description: "Choose an image first." })
            return
        }

        setAvatarBusy(true)
        try {
            const r = await tryUploadAvatar(avatarFile)
            const updatedUser = r?.user ?? null
            if (!updatedUser) throw new Error("Invalid response from server.")

            setUser(updatedUser)

            if (avatarPreview) URL.revokeObjectURL(avatarPreview)
            setAvatarPreview(null)
            setAvatarFile(null)

            toast.success("Display picture updated", {
                description: "Your avatar has been uploaded successfully.",
            })
        } catch (err: any) {
            toast.error("Upload failed", {
                description: String(err?.message || err || "Failed to upload avatar."),
            })
        } finally {
            setAvatarBusy(false)
        }
    }

    async function onRemoveAvatarConfirmed() {
        setAvatarBusy(true)
        try {
            const r = await tryRemoveAvatar()
            const updatedUser = r?.user ?? null
            if (!updatedUser) throw new Error("Invalid response from server.")

            setUser(updatedUser)

            if (avatarPreview) URL.revokeObjectURL(avatarPreview)
            setAvatarPreview(null)
            setAvatarFile(null)

            toast.success("Avatar removed", {
                description: "Your display picture has been removed.",
            })
            setRemoveConfirmOpen(false)
        } catch (err: any) {
            toast.error("Remove failed", {
                description: String(err?.message || err || "Failed to remove avatar."),
            })
        } finally {
            setAvatarBusy(false)
        }
    }

    const hasAvatar = !!(user?.avatarUrl || user?.avatar_url)

    return (
        <DashboardLayout title="Settings">
            <div className="space-y-4">
                {/* Personal Info */}
                <Card className="bg-slate-800/60 border-white/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle className="inline-flex items-center gap-2">
                                    <UserRound className="h-5 w-5" />
                                    Personal information
                                </CardTitle>
                                <p className="text-xs text-white/70">
                                    Update your profile details and display picture.
                                    {isGuest ? " (Guest accounts have fewer required fields.)" : ""}
                                </p>
                            </div>

                            {user && (
                                <div className="flex items-center gap-2">
                                    {!editing ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="bg-slate-900/60 border border-white/10 text-white hover:bg-slate-900/80"
                                            onClick={() => setEditing(true)}
                                        >
                                            Edit
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="bg-slate-900/60 border border-white/10 text-white hover:bg-slate-900/80"
                                            onClick={resetProfileForm}
                                            disabled={profileBusy}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <X className="h-4 w-4" />
                                                Cancel
                                            </span>
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
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
                            <div className="space-y-4">
                                {/* Avatar row */}
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-full overflow-hidden border border-white/10 bg-slate-900/40 flex items-center justify-center">
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt="Avatar"
                                                className="h-full w-full object-cover object-center"
                                            />
                                        ) : (
                                            <div className="text-white/80 font-semibold">
                                                {initialsFromName(String(fullName))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="text-sm text-white/80 font-medium">Display picture</div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Input
                                                ref={fileRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={onAvatarSelected}
                                                disabled={avatarBusy}
                                            />

                                            <Button
                                                type="button"
                                                className="bg-slate-900/60 border border-white/10 text-white hover:bg-slate-900/80"
                                                onClick={pickAvatar}
                                                disabled={avatarBusy}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <ImagePlus className="h-4 w-4" />
                                                    Choose image
                                                </span>
                                            </Button>

                                            <Button
                                                type="button"
                                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                                onClick={onUploadAvatar}
                                                disabled={avatarBusy || !avatarFile}
                                            >
                                                {avatarBusy ? (
                                                    <span className="inline-flex items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Uploading…
                                                    </span>
                                                ) : (
                                                    "Upload"
                                                )}
                                            </Button>

                                            <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    className="bg-red-600 hover:bg-red-700 text-white"
                                                    onClick={() => setRemoveConfirmOpen(true)}
                                                    disabled={avatarBusy || !hasAvatar}
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <Trash2 className="h-4 w-4" />
                                                        Remove
                                                    </span>
                                                </Button>

                                                <AlertDialogContent className="bg-slate-900 text-white border-white/10">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Remove display picture?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-white/70">
                                                            This will delete your current display picture. You can upload a new one
                                                            anytime.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel
                                                            disabled={avatarBusy}
                                                            className="bg-slate-800 border-white/10 text-white hover:bg-slate-800/80"
                                                        >
                                                            Cancel
                                                        </AlertDialogCancel>
                                                        <AlertDialogAction
                                                            disabled={avatarBusy}
                                                            onClick={() => void onRemoveAvatarConfirmed()}
                                                            className="bg-red-600 hover:bg-red-600/90 text-white focus:ring-red-500"
                                                        >
                                                            {avatarBusy ? (
                                                                <span className="inline-flex items-center gap-2">
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                    Removing…
                                                                </span>
                                                            ) : (
                                                                "Remove"
                                                            )}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>

                                        <div className="text-[11px] text-white/50">PNG/JPG/WebP • Max 5MB</div>
                                    </div>
                                </div>

                                {/* Info grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                        <div className="text-xs text-white/60">Full name</div>
                                        {!editing ? (
                                            <div className="mt-0.5 font-medium">{fmtValue(fullName)}</div>
                                        ) : (
                                            <div className="mt-2 space-y-1">
                                                <Label className="text-xs text-white/80">Full name</Label>
                                                <Input
                                                    value={fullNameInput}
                                                    onChange={(e) => setFullNameInput(e.target.value)}
                                                    className="bg-slate-900/70 border-white/20 text-white"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-xs text-white/60">Email</div>
                                            <span
                                                className={[
                                                    "text-[11px] px-2 py-0.5 rounded border",
                                                    isEmailVerified
                                                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                                        : "bg-amber-500/10 text-amber-300 border-amber-500/20",
                                                ].join(" ")}
                                            >
                                                {isEmailVerified ? "Verified" : "Unverified"}
                                            </span>
                                        </div>

                                        {!editing ? (
                                            <div className="mt-0.5 font-medium">{fmtValue(email)}</div>
                                        ) : (
                                            <div className="mt-2 space-y-1">
                                                <Label className="text-xs text-white/80">Email</Label>
                                                <Input
                                                    value={emailInput}
                                                    onChange={(e) => setEmailInput(e.target.value)}
                                                    className="bg-slate-900/70 border-white/20 text-white"
                                                    type="email"
                                                    autoComplete="email"
                                                />
                                                <p className="text-[11px] text-white/50">
                                                    Changing your email will mark it as{" "}
                                                    <span className="font-semibold text-amber-300">unverified</span>. After saving,
                                                    you can resend/verify it here without logging out.
                                                </p>
                                            </div>
                                        )}

                                        {/* ✅ Email verification controls */}
                                        {!isEmailVerified ? (
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-amber-200/80">
                                                    Your email is not verified. Use the buttons below to resend the verification email
                                                    and verify using the token/link from your inbox.
                                                </p>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        className="bg-slate-900/60 border border-white/10 text-white hover:bg-slate-900/80"
                                                        onClick={() => void onResendVerification()}
                                                        disabled={resendBusy || resendCooldown > 0}
                                                    >
                                                        {resendBusy ? (
                                                            <span className="inline-flex items-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Sending…
                                                            </span>
                                                        ) : resendCooldown > 0 ? (
                                                            `Resend in ${resendCooldown}s`
                                                        ) : (
                                                            "Send verification email"
                                                        )}
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                                        onClick={() => setVerifyDialogOpen(true)}
                                                        disabled={verifyBusy}
                                                    >
                                                        Verify email
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        className="bg-slate-900/60 border border-white/10 text-white hover:bg-slate-900/80"
                                                        onClick={() => void onRefreshVerificationStatus()}
                                                        disabled={refreshBusy}
                                                    >
                                                        {refreshBusy ? (
                                                            <span className="inline-flex items-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Refreshing…
                                                            </span>
                                                        ) : (
                                                            "Refresh status"
                                                        )}
                                                    </Button>
                                                </div>

                                                <AlertDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
                                                    <AlertDialogContent className="bg-slate-900 text-white border-white/10">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Verify your email</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-white/70">
                                                                Paste the verification link or token from the email you received.
                                                                (You can paste the whole link — we’ll extract the token.)
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>

                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-white/80">Verification link / token</Label>
                                                            <Input
                                                                value={verifyTokenInput}
                                                                onChange={(e) => setVerifyTokenInput(e.target.value)}
                                                                className="bg-slate-900/70 border-white/20 text-white"
                                                                placeholder="Paste link or token…"
                                                                disabled={verifyBusy}
                                                            />
                                                            <p className="text-[11px] text-white/50">
                                                                Tip: If you clicked the link already, press “Refresh status”.
                                                            </p>
                                                        </div>

                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel
                                                                disabled={verifyBusy}
                                                                className="bg-slate-800 border-white/10 text-white hover:bg-slate-800/80"
                                                            >
                                                                Cancel
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                disabled={verifyBusy}
                                                                onClick={() => void onVerifyWithToken()}
                                                                className="bg-purple-600 hover:bg-purple-600/90 text-white focus:ring-purple-500"
                                                            >
                                                                {verifyBusy ? (
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                        Verifying…
                                                                    </span>
                                                                ) : (
                                                                    "Verify"
                                                                )}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                        <div className="text-xs text-white/60">Account type</div>
                                        <div className="mt-0.5 font-medium">{roleLabel(rawRole)}</div>
                                    </div>

                                    {isStudent && (
                                        <>
                                            <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                                <div className="text-xs text-white/60">Student ID</div>
                                                <div className="mt-0.5 font-medium">{fmtValue(studentId)}</div>
                                            </div>

                                            <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                                <div className="text-xs text-white/60">Program / Course</div>
                                                {!editing ? (
                                                    <div className="mt-0.5 font-medium">{fmtValue(program)}</div>
                                                ) : (
                                                    <div className="mt-2 space-y-1">
                                                        <Label className="text-xs text-white/80">Program / Course</Label>
                                                        <Input
                                                            value={courseInput}
                                                            onChange={(e) => setCourseInput(e.target.value)}
                                                            className="bg-slate-900/70 border-white/20 text-white"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                                <div className="text-xs text-white/60">Year level</div>
                                                {!editing ? (
                                                    <div className="mt-0.5 font-medium">{fmtValue(yearLevel)}</div>
                                                ) : (
                                                    <div className="mt-2 space-y-1">
                                                        <Label className="text-xs text-white/80">Year level</Label>
                                                        <Input
                                                            value={yearLevelInput}
                                                            onChange={(e) => setYearLevelInput(e.target.value)}
                                                            className="bg-slate-900/70 border-white/20 text-white"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {college ? (
                                                <div className="rounded-md border border-white/10 bg-slate-900/40 p-3">
                                                    <div className="text-xs text-white/60">College</div>
                                                    <div className="mt-0.5 font-medium">{fmtValue(college)}</div>
                                                </div>
                                            ) : null}
                                        </>
                                    )}
                                </div>

                                {editing ? (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            className="bg-purple-600 hover:bg-purple-700 text-white"
                                            onClick={onSaveProfile}
                                            disabled={profileBusy || !profileDirty}
                                        >
                                            {profileBusy ? (
                                                <span className="inline-flex items-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Saving…
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-2">
                                                    <Save className="h-4 w-4" />
                                                    Save changes
                                                </span>
                                            )}
                                        </Button>

                                        {!profileDirty ? (
                                            <span className="text-xs text-white/50">No changes to save.</span>
                                        ) : null}
                                    </div>
                                ) : null}
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
