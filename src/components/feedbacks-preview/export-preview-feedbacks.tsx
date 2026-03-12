"use client";

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
import { Download, FileText, Loader2, Printer, ScanLine } from "lucide-react";
import { toast } from "sonner";

export type PrintableFeedbackRecord = {
    id: string | number;
    userId?: string | number | null;
    studentId?: string | number | null;
    studentName?: string | null;
    studentEmail?: string | null;
    bookTitle?: string | null;
    bookId?: string | number | null;
    rating?: number | string | null;
    comment?: string | null;
    createdAt?: string | null;
};

type ExportPreviewFeedbacksProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    records: PrintableFeedbackRecord[];
    autoPrintOnOpen?: boolean;
    fileNamePrefix?: string;
    reportTitle?: string;
    reportSubtitle?: string;
};

type FeedbacksPdfDocProps = {
    records: PrintableFeedbackRecord[];
    generatedAtIso: string;
    reportTitle?: string;
    reportSubtitle?: string;
};

function normalizeRating(value: unknown): number {
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(5, Math.round(num)));
}

function fmtDate(value?: string | null) {
    if (!value) return "—";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString("en-CA");
    } catch {
        return value;
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

function getUserPrimary(record: PrintableFeedbackRecord) {
    return (
        (record.studentName && String(record.studentName).trim()) ||
        (record.studentEmail && String(record.studentEmail).trim()) ||
        (record.studentId ? `Student ID: ${record.studentId}` : null) ||
        (record.userId ? `User ID: ${record.userId}` : null) ||
        "Unknown user"
    );
}

function getUserSecondary(record: PrintableFeedbackRecord) {
    const parts: string[] = [];
    if (record.studentId) parts.push(`Student ID: ${record.studentId}`);
    if (record.studentEmail && record.studentEmail !== getUserPrimary(record)) {
        parts.push(String(record.studentEmail));
    }
    if (!record.studentId && !record.studentEmail && record.userId) {
        parts.push(`User ID: ${record.userId}`);
    }
    return parts.join(" · ");
}

function getBookPrimary(record: PrintableFeedbackRecord) {
    return (
        (record.bookTitle && String(record.bookTitle).trim()) ||
        (record.bookId ? `Book #${record.bookId}` : null) ||
        "Unknown book"
    );
}

function chunkRecords<T>(items: T[], size: number): T[][] {
    if (!items.length) return [[]];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

const pdfStyles = StyleSheet.create({
    page: {
        paddingTop: 24,
        paddingHorizontal: 24,
        paddingBottom: 24,
        fontSize: 9,
        color: "#0f172a",
        fontFamily: "Helvetica",
        lineHeight: 1.3,
    },
    hero: {
        backgroundColor: "#0f172a",
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
    },
    heroCompact: {
        paddingVertical: 8,
        marginBottom: 8,
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
    pageIndicator: {
        fontSize: 7.7,
        color: "#475569",
        textAlign: "right",
        marginBottom: 4,
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
        alignItems: "flex-start",
    },
    colId: { width: "10%", paddingRight: 6 },
    colUser: { width: "22%", paddingRight: 6 },
    colBook: { width: "21%", paddingRight: 6 },
    colRating: {
        width: "10%",
        paddingRight: 6,
        alignItems: "center",
    },
    colDate: { width: "12%", paddingRight: 6 },
    colComment: { width: "25%" },
    th: {
        fontSize: 8.1,
        fontWeight: 700,
        color: "#1e293b",
    },
    thCenter: {
        fontSize: 8.1,
        fontWeight: 700,
        color: "#1e293b",
        textAlign: "center",
    },
    td: {
        fontSize: 8.4,
        color: "#0f172a",
        lineHeight: 1.25,
    },
    tdSubtle: {
        fontSize: 7.45,
        color: "#475569",
        marginTop: 1,
        lineHeight: 1.2,
    },
    tdCenter: {
        fontSize: 8.4,
        color: "#0f172a",
        lineHeight: 1.25,
        textAlign: "center",
    },
    commentText: {
        fontSize: 8.15,
        color: "#0f172a",
        lineHeight: 1.25,
    },
    emptyRowText: {
        fontSize: 8.4,
        color: "#475569",
        textAlign: "center",
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
        lineHeight: 1.25,
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

function FeedbacksPdfDocument({
    records,
    generatedAtIso,
    reportTitle,
    reportSubtitle,
}: FeedbacksPdfDocProps) {
    const sorted = [...records].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

    const totalRating = sorted.reduce(
        (sum, item) => sum + normalizeRating(item.rating),
        0
    );
    const averageRating = sorted.length ? totalRating / sorted.length : 0;

    const fiveStarCount = sorted.filter(
        (item) => normalizeRating(item.rating) === 5
    ).length;
    const fourStarCount = sorted.filter(
        (item) => normalizeRating(item.rating) === 4
    ).length;
    const threeOrLowerCount = sorted.filter(
        (item) => normalizeRating(item.rating) <= 3
    ).length;
    const withCommentCount = sorted.filter(
        (item) => !!String(item.comment ?? "").trim()
    ).length;

    const dateValues = sorted
        .map((item) => item.createdAt)
        .filter(Boolean)
        .map((value) => new Date(String(value)))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

    const dateRange =
        dateValues.length > 0
            ? `${fmtDate(dateValues[0].toISOString())} → ${fmtDate(
                  dateValues[dateValues.length - 1].toISOString()
              )}`
            : "—";

    const defaultTitle = "BookHive Library • Feedbacks Report";
    const defaultSubtitle =
        "Printable report for the current feedback filters in the librarian dashboard.";

    const pages = chunkRecords(sorted, 12);

    return (
        <Document title={reportTitle || defaultTitle}>
            {pages.map((pageRows, pageIndex) => {
                const isFirstPage = pageIndex === 0;
                const isLastPage = pageIndex === pages.length - 1;
                const heroStyle = isFirstPage
                    ? pdfStyles.hero
                    : [pdfStyles.hero, pdfStyles.heroCompact];

                return (
                    <Page
                        key={`feedback-page-${pageIndex + 1}`}
                        size="A4"
                        style={pdfStyles.page}
                    >
                        <View style={heroStyle}>
                            <Text style={pdfStyles.heroTitle}>
                                {reportTitle || defaultTitle}
                            </Text>
                            <Text style={pdfStyles.heroSub}>
                                {reportSubtitle || defaultSubtitle}
                                {pages.length > 1
                                    ? ` • Page ${pageIndex + 1} of ${pages.length}`
                                    : ""}
                            </Text>
                        </View>

                        {isFirstPage ? (
                            <>
                                <View style={pdfStyles.metaGrid}>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Generated</Text>
                                        <Text style={pdfStyles.metaValue}>
                                            {fmtDateTime(generatedAtIso)}
                                        </Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Rows in View</Text>
                                        <Text style={pdfStyles.metaValue}>{sorted.length}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Average Rating</Text>
                                        <Text style={pdfStyles.metaValue}>
                                            {averageRating.toFixed(2)} / 5
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            pdfStyles.metaCard,
                                            pdfStyles.metaCardLast,
                                        ]}
                                    >
                                        <Text style={pdfStyles.metaLabel}>Date Coverage</Text>
                                        <Text style={pdfStyles.metaValue}>{dateRange}</Text>
                                    </View>
                                </View>

                                <View style={pdfStyles.metaGrid}>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>5 Star Ratings</Text>
                                        <Text style={pdfStyles.metaValue}>{fiveStarCount}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>4 Star Ratings</Text>
                                        <Text style={pdfStyles.metaValue}>{fourStarCount}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>3 Stars & Below</Text>
                                        <Text style={pdfStyles.metaValue}>
                                            {threeOrLowerCount}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            pdfStyles.metaCard,
                                            pdfStyles.metaCardLast,
                                        ]}
                                    >
                                        <Text style={pdfStyles.metaLabel}>With Comment</Text>
                                        <Text style={pdfStyles.metaValue}>
                                            {withCommentCount}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <Text style={pdfStyles.pageIndicator}>
                                Continuation of feedback entries
                            </Text>
                        )}

                        <Text style={pdfStyles.sectionTitle}>Feedback Entries</Text>

                        <View style={pdfStyles.tableHead}>
                            <View style={pdfStyles.colId}>
                                <Text style={pdfStyles.th}>ID</Text>
                            </View>
                            <View style={pdfStyles.colUser}>
                                <Text style={pdfStyles.th}>User</Text>
                            </View>
                            <View style={pdfStyles.colBook}>
                                <Text style={pdfStyles.th}>Book</Text>
                            </View>
                            <View style={pdfStyles.colRating}>
                                <Text style={pdfStyles.thCenter}>Rating</Text>
                            </View>
                            <View style={pdfStyles.colDate}>
                                <Text style={pdfStyles.th}>Submitted</Text>
                            </View>
                            <View style={pdfStyles.colComment}>
                                <Text style={pdfStyles.th}>Comment</Text>
                            </View>
                        </View>

                        {pageRows.length ? (
                            pageRows.map((record) => (
                                <View
                                    key={`${String(record.id)}-${pageIndex}`}
                                    style={pdfStyles.row}
                                    wrap={false}
                                >
                                    <View style={pdfStyles.colId}>
                                        <Text style={pdfStyles.td}>
                                            {String(record.id)}
                                        </Text>
                                    </View>

                                    <View style={pdfStyles.colUser}>
                                        <Text style={pdfStyles.td}>
                                            {getUserPrimary(record)}
                                        </Text>
                                        {!!getUserSecondary(record) && (
                                            <Text style={pdfStyles.tdSubtle}>
                                                {getUserSecondary(record)}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={pdfStyles.colBook}>
                                        <Text style={pdfStyles.td}>
                                            {getBookPrimary(record)}
                                        </Text>
                                    </View>

                                    <View style={pdfStyles.colRating}>
                                        <Text style={pdfStyles.tdCenter}>
                                            {normalizeRating(record.rating)}/5
                                        </Text>
                                    </View>

                                    <View style={pdfStyles.colDate}>
                                        <Text style={pdfStyles.td}>
                                            {fmtDate(record.createdAt)}
                                        </Text>
                                    </View>

                                    <View style={pdfStyles.colComment}>
                                        <Text style={pdfStyles.commentText}>
                                            {String(record.comment ?? "").trim() || "—"}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={pdfStyles.row}>
                                <View style={{ width: "100%" }}>
                                    <Text style={pdfStyles.emptyRowText}>
                                        No feedback records available for this report.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {isLastPage ? (
                            <>
                                <View style={pdfStyles.totalsWrap}>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>
                                            Total Feedback Entries
                                        </Text>
                                        <Text style={pdfStyles.totalsValue}>
                                            {sorted.length}
                                        </Text>
                                    </View>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>
                                            Average Rating
                                        </Text>
                                        <Text style={pdfStyles.totalsValue}>
                                            {averageRating.toFixed(2)} / 5
                                        </Text>
                                    </View>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>
                                            Entries With Comment
                                        </Text>
                                        <Text style={pdfStyles.totalsValue}>
                                            {withCommentCount}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            pdfStyles.totalsLine,
                                            pdfStyles.totalsGrand,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                pdfStyles.totalsLabel,
                                                { fontWeight: 700 },
                                            ]}
                                        >
                                            Highest Rating Count
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.totalsValue,
                                                { fontSize: 10 },
                                            ]}
                                        >
                                            5★ = {fiveStarCount}
                                        </Text>
                                    </View>
                                </View>

                                <View style={pdfStyles.notesWrap}>
                                    <Text style={pdfStyles.notesTitle}>
                                        Report Notes
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        1) This PDF reflects the currently filtered feedback list from the librarian dashboard.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        2) User and book fields fall back to available IDs when names or titles are unavailable.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        3) Long comments are wrapped to fit the printable layout.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        4) Ratings are normalized to a 1 to 5 scale for summary calculations.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        (Cebuano) Ang gi-print nga report kay base sa current filtered feedback list ug naka-wrap ang taas nga comments aron dili mo-slide.
                                    </Text>
                                </View>
                            </>
                        ) : null}

                        <View style={pdfStyles.footer}>
                            <Text style={pdfStyles.footerText}>
                                BookHive Library • Generated via Feedbacks Module
                            </Text>
                            <Text style={pdfStyles.footerText}>
                                Printed: {fmtDateTime(generatedAtIso)}
                            </Text>
                        </View>
                    </Page>
                );
            })}
        </Document>
    );
}

