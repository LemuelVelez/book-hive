/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import DashboardLayout from "@/components/dashboard-layout"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
    Coins,
    RefreshCcw,
    Loader2,
    Search,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    FileSearch,
    Printer,
} from "lucide-react"
import { toast } from "sonner"

import {
    DEFAULT_FINE_PER_HOUR,
    fetchFines,
    type FineDTO,
    type FineStatus,
} from "@/lib/fines"
import { API_BASE } from "@/api/auth/route"
import type { DamageReportDTO, DamageStatus, DamageSeverity } from "@/lib/damageReports"
import {
    ExportPreviewIncome,
    type PrintableIncomeRecord,
} from "@/components/income-preview/export-preview-income"

type StatusFilter = "paid" | "all" | FineStatus
type PeriodFilter = "overall" | "monthly" | "weekly"
type PeriodValue = "all" | string

type DamageReportRow = DamageReportDTO & {
    photoUrl?: string | null
}

type JsonOk<T> = { ok: true } & T

type IncomeRow = FineDTO & {
    _source?: "fine" | "damage"
    damageReportId?: string | number | null
    damageSeverity?: DamageSeverity | null
    damageStatus?: DamageStatus | null
    damageFee?: number | null
    damageNotes?: string | null
}

/* ----------------------------- Helpers ----------------------------- */

function fmtDate(d?: string | null) {
    if (!d) return "—"
    try {
        const date = new Date(d)
        if (Number.isNaN(date.getTime())) return d
        return date.toLocaleDateString("en-CA")
    } catch {
        return d
    }
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

function normalizeAmount(value: any): number {
    if (value === null || value === undefined) return 0
    const num = typeof value === "number" ? value : Number(value)
    return Number.isNaN(num) ? 0 : num
}

function getOfficialReceiptLabel(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null
    const value = String(raw).trim()
    return value ? `OR ${value}` : null
}

function suggestedFineFromSeverity(severity?: DamageSeverity | null): number {
    switch (severity) {
        case "minor":
            return 50
        case "moderate":
            return 150
        case "major":
            return 300
        default:
            return 0
    }
}

function getRowDatePaid(r: IncomeRow): string | null {
    if (r.status !== "paid") return null
    return ((r as any).resolvedAt || (r as any).updatedAt || (r as any).createdAt || null) as any
}

function getRowSortDate(r: IncomeRow): string | null {
    return (getRowDatePaid(r) || (r as any).createdAt || null) as any
}

function getRowPeriodDate(r: IncomeRow): string | null {
    return getRowDatePaid(r) || (r as any).createdAt || null
}

function toMonthKey(dateStr?: string | null): string | null {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    return `${y}-${m}`
}

function formatLocalDateKey(date: Date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

function toWeekKey(dateStr?: string | null): string | null {
    if (!dateStr) return null
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return null

    const start = new Date(date)
    start.setHours(0, 0, 0, 0)

    const day = start.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diffToMonday)

    return formatLocalDateKey(start)
}

function monthLabel(key: string) {
    const [yy, mm] = key.split("-")
    const y = Number(yy)
    const m = Number(mm)
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return key
    try {
        return new Intl.DateTimeFormat("en-PH", {
            month: "long",
            year: "numeric",
        }).format(new Date(y, m - 1, 1))
    } catch {
        return key
    }
}

function weekLabel(key: string) {
    const start = new Date(`${key}T00:00:00`)
    if (Number.isNaN(start.getTime())) return key

    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    try {
        const formatter = new Intl.DateTimeFormat("en-PH", {
            month: "short",
            day: "2-digit",
            year: "numeric",
        })
        return `${formatter.format(start)} - ${formatter.format(end)}`
    } catch {
        return `${fmtDate(start.toISOString())} - ${fmtDate(end.toISOString())}`
    }
}

function periodFilterLabel(periodFilter: PeriodFilter, periodValue: PeriodValue) {
    if (periodFilter === "overall") return "Overall records"
    if (periodFilter === "monthly") {
        return periodValue !== "all" ? `Monthly • ${monthLabel(periodValue)}` : "Monthly • All months"
    }
    return periodValue !== "all" ? `Weekly • ${weekLabel(periodValue)}` : "Weekly • All weeks"
}

/* ------------------------ Damage → Income helpers ------------------------ */

async function fetchDamageReportsForIncome(): Promise<DamageReportRow[]> {
    let resp: Response
    try {
        resp = await fetch(`${API_BASE}/api/damage-reports`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        })
    } catch (e: any) {
        const details = e?.message ? ` Details: ${e.message}` : ""
        throw new Error(
            `Cannot reach the API (${API_BASE}). Is the server running and allowing this origin?${details}`
        )
    }

    const ct = resp.headers.get("content-type")?.toLowerCase() || ""
    const isJson = ct.includes("application/json")

    if (!resp.ok) {
        if (isJson) {
            try {
                const data = (await resp.json()) as any
                if (data && typeof data === "object" && typeof data.message === "string") {
                    throw new Error(data.message)
                }
            } catch {
                /* ignore */
            }
        } else {
            try {
                const text = await resp.text()
                if (text) throw new Error(text)
            } catch {
                /* ignore */
            }
        }
        throw new Error(`HTTP ${resp.status}`)
    }

    const data = (isJson ? await resp.json() : null) as JsonOk<{
        reports: DamageReportRow[]
    }>
    return data.reports ?? []
}

