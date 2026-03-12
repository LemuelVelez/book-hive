/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BookCopy,
    FileText,
    Loader2,
    RefreshCcw,
    Search,
    TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { fetchBooks, type BookDTO, type LibraryArea } from "@/lib/books";
import { fetchBorrowRecords, type BorrowRecordDTO } from "@/lib/borrows";
import ExportPreviewStatistics, {
    type PrintableBookStatisticsRecord,
} from "@/components/statistics-preview/export-preview-statistics";

type StatisticsRow = {
    id: string;
    title: string;
    author: string;
    genre: string;
    libraryArea: LibraryArea | null;
    totalCopies: number;
    availableCopies: number;
    borrowedCopies: number;
    activeBorrowCount: number;
    totalBorrowCount: number;
};

type BorrowCountFallback = {
    activeBorrowCount: number;
    totalBorrowCount: number;
};

function pickNumber(...values: Array<number | string | null | undefined>) {
    for (const value of values) {
        const num =
            typeof value === "number"
                ? value
                : typeof value === "string"
                    ? Number(value)
                    : NaN;

        if (Number.isFinite(num)) return num;
    }
    return 0;
}

function fmtCount(value: number) {
    try {
        return new Intl.NumberFormat("en-PH").format(value);
    } catch {
        return String(value);
    }
}

function normalizeLibraryAreaLabel(area?: LibraryArea | string | null) {
    switch (area) {
        case "filipiniana":
            return "Filipiniana";
        case "general_circulation":
            return "General Circulation";
        case "maritime":
            return "Maritime";
        case "periodicals":
            return "Periodicals";
        case "thesis_dissertations":
            return "Thesis / Dissertations";
        case "rizaliana":
            return "Rizaliana";
        case "special_collection":
            return "Special Collection";
        case "fil_gen_reference":
            return "Fil / Gen Reference";
        case "general_reference":
            return "General Reference";
        case "fiction":
            return "Fiction";
        default:
            return "Unassigned";
    }
}

function buildBorrowCountsMap(records: BorrowRecordDTO[]) {
    const map = new Map<string, BorrowCountFallback>();

    for (const record of records) {
        const key = String(record.bookId || "").trim();
        if (!key) continue;

        const current = map.get(key) ?? {
            activeBorrowCount: 0,
            totalBorrowCount: 0,
        };

        current.totalBorrowCount += 1;

        if (record.status !== "returned") {
            current.activeBorrowCount += 1;
        }

        map.set(key, current);
    }

    return map;
}

function buildStatisticsRow(
    book: BookDTO,
    fallback?: BorrowCountFallback
): StatisticsRow {
    const fallbackActive = pickNumber(fallback?.activeBorrowCount);
    const fallbackTotal = pickNumber(fallback?.totalBorrowCount);

    const activeBorrowCount = Math.max(
        0,
        pickNumber(book.activeBorrowCount, book.borrowedCopies, fallbackActive, 0)
    );

    const totalBorrowCount = Math.max(
        0,
        pickNumber(book.totalBorrowCount, fallbackTotal, activeBorrowCount, 0)
    );

    const totalCopies = Math.max(
        0,
        pickNumber(
            book.totalCopies,
            pickNumber(book.numberOfCopies, 0) + activeBorrowCount,
            book.numberOfCopies,
            0
        )
    );

    const availableCopies = Math.max(
        0,
        pickNumber(book.numberOfCopies, totalCopies - activeBorrowCount, 0)
    );

    const borrowedCopies = Math.max(
        0,
        pickNumber(book.borrowedCopies, activeBorrowCount, 0)
    );

    return {
        id: String(book.id),
        title: String(book.title || "Untitled Book"),
        author: String(book.author || "Unknown Author"),
        genre: String(book.genre || "—"),
        libraryArea: book.libraryArea ?? null,
        totalCopies,
        availableCopies,
        borrowedCopies,
        activeBorrowCount,
        totalBorrowCount,
    };
}

function StatsCard({
    title,
    value,
    subtitle,
}: {
    title: string;
    value: string;
    subtitle: string;
}) {
    return (
        <Card className="bg-slate-800/60 border-white/10">
            <CardContent className="pt-5">
                <div className="text-xs uppercase tracking-wide text-white/60">
                    {title}
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{value}</div>
                <div className="mt-1 text-xs text-white/70">{subtitle}</div>
            </CardContent>
        </Card>
    );
}

