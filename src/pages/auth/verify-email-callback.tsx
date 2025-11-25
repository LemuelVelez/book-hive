/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

import logo from "@/assets/images/logo.svg";
import { ROUTES } from "@/api/auth/route"; // ✅ use API_BASE / ROUTES instead of hardcoded /api path

// -------------------------
// Lightweight query helper
// -------------------------
function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

export default function VerifyEmailCallbackPage() {
    const qs = useQuery();
    const navigate = useNavigate();

    // Supports both flows:
    // A) Server redirect: /auth/verify-email/callback?status=success|error&reason=...
    // B) Client token:    /auth/verify-email/callback?token=...
    const token = (qs.get("token") || "").trim();
    const status = (qs.get("status") || "").trim();
    const reason = (qs.get("reason") || "").trim();

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string>("");
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const explainReason = (r: string) => {
            switch (r) {
                case "expired":
                    return "This verification link has expired. Please request a new one.";
                case "used":
                    return "This verification link has already been used.";
                case "invalid":
                    return "This verification link is invalid.";
                case "missing":
                    return "Missing token in the verification link.";
                default:
                    return "We couldn't verify your email. Please try again.";
            }
        };

        const handleRedirectStatus = () => {
            if (status === "success") {
                const msg = "Your email has been verified successfully.";
                setSuccess(msg);
                toast.success("Email verified", {
                    action: {
                        label: "Go to login",
                        onClick: () => navigate("/auth"),
                    },
                });
                return true;
            }
            if (status === "error") {
                const msg = explainReason(reason);
                setError(msg);
                toast.error("Verification failed", { description: msg });
                return true;
            }
            return false;
        };

        const run = async () => {
            setError("");
            setSuccess("");

            // If the server already verified (status=...), just show it.
            if (!token && handleRedirectStatus()) return;

            // Otherwise try client-side verification using token
            if (!token) {
                const msg =
                    "This verification link is invalid or missing the token. You can request a new one.";
                setError(msg);
                toast.error("Invalid link", { description: msg });
                return;
            }

            // ✅ Use the API route helper so it works in production (Vercel → Render)
            const verifyRequest = async () => {
                const resp = await fetch(ROUTES.auth.verifyConfirm, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ token }),
                });

                if (!resp.ok) {
                    const data = await resp.json().catch(() => ({}));
                    throw new Error(
                        data?.message ||
                        "We couldn't verify your email. The link may have expired."
                    );
                }

                return true;
            };

            setLoading(true);

            // Call once, but share between toast and local state
            const promise = verifyRequest();

            toast.promise(promise, {
                loading: "Verifying email…",
                success: "Email verified",
                error: (err: any) => err?.message || "Verification failed",
            });

            try {
                await promise;
                const msg = "Your email has been verified successfully.";
                setSuccess(msg);
                toast.success("You can now log in.", {
                    action: {
                        label: "Go to login",
                        onClick: () => navigate("/auth"),
                    },
                });
            } catch (e: any) {
                setError(e?.message || "Something went wrong. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, status, reason]);

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
                        className="h-10 w-10 rounded-md object-contain"
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
                            className="h-32 w-32 mx-auto mb-4 rounded-xl object-contain"
                        />
                        <h1 className="text-2xl font-bold">JRMSU-TC Book-Hive</h1>
                        <p className="text-white/70">Library Borrowing & Reservation Platform</p>
                    </div>

                    <Card className="border-white/10 bg-slate-800/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-white">Verifying your email…</CardTitle>
                            <CardDescription>
                                {success
                                    ? "Your address is verified."
                                    : "Please wait while we confirm your email address."}
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            {loading && (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            )}

                            {success && (
                                <Alert className="bg-emerald-500/15 border-emerald-500/40 text-emerald-200">
                                    <AlertDescription className="flex items-start gap-2">
                                        <CheckCircle className="h-4 w-4 mt-0.5" />
                                        <span>{success}</span>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {error && (
                                <Alert className="bg-red-500/15 border-red-500/40 text-red-200">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </CardContent>

                        <CardFooter className="flex flex-col sm:flex-row items-center justify-center gap-2 border-t border-white/10">
                            {success ? (
                                <Button
                                    type="button"
                                    onClick={() => navigate("/auth")}
                                    className="w-full sm:w-auto text-white bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                >
                                    Go to Login
                                </Button>
                            ) : (
                                <div className="text-sm text-gray-300 text-center">
                                    If this link doesn’t work,&nbsp;
                                    <Link
                                        to="/auth/verify-email"
                                        className="text-purple-300 hover:text-purple-200 underline"
                                    >
                                        request a new verification email
                                    </Link>
                                    .
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-white/60 text-sm">
                <p>© {new Date().getFullYear()} JRMSU-TC — Book-Hive</p>
            </footer>
        </div>
    );
}
