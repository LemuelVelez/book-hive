import * as React from "react";
import { ArrowUpDown, FileSpreadsheet, Filter, Search, Sparkles } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { BookDTO } from "@/lib/books";
import {
    formatLibraryAreaLabel,
    type ExcelBookRow,
    toExcelRows,
} from "./books-constants";

type BooksExcelPreviewDialogProps = {
    books: BookDTO[];
};

type ExcelPreviewRow = ExcelBookRow & {
    libraryArea: string;
    rawLibraryArea: string;
};

type SortKey =
    | "title"
    | "author"
    | "publisher"
    | "libraryArea"
    | "callNumber"
    | "copies";
type SortDir = "asc" | "desc";
type CopiesFilter = "all" | "has" | "none";
type PreviewMode = "smart" | "sheet";

const UNASSIGNED_LIBRARY_AREA_VALUE = "__unassigned_library_area__";

const EXCEL_COLUMNS: Array<{ key: keyof ExcelPreviewRow; label: string; width: number }> = [
    { key: "callNumber", label: "Call Number", width: 22 },
    { key: "accessionNumber", label: "Accession Number", width: 20 },
    { key: "title", label: "Title", width: 34 },
    { key: "author", label: "Author", width: 24 },
    { key: "publisher", label: "Name of Publisher", width: 28 },
    { key: "libraryArea", label: "Library Area", width: 22 },
    { key: "edition", label: "Edition", width: 14 },
    { key: "copyright", label: "Copyright", width: 12 },
    { key: "copies", label: "Copies", width: 12 },
];

