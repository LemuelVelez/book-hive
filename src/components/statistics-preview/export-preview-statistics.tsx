import * as React from "react";
import {
    Document,
    Page,
    PDFDownloadLink,
    PDFViewer,
    StyleSheet,
    Text,
    View,
    pdf,
} from "@react-pdf/renderer";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { LibraryArea } from "@/lib/books";

export type PrintableBookStatisticsRecord = {
    id: string | number;
    title: string;
    author?: string | null;
    genre?: string | null;
    libraryArea?: LibraryArea | null;
    totalCopies: number;
    availableCopies: number;
    borrowedCopies?: number;
    activeBorrowCount: number;
    totalBorrowCount: number;
};

export type PrintableProgramStatisticsRecord = {
    program: string;
    college: string;
    collegeColor: string;
    totalBorrowCount: number;
    activeBorrowCount: number;
};

type ExportPreviewStatisticsProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    records: PrintableBookStatisticsRecord[];
    programRecords?: PrintableProgramStatisticsRecord[];
    fileNamePrefix?: string;
    reportTitle?: string;
    reportSubtitle?: string;
};

type StatisticsPdfDocumentProps = {
    records: PrintableBookStatisticsRecord[];
    programRecords: PrintableProgramStatisticsRecord[];
    generatedAtIso: string;
    reportTitle: string;
    reportSubtitle: string;
};

function toNumber(value: unknown) {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
}

function fmtCount(value: number) {
    try {
        return new Intl.NumberFormat("en-PH").format(value);
    } catch {
        return String(value);
    }
}

function fmtDateTime(value?: string | null) {
    if (!value) return "—";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleString("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return value;
    }
}

function safeToken(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
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

const pdfStyles = StyleSheet.create({
    page: {
        paddingTop: 24,
        paddingHorizontal: 24,
        paddingBottom: 24,
        fontSize: 9,
        color: "#0f172a",
        fontFamily: "Helvetica",
        lineHeight: 1.35,
    },
    hero: {
        backgroundColor: "#0f172a",
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
    },
    heroTitle: {
        color: "#f8fafc",
        fontSize: 14,
        fontWeight: 700,
    },
    heroSub: {
        color: "#cbd5e1",
        fontSize: 9,
        marginTop: 2,
    },
    metaGrid: {
        flexDirection: "row",
        marginBottom: 10,
    },
    metaCard: {
        flexGrow: 1,
        flexBasis: 0,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        padding: 8,
        marginRight: 6,
        backgroundColor: "#f8fafc",
    },
    metaCardLast: {
        marginRight: 0,
    },
    metaLabel: {
        fontSize: 8,
        color: "#475569",
    },
    metaValue: {
        marginTop: 2,
        fontSize: 10,
        fontWeight: 700,
        color: "#0f172a",
    },
    sectionTitle: {
        fontSize: 10,
        color: "#0f172a",
        fontWeight: 700,
        marginBottom: 6,
    },
    tableHead: {
        flexDirection: "row",
        backgroundColor: "#e2e8f0",
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        paddingVertical: 6,
        paddingHorizontal: 6,
    },
    row: {
        flexDirection: "row",
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#cbd5e1",
        paddingVertical: 5,
        paddingHorizontal: 6,
        alignItems: "center",
    },
    colBook: { width: "34%", paddingRight: 6 },
    colArea: { width: "18%", paddingRight: 6 },
    colTotalBorrowed: { width: "12%", alignItems: "flex-end" },
    colActive: { width: "12%", alignItems: "flex-end" },
    colAvailable: { width: "12%", alignItems: "flex-end" },
    colTotalCopies: { width: "12%", alignItems: "flex-end" },
    th: {
        fontSize: 8.2,
        fontWeight: 700,
        color: "#1e293b",
    },
    td: {
        fontSize: 8.7,
        color: "#0f172a",
    },
    tdSubtle: {
        fontSize: 7.6,
        color: "#475569",
        marginTop: 1,
    },
    totalsWrap: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        padding: 8,
        backgroundColor: "#f8fafc",
    },
    totalsLine: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 3,
    },
    totalsLabel: {
        color: "#334155",
        fontSize: 9,
    },
    totalsValue: {
        color: "#0f172a",
        fontSize: 9,
        fontWeight: 700,
    },
    totalsGrand: {
        marginTop: 4,
        paddingTop: 5,
        borderTopWidth: 1,
        borderTopColor: "#cbd5e1",
    },
    programSectionWrap: {
        marginTop: 10,
    },
    colProgram: { width: "34%", paddingRight: 6 },
    colProgramCollege: { width: "30%", paddingRight: 6 },
    colProgramBorrowed: { width: "18%", alignItems: "flex-end" },
    colProgramActive: { width: "18%", alignItems: "flex-end" },
    programColorRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    programColorDot: {
        width: 7,
        height: 7,
        borderRadius: 7,
        marginRight: 5,
    },
    notesWrap: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        padding: 8,
    },
    notesTitle: {
        fontSize: 9,
        color: "#0f172a",
        fontWeight: 700,
        marginBottom: 4,
    },
    noteText: {
        fontSize: 8,
        color: "#334155",
        marginBottom: 2,
    },
    footer: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
        paddingTop: 6,
        flexDirection: "row",
        justifyContent: "space-between",
    },
    footerText: {
        fontSize: 7.5,
        color: "#64748b",
    },
});

