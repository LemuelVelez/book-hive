import * as React from "react"
import {
    Document,
    Page,
    PDFDownloadLink,
    PDFViewer,
    StyleSheet,
    Text,
    View,
    pdf,
} from "@react-pdf/renderer"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Loader2, Printer, ScanLine } from "lucide-react"
import { toast } from "sonner"

export type PrintableIncomeStatus = "active" | "paid" | "cancelled" | string

export type PrintableIncomeRecord = {
    id: string | number
    userId?: string | number | null
    studentId?: string | number | null
    studentName?: string | null
    studentEmail?: string | null
    bookTitle?: string | null
    bookId?: string | number | null
    reason?: string | null
    status: PrintableIncomeStatus
    amount: number
    createdAt?: string | null
    resolvedAt?: string | null
    paidDate?: string | null
    sourceLabel?: "fine" | "damage" | string | null
    referenceLabel?: string | null
    damageSeverity?: string | null
}

type ExportPreviewIncomeProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    records: PrintableIncomeRecord[]
    autoPrintOnOpen?: boolean
    fileNamePrefix?: string
    reportTitle?: string
    reportSubtitle?: string
}

type IncomePdfDocProps = {
    records: PrintableIncomeRecord[]
    generatedAtIso: string
    reportTitle?: string
    reportSubtitle?: string
}

function formatPHP(n: number) {
    if (typeof n !== "number" || Number.isNaN(n)) return "PHP 0.00"
    try {
        const formatted = new Intl.NumberFormat("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(n)
        return `PHP ${formatted}`
    } catch {
        return `PHP ${n.toFixed(2)}`
    }
}

function normalizeAmount(value: unknown): number {
    const num = typeof value === "number" ? value : Number(value)
    return Number.isFinite(num) ? num : 0
}

function fmtDate(value?: string | null) {
    if (!value) return "—"
    try {
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) return value
        return d.toLocaleDateString("en-CA")
    } catch {
        return value
    }
}

function fmtDateTime(value?: string | null) {
    if (!value) return "—"
    try {
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) return value
        return d.toLocaleString("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return value
    }
}

function statusText(status: PrintableIncomeStatus) {
    if (status === "active") return "Active"
    if (status === "paid") return "Paid"
    if (status === "cancelled") return "Cancelled"
    return status || "Unknown"
}

function sourceText(source?: PrintableIncomeRecord["sourceLabel"]) {
    if (source === "damage") return "Damage fee"
    if (source === "fine") return "Borrow fine"
    return "Income"
}

function safeToken(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
}

function getDatePaid(record: PrintableIncomeRecord) {
    return record.paidDate || record.resolvedAt || record.createdAt || null
}

function getPrintableRecordDate(record: PrintableIncomeRecord) {
    return getDatePaid(record) || record.createdAt || null
}

function getUserPrimary(record: PrintableIncomeRecord) {
    return (
        (record.studentName && String(record.studentName).trim()) ||
        (record.studentEmail && String(record.studentEmail).trim()) ||
        (record.studentId ? `Student ID: ${record.studentId}` : null) ||
        (record.userId ? `User ID: ${record.userId}` : null) ||
        "Unknown user"
    )
}

function getUserSecondary(record: PrintableIncomeRecord) {
    const parts: string[] = []
    if (record.studentId) parts.push(`Student ID: ${record.studentId}`)
    if (record.studentEmail && record.studentEmail !== getUserPrimary(record)) {
        parts.push(String(record.studentEmail))
    }
    if (!record.studentId && !record.studentEmail && record.userId) {
        parts.push(`User ID: ${record.userId}`)
    }
    return parts.join(" · ")
}

function getBookPrimary(record: PrintableIncomeRecord) {
    return (
        (record.bookTitle && String(record.bookTitle).trim()) ||
        (record.bookId ? `Book ID: ${record.bookId}` : null) ||
        "Unknown book"
    )
}

function chunkRecords<T>(items: T[], size: number): T[][] {
    if (!items.length) return [[]]
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
    }
    return chunks
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
    colUser: { width: "24%", paddingRight: 6 },
    colDetails: { width: "30%", paddingRight: 6 },
    colType: {
        width: "11%",
        paddingRight: 4,
    },
    colStatus: {
        width: "12%",
        paddingRight: 4,
        alignItems: "center",
    },
    colDate: { width: "11%", paddingRight: 4 },
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
        fontSize: 8.45,
        color: "#0f172a",
        lineHeight: 1.25,
    },
    tdSubtle: {
        fontSize: 7.55,
        color: "#475569",
        marginTop: 1,
        lineHeight: 1.2,
    },
    tdCenter: {
        fontSize: 8.45,
        color: "#0f172a",
        lineHeight: 1.25,
        textAlign: "center",
    },
    tdRight: {
        fontSize: 8.45,
        color: "#0f172a",
        lineHeight: 1.25,
        textAlign: "right",
    },
    emptyRowText: {
        fontSize: 8.4,
        color: "#475569",
        textAlign: "center",
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
})

