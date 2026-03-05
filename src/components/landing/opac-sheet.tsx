import * as React from "react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { BookOpen, RefreshCw, Search } from "lucide-react"

import { fetchBooks, type BookDTO } from "@/lib/books"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

type AvailabilityFilter = "all" | "available" | "unavailable"

function fmt(value: unknown): string {
    if (value === null || value === undefined) return "—"
    if (typeof value === "string" && !value.trim()) return "—"
    return String(value)
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="space-y-1">
            <div className="text-xs text-white/60">{label}</div>
            <div className="text-sm text-white">{fmt(value)}</div>
        </div>
    )
}

export function OpacSheet({
    isAuthed,
    booksHref = "/dashboard/books",
}: {
    isAuthed: boolean
    booksHref?: string
}) {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [books, setBooks] = useState<BookDTO[]>([])

    const [query, setQuery] = useState("")
    const [availability, setAvailability] = useState<AvailabilityFilter>("all")

    const load = React.useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetchBooks()
            setBooks(Array.isArray(res) ? res : [])
        } catch (e) {
            const message =
                e instanceof Error ? e.message : "Failed to load OPAC books."
            setError(message)
            toast.error("Unable to load OPAC", {
                description: message,
            })
        } finally {
            setLoading(false)
        }
    }, [])

    const onOpenChange = (v: boolean) => {
        setOpen(v)
        if (v && books.length === 0 && !loading && !error) {
            void load()
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()

        let list = books

        if (availability !== "all") {
            const want = availability === "available"
            list = list.filter((b) => Boolean(b.available) === want)
        }

        if (q) {
            list = list.filter((b) => {
                const hay = [
                    b.title,
                    b.subtitle,
                    b.author,
                    b.isbn,
                    b.issn,
                    b.accessionNumber,
                    b.subjects,
                    b.genre,
                    b.category,
                    b.publisher,
                    b.placeOfPublication,
                    b.callNumber,
                    b.barcode,
                    b.libraryArea,
                    b.notes,
                    b.otherDetails,
                    b.series,
                    b.addedEntries,
                ]
                    .filter(Boolean)
                    .join(" • ")
                    .toLowerCase()

                return hay.includes(q)
            })
        }

        // Stable, user-friendly ordering
        return [...list].sort((a, b) =>
            (a.title || "").localeCompare(b.title || "", undefined, {
                sensitivity: "base",
            })
        )
    }, [books, query, availability])

    const countLabel = useMemo(() => {
        if (loading) return "Loading…"
        if (error) return "—"
        return `${filtered.length} result${filtered.length === 1 ? "" : "s"}`
    }, [loading, error, filtered.length])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                <Button
                    variant="secondary"
                    className="h-9 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10"
                >
                    <BookOpen className="mr-2 h-4 w-4" />
                    OPAC
                </Button>
            </SheetTrigger>

            <SheetContent
                side="right"
                className="w-full sm:max-w-lg bg-slate-950 border-white/10 text-white"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-lg font-semibold tracking-tight">OPAC</div>
                        <div className="text-sm text-white/70">
                            Browse the library catalog (no login required).
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => void load()}
                        disabled={loading}
                        aria-label="Refresh OPAC"
                        title="Refresh"
                    >
                        <RefreshCw className={loading ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
                    </Button>
                </div>

                <Separator className="my-4 bg-white/10" />

                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search title, author, ISBN, subject…"
                            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={availability === "all" ? "secondary" : "ghost"}
                            className="rounded-xl"
                            onClick={() => setAvailability("all")}
                        >
                            All
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={availability === "available" ? "secondary" : "ghost"}
                            className="rounded-xl"
                            onClick={() => setAvailability("available")}
                        >
                            Available
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={availability === "unavailable" ? "secondary" : "ghost"}
                            className="rounded-xl"
                            onClick={() => setAvailability("unavailable")}
                        >
                            Unavailable
                        </Button>

                        <div className="ml-auto text-xs text-white/60">{countLabel}</div>
                    </div>
                </div>

                <Separator className="my-4 bg-white/10" />

                <ScrollArea className="h-[calc(100vh-240px)] pr-3">
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <Card
                                    key={i}
                                    className="bg-white/5 border-white/10 rounded-2xl"
                                >
                                    <CardContent className="p-4 space-y-3">
                                        <Skeleton className="h-4 w-3/4 bg-white/10" />
                                        <Skeleton className="h-3 w-1/2 bg-white/10" />
                                        <Skeleton className="h-3 w-2/3 bg-white/10" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : error ? (
                        <Card className="bg-white/5 border-white/10 rounded-2xl">
                            <CardContent className="p-5 space-y-3">
                                <div className="text-sm text-white/80">
                                    {error || "Something went wrong."}
                                </div>
                                <Button
                                    className="rounded-xl"
                                    onClick={() => void load()}
                                >
                                    Retry
                                </Button>
                            </CardContent>
                        </Card>
                    ) : filtered.length === 0 ? (
                        <Card className="bg-white/5 border-white/10 rounded-2xl">
                            <CardContent className="p-5 space-y-2">
                                <div className="font-medium">No books found</div>
                                <div className="text-sm text-white/70">
                                    Try a different keyword or switch filters.
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Accordion type="multiple" className="space-y-3">
                            {filtered.map((b) => {
                                const availableCount =
                                    typeof b.numberOfCopies === "number"
                                        ? b.numberOfCopies
                                        : null
                                const totalCount =
                                    typeof b.totalCopies === "number" ? b.totalCopies : null

                                return (
                                    <AccordionItem
                                        key={b.id}
                                        value={b.id}
                                        className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                                    >
                                        <AccordionTrigger className="px-4 py-4 text-left hover:no-underline">
                                            <div className="w-full">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-white truncate">
                                                            {b.title}
                                                        </div>
                                                        <div className="text-sm text-white/70 truncate">
                                                            {b.author}
                                                            {b.publicationYear
                                                                ? ` • ${b.publicationYear}`
                                                                : ""}
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 flex items-center gap-2">
                                                        <Badge
                                                            variant={b.available ? "secondary" : "outline"}
                                                            className="rounded-xl"
                                                        >
                                                            {b.available ? "Available" : "Not available"}
                                                        </Badge>
                                                        {availableCount !== null || totalCount !== null ? (
                                                            <Badge variant="outline" className="rounded-xl">
                                                                {availableCount !== null
                                                                    ? `Avail: ${availableCount}`
                                                                    : "Avail: —"}
                                                                {totalCount !== null ? ` / ${totalCount}` : ""}
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionTrigger>

                                        <AccordionContent className="px-4 pb-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <InfoRow label="Subtitle" value={b.subtitle} />
                                                <InfoRow label="Edition" value={b.edition} />
                                                <InfoRow label="ISBN" value={b.isbn} />
                                                <InfoRow label="ISSN" value={b.issn} />
                                                <InfoRow
                                                    label="Accession No."
                                                    value={b.accessionNumber}
                                                />
                                                <InfoRow label="Subjects" value={b.subjects} />
                                                <InfoRow label="Genre" value={b.genre} />
                                                <InfoRow label="Category" value={b.category} />
                                                <InfoRow
                                                    label="Publisher"
                                                    value={b.publisher}
                                                />
                                                <InfoRow
                                                    label="Place of Publication"
                                                    value={b.placeOfPublication}
                                                />
                                                <InfoRow
                                                    label="Copyright Year"
                                                    value={b.copyrightYear}
                                                />
                                                <InfoRow
                                                    label="Call Number"
                                                    value={b.callNumber}
                                                />
                                                <InfoRow label="Barcode" value={b.barcode} />
                                                <InfoRow
                                                    label="Copy Number"
                                                    value={b.copyNumber}
                                                />
                                                <InfoRow
                                                    label="Volume Number"
                                                    value={b.volumeNumber}
                                                />
                                                <InfoRow
                                                    label="Library Area"
                                                    value={b.libraryArea}
                                                />
                                                <InfoRow label="Pages" value={b.pages} />
                                                <InfoRow
                                                    label="Dimensions"
                                                    value={b.dimensions}
                                                />
                                                <InfoRow label="Series" value={b.series} />
                                                <InfoRow
                                                    label="Added Entries"
                                                    value={b.addedEntries}
                                                />
                                            </div>

                                            {(b.otherDetails || b.notes) && (
                                                <div className="mt-4 space-y-3">
                                                    <Separator className="bg-white/10" />
                                                    {b.otherDetails ? (
                                                        <div className="space-y-1">
                                                            <div className="text-xs text-white/60">
                                                                Other Details
                                                            </div>
                                                            <div className="text-sm text-white/80">
                                                                {b.otherDetails}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    {b.notes ? (
                                                        <div className="space-y-1">
                                                            <div className="text-xs text-white/60">
                                                                Notes
                                                            </div>
                                                            <div className="text-sm text-white/80">
                                                                {b.notes}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}

                                            <div className="mt-5 flex flex-col sm:flex-row gap-2">
                                                {!isAuthed ? (
                                                    <SheetClose asChild>
                                                        <Button
                                                            className="rounded-xl"
                                                            onClick={() => {
                                                                toast("Login required", {
                                                                    description:
                                                                        "Please login to reserve or manage borrows.",
                                                                })
                                                                navigate("/auth")
                                                            }}
                                                        >
                                                            Login to Reserve
                                                        </Button>
                                                    </SheetClose>
                                                ) : (
                                                    <SheetClose asChild>
                                                        <Button
                                                            className="rounded-xl"
                                                            onClick={() => navigate(booksHref)}
                                                        >
                                                            Open Books Page
                                                        </Button>
                                                    </SheetClose>
                                                )}

                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl border-white/15 bg-white/5 hover:bg-white/10"
                                                    onClick={() => {
                                                        const text = [
                                                            b.title ? `Title: ${b.title}` : null,
                                                            b.author ? `Author: ${b.author}` : null,
                                                            b.isbn ? `ISBN: ${b.isbn}` : null,
                                                            b.callNumber ? `Call No.: ${b.callNumber}` : null,
                                                        ]
                                                            .filter(Boolean)
                                                            .join("\n")

                                                        if (!text) {
                                                            toast("Nothing to copy")
                                                            return
                                                        }

                                                        void navigator.clipboard
                                                            .writeText(text)
                                                            .then(() => toast.success("Copied book info"))
                                                            .catch(() =>
                                                                toast.error("Copy failed", {
                                                                    description:
                                                                        "Your browser blocked clipboard access.",
                                                                })
                                                            )
                                                    }}
                                                >
                                                    Copy Info
                                                </Button>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )
                            })}
                        </Accordion>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}