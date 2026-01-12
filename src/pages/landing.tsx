import React, { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
    ArrowRight,
    Calendar,
    Clock,
    ShieldCheck,
    Search,
    QrCode,
    ListChecks,
    Menu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion"

import logo from "@/assets/images/logo.svg"
import heroImg from "@/assets/images/hero.svg"
import { me as apiMe } from "@/lib/authentication"

// Wider page wrapper (replaces Tailwind `container` so sections take more space)
const PAGE_WRAP = "mx-auto w-full px-12"

// --- Small presentational helpers (kept local to avoid extra files) ---
function SectionHeading({
    title,
    description,
    className = "",
}: {
    title: string
    description?: string
    className?: string
}) {
    return (
        <div className={`text-center px-12 mx-auto ${className}`}>
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

    // ✅ default to /dashboard (student & other both use this)
    const [dashboardHref, setDashboardHref] = useState("/dashboard")

    const [sheetOpen, setSheetOpen] = useState(false) // controls Sheet and icon animation

    useEffect(() => {
        let cancelled = false

            ; (async () => {
                const user = await apiMe()
                if (cancelled || !user) return

                setIsAuthed(true)

                // ✅ Route user to their own dashboard based on accountType
                switch (user.accountType) {
                    case "student":
                    case "other":
                        // student & other share the same dashboard root
                        setDashboardHref("/dashboard")
                        break
                    case "librarian":
                        setDashboardHref("/dashboard/librarian")
                        break
                    case "faculty":
                        setDashboardHref("/dashboard/faculty")
                        break
                    case "admin":
                        setDashboardHref("/dashboard/admin")
                        break
                    default:
                        // Fallback for unknown types
                        setDashboardHref("/dashboard")
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

            {/* Header (sticky) */}
            <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-white/10">
                <div className={`${PAGE_WRAP} py-5`}>
                    <nav className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-2 group">
                            <img
                                src={logo}
                                alt="JRMSU-TC Book-Hive logo"
                                className="h-10 w-10 rounded-md object-contain"
                            />
                            <span className="font-semibold tracking-tight group-hover:text-white/90">
                                JRMSU-TC Book-Hive
                            </span>
                        </Link>

                        {/* Desktop nav */}
                        <div className="hidden md:flex items-center gap-6 text-sm text-white/80">
                            <a href="#features" className="hover:text-white">
                                Features
                            </a>
                            <a href="#how-it-works" className="hover:text-white">
                                How it works
                            </a>
                            <a href="#faq" className="hover:text-white">
                                FAQ
                            </a>
                        </div>

                        {/* Desktop CTA */}
                        <div className="hidden md:flex items-center gap-3">
                            {!isAuthed ? (
                                <Button
                                    className="text-white cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                    onClick={() => navigate("/auth")}
                                >
                                    Login / Register
                                </Button>
                            ) : (
                                <Button
                                    className="text-white cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                    onClick={() => navigate(dashboardHref)}
                                >
                                    Go to Dashboard
                                </Button>
                            )}
                        </div>

                        {/* Mobile: Sheet menu (slides from TOP, contains Login/Register or Dashboard) */}
                        <div className="md:hidden">
                            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                                <SheetTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-xl group"
                                        aria-expanded={sheetOpen}
                                    >
                                        <Menu
                                            className={[
                                                "h-6 w-6 transform transition-transform duration-300",
                                                "group-hover:scale-110",
                                                sheetOpen ? "rotate-90 scale-110" : "rotate-0",
                                            ].join(" ")}
                                        />
                                        <span className="sr-only">Open menu</span>
                                    </Button>
                                </SheetTrigger>

                                <SheetContent
                                    side="top"
                                    className="w-full p-6 sm:p-8 bg-slate-900 border-white/10 text-white rounded-b-2xl"
                                >
                                    <div className="w-full">
                                        <div className="mb-4 space-y-2 text-sm text-white/80">
                                            <a href="#features" className="block hover:text-white">
                                                Features
                                            </a>
                                            <a
                                                href="#how-it-works"
                                                className="block hover:text-white"
                                            >
                                                How it works
                                            </a>
                                            <a href="#faq" className="block hover:text-white">
                                                FAQ
                                            </a>
                                        </div>

                                        <SheetClose asChild>
                                            <Button
                                                className="text-white w-full cursor-pointer mt-2 bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                                onClick={() =>
                                                    navigate(isAuthed ? dashboardHref : "/auth")
                                                }
                                            >
                                                {isAuthed
                                                    ? "Go to Dashboard"
                                                    : "Login / Register"}
                                            </Button>
                                        </SheetClose>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="w-full pt-10 pb-20">
                <div className={PAGE_WRAP}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                                Borrow books{" "}
                                <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-400">
                                    online
                                </span>{" "}
                                and save time.
                            </h1>
                            <p className="mt-4 text-white/80 text-lg">
                                Book-Hive is JRMSU-TC’s web-based library platform for{" "}
                                <span className="font-semibold">
                                    real-time availability and online reservations
                                </span>
                                . Find, reserve, and pick up your books with ease.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-3">
                                {!isAuthed ? (
                                    <Button
                                        size="lg"
                                        className="text-white cursor-pointer px-7 py-6 text-base bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                        onClick={() => navigate("/auth")}
                                    >
                                        Get Started
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                ) : (
                                    <Button
                                        size="lg"
                                        className=" text-white cursor-pointer px-7 py-6 text-base bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
                                    <Clock className="h-4 w-4" /> Fast reservations
                                </li>
                                <li className="flex items-center gap-2">
                                    <Search className="h-4 w-4" /> Easy catalog search
                                </li>
                            </ul>
                        </div>

                        {/* Illustration / hero image */}
                        <div className="relative">
                            <div className="absolute -inset-1 rounded-xl bg-linear-to-r from-purple-500 to-pink-500 opacity-70 blur" />
                            <div className="relative rounded-xl bg-slate-900/80 border border-white/10 p-4">
                                <img
                                    src={heroImg}
                                    alt="Book-Hive hero"
                                    className="w-full h-auto rounded-md object-cover"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="w-full pb-20">
                <div className={PAGE_WRAP}>
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
                            description="Book your copy online and pick it up at your chosen time."
                        />
                        <FeatureCard
                            icon={ListChecks}
                            title="Borrowing Management"
                            description="See which books you’ve borrowed and when they’re due in one place."
                        />
                        <FeatureCard
                            icon={QrCode}
                            title="Student ID Verification"
                            description="Present your student ID at the counter for quick verification and release."
                        />
                        <FeatureCard
                            icon={ShieldCheck}
                            title="Secure & Private"
                            description="Role-based access, protected data, and safe transactions."
                        />
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="w-full pb-20">
                <div className={PAGE_WRAP}>
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
                                title="Confirm Reservation"
                                description="Review your reservation details and pickup schedule in the app."
                            />
                            <StepItem
                                number={4}
                                title="Pick Up & Borrow"
                                description="Show your student ID at the counter and enjoy your book."
                                isLast
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Call to action */}
            <section className="w-full pb-24">
                <div className={PAGE_WRAP}>
                    <div className="text-center">
                        <SectionHeading
                            title="Ready to get started?"
                            description="Experience easier access, clearer availability, and smoother borrowing."
                            className="mb-6"
                        />
                        <Button
                            size="lg"
                            className="text-white cursor-pointer px-8 py-6 text-base bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                            onClick={() => navigate(isAuthed ? dashboardHref : "/auth")}
                        >
                            {isAuthed ? "Go to Dashboard" : "Login / Register"}
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* FAQ — shadcn/ui Accordion */}
            <section id="faq" className="w-full pb-24">
                <div className={PAGE_WRAP}>
                    <SectionHeading title="FAQs" className="mb-8" />
                    <Accordion type="single" collapsible className="mx-auto px-16">
                        <AccordionItem
                            value="item-1"
                            className="mb-3 rounded-xl border-white/10 bg-slate-800/60 backdrop-blur"
                        >
                            <AccordionTrigger className="px-4 text-left text-white hover:no-underline">
                                Do I need to visit the library to complete a reservation?
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 text-white/70">
                                Reserve online; you’ll only visit to pick up or return the
                                item.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem
                            value="item-2"
                            className="mb-3 rounded-xl border-white/10 bg-slate-800/60 backdrop-blur"
                        >
                            <AccordionTrigger className="px-4 text-left text-white hover:no-underline">
                                Can I see if a book is currently borrowed?
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 text-white/70">
                                Yes. Availability is shown in real time, and you can borrow
                                the book once it becomes available again.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 border-t border-white/10">
                <div
                    className={`${PAGE_WRAP} flex flex-col md:flex-row items-center justify-between gap-4 text-white/70 text-sm`}
                >
                    <p>© {new Date().getFullYear()} JRMSU-TC — Book-Hive</p>
                    <div className="flex items-center gap-6">
                        <a href="#features" className="hover:text-white">
                            Features
                        </a>
                        <a href="#how-it-works" className="hover:text-white">
                            How it works
                        </a>
                        {isAuthed ? (
                            <Link to={dashboardHref} className="hover:text-white">
                                Dashboard
                            </Link>
                        ) : (
                            <Link to="/auth" className="hover:text-white">
                                Login
                            </Link>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    )
}
