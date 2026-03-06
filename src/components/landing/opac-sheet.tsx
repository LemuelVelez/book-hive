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

type CatalogGroup = {
    key: string
    title: string
    author: string
    callNumber: string
    publicationYear?: number | string | null
    subtitle?: string | null
    availableAny: boolean
    items: BookDTO[]
}

function fmt(value: unknown): string {
    if (value === null || value === undefined) return "—"
    if (typeof value === "string" && !value.trim()) return "—"
    return String(value)
}

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(" ")
    if (typeof value === "string") return value.trim().toLowerCase().replace(/\s+/g, " ")
    return String(value).trim().toLowerCase().replace(/\s+/g, " ")
}

function tokenizeQuery(query: string): string[] {
    return normalizeText(query).split(/\s+/).map((t) => t.trim()).filter(Boolean)
}

function buildBookSearchText(b: BookDTO): string {
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
        b.publicationYear,
        b.copyrightYear,
        b.copyNumber,
        b.volumeNumber,
        b.pages,
        b.dimensions,
    ]
        .map(normalizeText)
        .filter(Boolean)
        .join(" ")

    return hay
}

function matchesTokens(hay: string, tokens: string[]): boolean {
    if (tokens.length === 0) return true
    return tokens.every((t) => hay.includes(t))
}

function buildCatalogKey(b: BookDTO): string {
    const callNo = normalizeText(b.callNumber)
    const title = normalizeText(b.title)
    const author = normalizeText(b.author)

    const key =
        [callNo, title, author].filter(Boolean).join("|") ||
        [title, author].filter(Boolean).join("|") ||
        normalizeText(b.id)

    return key || normalizeText(b.id)
}

