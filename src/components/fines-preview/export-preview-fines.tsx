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
import { Download, Loader2, Printer, ScanLine } from "lucide-react";
import { toast } from "sonner";

export type PrintableFineStatus = "active" | "paid" | "cancelled" | string;

export type PrintableFineRecord = {
    id: string | number;
    userId?: string | number | null;
    studentId?: string | number | null;
    studentName?: string | null;
    studentEmail?: string | null;
    bookTitle?: string | null;
    bookId?: string | number | null;
    reason?: string | null;
    status: PrintableFineStatus;
    amount: number;
    createdAt?: string | null;
    resolvedAt?: string | null;
    borrowDueDate?: string | null;
    borrowReturnDate?: string | null;
    sourceLabel?: "fine" | "damage" | null;
};

type ExportPreviewFinesProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    records: PrintableFineRecord[];
    selectedFineId?: string | number | null;
    autoPrintOnOpen?: boolean;
    fileNamePrefix?: string;
};

type FinesPdfDocProps = {
    records: PrintableFineRecord[];
    selectedFineId?: string | number | null;
    generatedAtIso: string;
};

function formatPHP(n: number) {
    if (typeof n !== "number" || Number.isNaN(n)) return "PHP 0.00";
    try {
        const formatted = new Intl.NumberFormat("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(n);
        return `PHP ${formatted}`;
    } catch {
        return `PHP ${n.toFixed(2)}`;
    }
}

function normalizeAmount(value: unknown): number {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
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

function statusText(status: PrintableFineStatus) {
    if (status === "active") return "Active";
    if (status === "paid") return "Paid";
    if (status === "cancelled") return "Cancelled";
    return status || "Unknown";
}

function safeToken(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

const pdfStyles = StyleSheet.create({
    page: {
        paddingTop: 24,
        paddingHorizontal: 24,
        paddingBottom: 24,
        fontSize: 9.5,
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
    selectedRow: {
        backgroundColor: "#eff6ff",
    },
    colFineId: { width: "11%" },
    colDetails: { width: "39%", paddingRight: 6 },
    colStatus: {
        width: "11%",
        alignItems: "center",
        justifyContent: "center",
    },
    colDate: { width: "13%" },
    colResolved: { width: "13%" },
    colAmount: { width: "13%", alignItems: "flex-end" },
    th: {
        fontSize: 8.25,
        fontWeight: 700,
        color: "#1e293b",
    },
    td: {
        fontSize: 8.75,
        color: "#0f172a",
    },
    tdSubtle: {
        fontSize: 7.8,
        color: "#475569",
        marginTop: 1,
    },
    statusBadgeWrap: {
        minHeight: 14,
        borderRadius: 999,
        paddingHorizontal: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    statusBadgeText: {
        fontSize: 7.4,
        lineHeight: 1.1,
        color: "#ffffff",
        fontWeight: 700,
        textAlign: "center",
    },
    statusActive: { backgroundColor: "#d97706" },
    statusPaid: { backgroundColor: "#059669" },
    statusCancelled: { backgroundColor: "#64748b" },
    statusDefault: { backgroundColor: "#334155" },
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

function FinesPdfDocument({
    records,
    selectedFineId,
    generatedAtIso,
}: FinesPdfDocProps) {
    const sorted = [...records].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

    const first = sorted[0];
    const userName =
        first?.studentName ||
        first?.studentEmail ||
        (first?.studentId ? `ID: ${first.studentId}` : "Unknown user");
    const userEmail = first?.studentEmail || "—";
    const userId = first?.studentId || first?.userId || "—";

    const total = sorted.reduce((sum, r) => sum + normalizeAmount(r.amount), 0);
    const paidTotal = sorted
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + normalizeAmount(r.amount), 0);
    const activeTotal = sorted
        .filter((r) => r.status === "active")
        .reduce((sum, r) => sum + normalizeAmount(r.amount), 0);

    const rowCount = sorted.length;

    return (
        <Document title="BookHive Fines Record">
            <Page size="A4" style={pdfStyles.page}>
                <View style={pdfStyles.hero}>
                    <Text style={pdfStyles.heroTitle}>BookHive Library • Fines Record Slip</Text>
                    <Text style={pdfStyles.heroSub}>
                        Printable payment/fine record for student/faculty release and cashier validation.
                    </Text>
                </View>

                <View style={pdfStyles.metaGrid}>
                    <View style={pdfStyles.metaCard}>
                        <Text style={pdfStyles.metaLabel}>Student / Faculty</Text>
                        <Text style={pdfStyles.metaValue}>{userName}</Text>
                    </View>
                    <View style={pdfStyles.metaCard}>
                        <Text style={pdfStyles.metaLabel}>School/User ID</Text>
                        <Text style={pdfStyles.metaValue}>{String(userId)}</Text>
                    </View>
                    <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                        <Text style={pdfStyles.metaLabel}>Email</Text>
                        <Text style={pdfStyles.metaValue}>{userEmail}</Text>
                    </View>
                </View>

                <View style={pdfStyles.metaGrid}>
                    <View style={pdfStyles.metaCard}>
                        <Text style={pdfStyles.metaLabel}>Generated</Text>
                        <Text style={pdfStyles.metaValue}>{fmtDateTime(generatedAtIso)}</Text>
                    </View>
                    <View style={pdfStyles.metaCard}>
                        <Text style={pdfStyles.metaLabel}>No. of Fine Records</Text>
                        <Text style={pdfStyles.metaValue}>{rowCount}</Text>
                    </View>
                    <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                        <Text style={pdfStyles.metaLabel}>Focused Fine</Text>
                        <Text style={pdfStyles.metaValue}>
                            {selectedFineId != null ? String(selectedFineId) : "—"}
                        </Text>
                    </View>
                </View>

                <Text style={pdfStyles.sectionTitle}>Fine Items</Text>

                <View style={pdfStyles.tableHead}>
                    <View style={pdfStyles.colFineId}>
                        <Text style={pdfStyles.th}>Fine ID</Text>
                    </View>
                    <View style={pdfStyles.colDetails}>
                        <Text style={pdfStyles.th}>Book / Reason</Text>
                    </View>
                    <View style={pdfStyles.colStatus}>
                        <Text style={pdfStyles.th}>Status</Text>
                    </View>
                    <View style={pdfStyles.colDate}>
                        <Text style={pdfStyles.th}>Created</Text>
                    </View>
                    <View style={pdfStyles.colResolved}>
                        <Text style={pdfStyles.th}>Resolved</Text>
                    </View>
                    <View style={pdfStyles.colAmount}>
                        <Text style={pdfStyles.th}>Amount</Text>
                    </View>
                </View>

                {sorted.map((r) => {
                    const isFocused = selectedFineId != null && String(r.id) === String(selectedFineId);
                    const statusStyle =
                        r.status === "paid"
                            ? pdfStyles.statusPaid
                            : r.status === "active"
                                ? pdfStyles.statusActive
                                : r.status === "cancelled"
                                    ? pdfStyles.statusCancelled
                                    : pdfStyles.statusDefault;

                    return (
                        <View
                            key={String(r.id)}
                            style={isFocused ? [pdfStyles.row, pdfStyles.selectedRow] : pdfStyles.row}
                        >
                            <View style={pdfStyles.colFineId}>
                                <Text style={pdfStyles.td}>{String(r.id)}</Text>
                            </View>

                            <View style={pdfStyles.colDetails}>
                                <Text style={pdfStyles.td}>
                                    {r.bookTitle ? r.bookTitle : r.bookId ? `Book #${r.bookId}` : "—"}
                                </Text>
                                {!!r.reason && <Text style={pdfStyles.tdSubtle}>Reason: {r.reason}</Text>}
                                {r.sourceLabel === "damage" && (
                                    <Text style={pdfStyles.tdSubtle}>Type: Damage-related fine</Text>
                                )}
                            </View>

                            <View style={pdfStyles.colStatus}>
                                <View style={[pdfStyles.statusBadgeWrap, statusStyle]}>
                                    <Text style={pdfStyles.statusBadgeText}>{statusText(r.status)}</Text>
                                </View>
                            </View>

                            <View style={pdfStyles.colDate}>
                                <Text style={pdfStyles.td}>{fmtDate(r.createdAt)}</Text>
                            </View>

                            <View style={pdfStyles.colResolved}>
                                <Text style={pdfStyles.td}>{fmtDate(r.resolvedAt)}</Text>
                            </View>

                            <View style={pdfStyles.colAmount}>
                                <Text style={pdfStyles.td}>{formatPHP(normalizeAmount(r.amount))}</Text>
                            </View>
                        </View>
                    );
                })}

                <View style={pdfStyles.totalsWrap}>
                    <View style={pdfStyles.totalsLine}>
                        <Text style={pdfStyles.totalsLabel}>Active / Unpaid Total</Text>
                        <Text style={pdfStyles.totalsValue}>{formatPHP(activeTotal)}</Text>
                    </View>
                    <View style={pdfStyles.totalsLine}>
                        <Text style={pdfStyles.totalsLabel}>Paid Total</Text>
                        <Text style={pdfStyles.totalsValue}>{formatPHP(paidTotal)}</Text>
                    </View>
                    <View style={[pdfStyles.totalsLine, pdfStyles.totalsGrand]}>
                        <Text style={[pdfStyles.totalsLabel, { fontWeight: 700 }]}>Grand Total</Text>
                        <Text style={[pdfStyles.totalsValue, { fontSize: 10 }]}>{formatPHP(total)}</Text>
                    </View>
                </View>

                <View style={pdfStyles.notesWrap}>
                    <Text style={pdfStyles.notesTitle}>Processing Notes</Text>
                    <Text style={pdfStyles.noteText}>1) Librarian issues payment slip for fines.</Text>
                    <Text style={pdfStyles.noteText}>
                        2) Student/Faculty pays at cashier and gets receipt.
                    </Text>
                    <Text style={pdfStyles.noteText}>
                        3) Student/Faculty returns to library with receipt.
                    </Text>
                    <Text style={pdfStyles.noteText}>
                        4) Librarian prints this record as paid confirmation slip.
                    </Text>
                    <Text style={pdfStyles.noteText}>
                        (Cebuano) Human bayad sa cashier ug resibo, mobalik sa library para ma-print ang paid
                        record.
                    </Text>
                </View>

                <View style={pdfStyles.footer}>
                    <Text style={pdfStyles.footerText}>BookHive Library • Generated via Fines Module</Text>
                    <Text style={pdfStyles.footerText}>Printed: {fmtDateTime(generatedAtIso)}</Text>
                </View>
            </Page>
        </Document>
    );
}

export function ExportPreviewFines({
    open,
    onOpenChange,
    records,
    selectedFineId = null,
    autoPrintOnOpen = false,
    fileNamePrefix = "bookhive-fines-record",
}: ExportPreviewFinesProps) {
    const [smartView, setSmartView] = React.useState(true);
    const [viewerHeight, setViewerHeight] = React.useState(720);
    const [generatedAtIso, setGeneratedAtIso] = React.useState(() => new Date().toISOString());
    const [smartPreviewUrl, setSmartPreviewUrl] = React.useState<string | null>(null);
    const [smartPreviewBusy, setSmartPreviewBusy] = React.useState(false);
    const autoPrintedRef = React.useRef(false);

    React.useEffect(() => {
        if (!open) {
            autoPrintedRef.current = false;
            return;
        }
        setGeneratedAtIso(new Date().toISOString());
    }, [open, records.length]);

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
            <FinesPdfDocument
                records={records}
                selectedFineId={selectedFineId}
                generatedAtIso={generatedAtIso}
            />
        ),
        [records, selectedFineId, generatedAtIso]
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
    }, [open, records.length, pdfNode]);

    const fileName = React.useMemo(() => {
        if (!records.length) return `${fileNamePrefix}.pdf`;
        const first = records[0];
        const rawUser =
            String(first.studentId ?? "").trim() ||
            String(first.userId ?? "").trim() ||
            String(first.studentEmail ?? "").trim() ||
            "user";
        const ymd = new Date(generatedAtIso).toISOString().slice(0, 10);
        return `${safeToken(fileNamePrefix)}-${safeToken(rawUser)}-${ymd}.pdf`;
    }, [records, generatedAtIso, fileNamePrefix]);

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
                            description: "You can print the fines record now.",
                        });
                    } catch {
                        toast.error("Could not start print", {
                            description: "Try using Download PDF, then print manually.",
                        });
                    } finally {
                        setTimeout(() => {
                            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                            URL.revokeObjectURL(blobUrl);
                        }, 1500);
                    }
                }, 200);
            };

            document.body.appendChild(iframe);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to generate PDF.";
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

    const paidCount = records.filter((r) => r.status === "paid").length;
    const activeCount = records.filter((r) => r.status === "active").length;
    const total = records.reduce((sum, r) => sum + normalizeAmount(r.amount), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-6xl bg-slate-950 border-white/10 text-white p-0 overflow-hidden h-[90svh]">
                <div className="px-5 pt-5 pb-3 border-b border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            Fines PDF Preview & Export
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                            Smart View uses a fit-width pre-rendered preview. Standard View uses PDF React Viewer
                            with toolbar.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <Card className="bg-slate-900/70 border-white/10">
                        <CardContent className="pt-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="bg-sky-500/20 text-sky-100 border-sky-300/40">
                                        {records.length} record{records.length === 1 ? "" : "s"}
                                    </Badge>
                                    <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/40">
                                        Paid: {paidCount}
                                    </Badge>
                                    <Badge className="bg-amber-500/20 text-amber-100 border-amber-300/40">
                                        Active: {activeCount}
                                    </Badge>
                                    <Badge className="bg-purple-500/20 text-purple-100 border-purple-300/40">
                                        Total: {formatPHP(total)}
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
                                            {smartView ? "Smart View (Fit Width)" : "Standard Viewer"}
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
                                        {smartView ? "Use Standard Viewer" : "Use Smart View"}
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

                                    <PDFDownloadLink document={pdfNode} fileName={fileName}>
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
                                        title="Smart Fines PDF Preview"
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
                                        height: 720,
                                        border: "none",
                                    }}
                                    showToolbar
                                >
                                    {pdfNode}
                                </PDFViewer>
                            )
                        ) : (
                            <div className="h-[420px] flex items-center justify-center text-sm text-white/60">
                                No fine records available for preview.
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ExportPreviewFines;
