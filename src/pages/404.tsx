import { Link, useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import logo from "@/assets/images/logo.svg"

export default function NotFoundPage() {
    const navigate = useNavigate()
    const { pathname } = useLocation()

    const subject = "Help with Book-Hive (404 Not Found)"
    const body = `Hi Support,

I'm seeing a 404 on this path:
${pathname}

Steps I took:
1. 
2. 

Expected result:
Actual result:

Thanks!`

    const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=support@example.com&su=${encodeURIComponent(
        subject
    )}&body=${encodeURIComponent(body)}`

    return (
        <div className="support-scroll min-h-screen w-full bg-slate-900 text-white flex flex-col">
            {/* Top bar with back link and brand */}
            <header className="container mx-auto py-6 px-4 flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center cursor-pointer gap-2 text-white/90 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span className="hidden md:inline">Back</span>
                </button>

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
                <div className="w-full max-w-lg">
                    <div className="text-center mb-8">
                        <div className="text-7xl font-extrabold leading-none tracking-tight">404</div>
                        <p className="mt-2 text-white/70">Page not found</p>
                    </div>

                    <Card className="border-white/10 bg-slate-800/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-white">We can’t find that page</CardTitle>
                            <CardDescription>
                                {pathname ? (
                                    <span>
                                        The path{" "}
                                        <code className="px-1 py-0.5 rounded bg-black/30 text-white">
                                            {pathname}
                                        </code>{" "}
                                        doesn’t exist or may have been moved.
                                    </span>
                                ) : (
                                    "The page you’re looking for doesn’t exist or may have been moved."
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    asChild
                                    className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                                >
                                    <Link to="/" className="inline-flex items-center gap-2">
                                        <Home className="h-4 w-4" />
                                        <span>Go Home</span>
                                    </Link>
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => navigate(-1)}
                                    className="border-white/15 text-black/90 hover:text-white hover:bg-black/10"
                                >
                                    Try previous page
                                </Button>

                                <Button
                                    variant="ghost"
                                    asChild
                                    className="text-purple-300 hover:text-purple-950"
                                >
                                    {/* Opens Gmail compose in a new tab */}
                                    <a href={gmailHref} target="_blank" rel="noopener noreferrer">
                                        Contact support via Gmail
                                    </a>
                                </Button>
                            </div>

                            <p className="mt-4 text-xs text-white/60">
                                Tip: If you refreshed a deep link, go Home and navigate from there.
                            </p>
                        </CardContent>
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
