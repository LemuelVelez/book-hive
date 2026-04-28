/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    ReceiptText,
    RefreshCcw,
    Loader2,
    Search,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Edit,
    Eye,
    BookOpen,
    CalendarClock,
    CircleDollarSign,
    UserRound,
} from "lucide-react";
import { toast } from "sonner";

import {
    DEFAULT_FINE_PER_HOUR,
    fetchFines,
    markFineAsPaid,
    updateFine,
    type FineDTO,
    type FineStatus,
} from "@/lib/fines";
import ExportPreviewFines, {
    type PrintableFineRecord,
} from "@/components/fines-preview/export-preview-fines";

type StatusFilter = "all" | "unresolved" | FineStatus;
type YearFilter = "all" | string;

/* ----------------------- Extra types for merging ----------------------- */

type DamageSeverityLabel = "minor" | "moderate" | "major" | string;
type DamageStatusLabel = "reported" | "assessed" | "paid" | "resolved" | string;

type FineRow = FineDTO & {
    _source?: "fine" | "damage";
    damageReportId?: string | number | null;
    damageSeverity?: DamageSeverityLabel | null;
    damageStatus?: DamageStatusLabel | null;
    damageFee?: number | null;
    damageNotes?: string | null;
};

/* ----------------------------- Helpers ----------------------------- */

const ZERO_DURATION_SUFFIX_PATTERN = /\s*\(0\s*hour\(s\),\s*0\s*day\(s\)\)\s*/gi;

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

function normalizeWholeNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.max(0, Math.floor(num));
}

function sanitizeFineReason(reason?: string | null): string | null {
    if (!reason) return null;

    const sanitized = reason.replace(ZERO_DURATION_SUFFIX_PATTERN, "").replace(/\s{2,}/g, " ").trim();

    return sanitized || null;
}