function groupToCatalog(list: BookDTO[]): CatalogGroup[] {
    const map = new Map<string, CatalogGroup>()

    for (const b of list) {
        const key = buildCatalogKey(b)
        const existing = map.get(key)

        if (!existing) {
            map.set(key, {
                key,
                title: b.title || "Untitled",
                subtitle: b.subtitle ?? null,
                author: b.author || "—",
                callNumber: b.callNumber || "—",
                publicationYear: b.publicationYear ?? null,
                availableAny: Boolean(b.available),
                items: [b],
            })
        } else {
            existing.items.push(b)
            existing.availableAny = existing.availableAny || Boolean(b.available)

            if (!existing.callNumber || existing.callNumber === "—") {
                existing.callNumber = b.callNumber || existing.callNumber
            }
            if (!existing.author || existing.author === "—") {
                existing.author = b.author || existing.author
            }
            if (!existing.title || existing.title === "Untitled") {
                existing.title = b.title || existing.title
            }
            if (!existing.publicationYear && b.publicationYear) {
                existing.publicationYear = b.publicationYear
            }
        }
    }

    return Array.from(map.values()).sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
    )
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="space-y-1 rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <div className="text-xs text-white/60">{label}</div>
            <div className="wrap-break-word whitespace-normal text-sm text-white">{fmt(value)}</div>
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
            const message = e instanceof Error ? e.message : "Failed to load OPAC books."
            setError(message)
            toast.error("Unable to load OPAC", { description: message })
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

    const filteredRecords = useMemo(() => {
        const tokens = tokenizeQuery(query)

        let list = books

        if (availability !== "all") {
            const want = availability === "available"
            list = list.filter((b) => Boolean(b.available) === want)
        }

        if (tokens.length > 0) {
            list = list.filter((b) => matchesTokens(buildBookSearchText(b), tokens))
        }

        return [...list].sort((a, b) => {
            const callCmp = normalizeText(a.callNumber).localeCompare(normalizeText(b.callNumber), undefined, {
                sensitivity: "base",
            })
            if (callCmp !== 0) return callCmp

            const titleCmp = normalizeText(a.title).localeCompare(normalizeText(b.title), undefined, {
                sensitivity: "base",
            })
            if (titleCmp !== 0) return titleCmp

            return normalizeText(a.author).localeCompare(normalizeText(b.author), undefined, {
                sensitivity: "base",
            })
        })
    }, [books, query, availability])

    const groupedCatalog = useMemo(() => groupToCatalog(filteredRecords), [filteredRecords])

    const countLabel = useMemo(() => {
        if (loading) return "Loading…"
        if (error) return "—"
        const titles = groupedCatalog.length
        const records = filteredRecords.length
        return `${titles} title${titles === 1 ? "" : "s"} • ${records} record${records === 1 ? "" : "s"}`
    }, [loading, error, groupedCatalog.length, filteredRecords.length])

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
                className="w-full sm:max-w-xl bg-slate-950 border-white/10 text-white p-0"
            >
                <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-6 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                            <div className="text-lg font-semibold tracking-tight">OPAC</div>
                            <div className="text-sm text-white/70">
                                Browse the library catalog (no login required).
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl shrink-0"
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
                                placeholder="Search keyword, title, author, acc no., call no., ISBN…"
                                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl"
                                autoComplete="off"
                            />
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
                            </div>

                            <div className="text-xs text-white/60 sm:ml-auto sm:text-right">{countLabel}</div>
                        </div>
                    </div>

                    <Separator className="my-4 bg-white/10" />

                    <ScrollArea className="min-h-0 flex-1">
                        <div className="space-y-3 pr-3">
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 7 }).map((_, i) => (
                                        <Card key={i} className="bg-white/5 border-white/10 rounded-2xl">
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
                                        <div className="text-sm text-white/80">{error || "Something went wrong."}</div>
                                        <Button className="rounded-xl" onClick={() => void load()}>
                                            Retry
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : groupedCatalog.length === 0 ? (
                                <Card className="bg-white/5 border-white/10 rounded-2xl">
                                    <CardContent className="p-5 space-y-2">
                                        <div className="font-medium">No titles found</div>
                                        <div className="text-sm text-white/70">
                                            Try a different keyword (e.g., “cooking”) or switch filters.
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Accordion type="multiple" className="space-y-3">
                                    {groupedCatalog.map((g) => {
                                        const primary = g.items[0]

                                        const hasCounts =
                                            g.items.some(
                                                (x) =>
                                                    typeof x.totalCopies === "number" ||
                                                    typeof x.numberOfCopies === "number"
                                            ) &&
                                            (typeof primary.totalCopies === "number" ||
                                                typeof primary.numberOfCopies === "number")

                                        const availCount =
                                            typeof primary.numberOfCopies === "number" ? primary.numberOfCopies : null
                                        const totalCount =
                                            typeof primary.totalCopies === "number" ? primary.totalCopies : null

                                        const metaLine = [
                                            g.author,
                                            g.publicationYear ? String(g.publicationYear) : null,
                                            g.callNumber && g.callNumber !== "—" ? g.callNumber : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" • ")

                                        return (
                                            <AccordionItem
                                                key={g.key}
                                                value={g.key}
                                                className="rounded-2xl border border-white/10 bg-white/5"
                                            >
                                                <AccordionTrigger className="px-4 py-4 text-left hover:no-underline">
                                                    <div className="flex w-full min-w-0 flex-col gap-3 pr-4">
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="wrap-break-word whitespace-normal font-semibold text-white">
                                                                {g.title}
                                                            </div>
                                                            <div className="wrap-break-word whitespace-normal text-sm text-white/70">
                                                                {metaLine || "—"}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge
                                                                variant={g.availableAny ? "secondary" : "outline"}
                                                                className="rounded-xl"
                                                            >
                                                                {g.availableAny ? "Available" : "Not available"}
                                                            </Badge>

                                                            {hasCounts && (availCount !== null || totalCount !== null) ? (
                                                                <Badge variant="outline" className="rounded-xl">
                                                                    {availCount !== null ? `Avail: ${availCount}` : "Avail: —"}
                                                                    {totalCount !== null ? ` / ${totalCount}` : ""}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="rounded-xl">
                                                                    {g.items.length} record{g.items.length === 1 ? "" : "s"}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>

                                                <AccordionContent className="px-4 pb-4">
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                        <InfoRow label="Subtitle" value={primary.subtitle} />
                                                        <InfoRow label="Edition" value={primary.edition} />
                                                        <InfoRow label="ISBN" value={primary.isbn} />
                                                        <InfoRow label="ISSN" value={primary.issn} />
                                                        <InfoRow label="Accession No." value={primary.accessionNumber} />
                                                        <InfoRow label="Subjects" value={primary.subjects} />
                                                        <InfoRow label="Genre" value={primary.genre} />
                                                        <InfoRow label="Category" value={primary.category} />
                                                        <InfoRow label="Publisher" value={primary.publisher} />
                                                        <InfoRow
                                                            label="Place of Publication"
                                                            value={primary.placeOfPublication}
                                                        />
                                                        <InfoRow
                                                            label="Copyright Year"
                                                            value={primary.copyrightYear}
                                                        />
                                                        <InfoRow label="Call Number" value={primary.callNumber} />
                                                        <InfoRow label="Library Area" value={primary.libraryArea} />
                                                        <InfoRow label="Series" value={primary.series} />
                                                        <InfoRow label="Added Entries" value={primary.addedEntries} />
                                                    </div>

                                                    {g.items.length > 1 ? (
                                                        <div className="mt-4 space-y-3">
                                                            <Separator className="bg-white/10" />
                                                            <div className="text-sm font-medium text-white">
                                                                Catalog records
                                                            </div>
                                                            <div className="space-y-2">
                                                                {g.items.map((b) => (
                                                                    <div
                                                                        key={b.id}
                                                                        className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3"
                                                                    >
                                                                        <div className="min-w-0 space-y-1">
                                                                            <div className="wrap-break-word whitespace-normal text-sm text-white/90">
                                                                                <span className="text-white/60">
                                                                                    Acc No.:
                                                                                </span>{" "}
                                                                                {fmt(b.accessionNumber)}
                                                                                {b.barcode ? (
                                                                                    <>
                                                                                        {" "}
                                                                                        <span className="text-white/60">
                                                                                            • Barcode:
                                                                                        </span>{" "}
                                                                                        {fmt(b.barcode)}
                                                                                    </>
                                                                                ) : null}
                                                                            </div>
                                                                            <div className="wrap-break-word whitespace-normal text-xs text-white/60">
                                                                                {b.copyNumber
                                                                                    ? `Copy: ${b.copyNumber}`
                                                                                    : null}
                                                                                {b.volumeNumber
                                                                                    ? `${b.copyNumber ? " • " : ""}Vol: ${b.volumeNumber}`
                                                                                    : null}
                                                                                {b.libraryArea
                                                                                    ? `${b.copyNumber || b.volumeNumber ? " • " : ""}${b.libraryArea}`
                                                                                    : null}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <Badge
                                                                                variant={
                                                                                    b.available ? "secondary" : "outline"
                                                                                }
                                                                                className="rounded-xl"
                                                                            >
                                                                                {b.available
                                                                                    ? "Available"
                                                                                    : "Not available"}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    {(primary.otherDetails || primary.notes) && (
                                                        <div className="mt-4 space-y-3">
                                                            <Separator className="bg-white/10" />
                                                            {primary.otherDetails ? (
                                                                <div className="space-y-1">
                                                                    <div className="text-xs text-white/60">
                                                                        Other Details
                                                                    </div>
                                                                    <div className="wrap-break-word whitespace-normal text-sm text-white/80">
                                                                        {primary.otherDetails}
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                            {primary.notes ? (
                                                                <div className="space-y-1">
                                                                    <div className="text-xs text-white/60">
                                                                        Notes
                                                                    </div>
                                                                    <div className="wrap-break-word whitespace-normal text-sm text-white/80">
                                                                        {primary.notes}
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )}

                                                    <div className="mt-5 flex flex-col gap-2">
                                                        {!isAuthed ? (
                                                            <SheetClose asChild>
                                                                <Button
                                                                    className="rounded-xl w-full sm:w-auto"
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
                                                                    className="rounded-xl w-full sm:w-auto"
                                                                    onClick={() => navigate(booksHref)}
                                                                >
                                                                    Open Books Page
                                                                </Button>
                                                            </SheetClose>
                                                        )}

                                                        <Button
                                                            variant="outline"
                                                            className="rounded-xl border-white/15 bg-white/5 hover:bg-white/10 w-full sm:w-auto"
                                                            onClick={() => {
                                                                const text = [
                                                                    g.title ? `Title: ${g.title}` : null,
                                                                    g.author ? `Author: ${g.author}` : null,
                                                                    primary.isbn ? `ISBN: ${primary.isbn}` : null,
                                                                    g.callNumber && g.callNumber !== "—"
                                                                        ? `Call No.: ${g.callNumber}`
                                                                        : null,
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join("\n")

                                                                if (!text) {
                                                                    toast("Nothing to copy")
                                                                    return
                                                                }

                                                                void navigator.clipboard
                                                                    .writeText(text)
                                                                    .then(() =>
                                                                        toast.success("Copied book info")
                                                                    )
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
                        </div>
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>
    )
}