function StatisticsPdfDocument({
    records,
    programRecords,
    generatedAtIso,
    reportTitle,
    reportSubtitle,
}: StatisticsPdfDocumentProps) {
    const sorted = [...records].sort((a, b) => {
        if (toNumber(b.totalBorrowCount) !== toNumber(a.totalBorrowCount)) {
            return toNumber(b.totalBorrowCount) - toNumber(a.totalBorrowCount);
        }
        return String(a.title || "").localeCompare(String(b.title || ""));
    });

    const totals = sorted.reduce(
        (acc, row) => {
            acc.totalTitles += 1;
            acc.totalBorrowCount += toNumber(row.totalBorrowCount);
            acc.activeBorrowCount += toNumber(row.activeBorrowCount);
            acc.availableCopies += toNumber(row.availableCopies);
            acc.totalCopies += toNumber(row.totalCopies);

            if (row.libraryArea === "filipiniana") {
                acc.filipinianaBorrowCount += toNumber(row.totalBorrowCount);
                acc.filipinianaActiveBorrowCount += toNumber(
                    row.activeBorrowCount
                );
            }

            return acc;
        },
        {
            totalTitles: 0,
            totalBorrowCount: 0,
            activeBorrowCount: 0,
            availableCopies: 0,
            totalCopies: 0,
            filipinianaBorrowCount: 0,
            filipinianaActiveBorrowCount: 0,
        }
    );

    const rankedProgramRecords = [...programRecords].sort((a, b) => {
        if (toNumber(b.totalBorrowCount) !== toNumber(a.totalBorrowCount)) {
            return toNumber(b.totalBorrowCount) - toNumber(a.totalBorrowCount);
        }

        if (String(a.college || "") !== String(b.college || "")) {
            return String(a.college || "").localeCompare(String(b.college || ""));
        }

        return String(a.program || "").localeCompare(String(b.program || ""));
    });

    const programTotals = rankedProgramRecords.reduce(
        (acc, row) => {
            acc.programCount += 1;
            acc.totalBorrowCount += toNumber(row.totalBorrowCount);
            acc.activeBorrowCount += toNumber(row.activeBorrowCount);
            return acc;
        },
        {
            programCount: 0,
            totalBorrowCount: 0,
            activeBorrowCount: 0,
        }
    );

    return (
        <Document title="BookHive Statistics Report">
            <Page size="A4" style={pdfStyles.page} wrap>
                <View style={pdfStyles.hero}>
                    <Text style={pdfStyles.heroTitle}>{reportTitle}</Text>
                    <Text style={pdfStyles.heroSub}>{reportSubtitle}</Text>
                </View>

                <View style={pdfStyles.metaGrid}>
                    <View style={pdfStyles.metaCard}>
                        <Text style={pdfStyles.metaLabel}>Generated</Text>
                        <Text style={pdfStyles.metaValue}>
                            {fmtDateTime(generatedAtIso)}
                        </Text>
                    </View>

                    <View style={pdfStyles.metaCard}>
                        <Text style={pdfStyles.metaLabel}>Book Titles</Text>
                        <Text style={pdfStyles.metaValue}>
                            {fmtCount(totals.totalTitles)}
                        </Text>
                    </View>

                    <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                        <Text style={pdfStyles.metaLabel}>All-Time Borrows</Text>
                        <Text style={pdfStyles.metaValue}>
                            {fmtCount(totals.totalBorrowCount)}
                        </Text>
                    </View>
                </View>

                <View style={pdfStyles.metaGrid}>
                    <View style={pdfStyles.metaCard}>
                        <Text style={pdfStyles.metaLabel}>Currently Borrowed</Text>
                        <Text style={pdfStyles.metaValue}>
                            {fmtCount(totals.activeBorrowCount)}
                        </Text>
                    </View>

                    <View style={pdfStyles.metaCard}>
                        <Text style={pdfStyles.metaLabel}>
                            Filipiniana Borrowed
                        </Text>
                        <Text style={pdfStyles.metaValue}>
                            {fmtCount(totals.filipinianaBorrowCount)}
                        </Text>
                    </View>

                    <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                        <Text style={pdfStyles.metaLabel}>
                            Filipiniana Active
                        </Text>
                        <Text style={pdfStyles.metaValue}>
                            {fmtCount(totals.filipinianaActiveBorrowCount)}
                        </Text>
                    </View>
                </View>

                <Text style={pdfStyles.sectionTitle}>Per-Book Statistics</Text>

                <View style={pdfStyles.tableHead}>
                    <View style={pdfStyles.colBook}>
                        <Text style={pdfStyles.th}>Book</Text>
                    </View>
                    <View style={pdfStyles.colArea}>
                        <Text style={pdfStyles.th}>Area / Genre</Text>
                    </View>
                    <View style={pdfStyles.colTotalBorrowed}>
                        <Text style={pdfStyles.th}>Total</Text>
                    </View>
                    <View style={pdfStyles.colActive}>
                        <Text style={pdfStyles.th}>Active</Text>
                    </View>
                    <View style={pdfStyles.colAvailable}>
                        <Text style={pdfStyles.th}>Available</Text>
                    </View>
                    <View style={pdfStyles.colTotalCopies}>
                        <Text style={pdfStyles.th}>Copies</Text>
                    </View>
                </View>

                {sorted.map((row) => (
                    <View key={String(row.id)} style={pdfStyles.row}>
                        <View style={pdfStyles.colBook}>
                            <Text style={pdfStyles.td}>
                                {row.title || `Book #${row.id}`}
                            </Text>
                            <Text style={pdfStyles.tdSubtle}>
                                {row.author || "Unknown Author"}
                            </Text>
                        </View>

                        <View style={pdfStyles.colArea}>
                            <Text style={pdfStyles.td}>
                                {normalizeLibraryAreaLabel(row.libraryArea)}
                            </Text>
                            <Text style={pdfStyles.tdSubtle}>
                                {row.genre || "—"}
                            </Text>
                        </View>

                        <View style={pdfStyles.colTotalBorrowed}>
                            <Text style={pdfStyles.td}>
                                {fmtCount(toNumber(row.totalBorrowCount))}
                            </Text>
                        </View>

                        <View style={pdfStyles.colActive}>
                            <Text style={pdfStyles.td}>
                                {fmtCount(toNumber(row.activeBorrowCount))}
                            </Text>
                        </View>

                        <View style={pdfStyles.colAvailable}>
                            <Text style={pdfStyles.td}>
                                {fmtCount(toNumber(row.availableCopies))}
                            </Text>
                        </View>

                        <View style={pdfStyles.colTotalCopies}>
                            <Text style={pdfStyles.td}>
                                {fmtCount(toNumber(row.totalCopies))}
                            </Text>
                        </View>
                    </View>
                ))}

                <View style={pdfStyles.totalsWrap}>
                    <View style={pdfStyles.totalsLine}>
                        <Text style={pdfStyles.totalsLabel}>Available Copies</Text>
                        <Text style={pdfStyles.totalsValue}>
                            {fmtCount(totals.availableCopies)}
                        </Text>
                    </View>
                    <View style={pdfStyles.totalsLine}>
                        <Text style={pdfStyles.totalsLabel}>Total Copies</Text>
                        <Text style={pdfStyles.totalsValue}>
                            {fmtCount(totals.totalCopies)}
                        </Text>
                    </View>
                    <View style={[pdfStyles.totalsLine, pdfStyles.totalsGrand]}>
                        <Text
                            style={[pdfStyles.totalsLabel, { fontWeight: 700 }]}
                        >
                            All-Time Borrow Count
                        </Text>
                        <Text
                            style={[pdfStyles.totalsValue, { fontSize: 10 }]}
                        >
                            {fmtCount(totals.totalBorrowCount)}
                        </Text>
                    </View>
                </View>

                {rankedProgramRecords.length ? (
                    <View style={pdfStyles.programSectionWrap}>
                        <Text style={pdfStyles.sectionTitle}>Borrowers by Program</Text>

                        <View style={pdfStyles.tableHead}>
                            <View style={pdfStyles.colProgram}>
                                <Text style={pdfStyles.th}>Program</Text>
                            </View>
                            <View style={pdfStyles.colProgramCollege}>
                                <Text style={pdfStyles.th}>College</Text>
                            </View>
                            <View style={pdfStyles.colProgramBorrowed}>
                                <Text style={pdfStyles.th}>Total</Text>
                            </View>
                            <View style={pdfStyles.colProgramActive}>
                                <Text style={pdfStyles.th}>Active</Text>
                            </View>
                        </View>

                        {rankedProgramRecords.map((row) => (
                            <View
                                key={`${row.college}-${row.program}`}
                                style={pdfStyles.row}
                            >
                                <View style={pdfStyles.colProgram}>
                                    <Text style={pdfStyles.td}>{row.program || "Unassigned"}</Text>
                                </View>

                                <View style={pdfStyles.colProgramCollege}>
                                    <View style={pdfStyles.programColorRow}>
                                        <View
                                            style={[
                                                pdfStyles.programColorDot,
                                                { backgroundColor: row.collegeColor || "#64748b" },
                                            ]}
                                        />
                                        <Text style={pdfStyles.td}>
                                            {row.college || "Unassigned"}
                                        </Text>
                                    </View>
                                </View>

                                <View style={pdfStyles.colProgramBorrowed}>
                                    <Text style={pdfStyles.td}>
                                        {fmtCount(toNumber(row.totalBorrowCount))}
                                    </Text>
                                </View>

                                <View style={pdfStyles.colProgramActive}>
                                    <Text style={pdfStyles.td}>
                                        {fmtCount(toNumber(row.activeBorrowCount))}
                                    </Text>
                                </View>
                            </View>
                        ))}

                        <View style={pdfStyles.totalsWrap}>
                            <View style={pdfStyles.totalsLine}>
                                <Text style={pdfStyles.totalsLabel}>Programs Represented</Text>
                                <Text style={pdfStyles.totalsValue}>
                                    {fmtCount(programTotals.programCount)}
                                </Text>
                            </View>
                            <View style={pdfStyles.totalsLine}>
                                <Text style={pdfStyles.totalsLabel}>Total Program Borrows</Text>
                                <Text style={pdfStyles.totalsValue}>
                                    {fmtCount(programTotals.totalBorrowCount)}
                                </Text>
                            </View>
                            <View style={[pdfStyles.totalsLine, pdfStyles.totalsGrand]}>
                                <Text style={[pdfStyles.totalsLabel, { fontWeight: 700 }]}>Active Program Borrows</Text>
                                <Text style={[pdfStyles.totalsValue, { fontSize: 10 }]}> 
                                    {fmtCount(programTotals.activeBorrowCount)}
                                </Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                <View style={pdfStyles.notesWrap}>
                    <Text style={pdfStyles.notesTitle}>Report Notes</Text>
                    <Text style={pdfStyles.noteText}>
                        1) Total = how many times the book has been borrowed.
                    </Text>
                    <Text style={pdfStyles.noteText}>
                        2) Active = borrow records not yet returned.
                    </Text>
                    <Text style={pdfStyles.noteText}>
                        3) Program summaries are grouped from the borrower course value attached to each borrow record.
                    </Text>
                    <Text style={pdfStyles.noteText}>
                        4) Program colors are based on the college attached to each program.
                    </Text>
                    <Text style={pdfStyles.noteText}>
                        5) This report is printable for librarian dashboard record-keeping.
                    </Text>
                </View>

                <View style={pdfStyles.footer}>
                    <Text style={pdfStyles.footerText}>
                        BookHive Library • Statistics Module
                    </Text>
                    <Text style={pdfStyles.footerText}>
                        Printed: {fmtDateTime(generatedAtIso)}
                    </Text>
                </View>
            </Page>
        </Document>
    );
}