function parseDateOnlyLocal(raw?: string | null): Date | null {
    if (!raw) return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const date = new Date(year, month, day, 0, 0, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseLooseDate(raw?: string | null): Date | null {
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
        return parseDateOnlyLocal(raw);
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getFineDatePaid(fine: FineRow): string | null {
    if (fine.status !== "paid") return null;
    return ((fine as any).resolvedAt || (fine as any).updatedAt || (fine as any).createdAt || null) as any;
}

function getFineYear(fine: FineRow): string | null {
    const candidates = [
        fine.createdAt,
        fine.borrowDueDate,
        fine.borrowReturnDate,
        getFineDatePaid(fine),
    ];

    for (const candidate of candidates) {
        const parsed = parseLooseDate(candidate);
        if (parsed) return String(parsed.getFullYear());
    }

    return null;
}

/**
 * Fallback computation for overdue hours when backend metrics are unavailable.
 * Uses local calendar-day difference to avoid misleading timezone-related 0-day output.
 */
function computeFallbackOverdueHours(
    dueDate?: string | null,
    endDate?: string | null
): number | null {
    const due = parseDateOnlyLocal(dueDate);
    if (!due) return null;

    const end = parseLooseDate(endDate) ?? new Date();
    if (Number.isNaN(end.getTime())) return null;

    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 0, 0, 0, 0);
    const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);

    const diffMs = endLocal.getTime() - dueLocal.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays * 24 : 0;
}

function formatOverdueDurationFromHours(totalHours: number): string {
    const safeHours = Math.max(0, Math.floor(totalHours));

    if (safeHours <= 0) return "On time";

    const days = Math.floor(safeHours / 24);
    const hours = safeHours % 24;

    if (days > 0 && hours > 0) {
        return `${days} day${days === 1 ? "" : "s"} ${hours} hr${hours === 1 ? "" : "s"}`;
    }

    if (days > 0) {
        return `${days} day${days === 1 ? "" : "s"}`;
    }

    return `${hours} hr${hours === 1 ? "" : "s"}`;
}

function getFineOverdueLabel(
    fine: FineRow,
    fallbackEndDate?: string | null
): string {
    const apiHours = normalizeWholeNumber(fine.overdueHours);
    if (apiHours !== null) {
        return formatOverdueDurationFromHours(apiHours);
    }

    const apiDays = normalizeWholeNumber(fine.overdueDays);
    if (apiDays !== null) {
        return apiDays > 0 ? `${apiDays} day${apiDays === 1 ? "" : "s"}` : "On time";
    }

    const fallbackHours = computeFallbackOverdueHours(
        fine.borrowDueDate ?? null,
        fallbackEndDate ?? null
    );

    if (fallbackHours === null) return "—";
    return formatOverdueDurationFromHours(fallbackHours);
}

function getFineRatePerHour(fine: FineRow): number {
    const apiRate = normalizeFine(fine.finePerHour);
    return apiRate > 0 ? apiRate : DEFAULT_FINE_PER_HOUR;
}

function getOfficialReceiptLabel(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    const value = String(raw).trim();
    return value ? `OR ${value}` : null;
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


function fineOwnerLabel(fine: FineRow): string {
    if (fine.studentName?.trim()) return fine.studentName.trim();
    if (fine.studentEmail?.trim()) return fine.studentEmail.trim();
    if (fine.studentId != null && String(fine.studentId).trim()) {
        return `ID: ${String(fine.studentId).trim()}`;
    }
    if (fine.userId != null && String(fine.userId).trim()) {
        return `User #${String(fine.userId).trim()}`;
    }
    return `Fine #${String(fine.id)}`;
}

function fineOwnerKey(fine: FineRow): string {
    if (fine.userId != null && String(fine.userId).trim()) {
        return `uid:${String(fine.userId).trim()}`;
    }
    if (fine.studentId != null && String(fine.studentId).trim()) {
        return `sid:${String(fine.studentId).trim().toLowerCase()}`;
    }
    if (fine.studentEmail && fine.studentEmail.trim()) {
        return `mail:${fine.studentEmail.trim().toLowerCase()}`;
    }
    return `fine:${String(fine.id)}`;
}

function toPrintableFineRecord(row: FineRow): PrintableFineRecord {
    return {
        id: row.id,
        userId: row.userId ?? null,
        studentId: row.studentId ?? null,
        studentName: row.studentName ?? null,
        studentEmail: row.studentEmail ?? null,
        bookTitle: row.bookTitle ?? null,
        bookId: row.bookId ?? null,
        reason: sanitizeFineReason(row.reason),
        status: row.status,
        amount: normalizeFine(row.amount),
        createdAt: row.createdAt ?? null,
        resolvedAt: getFineDatePaid(row),
        borrowDueDate: row.borrowDueDate ?? null,
        borrowReturnDate: row.borrowReturnDate ?? null,
        sourceLabel: row._source ?? "fine",
    };
}

/* ------------------------ Damage fine helpers ------------------------ */

function isDamageFine(fine: FineRow): boolean {
    if (fine._source === "damage") return true;

    const anyFine = fine as any;
    const reason = (fine.reason || "").toLowerCase();

    return Boolean(
        fine.damageReportId ||
            anyFine.damageId ||
            anyFine.damageReportID ||
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
    const [yearFilter, setYearFilter] = React.useState<YearFilter>("all");
    const [updateBusyId, setUpdateBusyId] = React.useState<string | null>(null);

    const [editAmountFineId, setEditAmountFineId] = React.useState<string | null>(null);
    const [editAmountValue, setEditAmountValue] = React.useState<string>("0.00");

    const [payDialogOpen, setPayDialogOpen] = React.useState(false);
    const [detailGroupKey, setDetailGroupKey] = React.useState<string | null>(null);
    const [payDialogFine, setPayDialogFine] = React.useState<FineRow | null>(null);
    const [payOfficialReceiptNumber, setPayOfficialReceiptNumber] = React.useState("");

    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [previewRows, setPreviewRows] = React.useState<PrintableFineRecord[]>([]);
    const [previewFocusFineId, setPreviewFocusFineId] = React.useState<string | number | null>(null);

    const resetPayDialog = React.useCallback(() => {
        setPayDialogOpen(false);
        setPayDialogFine(null);
        setPayOfficialReceiptNumber("");
    }, []);

    const loadFines = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const fineData = await fetchFines();

            const fineRows: FineRow[] = fineData.map((fine) => {
                const anyFine = fine as any;
                const damageReportId =
                    fine.damageReportId ??
                    anyFine.damageId ??
                    anyFine.damageReportID ??
                    null;

                return {
                    ...(fine as FineDTO),
                    _source: "fine" as const,
                    damageReportId,
                    damageSeverity: anyFine.damageSeverity ?? anyFine.severity ?? null,
                    damageStatus: anyFine.damageStatus ?? null,
                    damageFee: normalizeFine(anyFine.damageFee ?? anyFine.fee ?? fine.amount),
                    damageNotes:
                        anyFine.damageNotes ??
                        anyFine.damageDescription ??
                        anyFine.damageDetails ??
                        anyFine.damageType ??
                        null,
                } as FineRow;
            });

            setFines(fineRows);
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

    const yearOptions = React.useMemo(() => {
        const years = Array.from(
            new Set(
                fines
                    .map((fine) => getFineYear(fine))
                    .filter((year): year is string => Boolean(year))
            )
        );

        return years.sort((a, b) => Number(b) - Number(a));
    }, [fines]);

    const filtered = React.useMemo(() => {
        let rows = [...fines];

        if (statusFilter === "unresolved") {
            rows = rows.filter((f) => f.status === "active");
        } else if (statusFilter !== "all") {
            rows = rows.filter((f) => f.status === statusFilter);
        }

        if (yearFilter !== "all") {
            rows = rows.filter((f) => getFineYear(f) === yearFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter((f) => {
                const anyFine = f as any;
                const haystack = `${f.id} ${f.studentName ?? ""} ${f.studentEmail ?? ""} ${f.studentId ?? ""}
${f.bookTitle ?? ""} ${f.bookId ?? ""} ${sanitizeFineReason(f.reason) ?? ""} ${f.officialReceiptNumber ?? ""}
${anyFine.damageReportId ?? ""} ${anyFine.damageDescription ?? ""} ${anyFine.damageType ?? ""}
${anyFine.damageDetails ?? ""} ${anyFine.damageNotes ?? ""}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        return rows.sort((a, b) => {
            const sa = statusWeight(a.status);
            const sb = statusWeight(b.status);
            if (sa !== sb) return sa - sb;
            return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
        });
    }, [fines, statusFilter, yearFilter, search]);

    const groupedByUser = React.useMemo(() => {
        const map = new Map<
            string,
            {
                key: string;
                label: string;
                email: string;
                studentId: string;
                userId: string;
                rows: FineRow[];
            }
        >();

        for (const f of filtered) {
            const key = fineOwnerKey(f);
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    label: fineOwnerLabel(f),
                    email: f.studentEmail ?? "",
                    studentId: f.studentId != null ? String(f.studentId) : "",
                    userId: f.userId != null ? String(f.userId) : "",
                    rows: [],
                });
            }
            map.get(key)!.rows.push(f);
        }

        const groups = Array.from(map.values()).map((g) => {
            const rows = [...g.rows].sort((a, b) => {
                const sa = statusWeight(a.status);
                const sb = statusWeight(b.status);
                if (sa !== sb) return sa - sb;
                return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
            });

            let activeCount = 0;
            let paidCount = 0;
            let cancelledCount = 0;
            let totalAmount = 0;

            for (const row of rows) {
                const amt = normalizeFine(row.amount);
                if (amt > 0) totalAmount += amt;

                if (row.status === "active") activeCount += 1;
                else if (row.status === "paid") paidCount += 1;
                else if (row.status === "cancelled") cancelledCount += 1;
            }

            return {
                ...g,
                rows,
                activeCount,
                paidCount,
                cancelledCount,
                totalAmount,
            };
        });

        groups.sort(
            (a, b) =>
                a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) ||
                a.key.localeCompare(b.key)
        );

        return groups;
    }, [filtered]);

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

    const openPreviewForRows = React.useCallback((rows: FineRow[], focusFineId?: string | number | null) => {
        if (!rows.length) return;

        const sorted = [...rows].sort((a, b) =>
            String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
        );

        setPreviewRows(sorted.map(toPrintableFineRecord));
        setPreviewFocusFineId(focusFineId ?? sorted[0]?.id ?? null);
        setPreviewOpen(true);
    }, []);

    async function handleMarkFineAsPaid() {
        if (!payDialogFine) return;

        if (payDialogFine._source === "damage") {
            toast.error("Cannot update damage-based fine here", {
                description: "Open the Damage Reports page to change the status or fee of this damage.",
            });
            return;
        }

        const receiptNumber = payOfficialReceiptNumber.trim();
        if (!receiptNumber) {
            toast.error("Cashier OR is required", {
                description: "Please enter the cashier official receipt before marking this fine as paid.",
            });
            return;
        }

        setUpdateBusyId(payDialogFine.id);
        try {
            const updated = await markFineAsPaid(payDialogFine.id, receiptNumber);

            setFines((prev) =>
                prev.map((f) =>
                    f.id === updated.id ? ({ ...(updated as FineDTO), _source: "fine" as const } as FineRow) : f
                )
            );

            toast.success("Fine marked as paid", {
                description: `Recorded cashier proof: OR ${receiptNumber}.`,
            });

            resetPayDialog();
        } catch (err: any) {
            const msg = err?.message || "Failed to mark fine as paid.";
            toast.error("Update failed", { description: msg });
        } finally {
            setUpdateBusyId(null);
        }
    }

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
                    f.id === updated.id ? ({ ...(updated as FineDTO), _source: "fine" as const } as FineRow) : f
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
                    f.id === updated.id ? ({ ...(updated as FineDTO), _source: "fine" as const } as FineRow) : f
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
                <Badge className="w-full justify-start whitespace-normal wrap-break-word border-amber-400/80 bg-amber-500/80 text-left text-white hover:bg-amber-500 sm:w-auto">
                    <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Active (unpaid)
                    </span>
                </Badge>
            );
        }

        if (status === "paid") {
            return (
                <Badge className="w-full justify-start whitespace-normal wrap-break-word border-emerald-400/80 bg-emerald-500/80 text-left text-white hover:bg-emerald-500 sm:w-auto">
                    <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                    </span>
                </Badge>
            );
        }

        return (
            <Badge className="w-full justify-start whitespace-normal wrap-break-word border-slate-400/80 bg-slate-500/80 text-left text-white hover:bg-slate-500 sm:w-auto">
                <span className="inline-flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Cancelled
                </span>
            </Badge>
        );
    }

    const payDialogBusy = Boolean(payDialogFine && updateBusyId === payDialogFine.id);
    const payDialogReceipt = payOfficialReceiptNumber.trim();

    return (
        <DashboardLayout title="Fines">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <ReceiptText className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Fines</h2>
                        <p className="text-xs text-white/70">
                            Over-the-counter payments only. Librarian and assistant librarian staff can collect the payment physically, require the cashier OR,
                            then mark the fine as <span className="font-semibold text-emerald-200">Paid</span>.
                        </p>
                        <p className="mt-1 text-xs text-amber-200/90">
                            Overdue borrow fine rate:{" "}
                            <span className="font-semibold">{peso(DEFAULT_FINE_PER_HOUR)}/hour</span>. Damage fees
                            still use their assessed amount.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 text-xs text-white/70 sm:flex-row sm:items-center sm:text-sm">
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

            <div className="mb-4 grid gap-3 md:grid-cols-3">
                <Card className="border-white/10 bg-slate-800/60">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-xs text-white/60">Active fines</p>
                            <p className="mt-1 text-lg font-semibold text-amber-300">{stats.activeCount}</p>
                            <p className="text-xs text-white/50">{peso(stats.activeTotal)} outstanding</p>
                        </div>
                        <CircleDollarSign className="h-5 w-5 text-amber-300" />
                    </CardContent>
                </Card>

                <Card className="border-white/10 bg-slate-800/60">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-xs text-white/60">Paid fines</p>
                            <p className="mt-1 text-lg font-semibold text-emerald-300">{stats.paidCount}</p>
                            <p className="text-xs text-white/50">Completed transactions</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    </CardContent>
                </Card>

                <Card className="border-white/10 bg-slate-800/60">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-xs text-white/60">Cancelled fines</p>
                            <p className="mt-1 text-lg font-semibold text-slate-200">{stats.cancelledCount}</p>
                            <p className="text-xs text-white/50">Dismissed or voided records</p>
                        </div>
                        <XCircle className="h-5 w-5 text-slate-300" />
                    </CardContent>
                </Card>
            </div>

            <Card className="border-white/10 bg-slate-800/60">
                <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle>All fines grouped by user</CardTitle>

                        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by user, book, OR, damage report, or reason…"
                                    className="border-white/20 bg-slate-900/70 pl-9 text-white"
                                />
                            </div>

                            <div className="w-full md:w-52">
                                <Select value={yearFilter} onValueChange={setYearFilter}>
                                    <SelectTrigger className="h-9 w-full border-white/20 bg-slate-900/70 text-white">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="all">All years</SelectItem>
                                        {yearOptions.map((year) => (
                                            <SelectItem key={year} value={year}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-full md:w-60">
                                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                                    <SelectTrigger className="h-9 w-full border-white/20 bg-slate-900/70 text-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
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

                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center text-sm text-red-300">{error}</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            No fines matched your filters.
                            <br />
                            <span className="text-xs opacity-80">
                                Try clearing the search or changing the year or status filter.
                            </span>
                        </div>
                    ) : (
                        <>
                            <div className="text-xs text-white/60">
                                Showing <span className="font-semibold text-white/80">{filtered.length}</span>{" "}
                                {filtered.length === 1 ? "fine" : "fines"} across{" "}
                                <span className="font-semibold text-white/80">{groupedByUser.length}</span>{" "}
                                {groupedByUser.length === 1 ? "user" : "users"}.
                                {yearFilter !== "all" && (
                                    <span className="ml-2">
                                        Filtered to <span className="font-semibold text-white/80">{yearFilter}</span>.
                                    </span>
                                )}
                                <span className="ml-2">
                                    Use the <span className="font-semibold text-sky-200">Details</span> button to
                                    open the full record dialog for the selected user.
                                </span>
                            </div>

                            <div className="grid gap-3">
                                {groupedByUser.map((group) => (
                                    <React.Fragment key={group.key}>
                                        <Card className="border-white/10 bg-white/5 transition-colors hover:bg-white/[0.07]">
                                            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                                                <div className="min-w-0 space-y-2">
                                                    <div className="flex min-w-0 items-start gap-2">
                                                        <div className="rounded-full border border-white/10 bg-slate-900/70 p-2">
                                                            <UserRound className="h-4 w-4 text-sky-200" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold leading-5 text-white whitespace-normal wrap-break-word">
                                                                {group.label}
                                                            </p>
                                                            <p className="mt-1 text-xs text-white/60 whitespace-normal wrap-break-word">
                                                                {group.rows.length} {group.rows.length === 1 ? "record" : "records"} • {peso(group.totalAmount)} total
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                                        <Badge className="w-full justify-start whitespace-normal wrap-break-word bg-amber-500/15 text-left text-amber-100 hover:bg-amber-500/15 sm:w-auto">
                                                            Active: {group.activeCount}
                                                        </Badge>
                                                        <Badge className="w-full justify-start whitespace-normal wrap-break-word bg-emerald-500/15 text-left text-emerald-100 hover:bg-emerald-500/15 sm:w-auto">
                                                            Paid: {group.paidCount}
                                                        </Badge>
                                                        <Badge className="w-full justify-start whitespace-normal wrap-break-word bg-slate-500/20 text-left text-slate-100 hover:bg-slate-500/20 sm:w-auto">
                                                            Cancelled: {group.cancelledCount}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:shrink-0">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-sky-300/40 text-sky-100 hover:bg-sky-500/10"
                                                        onClick={() => openPreviewForRows(group.rows)}
                                                    >
                                                        <Eye className="mr-1 h-3.5 w-3.5" />
                                                        View
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-white/20 text-white/90 hover:bg-white/10"
                                                        onClick={() => setDetailGroupKey(group.key)}
                                                    >
                                                        Details
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Dialog
                                            open={detailGroupKey === group.key}
                                            onOpenChange={(open) => setDetailGroupKey(open ? group.key : null)}
                                        >
                                            <DialogContent className="w-[96vw] max-h-[95svh] overflow-x-hidden overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-6xl
        [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-slate-900/70
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-slate-700
        [&::-webkit-scrollbar-thumb:hover]:bg-slate-600">
                                                <DialogHeader>
                                                    <DialogTitle className="pr-8 whitespace-normal wrap-break-word">{group.label}</DialogTitle>
                                                    <DialogDescription className="text-white/70">
                                                        Review fines, payment status, receipts, and row-level actions for this user.
                                                    </DialogDescription>
                                                </DialogHeader>

                                                <div className="mb-3 space-y-3">
                                                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                                        {group.email ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="w-full justify-start whitespace-normal wrap-break-word border-white/15 text-left text-white/80 sm:w-auto"
                                                            >
                                                                Email: {group.email}
                                                            </Badge>
                                                        ) : null}
                                                        {group.studentId ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="w-full justify-start whitespace-normal wrap-break-word border-white/15 text-left text-white/80 sm:w-auto"
                                                            >
                                                                Student ID: {group.studentId}
                                                            </Badge>
                                                        ) : null}
                                                        {group.userId ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="w-full justify-start whitespace-normal wrap-break-word border-white/15 text-left text-white/80 sm:w-auto"
                                                            >
                                                                User ID: {group.userId}
                                                            </Badge>
                                                        ) : null}
                                                        <Badge className="w-full justify-start whitespace-normal wrap-break-word bg-sky-500/15 text-left text-sky-100 hover:bg-sky-500/15 sm:w-auto">
                                                            Total: {peso(group.totalAmount)}
                                                        </Badge>
                                                    </div>

                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <Card className="border-white/10 bg-slate-900/40">
                                                            <CardContent className="flex items-center gap-3 p-4">
                                                                <UserRound className="h-4 w-4 text-sky-200" />
                                                                <div>
                                                                    <p className="text-xs text-white/50">Account summary</p>
                                                                    <p className="text-sm font-medium text-white whitespace-normal wrap-break-word">
                                                                        {group.rows.length} {group.rows.length === 1 ? "record" : "records"}
                                                                    </p>
                                                                </div>
                                                            </CardContent>
                                                        </Card>

                                                        <Card className="border-white/10 bg-slate-900/40">
                                                            <CardContent className="flex items-center gap-3 p-4">
                                                                <CircleDollarSign className="h-4 w-4 text-emerald-200" />
                                                                <div>
                                                                    <p className="text-xs text-white/50">Total amount</p>
                                                                    <p className="text-sm font-medium text-white whitespace-normal wrap-break-word">{peso(group.totalAmount)}</p>
                                                                </div>
                                                            </CardContent>
                                                        </Card>

                                                        <Card className="border-white/10 bg-slate-900/40">
                                                            <CardContent className="flex items-center gap-3 p-4">
                                                                <CalendarClock className="h-4 w-4 text-amber-200" />
                                                                <div>
                                                                    <p className="text-xs text-white/50">Outstanding</p>
                                                                    <p className="text-sm font-medium text-white whitespace-normal wrap-break-word">
                                                                        {group.activeCount} active {group.activeCount === 1 ? "fine" : "fines"}
                                                                    </p>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </div>

                                                </div>

                                                <div className="grid gap-3">
                                                    {group.rows.map((fine) => {
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

                                                        const endForDays =
                                                            fine.borrowReturnDate ??
                                                            (fine.status !== "active"
                                                                ? fine.resolvedAt ?? fine.createdAt ?? null
                                                                : new Date().toISOString());

                                                        const overdueLabel = damage
                                                            ? "Damage"
                                                            : getFineOverdueLabel(fine, endForDays);

                                                        const receiptLabel = getOfficialReceiptLabel(fine.officialReceiptNumber);
                                                        const fineRateLabel = !damage
                                                            ? `Rate: ${peso(getFineRatePerHour(fine))}/hour`
                                                            : null;
                                                        const displayReason = sanitizeFineReason(fine.reason);

                                                        return (
                                                            <Card
                                                                key={fine.id}
                                                                className="border-white/10 bg-slate-900/50 transition-colors hover:bg-white/5"
                                                            >
                                                                <CardHeader className="gap-3 pb-3">
                                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                                        <div className="space-y-2">
                                                                            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                                                                <Badge variant="outline" className="w-full justify-start whitespace-normal wrap-break-word border-white/15 text-left text-white/80 sm:w-auto">
                                                                                    Fine ID: {fine.id}
                                                                                </Badge>
                                                                                {renderStatusBadge(fine.status)}
                                                                                {receiptLabel && (
                                                                                    <Badge className="w-full justify-start whitespace-normal wrap-break-word border-emerald-400/40 bg-emerald-500/10 text-left text-emerald-200 hover:bg-emerald-500/10 sm:w-auto">
                                                                                        {receiptLabel}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>

                                                                            <div>
                                                                                <CardTitle className="text-base text-white whitespace-normal wrap-break-word">
                                                                                    {fine.bookTitle ? fine.bookTitle : fine.bookId ? `Book #${fine.bookId}` : "Untitled record"}
                                                                                </CardTitle>
                                                                                <div className="mt-1 flex flex-col items-start gap-2 text-xs text-white/60 sm:flex-row sm:flex-wrap sm:items-center">
                                                                                    <span className="inline-flex items-center gap-1">
                                                                                        <UserRound className="h-3.5 w-3.5" />
                                                                                        {fineOwnerLabel(fine)}
                                                                                    </span>
                                                                                    {fine.borrowRecordId && (
                                                                                        <span className="inline-flex items-center gap-1">
                                                                                            <BookOpen className="h-3.5 w-3.5" />
                                                                                            Borrow #{fine.borrowRecordId}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left lg:min-w-44">
                                                                            <p className="text-xs text-white/50">Amount</p>
                                                                            <p className="text-lg font-semibold text-white">{peso(amount)}</p>
                                                                            {fineRateLabel && <p className="text-xs text-white/60">{fineRateLabel}</p>}
                                                                        </div>
                                                                    </div>
                                                                </CardHeader>

                                                                <CardContent className="space-y-4">
                                                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                                        <div className="rounded-md border border-white/10 bg-white/5 p-3">
                                                                            <p className="text-xs text-white/50">Duration</p>
                                                                            <p className="mt-1 text-sm font-medium text-white whitespace-normal wrap-break-word">
                                                                                {damage || isDamageRow ? "Damage" : overdueLabel}
                                                                            </p>
                                                                        </div>

                                                                        <div className="rounded-md border border-white/10 bg-white/5 p-3">
                                                                            <p className="text-xs text-white/50">Created</p>
                                                                            <p className="mt-1 text-sm font-medium text-white whitespace-normal wrap-break-word">
                                                                                {fmtDate(fine.createdAt)}
                                                                            </p>
                                                                        </div>

                                                                        <div className="rounded-md border border-white/10 bg-white/5 p-3">
                                                                            <p className="text-xs text-white/50">Date paid</p>
                                                                            <p className="mt-1 text-sm font-medium text-white whitespace-normal wrap-break-word">
                                                                                {fmtDate(getFineDatePaid(fine))}
                                                                            </p>
                                                                        </div>

                                                                        <div className="rounded-md border border-white/10 bg-white/5 p-3">
                                                                            <p className="text-xs text-white/50">Source</p>
                                                                            <p className="mt-1 text-sm font-medium text-white whitespace-normal wrap-break-word">
                                                                                {isDamageRow ? "Damage report" : "Fine record"}
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3">
                                                                        <p className="text-xs font-medium text-white/70">Record details</p>
                                                                        <div className="grid gap-2 md:grid-cols-2">
                                                                            {fine.borrowDueDate && (
                                                                                <p className="text-sm text-white/75 whitespace-normal wrap-break-word">
                                                                                    <span className="font-medium text-white">Due:</span>{" "}
                                                                                    {fmtDate(fine.borrowDueDate)}
                                                                                </p>
                                                                            )}
                                                                            {fine.borrowReturnDate && (
                                                                                <p className="text-sm text-white/75 whitespace-normal wrap-break-word">
                                                                                    <span className="font-medium text-white">Returned:</span>{" "}
                                                                                    {fmtDate(fine.borrowReturnDate)}
                                                                                </p>
                                                                            )}
                                                                            {displayReason && (
                                                                                <p className="text-sm text-white/75 whitespace-normal wrap-break-word md:col-span-2">
                                                                                    <span className="font-medium text-white">Reason:</span>{" "}
                                                                                    {displayReason}
                                                                                </p>
                                                                            )}
                                                                            {(damageReportId || damageDescription || damage) && (
                                                                                <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100 md:col-span-2">
                                                                                    <div className="mb-1 flex items-center gap-2 font-medium">
                                                                                        <AlertTriangle className="h-4 w-4" />
                                                                                        Damage fine
                                                                                    </div>
                                                                                    <div className="space-y-1 text-rose-100/90">
                                                                                        {damageReportId && <p>Report #{damageReportId}</p>}
                                                                                        {damageDescription && <p>{damageDescription}</p>}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-col items-stretch gap-2 border-t border-white/10 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
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
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="border-white/20 text-white/90 hover:bg-white/10"
                                                                                    >
                                                                                        <Edit className="mr-1 h-3.5 w-3.5" />
                                                                                        Edit amount
                                                                                    </Button>
                                                                                </AlertDialogTrigger>

                                                                                <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
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
                                                                                                className="border-white/20 bg-slate-900/70 pl-6 text-white"
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
                                                                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
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

                                                                        {!isDamageRow && fine.status === "active" && (
                                                                            <>
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                                                                    disabled={busy}
                                                                                    onClick={() => {
                                                                                        setPayDialogFine(fine);
                                                                                        setPayOfficialReceiptNumber(
                                                                                            fine.officialReceiptNumber?.trim() ?? ""
                                                                                        );
                                                                                        setPayDialogOpen(true);
                                                                                    }}
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

                                                                                    <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
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
                                                                                                className="bg-slate-500 text-white hover:bg-slate-600"
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

                                                                        {(isDamageRow || fine.status !== "active") && (
                                                                            <span className="text-xs text-white/60">Status locked</span>
                                                                        )}
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        );
                                                    })}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </React.Fragment>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <AlertDialog
                open={payDialogOpen}
                onOpenChange={(open) => {
                    setPayDialogOpen(open);
                    if (!open) {
                        setPayDialogFine(null);
                        setPayOfficialReceiptNumber("");
                    }
                }}
            >
                <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Mark this fine as paid?</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/70">
                            Enter the cashier official receipt first. This OR will be saved as payment proof.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {payDialogFine && (
                        <div className="space-y-3">
                            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/75">
                                <div>
                                    <span className="font-medium text-white">User:</span>{" "}
                                    {fineOwnerLabel(payDialogFine)}
                                </div>
                                <div>
                                    <span className="font-medium text-white">Fine ID:</span> {payDialogFine.id}
                                </div>
                                <div>
                                    <span className="font-medium text-white">Amount:</span>{" "}
                                    {peso(normalizeFine(payDialogFine.amount))}
                                </div>
                                {payDialogFine.bookTitle && (
                                    <div>
                                        <span className="font-medium text-white">Book:</span> {payDialogFine.bookTitle}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-white/80">Cashier OR</label>
                                <Input
                                    value={payOfficialReceiptNumber}
                                    onChange={(e) => setPayOfficialReceiptNumber(e.target.value)}
                                    placeholder="Enter official receipt"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoFocus
                                />
                                <p className="text-xs text-amber-200/90">
                                    Required proof before the fine can be marked as paid.
                                </p>
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="border-white/20 text-white hover:bg-black/20"
                            disabled={payDialogBusy}
                            onClick={resetPayDialog}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={payDialogBusy || !payDialogReceipt}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleMarkFineAsPaid();
                            }}
                        >
                            {payDialogBusy ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving…
                                </span>
                            ) : (
                                "Confirm paid"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ExportPreviewFines
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                records={previewRows}
                selectedFineId={previewFocusFineId}
                fileNamePrefix="bookhive-fines-record"
            />
        </DashboardLayout>
    );
}