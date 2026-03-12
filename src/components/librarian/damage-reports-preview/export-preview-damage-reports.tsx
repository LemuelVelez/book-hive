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

export type PrintableDamageStatus = "pending" | "assessed" | "paid" | string;
export type PrintableDamageSeverity = "minor" | "moderate" | "major" | string;

export type PrintableDamageRecord = {
    id: string | number;
    reportedBy?: string | null;
    reportedByEmail?: string | null;
    reportedBySchoolId?: string | number | null;
    liableUser?: string | null;
    liableUserEmail?: string | null;
    liableUserSchoolId?: string | number | null;
    bookTitle?: string | null;
    bookId?: string | number | null;
    damageType?: string | null;
    severity: PrintableDamageSeverity;
    status: PrintableDamageStatus;
    archived?: boolean;
    fee?: number | null;
    reportedAt?: string | null;
    paidAt?: string | null;
    notes?: string | null;
    photoCount?: number;
    scopeLabel?: "active" | "paid_archive" | string | null;
};

type ExportPreviewDamageReportsProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    records: PrintableDamageRecord[];
    autoPrintOnOpen?: boolean;
    fileNamePrefix?: string;
    reportTitle?: string;
    reportSubtitle?: string;
};

type DamageReportsPdfDocProps = {
    records: PrintableDamageRecord[];
    generatedAtIso: string;
    reportTitle?: string;
    reportSubtitle?: string;
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

function statusText(status: PrintableDamageStatus) {
    if (status === "pending") return "Pending";
    if (status === "assessed") return "Assessed";
    if (status === "paid") return "Paid";
    return status || "Unknown";
}

function severityText(severity: PrintableDamageSeverity) {
    if (severity === "minor") return "Minor";
    if (severity === "moderate") return "Moderate";
    if (severity === "major") return "Major";
    return severity || "Unknown";
}

function scopeText(scope?: PrintableDamageRecord["scopeLabel"]) {
    if (scope === "active") return "Active";
    if (scope === "paid_archive") return "Paid archive";
    return "Damage report";
}

function safeToken(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function getRecordDate(record: PrintableDamageRecord) {
    return record.paidAt || record.reportedAt || null;
}

function getReportedByPrimary(record: PrintableDamageRecord) {
    return (
        (record.reportedBy && String(record.reportedBy).trim()) ||
        (record.reportedByEmail && String(record.reportedByEmail).trim()) ||
        (record.reportedBySchoolId ? `ID: ${record.reportedBySchoolId}` : null) ||
        "Unknown reporter"
    );
}

function getReportedBySecondary(record: PrintableDamageRecord) {
    const parts: string[] = [];
    if (record.reportedBySchoolId) parts.push(`ID: ${record.reportedBySchoolId}`);
    if (record.reportedByEmail && record.reportedByEmail !== getReportedByPrimary(record)) {
        parts.push(String(record.reportedByEmail));
    }
    return parts.join(" • ");
}

function getLiablePrimary(record: PrintableDamageRecord) {
    return (
        (record.liableUser && String(record.liableUser).trim()) ||
        (record.liableUserEmail && String(record.liableUserEmail).trim()) ||
        (record.liableUserSchoolId ? `ID: ${record.liableUserSchoolId}` : null) ||
        "Unassigned"
    );
}

function getLiableSecondary(record: PrintableDamageRecord) {
    const parts: string[] = [];
    if (record.liableUserSchoolId) parts.push(`ID: ${record.liableUserSchoolId}`);
    if (record.liableUserEmail && record.liableUserEmail !== getLiablePrimary(record)) {
        parts.push(String(record.liableUserEmail));
    }
    return parts.join(" • ");
}

function getBookPrimary(record: PrintableDamageRecord) {
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
    colPeople: { width: "26%", paddingRight: 6 },
    colDetails: { width: "28%", paddingRight: 6 },
    colStatus: {
        width: "12%",
        paddingRight: 4,
        alignItems: "center",
    },
    colDates: { width: "12%", paddingRight: 4 },
    colAmount: { width: "12%", alignItems: "flex-end" },
    th: {
        fontSize: 8.2,
        fontWeight: 700,
        color: "#1e293b",
    },
    thCenter: {
        fontSize: 8.2,
        fontWeight: 700,
        color: "#1e293b",
        textAlign: "center",
    },
    thRight: {
        fontSize: 8.2,
        fontWeight: 700,
        color: "#1e293b",
        textAlign: "right",
    },
    td: {
        fontSize: 8.4,
        color: "#0f172a",
        lineHeight: 1.24,
    },
    tdSubtle: {
        fontSize: 7.45,
        color: "#475569",
        marginTop: 1,
        lineHeight: 1.2,
    },
    tdRight: {
        fontSize: 8.4,
        color: "#0f172a",
        lineHeight: 1.24,
        textAlign: "right",
    },
    statusBadgeWrap: {
        minHeight: 14,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
        justifyContent: "center",
        alignItems: "center",
    },
    statusBadgeText: {
        fontSize: 7.2,
        lineHeight: 1.1,
        color: "#ffffff",
        fontWeight: 700,
        textAlign: "center",
    },
    statusPending: { backgroundColor: "#ca8a04" },
    statusAssessed: { backgroundColor: "#2563eb" },
    statusPaid: { backgroundColor: "#059669" },
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

function DamageReportsPdfDocument({
    records,
    generatedAtIso,
    reportTitle,
    reportSubtitle,
}: DamageReportsPdfDocProps) {
    const sorted = [...records].sort((a, b) =>
        String(getRecordDate(b) ?? "").localeCompare(String(getRecordDate(a) ?? ""))
    );

    const totalFine = sorted.reduce((sum, r) => sum + normalizeAmount(r.fee), 0);
    const pendingCount = sorted.filter((r) => r.status === "pending").length;
    const assessedCount = sorted.filter((r) => r.status === "assessed").length;
    const paidCount = sorted.filter((r) => r.status === "paid").length;
    const archivedCount = sorted.filter((r) => Boolean(r.archived)).length;

    const dateValues = sorted
        .map((r) => getRecordDate(r))
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

    const defaultTitle = "BookHive Library • Damage Reports";
    const defaultSubtitle =
        "Printable report for active and paid/archive damage report records.";

    const pages = chunkRecords(sorted, 11);

    return (
        <Document title={reportTitle || defaultTitle}>
            {pages.map((pageRows, pageIndex) => {
                const isFirstPage = pageIndex === 0;
                const isLastPage = pageIndex === pages.length - 1;
                const heroStyle = isFirstPage
                    ? pdfStyles.hero
                    : [pdfStyles.hero, pdfStyles.heroCompact];

                return (
                    <Page key={`damage-reports-page-${pageIndex + 1}`} size="A4" style={pdfStyles.page}>
                        <View style={heroStyle}>
                            <Text style={pdfStyles.heroTitle}>{reportTitle || defaultTitle}</Text>
                            <Text style={pdfStyles.heroSub}>
                                {reportSubtitle || defaultSubtitle}
                                {pages.length > 1 ? ` • Page ${pageIndex + 1} of ${pages.length}` : ""}
                            </Text>
                        </View>

                        {isFirstPage ? (
                            <>
                                <View style={pdfStyles.metaGrid}>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Generated</Text>
                                        <Text style={pdfStyles.metaValue}>{fmtDateTime(generatedAtIso)}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Rows in View</Text>
                                        <Text style={pdfStyles.metaValue}>{sorted.length}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Fine Total</Text>
                                        <Text style={pdfStyles.metaValue}>{formatPHP(totalFine)}</Text>
                                    </View>
                                    <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                                        <Text style={pdfStyles.metaLabel}>Date Coverage</Text>
                                        <Text style={pdfStyles.metaValue}>{dateRange}</Text>
                                    </View>
                                </View>

                                <View style={pdfStyles.metaGrid}>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Pending</Text>
                                        <Text style={pdfStyles.metaValue}>{pendingCount}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Assessed</Text>
                                        <Text style={pdfStyles.metaValue}>{assessedCount}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Paid</Text>
                                        <Text style={pdfStyles.metaValue}>{paidCount}</Text>
                                    </View>
                                    <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                                        <Text style={pdfStyles.metaLabel}>Archived</Text>
                                        <Text style={pdfStyles.metaValue}>{archivedCount}</Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <Text style={pdfStyles.pageIndicator}>Continuation of damage report items</Text>
                        )}

                        <Text style={pdfStyles.sectionTitle}>Damage Report Items</Text>

                        <View style={pdfStyles.tableHead}>
                            <View style={pdfStyles.colId}>
                                <Text style={pdfStyles.th}>ID</Text>
                            </View>
                            <View style={pdfStyles.colPeople}>
                                <Text style={pdfStyles.th}>Reported / Liable</Text>
                            </View>
                            <View style={pdfStyles.colDetails}>
                                <Text style={pdfStyles.th}>Book / Damage</Text>
                            </View>
                            <View style={pdfStyles.colStatus}>
                                <Text style={pdfStyles.thCenter}>Status</Text>
                            </View>
                            <View style={pdfStyles.colDates}>
                                <Text style={pdfStyles.th}>Dates</Text>
                            </View>
                            <View style={pdfStyles.colAmount}>
                                <Text style={pdfStyles.thRight}>Fine</Text>
                            </View>
                        </View>

                        {pageRows.length ? (
                            pageRows.map((record) => {
                                const statusStyle =
                                    record.status === "paid"
                                        ? pdfStyles.statusPaid
                                        : record.status === "assessed"
                                          ? pdfStyles.statusAssessed
                                          : record.status === "pending"
                                            ? pdfStyles.statusPending
                                            : pdfStyles.statusDefault;

                                return (
                                    <View
                                        key={`${String(record.id)}-${pageIndex}`}
                                        style={pdfStyles.row}
                                        wrap={false}
                                    >
                                        <View style={pdfStyles.colId}>
                                            <Text style={pdfStyles.td}>{String(record.id)}</Text>
                                            <Text style={pdfStyles.tdSubtle}>{scopeText(record.scopeLabel)}</Text>
                                        </View>

                                        <View style={pdfStyles.colPeople}>
                                            <Text style={pdfStyles.td}>{getReportedByPrimary(record)}</Text>
                                            {!!getReportedBySecondary(record) && (
                                                <Text style={pdfStyles.tdSubtle}>{getReportedBySecondary(record)}</Text>
                                            )}
                                            <Text style={[pdfStyles.tdSubtle, { marginTop: 3 }]}>
                                                Liable: {getLiablePrimary(record)}
                                            </Text>
                                            {!!getLiableSecondary(record) && (
                                                <Text style={pdfStyles.tdSubtle}>{getLiableSecondary(record)}</Text>
                                            )}
                                        </View>

                                        <View style={pdfStyles.colDetails}>
                                            <Text style={pdfStyles.td}>{getBookPrimary(record)}</Text>
                                            <Text style={pdfStyles.tdSubtle}>
                                                Damage: {record.damageType || "—"} • {severityText(record.severity)}
                                            </Text>
                                            {typeof record.photoCount === "number" && (
                                                <Text style={pdfStyles.tdSubtle}>
                                                    Photos: {record.photoCount}
                                                </Text>
                                            )}
                                            {!!record.notes && (
                                                <Text style={pdfStyles.tdSubtle}>Notes: {record.notes}</Text>
                                            )}
                                        </View>

                                        <View style={pdfStyles.colStatus}>
                                            <View style={[pdfStyles.statusBadgeWrap, statusStyle]}>
                                                <Text style={pdfStyles.statusBadgeText}>{statusText(record.status)}</Text>
                                            </View>
                                            {record.archived ? (
                                                <Text style={[pdfStyles.tdSubtle, { marginTop: 4 }]}>Archived</Text>
                                            ) : null}
                                        </View>

                                        <View style={pdfStyles.colDates}>
                                            <Text style={pdfStyles.td}>Reported: {fmtDate(record.reportedAt)}</Text>
                                            <Text style={pdfStyles.tdSubtle}>Paid: {fmtDate(record.paidAt)}</Text>
                                        </View>

                                        <View style={pdfStyles.colAmount}>
                                            <Text style={pdfStyles.tdRight}>
                                                {formatPHP(normalizeAmount(record.fee))}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })
                        ) : (
                            <View style={pdfStyles.row}>
                                <View style={{ width: "100%" }}>
                                    <Text style={[pdfStyles.tdSubtle, { textAlign: "center", fontSize: 8.4 }]}>
                                        No damage report records available for this report.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {isLastPage ? (
                            <>
                                <View style={pdfStyles.totalsWrap}>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>Pending Count</Text>
                                        <Text style={pdfStyles.totalsValue}>{pendingCount}</Text>
                                    </View>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>Assessed Count</Text>
                                        <Text style={pdfStyles.totalsValue}>{assessedCount}</Text>
                                    </View>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>Paid Count</Text>
                                        <Text style={pdfStyles.totalsValue}>{paidCount}</Text>
                                    </View>
                                    <View style={[pdfStyles.totalsLine, pdfStyles.totalsGrand]}>
                                        <Text style={[pdfStyles.totalsLabel, { fontWeight: 700 }]}>Fine Total</Text>
                                        <Text style={[pdfStyles.totalsValue, { fontSize: 10 }]}>
                                            {formatPHP(totalFine)}
                                        </Text>
                                    </View>
                                </View>

                                <View style={pdfStyles.notesWrap}>
                                    <Text style={pdfStyles.notesTitle}>Processing Notes</Text>
                                    <Text style={pdfStyles.noteText}>
                                        1) Active records are pending or assessed damage reports that are not yet paid/archived.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        2) Paid archive records include reports already marked paid/archived, including paid linked fines.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        3) Liability is based on the currently assigned liable user in the dashboard.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        4) This PDF reflects the current filtered damage report list shown in the page.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        5) Long notes and identifiers are wrapped to fit the printable layout.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        (Cebuano) Ang gi-print nga report kay base sa current filtered damage report list ug naka-wrap ang taas nga text aron dili mo-slide.
                                    </Text>
                                </View>
                            </>
                        ) : null}

                        <View style={pdfStyles.footer}>
                            <Text style={pdfStyles.footerText}>BookHive Library • Generated via Damage Reports Module</Text>
                            <Text style={pdfStyles.footerText}>Printed: {fmtDateTime(generatedAtIso)}</Text>
                        </View>
                    </Page>
                );
            })}
        </Document>
    );
}

export function ExportPreviewDamageReports({
    open,
    onOpenChange,
    records,
    autoPrintOnOpen = false,
    fileNamePrefix = "bookhive-damage-reports",
    reportTitle = "BookHive Library • Damage Reports",
    reportSubtitle = "Printable report for active and paid/archive damage report records.",
}: ExportPreviewDamageReportsProps) {
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
            <DamageReportsPdfDocument
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
    }, [open, records.length, pdfNode]);

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
                            description: "You can print the damage reports PDF now.",
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

    const pendingCount = records.filter((r) => r.status === "pending").length;
    const assessedCount = records.filter((r) => r.status === "assessed").length;
    const paidCount = records.filter((r) => r.status === "paid").length;
    const totalFine = records.reduce((sum, r) => sum + normalizeAmount(r.fee), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-6xl bg-slate-950 border-white/10 text-white p-0 overflow-hidden h-[90svh]">
                <div className="px-5 pt-5 pb-3 border-b border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            Damage Reports PDF Preview & Export
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                            Smart View uses a fit-width pre-rendered preview. Standard View uses PDF React Viewer
                            with toolbar for the current damage report selection.
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
                                    <Badge className="bg-yellow-500/20 text-yellow-100 border-yellow-300/40">
                                        Pending: {pendingCount}
                                    </Badge>
                                    <Badge className="bg-blue-500/20 text-blue-100 border-blue-300/40">
                                        Assessed: {assessedCount}
                                    </Badge>
                                    <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/40">
                                        Paid: {paidCount}
                                    </Badge>
                                    <Badge className="bg-purple-500/20 text-purple-100 border-purple-300/40">
                                        Fine Total: {formatPHP(totalFine)}
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

                    <Card className="bg-slate-900/70 border-white/10">
                        <CardContent className="pt-4">
                            <div className="flex items-start gap-2 text-sm text-white/75">
                                <FileText className="h-4 w-4 mt-0.5 text-white/65" />
                                <div>
                                    <div className="font-medium text-white/90">{reportTitle}</div>
                                    <div className="text-white/65">{reportSubtitle}</div>
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
                                        title="Smart Damage Reports PDF Preview"
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
                                No damage report records available for preview.
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ExportPreviewDamageReports;