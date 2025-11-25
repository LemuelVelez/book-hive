/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Eye,
    EyeOff,
    Lock,
    Mail,
    User,
    IdCard,
    Loader2,
    Paperclip,
    HelpCircle,
    MessageSquare,
} from "lucide-react";

// UI primitives
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Field,
    FieldContent,
    FieldError,
    FieldLabel,
} from "@/components/ui/field";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter as DialogFooterUI,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import {
    login as apiLogin,
    register as apiRegister,
    resendVerifyEmail as apiResendVerifyEmail,
    checkStudentIdAvailability,
    // submitSupportTicket,
} from "@/lib/authentication";
import {
    dashboardForRole,
    type Role,
    useSession,
    setSessionUser,
} from "@/hooks/use-session";

import logo from "@/assets/images/logo.svg";

// -------------------------
// Constants & type helpers
// -------------------------
type AccountType = "student" | "other";

const YEAR_LEVELS = ["1st", "2nd", "3rd", "4th", "5th"] as const;
type YearLevel = (typeof YEAR_LEVELS)[number];
type YearLevelOption = YearLevel | "Others";

// Colleges and programs used to drive cascaded selects
const COLLEGES: Record<string, string[]> = {
    "College of Business Administration": ["BSBA", "BSAM", "BSHM"],
    "College of Teacher Education": [
        "BSED Filipino",
        "BSED English",
        "BSED Math",
        "BSED Social Studies",
        "Bachelor of Physical Education",
        "BEED",
    ],
    "College of Computing Studies": ["BS Information Systems", "BS Computer Science"],
    "College of Agriculture and Forestry": ["BS Agriculture", "BS Forestry"],
    "College of Liberal Arts, Mathematics and Sciences": ["BAELS"],
    "School of Engineering": ["Agricultural Biosystems Engineering"],
    "School of Criminal Justice Education": ["BS Criminology"],
};

const COLLEGE_ACRONYM: Record<string, string> = {
    "College of Business Administration": "CBA",
    "College of Teacher Education": "CTED",
    "College of Computing Studies": "CCS",
    "College of Agriculture and Forestry": "CAF",
    "College of Liberal Arts, Mathematics and Sciences": "CLAMS",
    "School of Engineering": "SOE",
    "School of Criminal Justice Education": "SCJE",
};

// LocalStorage keys for "remember me" UX
const REMEMBER_FLAG_KEY = "bookhive:remember";
const REMEMBER_EMAIL_KEY = "bookhive:rememberEmail";

// No-op: reference args to satisfy no-unused-vars and keep a non-empty body for no-empty
const noop = (...args: unknown[]) => {
    void args;
};

// -------------------------
// Lightweight query helpers
// -------------------------
function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

/** Guards against open redirects; only allow in-app paths and not /auth itself */
function sanitizeRedirect(raw: string | null): string | null {
    if (!raw) return null;
    try {
        const url = decodeURIComponent(raw);
        if (!url.startsWith("/")) return null;
        if (url.startsWith("/auth")) return null;
        return url;
    } catch {
        return null;
    }
}

// Helper to compute destination dashboard path for a role
function resolveDashboardForRole(role: Role): string {
    // In this auth page we treat student + other as `/dashboard` (shared route),
    // and use dashboardForRole() for staff roles.
    if (role === "student" || role === "other") return "/dashboard";
    return dashboardForRole(role);
}