function buildVirtualDamageIncomeRows(
    reports: DamageReportRow[],
    existingFines: FineDTO[]
): IncomeRow[] {
    if (!reports?.length) return []

    const existingDamageIds = new Set(
        existingFines
            .map((f) => String((f as any).damageReportId ?? ""))
            .filter(Boolean)
    )

    const rows: IncomeRow[] = []

    for (const r of reports) {
        const idStr = String(r.id)

        if (r.status !== "paid") continue
        if (existingDamageIds.has(idStr)) continue

        const rawFee = (r as any).fee
        const feeNumRaw =
            typeof rawFee === "number"
                ? rawFee
                : rawFee != null && rawFee !== ""
                  ? Number(rawFee)
                  : suggestedFineFromSeverity(r.severity)

        const feeNum = Number.isFinite(feeNumRaw) ? Number(feeNumRaw) : 0
        if (feeNum <= 0) continue

        const anyReport = r as any
        const createdAt: string = anyReport.createdAt || r.reportedAt || new Date().toISOString()
        const resolvedAt: string | null =
            anyReport.resolvedAt || anyReport.paidAt || anyReport.updatedAt || r.reportedAt || null

        const reasonText = r.notes
            ? `Damage: ${r.damageType} – ${r.notes}`
            : `Damage: ${r.damageType}`

        const fineLike: Partial<FineDTO> = {
            id: `D-${idStr}` as any,
            userId: r.userId as any,
            borrowRecordId: null,
            damageReportId: idStr as any,

            amount: feeNum as any,
            status: "paid",
            reason: reasonText,
            createdAt: createdAt as any,
            updatedAt: createdAt as any,
            resolvedAt: (resolvedAt ?? null) as any,
            officialReceiptNumber:
                anyReport.officialReceiptNumber ??
                anyReport.orNumber ??
                anyReport.receiptNumber ??
                null,

            studentName: r.studentName ?? null,
            studentEmail: r.studentEmail ?? null,
            studentId: r.studentId ?? null,

            bookId: r.bookId as any,
            bookTitle: r.bookTitle ?? null,
            borrowStatus: null,
            borrowDueDate: null,
            borrowReturnDate: null,
        }

        rows.push({
            ...(fineLike as FineDTO),
            _source: "damage",
            damageReportId: r.id,
            damageSeverity: r.severity,
            damageStatus: r.status,
            damageFee: feeNum,
            damageNotes: r.notes ?? null,
        })
    }

    return rows
}

function renderStatusBadge(status: FineStatus) {
    if (status === "active") {
        return (
            <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80">
                <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Active
                </span>
            </Badge>
        )
    }

    if (status === "paid") {
        return (
            <Badge className="bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80">
                <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Paid
                </span>
            </Badge>
        )
    }

    return (
        <Badge className="bg-slate-500/80 hover:bg-slate-500 text-white border-slate-400/80">
            <span className="inline-flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Cancelled
            </span>
        </Badge>
    )
}

