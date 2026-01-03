/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
    ReceiptText,
    RefreshCcw,
    Loader2,
    Search,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Edit,
} from "lucide-react";
import { toast } from "sonner";

import { fetchFines, updateFine, type FineDTO, type FineStatus } from "@/lib/fines";

import { API_BASE } from "@/api/auth/route";
import type { DamageReportDTO, DamageStatus, DamageSeverity } from "@/lib/damageReports";

type StatusFilter = "all" | "unresolved" | FineStatus;

/* ----------------------- Extra types for merging ----------------------- */

type Severity = DamageSeverity;

type DamageReportRow = DamageReportDTO & {
    photoUrl?: string | null;
};

type JsonOk<T> = { ok: true } & T;

type FineRow = FineDTO & {
    /** Where this row came from */
    _source?: "fine" | "damage";
    /** Extra fields when coming from a damage report */
    damageReportId?: string | number | null;
    damageSeverity?: DamageSeverity | null;
    damageStatus?: DamageStatus | null;
    damageFee?: number | null;
    damageNotes?: string | null;
};

/* ----------------------------- Helpers ----------------------------- */

function fmtDate(d?: string | null) {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        return date.toLocaleDateString("en-CA");
    } catch {
        return d;
    }
}

function peso(n: number) {
    if (typeof n !== "number" || Number.isNaN(n)) return "₱0.00";
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 2,
        }).format(n);
    } catch {
        return `₱${n.toFixed(2)}`;
    }
}

function normalizeFine(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = typeof value === "number" ? value : Number(value);
    return Number.isNaN(num) ? 0 : num;
}

function statusWeight(status: FineStatus): number {
    switch (status) {
        case "active":
            return 0;
        case "paid":
            return 1;
        case "cancelled":
            return 2;
        default:
            return 3;
    }
}

/**
 * Simple suggested fine policy:
 * - minor: ₱50
 * - moderate: ₱150
 * - major: ₱300
 */
function suggestedFineFromSeverity(severity?: Severity | null): number {
    switch (severity) {
        case "minor":
            return 50;
        case "moderate":
            return 150;
        case "major":
            return 300;
        default:
            return 0;
    }
}

/* ------------------------ Damage → Fine helpers ------------------------ */

async function fetchDamageReportsForFines(): Promise<DamageReportRow[]> {
    let resp: Response;
    try {
        resp = await fetch(`${API_BASE}/api/damage-reports`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        });
    } catch (e: any) {
        const details = e?.message ? ` Details: ${e.message}` : "";
        throw new Error(
            `Cannot reach the API (${API_BASE}). Is the server running and allowing this origin?${details}`
        );
    }

    const ct = resp.headers.get("content-type")?.toLowerCase() || "";
    const isJson = ct.includes("application/json");

    if (!resp.ok) {
        if (isJson) {
            try {
                const data = (await resp.json()) as any;
                if (data && typeof data === "object" && typeof data.message === "string") {
                    throw new Error(data.message);
                }
            } catch {
                /* ignore */
            }
        } else {
            try {
                const text = await resp.text();
                if (text) throw new Error(text);
            } catch {
                /* ignore */
            }
        }
        throw new Error(`HTTP ${resp.status}`);
    }

    const data = (isJson ? await resp.json() : null) as JsonOk<{
        reports: DamageReportRow[];
    }>;
    return data.reports ?? [];
}

/**
 * Convert assessed/paid damage reports with a positive fee into
 * "virtual" fines that we can render in this table.
 */
