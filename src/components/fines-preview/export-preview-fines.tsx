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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    paidDate?: string | null;
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

type BondPaperPreset = "quarter-short" | "quarter-long" | "quarter-legal" | "quarter-a4" | "quarter-folio";

type FinesPdfDocProps = {
    records: PrintableFineRecord[];
    selectedFineId?: string | number | null;
    generatedAtIso: string;
    paperPreset: BondPaperPreset;
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
    if (status === "active") return "ACTIVE";
    if (status === "paid") return "PAID";
    if (status === "cancelled") return "CANCELLED";
    return String(status || "UNKNOWN").toUpperCase();
}

function safeToken(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function getDatePaid(record: PrintableFineRecord) {
    return record.paidDate || record.resolvedAt || null;
}

function trimText(value: string, maxLength: number) {
    const safe = value.trim();
    if (safe.length <= maxLength) return safe;
    return `${safe.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

type BondPaperPresetMeta = {
    label: string;
    description: string;
    size: [number, number];
};

function inchesToPdfPoints(value: number) {
    return value * 72;
}

const BOND_PAPER_PRESETS: Record<BondPaperPreset, BondPaperPresetMeta> = {
    "quarter-short": {
        label: "Quarter Short Bond",
        description: "4.25 × 5.50 in (1/4 of 8.5 × 11 in)",
        size: [inchesToPdfPoints(4.25), inchesToPdfPoints(5.5)],
    },
    "quarter-long": {
        label: "Quarter Long Bond",
        description: "4.25 × 6.50 in (1/4 of 8.5 × 13 in)",
        size: [inchesToPdfPoints(4.25), inchesToPdfPoints(6.5)],
    },
    "quarter-legal": {
        label: "Quarter Legal",
        description: "4.25 × 7.00 in (1/4 of 8.5 × 14 in)",
        size: [inchesToPdfPoints(4.25), inchesToPdfPoints(7)],
    },
    "quarter-a4": {
        label: "Quarter A4",
        description: "3.94 × 5.83 in (1/4 of A4)",
        size: [inchesToPdfPoints(8.27 / 2), inchesToPdfPoints(11.69 / 2)],
    },
    "quarter-folio": {
        label: "Quarter Folio",
        description: "4.25 × 8.25 in (1/4 of 8.5 × 16.5 in)",
        size: [inchesToPdfPoints(4.25), inchesToPdfPoints(8.25)],
    },
};

const pdfStyles = StyleSheet.create({
    page: {
        paddingTop: 14,
        paddingHorizontal: 14,
        paddingBottom: 14,
        fontSize: 7.4,
        color: "#0f172a",
        fontFamily: "Helvetica",
        lineHeight: 1.25,
        backgroundColor: "#ffffff",
    },
    header: {
        borderWidth: 1,
        borderColor: "#0f172a",
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 9,
        marginBottom: 8,
        backgroundColor: "#f8fafc",
    },
    brand: {
        fontSize: 10,
        fontWeight: 700,
        color: "#0f172a",
    },
    title: {
        marginTop: 1,
        fontSize: 8.2,
        fontWeight: 700,
        color: "#111827",
    },
    subtitle: {
        marginTop: 2,
        fontSize: 6.6,
        color: "#475569",
    },
    section: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        padding: 7,
        marginBottom: 7,
    },
    sectionTitle: {
        fontSize: 7.2,
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: 5,
        textTransform: "uppercase",
    },
    keyValueRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 3,
    },
    keyValueLabel: {
        fontSize: 6.7,
        color: "#475569",
        flexShrink: 0,
        marginRight: 6,
    },
    keyValueValue: {
        fontSize: 7.4,
        color: "#0f172a",
        fontWeight: 700,
        textAlign: "right",
        flexGrow: 1,
    },
    summaryGrid: {
        flexDirection: "row",
        marginBottom: 7,
    },
    summaryCard: {
        flexGrow: 1,
        flexBasis: 0,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 7,
        backgroundColor: "#f8fafc",
    },
    summaryLabel: {
        fontSize: 6.5,
        color: "#475569",
    },
    summaryValue: {
        marginTop: 2,
        fontSize: 8,
        fontWeight: 700,
        color: "#0f172a",
    },
    recordsWrap: {
    },
    recordCard: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        padding: 7,
        backgroundColor: "#ffffff",
    },
    focusedRecordCard: {
        borderColor: "#2563eb",
        backgroundColor: "#eff6ff",
    },
    recordTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 4,
    },
    recordId: {
        fontSize: 7.6,
        fontWeight: 700,
        color: "#0f172a",
    },
    amount: {
        fontSize: 8.2,
        fontWeight: 700,
        color: "#0f172a",
        textAlign: "right",
    },
    amountSubtle: {
        fontSize: 6.2,
        color: "#64748b",
        textAlign: "right",
        marginTop: 1,
    },
    badgeRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    badge: {
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 7,
        minHeight: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    badgeText: {
        fontSize: 6.3,
        color: "#ffffff",
        fontWeight: 700,
        lineHeight: 1,
    },
    badgeActive: { backgroundColor: "#d97706" },
    badgePaid: { backgroundColor: "#059669" },
    badgeCancelled: { backgroundColor: "#64748b" },
    badgeDefault: { backgroundColor: "#334155" },
    focusedText: {
        fontSize: 6.2,
        color: "#2563eb",
        fontWeight: 700,
    },
    primaryText: {
        fontSize: 7.4,
        color: "#0f172a",
        fontWeight: 700,
    },
    subtleText: {
        marginTop: 2,
        fontSize: 6.7,
        color: "#475569",
    },
    tinyText: {
        marginTop: 1,
        fontSize: 6.2,
        color: "#64748b",
    },
    footer: {
        marginTop: 8,
        paddingTop: 5,
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
    },
    footerText: {
        fontSize: 6.1,
        color: "#64748b",
        textAlign: "center",
    },
});

type FinesLayoutProfile = {
    pagePadding: number;
    sectionPadding: number;
    sectionGap: number;
    headerScale: number;
    sectionTitleScale: number;
    keyLabelScale: number;
    keyValueScale: number;
    summaryLabelScale: number;
    summaryValueScale: number;
    recordScale: number;
    subtleScale: number;
    tinyScale: number;
    amountScale: number;
    badgeScale: number;
    recordPadding: number;
    recordGap: number;
    recordsJustifyContent: "flex-start" | "space-between" | "space-evenly" | "center";
    maxBookLength: number;
    maxReasonLength: number;
};

function getFinesLayoutProfile(recordCount: number): FinesLayoutProfile {
    if (recordCount <= 1) {
        return {
            pagePadding: 18,
            sectionPadding: 10,
            sectionGap: 10,
            headerScale: 1.45,
            sectionTitleScale: 1.3,
            keyLabelScale: 1.2,
            keyValueScale: 1.34,
            summaryLabelScale: 1.18,
            summaryValueScale: 1.46,
            recordScale: 1.55,
            subtleScale: 1.3,
            tinyScale: 1.22,
            amountScale: 1.58,
            badgeScale: 1.26,
            recordPadding: 12,
            recordGap: 12,
            recordsJustifyContent: "center",
            maxBookLength: 88,
            maxReasonLength: 180,
        };
    }

    if (recordCount === 2) {
        return {
            pagePadding: 17,
            sectionPadding: 9,
            sectionGap: 9,
            headerScale: 1.34,
            sectionTitleScale: 1.22,
            keyLabelScale: 1.12,
            keyValueScale: 1.24,
            summaryLabelScale: 1.1,
            summaryValueScale: 1.3,
            recordScale: 1.34,
            subtleScale: 1.18,
            tinyScale: 1.12,
            amountScale: 1.36,
            badgeScale: 1.16,
            recordPadding: 10,
            recordGap: 10,
            recordsJustifyContent: "space-evenly",
            maxBookLength: 78,
            maxReasonLength: 160,
        };
    }

    if (recordCount === 3) {
        return {
            pagePadding: 16,
            sectionPadding: 8,
            sectionGap: 8,
            headerScale: 1.2,
            sectionTitleScale: 1.12,
            keyLabelScale: 1.06,
            keyValueScale: 1.12,
            summaryLabelScale: 1.04,
            summaryValueScale: 1.16,
            recordScale: 1.14,
            subtleScale: 1.08,
            tinyScale: 1.04,
            amountScale: 1.18,
            badgeScale: 1.08,
            recordPadding: 8,
            recordGap: 8,
            recordsJustifyContent: "space-between",
            maxBookLength: 66,
            maxReasonLength: 126,
        };
    }

    return {
        pagePadding: 14,
        sectionPadding: 7,
        sectionGap: 7,
        headerScale: 1,
        sectionTitleScale: 1,
        keyLabelScale: 1,
        keyValueScale: 1,
        summaryLabelScale: 1,
        summaryValueScale: 1,
        recordScale: 1,
        subtleScale: 1,
        tinyScale: 1,
        amountScale: 1,
        badgeScale: 1,
        recordPadding: 7,
        recordGap: 6,
        recordsJustifyContent: "flex-start",
        maxBookLength: 52,
        maxReasonLength: 90,
    };
}

function FinesPdfDocument({
    records,
    selectedFineId,
    generatedAtIso,
    paperPreset,
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
    const paidCount = sorted.filter((r) => r.status === "paid").length;
    const activeCount = sorted.filter((r) => r.status === "active").length;
    const cancelledCount = sorted.filter((r) => r.status === "cancelled").length;
    const profile = getFinesLayoutProfile(sorted.length);
    const selectedPaperMeta = BOND_PAPER_PRESETS[paperPreset];

    return (
        <Document title="BookHive Fines Record Slip">
            <Page
                size={selectedPaperMeta.size}
                style={[
                    pdfStyles.page,
                    {
                        paddingTop: profile.pagePadding,
                        paddingRight: profile.pagePadding,
                        paddingBottom: profile.pagePadding,
                        paddingLeft: profile.pagePadding,
                    },
                ]}
            >
                <View
                    style={[
                        pdfStyles.header,
                        {
                            paddingVertical: profile.sectionPadding + 1,
                            paddingHorizontal: profile.sectionPadding + 2,
                            marginBottom: profile.sectionGap,
                        },
                    ]}
                >
                    <Text style={[pdfStyles.brand, { fontSize: 10 * profile.headerScale }]}>
                        BookHive Library
                    </Text>
                    <Text style={[pdfStyles.title, { fontSize: 8.2 * profile.headerScale }]}>
                        Fines Record Slip
                    </Text>
                    <Text style={[pdfStyles.subtitle, { fontSize: 6.6 * profile.headerScale }]}> 
                        {`${selectedPaperMeta.label} • ${selectedPaperMeta.description} • sized to fill one page when printed at actual size.`}
                    </Text>
                </View>

                <View
                    style={[
                        pdfStyles.section,
                        {
                            padding: profile.sectionPadding,
                            marginBottom: profile.sectionGap,
                        },
                    ]}
                >
                    <Text
                        style={[
                            pdfStyles.sectionTitle,
                            {
                                fontSize: 7.2 * profile.sectionTitleScale,
                                marginBottom: Math.max(5, profile.sectionGap - 1),
                            },
                        ]}
                    >
                        Account Details
                    </Text>
                    <View style={[pdfStyles.keyValueRow, { marginBottom: Math.max(4, profile.sectionGap - 3) }]}>
                        <Text style={[pdfStyles.keyValueLabel, { fontSize: 6.7 * profile.keyLabelScale }]}>Name</Text>
                        <Text style={[pdfStyles.keyValueValue, { fontSize: 7.4 * profile.keyValueScale }]}>
                            {trimText(String(userName), sorted.length <= 2 ? 54 : 42)}
                        </Text>
                    </View>
                    <View style={[pdfStyles.keyValueRow, { marginBottom: Math.max(4, profile.sectionGap - 3) }]}>
                        <Text style={[pdfStyles.keyValueLabel, { fontSize: 6.7 * profile.keyLabelScale }]}>ID</Text>
                        <Text style={[pdfStyles.keyValueValue, { fontSize: 7.4 * profile.keyValueScale }]}>
                            {trimText(String(userId), sorted.length <= 2 ? 30 : 24)}
                        </Text>
                    </View>
                    <View style={[pdfStyles.keyValueRow, { marginBottom: Math.max(4, profile.sectionGap - 3) }]}>
                        <Text style={[pdfStyles.keyValueLabel, { fontSize: 6.7 * profile.keyLabelScale }]}>Email</Text>
                        <Text style={[pdfStyles.keyValueValue, { fontSize: 7.4 * profile.keyValueScale }]}>
                            {trimText(String(userEmail), sorted.length <= 2 ? 46 : 34)}
                        </Text>
                    </View>
                    <View style={[pdfStyles.keyValueRow, { marginBottom: 0 }]}> 
                        <Text style={[pdfStyles.keyValueLabel, { fontSize: 6.7 * profile.keyLabelScale }]}>Generated</Text>
                        <Text style={[pdfStyles.keyValueValue, { fontSize: 7.4 * profile.keyValueScale }]}>
                            {fmtDateTime(generatedAtIso)}
                        </Text>
                    </View>
                </View>

                <View style={[pdfStyles.summaryGrid, { marginBottom: profile.sectionGap }]}> 
                    <View style={[pdfStyles.summaryCard, { marginRight: 6, paddingVertical: profile.sectionPadding - 1, paddingHorizontal: profile.sectionPadding }]}>
                        <Text style={[pdfStyles.summaryLabel, { fontSize: 6.5 * profile.summaryLabelScale }]}>Records</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: 8 * profile.summaryValueScale }]}>{sorted.length}</Text>
                    </View>
                    <View style={[pdfStyles.summaryCard, { marginRight: 6, paddingVertical: profile.sectionPadding - 1, paddingHorizontal: profile.sectionPadding }]}>
                        <Text style={[pdfStyles.summaryLabel, { fontSize: 6.5 * profile.summaryLabelScale }]}>Active</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: 8 * profile.summaryValueScale }]}>{activeCount}</Text>
                    </View>
                    <View style={[pdfStyles.summaryCard, { paddingVertical: profile.sectionPadding - 1, paddingHorizontal: profile.sectionPadding }]}>
                        <Text style={[pdfStyles.summaryLabel, { fontSize: 6.5 * profile.summaryLabelScale }]}>Paid</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: 8 * profile.summaryValueScale }]}>{paidCount}</Text>
                    </View>
                </View>

                <View style={[pdfStyles.summaryGrid, { marginBottom: profile.sectionGap }]}> 
                    <View style={[pdfStyles.summaryCard, { marginRight: 6, paddingVertical: profile.sectionPadding - 1, paddingHorizontal: profile.sectionPadding }]}>
                        <Text style={[pdfStyles.summaryLabel, { fontSize: 6.5 * profile.summaryLabelScale }]}>Cancelled</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: 8 * profile.summaryValueScale }]}>{cancelledCount}</Text>
                    </View>
                    <View style={[pdfStyles.summaryCard, { paddingVertical: profile.sectionPadding - 1, paddingHorizontal: profile.sectionPadding }]}>
                        <Text style={[pdfStyles.summaryLabel, { fontSize: 6.5 * profile.summaryLabelScale }]}>Grand Total</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: 8 * profile.summaryValueScale }]}>{formatPHP(total)}</Text>
                    </View>
                </View>

                <View
                    style={[
                        pdfStyles.section,
                        {
                            padding: profile.sectionPadding,
                            marginBottom: 0,
                            flexGrow: 1,
                        },
                    ]}
                >
                    <Text
                        style={[
                            pdfStyles.sectionTitle,
                            {
                                fontSize: 7.2 * profile.sectionTitleScale,
                                marginBottom: Math.max(5, profile.sectionGap - 1),
                            },
                        ]}
                    >
                        Fine Items
                    </Text>
                    <View
                        style={[
                            pdfStyles.recordsWrap,
                            {
                                justifyContent: profile.recordsJustifyContent,
                                flexGrow: 1,
                            },
                        ]}
                    >
                        {sorted.map((record, index) => {
                            const isFocused =
                                selectedFineId != null && String(record.id) === String(selectedFineId);
                            const badgeStyle =
                                record.status === "paid"
                                    ? pdfStyles.badgePaid
                                    : record.status === "active"
                                        ? pdfStyles.badgeActive
                                        : record.status === "cancelled"
                                            ? pdfStyles.badgeCancelled
                                            : pdfStyles.badgeDefault;

                            const bookLabel = record.bookTitle
                                ? trimText(record.bookTitle, profile.maxBookLength)
                                : record.bookId
                                    ? `Book #${record.bookId}`
                                    : "No book title";

                            const reasonLabel = record.reason
                                ? trimText(record.reason, profile.maxReasonLength)
                                : "No reason provided";

                            return (
                                <View
                                    key={String(record.id)}
                                    style={[
                                        pdfStyles.recordCard,
                                        {
                                            padding: profile.recordPadding,
                                            marginBottom:
                                                index === sorted.length - 1 ? 0 : profile.recordGap,
                                        },
                                        ...(isFocused ? [pdfStyles.focusedRecordCard] : []),
                                    ]}
                                    wrap={false}
                                >
                                    <View style={[pdfStyles.recordTop, { marginBottom: Math.max(5, profile.recordGap - 3) }]}>
                                        <View style={{ flex: 1, marginRight: 6 }}>
                                            <Text style={[pdfStyles.recordId, { fontSize: 7.6 * profile.recordScale }]}>
                                                Fine #{String(record.id)}
                                            </Text>
                                            <Text style={[pdfStyles.tinyText, { fontSize: 6.2 * profile.tinyScale }]}>
                                                {record.sourceLabel === "damage" ? "Damage-based record" : "Fine record"}
                                            </Text>
                                        </View>
                                        <View>
                                            <Text style={[pdfStyles.amount, { fontSize: 8.2 * profile.amountScale }]}>
                                                {formatPHP(normalizeAmount(record.amount))}
                                            </Text>
                                            <Text style={[pdfStyles.amountSubtle, { fontSize: 6.2 * profile.tinyScale }]}>Due amount</Text>
                                        </View>
                                    </View>

                                    <View style={[pdfStyles.badgeRow, { marginBottom: Math.max(5, profile.recordGap - 3) }]}>
                                        <View
                                            style={[
                                                pdfStyles.badge,
                                                badgeStyle,
                                                {
                                                    paddingVertical: 2 * profile.badgeScale,
                                                    paddingHorizontal: 7 * profile.badgeScale,
                                                    minHeight: 14 * profile.badgeScale,
                                                },
                                            ]}
                                        >
                                            <Text style={[pdfStyles.badgeText, { fontSize: 6.3 * profile.badgeScale }]}>
                                                {statusText(record.status)}
                                            </Text>
                                        </View>
                                        {isFocused && (
                                            <Text style={[pdfStyles.focusedText, { fontSize: 6.2 * profile.tinyScale }]}>Focused item</Text>
                                        )}
                                    </View>

                                    <Text style={[pdfStyles.primaryText, { fontSize: 7.4 * profile.recordScale }]}>{bookLabel}</Text>
                                    <Text style={[pdfStyles.subtleText, { fontSize: 6.7 * profile.subtleScale }]}>Reason: {reasonLabel}</Text>
                                    <Text style={[pdfStyles.subtleText, { fontSize: 6.7 * profile.subtleScale }]}>Created: {fmtDate(record.createdAt)}</Text>
                                    <Text style={[pdfStyles.subtleText, { fontSize: 6.7 * profile.subtleScale }]}>Paid: {fmtDate(getDatePaid(record))}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                <View style={[pdfStyles.footer, { marginTop: profile.sectionGap, paddingTop: Math.max(5, profile.sectionGap - 1) }]}> 
                    <Text style={[pdfStyles.footerText, { fontSize: 6.1 * profile.tinyScale }]}> 
                        {`Present this ${selectedPaperMeta.label.toLowerCase()} slip to the cashier and library staff for verification.`}
                    </Text>
                    <Text style={[pdfStyles.footerText, { fontSize: 6.1 * profile.tinyScale }]}> 
                        BookHive Library • Printed {fmtDateTime(generatedAtIso)}
                    </Text>
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
    const [paperPreset, setPaperPreset] = React.useState<BondPaperPreset>("quarter-short");
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
                paperPreset={paperPreset}
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
    }, [open, records.length, pdfNode, paperPreset]);

    const fileName = React.useMemo(() => {
        if (!records.length) return `${fileNamePrefix}.pdf`;
        const presetSuffix = safeToken(BOND_PAPER_PRESETS[paperPreset].label);
        const first = records[0];
        const rawUser =
            String(first.studentId ?? "").trim() ||
            String(first.userId ?? "").trim() ||
            String(first.studentEmail ?? "").trim() ||
            "user";
        const ymd = new Date(generatedAtIso).toISOString().slice(0, 10);
        return `${safeToken(fileNamePrefix)}-${presetSuffix}-${safeToken(rawUser)}-${ymd}.pdf`;
    }, [records, generatedAtIso, fileNamePrefix, paperPreset]);

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
                            Choose a bond paper preset below. The exported fines record slip uses the selected quarter-paper size and scales its content to stay on one page.
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
                                    <Badge className="bg-indigo-500/20 text-indigo-100 border-indigo-300/40">
                                        {BOND_PAPER_PRESETS[paperPreset].label}
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

                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                    <div className="w-full sm:w-60">
                                        <Select value={paperPreset} onValueChange={(value) => setPaperPreset(value as BondPaperPreset)}>
                                            <SelectTrigger className="border-white/20 bg-slate-950/70 text-white">
                                                <SelectValue placeholder="Paper size" />
                                            </SelectTrigger>
                                            <SelectContent className="border-white/10 bg-slate-950 text-white">
                                                {Object.entries(BOND_PAPER_PRESETS).map(([value, meta]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {meta.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

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

                            <p className="mt-3 text-xs text-white/60">
                                {BOND_PAPER_PRESETS[paperPreset].description}. Print using <span className="font-medium text-white">Actual size</span> or <span className="font-medium text-white">100%</span> for accurate physical output.
                            </p>
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