export function ExportPreviewFeedbacks({
    open,
    onOpenChange,
    records,
    autoPrintOnOpen = false,
    fileNamePrefix = "bookhive-feedbacks-report",
    reportTitle = "BookHive Library • Feedbacks Report",
    reportSubtitle = "Printable report for the current feedback filters in the librarian dashboard.",
}: ExportPreviewFeedbacksProps) {
    const [smartView, setSmartView] = React.useState(true);
    const [viewerHeight, setViewerHeight] = React.useState(720);
    const [generatedAtIso, setGeneratedAtIso] = React.useState(() =>
        new Date().toISOString()
    );
    const [smartPreviewUrl, setSmartPreviewUrl] = React.useState<string | null>(
        null
    );
    const [smartPreviewBusy, setSmartPreviewBusy] = React.useState(false);
    const autoPrintedRef = React.useRef(false);

    React.useEffect(() => {
        if (!open) {
            autoPrintedRef.current = false;
            return;
        }
        setGeneratedAtIso(new Date().toISOString());
    }, [open, records]);

    React.useEffect(() => {
        if (!open) return;

        const onResize = () => {
            const h = window.innerHeight;
            const next = Math.max(420, Math.min(h - 240, 1000));
            setViewerHeight(next);
        };

        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [open]);

    const pdfNode = React.useMemo(
        () => (
            <FeedbacksPdfDocument
                records={records}
                generatedAtIso={generatedAtIso}
                reportTitle={reportTitle}
                reportSubtitle={reportSubtitle}
            />
        ),
        [records, generatedAtIso, reportTitle, reportSubtitle]
    );

    React.useEffect(() => {
        let cancelled = false;
        let localUrl: string | null = null;

        async function buildSmartPreview() {
            if (!open || !records.length) {
                setSmartPreviewUrl(null);
                return;
            }

            setSmartPreviewBusy(true);
            try {
                const blob = await pdf(pdfNode).toBlob();
                if (cancelled) return;

                localUrl = URL.createObjectURL(blob);
                setSmartPreviewUrl(localUrl);
            } catch {
                if (!cancelled) {
                    setSmartPreviewUrl(null);
                }
            } finally {
                if (!cancelled) {
                    setSmartPreviewBusy(false);
                }
            }
        }

        void buildSmartPreview();

        return () => {
            cancelled = true;
            if (localUrl) {
                URL.revokeObjectURL(localUrl);
            }
        };
    }, [open, records, pdfNode]);

    const fileName = React.useMemo(() => {
        const ymd = new Date(generatedAtIso).toISOString().slice(0, 10);
        return `${safeToken(fileNamePrefix)}-${ymd}.pdf`;
    }, [generatedAtIso, fileNamePrefix]);

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
                            description: "You can print the feedback report now.",
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
                err instanceof Error ? err.message : "Failed to generate PDF.";
            toast.error("Print failed", { description: message });
        }
    }, [records.length, pdfNode]);

    React.useEffect(() => {
        if (!open || !autoPrintOnOpen || autoPrintedRef.current || !records.length) {
            return;
        }
        autoPrintedRef.current = true;
        void handlePrint();
    }, [open, autoPrintOnOpen, records.length, handlePrint]);

    const averageRating = records.length
        ? (
              records.reduce((sum, record) => sum + normalizeRating(record.rating), 0) /
              records.length
          ).toFixed(2)
        : "0.00";

    const fiveStarCount = records.filter(
        (record) => normalizeRating(record.rating) === 5
    ).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-6xl bg-slate-950 border-white/10 text-white p-0 overflow-hidden h-[90svh]">
                <div className="px-5 pt-5 pb-3 border-b border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            Feedbacks PDF Preview & Export
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                            Smart View uses a fit-width pre-rendered preview. Standard View uses PDF React Viewer with toolbar for the current filtered feedback list.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <Card className="bg-slate-900/70 border-white/10">
                        <CardContent className="pt-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="bg-sky-500/20 text-sky-100 border-sky-300/40">
                                        <span className="inline-flex items-center gap-1">
                                            <FileText className="h-3.5 w-3.5" />
                                            {records.length} record
                                            {records.length === 1 ? "" : "s"}
                                        </span>
                                    </Badge>
                                    <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/40">
                                        Avg: {averageRating}/5
                                    </Badge>
                                    <Badge className="bg-amber-500/20 text-amber-100 border-amber-300/40">
                                        5★: {fiveStarCount}
                                    </Badge>
                                    <Badge
                                        className={
                                            smartView
                                                ? "bg-cyan-500/20 text-cyan-100 border-cyan-300/40"
                                                : "bg-slate-500/20 text-slate-100 border-slate-300/40"
                                        }
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            <ScanLine className="h-3.5 w-3.5" />
                                            {smartView
                                                ? "Smart View (Fit Width)"
                                                : "Standard Viewer"}
                                        </span>
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-white/20 text-white hover:bg-white/10"
                                        onClick={() => setSmartView((v) => !v)}
                                    >
                                        {smartView
                                            ? "Use Standard Viewer"
                                            : "Use Smart View"}
                                    </Button>

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
                            smartView ? (
                                smartPreviewBusy ? (
                                    <div
                                        className="flex items-center justify-center text-sm text-white/70"
                                        style={{ height: viewerHeight }}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Rendering smart preview…
                                        </span>
                                    </div>
                                ) : smartPreviewUrl ? (
                                    <iframe
                                        title="Smart Feedbacks PDF Preview"
                                        src={`${smartPreviewUrl}#view=FitH&toolbar=1&navpanes=0`}
                                        style={{
                                            width: "100%",
                                            height: viewerHeight,
                                            border: "none",
                                        }}
                                    />
                                ) : (
                                    <div
                                        className="flex items-center justify-center text-sm text-white/60"
                                        style={{ height: viewerHeight }}
                                    >
                                        Could not render smart preview. Switch to Standard Viewer.
                                    </div>
                                )
                            ) : (
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
                            )
                        ) : (
                            <div className="h-[420px] flex items-center justify-center text-sm text-white/60">
                                No feedback records available for preview.
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ExportPreviewFeedbacks;