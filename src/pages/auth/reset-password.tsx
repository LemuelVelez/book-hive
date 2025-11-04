/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field"

import logo from "@/assets/images/logo.png"

// -------------------------
// Lightweight query helper
// -------------------------
function useQuery() {
    const { search } = useLocation()
    return useMemo(() => new URLSearchParams(search), [search])
}

export default function ResetPasswordPage() {
    const qs = useQuery()
    const navigate = useNavigate()

    // token from /auth/reset-password?token=...
    const token = (qs.get("token") || "").trim()
    const hasToken = token.length > 0

    // UI state
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [showPass, setShowPass] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>("")
    const [success, setSuccess] = useState<string>("")

    const handleReset = async () => {
        setError("")
        setSuccess("")

        if (!hasToken) {
            setError("This reset link is invalid or missing the token.")
            return
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters.")
            return
        }
        if (password !== confirm) {
            setError("Passwords do not match.")
            return
        }

        setLoading(true)
        try {
            const resp = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ token, password }),
            })
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}))
                throw new Error(
                    data?.message ||
                    "We couldn't reset your password. The link may have expired."
                )
            }
            setSuccess("Your password has been updated successfully.")
            setPassword("")
            setConfirm("")
        } catch (err: any) {
            setError(err?.message || "Something went wrong. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const onKeyDownReset: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleReset()
        }
    }

    return (
        <div className="support-scroll min-h-screen w-full bg-slate-900 text-white flex flex-col">
            {/* Top bar with back link and brand */}
            <header className="container mx-auto py-6 px-4 flex items-center justify-between">
                <Link
                    to="/auth"
                    className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span className="hidden md:inline">Back to Login</span>
                </Link>

                <Link to="/" className="inline-flex items-center gap-2">
                    <img
                        src={logo}
                        alt="JRMSU-TC Book-Hive logo"
                        className="h-8 w-8 rounded-md object-contain"
                    />
                    <span className="hidden md:inline font-semibold">JRMSU-TC Book-Hive</span>
                </Link>
            </header>

            {/* Centered content */}
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Brand header */}
                    <div className="text-center mb-8">
                        <img
                            src={logo}
                            alt="Book-Hive logo"
                            className="h-16 w-16 mx-auto mb-4 rounded-xl object-contain"
                        />
                        <h1 className="text-2xl font-bold">JRMSU-TC Book-Hive</h1>
                        <p className="text-white/70">Library Borrowing & Reservation Platform</p>
                    </div>

                    <Card className="border-white/10 bg-slate-800/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-white">Set a new password</CardTitle>
                            <CardDescription>Create a strong password for your account.</CardDescription>
                        </CardHeader>

                        <CardContent>
                            {!hasToken && (
                                <Alert className="mb-4 bg-yellow-500/15 border-yellow-500/40 text-yellow-100">
                                    <AlertDescription>
                                        This reset link is invalid or missing a token. You can{" "}
                                        <Link to="/auth/forgot-password" className="underline">
                                            request a new link here
                                        </Link>
                                        .
                                    </AlertDescription>
                                </Alert>
                            )}

                            {success && (
                                <Alert className="mb-4 bg-emerald-500/15 border-emerald-500/40 text-emerald-200">
                                    <AlertDescription className="flex items-start gap-2">
                                        <CheckCircle className="h-4 w-4 mt-0.5" />
                                        <span>{success}</span>
                                    </AlertDescription>
                                </Alert>
                            )}
                            {error && (
                                <Alert className="mb-4 bg-red-500/15 border-red-500/40 text-red-200">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-4">
                                <Field>
                                    <FieldLabel className="text-white">New Password</FieldLabel>
                                    <FieldContent>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                            <Input
                                                id="rp-password"
                                                type={showPass ? "text" : "password"}
                                                placeholder="At least 8 characters"
                                                className="pl-10 pr-10 bg-slate-900/70 border-white/10 text-white"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onKeyDown={onKeyDownReset}
                                                autoComplete="new-password"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1.5 top-0.5 h-8 w-8 text-white/70 hover:text-black"
                                                onClick={() => setShowPass((s) => !s)}
                                                aria-label={showPass ? "Hide password" : "Show password"}
                                                aria-pressed={showPass}
                                            >
                                                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </FieldContent>
                                </Field>

                                <Field>
                                    <FieldLabel className="text-white">Confirm New Password</FieldLabel>
                                    <FieldContent>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                            <Input
                                                id="rp-confirm"
                                                type={showConfirm ? "text" : "password"}
                                                placeholder="Repeat your password"
                                                className="pl-10 pr-10 bg-slate-900/70 border-white/10 text-white"
                                                value={confirm}
                                                onChange={(e) => setConfirm(e.target.value)}
                                                onKeyDown={onKeyDownReset}
                                                autoComplete="new-password"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1.5 top-0.5 h-8 w-8 text-white/70 hover:text-black"
                                                onClick={() => setShowConfirm((s) => !s)}
                                                aria-label={showConfirm ? "Hide password" : "Show password"}
                                                aria-pressed={showConfirm}
                                            >
                                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </FieldContent>
                                    {password !== confirm && confirm.length > 0 && (
                                        <FieldError>Passwords do not match.</FieldError>
                                    )}
                                </Field>

                                <Button
                                    type="button"
                                    onClick={handleReset}
                                    disabled={loading || !hasToken}
                                    className="w-full text-white bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-60"
                                >
                                    {loading ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Updating…
                                        </span>
                                    ) : (
                                        "Update password"
                                    )}
                                </Button>
                            </div>
                        </CardContent>

                        <CardFooter className="flex justify-center border-t border-white/10">
                            {success ? (
                                <div className="flex flex-col items-center gap-2 w-full">
                                    <Button
                                        type="button"
                                        onClick={() => navigate("/auth")}
                                        className="w-full sm:w-auto text-white bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                    >
                                        Go to Login
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-300">
                                    Link expired or not working?{" "}
                                    <Link
                                        to="/auth/forgot-password"
                                        className="text-purple-300 hover:text-purple-200 underline"
                                    >
                                        Request a new one
                                    </Link>
                                    .
                                </p>
                            )}
                        </CardFooter>
                    </Card>

                    {/* Subtle hint */}
                    <p className="mt-6 text-center text-xs text-white/60">
                        Make sure your new password is unique and not used on other sites.
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-white/60 text-sm">
                <p>© {new Date().getFullYear()} JRMSU-TC — Book-Hive</p>
            </footer>
        </div>
    )
}
