// src/pages/landing.tsx
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    ArrowRight,
    Calendar,
    Bell,
    Clock,
    ShieldCheck,
    Search,
    QrCode,
    ListChecks,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import logo from '@/assets/images/logo.png'
import heroImg from '@/assets/images/hero.png'

// --- Small presentational helpers (kept local to avoid extra files) ---
function SectionHeading({
    title,
    description,
    className = '',
}: {
    title: string
    description?: string
    className?: string
}) {
    return (
        <div className={`text-center max-w-3xl mx-auto ${className}`}>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                {title}
            </h2>
            {description ? (
                <p className="mt-3 text-base md:text-lg text-white/70">{description}</p>
            ) : null}
        </div>
    )
}

function FeatureCard({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    title: string
    description: string
}) {
    return (
        <Card className="bg-slate-800/60 border-white/10 backdrop-blur">
            <CardHeader className="flex flex-row items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-linear-to-tr from-purple-500 to-pink-500 grid place-items-center">
                    <Icon className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-white text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <CardDescription className="text-white/70">{description}</CardDescription>
            </CardContent>
        </Card>
    )
}

function StepItem({
    number,
    title,
    description,
    isLast = false,
}: {
    number: number
    title: string
    description: string
    isLast?: boolean
}) {
    return (
        <div className="relative">
            <div className="flex items-start gap-4">
                <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-linear-to-tr from-purple-500 to-pink-500 text-white grid place-items-center font-semibold">
                        {number}
                    </div>
                    {!isLast && (
                        <div className="absolute left-1/2 -bottom-6 -translate-x-1/2 h-6 w-0.5 bg-white/15" />
                    )}
                </div>
                <div>
                    <h4 className="text-white font-semibold">{title}</h4>
                    <p className="text-white/70 text-sm">{description}</p>
                </div>
            </div>
        </div>
    )
}