function buildDamageFineRows(
    reports: DamageReportRow[],
    existingFines: FineDTO[]
): FineRow[] {
    if (!reports?.length) return [];

    const existingDamageIds = new Set(
        existingFines
            .map((f) => {
                const anyFine = f as any;
                const id =
                    anyFine.damageReportId ?? anyFine.damageId ?? anyFine.damageReportID ?? null;
                return id != null ? String(id) : "";
            })
            .filter(Boolean)
    );

    const rows: FineRow[] = [];

    for (const r of reports) {
        const idStr = String(r.id);

        if (existingDamageIds.has(idStr)) continue;

        const rawFee = (r as any).fee;
        const feeNumRaw =
            typeof rawFee === "number"
                ? rawFee
                : rawFee != null && rawFee !== ""
                    ? Number(rawFee)
                    : suggestedFineFromSeverity(r.severity);
        const feeNum = Number.isFinite(feeNumRaw) ? Number(feeNumRaw) : 0;

        if (feeNum <= 0) continue;
        if (r.status !== "assessed" && r.status !== "paid") continue;

        const anyReport = r as any;
        const createdAt: string = anyReport.createdAt || r.reportedAt || new Date().toISOString();

        const resolvedAt: string | null =
            r.status === "paid"
                ? anyReport.resolvedAt ||
                anyReport.paidAt ||
                anyReport.updatedAt ||
                r.reportedAt ||
                null
                : null;

        const reasonText = r.notes ? `Damage: ${r.damageType} – ${r.notes}` : `Damage: ${r.damageType}`;

        const fineLike: Partial<FineDTO> = {
            id: `D-${idStr}` as any,
            amount: feeNum as any,
            status: (r.status === "paid" ? "paid" : "active") as FineStatus,
            createdAt: createdAt as any,
            resolvedAt: (resolvedAt ?? null) as any,
            studentName: r.studentName,
            studentEmail: r.studentEmail,
            studentId: r.studentId,
            userId: r.userId as any,
            bookTitle: r.bookTitle,
            bookId: r.bookId as any,
            reason: reasonText,
        };

        const row: FineRow = {
            ...(fineLike as FineDTO),
            _source: "damage",
            damageReportId: r.id,
            damageSeverity: r.severity,
            damageStatus: r.status,
            damageFee: feeNum,
            damageNotes: r.notes ?? null,
        };

        rows.push(row);
    }

    return rows;
}

function isDamageFine(fine: FineRow): boolean {
    if (fine._source === "damage") return true;

    const anyFine = fine as any;
    const reason = (fine.reason || "").toLowerCase();

    return Boolean(
        anyFine.damageReportId ||
        anyFine.damageId ||
        anyFine.damageType ||
        anyFine.damageDescription ||
        anyFine.damageDetails ||
        reason.includes("damage") ||
        reason.includes("lost book")
    );
}

/* --------------------------- Page Component --------------------------- */