/* --------------------------- Page Component --------------------------- */

export default function LibrarianIncomePage() {
    const [rows, setRows] = React.useState<IncomeRow[]>([])
    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const [search, setSearch] = React.useState("")
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("paid")
    const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>("overall")
    const [periodValue, setPeriodValue] = React.useState<PeriodValue>("all")

    const [exportOpen, setExportOpen] = React.useState(false)
    const [exportAutoPrint, setExportAutoPrint] = React.useState(false)

    const loadIncome = React.useCallback(async () => {
        setError(null)
        setLoading(true)

        try {
            const fineData = await fetchFines()

            let incomeRows: IncomeRow[] = fineData.map((f) => ({ ...(f as FineDTO), _source: "fine" }))

            try {
                const damageReports = await fetchDamageReportsForIncome()
                const virtualDamage = buildVirtualDamageIncomeRows(damageReports, fineData)
                incomeRows = [...incomeRows, ...virtualDamage]
            } catch (err: any) {
                console.error("Failed to load damage reports for income page:", err)
                toast.error("Could not load damage-based income", {
                    description: err?.message || "Only fine-based income is shown for now.",
                })
            }

            setRows(incomeRows)
        } catch (err: any) {
            const msg = err?.message || "Failed to load income records."
            setError(msg)
            setRows([])
            toast.error("Failed to load income", { description: msg })
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void loadIncome()
    }, [loadIncome])

    async function handleRefresh() {
        setRefreshing(true)
        try {
            await loadIncome()
        } finally {
            setRefreshing(false)
        }
    }

    const monthOptions = React.useMemo(() => {
        const set = new Set<string>()
        for (const r of rows) {
            const key = toMonthKey(getRowPeriodDate(r))
            if (key) set.add(key)
        }
        return Array.from(set).sort((a, b) => b.localeCompare(a))
    }, [rows])

    const weekOptions = React.useMemo(() => {
        const set = new Set<string>()
        for (const r of rows) {
            const key = toWeekKey(getRowPeriodDate(r))
            if (key) set.add(key)
        }
        return Array.from(set).sort((a, b) => b.localeCompare(a))
    }, [rows])

    const availablePeriodOptions = React.useMemo(() => {
        if (periodFilter === "monthly") return monthOptions
        if (periodFilter === "weekly") return weekOptions
        return []
    }, [periodFilter, monthOptions, weekOptions])

    React.useEffect(() => {
        if (periodFilter === "overall") {
            if (periodValue !== "all") setPeriodValue("all")
            return
        }

        if (periodValue === "all") return
        if (!availablePeriodOptions.includes(periodValue)) {
            setPeriodValue("all")
        }
    }, [periodFilter, periodValue, availablePeriodOptions])

    const statsAll = React.useMemo(() => {
        let paidTotal = 0
        let paidCount = 0
        let activeTotal = 0
        let activeCount = 0

        for (const r of rows) {
            const amt = normalizeAmount(r.amount)
            if (r.status === "paid") {
                paidCount += 1
                if (amt > 0) paidTotal += amt
            } else if (r.status === "active") {
                activeCount += 1
                if (amt > 0) activeTotal += amt
            }
        }

        return { paidTotal, paidCount, activeTotal, activeCount }
    }, [rows])

    const filtered = React.useMemo(() => {
        let list = [...rows]

        if (statusFilter !== "all") {
            if (statusFilter === "paid") {
                list = list.filter((r) => r.status === "paid")
            } else {
                list = list.filter((r) => r.status === statusFilter)
            }
        }

        if (periodFilter === "monthly" && periodValue !== "all") {
            list = list.filter((r) => toMonthKey(getRowPeriodDate(r)) === periodValue)
        }

        if (periodFilter === "weekly" && periodValue !== "all") {
            list = list.filter((r) => toWeekKey(getRowPeriodDate(r)) === periodValue)
        }

        const q = search.trim().toLowerCase()
        if (q) {
            list = list.filter((r) => {
                const anyRow = r as any
                const haystack =
                    `${r.studentName ?? ""} ${r.studentEmail ?? ""} ${r.studentId ?? ""} ` +
                    `${r.bookTitle ?? ""} ${r.reason ?? ""} ${r.officialReceiptNumber ?? ""} ` +
                    `${r.id} ${r.bookId ?? ""} ${r.borrowRecordId ?? ""} ${r.borrowDueDate ?? ""} ` +
                    `${anyRow.damageReportId ?? ""} ${anyRow.damageNotes ?? ""}`
                return haystack.toLowerCase().includes(q)
            })
        }

        return list.sort((a, b) => {
            const da = (getRowSortDate(a) || "").toString()
            const db = (getRowSortDate(b) || "").toString()
            return db.localeCompare(da)
        })
    }, [rows, search, statusFilter, periodFilter, periodValue])

    const statsView = React.useMemo(() => {
        let paidTotal = 0
        let paidCount = 0
        let activeTotal = 0
        let activeCount = 0

        for (const r of filtered) {
            const amt = normalizeAmount(r.amount)
            if (r.status === "paid") {
                paidCount += 1
                if (amt > 0) paidTotal += amt
            } else if (r.status === "active") {
                activeCount += 1
                if (amt > 0) activeTotal += amt
            }
        }

        return { paidTotal, paidCount, activeTotal, activeCount, totalCount: filtered.length }
    }, [filtered])

    const printableRecords = React.useMemo<PrintableIncomeRecord[]>(() => {
        return filtered.map((r) => {
            const receiptLabel = getOfficialReceiptLabel(r.officialReceiptNumber)

            return {
                id: r.id,
                userId: r.userId ?? null,
                studentId: r.studentId ?? null,
                studentName: r.studentName ?? null,
                studentEmail: r.studentEmail ?? null,
                bookTitle: r.bookTitle ?? null,
                bookId: r.bookId ?? null,
                reason: r.reason ?? null,
                status: r.status,
                amount: normalizeAmount(r.amount),
                createdAt: r.createdAt ?? null,
                resolvedAt: getRowDatePaid(r),
                paidDate: getRowDatePaid(r),
                sourceLabel: r._source ?? "fine",
                referenceLabel: receiptLabel ?? "—",
                damageSeverity: r.damageSeverity ?? null,
            }
        })
    }, [filtered])

    const exportReportTitle = React.useMemo(() => {
        if (periodFilter === "monthly") return "BookHive Library • Monthly Income Report"
        if (periodFilter === "weekly") return "BookHive Library • Weekly Income Report"
        return "BookHive Library • Overall Income Report"
    }, [periodFilter])

    const exportSubtitle = React.useMemo(() => {
        const parts: string[] = [periodFilterLabel(periodFilter, periodValue)]

        if (statusFilter === "all") {
            parts.push("All statuses")
        } else if (statusFilter === "paid") {
            parts.push("Paid income")
        } else if (statusFilter === "active") {
            parts.push("Active only")
        } else {
            parts.push("Cancelled only")
        }

        const searchText = search.trim()
        if (searchText) {
            const compactSearch = searchText.replace(/\s+/g, " ").slice(0, 40)
            parts.push(`Search: ${compactSearch}`)
        }

        return `Current librarian income report • ${parts.join(" • ")}`
    }, [periodFilter, periodValue, statusFilter, search])

    const exportFileNamePrefix = React.useMemo(() => {
        let value = "bookhive-income-report"

        if (periodFilter === "monthly") {
            value += periodValue !== "all" ? `-monthly-${periodValue}` : "-monthly"
        } else if (periodFilter === "weekly") {
            value += periodValue !== "all" ? `-weekly-${periodValue}` : "-weekly"
        } else {
            value += "-overall"
        }

        if (statusFilter !== "all") {
            value += `-${statusFilter}`
        }

        return value
    }, [periodFilter, periodValue, statusFilter])

    const handleOpenExportPreview = React.useCallback(() => {
        setExportAutoPrint(false)
        setExportOpen(true)
    }, [])

    const handleQuickPrint = React.useCallback(() => {
        setExportAutoPrint(true)
        setExportOpen(true)
    }, [])

    const currentScopeLabel = periodFilterLabel(periodFilter, periodValue)

    return (
        <DashboardLayout title="Income">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-start gap-2">
                    <Coins className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Income Records</h2>
                        <p className="text-xs text-white/70">
                            Track overall, monthly, and weekly income records with PDF preview, print, and export.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-200/90">
                            Borrow overdue fines follow <span className="font-semibold">{formatPHP(DEFAULT_FINE_PER_HOUR)} per hour</span>.
                            Paid rows also show the cashier <span className="font-semibold">OR</span> and the <span className="font-semibold">due date</span> when available.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-white/70">
                    <div className="flex flex-col items-start sm:items-end">
                        <span>
                            Total income (All paid):{" "}
                            <span className="font-semibold text-emerald-200">
                                {formatPHP(statsAll.paidTotal)} ({statsAll.paidCount})
                            </span>
                        </span>
                        <span className="text-xs text-white/60">
                            In view:{" "}
                            <span className="text-emerald-200 font-semibold">
                                {formatPHP(statsView.paidTotal)} ({statsView.paidCount})
                            </span>
                            <span className="text-white/60"> · </span>
                            Outstanding: {formatPHP(statsView.activeTotal)} ({statsView.activeCount})
                        </span>
                        <span className="mt-1 text-[11px] text-sky-200/90">
                            Scope: <span className="font-semibold">{currentScopeLabel}</span>
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={handleOpenExportPreview}
                            disabled={loading || printableRecords.length === 0}
                        >
                            <FileSearch className="mr-2 h-4 w-4" />
                            Preview PDF
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            className="border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/10"
                            onClick={handleQuickPrint}
                            disabled={loading || printableRecords.length === 0}
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            Print PDF
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
            </div>

            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <CardTitle>Income list</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search name, email, book title, OR, due date, notes…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            <div className="w-full md:w-52">
                                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="paid">Paid (income)</SelectItem>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-full md:w-52">
                                <Select
                                    value={periodFilter}
                                    onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="View scope" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="overall">Overall</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {periodFilter !== "overall" && (
                                <div className="w-full md:w-60">
                                    <Select
                                        value={periodValue}
                                        onValueChange={(v) => setPeriodValue(v as PeriodValue)}
                                        disabled={loading || availablePeriodOptions.length === 0}
                                    >
                                        <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                            <SelectValue
                                                placeholder={
                                                    periodFilter === "monthly" ? "Choose month" : "Choose week"
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 text-white border-white/10">
                                            <SelectItem value="all">
                                                {periodFilter === "monthly" ? "All months" : "All weeks"}
                                            </SelectItem>
                                            {availablePeriodOptions.map((value) => (
                                                <SelectItem key={value} value={value}>
                                                    {periodFilter === "monthly"
                                                        ? monthLabel(value)
                                                        : weekLabel(value)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="overflow-x-auto">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge className="bg-sky-500/20 text-sky-100 border-sky-300/40">
                            {currentScopeLabel}
                        </Badge>
                        <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/40">
                            Visible records: {statsView.totalCount}
                        </Badge>
                        <Badge className="bg-purple-500/20 text-purple-100 border-purple-300/40">
                            Visible paid total: {formatPHP(statsView.paidTotal)}
                        </Badge>
                    </div>

                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center text-sm text-red-300">{error}</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            No income records matched your filters.
                            <br />
                            <span className="text-xs opacity-80">
                                Try clearing search, changing status, or switching overall/monthly/weekly filters.
                            </span>
                        </div>
                    ) : (
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {filtered.length} record{filtered.length === 1 ? "" : "s"} • {currentScopeLabel}
                            </TableCaption>

                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="text-xs font-semibold text-white/70">User</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Book borrowed</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Due date</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Status</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Amount</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Date paid</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Notes</TableHead>
                                    <TableHead className="w-28 text-xs font-semibold text-white/70">OR</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {filtered.map((r) => {
                                    const amount = normalizeAmount(r.amount)
                                    const datePaid = getRowDatePaid(r)
                                    const receiptLabel = getOfficialReceiptLabel(r.officialReceiptNumber)

                                    const userPrimary =
                                        (r.studentName && String(r.studentName).trim()) ||
                                        (r.studentEmail && String(r.studentEmail).trim()) ||
                                        "Unknown user"

                                    const userMeta: string[] = []
                                    if (r.studentId) userMeta.push(`Student ID: ${r.studentId}`)
                                    if (r.studentEmail && userPrimary !== r.studentEmail) userMeta.push(String(r.studentEmail))
                                    if (!r.studentId && !r.studentEmail && r.userId) userMeta.push(`User ID: ${r.userId}`)

                                    const bookPrimary = (r.bookTitle && String(r.bookTitle).trim()) || "Unknown book"
                                    const sourceText =
                                        r._source === "damage" || (r as any).damageReportId ? "Damage" : "Borrow fine"

                                    const bookMeta: string[] = []
                                    if (r.bookId) bookMeta.push(`Book ID: ${r.bookId}`)
                                    if (r.borrowRecordId) bookMeta.push(`Borrow #: ${r.borrowRecordId}`)
                                    bookMeta.push(`Type: ${sourceText}`)

                                    return (
                                        <TableRow
                                            key={`${r.id}-${r._source ?? "fine"}`}
                                            className="border-white/5 hover:bg-white/5 transition-colors align-top"
                                        >
                                            <TableCell className="text-sm align-top whitespace-normal wrap-break-word">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium whitespace-normal wrap-break-word">
                                                        {userPrimary}
                                                    </span>
                                                    {userMeta.length > 0 && (
                                                        <span className="text-xs text-white/70 whitespace-normal wrap-break-word">
                                                            {userMeta.join(" · ")}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-sm align-top max-w-72 whitespace-normal wrap-break-word">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="whitespace-normal wrap-break-word">{bookPrimary}</span>
                                                    <span className="text-xs text-white/60 whitespace-normal wrap-break-word">
                                                        {bookMeta.join(" · ")}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-xs opacity-80 align-top whitespace-normal wrap-break-word">
                                                {fmtDate(r.borrowDueDate ?? null)}
                                            </TableCell>

                                            <TableCell className="align-top">{renderStatusBadge(r.status)}</TableCell>

                                            <TableCell className="text-sm align-top whitespace-normal wrap-break-word">
                                                {formatPHP(amount)}
                                            </TableCell>

                                            <TableCell className="text-xs opacity-80 align-top whitespace-normal wrap-break-word">
                                                {fmtDate(datePaid)}
                                            </TableCell>

                                            <TableCell className="text-xs text-white/70 align-top max-w-80 whitespace-normal wrap-break-word">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="whitespace-normal wrap-break-word">
                                                        {r.reason ? r.reason : "—"}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-xs text-white/60 align-top whitespace-normal wrap-break-word">
                                                <div className="flex flex-col gap-0.5">
                                                    <span
                                                        className={
                                                            receiptLabel
                                                                ? "text-emerald-200/90 font-medium whitespace-normal wrap-break-word"
                                                                : "opacity-60 whitespace-normal wrap-break-word"
                                                        }
                                                    >
                                                        {receiptLabel ?? "—"}
                                                    </span>
                                                    {periodFilter === "monthly" && periodValue !== "all" && (
                                                        <span className="text-xs text-white/50">
                                                            {monthLabel(periodValue)}
                                                        </span>
                                                    )}
                                                    {periodFilter === "weekly" && periodValue !== "all" && (
                                                        <span className="text-xs text-white/50">
                                                            {weekLabel(periodValue)}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <ExportPreviewIncome
                open={exportOpen}
                onOpenChange={(open) => {
                    setExportOpen(open)
                    if (!open) setExportAutoPrint(false)
                }}
                records={printableRecords}
                autoPrintOnOpen={exportAutoPrint}
                fileNamePrefix={exportFileNamePrefix}
                reportTitle={exportReportTitle}
                reportSubtitle={exportSubtitle}
            />
        </DashboardLayout>
    )
}