// --- Page ---
export default function LandingPage() {
    const navigate = useNavigate()
    const [isAuthed, setIsAuthed] = useState(false)
    const [dashboardHref, setDashboardHref] = useState('/dashboard/student')

    // Best-effort session check (safe if /api/auth/me is not implemented yet)
    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const res = await fetch('/api/auth/me', { credentials: 'include' })
                    if (!res.ok) return
                    const me = (await res.json()) as { role?: string } | null
                    if (!cancelled && me) {
                        setIsAuthed(true)
                        // Basic role→dashboard mapping; extend as your backend supports more roles
                        const role = (me.role || 'student').toLowerCase()
                        if (role === 'student') setDashboardHref('/dashboard/student')
                        else setDashboardHref('/dashboard') // fallback
                    }
                } catch {
                    // ignore; remain logged-out UI
                }
            })()
        return () => {
            cancelled = true
        }
    }, [])

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Gradient background flourish */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
            >
                <div className="absolute -top-24 left-1/2 h-72 w-xl -translate-x-1/2 rounded-full bg-purple-600/20 blur-3xl" />
                <div className="absolute top-1/3 -left-10 h-72 w-md rounded-full bg-pink-600/20 blur-3xl" />
            </div>

            {/* Header */}
            <header className="container mx-auto px-4 py-5">
                <nav className="flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 group">
                        <img
                            src={logo}
                            alt="JRMSU-TC Book-Hive logo"
                            className="h-8 w-8 rounded-md object-contain"
                        />
                        <span className="font-semibold tracking-tight group-hover:text-white/90">
                            JRMSU-TC Book-Hive
                        </span>
                    </Link>

                    <div className="hidden md:flex items-center gap-6 text-sm text-white/80">
                        <a href="#features" className="hover:text-white">Features</a>
                        <a href="#how-it-works" className="hover:text-white">How it works</a>
                        <a href="#faq" className="hover:text-white">FAQ</a>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isAuthed ? (
                            <Button
                                className="bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                onClick={() => navigate('/auth')}
                            >
                                Login / Register
                            </Button>
                        ) : (
                            <Button
                                className="bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                onClick={() => navigate(dashboardHref)}
                            >
                                Go to Dashboard
                            </Button>
                        )}
                    </div>
                </nav>
            </header>

            {/* Hero */}
            <section className="container mx-auto px-4 pt-10 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                            Borrow books{' '}
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-400">
                                online
                            </span>{' '}
                            and skip the queue.
                        </h1>
                        <p className="mt-4 text-white/80 text-lg">
                            Book-Hive is JRMSU-TC’s web-based library platform for{' '}
                            <span className="font-semibold">real-time availability, reservations, smart queuing</span>, and{' '}
                            <span className="font-semibold">notifications</span>. Find, reserve, and pick up your books with ease.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            {!isAuthed ? (
                                <Button
                                    size="lg"
                                    className="px-7 py-6 text-base bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                    onClick={() => navigate('/auth')}
                                >
                                    Get Started
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            ) : (
                                <Button
                                    size="lg"
                                    className="px-7 py-6 text-base bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                    onClick={() => navigate(dashboardHref)}
                                >
                                    Go to Dashboard
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            )}

                            <a
                                href="#features"
                                className="inline-flex items-center text-white/80 hover:text-white"
                            >
                                Learn more
                            </a>
                        </div>

                        {/* Quick value bullets */}
                        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-white/70">
                            <li className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Secure accounts
                            </li>
                            <li className="flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Reduced waiting time
                            </li>
                            <li className="flex items-center gap-2">
                                <Bell className="h-4 w-4" /> Timely reminders
                            </li>
                        </ul>
                    </div>

                    {/* Illustration / hero image */}
                    <div className="relative">
                        <div className="absolute -inset-1 rounded-xl bg-linear-to-r from-purple-500 to-pink-500 opacity-70 blur"></div>
                        <div className="relative rounded-xl bg-slate-900/80 border border-white/10 p-4">
                            <img
                                src={heroImg}
                                alt="Book-Hive hero"
                                className="w-full h-auto rounded-md object-cover"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="container mx-auto px-4 pb-20">
                <SectionHeading
                    title="Why choose Book-Hive?"
                    description="A faster, clearer, and smarter way to access library resources."
                    className="mb-10"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={Search}
                        title="Real-time Availability"
                        description="Search the catalog and instantly see which titles are available across sections."
                    />
                    <FeatureCard
                        icon={Calendar}
                        title="Reserve Ahead"
                        description="Book your copy online and pick it up at your chosen time—no more long lines."
                    />
                    <FeatureCard
                        icon={ListChecks}
                        title="Smart Queue"
                        description="Join queues digitally and track your turn from your phone or laptop."
                    />
                    <FeatureCard
                        icon={Bell}
                        title="Reminders & Notices"
                        description="Get notified about reservations, due dates, and returned items."
                    />
                    <FeatureCard
                        icon={QrCode}
                        title="QR-Based Pick-up"
                        description="Present your QR code at the counter for quick verification and release."
                    />
                    <FeatureCard
                        icon={ShieldCheck}
                        title="Secure & Private"
                        description="Role-based access, protected data, and safe transactions."
                    />
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="container mx-auto px-4 pb-20">
                <div className="rounded-2xl border border-white/10 bg-linear-to-r from-purple-900/30 to-pink-900/30 p-8">
                    <SectionHeading title="How it works" className="mb-8" />
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <StepItem
                            number={1}
                            title="Login / Register"
                            description="Create your account or sign in with your student email."
                        />
                        <StepItem
                            number={2}
                            title="Search & Reserve"
                            description="Find the book, check availability, and place a reservation."
                        />
                        <StepItem
                            number={3}
                            title="Get Notified"
                            description="Receive confirmation and pick-up details via notifications."
                        />
                        <StepItem
                            number={4}
                            title="Pick Up & Borrow"
                            description="Show your QR at the counter and enjoy your book."
                            isLast
                        />
                    </div>
                </div>
            </section>

            {/* Call to action */}
            <section className="container mx-auto px-4 pb-24">
                <div className="text-center">
                    <SectionHeading
                        title="Ready to get started?"
                        description="Experience shorter queues, clearer availability, and smoother borrowing."
                        className="mb-6"
                    />
                    <Button
                        size="lg"
                        className="px-8 py-6 text-base bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        onClick={() => navigate(isAuthed ? dashboardHref : '/auth')}
                    >
                        {isAuthed ? 'Go to Dashboard' : 'Login / Register'}
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </section>

            {/* Simple FAQ (no extra components; lean markup) */}
            <section id="faq" className="container mx-auto px-4 pb-24">
                <SectionHeading title="FAQs" className="mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-800/60 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white text-base">
                                Do I need to visit the library to complete a reservation?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-white/70 text-sm">
                            Reserve online; you’ll only visit to pick up or return the item. You’ll receive reminders for due dates.
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/60 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white text-base">
                                Can I see if a book is currently borrowed?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-white/70 text-sm">
                            Yes. Availability is shown in real time. If a title is out, you can join the waitlist and get notified.
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 border-t border-white/10">
                <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-white/70 text-sm">
                    <p>© {new Date().getFullYear()} JRMSU-TC — Book-Hive</p>
                    <div className="flex items-center gap-6">
                        <a href="#features" className="hover:text-white">Features</a>
                        <a href="#how-it-works" className="hover:text-white">How it works</a>
                        <Link to="/auth" className="hover:text-white">Login</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