export default function LibrarianFinesPage() {
    const [fines, setFines] = React.useState<FineRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("unresolved");
    const [updateBusyId, setUpdateBusyId] = React.useState<string | null>(null);

    const [editAmountFineId, setEditAmountFineId] = React.useState<string | null>(null);
    const [editAmountValue, setEditAmountValue] = React.useState<string>("0.00");

    const loadFines = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const fineData = await fetchFines();

            let damageReports: DamageReportRow[] = [];
            try {
                damageReports = await fetchDamageReportsForFines();
            } catch (err: any) {
                console.error("Failed to load damage reports for fines page:", err);
                toast.error("Failed to load damage-based fines", {
                    description: err?.message || "Only overdue/borrow-related fines are shown for now.",
                });
            }

            const damageMap = new Map<string, DamageReportRow>();
            for (const r of damageReports) {
                damageMap.set(String(r.id), r);
            }

            const fineRows: FineRow[] = (fineData.map((f) => {
                const anyFine = f as any;
                const drKey =
                    anyFine.damageReportId ?? anyFine.damageId ?? anyFine.damageReportID ?? null;
                const dr = drKey != null ? damageMap.get(String(drKey)) : undefined;

                if (!dr) {
                    return { ...(f as FineDTO), _source: "fine" as const } as FineRow;
                }

                return {
                    ...(f as FineDTO),
                    _source: "fine" as const,
                    bookTitle: f.bookTitle ?? dr.bookTitle,
                    bookId: (f.bookId ?? dr.bookId) as any,
                    damageReportId: dr.id,
                    damageSeverity: dr.severity,
                    damageStatus: dr.status,
                    damageFee: normalizeFine((dr as any).fee),
                    damageNotes: dr.notes ?? null,
                } as FineRow;
            }) as unknown) as FineRow[];

            const damageFineRows = buildDamageFineRows(damageReports, fineData);

            setFines([...fineRows, ...damageFineRows]);
        } catch (err: any) {
            const msg = err?.message || "Failed to load fines.";
            setError(msg);
            setFines([]);
            toast.error("Failed to load fines", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadFines();
    }, [loadFines]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await loadFines();
        } finally {
            setRefreshing(false);
        }
    }

    const filtered = React.useMemo(() => {
        let rows = [...fines];

        if (statusFilter === "unresolved") {
            rows = rows.filter((f) => f.status === "active");
        } else if (statusFilter !== "all") {
            rows = rows.filter((f) => f.status === statusFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter((f) => {
                const anyFine = f as any;
                const haystack = `${f.id} ${f.studentName ?? ""} ${f.studentEmail ?? ""} ${f.studentId ?? ""
                    } ${f.bookTitle ?? ""} ${f.bookId ?? ""} ${f.reason ?? ""} ${anyFine.damageReportId ?? ""
                    } ${anyFine.damageDescription ?? ""} ${anyFine.damageType ?? ""} ${anyFine.damageDetails ?? ""
                    } ${anyFine.damageNotes ?? ""}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        return rows.sort((a, b) => {
            const sa = statusWeight(a.status);
            const sb = statusWeight(b.status);
            if (sa !== sb) return sa - sb;
            return b.createdAt.localeCompare(a.createdAt);
        });
    }, [fines, statusFilter, search]);

    const stats = React.useMemo(() => {
        let activeCount = 0;
        let paidCount = 0;
        let cancelledCount = 0;
        let activeTotal = 0;

        for (const f of fines) {
            const amt = normalizeFine(f.amount);
            switch (f.status) {
                case "active":
                    activeCount += 1;
                    if (amt > 0) activeTotal += amt;
                    break;
                case "paid":
                    paidCount += 1;
                    break;
                case "cancelled":
                    cancelledCount += 1;
                    break;
                default:
                    break;
            }
        }

        return { activeCount, paidCount, cancelledCount, activeTotal };
    }, [fines]);

    async function handleUpdateStatus(
        fine: FineRow,
        newStatus: FineStatus,
        opts?: { successTitle?: string; successDescription?: string }
    ) {
        if (fine._source === "damage") {
            toast.error("Cannot update damage-based fine here", {
                description: "Open the Damage Reports page to change the status or fee of this damage.",
            });
            return;
        }

        if (fine.status === newStatus) return;

        setUpdateBusyId(fine.id);
        try {
            const updated = await updateFine(fine.id, { status: newStatus });

            setFines((prev) =>
                prev.map((f) =>
                    f.id === updated.id ? { ...(updated as any), _source: "fine" } : f
                )
            );

            toast.success(opts?.successTitle ?? "Fine updated", {
                description: opts?.successDescription,
            });
        } catch (err: any) {
            const msg = err?.message || "Failed to update fine.";
            toast.error("Update failed", { description: msg });
        } finally {
            setUpdateBusyId(null);
        }
    }

    async function handleUpdateAmount(fine: FineRow) {
        if (fine._source === "damage") {
            toast.error("Cannot edit amount for damage-based fine here", {
                description: "Edit the assessed fee from the Damage Reports page instead.",
            });
            return;
        }

        const raw =
            editAmountFineId === fine.id ? editAmountValue : normalizeFine(fine.amount).toFixed(2);

        const trimmed = raw.trim();
        const parsed = trimmed === "" ? 0 : Number(trimmed);

        if (Number.isNaN(parsed) || parsed < 0) {
            toast.error("Invalid amount", {
                description: "Fine amount must be a non-negative number.",
            });
            return;
        }

        setUpdateBusyId(fine.id);
        try {
            const updated = await updateFine(fine.id, { amount: parsed });

            setFines((prev) =>
                prev.map((f) =>
                    f.id === updated.id ? { ...(updated as any), _source: "fine" } : f
                )
            );

            toast.success("Fine amount updated", {
                description: `New amount: ${peso(
                    typeof updated.amount === "number" ? updated.amount : parsed
                )}.`,
            });

            setEditAmountFineId(null);
            setEditAmountValue("0.00");
        } catch (err: any) {
            const msg = err?.message || "Failed to update fine amount.";
            toast.error("Update failed", { description: msg });
        } finally {
            setUpdateBusyId(null);
        }
    }

    function renderStatusBadge(status: FineStatus) {
        if (status === "active") {
            return (
                <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80">
                    <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Active (unpaid)
                    </span>
                </Badge>
            );
        }

        if (status === "paid") {
            return (
                <Badge className="bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80">
                    <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                    </span>
                </Badge>
            );
        }

        return (
            <Badge className="bg-slate-500/80 hover:bg-slate-500 text-white border-slate-400/80">
                <span className="inline-flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Cancelled
                </span>
            </Badge>
        );
    }

    const cellScrollbarClasses =
        "overflow-x-auto whitespace-nowrap " +
        "[scrollbar-width:thin] [scrollbar-color:#111827_transparent] " +
        "[&::-webkit-scrollbar]:h-1.5 " +
        "[&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

    return (
        <DashboardLayout title="Fines">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <ReceiptText className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Fines</h2>
                        <p className="text-xs text-white/70">
                            Over-the-counter payments only. Collect the payment physically and then mark the fine
                            as <span className="font-semibold text-emerald-200">Paid</span>.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-200/90">
                            Students/users must go to the library counter to pay fines.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-white/70">
                    <div className="flex flex-col items-start sm:items-end">
                        <span>
                            Active fines:{" "}
                            <span className="font-semibold text-amber-300">
                                {stats.activeCount} ({peso(stats.activeTotal)})
                            </span>
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
                        <CardTitle>All fines</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by user, book, damage report, or reason…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            <div className="w-full md:w-60">
                                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="unresolved">Unresolved (Active)</SelectItem>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active only</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
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
                            No fines matched your filters.
                            <br />
                            <span className="text-xs opacity-80">
                                Try clearing the search or changing the status filter.
                            </span>
                        </div>
                    ) : (
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {filtered.length} {filtered.length === 1 ? "fine" : "fines"}. Mark fines as{" "}
                                <span className="font-semibold text-emerald-200">Paid</span> after OTC payment is
                                received.
                            </TableCaption>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                        Fine ID
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">User</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Book / damage info
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Status</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">₱Amount</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Created</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Resolved</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {filtered.map((fine) => {
                                    const amount = normalizeFine(fine.amount);
                                    const busy = updateBusyId === fine.id;

                                    const anyFine = fine as any;
                                    const damageReportId: string | undefined =
                                        (fine.damageReportId as any) || anyFine.damageReportId || anyFine.damageId;
                                    const damageDescription: string | undefined =
                                        (fine.damageNotes as any) ||
                                        anyFine.damageDescription ||
                                        anyFine.damageDetails ||
                                        anyFine.damageType;

                                    const damage = isDamageFine(fine);
                                    const isDamageRow = fine._source === "damage";

                                    return (
                                        <TableRow
                                            key={fine.id}
                                            className="border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell className="text-xs opacity-80">{fine.id}</TableCell>

                                            <TableCell className="text-sm">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium">
                                                        {fine.studentName || fine.studentEmail || "—"}
                                                    </span>
                                                    {(fine.studentId || fine.studentEmail) && (
                                                        <span className="text-xs text-white/70">
                                                            {fine.studentId && (
                                                                <>
                                                                    ID: {fine.studentId}
                                                                    {fine.studentEmail && " · "}
                                                                </>
                                                            )}
                                                            {fine.studentEmail}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell
                                                className={
                                                    "text-sm align-top w-[100px] max-w-[100px] " + cellScrollbarClasses
                                                }
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <span>
                                                        {fine.bookTitle ? (
                                                            fine.bookTitle
                                                        ) : fine.bookId ? (
                                                            <>Book #{fine.bookId}</>
                                                        ) : (
                                                            <span className="opacity-60">—</span>
                                                        )}
                                                    </span>

                                                    {fine.borrowRecordId && (
                                                        <span className="text-xs text-white/70">
                                                            Borrow #{fine.borrowRecordId}
                                                            {fine.borrowDueDate && <> · Due {fmtDate(fine.borrowDueDate)}</>}
                                                            {fine.borrowReturnDate && (
                                                                <> · Returned {fmtDate(fine.borrowReturnDate)}</>
                                                            )}
                                                        </span>
                                                    )}

                                                    {(damageReportId || damageDescription || damage) && (
                                                        <span className="text-[11px] text-rose-200/90 flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            <span className="font-semibold">Damage fine</span>
                                                            {damageReportId && (
                                                                <span className="opacity-90">· Report #{damageReportId}</span>
                                                            )}
                                                            {damageDescription && (
                                                                <span className="opacity-90">· {damageDescription}</span>
                                                            )}
                                                        </span>
                                                    )}

                                                    {fine.reason && (
                                                        <span className="text-xs text-white/70">Reason: {fine.reason}</span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell>{renderStatusBadge(fine.status)}</TableCell>

                                            <TableCell className="text-sm">
                                                <div className="inline-flex items-center gap-2">
                                                    <span>{peso(amount)}</span>

                                                    {!isDamageRow && (
                                                        <AlertDialog
                                                            onOpenChange={(open) => {
                                                                if (open) {
                                                                    setEditAmountFineId(fine.id);
                                                                    setEditAmountValue(normalizeFine(fine.amount).toFixed(2));
                                                                } else if (editAmountFineId === fine.id) {
                                                                    setEditAmountFineId(null);
                                                                    setEditAmountValue("0.00");
                                                                }
                                                            }}
                                                        >
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                                                                    aria-label="Edit fine amount"
                                                                >
                                                                    <Edit className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </AlertDialogTrigger>

                                                            <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Edit fine amount</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-white/70">
                                                                        Adjust the amount for this fine (non-negative).
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>

                                                                <div className="mt-4 space-y-2">
                                                                    <label className="text-xs font-medium text-white/80">New amount</label>
                                                                    <div className="relative w-full">
                                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/60">
                                                                            ₱
                                                                        </span>
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            step="0.01"
                                                                            value={
                                                                                editAmountFineId === fine.id
                                                                                    ? editAmountValue
                                                                                    : normalizeFine(fine.amount).toFixed(2)
                                                                            }
                                                                            onChange={(e) => setEditAmountValue(e.target.value)}
                                                                            className="pl-6 bg-slate-900/70 border-white/20 text-white"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel
                                                                        className="border-white/20 text-white hover:bg-black/20"
                                                                        disabled={busy}
                                                                    >
                                                                        Cancel
                                                                    </AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                        disabled={busy}
                                                                        onClick={() => void handleUpdateAmount(fine)}
                                                                    >
                                                                        {busy ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Saving…
                                                                            </span>
                                                                        ) : (
                                                                            "Save amount"
                                                                        )}
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-xs opacity-80">{fmtDate(fine.createdAt)}</TableCell>
                                            <TableCell className="text-xs opacity-80">
                                                {fine.resolvedAt ? fmtDate(fine.resolvedAt) : "—"}
                                            </TableCell>

                                            <TableCell className={"text-right w-[130px] max-w-[140px] " + cellScrollbarClasses}>
                                                <div className="inline-flex items-center justify-end gap-2 min-w-max">
                                                    {!isDamageRow && fine.status === "active" && (
                                                        <>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                        disabled={busy}
                                                                    >
                                                                        {busy ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Saving…
                                                                            </span>
                                                                        ) : (
                                                                            "Mark as paid (OTC)"
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>

                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Mark this fine as paid?</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            Use this after receiving over-the-counter payment.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>

                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel
                                                                            className="border-white/20 text-white hover:bg-black/20"
                                                                            disabled={busy}
                                                                        >
                                                                            Cancel
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                            disabled={busy}
                                                                            onClick={() =>
                                                                                void handleUpdateStatus(fine, "paid", {
                                                                                    successTitle: "Fine marked as paid",
                                                                                    successDescription: "Recorded as paid via over-the-counter payment.",
                                                                                })
                                                                            }
                                                                        >
                                                                            {busy ? (
                                                                                <span className="inline-flex items-center gap-2">
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    Saving…
                                                                                </span>
                                                                            ) : (
                                                                                "Confirm"
                                                                            )}
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>

                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="border-slate-400/50 text-slate-100"
                                                                        disabled={busy}
                                                                    >
                                                                        {busy ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Saving…
                                                                            </span>
                                                                        ) : (
                                                                            "Cancel fine"
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>

                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Cancel this fine?</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            This will mark the fine as <span className="font-semibold">Cancelled</span>.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>

                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel
                                                                            className="border-white/20 text-white hover:bg-black/20"
                                                                            disabled={busy}
                                                                        >
                                                                            Keep fine
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-slate-500 hover:bg-slate-600 text-white"
                                                                            disabled={busy}
                                                                            onClick={() =>
                                                                                void handleUpdateStatus(fine, "cancelled", {
                                                                                    successTitle: "Fine cancelled",
                                                                                    successDescription: "The fine has been cancelled.",
                                                                                })
                                                                            }
                                                                        >
                                                                            {busy ? (
                                                                                <span className="inline-flex items-center gap-2">
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    Saving…
                                                                                </span>
                                                                            ) : (
                                                                                "Cancel fine"
                                                                            )}
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    )}

                                                    {(isDamageRow || fine.status === "paid" || fine.status === "cancelled") && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled
                                                            className="border-white/20 text-white/60"
                                                        >
                                                            No actions
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