// -------------------------
// Component
// -------------------------
export default function AuthPage() {
    const navigate = useNavigate();
    const qs = useQuery();

    // ✅ Session (cached globally, non-blocking)
    const { user: sessionUser, loading: sessionLoading } = useSession();

    // UI state: which tab
    const [activeTab, setActiveTab] = useState<"login" | "register">("login");

    // Login state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState<string>("");

    // Registration state
    const [fullName, setFullName] = useState("");
    const [accountType, setAccountType] = useState<AccountType>("student");
    const [studentId, setStudentId] = useState("");
    const [college, setCollege] = useState<string>("");
    const [program, setProgram] = useState<string>("");
    const [yearLevel, setYearLevel] = useState<YearLevelOption | "">("");
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [regError, setRegError] = useState<string>("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [showRegConfirm, setShowRegConfirm] = useState(false);

    // Student ID availability (debounced check)
    const [checkingStudentId, setCheckingStudentId] = useState(false);
    const [studentIdAvailable, setStudentIdAvailable] = useState<boolean | null>(null);

    // "Others" free-form fields
    const [customCollege, setCustomCollege] = useState("");
    const [customProgram, setCustomProgram] = useState("");
    const [customYearLevel, setCustomYearLevel] = useState("");

    // Support dialog state
    const [supportOpen, setSupportOpen] = useState(false);
    const [supName, setSupName] = useState("");
    const [supEmail, setSupEmail] = useState("");
    const [supCategory, setSupCategory] = useState("Login issue");
    const [supSubject, setSupSubject] = useState("");
    const [supMessage, setSupMessage] = useState("");
    const [supFile, setSupFile] = useState<File | null>(null);
    const [supSubmitting /* , setSupSubmitting */] = useState(false);
    const [supError, setSupError] = useState<string>("");
    const [supSuccess, setSupSuccess] = useState<string>("");
    const [consent, setConsent] = useState(false);

    // Redirect handling
    const redirectParam = sanitizeRedirect(qs.get("redirect") || qs.get("next"));
    const bootRedirectedRef = useRef(false); // ensure we only auto-redirect once

    // -------------
    // Effects
    // -------------

    // ✅ Auto-redirect users who already HAVE a valid session cookie
    //    This runs in the background and does NOT block the login form from rendering.
    useEffect(() => {
        if (bootRedirectedRef.current) return;
        if (sessionLoading) return;

        bootRedirectedRef.current = true;

        if (!sessionUser) return;

        const rawRole = (sessionUser.accountType as Role) ?? "student";
        const dest = redirectParam ?? resolveDashboardForRole(rawRole);

        toast.info("You are already signed in.", {
            description: "Redirecting to your dashboard…",
        });

        navigate(dest, { replace: true });
    }, [sessionLoading, sessionUser, redirectParam, navigate]);

    // Load remembered email (if any)
    useEffect(() => {
        try {
            const remembered = localStorage.getItem(REMEMBER_FLAG_KEY) === "1";
            if (remembered) {
                const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
                setEmail(savedEmail);
                setRememberMe(true);
            }
        } catch (err) {
            // storage not available (private mode / SSR / etc.)
            noop(err);
        }
    }, []);

    // Autofill support dialog name from registration full name
    useEffect(() => {
        if (!supName && fullName) setSupName(fullName.trim());
    }, [fullName, supName]);

    // Autofill support dialog email from whichever tab is active
    useEffect(() => {
        const candidate = (activeTab === "login" ? email : regEmail).trim();
        if (!supEmail && candidate) setSupEmail(candidate);
    }, [activeTab, email, regEmail, supEmail]);

    // -------------
    // Handlers
    // -------------
    // Persist/forget remembered email immediately on toggle
    const handleRememberToggle = (checked: boolean | "indeterminate") => {
        const value = checked === true;
        setRememberMe(value);
        try {
            if (value) {
                localStorage.setItem(REMEMBER_FLAG_KEY, "1");
                localStorage.setItem(REMEMBER_EMAIL_KEY, email);
            } else {
                localStorage.removeItem(REMEMBER_FLAG_KEY);
                localStorage.removeItem(REMEMBER_EMAIL_KEY);
            }
        } catch (err) {
            // ignore persistence errors
            noop(err);
        }
    };

    // Keep remembered email up-to-date as user types
    const handleEmailChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const value = e.target.value;
        setEmail(value);
        if (rememberMe) {
            try {
                localStorage.setItem(REMEMBER_EMAIL_KEY, value);
            } catch (err) {
                // ignore persistence errors
                noop(err);
            }
        }
    };

    // Debounced studentId availability check (only for student account)
    useEffect(() => {
        if (accountType !== "student") {
            setStudentIdAvailable(null);
            return;
        }
        const trimmed = studentId.trim();
        if (!trimmed) {
            setStudentIdAvailable(null);
            return;
        }
        let cancelled = false;
        setCheckingStudentId(true);
        const t = setTimeout(async () => {
            try {
                const data = await checkStudentIdAvailability(trimmed);
                if (!cancelled) setStudentIdAvailable(!!data.available);
            } catch {
                if (!cancelled) setStudentIdAvailable(null);
            } finally {
                if (!cancelled) setCheckingStudentId(false);
            }
        }, 400);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [studentId, accountType]);

    // POST: /api/auth/login
    const triggerLogin = async () => {
        setLoginError("");
        setIsLoggingIn(true);
        try {
            const resp = await apiLogin(email, password);
            const user = resp.user;

            // ✅ update global session cache so dashboard guards see the new session
            setSessionUser(user);

            // Persist remember-me choice after a successful login
            try {
                if (rememberMe) {
                    localStorage.setItem(REMEMBER_FLAG_KEY, "1");
                    localStorage.setItem(REMEMBER_EMAIL_KEY, email);
                } else {
                    localStorage.removeItem(REMEMBER_FLAG_KEY);
                    localStorage.removeItem(REMEMBER_EMAIL_KEY);
                }
            } catch (err) {
                noop(err);
            }

            // Toast + redirect (role aware)
            toast.success("Welcome back!", {
                description: redirectParam
                    ? "Redirecting to your previous page…"
                    : "Redirecting to your dashboard…",
            });

            const rawRole = (user.accountType as Role) ?? "student";
            const dest =
                redirectParam ?? resolveDashboardForRole(rawRole);

            navigate(dest, { replace: true });
        } catch (err: any) {
            const msg = String(err?.message || "Login failed. Please try again.");

            // Handle "email not verified" specifically — route to verify page
            const looksUnverified = /verify/i.test(msg) || /not\s*verified/i.test(msg);
            if (looksUnverified) {
                toast.warning("Email not verified", {
                    description: "We’ve sent a verification link. Please verify to continue.",
                });
                // best-effort re-send (non-blocking)
                try {
                    await apiResendVerifyEmail(email.trim());
                } catch (e) {
                    noop(e);
                }
                navigate(
                    `/auth/verify-email?email=${encodeURIComponent(email.trim())}`,
                    { replace: true }
                );
                setIsLoggingIn(false);
                return;
            }

            setLoginError(msg);
            toast.error("Login failed", { description: msg });
        } finally {
            setIsLoggingIn(false);
        }
    };

    // POST: /api/auth/register (+ backend sends verification email)
    const triggerRegister = async () => {
        setRegError("");

        // Quick client validations to reduce round-trips
        if (regPassword !== confirmPassword) {
            const msg = "Passwords do not match.";
            setRegError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }
        if (regPassword.length < 8) {
            const msg = "Password must be at least 8 characters.";
            setRegError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }
        if (!fullName.trim()) {
            const msg = "Full name is required.";
            setRegError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        // Student-only required fields
        if (accountType === "student") {
            const finalCollege =
                college === "Others" ? customCollege.trim() : college;
            const finalProgram =
                program === "Others" ? customProgram.trim() : program;
            const finalYearLevel =
                yearLevel === "Others" ? customYearLevel.trim() : yearLevel;

            if (!studentId.trim()) {
                const msg = "Student ID is required for student accounts.";
                setRegError(msg);
                toast.error("Validation error", { description: msg });
                return;
            }
            if (!finalCollege) {
                const msg = "College is required for student accounts.";
                setRegError(msg);
                toast.error("Validation error", { description: msg });
                return;
            }
            if (!finalProgram) {
                const msg = "Program is required for student accounts.";
                setRegError(msg);
                toast.error("Validation error", { description: msg });
                return;
            }
            if (!finalYearLevel) {
                const msg = "Year level is required for student accounts.";
                setRegError(msg);
                toast.error("Validation error", { description: msg });
                return;
            }
            if (studentIdAvailable === false) {
                const msg =
                    "That Student ID is already in use. Please use a different one.";
                setRegError(msg);
                toast.error("Student ID unavailable", { description: msg });
                return;
            }
        }

        setIsRegistering(true);
        try {
            const finalProgram =
                program === "Others" ? customProgram.trim() : program;
            const finalYearLevel =
                yearLevel === "Others" ? customYearLevel.trim() : yearLevel;

            // ✅ Map accountType -> role to send both to backend
            const role: Role = accountType === "student" ? "student" : "other";

            const payload: Record<string, unknown> = {
                fullName: fullName.trim(),
                email: regEmail.trim(),
                password: regPassword,
                accountType,
                role, // ✅ ensure role is in sync with accountType
            };

            if (accountType === "student") {
                payload.studentId = studentId.trim();
                payload.course = finalProgram;
                payload.yearLevel = finalYearLevel;
            }

            await apiRegister(payload as any);

            // Backend already creates a verification token and sends the email.
            toast.success("Account created", {
                description: "We sent a verification link to your email.",
            });

            // Route to verify page with email pre-filled
            navigate(
                `/auth/verify-email?email=${encodeURIComponent(
                    regEmail.trim()
                )}&justRegistered=1`,
                { replace: true }
            );
        } catch (err: any) {
            const msg =
                err?.message || "Failed to register. Please try again.";
            setRegError(msg);
            toast.error("Registration failed", { description: msg });
        } finally {
            setIsRegistering(false);
        }
    };

    // Enter-to-submit ergonomics
    const onLoginKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            triggerLogin();
        }
    };
    const onRegisterKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (
        e
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            triggerRegister();
        }
    };

    // Derived options for "Program" based on selected college
    const availablePrograms =
        college && college !== "Others" ? COLLEGES[college] ?? [] : [];

    // Reset support dialog fields to defaults
    const resetSupport = () => {
        setSupSubject("");
        setSupMessage("");
        setSupCategory("Login issue");
        setSupFile(null);
        setConsent(false);
        setSupError("");
        setSupSuccess("");
    };

    // POST: /api/support/ticket — currently disabled, show "under development"
    const submitSupport = async () => {
        const msg = "Contact Support is under development. Coming soon.";
        setSupError("");
        setSupSuccess(msg);
        toast.info("Under development", { description: msg });

        // (Full implementation is commented out)
    };

    // -------------------------
    // Render
    // -------------------------
    return (
        <div className="support-scroll min-h-screen w-full bg-slate-900 text-white flex flex-col">
            {/* Top bar with back link and brand */}
            <header className="container mx-auto py-6 px-4 flex items-center justify-between">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span className="hidden md:inline">Back</span>
                </Link>

                <Link
                    to="/"
                    className="inline-flex items-center gap-2"
                >
                    <img
                        src={logo}
                        alt="JRMSU-TC Book-Hive logo"
                        className="h-10 w-10 rounded-md object-contain"
                    />
                    <span className="hidden md:inline font-semibold">
                        JRMSU-TC Book-Hive
                    </span>
                </Link>
            </header>

            {/* Centered auth card area */}
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Brand header */}
                    <div className="text-center mb-8">
                        <img
                            src={logo}
                            alt="Book-Hive logo"
                            className="h-32 w-32 mx-auto mb-4 rounded-xl object-contain"
                        />
                        <h1 className="text-2xl font-bold">
                            JRMSU-TC Book-Hive
                        </h1>
                        <p className="text-white/70">
                            Library Borrowing & Reservation Platform
                        </p>
                    </div>

                    {/* Auth Tabs */}
                    <Tabs
                        value={activeTab}
                        onValueChange={(v) =>
                            setActiveTab(v as "login" | "register")
                        }
                        className="w-full"
                    >
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger
                                value="login"
                                className="cursor-pointer data-[state=active]:text-white data-[state=active]:bg-linear-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500"
                            >
                                Login
                            </TabsTrigger>
                            <TabsTrigger
                                value="register"
                                className="cursor-pointer data-[state=active]:text-white data-[state=active]:bg-linear-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500"
                            >
                                Register
                            </TabsTrigger>
                        </TabsList>

                        {/* LOGIN */}
                        <TabsContent value="login">
                            <Card className="border-white/10 bg-slate-800/60 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-white">
                                        Login to your account
                                    </CardTitle>
                                    <CardDescription>
                                        Use your Book-Hive credentials
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loginError && (
                                        <Alert className="mb-4 bg-red-500/15 border-red-500/40 text-red-200">
                                            <AlertDescription>
                                                {loginError}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-4">
                                        {/* Email */}
                                        <Field>
                                            <FieldLabel className="text-white">
                                                Email
                                            </FieldLabel>
                                            <FieldContent>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        placeholder="you@example.com"
                                                        className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                        required
                                                        value={email}
                                                        onChange={
                                                            handleEmailChange
                                                        }
                                                        onKeyDown={
                                                            onLoginKeyDown
                                                        }
                                                        autoComplete="username"
                                                        autoCapitalize="none"
                                                        autoCorrect="off"
                                                        spellCheck={false}
                                                    />
                                                </div>
                                            </FieldContent>
                                        </Field>

                                        {/* Password with show/hide */}
                                        <Field>
                                            <FieldLabel className="text-white">
                                                Password
                                            </FieldLabel>
                                            <FieldContent>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                    <Input
                                                        id="password"
                                                        type={
                                                            showPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        placeholder="••••••••"
                                                        className="pl-10 pr-10 bg-slate-900/70 border-white/10 text-white"
                                                        required
                                                        value={password}
                                                        onChange={(e) =>
                                                            setPassword(
                                                                e.target.value
                                                            )
                                                        }
                                                        onKeyDown={
                                                            onLoginKeyDown
                                                        }
                                                        autoComplete="current-password"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        // ✅ perfectly centered Eye / EyeOff
                                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white"
                                                        onClick={() =>
                                                            setShowPassword(
                                                                (s) => !s
                                                            )
                                                        }
                                                        aria-label={
                                                            showPassword
                                                                ? "Hide password"
                                                                : "Show password"
                                                        }
                                                        aria-pressed={
                                                            showPassword
                                                        }
                                                    >
                                                        {showPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </FieldContent>
                                        </Field>

                                        {/* Remember + Forgot */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="remember"
                                                    checked={rememberMe}
                                                    onCheckedChange={
                                                        handleRememberToggle
                                                    }
                                                />
                                                <Label
                                                    htmlFor="remember"
                                                    className="text-sm text-white/80"
                                                >
                                                    Remember me
                                                </Label>
                                            </div>
                                            <Link
                                                to="/auth/forgot-password"
                                                className="text-sm text-purple-300 hover:text-purple-200"
                                            >
                                                Forgot password?
                                            </Link>
                                        </div>

                                        {/* Login CTA */}
                                        <Button
                                            type="button"
                                            onClick={triggerLogin}
                                            className="w-full text-white bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                            disabled={isLoggingIn}
                                        >
                                            {isLoggingIn
                                                ? "Logging in…"
                                                : "Login"}
                                        </Button>
                                    </div>
                                </CardContent>

                                {/* Support entry lives in the card footer to keep it near actions */}
                                <CardFooter className="flex justify-center border-t border-white/10">
                                    <Dialog
                                        open={supportOpen}
                                        onOpenChange={(o) => {
                                            setSupportOpen(o);
                                            if (!o) resetSupport();
                                        }}
                                    >
                                        <div className="text-sm text-gray-300 flex items-center gap-2">
                                            <span>Need help?</span>
                                            <DialogTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="text-purple-300 hover:text-purple-200 underline decoration-1 underline-offset-[3px] bg-transparent border-0 cursor-pointer inline-flex items-center gap-1"
                                                >
                                                    <HelpCircle
                                                        className="h-4 w-4"
                                                        aria-hidden
                                                    />
                                                    <span>
                                                        Contact support
                                                    </span>
                                                </button>
                                            </DialogTrigger>
                                        </div>

                                        {/* Dialog is kept narrow on mobile with capped height and custom scrollbar */}
                                        <DialogContent className="support-scroll w-[92vw] sm:w-auto max-h-[80dvh] sm:max-h-[70dvh] overflow-y-auto bg-slate-900 text-white border-white/10 p-4 sm:p-6">
                                            <DialogHeader>
                                                <DialogTitle className="text-white flex items-center gap-2">
                                                    <MessageSquare className="h-5 w-5" />
                                                    Contact support
                                                </DialogTitle>
                                                <DialogDescription className="text-white/70">
                                                    Tell us what’s going on.
                                                    We’ll email you once we’ve
                                                    checked your ticket.
                                                </DialogDescription>
                                            </DialogHeader>

                                            {/* Submission status */}
                                            {supSuccess ? (
                                                <Alert className="bg-emerald-500/15 border-emerald-500/40 text-emerald-200">
                                                    <AlertDescription>
                                                        {supSuccess}
                                                    </AlertDescription>
                                                </Alert>
                                            ) : supError ? (
                                                <Alert className="bg-red-500/15 border-red-500/40 text-red-200">
                                                    <AlertDescription>
                                                        {supError}
                                                    </AlertDescription>
                                                </Alert>
                                            ) : null}

                                            {/* Form body */}
                                            <div className="grid gap-4 py-2">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="sup-name">
                                                            Your name
                                                        </Label>
                                                        <Input
                                                            id="sup-name"
                                                            value={supName}
                                                            onChange={(e) =>
                                                                setSupName(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Juan Dela Cruz"
                                                            className="bg-slate-900/70 border-white/10 text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="sup-email">
                                                            Email
                                                        </Label>
                                                        <Input
                                                            id="sup-email"
                                                            type="email"
                                                            value={supEmail}
                                                            onChange={(e) =>
                                                                setSupEmail(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="you@example.com"
                                                            className="bg-slate-900/70 border-white/10 text-white"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="sup-category">
                                                        Category
                                                    </Label>
                                                    <Select
                                                        value={supCategory}
                                                        onValueChange={
                                                            setSupCategory
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="sup-category"
                                                            className="bg-slate-900/70 border-white/10 text-white"
                                                        >
                                                            <SelectValue placeholder="Select a category" />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-900 text-white border-white/10">
                                                            <SelectItem value="Login issue">
                                                                Login issue
                                                            </SelectItem>
                                                            <SelectItem value="Registration issue">
                                                                Registration
                                                                issue
                                                            </SelectItem>
                                                            <SelectItem value="Borrowing/Reservation">
                                                                Borrowing /
                                                                Reservation
                                                            </SelectItem>
                                                            <SelectItem value="Account settings">
                                                                Account
                                                                settings
                                                            </SelectItem>
                                                            <SelectItem value="Bug report">
                                                                Bug report
                                                            </SelectItem>
                                                            <SelectItem value="Feature request">
                                                                Feature request
                                                            </SelectItem>
                                                            <SelectItem value="Other">
                                                                Other
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="sup-subject">
                                                        Subject
                                                    </Label>
                                                    <Input
                                                        id="sup-subject"
                                                        value={supSubject}
                                                        onChange={(e) =>
                                                            setSupSubject(
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Short summary (e.g., Can't log in)"
                                                        className="bg-slate-900/70 border-white/10 text-white"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="sup-message">
                                                        Details
                                                    </Label>
                                                    <Textarea
                                                        id="sup-message"
                                                        value={supMessage}
                                                        onChange={(e) =>
                                                            setSupMessage(
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Describe the issue and the steps to reproduce it…"
                                                        className="min-h-[120px] bg-slate-900/70 border-white/10 text-white"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label
                                                        htmlFor="sup-file"
                                                        className="inline-flex items-center gap-2"
                                                    >
                                                        <Paperclip className="h-4 w-4" />
                                                        Attach screenshot
                                                        (optional)
                                                    </Label>
                                                    <Input
                                                        id="sup-file"
                                                        type="file"
                                                        accept=".png,.jpg,.jpeg,.gif,.pdf"
                                                        onChange={(e) =>
                                                            setSupFile(
                                                                e.target.files?.[0] ??
                                                                null
                                                            )
                                                        }
                                                        className="bg-slate-900/70 border-white/10 text-white file:text-white"
                                                    />
                                                    {supFile && (
                                                        <p className="text-xs text-white/60">
                                                            Selected:{" "}
                                                            {supFile.name}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-start gap-2">
                                                    <Checkbox
                                                        id="sup-consent"
                                                        checked={consent}
                                                        onCheckedChange={(v) =>
                                                            setConsent(
                                                                v === true
                                                            )
                                                        }
                                                    />
                                                    <Label
                                                        htmlFor="sup-consent"
                                                        className="text-sm text-white/80"
                                                    >
                                                        You may contact me about
                                                        this ticket and store
                                                        the information I
                                                        provided for support.
                                                    </Label>
                                                </div>

                                                <div className="text-xs text-white/50">
                                                    Tip: Including your Student
                                                    ID and program helps us
                                                    resolve account-specific
                                                    issues faster.
                                                </div>
                                            </div>

                                            {/* Footer with secondary help and actions */}
                                            <DialogFooterUI className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <div className="text-xs text-white/60">
                                                    Or email us at{" "}
                                                    <a
                                                        className="underline hover:text-white"
                                                        href="mailto:support@example.com"
                                                    >
                                                        support@example.com
                                                    </a>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSupportOpen(
                                                                false
                                                            );
                                                            resetSupport();
                                                        }}
                                                        className="border-white/15 bg-black/50 text:white hover:text-white hover:bg:black/10 w-full sm:w-auto"
                                                        disabled={supSubmitting}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        onClick={submitSupport}
                                                        disabled={supSubmitting}
                                                        className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 w-full sm:w-auto"
                                                    >
                                                        {supSubmitting ? (
                                                            <span className="inline-flex items-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                                                                Sending…
                                                            </span>
                                                        ) : (
                                                            "Send ticket"
                                                        )}
                                                    </Button>
                                                </div>
                                            </DialogFooterUI>
                                        </DialogContent>
                                    </Dialog>
                                </CardFooter>
                            </Card>
                        </TabsContent>

                        {/* REGISTER */}
                        <TabsContent value="register">
                            <Card className="border-white/10 bg-slate-800/60 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-white">
                                        Create an account
                                    </CardTitle>
                                    <CardDescription>
                                        Register to use Book-Hive
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {regError && (
                                        <Alert className="mb-4 bg-red-500/15 border-red-500/40 text-red-200">
                                            <AlertDescription>
                                                {regError}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-4">
                                        {/* Full name */}
                                        <Field>
                                            <FieldLabel className="text-white">
                                                Full Name
                                            </FieldLabel>
                                            <FieldContent>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                    <Input
                                                        id="fullname"
                                                        placeholder="Juan Dela Cruz"
                                                        className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                        value={fullName}
                                                        onChange={(e) =>
                                                            setFullName(
                                                                e.target.value
                                                            )
                                                        }
                                                        onKeyDown={
                                                            onRegisterKeyDown
                                                        }
                                                        required
                                                        autoComplete="name"
                                                    />
                                                </div>
                                            </FieldContent>
                                        </Field>

                                        {/* Account type */}
                                        <Field>
                                            <FieldLabel className="text-white">
                                                Account Type
                                            </FieldLabel>
                                            <FieldContent>
                                                <Select
                                                    value={accountType}
                                                    onValueChange={(v) =>
                                                        setAccountType(
                                                            v as AccountType
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="bg-slate-900/70 border-white/10 text:white">
                                                        <SelectValue placeholder="Select account type" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                                        <SelectItem value="student">
                                                            Student
                                                        </SelectItem>
                                                        <SelectItem value="other">
                                                            Other
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FieldContent>
                                        </Field>

                                        {/* Student-only fields */}
                                        {accountType === "student" && (
                                            <>
                                                {/* Student ID */}
                                                <Field>
                                                    <FieldLabel className="text-white">
                                                        Student ID{" "}
                                                        <span className="text-red-300">
                                                            *
                                                        </span>
                                                    </FieldLabel>
                                                    <FieldContent>
                                                        <div className="relative">
                                                            <IdCard className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                            <Input
                                                                id="student-id"
                                                                placeholder="e.g., TC-20-A-00001"
                                                                className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                                value={studentId}
                                                                onChange={(e) =>
                                                                    setStudentId(
                                                                        e.target
                                                                            .value
                                                                    )
                                                                }
                                                                onKeyDown={
                                                                    onRegisterKeyDown
                                                                }
                                                                required
                                                                autoComplete="off"
                                                                spellCheck={
                                                                    false
                                                                }
                                                            />
                                                        </div>
                                                    </FieldContent>

                                                    {/* Debounced availability indicator */}
                                                    {checkingStudentId ? (
                                                        <span className="text-xs text-white/60">
                                                            Checking
                                                            availability…
                                                        </span>
                                                    ) : studentId &&
                                                        studentIdAvailable !==
                                                        null ? (
                                                        <span
                                                            className={`text-xs ${studentIdAvailable
                                                                ? "text-emerald-300"
                                                                : "text-red-300"
                                                                }`}
                                                        >
                                                            {studentIdAvailable
                                                                ? "Student ID is available"
                                                                : "Student ID is already taken"}
                                                        </span>
                                                    ) : null}
                                                </Field>

                                                {/* College */}
                                                <Field>
                                                    <FieldLabel className="text-white">
                                                        College{" "}
                                                        <span className="text-red-300">
                                                            *
                                                        </span>
                                                    </FieldLabel>
                                                    <FieldContent>
                                                        <Select
                                                            value={
                                                                college ||
                                                                undefined
                                                            }
                                                            onValueChange={(
                                                                v
                                                            ) => {
                                                                setCollege(v);
                                                                setProgram("");
                                                                setCustomCollege(
                                                                    ""
                                                                );
                                                            }}
                                                        >
                                                            <SelectTrigger className="bg-slate-900/70 border-white/10 text-white">
                                                                <SelectValue placeholder="Select college" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-slate-900 text-white border-white/10 max-h-80">
                                                                {Object.keys(
                                                                    COLLEGES
                                                                ).map((c) => (
                                                                    <SelectItem
                                                                        key={c}
                                                                        value={
                                                                            c
                                                                        }
                                                                        className="whitespace-normal leading-tight py-2"
                                                                    >
                                                                        <span className="md:hidden block text-base">
                                                                            {
                                                                                COLLEGE_ACRONYM[
                                                                                c
                                                                                ]
                                                                            }
                                                                        </span>
                                                                        <span className="hidden md:flex w-full items-center justify-between gap-2">
                                                                            <span className="block">
                                                                                {
                                                                                    c
                                                                                }
                                                                            </span>
                                                                            <span className="text-xs opacity-70">
                                                                                {
                                                                                    COLLEGE_ACRONYM[
                                                                                    c
                                                                                    ]
                                                                                }
                                                                            </span>
                                                                        </span>
                                                                    </SelectItem>
                                                                ))}
                                                                <SelectItem
                                                                    value="Others"
                                                                    className="whitespace-normal leading-tight py-2"
                                                                >
                                                                    <span className="block">
                                                                        Others
                                                                        (Please
                                                                        specify)
                                                                    </span>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {college ===
                                                            "Others" && (
                                                                <div className="mt-2">
                                                                    <Input
                                                                        placeholder="Please specify your college"
                                                                        value={
                                                                            customCollege
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setCustomCollege(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        autoComplete="organization"
                                                                        className="bg-slate-900/70 border-white/10 text-white"
                                                                    />
                                                                </div>
                                                            )}
                                                    </FieldContent>
                                                </Field>

                                                {/* Program depends on College */}
                                                <Field>
                                                    <FieldLabel className="text-white">
                                                        Program{" "}
                                                        <span className="text-red-300">
                                                            *
                                                        </span>
                                                    </FieldLabel>
                                                    <FieldContent>
                                                        <Select
                                                            disabled={!college}
                                                            value={
                                                                program ||
                                                                undefined
                                                            }
                                                            onValueChange={(
                                                                v
                                                            ) => {
                                                                setProgram(v);
                                                                setCustomProgram(
                                                                    ""
                                                                );
                                                            }}
                                                        >
                                                            <SelectTrigger className="bg-slate-900/70 border-white/10 text-white disabled:opacity-60">
                                                                <SelectValue
                                                                    placeholder={
                                                                        college
                                                                            ? "Select program"
                                                                            : "Select college first"
                                                                    }
                                                                />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-slate-900 text-white border-white/10 max-h-80">
                                                                {availablePrograms.map(
                                                                    (p) => (
                                                                        <SelectItem
                                                                            key={
                                                                                p
                                                                            }
                                                                            value={
                                                                                p
                                                                            }
                                                                            className="whitespace-normal leading-tight py-2"
                                                                        >
                                                                            {p}
                                                                        </SelectItem>
                                                                    )
                                                                )}
                                                                {!!college && (
                                                                    <SelectItem
                                                                        value="Others"
                                                                        className="whitespace-normal leading-tight py-2"
                                                                    >
                                                                        <span className="block">
                                                                            Others
                                                                            (Please
                                                                            specify)
                                                                        </span>
                                                                    </SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        {program ===
                                                            "Others" && (
                                                                <div className="mt-2">
                                                                    <Input
                                                                        placeholder="Please specify your program"
                                                                        value={
                                                                            customProgram
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setCustomProgram(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        autoComplete="off"
                                                                        className="bg-slate-900/70 border-white/10 text:white"
                                                                    />
                                                                </div>
                                                            )}
                                                    </FieldContent>
                                                </Field>

                                                {/* Year level */}
                                                <Field>
                                                    <FieldLabel className="text-white">
                                                        Year Level{" "}
                                                        <span className="text-red-300">
                                                            *
                                                        </span>
                                                    </FieldLabel>
                                                    <FieldContent>
                                                        <Select
                                                            value={
                                                                yearLevel ||
                                                                undefined
                                                            }
                                                            onValueChange={(
                                                                v
                                                            ) => {
                                                                setYearLevel(
                                                                    v as YearLevelOption
                                                                );
                                                                setCustomYearLevel(
                                                                    ""
                                                                );
                                                            }}
                                                        >
                                                            <SelectTrigger className="bg-slate-900/70 border-white/10 text-white">
                                                                <SelectValue placeholder="Select year level" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                                                {YEAR_LEVELS.map(
                                                                    (y) => (
                                                                        <SelectItem
                                                                            key={
                                                                                y
                                                                            }
                                                                            value={
                                                                                y
                                                                            }
                                                                        >
                                                                            {y}
                                                                        </SelectItem>
                                                                    )
                                                                )}
                                                                <SelectItem value="Others">
                                                                    Others
                                                                    (Please
                                                                    specify)
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {yearLevel ===
                                                            "Others" && (
                                                                <div className="mt-2">
                                                                    <Input
                                                                        placeholder="Please specify your year level"
                                                                        value={
                                                                            customYearLevel
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setCustomYearLevel(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        autoComplete="off"
                                                                        className="bg-slate-900/70 border-white/10 text-white"
                                                                    />
                                                                </div>
                                                            )}
                                                    </FieldContent>
                                                </Field>
                                            </>
                                        )}

                                        {/* Email */}
                                        <Field>
                                            <FieldLabel className="text-white">
                                                Email
                                            </FieldLabel>
                                            <FieldContent>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                    <Input
                                                        id="reg-email"
                                                        type="email"
                                                        placeholder="you@example.com"
                                                        className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                        value={regEmail}
                                                        onChange={(e) =>
                                                            setRegEmail(
                                                                e.target.value
                                                            )
                                                        }
                                                        onKeyDown={
                                                            onRegisterKeyDown
                                                        }
                                                        required
                                                        autoComplete="email"
                                                        autoCapitalize="none"
                                                        autoCorrect="off"
                                                        spellCheck={false}
                                                    />
                                                </div>
                                            </FieldContent>
                                        </Field>

                                        {/* Password */}
                                        <Field>
                                            <FieldLabel className="text-white">
                                                Password
                                            </FieldLabel>
                                            <FieldContent>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                    <Input
                                                        id="reg-password"
                                                        type={
                                                            showRegPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        placeholder="At least 8 characters"
                                                        className="pl-10 pr-10 bg-slate-900/70 border-white/10 text-white"
                                                        value={regPassword}
                                                        onChange={(e) =>
                                                            setRegPassword(
                                                                e.target.value
                                                            )
                                                        }
                                                        onKeyDown={
                                                            onRegisterKeyDown
                                                        }
                                                        required
                                                        autoComplete="new-password"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        // ✅ centered Eye / EyeOff
                                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white"
                                                        onClick={() =>
                                                            setShowRegPassword(
                                                                (s) => !s
                                                            )
                                                        }
                                                        aria-label={
                                                            showRegPassword
                                                                ? "Hide password"
                                                                : "Show password"
                                                        }
                                                        aria-pressed={
                                                            showRegPassword
                                                        }
                                                    >
                                                        {showRegPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </FieldContent>
                                        </Field>

                                        {/* Confirm password */}
                                        <Field>
                                            <FieldLabel className="text-white">
                                                Confirm Password
                                            </FieldLabel>
                                            <FieldContent>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                    <Input
                                                        id="confirm-password"
                                                        type={
                                                            showRegConfirm
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        placeholder="Repeat your password"
                                                        className="pl-10 pr-10 bg-slate-900/70 border-white/10 text-white"
                                                        value={confirmPassword}
                                                        onChange={(e) =>
                                                            setConfirmPassword(
                                                                e.target.value
                                                            )
                                                        }
                                                        onKeyDown={
                                                            onRegisterKeyDown
                                                        }
                                                        required
                                                        autoComplete="new-password"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        // ✅ centered Eye / EyeOff
                                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white"
                                                        onClick={() =>
                                                            setShowRegConfirm(
                                                                (s) => !s
                                                            )
                                                        }
                                                        aria-label={
                                                            showRegConfirm
                                                                ? "Hide password"
                                                                : "Show password"
                                                        }
                                                        aria-pressed={
                                                            showRegConfirm
                                                        }
                                                    >
                                                        {showRegConfirm ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </FieldContent>

                                            {/* Real-time mismatch hint */}
                                            {regPassword !==
                                                confirmPassword &&
                                                confirmPassword.length > 0 && (
                                                    <FieldError>
                                                        Passwords do not match.
                                                    </FieldError>
                                                )}
                                        </Field>

                                        {/* Register CTA */}
                                        <Button
                                            type="button"
                                            onClick={triggerRegister}
                                            className="w-full text-white bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                            disabled={isRegistering}
                                        >
                                            {isRegistering
                                                ? "Creating account…"
                                                : "Register"}
                                        </Button>
                                    </div>
                                </CardContent>

                                {/* Subtle link back to login */}
                                <CardFooter className="flex justify-center border-t border-white/10">
                                    <p className="text-sm text-gray-300">
                                        Already have an account?{" "}
                                        <button
                                            onClick={() =>
                                                setActiveTab("login")
                                            }
                                            className="text-purple-300 hover:text-purple-200 underline bg-transparent border-none cursor-pointer"
                                        >
                                            Login
                                        </button>
                                    </p>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    {/* Legal / acceptable use hint */}
                    <p className="mt-6 text-center text-xs text-white/60">
                        By continuing, you agree to the acceptable use of the
                        JRMSU-TC Book-Hive platform.
                    </p>
                </div>
            </main>

            {/* Simple footer with dynamic year */}
            <footer className="py-6 text-center text-white/60 text-sm">
                <p>
                    © {new Date().getFullYear()} JRMSU-TC — Book-Hive
                </p>
            </footer>
        </div>
    );
}
