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
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

import {
    ReceiptText,
    RefreshCcw,
    Loader2,
    Search,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Edit,
    Printer,
} from "lucide-react";
import { toast } from "sonner";

import { fetchFines, updateFine, type FineDTO, type FineStatus } from "@/lib/fines";
import { API_BASE } from "@/api/auth/route";
import type {
    DamageReportDTO,
    DamageStatus,
    DamageSeverity,
} from "@/lib/damageReports";

import ExportPreviewFines, {
    type PrintableFineRecord,
} from "@/components/fines-preview/export-preview-fines";

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

/**
 * Compute overdue days in LOCAL date (no timezone off-by-one):
 * - dueDate -> endDate (return date / resolved / created / today)
 * - returns 0 if not overdue
 * - returns null if dates are missing/invalid
 */
function computeOverdueDays(
    dueDate?: string | null,
    endDate?: string | null
): number | null {
    if (!dueDate) return null;

    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;

    const end = endDate ? new Date(endDate) : new Date();
    if (Number.isNaN(end.getTime())) return null;

    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    const diffMs = endLocal.getTime() - dueLocal.getTime();
    const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return rawDays > 0 ? rawDays : 0;
}

function overdueDaysLabel(days: number | null): string {
    if (days == null) return "—";
    return `${days} day${days === 1 ? "" : "s"}`;
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

function sameFineOwner(a: FineRow, b: FineRow): boolean {
    if (a.userId != null && b.userId != null) {
        return String(a.userId).trim() === String(b.userId).trim();
    }

    const sidA = a.studentId != null ? String(a.studentId).trim().toLowerCase() : "";
    const sidB = b.studentId != null ? String(b.studentId).trim().toLowerCase() : "";
    if (sidA && sidB) return sidA === sidB;

    const mailA = (a.studentEmail ?? "").trim().toLowerCase();
    const mailB = (b.studentEmail ?? "").trim().toLowerCase();
    if (mailA && mailB) return mailA === mailB;

    return String(a.id) === String(b.id);
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
        reason: row.reason ?? null,
        status: row.status,
        amount: normalizeFine(row.amount),
        createdAt: row.createdAt ?? null,
        resolvedAt: row.resolvedAt ?? null,
        borrowDueDate: row.borrowDueDate ?? null,
        borrowReturnDate: row.borrowReturnDate ?? null,
        sourceLabel: row._source ?? "fine",
    };
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

    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [previewRows, setPreviewRows] = React.useState<PrintableFineRecord[]>([]);
    const [previewFocusFineId, setPreviewFocusFineId] = React.useState<string | number | null>(null);
    const [previewAutoPrint, setPreviewAutoPrint] = React.useState(false);

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

    const openPrintPreviewForFine = React.useCallback(
        (fine: FineRow, opts?: { autoPrint?: boolean }) => {
            const ownerRows = fines.filter((row) => sameFineOwner(row, fine));
            const rowsToUse = ownerRows.length ? ownerRows : [fine];

            const sorted = [...rowsToUse].sort((a, b) =>
                String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
            );

            setPreviewRows(sorted.map(toPrintableFineRecord));
            setPreviewFocusFineId(fine.id);
            setPreviewAutoPrint(Boolean(opts?.autoPrint));
            setPreviewOpen(true);
        },
        [fines]
    );

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
                            Librarian flow: issue slip → student/faculty pays cashier → returns with receipt → print paid fine record.
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
                        <CardTitle>All fines grouped by user</CardTitle>

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

                <CardContent className="space-y-3">
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
                        <>
                            <div className="text-xs text-white/60">
                                Showing{" "}
                                <span className="font-semibold text-white/80">{filtered.length}</span>{" "}
                                {filtered.length === 1 ? "fine" : "fines"} across{" "}
                                <span className="font-semibold text-white/80">{groupedByUser.length}</span>{" "}
                                {groupedByUser.length === 1 ? "user" : "users"}.
                                <span className="ml-2">
                                    Use the{" "}
                                    <span className="font-semibold text-sky-200">Print</span> button under{" "}
                                    <span className="font-semibold text-sky-200">Actions</span> to auto-open print + PDF preview/download.
                                </span>
                            </div>

                            <Accordion
                                type="multiple"
                                className="w-full"
                                defaultValue={groupedByUser.length === 1 ? [groupedByUser[0].key] : []}
                            >
                                {groupedByUser.map((group) => (
                                    <AccordionItem key={group.key} value={group.key} className="border-white/10">
                                        <div className="rounded-md bg-white/4 px-3">
                                            <AccordionTrigger className="py-3 text-white/90 hover:no-underline items-center">
                                                <div className="flex w-full items-center justify-between gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-white">
                                                            {group.label}
                                                        </span>
                                                        <span className="text-xs text-white/60">
                                                            {group.activeCount} active • {group.paidCount} paid • {group.cancelledCount} cancelled •{" "}
                                                            {group.rows.length} total
                                                            <span className="ml-2 text-emerald-200/90">
                                                                ({peso(group.totalAmount)})
                                                            </span>
                                                        </span>
                                                        {(group.studentId || group.email || group.userId) && (
                                                            <span className="text-[11px] text-white/50 mt-0.5">
                                                                {group.studentId ? `ID: ${group.studentId}` : ""}
                                                                {group.studentId && group.email ? " · " : ""}
                                                                {group.email ? group.email : ""}
                                                                {(group.studentId || group.email) && group.userId ? " · " : ""}
                                                                {group.userId ? `User #${group.userId}` : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                        </div>

                                        <AccordionContent className="pb-2">
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableCaption className="text-xs text-white/60">
                                                        {group.rows.length} {group.rows.length === 1 ? "fine" : "fines"} for{" "}
                                                        <span className="font-semibold text-white/80">{group.label}</span>. Print creates one PDF record for this user.
                                                    </TableCaption>

                                                    <TableHeader>
                                                        <TableRow className="border-white/10">
                                                            <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                                                Fine ID
                                                            </TableHead>
                                                            <TableHead className="text-xs font-semibold text-white/70">
                                                                Book / damage info
                                                            </TableHead>
                                                            <TableHead className="text-xs font-semibold text-white/70">Status</TableHead>
                                                            <TableHead className="text-xs font-semibold text-white/70">₱Amount</TableHead>
                                                            <TableHead className="text-xs font-semibold text-white/70">Days</TableHead>
                                                            <TableHead className="text-xs font-semibold text-white/70">Created</TableHead>
                                                            <TableHead className="text-xs font-semibold text-white/70">Resolved</TableHead>
                                                            <TableHead className="text-xs font-semibold text-white/70 text-right">
                                                                Actions
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>

                                                    <TableBody>
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

                                                            const overdueDays = computeOverdueDays(fine.borrowDueDate ?? null, endForDays);

                                                            return (
                                                                <TableRow
                                                                    key={fine.id}
                                                                    className="border-white/5 hover:bg-white/5 transition-colors"
                                                                >
                                                                    <TableCell className="text-xs opacity-80">{fine.id}</TableCell>

                                                                    <TableCell
                                                                        className={
                                                                            "text-sm align-top w-[140px] max-w-[220px] " + cellScrollbarClasses
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

                                                                    <TableCell className="text-xs opacity-80">
                                                                        {damage || isDamageRow ? (
                                                                            <span className="inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                                                                                Damage
                                                                            </span>
                                                                        ) : (
                                                                            overdueDaysLabel(overdueDays)
                                                                        )}
                                                                    </TableCell>

                                                                    <TableCell className="text-xs opacity-80">{fmtDate(fine.createdAt)}</TableCell>
                                                                    <TableCell className="text-xs opacity-80">
                                                                        {fine.resolvedAt ? fmtDate(fine.resolvedAt) : "—"}
                                                                    </TableCell>

                                                                    <TableCell className={"text-right w-[230px] max-w-[250px] " + cellScrollbarClasses}>
                                                                        <div className="inline-flex items-center justify-end gap-2 min-w-max">
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="border-sky-300/40 text-sky-100 hover:bg-sky-500/10"
                                                                                onClick={() =>
                                                                                    openPrintPreviewForFine(fine, { autoPrint: true })
                                                                                }
                                                                            >
                                                                                <Printer className="mr-1 h-3.5 w-3.5" />
                                                                                Print
                                                                            </Button>

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
                                                                                                            successDescription:
                                                                                                                "Recorded as paid via over-the-counter payment.",
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
                                                                                                    This will mark the fine as{" "}
                                                                                                    <span className="font-semibold">Cancelled</span>.
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

                                                                            {(isDamageRow || fine.status !== "active") && (
                                                                                <span className="text-[11px] text-white/60">
                                                                                    Status locked
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </>
                    )}
                </CardContent>
            </Card>

            <ExportPreviewFines
                open={previewOpen}
                onOpenChange={(open) => {
                    setPreviewOpen(open);
                    if (!open) setPreviewAutoPrint(false);
                }}
                records={previewRows}
                selectedFineId={previewFocusFineId}
                autoPrintOnOpen={previewAutoPrint}
                fileNamePrefix="bookhive-fines-record"
            />
        </DashboardLayout>
    );
}
