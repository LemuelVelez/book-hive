/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react"

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
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import { toast } from "sonner"

import logo from "@/assets/images/logo.png"

// -------------------------
// Lightweight query helper
// -------------------------
function useQuery() {
    const { search } = useLocation()
    return useMemo(() => new URLSearchParams(search), [search])
}

export default function VerifyEmailPage() {
    const qs = useQuery()

    const justRegistered = qs.get("justRegistered") === "1"
    const initialEmail = (qs.get("email") || "").trim()

    const [email, setEmail] = useState(initialEmail)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState<string>("")
    const [error, setError] = useState<string>("")

    const handleSend = async () => {
        setError("")
        setSuccess("")

        if (!email || !email.includes("@")) {
            const msg = "Please enter a valid email address."
            setError(msg)
            toast.error("Invalid email", { description: msg })
            return
        }

        setLoading(true)
        try {
            const resp = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email: email.trim() }),
            })
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}))
                throw new Error(
                    data?.message || "We couldn't send the verification email. Please try again."
                )
            }
            const msg =
                "Verification link sent. Please check your inbox (and Spam/Promotions folder)."
            setSuccess(msg)
            toast.success("Verification email sent", {
                description: "Check your inbox and spam folder.",
                action: {
                    label: "Open Gmail",
                    onClick: () => window.open("https://mail.google.com/", "_blank", "noopener"),
                },
            })
        } catch (err: any) {
            const msg = err?.message || "Something went wrong. Please try again."
            setError(msg)
            toast.error("Send failed", { description: msg })
        } finally {
            setLoading(false)
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
                            <CardTitle className="text-white">Verify your email</CardTitle>
                            <CardDescription>
                                {justRegistered
                                    ? "Almost there! We’ve sent a verification link to your email. You can resend it below."
                                    : "Enter your account email and we’ll send you a verification link."}
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
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
                                    <FieldLabel className="text-white">Email</FieldLabel>
                                    <FieldContent>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                            <Input
                                                id="ve-email"
                                                type="email"
                                                placeholder="you@example.com"
                                                className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                autoCapitalize="none"
                                                autoCorrect="off"
                                                spellCheck={false}
                                            />
                                        </div>
                                    </FieldContent>
                                </Field>

                                <Button
                                    type="button"
                                    onClick={handleSend}
                                    disabled={loading}
                                    className="w-full text-white bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                >
                                    {loading ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                                        </span>
                                    ) : (
                                        "Send verification email"
                                    )}
                                </Button>

                                <div className="text-xs text-white/60">
                                    Tip: If you don’t see the email within a few minutes, check your Spam or
                                    Promotions folder. Some campus inboxes may delay external emails.
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="flex justify-center border-t border-white/10">
                            <p className="text-sm text-gray-300">
                                Already clicked the link?{" "}
                                <Link
                                    to="/auth"
                                    className="text-purple-300 hover:text-purple-200 underline"
                                >
                                    Go to Login
                                </Link>
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-white/60 text-sm">
                <p>© {new Date().getFullYear()} JRMSU-TC — Book-Hive</p>
            </footer>
        </div>
    )
}
