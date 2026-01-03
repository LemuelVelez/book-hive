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
} from "lucide-react"
import { toast } from "sonner"

import { fetchFines, type FineDTO, type FineStatus } from "@/lib/fines"
import { API_BASE } from "@/api/auth/route"
import type { DamageReportDTO, DamageStatus, DamageSeverity } from "@/lib/damageReports"

type StatusFilter = "paid" | "all" | FineStatus

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

function peso(n: number) {
    if (typeof n !== "number" || Number.isNaN(n)) return "₱0.00"
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 2,
        }).format(n)
    } catch {
        return `₱${n.toFixed(2)}`
    }
}

function normalizeAmount(value: any): number {
    if (value === null || value === undefined) return 0
    const num = typeof value === "number" ? value : Number(value)
    return Number.isNaN(num) ? 0 : num
}

/**
 * Simple suggested fine policy (fallback only):
 * - minor: ₱50
 * - moderate: ₱150
 * - major: ₱300
 */
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

/**
 * If backend did not create a Fine row yet for a paid damage report,
 * build a “virtual income row” so it still shows up in Income.
 */
function buildVirtualDamageIncomeRows(
    reports: DamageReportRow[],
    existingFines: FineDTO[]
): IncomeRow[] {
    if (!reports?.length) return []

    // Collect all damageReportIds already represented by real fines.
    const existingDamageIds = new Set(
        existingFines
            .map((f) => String((f as any).damageReportId ?? ""))
            .filter(Boolean)
    )

    const rows: IncomeRow[] = []

    for (const r of reports) {
        const idStr = String(r.id)

        // Only income if PAID
        if (r.status !== "paid") continue

        // If already in fines list, skip virtual row
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

    const loadIncome = React.useCallback(async () => {
        setError(null)
        setLoading(true)

        try {
            const fineData = await fetchFines() // librarian/admin list endpoint

            // Start with real fines
            let incomeRows: IncomeRow[] = fineData.map((f) => ({ ...(f as FineDTO), _source: "fine" }))

            // Attempt to include paid damage reports even if backend hasn't synced fines yet
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

    const stats = React.useMemo(() => {
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

        const q = search.trim().toLowerCase()
        if (q) {
            list = list.filter((r) => {
                const anyRow = r as any
                const haystack =
                    `${r.id} ${r.studentName ?? ""} ${r.studentEmail ?? ""} ${r.studentId ?? ""} ` +
                    `${r.bookTitle ?? ""} ${r.bookId ?? ""} ${r.reason ?? ""} ${r.borrowRecordId ?? ""} ` +
                    `${anyRow.damageReportId ?? ""} ${anyRow.damageNotes ?? ""}`
                return haystack.toLowerCase().includes(q)
            })
        }

        // Sort newest first by resolvedAt (preferred), else createdAt
        return list.sort((a, b) => {
            const da = (a.resolvedAt || a.createdAt || "").toString()
            const db = (b.resolvedAt || b.createdAt || "").toString()
            return db.localeCompare(da)
        })
    }, [rows, search, statusFilter])

    const cellScrollbarClasses =
        "overflow-x-auto whitespace-nowrap " +
        "[scrollbar-width:thin] [scrollbar-color:#111827_transparent] " +
        "[&::-webkit-scrollbar]:h-1.5 " +
        "[&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600"

    return (
        <DashboardLayout title="Income">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-start gap-2">
                    <Coins className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Income Records</h2>
                        <p className="text-xs text-white/70">
                            Shows fines collected by the library, including the borrowed book and user who paid.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-white/70">
                    <div className="flex flex-col items-start sm:items-end">
                        <span>
                            Total collected (Paid):{" "}
                            <span className="font-semibold text-emerald-200">
                                {peso(stats.paidTotal)} ({stats.paidCount})
                            </span>
                        </span>
                        <span className="text-[11px] text-white/60">
                            Outstanding (Active): {peso(stats.activeTotal)} ({stats.activeCount})
                        </span>
                    </div>

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
                                    placeholder="Search user, book, fine ID…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            <div className="w-full md:w-56">
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
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="overflow-x-auto">
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
                            <span className="text-xs opacity-80">Try clearing the search or changing the status filter.</span>
                        </div>
                    ) : (
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {filtered.length} record{filtered.length === 1 ? "" : "s"}.
                            </TableCaption>

                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[90px] text-xs font-semibold text-white/70">Fine ID</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">User</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Book borrowed</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Status</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Amount</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Paid / Date</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Notes</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {filtered.map((r) => {
                                    const amount = normalizeAmount(r.amount)
                                    const paidDate = r.status === "paid" ? (r.resolvedAt || r.updatedAt || r.createdAt) : r.createdAt

                                    const bookText =
                                        r.bookTitle ||
                                        (r.bookId ? `Book #${r.bookId}` : "—")

                                    const sourceText =
                                        r._source === "damage" || (r as any).damageReportId
                                            ? "Damage"
                                            : "Borrow fine"

                                    return (
                                        <TableRow
                                            key={`${r.id}-${r._source ?? "fine"}`}
                                            className="border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell className="text-xs opacity-80">{r.id}</TableCell>

                                            <TableCell className="text-sm">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium">
                                                        {r.studentName || r.studentEmail || "—"}
                                                    </span>
                                                    {(r.studentId || r.studentEmail) && (
                                                        <span className="text-xs text-white/70">
                                                            {r.studentId && (
                                                                <>
                                                                    ID: {r.studentId}
                                                                    {r.studentEmail && " · "}
                                                                </>
                                                            )}
                                                            {r.studentEmail}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className={"text-sm w-[140px] max-w-60 " + cellScrollbarClasses}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span>{bookText}</span>
                                                    {r.borrowRecordId && (
                                                        <span className="text-[11px] text-white/60">
                                                            Borrow #{r.borrowRecordId}
                                                        </span>
                                                    )}
                                                    <span className="text-[11px] text-white/60">Type: {sourceText}</span>
                                                </div>
                                            </TableCell>

                                            <TableCell>{renderStatusBadge(r.status)}</TableCell>

                                            <TableCell className="text-sm">{peso(amount)}</TableCell>

                                            <TableCell className="text-xs opacity-80">{fmtDate(paidDate)}</TableCell>

                                            <TableCell className={"text-xs text-white/70 w-[180px] max-w-[320px] " + cellScrollbarClasses}>
                                                {r.reason ? r.reason : "—"}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    )
}
