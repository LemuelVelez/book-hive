/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User, IdCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import logo from '@/assets/images/logo.png'

type AccountType = 'student' | 'other'
type CourseName =
    | 'BACHELOR OF SCIENCE IN EDUCATION'
    | 'BACHELOR OF SCIENCE IN SOCIAL WORK'
    | 'BACHELOR OF SCIENCE IN COMPUTER SCIENCE'
    | 'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY'

const COURSES: CourseName[] = [
    'BACHELOR OF SCIENCE IN EDUCATION',
    'BACHELOR OF SCIENCE IN SOCIAL WORK',
    'BACHELOR OF SCIENCE IN COMPUTER SCIENCE',
    'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY',
]

const COURSE_ACRONYM: Record<CourseName, string> = {
    'BACHELOR OF SCIENCE IN EDUCATION': 'BSED',
    'BACHELOR OF SCIENCE IN SOCIAL WORK': 'BSSW',
    'BACHELOR OF SCIENCE IN COMPUTER SCIENCE': 'BSCS',
    'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY': 'BSIT',
}

const YEAR_LEVELS = ['1st', '2nd', '3rd', '4th', '5th'] as const
type YearLevel = (typeof YEAR_LEVELS)[number]

const REMEMBER_FLAG_KEY = 'bookhive:remember'
const REMEMBER_EMAIL_KEY = 'bookhive:rememberEmail'

function useQuery() {
    const { search } = useLocation()
    return useMemo(() => new URLSearchParams(search), [search])
}

function sanitizeRedirect(raw: string | null): string | null {
    if (!raw) return null
    try {
        const url = decodeURIComponent(raw)
        if (!url.startsWith('/')) return null
        if (url.startsWith('/auth')) return null
        return url
    } catch {
        return null
    }
}