export default function ExportPreviewStatistics({
    open,
    onOpenChange,
    records,
    programRecords = [],
    fileNamePrefix = "bookhive-statistics-report",
    reportTitle = "BookHive Library • Statistics Report",
    reportSubtitle = "Printable report for book borrowing statistics.",
}: ExportPreviewStatisticsProps) {
    const [viewerHeight, setViewerHeight] = React.useState(720);
    const [generatedAtIso, setGeneratedAtIso] = React.useState(() =>
        new Date().toISOString()
    );

    React.useEffect(() => {
        if (!open) return;
        setGeneratedAtIso(new Date().toISOString());
    }, [open, records.length, programRecords.length]);

    React.useEffect(() => {
        if (!open) return;

        const onResize = () => {
            const h = window.innerHeight;
            const next = Math.max(420, Math.min(h - 240, 980));
            setViewerHeight(next);
        };

        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [open]);

    const pdfNode = React.useMemo(
        () => (
            <StatisticsPdfDocument
                records={records}
                programRecords={programRecords}
                generatedAtIso={generatedAtIso}
                reportTitle={reportTitle}
                reportSubtitle={reportSubtitle}
            />
        ),
        [
            generatedAtIso,
            programRecords,
            records,
            reportSubtitle,
            reportTitle,
        ]
    );

    const fileName = React.useMemo(() => {
        const ymd = new Date(generatedAtIso).toISOString().slice(0, 10);
        return `${safeToken(fileNamePrefix)}-${ymd}.pdf`;
    }, [fileNamePrefix, generatedAtIso]);

    const totals = React.useMemo(() => {
        return records.reduce(
            (acc, row) => {
                acc.totalBorrowCount += toNumber(row.totalBorrowCount);
                acc.activeBorrowCount += toNumber(row.activeBorrowCount);

                if (row.libraryArea === "filipiniana") {
                    acc.filipinianaBorrowCount += toNumber(row.totalBorrowCount);
                }

                return acc;
            },
            {
                totalBorrowCount: 0,
                activeBorrowCount: 0,
                filipinianaBorrowCount: 0,
            }
        );
    }, [records]);

    const programTotals = React.useMemo(() => {
        return programRecords.reduce(
            (acc, row) => {
                acc.programCount += 1;
                acc.totalBorrowCount += toNumber(row.totalBorrowCount);
                return acc;
            },
            {
                programCount: 0,
                totalBorrowCount: 0,
            }
        );
    }, [programRecords]);

    const handlePrint = React.useCallback(async () => {
        if (!records.length) return;

        try {
            const blob = await pdf(pdfNode).toBlob();
            const blobUrl = URL.createObjectURL(blob);

            const iframe = document.createElement("iframe");
            iframe.style.position = "fixed";
            iframe.style.right = "0";
            iframe.style.bottom = "0";
            iframe.style.width = "0";
            iframe.style.height = "0";
            iframe.style.border = "0";
            iframe.src = blobUrl;

            iframe.onload = () => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        toast.success("Print dialog opened", {
                            description:
                                "You can print the statistics report now.",
                        });
                    } catch {
                        toast.error("Could not start print", {
                            description:
                                "Try using Download PDF, then print manually.",
                        });
                    } finally {
                        setTimeout(() => {
                            if (iframe.parentNode) {
                                iframe.parentNode.removeChild(iframe);
                            }
                            URL.revokeObjectURL(blobUrl);
                        }, 1500);
                    }
                }, 200);
            };

            document.body.appendChild(iframe);
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to generate PDF.";
            toast.error("Print failed", { description: message });
        }
    }, [pdfNode, records.length]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-6xl bg-slate-950 border-white/10 text-white p-0 overflow-hidden"
                style={{ height: "90svh" }}
            >
                <div className="px-5 pt-5 pb-3 border-b border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            Statistics PDF Preview & Export
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                            Review the librarian statistics report, then print or
                            download it as PDF.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-5 py-4 space-y-4 overflow-auto">
                    <Card className="bg-slate-900/70 border-white/10">
                        <CardContent className="pt-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="bg-sky-500/20 text-sky-100 border-sky-300/40">
                                        {records.length} record
                                        {records.length === 1 ? "" : "s"}
                                    </Badge>
                                    <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/40">
                                        Total Borrowed:{" "}
                                        {fmtCount(totals.totalBorrowCount)}
                                    </Badge>
                                    <Badge className="bg-amber-500/20 text-amber-100 border-amber-300/40">
                                        Active:{" "}
                                        {fmtCount(totals.activeBorrowCount)}
                                    </Badge>
                                    <Badge className="bg-purple-500/20 text-purple-100 border-purple-300/40">
                                        Filipiniana:{" "}
                                        {fmtCount(totals.filipinianaBorrowCount)}
                                    </Badge>
                                    <Badge className="bg-cyan-500/20 text-cyan-100 border-cyan-300/40">
                                        Programs: {fmtCount(programTotals.programCount)}
                                    </Badge>
                                    <Badge className="bg-indigo-500/20 text-indigo-100 border-indigo-300/40">
                                        Program Borrows: {fmtCount(programTotals.totalBorrowCount)}
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/10"
                                        onClick={() => void handlePrint()}
                                        disabled={!records.length}
                                    >
                                        <Printer className="mr-2 h-4 w-4" />
                                        Print now
                                    </Button>

                                    <PDFDownloadLink
                                        document={pdfNode}
                                        fileName={fileName}
                                    >
                                        {({ loading }) => (
                                            <Button
                                                type="button"
                                                className="bg-sky-600 hover:bg-sky-700 text-white"
                                                disabled={loading || !records.length}
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Preparing…
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Download PDF
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </PDFDownloadLink>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="rounded-md border border-white/10 bg-black/30 overflow-hidden">
                        {records.length ? (
                            <PDFViewer
                                style={{
                                    width: "100%",
                                    height: viewerHeight,
                                    border: "none",
                                }}
                                showToolbar
                            >
                                {pdfNode}
                            </PDFViewer>
                        ) : (
                            <div className="h-96 flex items-center justify-center text-sm text-white/60">
                                No statistics records available for preview.
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}