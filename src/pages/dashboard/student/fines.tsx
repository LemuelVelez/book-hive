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
    BookOpen,
    CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

import {
    fetchMyFines,
    type FineDTO,
    type FineStatus,
} from "@/lib/fines";

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
    DialogTrigger,
} from "@/components/ui/dialog";

import {
    fetchMyDamageReports,
    type DamageReportDTO,
} from "@/lib/damageReports";

type StatusFilter = "all" | FineStatus;

/* -------------------- Damage-report helpers (book titles) -------------------- */

type DamageReportRow = DamageReportDTO & {
    photoUrl?: string | null;
};

async function fetchDamageReportsForFines(): Promise<DamageReportRow[]> {
    const reports = await fetchMyDamageReports();
    if (!Array.isArray(reports)) return [];
    return reports as DamageReportRow[];
}

function enrichFinesWithDamageReports(
    fines: FineDTO[],
    reports: DamageReportRow[]
): FineDTO[] {
    if (!fines?.length || !reports?.length) return fines;

    const damageMap = new Map<string, DamageReportRow>();
    for (const r of reports) {
        damageMap.set(String(r.id), r);
    }

    return fines.map((fine) => {
        const anyFine = fine as any;
        const drKey =
            anyFine.damageReportId ??
            anyFine.damageId ??
            anyFine.damageReportID ??
            null;

        if (drKey == null) return fine;

        const dr = damageMap.get(String(drKey));
        if (!dr) return fine;

        const currentTitle =
            typeof fine.bookTitle === "string" ? fine.bookTitle.trim() : "";

        const merged: FineDTO = {
            ...fine,
            bookTitle:
                currentTitle &&
                currentTitle.length > 0 &&
                currentTitle.toLowerCase() !== "general fine"
                    ? fine.bookTitle
                    : (dr.bookTitle ?? fine.bookTitle),
            bookId: (fine.bookId ?? dr.bookId) as any,
        };

        const mergedAny = merged as any;

        if (mergedAny.damageReportId == null) {
            mergedAny.damageReportId = dr.id;
        }

        const existingDamageDesc =
            mergedAny.damageDescription ||
            mergedAny.damageDetails ||
            mergedAny.damageType;

        if (!existingDamageDesc) {
            const notes = dr.notes && String(dr.notes).trim();
            const damageType =
                (dr as any).damageType && String((dr as any).damageType).trim();

            if (notes) {
                mergedAny.damageDescription = notes;
            } else if (damageType) {
                mergedAny.damageDescription = damageType;
            }
        }

        return merged;
    });
}

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
function computeOverdueDays(dueDate?: string | null, endDate?: string | null): number | null {
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

function isDamageFine(fine: FineDTO): boolean {
    const anyFine = fine as any;
    const reason = (fine.reason || "").toLowerCase();

    return Boolean(
        fine.damageReportId ||
            anyFine.damageId ||
            anyFine.damageType ||
            anyFine.damageDescription ||
            anyFine.damageDetails ||
            reason.includes("damage") ||
            reason.includes("lost book")
    );
}

function getFinePrimaryLabel(fine: FineDTO): string {
    const rawTitle = fine.bookTitle;
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";

    const rawReason = (fine as any).reason;
    const reason = typeof rawReason === "string" ? rawReason.trim() : "";

    if (title && title.toLowerCase() !== "general fine") {
        return title;
    }

    if (reason) {
        return reason;
    }

    if (title) {
        return title;
    }

    if ((fine as any).borrowRecordId != null) {
        return `General fine for borrow #${(fine as any).borrowRecordId}`;
    }

    return "General fine";
}

function normalizeStatus(raw: any): FineStatus {
    const v = String(raw ?? "").toLowerCase();
    if (v === "paid") return "paid";
    if (v === "cancelled") return "cancelled";
    return "active";
}

function getDateSortValue(value?: string | null): number {
    if (!value) return 0;
    const parsed = new Date(value);
    const time = parsed.getTime();
    return Number.isNaN(time) ? 0 : time;
}

function getFineReferenceEndDate(
    fine: FineDTO,
    status: FineStatus
): string | null {
    if (fine.borrowReturnDate) return fine.borrowReturnDate;

    if (status !== "active") {
        return (fine as any).resolvedAt ?? fine.createdAt ?? null;
    }

    return new Date().toISOString();
}

function getFineSortRank(fine: FineDTO): number {
    const status = normalizeStatus((fine as any).status);
    const damage = isDamageFine(fine);
    const overdueDays = computeOverdueDays(
        fine.borrowDueDate ?? null,
        getFineReferenceEndDate(fine, status)
    );

    if (status === "active") {
        if (!damage && (overdueDays ?? 0) > 0) return 0;
        if (damage) return 1;
        return 2;
    }

    if (status === "paid") return 3;
    return 4;
}

function compareFinesByPriority(a: FineDTO, b: FineDTO): number {
    const rankDiff = getFineSortRank(a) - getFineSortRank(b);
    if (rankDiff !== 0) return rankDiff;

    const statusA = normalizeStatus((a as any).status);
    const statusB = normalizeStatus((b as any).status);

    const overdueA = computeOverdueDays(
        a.borrowDueDate ?? null,
        getFineReferenceEndDate(a, statusA)
    ) ?? 0;
    const overdueB = computeOverdueDays(
        b.borrowDueDate ?? null,
        getFineReferenceEndDate(b, statusB)
    ) ?? 0;
    const overdueDiff = overdueB - overdueA;
    if (overdueDiff !== 0) return overdueDiff;

    const amountDiff = normalizeFine(b.amount) - normalizeFine(a.amount);
    if (amountDiff !== 0) return amountDiff;

    return getDateSortValue(b.createdAt ?? null) - getDateSortValue(a.createdAt ?? null);
}

function renderStatusLabel(statusRaw: any) {
    const status = normalizeStatus(statusRaw);
    if (status === "active") return "Active (unpaid)";
    if (status === "paid") return "Paid";
    if (status === "cancelled") return "Cancelled";
    return "Unknown";
}

function renderStatusBadge(statusRaw: any) {
    const status = normalizeStatus(statusRaw);

    if (status === "active") {
        return (
            <Badge className="bg-amber-500/80 text-white border-amber-400/80 hover:bg-amber-500">
                <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Active (unpaid)
                </span>
            </Badge>
        );
    }

    if (status === "paid") {
        return (
            <Badge className="bg-emerald-500/80 text-white border-emerald-400/80 hover:bg-emerald-500">
                <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Paid
                </span>
            </Badge>
        );
    }

    return (
        <Badge className="bg-slate-500/80 text-white border-slate-400/80 hover:bg-slate-500">
            <span className="inline-flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Cancelled
            </span>
        </Badge>
    );
}

export default function StudentFinesPage() {
    const [fines, setFines] = React.useState<FineDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

    const loadFines = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const [fineDataRaw, damageReports] = await Promise.all([
                (async () => (await fetchMyFines()) as any[])(),
                (async () => {
                    try {
                        return await fetchDamageReportsForFines();
                    } catch (err: any) {
                        console.error("Failed to load damage reports for student fines:", err);
                        toast.error("Some damage fine details may be incomplete", {
                            description:
                                err?.message ||
                                "Book titles for certain damage-related fines may not be shown.",
                        });
                        return [] as DamageReportRow[];
                    }
                })(),
            ]);

            const fineData: FineDTO[] = fineDataRaw.map((f) => ({
                ...(f as any),
                status: normalizeStatus((f as any).status),
            })) as FineDTO[];

            const enriched = enrichFinesWithDamageReports(fineData, damageReports);
            setFines(enriched);
        } catch (err: any) {
            const msg = err?.message || "Failed to load fines.";
            setError(msg);
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

        if (statusFilter !== "all") {
            rows = rows.filter((f) => normalizeStatus((f as any).status) === statusFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter((f) => {
                const anyFine = f as any;
                const haystack = `${f.id} ${f.reason ?? ""} ${f.bookTitle ?? ""} ${f.bookId ?? ""} ${
                    f.damageReportId ?? anyFine.damageReportId ?? ""
                } ${anyFine.damageDescription ?? ""} ${anyFine.damageType ?? ""} ${
                    anyFine.damageDetails ?? ""
                }`.toLowerCase();
                return haystack.includes(q);
            });
        }

        return rows.sort(compareFinesByPriority);
    }, [fines, statusFilter, search]);

    const totalActive = React.useMemo(() => {
        let active = 0;
        for (const f of fines) {
            const amt = normalizeFine(f.amount);
            if (amt <= 0) continue;
            if (normalizeStatus((f as any).status) === "active") active += amt;
        }
        return active;
    }, [fines]);

    return (
        <DashboardLayout title="My Fines">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Fines</h2>
                        <p className="text-xs text-white/70">
                            Review fines linked to your account{" "}
                            <span className="font-semibold">(overdue returns and book damage)</span>.
                        </p>
                        <p className="mt-1 text-[11px] text-emerald-200/90">
                            Payment is <span className="font-semibold">over the counter only</span>. Please go to
                            the library to pay your fines physically. After payment, the librarian will mark your
                            fine as <span className="font-semibold">Paid</span>.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 text-xs text-white/70 sm:flex-row sm:items-center sm:text-sm">
                    <div className="flex flex-col items-start sm:items-end">
                        <span>
                            Active fines (unpaid):{" "}
                            <span className="font-semibold text-amber-300">{peso(totalActive)}</span>
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

            <Card className="border-white/10 bg-slate-800/60">
                <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle>Fine history</CardTitle>

                        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by book, reason, damage, or ID…"
                                    className="border-white/20 bg-slate-900/70 pl-9 text-white"
                                />
                            </div>

                            <div className="w-full md:w-56">
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                                >
                                    <SelectTrigger className="h-9 w-full border-white/20 bg-slate-900/70 text-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active (unpaid)</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center text-sm text-red-300">{error}</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            You have no fines that match your filters.
                            <br />
                            <span className="text-xs opacity-80">
                                If you recently paid a fine, it may take a moment before the status is updated to{" "}
                                <span className="font-semibold">Paid</span>.
                            </span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-white/65">
                                Showing {filtered.length} {filtered.length === 1 ? "fine" : "fines"}. Active fines
                                must be paid <span className="font-semibold">over the counter</span> at the library.
                                <span className="opacity-80"> Overdue unpaid fines are listed first, while paid and cancelled fines are pushed lower. Days = overdue days for borrow-based fines; damage fines show “Damage”.</span>
                            </div>

                            <Accordion type="single" collapsible className="space-y-3">
                                {filtered.map((fine) => {
                                    const amount = normalizeFine(fine.amount);

                                    const anyFine = fine as any;
                                    const damageReportId: string | undefined =
                                        fine.damageReportId ?? anyFine.damageId ?? anyFine.damageReportId;
                                    const damageDescription: string | undefined =
                                        anyFine.damageDescription || anyFine.damageDetails || anyFine.damageType;
                                    const damage = isDamageFine(fine);

                                    const primaryLabel = getFinePrimaryLabel(fine);
                                    const reasonText =
                                        typeof fine.reason === "string" ? fine.reason.trim() : "";

                                    const status = normalizeStatus((fine as any).status);

                                    const endForDays =
                                        fine.borrowReturnDate ??
                                        (status !== "active"
                                            ? (fine as any).resolvedAt ?? fine.createdAt ?? null
                                            : new Date().toISOString());

                                    const overdueDays = computeOverdueDays(fine.borrowDueDate ?? null, endForDays);

                                    return (
                                        <AccordionItem
                                            key={fine.id}
                                            value={String(fine.id)}
                                            className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50"
                                        >
                                            <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                                <div className="flex w-full min-w-0 items-center gap-2 text-left">
                                                    <span className="truncate text-sm font-semibold text-white">
                                                        {primaryLabel}
                                                    </span>
                                                    {renderStatusBadge(status)}
                                                    <span className="min-w-0 flex-1 truncate text-xs text-white/70">
                                                        {peso(amount)} • {damage ? "Damage" : overdueDaysLabel(overdueDays)} • Created {fmtDate(fine.createdAt)}
                                                        {fine.borrowDueDate ? ` • Due ${fmtDate(fine.borrowDueDate)}` : ""}
                                                    </span>
                                                </div>
                                            </AccordionTrigger>

                                            <AccordionContent className="border-t border-white/10 px-4 pb-4 pt-4">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="w-full border-white/20 text-white/90 hover:bg-white/10"
                                                        >
                                                            Details
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-950 text-white sm:max-w-4xl">
                                                        <DialogHeader>
                                                            <DialogTitle className="pr-6 text-left">{primaryLabel}</DialogTitle>
                                                            <DialogDescription className="text-left text-white/65">
                                                                Fine #{fine.id} • {renderStatusLabel(status)} • {peso(amount)}
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="max-h-[calc(95svh-8rem)] overflow-y-auto pr-1">
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <Card className="border-white/10 bg-slate-950/40">
                                                        <CardHeader className="pb-3">
                                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                                <BookOpen className="h-4 w-4" />
                                                                Fine details
                                                            </CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="space-y-2 text-sm text-white/80">
                                                            <p>
                                                                <span className="text-white/55">Fine ID:</span> {fine.id}
                                                            </p>
                                                            <p>
                                                                <span className="text-white/55">Title / label:</span> {primaryLabel}
                                                            </p>
                                                            {reasonText && (
                                                                <p>
                                                                    <span className="text-white/55">Reason:</span> {reasonText}
                                                                </p>
                                                            )}
                                                            <p>
                                                                <span className="text-white/55">Amount:</span>{" "}
                                                                <span className="font-semibold text-amber-200">{peso(amount)}</span>
                                                            </p>
                                                            <p>
                                                                <span className="text-white/55">Status:</span> {status}
                                                            </p>
                                                            {!damage && overdueDays != null && (
                                                                <p>
                                                                    <span className="text-white/55">Overdue:</span> {overdueDaysLabel(overdueDays)}
                                                                </p>
                                                            )}
                                                            {damage && (
                                                                <div className="rounded-md border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100">
                                                                    <p className="flex items-center gap-2 font-semibold">
                                                                        <AlertTriangle className="h-4 w-4" />
                                                                        Damage fine
                                                                    </p>
                                                                    {damageReportId && <p className="mt-1">Report #{damageReportId}</p>}
                                                                    {damageDescription && <p className="mt-1">{damageDescription}</p>}
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>

                                                    <Card className="border-white/10 bg-slate-950/40">
                                                        <CardHeader className="pb-3">
                                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                                <CalendarClock className="h-4 w-4" />
                                                                Borrow / report reference
                                                            </CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="space-y-2 text-sm text-white/80">
                                                            {fine.borrowRecordId ? (
                                                                <>
                                                                    <p>
                                                                        <span className="text-white/55">Borrow ID:</span> {fine.borrowRecordId}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/55">Due date:</span> {fmtDate(fine.borrowDueDate)}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/55">Return date:</span> {fmtDate(fine.borrowReturnDate)}
                                                                    </p>
                                                                </>
                                                            ) : damageReportId ? (
                                                                <>
                                                                    <p>
                                                                        <span className="text-white/55">Damage report:</span> #{damageReportId}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/55">Book:</span> {fine.bookTitle || "—"}
                                                                    </p>
                                                                    <p>
                                                                        <span className="text-white/55">Description:</span> {damageDescription || "—"}
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <p className="text-white/60">No linked borrow record or damage report.</p>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                </div>

                                                <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                    <div className="text-xs text-white/60">
                                                        Expanded details are grouped into cards for easier review on smaller screens.
                                                    </div>

                                                    <div className="w-full md:w-auto">
                                                        {status === "active" ? (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 md:w-auto"
                                                                    >
                                                                        How to pay (OTC)
                                                                    </Button>
                                                                </AlertDialogTrigger>

                                                                <AlertDialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-900 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Pay over the counter</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            Online payments are not available. Please pay this fine physically
                                                                            at the library counter.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>

                                                                    <div className="mt-3 space-y-2 text-sm text-white/80">
                                                                        <p>
                                                                            <span className="text-white/60">Fine ID:</span> {fine.id}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-white/60">Amount:</span>{" "}
                                                                            <span className="font-semibold text-amber-200">{peso(amount)}</span>
                                                                        </p>

                                                                        {!damage && overdueDays != null && (
                                                                            <p>
                                                                                <span className="text-white/60">Days:</span>{" "}
                                                                                <span className="font-semibold">{overdueDaysLabel(overdueDays)}</span>
                                                                            </p>
                                                                        )}

                                                                        {fine.bookTitle && (
                                                                            <p>
                                                                                <span className="text-white/60">Book:</span> {fine.bookTitle}
                                                                            </p>
                                                                        )}
                                                                        {fine.borrowRecordId && (
                                                                            <p>
                                                                                <span className="text-white/60">Borrow ID:</span> {fine.borrowRecordId}
                                                                            </p>
                                                                        )}
                                                                        {damageReportId && (
                                                                            <p>
                                                                                <span className="text-white/60">Damage report:</span> #{damageReportId}
                                                                            </p>
                                                                        )}

                                                                        <div className="mt-3 space-y-1 rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/80">
                                                                            <p className="font-semibold text-emerald-200">Steps</p>
                                                                            <ol className="list-decimal space-y-1 pl-5">
                                                                                <li>Go to the library counter.</li>
                                                                                <li>Provide your Fine ID (and/or Borrow ID) to the librarian.</li>
                                                                                <li>Pay the amount shown.</li>
                                                                                <li>
                                                                                    Refresh this page later to see the status update to <b>Paid</b>.
                                                                                </li>
                                                                            </ol>
                                                                        </div>
                                                                    </div>

                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                                                                            Close
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-slate-700 text-white hover:bg-slate-600"
                                                                            onClick={() =>
                                                                                toast.info("Over-the-counter payment", {
                                                                                    description:
                                                                                        "Please proceed to the library counter to pay this fine.",
                                                                                })
                                                                            }
                                                                        >
                                                                            OK
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        ) : status === "paid" ? (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                disabled
                                                                className="w-full border-emerald-400/50 text-emerald-200/90 md:w-auto"
                                                            >
                                                                Fine paid
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                disabled
                                                                className="w-full border-slate-400/50 text-slate-200/90 md:w-auto"
                                                            >
                                                                Fine cancelled
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}