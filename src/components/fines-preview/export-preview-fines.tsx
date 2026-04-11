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
import { Download, Printer } from "lucide-react";
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

type BondPaperPreset = "short" | "long" | "legal" | "a4" | "folio";

type FinesPdfDocProps = {
    records: PrintableFineRecord[];
    selectedFineId?: string | number | null;
    generatedAtIso: string;
    paperPreset: BondPaperPreset;
};

type BondPaperPresetMeta = {
    label: string;
    fullDescription: string;
    fullSize: [number, number];
};

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

function inchesToPdfPoints(value: number) {
    return value * 72;
}

const BOND_PAPER_PRESETS: Record<BondPaperPreset, BondPaperPresetMeta> = {
    short: {
        label: "Short Bond",
        fullDescription: "8.5 × 11 in",
        fullSize: [inchesToPdfPoints(8.5), inchesToPdfPoints(11)],
    },
    long: {
        label: "Long Bond",
        fullDescription: "8.5 × 13 in",
        fullSize: [inchesToPdfPoints(8.5), inchesToPdfPoints(13)],
    },
    legal: {
        label: "Legal",
        fullDescription: "8.5 × 14 in",
        fullSize: [inchesToPdfPoints(8.5), inchesToPdfPoints(14)],
    },
    a4: {
        label: "A4",
        fullDescription: "8.27 × 11.69 in",
        fullSize: [inchesToPdfPoints(8.27), inchesToPdfPoints(11.69)],
    },
    folio: {
        label: "Folio",
        fullDescription: "8.5 × 16.5 in",
        fullSize: [inchesToPdfPoints(8.5), inchesToPdfPoints(16.5)],
    },
};

const pdfStyles = StyleSheet.create({
    page: {
        padding: 18,
        fontSize: 7.2,
        color: "#0f172a",
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignContent: "space-between",
        width: "100%",
        height: "100%",
    },
    quadrant: {
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#94a3b8",
        borderRadius: 6,
        padding: 9,
        backgroundColor: "#ffffff",
    },
    cutGuideVertical: {
        position: "absolute",
        top: 18,
        bottom: 18,
        width: 0,
        borderRightWidth: 1,
        borderRightStyle: "dashed",
        borderRightColor: "#94a3b8",
    },
    cutGuideHorizontal: {
        position: "absolute",
        left: 18,
        right: 18,
        height: 0,
        borderBottomWidth: 1,
        borderBottomStyle: "dashed",
        borderBottomColor: "#94a3b8",
    },
    cutGuideLabel: {
        position: "absolute",
        fontSize: 6,
        fontWeight: 700,
        color: "#64748b",
        backgroundColor: "#ffffff",
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    header: {
        borderWidth: 1,
        borderColor: "#0f172a",
        borderRadius: 6,
        paddingVertical: 7,
        paddingHorizontal: 8,
        marginBottom: 7,
        backgroundColor: "#f8fafc",
    },
    brand: {
        fontSize: 9,
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: 2,
    },
    title: {
        fontSize: 7.6,
        fontWeight: 700,
        color: "#111827",
    },
    section: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        padding: 6,
        marginBottom: 6,
    },
    sectionTitle: {
        fontSize: 6.9,
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: 4,
        textTransform: "uppercase",
    },
    keyValueRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 3,
    },
    keyValueLabel: {
        fontSize: 6.2,
        color: "#475569",
        marginRight: 6,
        flexShrink: 0,
    },
    keyValueValue: {
        fontSize: 6.9,
        color: "#0f172a",
        fontWeight: 700,
        textAlign: "right",
        flexGrow: 1,
    },
    summaryGrid: {
        flexDirection: "row",
        marginBottom: 6,
    },
    summaryCard: {
        flexGrow: 1,
        flexBasis: 0,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        paddingVertical: 5,
        paddingHorizontal: 6,
        backgroundColor: "#f8fafc",
    },
    summaryLabel: {
        fontSize: 6,
        color: "#475569",
    },
    summaryValue: {
        marginTop: 2,
        fontSize: 7.2,
        fontWeight: 700,
        color: "#0f172a",
    },
    recordsWrap: {
        flexGrow: 1,
    },
    recordCard: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        padding: 6,
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
        fontSize: 7,
        fontWeight: 700,
        color: "#0f172a",
    },
    amount: {
        fontSize: 7.4,
        fontWeight: 700,
        color: "#0f172a",
        textAlign: "right",
    },
    amountSubtle: {
        fontSize: 5.8,
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
        paddingHorizontal: 6,
        minHeight: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    badgeText: {
        fontSize: 5.8,
        color: "#ffffff",
        fontWeight: 700,
        lineHeight: 1,
    },
    badgeActive: {
        backgroundColor: "#d97706",
    },
    badgePaid: {
        backgroundColor: "#059669",
    },
    badgeCancelled: {
        backgroundColor: "#64748b",
    },
    badgeDefault: {
        backgroundColor: "#334155",
    },
    focusedText: {
        fontSize: 5.8,
        color: "#2563eb",
        fontWeight: 700,
    },
    primaryText: {
        fontSize: 6.9,
        color: "#0f172a",
        fontWeight: 700,
    },
    subtleText: {
        marginTop: 2,
        fontSize: 6.2,
        color: "#475569",
    },
    tinyText: {
        marginTop: 1,
        fontSize: 5.8,
        color: "#64748b",
    },
    footer: {
        marginTop: 6,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
    },
    footerText: {
        fontSize: 5.8,
        color: "#64748b",
        textAlign: "center",
    },
});

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