function IncomePdfDocument({
    records,
    generatedAtIso,
    reportTitle,
    reportSubtitle,
}: IncomePdfDocProps) {
    const sorted = [...records].sort((a, b) =>
        String(getPrintableRecordDate(b) ?? "").localeCompare(String(getPrintableRecordDate(a) ?? ""))
    )

    const paidTotal = sorted
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + normalizeAmount(r.amount), 0)

    const outstandingTotal = sorted
        .filter((r) => r.status === "active")
        .reduce((sum, r) => sum + normalizeAmount(r.amount), 0)

    const cancelledTotal = sorted
        .filter((r) => r.status === "cancelled")
        .reduce((sum, r) => sum + normalizeAmount(r.amount), 0)

    const paidCount = sorted.filter((r) => r.status === "paid").length
    const activeCount = sorted.filter((r) => r.status === "active").length
    const cancelledCount = sorted.filter((r) => r.status === "cancelled").length

    const dateValues = sorted
        .map((r) => getPrintableRecordDate(r))
        .filter(Boolean)
        .map((value) => new Date(String(value)))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())

    const dateRange =
        dateValues.length > 0
            ? `${fmtDate(dateValues[0].toISOString())} → ${fmtDate(
                  dateValues[dateValues.length - 1].toISOString()
              )}`
            : "—"

    const defaultTitle = "BookHive Library • Income Report"
    const defaultSubtitle =
        "Printable report for overall, monthly, and weekly income records."

    const pages = chunkRecords(sorted, 12)

    return (
        <Document title={reportTitle || defaultTitle}>
            {pages.map((pageRows, pageIndex) => {
                const isFirstPage = pageIndex === 0
                const isLastPage = pageIndex === pages.length - 1
                const heroStyle = isFirstPage
                    ? pdfStyles.hero
                    : [pdfStyles.hero, pdfStyles.heroCompact]

                return (
                    <Page key={`income-page-${pageIndex + 1}`} size="A4" style={pdfStyles.page}>
                        <View style={heroStyle}>
                            <Text style={pdfStyles.heroTitle}>{reportTitle || defaultTitle}</Text>
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
                                        <Text style={pdfStyles.metaLabel}>Collected Income</Text>
                                        <Text style={pdfStyles.metaValue}>{formatPHP(paidTotal)}</Text>
                                    </View>
                                    <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                                        <Text style={pdfStyles.metaLabel}>Outstanding</Text>
                                        <Text style={pdfStyles.metaValue}>
                                            {formatPHP(outstandingTotal)}
                                        </Text>
                                    </View>
                                </View>

                                <View style={pdfStyles.metaGrid}>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Date Coverage</Text>
                                        <Text style={pdfStyles.metaValue}>{dateRange}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Paid Records</Text>
                                        <Text style={pdfStyles.metaValue}>{paidCount}</Text>
                                    </View>
                                    <View style={pdfStyles.metaCard}>
                                        <Text style={pdfStyles.metaLabel}>Active Records</Text>
                                        <Text style={pdfStyles.metaValue}>{activeCount}</Text>
                                    </View>
                                    <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                                        <Text style={pdfStyles.metaLabel}>Cancelled Records</Text>
                                        <Text style={pdfStyles.metaValue}>{cancelledCount}</Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <Text style={pdfStyles.pageIndicator}>
                                Continuation of income items
                            </Text>
                        )}

                        <Text style={pdfStyles.sectionTitle}>Income Items</Text>

                        <View style={pdfStyles.tableHead}>
                            <View style={pdfStyles.colUser}>
                                <Text style={pdfStyles.th}>User</Text>
                            </View>
                            <View style={pdfStyles.colDetails}>
                                <Text style={pdfStyles.th}>Book / Notes</Text>
                            </View>
                            <View style={pdfStyles.colType}>
                                <Text style={pdfStyles.th}>Type</Text>
                            </View>
                            <View style={pdfStyles.colStatus}>
                                <Text style={pdfStyles.thCenter}>Status</Text>
                            </View>
                            <View style={pdfStyles.colDate}>
                                <Text style={pdfStyles.th}>Record Date</Text>
                            </View>
                            <View style={pdfStyles.colAmount}>
                                <Text style={pdfStyles.thRight}>Amount</Text>
                            </View>
                        </View>

                        {pageRows.length ? (
                            pageRows.map((record) => {
                                const statusStyle =
                                    record.status === "paid"
                                        ? pdfStyles.statusPaid
                                        : record.status === "active"
                                          ? pdfStyles.statusActive
                                          : record.status === "cancelled"
                                            ? pdfStyles.statusCancelled
                                            : pdfStyles.statusDefault

                                return (
                                    <View
                                        key={`${String(record.id)}-${pageIndex}`}
                                        style={pdfStyles.row}
                                        wrap={false}
                                    >
                                        <View style={pdfStyles.colUser}>
                                            <Text style={pdfStyles.td}>{getUserPrimary(record)}</Text>
                                            {!!getUserSecondary(record) && (
                                                <Text style={pdfStyles.tdSubtle}>
                                                    {getUserSecondary(record)}
                                                </Text>
                                            )}
                                        </View>

                                        <View style={pdfStyles.colDetails}>
                                            <Text style={pdfStyles.td}>{getBookPrimary(record)}</Text>
                                            {!!record.reason && (
                                                <Text style={pdfStyles.tdSubtle}>
                                                    Notes: {record.reason}
                                                </Text>
                                            )}
                                            {!!record.referenceLabel && (
                                                <Text style={pdfStyles.tdSubtle}>
                                                    Reference: {record.referenceLabel}
                                                </Text>
                                            )}
                                        </View>

                                        <View style={pdfStyles.colType}>
                                            <Text style={pdfStyles.td}>
                                                {sourceText(record.sourceLabel)}
                                            </Text>
                                            {!!record.damageSeverity && (
                                                <Text style={pdfStyles.tdSubtle}>
                                                    {record.damageSeverity}
                                                </Text>
                                            )}
                                        </View>

                                        <View style={pdfStyles.colStatus}>
                                            <View style={[pdfStyles.statusBadgeWrap, statusStyle]}>
                                                <Text style={pdfStyles.statusBadgeText}>
                                                    {statusText(record.status)}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={pdfStyles.colDate}>
                                            <Text style={pdfStyles.td}>
                                                {fmtDate(getPrintableRecordDate(record))}
                                            </Text>
                                        </View>

                                        <View style={pdfStyles.colAmount}>
                                            <Text style={pdfStyles.tdRight}>
                                                {formatPHP(normalizeAmount(record.amount))}
                                            </Text>
                                        </View>
                                    </View>
                                )
                            })
                        ) : (
                            <View style={pdfStyles.row}>
                                <View style={{ width: "100%" }}>
                                    <Text style={pdfStyles.emptyRowText}>
                                        No income records available for this report.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {isLastPage ? (
                            <>
                                <View style={pdfStyles.totalsWrap}>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>Paid Total</Text>
                                        <Text style={pdfStyles.totalsValue}>
                                            {formatPHP(paidTotal)}
                                        </Text>
                                    </View>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>Outstanding Total</Text>
                                        <Text style={pdfStyles.totalsValue}>
                                            {formatPHP(outstandingTotal)}
                                        </Text>
                                    </View>
                                    <View style={pdfStyles.totalsLine}>
                                        <Text style={pdfStyles.totalsLabel}>Cancelled Total</Text>
                                        <Text style={pdfStyles.totalsValue}>
                                            {formatPHP(cancelledTotal)}
                                        </Text>
                                    </View>
                                    <View style={[pdfStyles.totalsLine, pdfStyles.totalsGrand]}>
                                        <Text
                                            style={[
                                                pdfStyles.totalsLabel,
                                                { fontWeight: 700 },
                                            ]}
                                        >
                                            Visible Records Total
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.totalsValue,
                                                { fontSize: 10 },
                                            ]}
                                        >
                                            {formatPHP(
                                                paidTotal + outstandingTotal + cancelledTotal
                                            )}
                                        </Text>
                                    </View>
                                </View>

                                <View style={pdfStyles.notesWrap}>
                                    <Text style={pdfStyles.notesTitle}>Processing Notes</Text>
                                    <Text style={pdfStyles.noteText}>
                                        1) Paid records represent collected library income.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        2) Active records are outstanding balances not yet collected.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        3) Damage fee rows are included when a paid damage report exists in the income view.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        4) This PDF reflects the current overall, monthly, or weekly income filter shown in the dashboard.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        5) Long text fields are wrapped to fit the printable layout.
                                    </Text>
                                    <Text style={pdfStyles.noteText}>
                                        (Cebuano) Ang gi-print nga report kay base sa current filtered income list ug naka-wrap ang taas nga text aron dili mo-slide.
                                    </Text>
                                </View>
                            </>
                        ) : null}

                        <View style={pdfStyles.footer}>
                            <Text style={pdfStyles.footerText}>
                                BookHive Library • Generated via Income Module
                            </Text>
                            <Text style={pdfStyles.footerText}>
                                Printed: {fmtDateTime(generatedAtIso)}
                            </Text>
                        </View>
                    </Page>
                )
            })}
        </Document>
    )
}

