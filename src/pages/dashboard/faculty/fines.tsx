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
    ReceiptText,
    RefreshCcw,
    Loader2,
    Search,
    CheckCircle2,
    AlertTriangle,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMyFines, type FineDTO, type FineStatus } from "@/lib/fines";

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

export default function FacultyFinesPage() {
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
                        console.error(
                            "Failed to load damage reports for faculty fines:",
                            err
                        );
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
            rows = rows.filter(
                (f) => normalizeStatus((f as any).status) === statusFilter
            );
        }

        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter((f) => {
                const anyFine = f as any;
                const haystack = `${f.id} ${f.reason ?? ""} ${f.bookTitle ?? ""} ${f.bookId ?? ""
                    } ${f.damageReportId ?? anyFine.damageReportId ?? ""
                    } ${anyFine.damageDescription ?? ""} ${anyFine.damageType ?? ""} ${anyFine.damageDetails ?? ""
                    }`.toLowerCase();
                return haystack.includes(q);
            });
        }

        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

    function renderStatusBadge(statusRaw: any) {
        const status = normalizeStatus(statusRaw);

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

    return (
        <DashboardLayout title="My Fines">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Fines</h2>
                        <p className="text-xs text-white/70">
                            Review fines linked to your account{" "}
                            <span className="font-semibold">
                                (overdue returns and book damage)
                            </span>
                            .
                        </p>
                        <p className="mt-1 text-[11px] text-emerald-200/90">
                            Payment is <span className="font-semibold">over the counter only</span>.
                            Please go to the library to pay your fines physically. After payment,
                            the librarian will mark your fine as{" "}
                            <span className="font-semibold">Paid</span>.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-white/70">
                    <div className="flex flex-col items-start sm:items-end">
                        <span>
                            Active fines (unpaid):{" "}
                            <span className="font-semibold text-amber-300">
                                {peso(totalActive)}
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
                        <CardTitle>Fine history</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by book, reason, damage, or ID…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            <div className="w-full md:w-[220px]">
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
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

                <CardContent className="overflow-x-auto">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center text-sm text-red-300">
                            {error}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            You have no fines that match your filters.
                            <br />
                            <span className="text-xs opacity-80">
                                If you recently paid a fine, it may take a moment before the
                                status is updated to{" "}
                                <span className="font-semibold">Paid</span>.
                            </span>
                        </div>
                    ) : (
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {filtered.length}{" "}
                                {filtered.length === 1 ? "fine" : "fines"}. Active fines must be
                                paid <span className="font-semibold">over the counter</span> at
                                the library.{" "}
                                <span className="opacity-80">
                                    Days = overdue days for borrow-based fines; damage fines show
                                    “Damage”.
                                </span>
                            </TableCaption>

                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                        Fine ID
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Book / Damage info
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Borrow / Damage
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Status
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        ₱Amount
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Days
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                                        Action
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {filtered.map((fine) => {
                                    const amount = normalizeFine(fine.amount);

                                    const anyFine = fine as any;
                                    const damageReportId: string | undefined =
                                        fine.damageReportId ??
                                        anyFine.damageId ??
                                        anyFine.damageReportId;
                                    const damageDescription: string | undefined =
                                        anyFine.damageDescription ||
                                        anyFine.damageDetails ||
                                        anyFine.damageType;
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

                                    const overdueDays = computeOverdueDays(
                                        fine.borrowDueDate ?? null,
                                        endForDays
                                    );

                                    return (
                                        <TableRow
                                            key={fine.id}
                                            className="border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell className="text-xs opacity-80">
                                                {fine.id}
                                            </TableCell>

                                            <TableCell className="text-sm">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium">{primaryLabel}</span>

                                                    {reasonText && reasonText !== primaryLabel && (
                                                        <span className="text-xs text-white/70">
                                                            {reasonText}
                                                        </span>
                                                    )}

                                                    {damage && (
                                                        <span className="text-[11px] text-rose-200/90 flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            <span className="font-semibold">Damage fine</span>
                                                            {damageReportId && (
                                                                <span className="opacity-90">
                                                                    · Report #{damageReportId}
                                                                </span>
                                                            )}
                                                            {damageDescription && (
                                                                <span className="opacity-90">
                                                                    · {damageDescription}
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-xs opacity-80">
                                                {fine.borrowRecordId ? (
                                                    <span>
                                                        Borrow #{fine.borrowRecordId}
                                                        {fine.borrowDueDate && (
                                                            <> · Due {fmtDate(fine.borrowDueDate)}</>
                                                        )}
                                                        {fine.borrowReturnDate && (
                                                            <> · Returned {fmtDate(fine.borrowReturnDate)}</>
                                                        )}
                                                    </span>
                                                ) : damageReportId ? (
                                                    <span>Damage report #{damageReportId}</span>
                                                ) : (
                                                    <span className="opacity-60">—</span>
                                                )}
                                            </TableCell>

                                            <TableCell>{renderStatusBadge(status)}</TableCell>

                                            <TableCell className="text-sm">
                                                {peso(amount)}
                                            </TableCell>

                                            <TableCell className="text-xs opacity-80">
                                                {damage ? (
                                                    <span className="inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                                                        Damage
                                                    </span>
                                                ) : (
                                                    overdueDaysLabel(overdueDays)
                                                )}
                                            </TableCell>

                                            <TableCell className="text-right space-y-1">
                                                {status === "active" ? (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full md:w-auto"
                                                            >
                                                                How to pay (OTC)
                                                            </Button>
                                                        </AlertDialogTrigger>

                                                        <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Pay over the counter
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription className="text-white/70">
                                                                    Online payments are not available. Please pay
                                                                    this fine physically at the library counter.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>

                                                            <div className="mt-3 text-sm text-white/80 space-y-2">
                                                                <p>
                                                                    <span className="text-white/60">
                                                                        Fine ID:
                                                                    </span>{" "}
                                                                    {fine.id}
                                                                </p>
                                                                <p>
                                                                    <span className="text-white/60">
                                                                        Amount:
                                                                    </span>{" "}
                                                                    <span className="font-semibold text-amber-200">
                                                                        {peso(amount)}
                                                                    </span>
                                                                </p>

                                                                {!damage && overdueDays != null && (
                                                                    <p>
                                                                        <span className="text-white/60">
                                                                            Days:
                                                                        </span>{" "}
                                                                        <span className="font-semibold">
                                                                            {overdueDaysLabel(overdueDays)}
                                                                        </span>
                                                                    </p>
                                                                )}

                                                                {fine.bookTitle && (
                                                                    <p>
                                                                        <span className="text-white/60">
                                                                            Book:
                                                                        </span>{" "}
                                                                        {fine.bookTitle}
                                                                    </p>
                                                                )}
                                                                {fine.borrowRecordId && (
                                                                    <p>
                                                                        <span className="text-white/60">
                                                                            Borrow ID:
                                                                        </span>{" "}
                                                                        {fine.borrowRecordId}
                                                                    </p>
                                                                )}
                                                                {damageReportId && (
                                                                    <p>
                                                                        <span className="text-white/60">
                                                                            Damage report:
                                                                        </span>{" "}
                                                                        #{damageReportId}
                                                                    </p>
                                                                )}

                                                                <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/80 space-y-1">
                                                                    <p className="font-semibold text-emerald-200">
                                                                        Steps
                                                                    </p>
                                                                    <ol className="list-decimal pl-5 space-y-1">
                                                                        <li>Go to the library counter.</li>
                                                                        <li>
                                                                            Provide your Fine ID (and/or Borrow ID) to
                                                                            the librarian.
                                                                        </li>
                                                                        <li>Pay the amount shown.</li>
                                                                        <li>
                                                                            Refresh this page later to see the status
                                                                            update to <b>Paid</b>.
                                                                        </li>
                                                                    </ol>
                                                                </div>
                                                            </div>

                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                                                                    Close
                                                                </AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    className="bg-slate-700 hover:bg-slate-600 text-white"
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
                                                        className="border-emerald-400/50 text-emerald-200/90 w-full md:w-auto"
                                                    >
                                                        Fine paid
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        disabled
                                                        className="border-slate-400/50 text-slate-200/90 w-full md:w-auto"
                                                    >
                                                        Fine cancelled
                                                    </Button>
                                                )}
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