export default function AuthPage() {
    const navigate = useNavigate()
    const qs = useQuery()

    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

    // Login state
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [loginError, setLoginError] = useState<string>('')

    // Register state
    const [fullName, setFullName] = useState('')
    const [accountType, setAccountType] = useState<AccountType>('student')
    const [studentId, setStudentId] = useState('')
    const [course, setCourse] = useState<CourseName | ''>('')
    const [yearLevel, setYearLevel] = useState<YearLevel | ''>('')
    const [regEmail, setRegEmail] = useState('')
    const [regPassword, setRegPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [regError, setRegError] = useState<string>('')
    const [isRegistering, setIsRegistering] = useState(false)
    const [showRegPassword, setShowRegPassword] = useState(false)
    const [showRegConfirm, setShowRegConfirm] = useState(false)
    const [checkingStudentId, setCheckingStudentId] = useState(false)
    const [studentIdAvailable, setStudentIdAvailable] = useState<boolean | null>(null)

    const redirectParam = sanitizeRedirect(qs.get('redirect') || qs.get('next'))
    const bootRedirectedRef = useRef(false)

    // Prefill remembered email
    useEffect(() => {
        try {
            const remembered = localStorage.getItem(REMEMBER_FLAG_KEY) === '1'
            if (remembered) {
                const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) || ''
                setEmail(savedEmail)
                setRememberMe(true)
            }
        } catch {
            /* ignore */
        }
    }, [])

    // (Optional) Check existing session and redirect.
    useEffect(() => {
        if (bootRedirectedRef.current) return
        // You may call your session endpoint here.
        // If logged in, navigate(redirectParam ?? '/dashboard/student', { replace: true })
    }, [redirectParam])

    const handleRememberToggle = (checked: boolean | 'indeterminate') => {
        const value = checked === true
        setRememberMe(value)
        try {
            if (value) {
                localStorage.setItem(REMEMBER_FLAG_KEY, '1')
                localStorage.setItem(REMEMBER_EMAIL_KEY, email)
            } else {
                localStorage.removeItem(REMEMBER_FLAG_KEY)
                localStorage.removeItem(REMEMBER_EMAIL_KEY)
            }
        } catch {
            /* ignore */
        }
    }

    const handleEmailChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const value = e.target.value
        setEmail(value)
        if (rememberMe) {
            try {
                localStorage.setItem(REMEMBER_EMAIL_KEY, value)
            } catch {
                /* ignore */
            }
        }
    }

    // Debounced student ID availability check
    useEffect(() => {
        if (accountType !== 'student') {
            setStudentIdAvailable(null)
            return
        }
        const trimmed = studentId.trim()
        if (!trimmed) {
            setStudentIdAvailable(null)
            return
        }
        let cancelled = false
        setCheckingStudentId(true)
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/check-student-id?studentId=${encodeURIComponent(trimmed)}`)
                if (!cancelled && res.ok) {
                    const data = (await res.json()) as { available: boolean }
                    setStudentIdAvailable(data.available)
                } else if (!cancelled) {
                    setStudentIdAvailable(null)
                }
            } catch {
                if (!cancelled) setStudentIdAvailable(null)
            } finally {
                if (!cancelled) setCheckingStudentId(false)
            }
        }, 400)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [studentId, accountType])

    // Login
    const handleLogin: React.FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault()
        setLoginError('')
        setIsLoggingIn(true)
        try {
            const resp = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            })
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}))
                throw new Error(data?.message || 'Invalid email or password.')
            }

            try {
                if (rememberMe) {
                    localStorage.setItem(REMEMBER_FLAG_KEY, '1')
                    localStorage.setItem(REMEMBER_EMAIL_KEY, email)
                } else {
                    localStorage.removeItem(REMEMBER_FLAG_KEY)
                    localStorage.removeItem(REMEMBER_EMAIL_KEY)
                }
            } catch {
                /* ignore */
            }

            const dest = redirectParam ?? '/dashboard/student'
            navigate(dest, { replace: true })
        } catch (err: any) {
            setLoginError(err?.message || 'Login failed. Please try again.')
        } finally {
            setIsLoggingIn(false)
        }
    }

    // Register
    const handleRegister: React.FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault()
        setRegError('')

        if (regPassword !== confirmPassword) {
            setRegError('Passwords do not match.')
            return
        }
        if (regPassword.length < 8) {
            setRegError('Password must be at least 8 characters.')
            return
        }
        if (!fullName.trim()) {
            setRegError('Full name is required.')
            return
        }

        if (accountType === 'student') {
            if (!studentId.trim()) {
                setRegError('Student ID is required for student accounts.')
                return
            }
            if (!course) {
                setRegError('Course is required for student accounts.')
                return
            }
            if (!yearLevel) {
                setRegError('Year level is required for student accounts.')
                return
            }
            if (studentIdAvailable === false) {
                setRegError('That Student ID is already in use. Please use a different one.')
                return
            }
        }

        setIsRegistering(true)
        try {
            const payload: Record<string, unknown> = {
                fullName: fullName.trim(),
                email: regEmail.trim(),
                password: regPassword,
                accountType,
            }
            if (accountType === 'student') {
                payload.studentId = studentId.trim()
                payload.course = course
                payload.yearLevel = yearLevel
            }

            const resp = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            })
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}))
                const msg =
                    data?.message ||
                    (resp.status === 409
                        ? 'An account with this email or Student ID already exists.'
                        : 'Registration failed. Please try again.')
                throw new Error(msg)
            }

            // Best-effort email verification
            try {
                await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email: regEmail.trim() }),
                })
            } catch {
                /* ignore */
            }

            navigate(`/auth/verify-email?email=${encodeURIComponent(regEmail.trim())}&justRegistered=1`, {
                replace: true,
            })
        } catch (err: any) {
            setRegError(err?.message || 'Failed to register. Please try again.')
        } finally {
            setIsRegistering(false)
        }
    }

    return (
        <div className="min-h-screen w-full bg-slate-900 text-white flex flex-col">
            {/* Header */}
            <header className="container mx-auto py-6 px-4 flex items-center justify-between">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back to Home</span>
                </Link>

                <Link to="/" className="inline-flex items-center gap-2">
                    <img
                        src={logo}
                        alt="JRMSU-TC Book-Hive logo"
                        className="h-8 w-8 rounded-md object-contain"
                    />
                    <span className="font-semibold">JRMSU-TC Book-Hive</span>
                </Link>
            </header>

            {/* Main */}
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Branding */}
                    <div className="text-center mb-8">
                        <img
                            src={logo}
                            alt="Book-Hive logo"
                            className="h-16 w-16 mx-auto mb-4 rounded-xl object-contain"
                        />
                        <h1 className="text-2xl font-bold">JRMSU-TC Book-Hive</h1>
                        <p className="text-white/70">Library Borrowing & Reservation Platform</p>
                    </div>

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger
                                value="login"
                                className="data-[state=active]:text-white data-[state=active]:bg-linear-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500"
                            >
                                Login
                            </TabsTrigger>
                            <TabsTrigger
                                value="register"
                                className="data-[state=active]:text-white data-[state=active]:bg-linear-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500"
                            >
                                Register
                            </TabsTrigger>
                        </TabsList>

                        {/* LOGIN */}
                        <TabsContent value="login">
                            <Card className="border-white/10 bg-slate-800/60 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-white">Login to your account</CardTitle>
                                    <CardDescription>Use your Book-Hive credentials</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loginError && (
                                        <Alert className="mb-4 bg-red-500/15 border-red-500/40 text-red-200">
                                            <AlertDescription>{loginError}</AlertDescription>
                                        </Alert>
                                    )}

                                    <form onSubmit={handleLogin} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-white">Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="you@example.com"
                                                    className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                    required
                                                    value={email}
                                                    onChange={handleEmailChange}
                                                    autoComplete="username"
                                                    autoCapitalize="none"
                                                    autoCorrect="off"
                                                    spellCheck={false}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="password" className="text-white">Password</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                <Input
                                                    id="password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    placeholder="••••••••"
                                                    className="pl-10 pr-10 bg-slate-900/70 border-white/10 text-white"
                                                    required
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    autoComplete="current-password"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-1.5 top-1.5 h-8 w-8 text-white/70 hover:text-white"
                                                    onClick={() => setShowPassword((s) => !s)}
                                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                    aria-pressed={showPassword}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="remember"
                                                    checked={rememberMe}
                                                    onCheckedChange={handleRememberToggle}
                                                />
                                                <Label htmlFor="remember" className="text-sm text-white/80">
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

                                        <Button
                                            type="submit"
                                            className="w-full text-white bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                            disabled={isLoggingIn}
                                        >
                                            {isLoggingIn ? 'Logging in…' : 'Login'}
                                        </Button>
                                    </form>
                                </CardContent>
                                <CardFooter className="flex justify-center border-t border-white/10">
                                    <p className="text-sm text-gray-300">
                                        Need help?{' '}
                                        <Link to="/contact#support" className="text-purple-300 hover:text-purple-200">
                                            Contact support
                                        </Link>
                                    </p>
                                </CardFooter>
                            </Card>
                        </TabsContent>

                        {/* REGISTER */}
                        <TabsContent value="register">
                            <Card className="border-white/10 bg-slate-800/60 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-white">Create an account</CardTitle>
                                    <CardDescription>Register to use Book-Hive</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {regError && (
                                        <Alert className="mb-4 bg-red-500/15 border-red-500/40 text-red-200">
                                            <AlertDescription>{regError}</AlertDescription>
                                        </Alert>
                                    )}

                                    <form className="space-y-4" onSubmit={handleRegister}>
                                        <div className="space-y-2">
                                            <Label htmlFor="fullname" className="text-white">Full Name</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                <Input
                                                    id="fullname"
                                                    placeholder="Juan Dela Cruz"
                                                    className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    required
                                                    autoComplete="name"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-white">Account Type</Label>
                                            <Select
                                                value={accountType}
                                                onValueChange={(v) => setAccountType(v as AccountType)}
                                            >
                                                <SelectTrigger className="bg-slate-900/70 border-white/10 text-white">
                                                    <SelectValue placeholder="Select account type" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-900 text-white border-white/10">
                                                    <SelectItem value="student">Student</SelectItem>
                                                    <SelectItem value="other">Other (Faculty/Staff/Guest)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {accountType === 'student' && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label htmlFor="student-id" className="text-white">
                                                        Student ID <span className="text-red-300">*</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <IdCard className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                        <Input
                                                            id="student-id"
                                                            placeholder="e.g., 2025-00123"
                                                            className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                            value={studentId}
                                                            onChange={(e) => setStudentId(e.target.value)}
                                                            required
                                                            autoComplete="off"
                                                            spellCheck={false}
                                                        />
                                                    </div>
                                                    {checkingStudentId ? (
                                                        <p className="text-xs text-white/60">Checking availability…</p>
                                                    ) : studentId && studentIdAvailable !== null ? (
                                                        <p
                                                            className={`text-xs ${studentIdAvailable ? 'text-emerald-300' : 'text-red-300'}`}
                                                        >
                                                            {studentIdAvailable ? 'Student ID is available' : 'Student ID is already taken'}
                                                        </p>
                                                    ) : null}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-white">
                                                        Course <span className="text-red-300">*</span>
                                                    </Label>
                                                    <Select
                                                        value={course || undefined}
                                                        onValueChange={(v) => setCourse(v as CourseName)}
                                                    >
                                                        <SelectTrigger className="bg-slate-900/70 border-white/10 text-white">
                                                            <SelectValue placeholder="Select course" />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-900 text-white border-white/10">
                                                            {COURSES.map((c) => (
                                                                <SelectItem key={c} value={c}>
                                                                    <div className="flex w-full items-center justify-between gap-2">
                                                                        <span>{c}</span>
                                                                        <span className="text-xs opacity-70">{COURSE_ACRONYM[c]}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-white">
                                                        Year Level <span className="text-red-300">*</span>
                                                    </Label>
                                                    <Select
                                                        value={yearLevel || undefined}
                                                        onValueChange={(v) => setYearLevel(v as YearLevel)}
                                                    >
                                                        <SelectTrigger className="bg-slate-900/70 border-white/10 text-white">
                                                            <SelectValue placeholder="Select year level" />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-900 text-white border-white/10">
                                                            {YEAR_LEVELS.map((y) => (
                                                                <SelectItem key={y} value={y}>
                                                                    {y}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </>
                                        )}

                                        <div className="space-y-2">
                                            <Label htmlFor="reg-email" className="text-white">Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                <Input
                                                    id="reg-email"
                                                    type="email"
                                                    placeholder="you@example.com"
                                                    className="pl-10 bg-slate-900/70 border-white/10 text-white"
                                                    value={regEmail}
                                                    onChange={(e) => setRegEmail(e.target.value)}
                                                    required
                                                    autoComplete="email"
                                                    autoCapitalize="none"
                                                    autoCorrect="off"
                                                    spellCheck={false}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="reg-password" className="text-white">Password</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                <Input
                                                    id="reg-password"
                                                    type={showRegPassword ? 'text' : 'password'}
                                                    placeholder="At least 8 characters"
                                                    className="pl-10 pr-10 bg-slate-900/70 border-white/10 text-white"
                                                    value={regPassword}
                                                    onChange={(e) => setRegPassword(e.target.value)}
                                                    required
                                                    autoComplete="new-password"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-1.5 top-1.5 h-8 w-8 text-white/70 hover:text-white"
                                                    onClick={() => setShowRegPassword((s) => !s)}
                                                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                                                    aria-pressed={showRegPassword}
                                                >
                                                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="confirm-password" className="text-white">Confirm Password</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                                                <Input
                                                    id="confirm-password"
                                                    type={showRegConfirm ? 'text' : 'password'}
                                                    placeholder="Repeat your password"
                                                    className="pl-10 pr-10 bg-slate-900/70 border-white/10 text-white"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    required
                                                    autoComplete="new-password"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-1.5 top-1.5 h-8 w-8 text-white/70 hover:text-white"
                                                    onClick={() => setShowRegConfirm((s) => !s)}
                                                    aria-label={showRegConfirm ? 'Hide password' : 'Show password'}
                                                    aria-pressed={showRegConfirm}
                                                >
                                                    {showRegConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full text-white bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                            disabled={isRegistering}
                                        >
                                            {isRegistering ? 'Creating account…' : 'Register'}
                                        </Button>
                                    </form>
                                </CardContent>
                                <CardFooter className="flex justify-center border-t border-white/10">
                                    <p className="text-sm text-gray-300">
                                        Already have an account?{' '}
                                        <button
                                            onClick={() => setActiveTab('login')}
                                            className="text-purple-300 hover:text-purple-200 underline bg-transparent border-none cursor-pointer"
                                        >
                                            Login
                                        </button>
                                    </p>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    {/* Terms */}
                    <p className="mt-6 text-center text-xs text-white/60">
                        By continuing, you agree to the acceptable use of the JRMSU-TC Book-Hive platform.
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