function getFinesLayoutProfile(recordCount: number): FinesLayoutProfile {
    if (recordCount <= 1) {
        return {
            pagePadding: 18,
            sectionPadding: 10,
            sectionGap: 10,
            headerScale: 1.18,
            sectionTitleScale: 1.12,
            keyLabelScale: 1.08,
            keyValueScale: 1.14,
            summaryLabelScale: 1.08,
            summaryValueScale: 1.16,
            recordScale: 1.16,
            subtleScale: 1.08,
            tinyScale: 1.04,
            amountScale: 1.18,
            badgeScale: 1.04,
            recordPadding: 8,
            recordGap: 8,
            recordsJustifyContent: "center",
            maxBookLength: 76,
            maxReasonLength: 160,
        };
    }

    if (recordCount === 2) {
        return {
            pagePadding: 18,
            sectionPadding: 9,
            sectionGap: 8,
            headerScale: 1.08,
            sectionTitleScale: 1.04,
            keyLabelScale: 1.02,
            keyValueScale: 1.06,
            summaryLabelScale: 1.02,
            summaryValueScale: 1.08,
            recordScale: 1.08,
            subtleScale: 1.02,
            tinyScale: 1,
            amountScale: 1.1,
            badgeScale: 1,
            recordPadding: 7,
            recordGap: 7,
            recordsJustifyContent: "space-evenly",
            maxBookLength: 68,
            maxReasonLength: 132,
        };
    }

    if (recordCount === 3) {
        return {
            pagePadding: 18,
            sectionPadding: 8,
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
            recordPadding: 6,
            recordGap: 6,
            recordsJustifyContent: "space-between",
            maxBookLength: 58,
            maxReasonLength: 108,
        };
    }

    return {
        pagePadding: 18,
        sectionPadding: 7,
        sectionGap: 6,
        headerScale: 0.94,
        sectionTitleScale: 0.94,
        keyLabelScale: 0.94,
        keyValueScale: 0.94,
        summaryLabelScale: 0.94,
        summaryValueScale: 0.94,
        recordScale: 0.94,
        subtleScale: 0.94,
        tinyScale: 0.94,
        amountScale: 0.94,
        badgeScale: 0.94,
        recordPadding: 6,
        recordGap: 5,
        recordsJustifyContent: "flex-start",
        maxBookLength: 48,
        maxReasonLength: 84,
    };
}