function parseCopies(value: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function getExcelColumnLetter(columnNumber: number): string {
    let dividend = columnNumber;
    let columnName = "";

    while (dividend > 0) {
        const modulo = (dividend - 1) % 26;
        columnName = String.fromCharCode(65 + modulo) + columnName;
        dividend = Math.floor((dividend - modulo) / 26);
    }

    return columnName;
}

function sanitizeWorksheetName(value: string): string {
    const sanitized = value.replace(/[:\\/?*\[\]]/g, "").trim();
    return sanitized.slice(0, 31) || "Books";
}

function slugify(value: string): string {
    return (
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "library-area"
    );
}

function getRawLibraryAreaValue(book: BookDTO): string {
    return typeof book.libraryArea === "string" ? book.libraryArea.trim() : "";
}

function getLibraryAreaOptionValue(rawLibraryArea: string): string {
    return rawLibraryArea || UNASSIGNED_LIBRARY_AREA_VALUE;
}

function getFallbackExcelRow(book: BookDTO): ExcelBookRow {
    return {
        callNumber: book.callNumber || "",
        accessionNumber: book.accessionNumber || "",
        title: book.title || "",
        author: book.author || "",
        publisher: book.publisher || "",
        edition: book.edition || "",
        copyright:
            typeof book.publicationYear === "number" && Number.isFinite(book.publicationYear)
                ? String(book.publicationYear)
                : "",
        copies:
            typeof book.numberOfCopies === "number" && Number.isFinite(book.numberOfCopies)
                ? String(book.numberOfCopies)
                : "0",
    };
}

export function BooksExcelPreviewDialog({ books }: BooksExcelPreviewDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [sortKey, setSortKey] = React.useState<SortKey>("title");
    const [sortDir, setSortDir] = React.useState<SortDir>("asc");
    const [copiesFilter, setCopiesFilter] = React.useState<CopiesFilter>("all");
    const [libraryAreaFilter, setLibraryAreaFilter] = React.useState("all");
    const [previewMode, setPreviewMode] = React.useState<PreviewMode>("smart");
    const [exporting, setExporting] = React.useState(false);

    const baseRows = React.useMemo(() => toExcelRows(books), [books]);

    const rows = React.useMemo<ExcelPreviewRow[]>(() => {
        return books.map((book, index) => {
            const source = baseRows[index] ?? getFallbackExcelRow(book);
            const rawLibraryArea = getRawLibraryAreaValue(book);
            const libraryArea = rawLibraryArea
                ? formatLibraryAreaLabel(rawLibraryArea)
                : "Unassigned";

            return {
                ...source,
                libraryArea,
                rawLibraryArea,
            };
        });
    }, [books, baseRows]);

    const libraryAreaOptions = React.useMemo(() => {
        const options = new Map<string, string>();

        rows.forEach((row) => {
            const optionValue = getLibraryAreaOptionValue(row.rawLibraryArea);
            if (!options.has(optionValue)) {
                options.set(optionValue, row.libraryArea);
            }
        });

        return Array.from(options.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    }, [rows]);

    React.useEffect(() => {
        if (
            libraryAreaFilter !== "all" &&
            !libraryAreaOptions.some((option) => option.value === libraryAreaFilter)
        ) {
            setLibraryAreaFilter("all");
        }
    }, [libraryAreaFilter, libraryAreaOptions]);

    const selectedLibraryAreaLabel = React.useMemo(() => {
        if (libraryAreaFilter === "all") return "All Library Areas";

        return (
            libraryAreaOptions.find((option) => option.value === libraryAreaFilter)?.label ||
            "Selected Library Area"
        );
    }, [libraryAreaFilter, libraryAreaOptions]);

    const smartRows = React.useMemo(() => {
        const q = query.trim().toLowerCase();

        const filtered = rows.filter((row) => {
            const areaOptionValue = getLibraryAreaOptionValue(row.rawLibraryArea);

            if (libraryAreaFilter !== "all" && areaOptionValue !== libraryAreaFilter) return false;
            if (copiesFilter === "has" && parseCopies(row.copies) <= 0) return false;
            if (copiesFilter === "none" && parseCopies(row.copies) > 0) return false;

            if (!q) return true;

            const hay = [
                row.callNumber,
                row.accessionNumber,
                row.title,
                row.author,
                row.publisher,
                row.libraryArea,
                row.edition,
                row.copyright,
                row.copies,
            ]
                .join(" ")
                .toLowerCase();

            return hay.includes(q);
        });

        const sorted = [...filtered].sort((a, b) => {
            const direction = sortDir === "asc" ? 1 : -1;

            if (sortKey === "copies") {
                const av = parseCopies(a.copies);
                const bv = parseCopies(b.copies);
                return (av - bv) * direction;
            }

            const av = String(a[sortKey] || "").toLowerCase();
            const bv = String(b[sortKey] || "").toLowerCase();

            return av.localeCompare(bv, undefined, { sensitivity: "base" }) * direction;
        });

        return sorted;
    }, [rows, query, sortKey, sortDir, copiesFilter, libraryAreaFilter]);

    const stats = React.useMemo(() => {
        const total = rows.length;
        const visible = smartRows.length;
        const withCallNo = rows.filter((r) => r.callNumber.trim()).length;
        const withPublisher = rows.filter((r) => r.publisher.trim()).length;
        const totalCopies = smartRows.reduce((sum, r) => sum + parseCopies(r.copies), 0);

        return {
            total,
            visible,
            withCallNo,
            withPublisher,
            totalCopies,
            libraryAreas: libraryAreaOptions.length,
        };
    }, [rows, smartRows, libraryAreaOptions]);

    const handleExportExcel = React.useCallback(async () => {
        if (smartRows.length === 0) {
            toast.error("Nothing to export", {
                description: "No rows available after current filters/search.",
            });
            return;
        }

        setExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "BookHive";
            workbook.created = new Date();

            const worksheetName = sanitizeWorksheetName(
                libraryAreaFilter === "all"
                    ? "Books"
                    : `Books - ${selectedLibraryAreaLabel}`
            );

            const worksheet = workbook.addWorksheet(worksheetName);

            worksheet.pageSetup = {
                paperSize: 9,
                orientation: "landscape",
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: {
                    left: 0.25,
                    right: 0.25,
                    top: 0.5,
                    bottom: 0.5,
                    header: 0.2,
                    footer: 0.2,
                },
            };

            worksheet.columns = EXCEL_COLUMNS.map((c) => ({
                key: c.key,
                width: c.width,
            }));

            const lastColumnLetter = getExcelColumnLetter(EXCEL_COLUMNS.length);
            const titleRange = `A1:${lastColumnLetter}1`;
            const subtitleRange = `A2:${lastColumnLetter}2`;
            const filterRange = `A3:${lastColumnLetter}3`;

            worksheet.mergeCells(titleRange);
            const titleCell = worksheet.getCell("A1");
            titleCell.value =
                libraryAreaFilter === "all"
                    ? "Library Books Export"
                    : `Library Books Export • ${selectedLibraryAreaLabel}`;
            titleCell.font = {
                name: "Calibri",
                size: 16,
                bold: true,
                color: { argb: "FFFFFFFF" },
            };
            titleCell.alignment = { horizontal: "center", vertical: "middle" };
            titleCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "1E3A8A" },
            };
            worksheet.getRow(1).height = 26;

            worksheet.mergeCells(subtitleRange);
            const subtitleCell = worksheet.getCell("A2");
            subtitleCell.value = `Generated on ${new Date().toLocaleString()} • Rows: ${smartRows.length} • Library Area: ${selectedLibraryAreaLabel}`;
            subtitleCell.font = {
                name: "Calibri",
                size: 11,
                color: { argb: "E2E8F0" },
            };
            subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
            subtitleCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "334155" },
            };
            worksheet.getRow(2).height = 20;

            worksheet.mergeCells(filterRange);
            const filterCell = worksheet.getCell("A3");
            filterCell.value = `Search: ${query.trim() || "—"} • Copies filter: ${
                copiesFilter === "all"
                    ? "All"
                    : copiesFilter === "has"
                    ? "Has copies"
                    : "No copies"
            } • Sort: ${sortKey} (${sortDir})`;
            filterCell.font = {
                name: "Calibri",
                size: 10,
                color: { argb: "CBD5E1" },
            };
            filterCell.alignment = { horizontal: "center", vertical: "middle" };
            filterCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "0F172A" },
            };
            worksheet.getRow(3).height = 18;

            worksheet.addRow([]);

            const headerRow = worksheet.addRow(EXCEL_COLUMNS.map((c) => c.label));
            headerRow.height = 22;

            headerRow.eachCell((cell) => {
                cell.font = {
                    name: "Calibri",
                    bold: true,
                    size: 11,
                    color: { argb: "FFFFFFFF" },
                };
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "7C3AED" },
                };
                cell.border = {
                    top: { style: "thin", color: { argb: "C4B5FD" } },
                    left: { style: "thin", color: { argb: "C4B5FD" } },
                    bottom: { style: "thin", color: { argb: "C4B5FD" } },
                    right: { style: "thin", color: { argb: "C4B5FD" } },
                };
            });

            const copiesColumnIndex =
                EXCEL_COLUMNS.findIndex((column) => column.key === "copies") + 1;

            smartRows.forEach((row, index) => {
                const excelRow = worksheet.addRow(EXCEL_COLUMNS.map((c) => row[c.key] ?? ""));

                excelRow.eachCell((cell) => {
                    cell.font = { name: "Calibri", size: 10, color: { argb: "0F172A" } };
                    cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
                    cell.border = {
                        top: { style: "thin", color: { argb: "CBD5E1" } },
                        left: { style: "thin", color: { argb: "CBD5E1" } },
                        bottom: { style: "thin", color: { argb: "CBD5E1" } },
                        right: { style: "thin", color: { argb: "CBD5E1" } },
                    };
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: index % 2 === 0 ? "F8FAFC" : "EEF2FF" },
                    };
                });

                const copiesCell = excelRow.getCell(copiesColumnIndex);
                const copiesValue = parseCopies(row.copies);
                copiesCell.alignment = { vertical: "middle", horizontal: "center" };

                if (copiesValue > 0) {
                    copiesCell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "DCFCE7" },
                    };
                    copiesCell.font = {
                        name: "Calibri",
                        size: 10,
                        bold: true,
                        color: { argb: "166534" },
                    };
                } else {
                    copiesCell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FEE2E2" },
                    };
                    copiesCell.font = {
                        name: "Calibri",
                        size: 10,
                        bold: true,
                        color: { argb: "991B1B" },
                    };
                }
            });

            const headerRowNumber = 5;
            worksheet.autoFilter = {
                from: { row: headerRowNumber, column: 1 },
                to: { row: headerRowNumber, column: EXCEL_COLUMNS.length },
            };
            worksheet.views = [{ state: "frozen", ySplit: headerRowNumber }];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
            });

            const fileStamp = new Date().toISOString().slice(0, 10);
            const areaSuffix =
                libraryAreaFilter === "all"
                    ? "all-library-areas"
                    : slugify(selectedLibraryAreaLabel);

            saveAs(blob, `books-catalog-${areaSuffix}-${fileStamp}.xlsx`);

            toast.success("Excel exported", {
                description: `Exported ${smartRows.length} row${
                    smartRows.length === 1 ? "" : "s"
                } for ${selectedLibraryAreaLabel}.`,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to export Excel file.";
            toast.error("Export failed", { description: message });
        } finally {
            setExporting(false);
        }
    }, [smartRows, libraryAreaFilter, selectedLibraryAreaLabel, query, copiesFilter, sortKey, sortDir]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 mr-2 text-white/90 hover:bg-white/10"
                >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Preview / Export Excel
                </Button>
            </DialogTrigger>

            <DialogContent
                className="w-[96vw] sm:max-w-6xl bg-slate-900 text-white border-white/10
        max-h-[88vh] overflow-y-auto
        [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-slate-900/70
        [&::-webkit-scrollbar-thumb]:bg-slate-700
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-300" />
                        Books Excel Smart Preview
                    </DialogTitle>
                    <DialogDescription className="text-white/70">
                        You can now filter and export by library area before printing or exporting,
                        including categories like Filipiña, General Circulation, and other configured
                        library areas.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-white/70">Total Rows</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-semibold">{stats.total}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-white/70">Visible Rows</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-semibold">{stats.visible}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-white/70">With Call Number</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-semibold">{stats.withCallNo}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-white/70">Library Areas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-semibold">{stats.libraryAreas}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-white/70">Visible Copies</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-semibold">{stats.totalCopies}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-slate-800/40 border-white/10">
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
                            <div className="relative w-full lg:w-[420px]">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search title, call number, author, publisher, library area..."
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className="border-white/20 text-white/80 px-2 py-1 inline-flex items-center gap-1"
                                >
                                    <Filter className="h-3 w-3" />
                                    Copies
                                </Badge>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant={copiesFilter === "all" ? "default" : "outline"}
                                    className={
                                        copiesFilter === "all"
                                            ? "bg-purple-600 hover:bg-purple-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setCopiesFilter("all")}
                                >
                                    All
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={copiesFilter === "has" ? "default" : "outline"}
                                    className={
                                        copiesFilter === "has"
                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setCopiesFilter("has")}
                                >
                                    Has copies
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={copiesFilter === "none" ? "default" : "outline"}
                                    className={
                                        copiesFilter === "none"
                                            ? "bg-rose-600 hover:bg-rose-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setCopiesFilter("none")}
                                >
                                    No copies
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-white/70">
                                <Filter className="h-3.5 w-3.5" />
                                Library area
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={libraryAreaFilter === "all" ? "default" : "outline"}
                                    className={
                                        libraryAreaFilter === "all"
                                            ? "bg-sky-600 hover:bg-sky-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setLibraryAreaFilter("all")}
                                >
                                    All library areas
                                </Button>

                                {libraryAreaOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        type="button"
                                        size="sm"
                                        variant={
                                            libraryAreaFilter === option.value ? "default" : "outline"
                                        }
                                        className={
                                            libraryAreaFilter === option.value
                                                ? "bg-sky-600 hover:bg-sky-700 text-white"
                                                : "border-white/20 text-white"
                                        }
                                        onClick={() => setLibraryAreaFilter(option.value)}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={sortKey === "title" ? "default" : "outline"}
                                    className={
                                        sortKey === "title"
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setSortKey("title")}
                                >
                                    Sort: Title
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={sortKey === "author" ? "default" : "outline"}
                                    className={
                                        sortKey === "author"
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setSortKey("author")}
                                >
                                    Sort: Author
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={sortKey === "publisher" ? "default" : "outline"}
                                    className={
                                        sortKey === "publisher"
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setSortKey("publisher")}
                                >
                                    Sort: Publisher
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={sortKey === "libraryArea" ? "default" : "outline"}
                                    className={
                                        sortKey === "libraryArea"
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setSortKey("libraryArea")}
                                >
                                    Sort: Library Area
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={sortKey === "callNumber" ? "default" : "outline"}
                                    className={
                                        sortKey === "callNumber"
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setSortKey("callNumber")}
                                >
                                    Sort: Call Number
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={sortKey === "copies" ? "default" : "outline"}
                                    className={
                                        sortKey === "copies"
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                            : "border-white/20 text-white"
                                    }
                                    onClick={() => setSortKey("copies")}
                                >
                                    Sort: Copies
                                </Button>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="border-white/20 text-white"
                                    onClick={() =>
                                        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                                    }
                                >
                                    <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                                    {sortDir === "asc" ? "Ascending" : "Descending"}
                                </Button>
                            </div>

                            <div className="inline-flex rounded-md border border-white/10 overflow-hidden">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className={
                                        previewMode === "smart"
                                            ? "rounded-none bg-white/10 text-white"
                                            : "rounded-none text-white/70 hover:text-white hover:bg-white/10"
                                    }
                                    onClick={() => setPreviewMode("smart")}
                                >
                                    Smart View
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className={
                                        previewMode === "sheet"
                                            ? "rounded-none bg-white/10 text-white"
                                            : "rounded-none text-white/70 hover:text-white hover:bg-white/10"
                                    }
                                    onClick={() => setPreviewMode("sheet")}
                                >
                                    Excel Sheet Preview
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="text-xs text-white/60">
                    Active library area:{" "}
                    <span className="font-medium text-white/80">{selectedLibraryAreaLabel}</span>
                </div>

                {smartRows.length === 0 ? (
                    <div className="py-8 text-center text-sm text-white/70">
                        No rows match your current search/filter.
                    </div>
                ) : previewMode === "smart" ? (
                    <div className="rounded-md border border-white/10 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="text-white/70 w-12">#</TableHead>
                                    {EXCEL_COLUMNS.map((col) => (
                                        <TableHead key={col.key} className="text-white/70">
                                            {col.label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {smartRows.map((row, idx) => {
                                    const copies = parseCopies(row.copies);
                                    return (
                                        <TableRow
                                            key={`${row.callNumber}-${row.accessionNumber}-${idx}`}
                                            className="border-white/5"
                                        >
                                            <TableCell className="text-white/60 text-xs">
                                                {idx + 1}
                                            </TableCell>
                                            <TableCell>
                                                {row.callNumber || <span className="text-white/40">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {row.accessionNumber || (
                                                    <span className="text-white/40">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {row.title || <span className="text-white/40">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {row.author || <span className="text-white/40">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {row.publisher || <span className="text-white/40">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {row.libraryArea || (
                                                    <span className="text-white/40">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {row.edition || <span className="text-white/40">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {row.copyright || (
                                                    <span className="text-white/40">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        copies > 0
                                                            ? "border-emerald-500/50 text-emerald-200"
                                                            : "border-rose-500/50 text-rose-200"
                                                    }
                                                >
                                                    {row.copies || "0"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="rounded-md border border-white/10 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-violet-600/90 hover:bg-violet-600/90 border-violet-400/40">
                                    {EXCEL_COLUMNS.map((col) => (
                                        <TableHead key={col.key} className="text-white font-semibold">
                                            {col.label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {smartRows.map((row, idx) => {
                                    const copies = parseCopies(row.copies);
                                    return (
                                        <TableRow
                                            key={`${row.callNumber}-${row.accessionNumber}-${idx}`}
                                            className={
                                                idx % 2 === 0
                                                    ? "bg-slate-100/5 border-white/5"
                                                    : "bg-indigo-100/5 border-white/5"
                                            }
                                        >
                                            <TableCell>{row.callNumber || "—"}</TableCell>
                                            <TableCell>{row.accessionNumber || "—"}</TableCell>
                                            <TableCell>{row.title || "—"}</TableCell>
                                            <TableCell>{row.author || "—"}</TableCell>
                                            <TableCell>{row.publisher || "—"}</TableCell>
                                            <TableCell>{row.libraryArea || "—"}</TableCell>
                                            <TableCell>{row.edition || "—"}</TableCell>
                                            <TableCell>{row.copyright || "—"}</TableCell>
                                            <TableCell>
                                                <span
                                                    className={
                                                        copies > 0
                                                            ? "inline-flex px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 text-xs font-semibold"
                                                            : "inline-flex px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 text-xs font-semibold"
                                                    }
                                                >
                                                    {row.copies || "0"}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 text-white hover:text-white hover:bg-black/10 w-full sm:w-auto"
                        onClick={() => setOpen(false)}
                    >
                        Close
                    </Button>

                    <Button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={exporting || smartRows.length === 0}
                        className="w-full sm:w-auto bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                    >
                        {exporting
                            ? "Exporting..."
                            : `Export Styled Excel (.xlsx)${
                                  libraryAreaFilter === "all"
                                      ? ""
                                      : ` • ${selectedLibraryAreaLabel}`
                              }`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}