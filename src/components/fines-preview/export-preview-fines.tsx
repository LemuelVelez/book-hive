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
import { CopyPlus, Download, LayoutGrid, Printer } from "lucide-react";
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
type SlipDistributionMode = "duplicate" | "different-data";

type FinesPdfDocProps = {
    records: PrintableFineRecord[];
    generatedAtIso: string;
    paperPreset: BondPaperPreset;
    distributionMode: SlipDistributionMode;
};

type BondPaperPresetMeta = {
    label: string;
    fullDescription: string;
    fullSize: [number, number];
};

type SlipLayoutProfile = {
    containerPadding: number;
    sectionPadding: number;
    sectionGap: number;
    headerBrandSize: number;
    headerTitleSize: number;
    sectionTitleSize: number;
    labelSize: number;
    valueSize: number;
    summaryLabelSize: number;
    summaryValueSize: number;
    amountSize: number;
    amountMetaSize: number;
    badgeSize: number;
    primarySize: number;
    detailSize: number;
    tinySize: number;
    footerSize: number;
    titleMaxLength: number;
    reasonMaxLength: number;
    amountWidth: number;
    itemPadding: number;
    itemGap: number;
};

type FineSlipChunk = {
    key: string;
    records: PrintableFineRecord[];
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

const DISTRIBUTION_MODE_OPTIONS: Array<{
    value: SlipDistributionMode;
    label: string;
    description: string;
}> = [
    {
        value: "duplicate",
        label: "4 duplicated slips",
        description: "Repeat the same slip 4 times on the page.",
    },
    {
        value: "different-data",
        label: "4 slips with different data",
        description: "Place up to 4 different slips on the page.",
    },
];

const MAX_FINE_ITEMS_PER_SLIP = 2;
const SLIPS_PER_PAGE = 4;

const pdfStyles = StyleSheet.create({
    page: {
        padding: 18,
        fontSize: 7,
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
    quadrant: {
        height: "100%",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#94a3b8",
        borderRadius: 6,
        backgroundColor: "#ffffff",
        overflow: "hidden",
    },
    emptyQuadrant: {
        height: "100%",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#cbd5e1",
        borderRadius: 6,
        backgroundColor: "#f8fafc",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    emptyQuadrantText: {
        fontSize: 8,
        color: "#94a3b8",
        textAlign: "center",
        fontWeight: 700,
    },
    slipContainer: {
        height: "100%",
        flexDirection: "column",
        backgroundColor: "#ffffff",
    },
    header: {
        borderWidth: 1,
        borderColor: "#0f172a",
        borderRadius: 6,
        backgroundColor: "#f8fafc",
    },
    brand: {
        fontWeight: 700,
        color: "#0f172a",
    },
    title: {
        fontWeight: 700,
        color: "#111827",
        marginTop: 2,
    },
    section: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
    },
    sectionTitle: {
        fontWeight: 700,
        color: "#0f172a",
        textTransform: "uppercase",
    },
    keyValueRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    keyValueLabel: {
        color: "#475569",
        marginRight: 6,
        flexShrink: 0,
    },
    keyValueValue: {
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
        backgroundColor: "#f8fafc",
        paddingVertical: 5,
        paddingHorizontal: 6,
    },
    summaryLabel: {
        color: "#475569",
    },
    summaryValue: {
        marginTop: 2,
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
        backgroundColor: "#ffffff",
    },
    recordTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    recordId: {
        fontWeight: 700,
        color: "#0f172a",
    },
    amount: {
        fontWeight: 700,
        color: "#0f172a",
        textAlign: "right",
    },
    amountSubtle: {
        color: "#64748b",
        textAlign: "right",
        marginTop: 1,
    },
    badgeRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
    },
    badge: {
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 6,
        minHeight: 14,
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
    },
    badgeText: {
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
    primaryText: {
        color: "#0f172a",
        fontWeight: 700,
        marginTop: 4,
    },
    subtleText: {
        marginTop: 2,
        color: "#475569",
    },
    tinyText: {
        marginTop: 1,
        color: "#64748b",
    },
    footer: {
        marginTop: 6,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
    },
    footerText: {
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

function renderStatusBadgeStyle(status: PrintableFineStatus) {
    if (status === "paid") return pdfStyles.badgePaid;
    if (status === "active") return pdfStyles.badgeActive;
    if (status === "cancelled") return pdfStyles.badgeCancelled;
    return pdfStyles.badgeDefault;
}

function sortRecords(records: PrintableFineRecord[]) {
    return [...records].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );
}

function chunkRecords(records: PrintableFineRecord[], size: number): FineSlipChunk[] {
    const sorted = sortRecords(records);
    const chunks: FineSlipChunk[] = [];

    for (let index = 0; index < sorted.length; index += size) {
        const slice = sorted.slice(index, index + size);
        const key = slice.map((record) => String(record.id)).join("-") || `chunk-${index}`;
        chunks.push({ key, records: slice });
    }

    return chunks;
}

function paginateArray<T>(items: T[], size: number) {
    const pages: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
        pages.push(items.slice(index, index + size));
    }

    return pages;
}

function getSlipLayoutProfile(records: PrintableFineRecord[]): SlipLayoutProfile {
    const longestTitle = Math.max(
        ...records.map((record) => String(record.bookTitle ?? record.bookId ?? "").length),
        0
    );
    const longestReason = Math.max(
        ...records.map((record) => String(record.reason ?? "").length),
        0
    );
    const dense = records.length >= 2 || longestTitle > 42 || longestReason > 70;
    const extraDense = records.length >= 2 && (longestTitle > 56 || longestReason > 96);

    if (extraDense) {
        return {
            containerPadding: 8,
            sectionPadding: 6,
            sectionGap: 5,
            headerBrandSize: 8,
            headerTitleSize: 6.7,
            sectionTitleSize: 6.2,
            labelSize: 5.5,
            valueSize: 5.9,
            summaryLabelSize: 5.3,
            summaryValueSize: 6.1,
            amountSize: 6.6,
            amountMetaSize: 5.1,
            badgeSize: 5.1,
            primarySize: 5.9,
            detailSize: 5.45,
            tinySize: 5.1,
            footerSize: 5,
            titleMaxLength: 44,
            reasonMaxLength: 72,
            amountWidth: 64,
            itemPadding: 5,
            itemGap: 4,
        };
    }

    if (dense) {
        return {
            containerPadding: 9,
            sectionPadding: 7,
            sectionGap: 6,
            headerBrandSize: 8.4,
            headerTitleSize: 7,
            sectionTitleSize: 6.4,
            labelSize: 5.7,
            valueSize: 6.2,
            summaryLabelSize: 5.5,
            summaryValueSize: 6.4,
            amountSize: 6.9,
            amountMetaSize: 5.3,
            badgeSize: 5.3,
            primarySize: 6.1,
            detailSize: 5.65,
            tinySize: 5.3,
            footerSize: 5.2,
            titleMaxLength: 50,
            reasonMaxLength: 82,
            amountWidth: 70,
            itemPadding: 6,
            itemGap: 5,
        };
    }

    return {
        containerPadding: 10,
        sectionPadding: 8,
        sectionGap: 7,
        headerBrandSize: 8.8,
        headerTitleSize: 7.3,
        sectionTitleSize: 6.6,
        labelSize: 5.9,
        valueSize: 6.5,
        summaryLabelSize: 5.7,
        summaryValueSize: 6.8,
        amountSize: 7.2,
        amountMetaSize: 5.5,
        badgeSize: 5.5,
        primarySize: 6.4,
        detailSize: 5.9,
        tinySize: 5.5,
        footerSize: 5.4,
        titleMaxLength: 60,
        reasonMaxLength: 96,
        amountWidth: 76,
        itemPadding: 6,
        itemGap: 6,
    };
}

function FineSlip({
    records,
    generatedAtIso,
}: {
    records: PrintableFineRecord[];
    generatedAtIso: string;
}) {
    const limitedRecords = records.slice(0, MAX_FINE_ITEMS_PER_SLIP);
    const profile = getSlipLayoutProfile(limitedRecords);
    const first = limitedRecords[0];

    const userName =
        first?.studentName ||
        first?.studentEmail ||
        (first?.studentId ? `ID: ${first.studentId}` : "Unknown user");
    const userEmail = first?.studentEmail || "—";
    const userId = first?.studentId || first?.userId || "—";

    const total = limitedRecords.reduce((sum, record) => sum + normalizeAmount(record.amount), 0);
    const paidCount = limitedRecords.filter((record) => record.status === "paid").length;
    const activeCount = limitedRecords.filter((record) => record.status === "active").length;
    const cancelledCount = limitedRecords.filter((record) => record.status === "cancelled").length;

    return (
        <View
            style={[
                pdfStyles.quadrant,
                {
                    padding: profile.containerPadding,
                },
            ]}
        >
            <View style={pdfStyles.slipContainer}>
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
                    <Text style={[pdfStyles.brand, { fontSize: profile.headerBrandSize }]}>BookHive Library</Text>
                    <Text style={[pdfStyles.title, { fontSize: profile.headerTitleSize }]}>Fines Record Slip</Text>
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
                                fontSize: profile.sectionTitleSize,
                                marginBottom: Math.max(4, profile.sectionGap - 1),
                            },
                        ]}
                    >
                        Account Details
                    </Text>

                    <View style={[pdfStyles.keyValueRow, { marginBottom: 3 }]}> 
                        <Text style={[pdfStyles.keyValueLabel, { fontSize: profile.labelSize }]}>Name</Text>
                        <Text style={[pdfStyles.keyValueValue, { fontSize: profile.valueSize }]}> 
                            {trimText(String(userName), 36)}
                        </Text>
                    </View>
                    <View style={[pdfStyles.keyValueRow, { marginBottom: 3 }]}> 
                        <Text style={[pdfStyles.keyValueLabel, { fontSize: profile.labelSize }]}>ID</Text>
                        <Text style={[pdfStyles.keyValueValue, { fontSize: profile.valueSize }]}> 
                            {trimText(String(userId), 22)}
                        </Text>
                    </View>
                    <View style={[pdfStyles.keyValueRow, { marginBottom: 3 }]}> 
                        <Text style={[pdfStyles.keyValueLabel, { fontSize: profile.labelSize }]}>Email</Text>
                        <Text style={[pdfStyles.keyValueValue, { fontSize: profile.valueSize }]}> 
                            {trimText(String(userEmail), 28)}
                        </Text>
                    </View>
                    <View style={pdfStyles.keyValueRow}>
                        <Text style={[pdfStyles.keyValueLabel, { fontSize: profile.labelSize }]}>Generated</Text>
                        <Text style={[pdfStyles.keyValueValue, { fontSize: profile.valueSize }]}> 
                            {fmtDateTime(generatedAtIso)}
                        </Text>
                    </View>
                </View>

                <View style={[pdfStyles.summaryGrid, { marginBottom: profile.sectionGap }]}> 
                    <View style={[pdfStyles.summaryCard, { marginRight: 5 }]}> 
                        <Text style={[pdfStyles.summaryLabel, { fontSize: profile.summaryLabelSize }]}>Items</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: profile.summaryValueSize }]}>{limitedRecords.length}</Text>
                    </View>
                    <View style={[pdfStyles.summaryCard, { marginRight: 5 }]}> 
                        <Text style={[pdfStyles.summaryLabel, { fontSize: profile.summaryLabelSize }]}>Active</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: profile.summaryValueSize }]}>{activeCount}</Text>
                    </View>
                    <View style={pdfStyles.summaryCard}> 
                        <Text style={[pdfStyles.summaryLabel, { fontSize: profile.summaryLabelSize }]}>Paid</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: profile.summaryValueSize }]}>{paidCount}</Text>
                    </View>
                </View>

                <View style={[pdfStyles.summaryGrid, { marginBottom: profile.sectionGap }]}> 
                    <View style={[pdfStyles.summaryCard, { marginRight: 5 }]}> 
                        <Text style={[pdfStyles.summaryLabel, { fontSize: profile.summaryLabelSize }]}>Cancelled</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: profile.summaryValueSize }]}>{cancelledCount}</Text>
                    </View>
                    <View style={pdfStyles.summaryCard}> 
                        <Text style={[pdfStyles.summaryLabel, { fontSize: profile.summaryLabelSize }]}>Total</Text>
                        <Text style={[pdfStyles.summaryValue, { fontSize: profile.summaryValueSize }]}>{formatPHP(total)}</Text>
                    </View>
                </View>

                <View
                    style={[
                        pdfStyles.section,
                        {
                            padding: profile.sectionPadding,
                            flexGrow: 1,
                        },
                    ]}
                >
                    <Text
                        style={[
                            pdfStyles.sectionTitle,
                            {
                                fontSize: profile.sectionTitleSize,
                                marginBottom: Math.max(4, profile.sectionGap - 1),
                            },
                        ]}
                    >
                        Fine Items
                    </Text>

                    <View style={pdfStyles.recordsWrap}>
                        {limitedRecords.map((record, index) => {
                            const bookLabel = record.bookTitle
                                ? trimText(record.bookTitle, profile.titleMaxLength)
                                : record.bookId
                                  ? `Book #${record.bookId}`
                                  : "No book title";
                            const reasonLabel = record.reason
                                ? trimText(record.reason, profile.reasonMaxLength)
                                : "No reason provided";

                            return (
                                <View
                                    key={String(record.id)}
                                    style={[
                                        pdfStyles.recordCard,
                                        {
                                            padding: profile.itemPadding,
                                            marginBottom:
                                                index === limitedRecords.length - 1 ? 0 : profile.itemGap,
                                        },
                                    ]}
                                    wrap={false}
                                >
                                    <View style={pdfStyles.recordTop}>
                                        <View style={{ flex: 1, marginRight: 6 }}>
                                            <Text style={[pdfStyles.recordId, { fontSize: profile.primarySize }]}> 
                                                Fine #{String(record.id)}
                                            </Text>
                                            <Text style={[pdfStyles.tinyText, { fontSize: profile.tinySize }]}> 
                                                {record.sourceLabel === "damage" ? "Damage record" : "Fine record"}
                                            </Text>
                                        </View>
                                        <View style={{ width: profile.amountWidth }}>
                                            <Text style={[pdfStyles.amount, { fontSize: profile.amountSize }]}> 
                                                {formatPHP(normalizeAmount(record.amount))}
                                            </Text>
                                            <Text style={[pdfStyles.amountSubtle, { fontSize: profile.amountMetaSize }]}> 
                                                Due amount
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={pdfStyles.badgeRow}>
                                        <View
                                            style={[
                                                pdfStyles.badge,
                                                renderStatusBadgeStyle(record.status),
                                                {
                                                    minHeight: 13,
                                                    paddingHorizontal: 6,
                                                },
                                            ]}
                                        >
                                            <Text style={[pdfStyles.badgeText, { fontSize: profile.badgeSize }]}> 
                                                {statusText(record.status)}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={[pdfStyles.primaryText, { fontSize: profile.primarySize }]}> 
                                        {bookLabel}
                                    </Text>
                                    <Text style={[pdfStyles.subtleText, { fontSize: profile.detailSize }]}> 
                                        Reason: {reasonLabel}
                                    </Text>
                                    <Text style={[pdfStyles.subtleText, { fontSize: profile.detailSize }]}> 
                                        Created: {fmtDate(record.createdAt)}
                                    </Text>
                                    <Text style={[pdfStyles.subtleText, { fontSize: profile.detailSize }]}> 
                                        Paid: {fmtDate(getDatePaid(record))}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                <View style={[pdfStyles.footer, { marginTop: profile.sectionGap }]}> 
                    <Text style={[pdfStyles.footerText, { fontSize: profile.footerSize }]}> 
                        BookHive Library • Printed {fmtDateTime(generatedAtIso)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function buildSlipPages(records: PrintableFineRecord[], mode: SlipDistributionMode) {
    const chunks = chunkRecords(records, MAX_FINE_ITEMS_PER_SLIP);

    if (!chunks.length) return [] as FineSlipChunk[][];

    if (mode === "duplicate") {
        return chunks.map((chunk) => Array.from({ length: SLIPS_PER_PAGE }, () => chunk));
    }

    return paginateArray(chunks, SLIPS_PER_PAGE);
}

function FinesPdfDocument({
    records,
    generatedAtIso,
    paperPreset,
    distributionMode,
}: FinesPdfDocProps) {
    const selectedPaperMeta = BOND_PAPER_PRESETS[paperPreset];
    const pages = buildSlipPages(records, distributionMode);
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
            {pages.length ? (
                pages.map((pageChunks, pageIndex) => (
                    <Page
                        key={`page-${pageIndex}`}
                        size={selectedPaperMeta.fullSize}
                        style={pdfStyles.page}
                    >
                        <View style={[pdfStyles.cutGuideVertical, { left: verticalGuideLeft }]} fixed />
                        <View style={[pdfStyles.cutGuideHorizontal, { top: horizontalGuideTop }]} fixed />
                        <Text
                            style={[pdfStyles.cutGuideLabel, { top: 6, left: verticalGuideLeft - 42 }]}
                            fixed
                        >
                            ✂ CUT
                        </Text>
                        <Text
                            style={[pdfStyles.cutGuideLabel, { top: horizontalGuideTop - 10, right: 6 }]}
                            fixed
                        >
                            ✂ CUT
                        </Text>

                        <View style={pdfStyles.grid}>
                            {Array.from({ length: SLIPS_PER_PAGE }, (_, slipIndex) => {
                                const chunk = pageChunks[slipIndex];

                                return (
                                    <View
                                        key={`page-${pageIndex}-slip-${slipIndex}`}
                                        style={{
                                            width: slipWidth,
                                            height: slipHeight,
                                        }}
                                    >
                                        {chunk ? (
                                            <FineSlip
                                                records={chunk.records}
                                                generatedAtIso={generatedAtIso}
                                            />
                                        ) : (
                                            <View style={pdfStyles.emptyQuadrant}>
                                                <Text style={pdfStyles.emptyQuadrantText}>No more fine items</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </Page>
                ))
            ) : (
                <Page size={selectedPaperMeta.fullSize} style={pdfStyles.page}>
                    <View style={pdfStyles.emptyQuadrant}>
                        <Text style={pdfStyles.emptyQuadrantText}>No fine records available</Text>
                    </View>
                </Page>
            )}
        </Document>
    );
}

export function ExportPreviewFines({
    open,
    onOpenChange,
    records,
    selectedFineId: _selectedFineId = null,
    autoPrintOnOpen = false,
    fileNamePrefix = "bookhive-fines-record",
}: ExportPreviewFinesProps) {
    const [viewerHeight, setViewerHeight] = React.useState(720);
    const [generatedAtIso, setGeneratedAtIso] = React.useState(() => new Date().toISOString());
    const [paperPreset, setPaperPreset] = React.useState<BondPaperPreset>("short");
    const [distributionMode, setDistributionMode] =
        React.useState<SlipDistributionMode>("duplicate");
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
                generatedAtIso={generatedAtIso}
                paperPreset={paperPreset}
                distributionMode={distributionMode}
            />
        ),
        [records, generatedAtIso, paperPreset, distributionMode]
    );

    const fileName = React.useMemo(() => {
        if (!records.length) return `${fileNamePrefix}.pdf`;

        const presetSuffix = safeToken(BOND_PAPER_PRESETS[paperPreset].label);
        const modeSuffix = safeToken(distributionMode);
        const first = records[0];
        const rawUser =
            String(first.studentId ?? "").trim() ||
            String(first.userId ?? "").trim() ||
            String(first.studentEmail ?? "").trim() ||
            "user";
        const ymd = new Date(generatedAtIso).toISOString().slice(0, 10);
        return `${safeToken(fileNamePrefix)}-${presetSuffix}-${modeSuffix}-${safeToken(rawUser)}-${ymd}.pdf`;
    }, [records, generatedAtIso, fileNamePrefix, paperPreset, distributionMode]);

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
    const groupedSlipCount = chunkRecords(records, MAX_FINE_ITEMS_PER_SLIP).length;
    const total = records.reduce((sum, record) => sum + normalizeAmount(record.amount), 0);
    const selectedModeMeta =
        DISTRIBUTION_MODE_OPTIONS.find((option) => option.value === distributionMode) ??
        DISTRIBUTION_MODE_OPTIONS[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[95svh] overflow-y-auto border-white/10 bg-slate-950 p-0 text-white sm:max-w-6xl">
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
                                        {records.length} fine item{records.length === 1 ? "" : "s"}
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
                                    <Badge className="border-indigo-300/40 bg-indigo-500/20 text-indigo-100">
                                        Slips: {groupedSlipCount}
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

                                    <div className="w-full sm:w-72">
                                        <Select
                                            value={distributionMode}
                                            onValueChange={(value) =>
                                                setDistributionMode(value as SlipDistributionMode)
                                            }
                                        >
                                            <SelectTrigger className="border-white/20 bg-slate-950/70 text-white">
                                                <SelectValue placeholder="Slip mode" />
                                            </SelectTrigger>
                                            <SelectContent className="border-white/10 bg-slate-950 text-white">
                                                {DISTRIBUTION_MODE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
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

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
                                <span className="inline-flex items-center gap-1">
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                    {BOND_PAPER_PRESETS[paperPreset].label} • {BOND_PAPER_PRESETS[paperPreset].fullDescription}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <CopyPlus className="h-3.5 w-3.5" />
                                    {selectedModeMeta.description}
                                </span>
                                <span>Each slip shows up to 2 fine items.</span>
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