export default function LibrarianStatisticsPage() {
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [rows, setRows] = React.useState<StatisticsRow[]>([]);
    const [search, setSearch] = React.useState("");
    const [areaFilter, setAreaFilter] = React.useState("all");
    const [previewOpen, setPreviewOpen] = React.useState(false);

    const load = React.useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            const [books, borrowRecords] = await Promise.all([
                fetchBooks(),
                fetchBorrowRecords().catch(() => [] as BorrowRecordDTO[]),
            ]);

            const fallbackMap = buildBorrowCountsMap(borrowRecords);

            const nextRows = books
                .map((book) =>
                    buildStatisticsRow(book, fallbackMap.get(String(book.id)))
                )
                .sort((a, b) => {
                    if (b.totalBorrowCount !== a.totalBorrowCount) {
                        return b.totalBorrowCount - a.totalBorrowCount;
                    }
                    if (b.activeBorrowCount !== a.activeBorrowCount) {
                        return b.activeBorrowCount - a.activeBorrowCount;
                    }
                    return a.title.localeCompare(b.title);
                });

            setRows(nextRows);
        } catch (err: any) {
            const msg = err?.message || "Failed to load statistics.";
            setError(msg);
            toast.error("Failed to load", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    }

    const areaOptions = React.useMemo(() => {
        const options = new Map<string, string>();

        for (const row of rows) {
            const value = row.libraryArea ?? "unassigned";
            options.set(value, normalizeLibraryAreaLabel(row.libraryArea));
        }

        return Array.from(options.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [rows]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();

        return rows.filter((row) => {
            const rowAreaValue = row.libraryArea ?? "unassigned";

            if (areaFilter !== "all" && rowAreaValue !== areaFilter) {
                return false;
            }

            if (!q) return true;

            const haystack = [
                row.id,
                row.title,
                row.author,
                row.genre,
                normalizeLibraryAreaLabel(row.libraryArea),
            ]
                .join(" ")
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [areaFilter, rows, search]);

    const totals = React.useMemo(() => {
        return filtered.reduce(
            (acc, row) => {
                acc.totalTitles += 1;
                acc.totalBorrowCount += row.totalBorrowCount;
                acc.activeBorrowCount += row.activeBorrowCount;
                acc.availableCopies += row.availableCopies;
                acc.totalCopies += row.totalCopies;

                if (row.libraryArea === "filipiniana") {
                    acc.filipinianaTitles += 1;
                    acc.filipinianaBorrowCount += row.totalBorrowCount;
                    acc.filipinianaActiveBorrowCount += row.activeBorrowCount;
                }

                return acc;
            },
            {
                totalTitles: 0,
                totalBorrowCount: 0,
                activeBorrowCount: 0,
                availableCopies: 0,
                totalCopies: 0,
                filipinianaTitles: 0,
                filipinianaBorrowCount: 0,
                filipinianaActiveBorrowCount: 0,
            }
        );
    }, [filtered]);

    const printableRecords = React.useMemo<PrintableBookStatisticsRecord[]>(
        () =>
            filtered.map((row) => ({
                id: row.id,
                title: row.title,
                author: row.author,
                genre: row.genre,
                libraryArea: row.libraryArea,
                totalCopies: row.totalCopies,
                availableCopies: row.availableCopies,
                borrowedCopies: row.borrowedCopies,
                activeBorrowCount: row.activeBorrowCount,
                totalBorrowCount: row.totalBorrowCount,
            })),
        [filtered]
    );

    return (
        <DashboardLayout title="Statistics">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-lg font-semibold leading-tight">
                        Book Borrowing Statistics
                    </h2>
                    <p className="text-xs text-white/70">
                        Track how many times each book was borrowed, how many are
                        currently borrowed, and how many Filipiniana books were
                        borrowed.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-sky-400/30 text-sky-100 hover:bg-sky-500/10"
                        onClick={() => setPreviewOpen(true)}
                        disabled={loading || !printableRecords.length}
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        Preview PDF
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="border-white/20 text-white/90 hover:bg-white/10"
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                    >
                        {refreshing || loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCcw className="h-4 w-4" />
                        )}
                        <span className="sr-only">Refresh</span>
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 mb-4">
                <StatsCard
                    title="Book Titles"
                    value={fmtCount(totals.totalTitles)}
                    subtitle="Titles included in the current filter."
                />
                <StatsCard
                    title="Total Borrowed"
                    value={fmtCount(totals.totalBorrowCount)}
                    subtitle="All-time borrow count across filtered books."
                />
                <StatsCard
                    title="Currently Borrowed"
                    value={fmtCount(totals.activeBorrowCount)}
                    subtitle="Active borrow records not yet returned."
                />
                <StatsCard
                    title="Filipiniana Borrowed"
                    value={fmtCount(totals.filipinianaBorrowCount)}
                    subtitle="All-time borrowed count for Filipiniana."
                />
                <StatsCard
                    title="Filipiniana Active"
                    value={fmtCount(totals.filipinianaActiveBorrowCount)}
                    subtitle="Currently borrowed Filipiniana books."
                />
            </div>

            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <CardTitle>Statistics list</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by title, author, genre, area…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            <div className="w-full md:w-56">
                                <Select
                                    value={areaFilter}
                                    onValueChange={setAreaFilter}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Library area" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="all">All areas</SelectItem>
                                        {areaOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="overflow-x-auto">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center text-sm text-red-300">
                            {error}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            No statistics found.
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block">
                                <Table>
                                    <TableCaption className="text-xs text-white/60">
                                        Showing {filtered.length}{" "}
                                        {filtered.length === 1 ? "book" : "books"}.
                                    </TableCaption>
                                    <TableHeader>
                                        <TableRow className="border-white/10">
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Book
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Area / Genre
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70 text-right">
                                                Total Borrowed
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70 text-right">
                                                Currently Borrowed
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70 text-right">
                                                Available Copies
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70 text-right">
                                                Total Copies
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filtered.map((row) => (
                                            <TableRow
                                                key={row.id}
                                                className="border-white/5 hover:bg-white/5 transition-colors"
                                            >
                                                <TableCell className="text-sm">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-medium text-white">
                                                            {row.title}
                                                        </span>
                                                        <span className="text-xs text-white/60">
                                                            {row.author}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-sm">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>
                                                            {normalizeLibraryAreaLabel(
                                                                row.libraryArea
                                                            )}
                                                        </span>
                                                        <span className="text-xs text-white/60">
                                                            {row.genre || "—"}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-sm text-right font-medium">
                                                    {fmtCount(row.totalBorrowCount)}
                                                </TableCell>

                                                <TableCell className="text-sm text-right font-medium">
                                                    {fmtCount(row.activeBorrowCount)}
                                                </TableCell>

                                                <TableCell className="text-sm text-right">
                                                    {fmtCount(row.availableCopies)}
                                                </TableCell>

                                                <TableCell className="text-sm text-right">
                                                    {fmtCount(row.totalCopies)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="md:hidden space-y-3">
                                {filtered.map((row) => (
                                    <div
                                        key={row.id}
                                        className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-white">
                                                    {row.title}
                                                </div>
                                                <div className="text-xs text-white/60">
                                                    {row.author}
                                                </div>
                                            </div>

                                            <div className="rounded-full border border-sky-300/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-100">
                                                {normalizeLibraryAreaLabel(
                                                    row.libraryArea
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <div className="rounded-lg bg-white/5 p-2">
                                                <div className="text-[11px] text-white/60">
                                                    Total Borrowed
                                                </div>
                                                <div className="mt-1 text-sm font-medium">
                                                    {fmtCount(row.totalBorrowCount)}
                                                </div>
                                            </div>

                                            <div className="rounded-lg bg-white/5 p-2">
                                                <div className="text-[11px] text-white/60">
                                                    Currently Borrowed
                                                </div>
                                                <div className="mt-1 text-sm font-medium">
                                                    {fmtCount(row.activeBorrowCount)}
                                                </div>
                                            </div>

                                            <div className="rounded-lg bg-white/5 p-2">
                                                <div className="text-[11px] text-white/60">
                                                    Available Copies
                                                </div>
                                                <div className="mt-1 text-sm font-medium">
                                                    {fmtCount(row.availableCopies)}
                                                </div>
                                            </div>

                                            <div className="rounded-lg bg-white/5 p-2">
                                                <div className="text-[11px] text-white/60">
                                                    Total Copies
                                                </div>
                                                <div className="mt-1 text-sm font-medium">
                                                    {fmtCount(row.totalCopies)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                                            <BookCopy className="h-3.5 w-3.5" />
                                            <span>{row.genre || "—"}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <Card className="bg-slate-900/60 border-white/10">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2 text-sky-100">
                                            <TrendingUp className="h-4 w-4" />
                                            <span className="text-sm font-medium">
                                                Borrowing overview
                                            </span>
                                        </div>
                                        <p className="mt-2 text-xs text-white/70">
                                            Filtered books have a combined{" "}
                                            <span className="font-semibold text-white">
                                                {fmtCount(totals.totalBorrowCount)}
                                            </span>{" "}
                                            all-time borrows and{" "}
                                            <span className="font-semibold text-white">
                                                {fmtCount(totals.activeBorrowCount)}
                                            </span>{" "}
                                            active borrows.
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-slate-900/60 border-white/10">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2 text-sky-100">
                                            <BookCopy className="h-4 w-4" />
                                            <span className="text-sm font-medium">
                                                Filipiniana overview
                                            </span>
                                        </div>
                                        <p className="mt-2 text-xs text-white/70">
                                            Filipiniana titles in this filter:{" "}
                                            <span className="font-semibold text-white">
                                                {fmtCount(totals.filipinianaTitles)}
                                            </span>
                                            . Borrowed all-time:{" "}
                                            <span className="font-semibold text-white">
                                                {fmtCount(totals.filipinianaBorrowCount)}
                                            </span>
                                            .
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-slate-900/60 border-white/10">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2 text-sky-100">
                                            <RefreshCcw className="h-4 w-4" />
                                            <span className="text-sm font-medium">
                                                Inventory overview
                                            </span>
                                        </div>
                                        <p className="mt-2 text-xs text-white/70">
                                            Available copies:{" "}
                                            <span className="font-semibold text-white">
                                                {fmtCount(totals.availableCopies)}
                                            </span>{" "}
                                            out of{" "}
                                            <span className="font-semibold text-white">
                                                {fmtCount(totals.totalCopies)}
                                            </span>{" "}
                                            total copies for the current filter.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <ExportPreviewStatistics
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                records={printableRecords}
                fileNamePrefix="bookhive-statistics-report"
                reportTitle="BookHive Library • Statistics Report"
                reportSubtitle="Printable report for librarian book borrowing statistics and Filipiniana usage."
            />
        </DashboardLayout>
    );
}