export function ExportPreviewIncome({
    open,
    onOpenChange,
    records,
    autoPrintOnOpen = false,
    fileNamePrefix = "bookhive-income-report",
    reportTitle = "BookHive Library • Income Report",
    reportSubtitle = "Printable report for overall, monthly, and weekly income records.",
}: ExportPreviewIncomeProps) {
    const [smartView, setSmartView] = React.useState(true)
    const [viewerHeight, setViewerHeight] = React.useState(720)
    const [generatedAtIso, setGeneratedAtIso] = React.useState(() => new Date().toISOString())
    const [smartPreviewUrl, setSmartPreviewUrl] = React.useState<string | null>(null)
    const [smartPreviewBusy, setSmartPreviewBusy] = React.useState(false)
    const autoPrintedRef = React.useRef(false)

    React.useEffect(() => {
        if (!open) {
            autoPrintedRef.current = false
            return
        }
        setGeneratedAtIso(new Date().toISOString())
    }, [open, records.length])

    React.useEffect(() => {
        if (!open) return

        const onResize = () => {
            const h = window.innerHeight
            const next = Math.max(420, Math.min(h - 240, 1000))
            setViewerHeight(next)
        }

        onResize()
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [open])

    const pdfNode = React.useMemo(
        () => (
            <IncomePdfDocument
                records={records}
                generatedAtIso={generatedAtIso}
                reportTitle={reportTitle}
                reportSubtitle={reportSubtitle}
            />
        ),
        [records, generatedAtIso, reportTitle, reportSubtitle]
    )

    React.useEffect(() => {
        let cancelled = false
        let localUrl: string | null = null

        async function buildSmartPreview() {
            if (!open || !records.length) {
                setSmartPreviewUrl(null)
                return
            }

            setSmartPreviewBusy(true)
            try {
                const blob = await pdf(pdfNode).toBlob()
                if (cancelled) return

                localUrl = URL.createObjectURL(blob)
                setSmartPreviewUrl(localUrl)
            } catch {
                if (!cancelled) {
                    setSmartPreviewUrl(null)
                }
            } finally {
                if (!cancelled) {
                    setSmartPreviewBusy(false)
                }
            }
        }

        void buildSmartPreview()

        return () => {
            cancelled = true
            if (localUrl) {
                URL.revokeObjectURL(localUrl)
            }
        }
    }, [open, records.length, pdfNode])

    const fileName = React.useMemo(() => {
        const ymd = new Date(generatedAtIso).toISOString().slice(0, 10)
        return `${safeToken(fileNamePrefix)}-${ymd}.pdf`
    }, [generatedAtIso, fileNamePrefix])

    const handlePrint = React.useCallback(async () => {
        if (!records.length) return

        try {
            const blob = await pdf(pdfNode).toBlob()
            const blobUrl = URL.createObjectURL(blob)

            const iframe = document.createElement("iframe")
            iframe.style.position = "fixed"
            iframe.style.right = "0"
            iframe.style.bottom = "0"
            iframe.style.width = "0"
            iframe.style.height = "0"
            iframe.style.border = "0"
            iframe.src = blobUrl

            iframe.onload = () => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow?.focus()
                        iframe.contentWindow?.print()
                        toast.success("Print dialog opened", {
                            description: "You can print the income report now.",
                        })
                    } catch {
                        toast.error("Could not start print", {
                            description: "Try using Download PDF, then print manually.",
                        })
                    } finally {
                        setTimeout(() => {
                            if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
                            URL.revokeObjectURL(blobUrl)
                        }, 1500)
                    }
                }, 200)
            }

            document.body.appendChild(iframe)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to generate PDF."
            toast.error("Print failed", { description: message })
        }
    }, [records.length, pdfNode])

    React.useEffect(() => {
        if (!open || !autoPrintOnOpen || autoPrintedRef.current || !records.length) {
            return
        }
        autoPrintedRef.current = true
        void handlePrint()
    }, [open, autoPrintOnOpen, records.length, handlePrint])

    const paidCount = records.filter((r) => r.status === "paid").length
    const activeCount = records.filter((r) => r.status === "active").length
    const totalPaid = records
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + normalizeAmount(r.amount), 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-6xl bg-slate-950 border-white/10 text-white p-0 overflow-hidden h-[90svh]">
                <div className="px-5 pt-5 pb-3 border-b border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            Income PDF Preview & Export
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                            Smart View uses a fit-width pre-rendered preview. Standard View uses PDF React Viewer
                            with toolbar for the current overall, monthly, or weekly income selection.
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
                                        Collected: {formatPHP(totalPaid)}
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
                                        title="Smart Income PDF Preview"
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
                                No income records available for preview.
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default ExportPreviewIncome