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
        user?.fullName || user?.name || user?.full_name || user?.student_name || "—"

    const email = user?.email || "—"

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
                // best-effort: ask backend to send a verification email (doesn't break if endpoint missing)
                try {
                    await tryResendVerifyEmail(nextEmail)
                } catch {
                    // ignore
                }

                toast.success("Profile updated", {
                    description:
                        "Your email was changed. It will be marked as unverified and must be verified the next time you log in.",
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
                                        <div className="text-xs text-white/60">Email</div>
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
                                                    <span className="font-semibold text-amber-300">unverified</span> and you’ll
                                                    need to verify it the next time you log in.
                                                </p>
                                            </div>
                                        )}
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