function renderStatusBadgeStyle(status: PrintableFineStatus) {
    if (status === "paid") return pdfStyles.badgePaid;
    if (status === "active") return pdfStyles.badgeActive;
    if (status === "cancelled") return pdfStyles.badgeCancelled;
    return pdfStyles.badgeDefault;
}

function FineSlip({
    records,
    selectedFineId,
    generatedAtIso,
}: {
    records: PrintableFineRecord[];
    selectedFineId?: string | number | null;
    generatedAtIso: string;
}) {
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

    const total = sorted.reduce((sum, record) => sum + normalizeAmount(record.amount), 0);
    const paidCount = sorted.filter((record) => record.status === "paid").length;
    const activeCount = sorted.filter((record) => record.status === "active").length;
    const cancelledCount = sorted.filter((record) => record.status === "cancelled").length;
    const profile = getFinesLayoutProfile(sorted.length);

    return (
        <View style={pdfStyles.quadrant}>
            <View
                style={[
                    pdfStyles.header,
                    {
                        paddingVertical: profile.sectionPadding,
                        paddingHorizontal: profile.sectionPadding,
                        marginBottom: profile.sectionGap,
                    },
                ]}
            >
                <Text style={[pdfStyles.brand, { fontSize: 9 * profile.headerScale }]}>BookHive Library</Text>
                <Text style={[pdfStyles.title, { fontSize: 7.6 * profile.headerScale }]}>Fines Record Slip</Text>
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
                            fontSize: 6.9 * profile.sectionTitleScale,
                            marginBottom: Math.max(4, profile.sectionGap - 1),
                        },
                    ]}
                >
                    Account Details
                </Text>

                <View style={[pdfStyles.keyValueRow, { marginBottom: Math.max(3, profile.sectionGap - 3) }]}>
                    <Text style={[pdfStyles.keyValueLabel, { fontSize: 6.2 * profile.keyLabelScale }]}>Name</Text>
                    <Text style={[pdfStyles.keyValueValue, { fontSize: 6.9 * profile.keyValueScale }]}>
                        {trimText(String(userName), sorted.length <= 2 ? 48 : 38)}
                    </Text>
                </View>

                <View style={[pdfStyles.keyValueRow, { marginBottom: Math.max(3, profile.sectionGap - 3) }]}>
                    <Text style={[pdfStyles.keyValueLabel, { fontSize: 6.2 * profile.keyLabelScale }]}>ID</Text>
                    <Text style={[pdfStyles.keyValueValue, { fontSize: 6.9 * profile.keyValueScale }]}>
                        {trimText(String(userId), sorted.length <= 2 ? 24 : 20)}
                    </Text>
                </View>

                <View style={[pdfStyles.keyValueRow, { marginBottom: Math.max(3, profile.sectionGap - 3) }]}>
                    <Text style={[pdfStyles.keyValueLabel, { fontSize: 6.2 * profile.keyLabelScale }]}>Email</Text>
                    <Text style={[pdfStyles.keyValueValue, { fontSize: 6.9 * profile.keyValueScale }]}>
                        {trimText(String(userEmail), sorted.length <= 2 ? 40 : 30)}
                    </Text>
                </View>

                <View style={pdfStyles.keyValueRow}>
                    <Text style={[pdfStyles.keyValueLabel, { fontSize: 6.2 * profile.keyLabelScale }]}>Generated</Text>
                    <Text style={[pdfStyles.keyValueValue, { fontSize: 6.9 * profile.keyValueScale }]}> 
                        {fmtDateTime(generatedAtIso)}
                    </Text>
                </View>
            </View>

            <View style={[pdfStyles.summaryGrid, { marginBottom: profile.sectionGap }]}> 
                <View
                    style={[
                        pdfStyles.summaryCard,
                        {
                            marginRight: 5,
                            paddingVertical: Math.max(4, profile.sectionPadding - 1),
                            paddingHorizontal: profile.sectionPadding,
                        },
                    ]}
                >
                    <Text style={[pdfStyles.summaryLabel, { fontSize: 6 * profile.summaryLabelScale }]}>Records</Text>
                    <Text style={[pdfStyles.summaryValue, { fontSize: 7.2 * profile.summaryValueScale }]}>{sorted.length}</Text>
                </View>

                <View
                    style={[
                        pdfStyles.summaryCard,
                        {
                            marginRight: 5,
                            paddingVertical: Math.max(4, profile.sectionPadding - 1),
                            paddingHorizontal: profile.sectionPadding,
                        },
                    ]}
                >
                    <Text style={[pdfStyles.summaryLabel, { fontSize: 6 * profile.summaryLabelScale }]}>Active</Text>
                    <Text style={[pdfStyles.summaryValue, { fontSize: 7.2 * profile.summaryValueScale }]}>{activeCount}</Text>
                </View>

                <View
                    style={[
                        pdfStyles.summaryCard,
                        {
                            paddingVertical: Math.max(4, profile.sectionPadding - 1),
                            paddingHorizontal: profile.sectionPadding,
                        },
                    ]}
                >
                    <Text style={[pdfStyles.summaryLabel, { fontSize: 6 * profile.summaryLabelScale }]}>Paid</Text>
                    <Text style={[pdfStyles.summaryValue, { fontSize: 7.2 * profile.summaryValueScale }]}>{paidCount}</Text>
                </View>
            </View>

            <View style={[pdfStyles.summaryGrid, { marginBottom: profile.sectionGap }]}> 
                <View
                    style={[
                        pdfStyles.summaryCard,
                        {
                            marginRight: 5,
                            paddingVertical: Math.max(4, profile.sectionPadding - 1),
                            paddingHorizontal: profile.sectionPadding,
                        },
                    ]}
                >
                    <Text style={[pdfStyles.summaryLabel, { fontSize: 6 * profile.summaryLabelScale }]}>Cancelled</Text>
                    <Text style={[pdfStyles.summaryValue, { fontSize: 7.2 * profile.summaryValueScale }]}>{cancelledCount}</Text>
                </View>

                <View
                    style={[
                        pdfStyles.summaryCard,
                        {
                            paddingVertical: Math.max(4, profile.sectionPadding - 1),
                            paddingHorizontal: profile.sectionPadding,
                        },
                    ]}
                >
                    <Text style={[pdfStyles.summaryLabel, { fontSize: 6 * profile.summaryLabelScale }]}>Grand Total</Text>
                    <Text style={[pdfStyles.summaryValue, { fontSize: 7.2 * profile.summaryValueScale }]}>{formatPHP(total)}</Text>
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
                            fontSize: 6.9 * profile.sectionTitleScale,
                            marginBottom: Math.max(4, profile.sectionGap - 1),
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
                        },
                    ]}
                >
                    {sorted.map((record, index) => {
                        const isFocused =
                            selectedFineId != null && String(record.id) === String(selectedFineId);

                        const bookLabel = record.bookTitle
                            ? trimText(record.bookTitle, profile.maxBookLength)
                            : record.bookId
                              ? `Book #${record.bookId}`
                              : "No book title";

                        const reasonLabel = record.reason
                            ? trimText(record.reason, profile.maxReasonLength)
                            : "No reason provided";

                        const cardStyles = isFocused
                            ? [
                                  pdfStyles.recordCard,
                                  pdfStyles.focusedRecordCard,
                                  {
                                      padding: profile.recordPadding,
                                      marginBottom:
                                          index === sorted.length - 1 ? 0 : profile.recordGap,
                                  },
                              ]
                            : [
                                  pdfStyles.recordCard,
                                  {
                                      padding: profile.recordPadding,
                                      marginBottom:
                                          index === sorted.length - 1 ? 0 : profile.recordGap,
                                  },
                              ];

                        return (
                            <View key={String(record.id)} style={cardStyles} wrap={false}>
                                <View style={[pdfStyles.recordTop, { marginBottom: Math.max(4, profile.recordGap - 2) }]}>
                                    <View style={{ flex: 1, marginRight: 6 }}>
                                        <Text style={[pdfStyles.recordId, { fontSize: 7 * profile.recordScale }]}> 
                                            Fine #{String(record.id)}
                                        </Text>
                                        <Text style={[pdfStyles.tinyText, { fontSize: 5.8 * profile.tinyScale }]}> 
                                            {record.sourceLabel === "damage" ? "Damage record" : "Fine record"}
                                        </Text>
                                    </View>

                                    <View>
                                        <Text style={[pdfStyles.amount, { fontSize: 7.4 * profile.amountScale }]}> 
                                            {formatPHP(normalizeAmount(record.amount))}
                                        </Text>
                                        <Text style={[pdfStyles.amountSubtle, { fontSize: 5.8 * profile.tinyScale }]}>Due amount</Text>
                                    </View>
                                </View>

                                <View style={[pdfStyles.badgeRow, { marginBottom: Math.max(4, profile.recordGap - 2) }]}>
                                    <View
                                        style={[
                                            pdfStyles.badge,
                                            renderStatusBadgeStyle(record.status),
                                            {
                                                paddingVertical: 2,
                                                paddingHorizontal: 6 * profile.badgeScale,
                                                minHeight: 14 * profile.badgeScale,
                                            },
                                        ]}
                                    >
                                        <Text style={[pdfStyles.badgeText, { fontSize: 5.8 * profile.badgeScale }]}> 
                                            {statusText(record.status)}
                                        </Text>
                                    </View>

                                    {isFocused ? (
                                        <Text style={[pdfStyles.focusedText, { fontSize: 5.8 * profile.tinyScale }]}>Focused item</Text>
                                    ) : null}
                                </View>

                                <Text style={[pdfStyles.primaryText, { fontSize: 6.9 * profile.recordScale }]}>{bookLabel}</Text>
                                <Text style={[pdfStyles.subtleText, { fontSize: 6.2 * profile.subtleScale }]}>Reason: {reasonLabel}</Text>
                                <Text style={[pdfStyles.subtleText, { fontSize: 6.2 * profile.subtleScale }]}>Created: {fmtDate(record.createdAt)}</Text>
                                <Text style={[pdfStyles.subtleText, { fontSize: 6.2 * profile.subtleScale }]}>Paid: {fmtDate(getDatePaid(record))}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            <View style={[pdfStyles.footer, { marginTop: profile.sectionGap }]}> 
                <Text style={[pdfStyles.footerText, { fontSize: 5.8 * profile.tinyScale }]}> 
                    BookHive Library • Printed {fmtDateTime(generatedAtIso)}
                </Text>
            </View>
        </View>
    );
}

function FinesPdfDocument({
    records,
    selectedFineId,
    generatedAtIso,
    paperPreset,
}: FinesPdfDocProps) {
    const selectedPaperMeta = BOND_PAPER_PRESETS[paperPreset];
    const pagePadding = 18;
    const gap = 10;
    const [pageWidth, pageHeight] = selectedPaperMeta.fullSize;
    const usableWidth = pageWidth - pagePadding * 2;
    const usableHeight = pageHeight - pagePadding * 2;
    const slipWidth = (usableWidth - gap) / 2;
    const slipHeight = (usableHeight - gap) / 2;
    const verticalGuideLeft = pagePadding + slipWidth + gap / 2;
    const horizontalGuideTop = pagePadding + slipHeight + gap / 2;

    return (
        <Document title="BookHive Fines Record Slip">
            <Page size={selectedPaperMeta.fullSize} style={pdfStyles.page}>
                <View
                    style={[
                        pdfStyles.cutGuideVertical,
                        {
                            left: verticalGuideLeft,
                        },
                    ]}
                    fixed
                />
                <View
                    style={[
                        pdfStyles.cutGuideHorizontal,
                        {
                            top: horizontalGuideTop,
                        },
                    ]}
                    fixed
                />
                <Text
                    style={[
                        pdfStyles.cutGuideLabel,
                        {
                            top: 6,
                            left: verticalGuideLeft - 42,
                        },
                    ]}
                    fixed
                >
                    ✂ CUT
                </Text>
                <Text
                    style={[
                        pdfStyles.cutGuideLabel,
                        {
                            top: horizontalGuideTop - 10,
                            right: 6,
                        },
                    ]}
                    fixed
                >
                    ✂ CUT
                </Text>

                <View style={pdfStyles.grid}>
                    {[0, 1, 2, 3].map((index) => (
                        <View
                            key={index}
                            style={{
                                width: slipWidth,
                                height: slipHeight,
                            }}
                        >
                            <FineSlip
                                records={records}
                                selectedFineId={selectedFineId}
                                generatedAtIso={generatedAtIso}
                            />
                        </View>
                    ))}
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
    const [viewerHeight, setViewerHeight] = React.useState(720);
    const [generatedAtIso, setGeneratedAtIso] = React.useState(() => new Date().toISOString());
    const [paperPreset, setPaperPreset] = React.useState<BondPaperPreset>("short");
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
            const nextHeight = Math.max(420, Math.min(window.innerHeight - 220, 1000));
            setViewerHeight(nextHeight);
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
        [records, selectedFineId, generatedAtIso, paperPreset]
    );

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
                window.setTimeout(() => {
                    try {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        toast.success("Print dialog opened");
                    } catch {
                        toast.error("Could not start print", {
                            description: "Try downloading the PDF and print it manually.",
                        });
                    } finally {
                        window.setTimeout(() => {
                            if (iframe.parentNode) {
                                iframe.parentNode.removeChild(iframe);
                            }
                            URL.revokeObjectURL(blobUrl);
                        }, 1500);
                    }
                }, 200);
            };

            document.body.appendChild(iframe);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to generate PDF.";
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

    const paidCount = records.filter((record) => record.status === "paid").length;
    const activeCount = records.filter((record) => record.status === "active").length;
    const total = records.reduce((sum, record) => sum + normalizeAmount(record.amount), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="h-[90svh] overflow-hidden border-white/10 bg-slate-950 p-0 text-white sm:max-w-6xl">
                <div className="border-b border-white/10 px-5 py-4">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">Fines PDF Preview & Export</DialogTitle>
                    </DialogHeader>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <Card className="border-white/10 bg-slate-900/70">
                        <CardContent className="pt-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="border-sky-300/40 bg-sky-500/20 text-sky-100">
                                        {records.length} record{records.length === 1 ? "" : "s"}
                                    </Badge>
                                    <Badge className="border-emerald-300/40 bg-emerald-500/20 text-emerald-100">
                                        Paid: {paidCount}
                                    </Badge>
                                    <Badge className="border-amber-300/40 bg-amber-500/20 text-amber-100">
                                        Active: {activeCount}
                                    </Badge>
                                    <Badge className="border-purple-300/40 bg-purple-500/20 text-purple-100">
                                        Total: {formatPHP(total)}
                                    </Badge>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                    <div className="w-full sm:w-52">
                                        <Select
                                            value={paperPreset}
                                            onValueChange={(value) => setPaperPreset(value as BondPaperPreset)}
                                        >
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
                                                className="bg-sky-600 text-white hover:bg-sky-700"
                                                disabled={loading || !records.length}
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                {loading ? "Preparing…" : "Download PDF"}
                                            </Button>
                                        )}
                                    </PDFDownloadLink>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="overflow-hidden rounded-md border border-white/10 bg-black/30">
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
                            <div className="flex h-[420px] items-center justify-center text-sm text-white/60">
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