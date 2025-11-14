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
    Loader2,
    RefreshCcw,
    Search,
    ShieldAlert,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/api/auth/route";

// ✅ shadcn AlertDialog for destructive actions (delete)
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

/* ----------------------------- Types ----------------------------- */

type DamageStatus = "pending" | "assessed" | "paid";
type Severity = "minor" | "moderate" | "major";

export type DamageReportDTO = {
    id: string;
    userId: string | number;
    studentEmail: string | null;
    studentId: string | null;
    studentName?: string | null;
    bookId: string | number;
    bookTitle: string | null;

    // Core damage info
    damageType: string; // e.g., Torn Pages, Water Damage
    severity: Severity; // minor | moderate | major
    status: DamageStatus; // pending | assessed | paid
    fee?: number; // optional display
    notes?: string | null; // optional display
    reportedAt?: string; // optional display

    // Uploaded pictures
    photoUrl?: string | null; // legacy single URL
    photoUrls?: string[] | null; // new multi-image support
};

type JsonOk<T> = { ok: true } & T;

/* ------------------------ Helpers (local) ------------------------ */

/**
 * Format date as YYYY-MM-DD in *local* timezone
 * to avoid off-by-one issues from UTC conversions.
 */
function fmtDate(d?: string | null) {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        // en-CA -> 2025-11-13 (YYYY-MM-DD)
        return date.toLocaleDateString("en-CA");
    } catch {
        return d;
    }
}

function peso(n: number | string | undefined) {
    if (n === undefined) return "—";
    const num = Number(n) || 0;
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
    }).format(num);
}

function StatusBadge({ status }: { status: DamageStatus }) {
    const map: Record<DamageStatus, string> = {
        pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
        assessed: "bg-blue-500/15 text-blue-300 border-blue-500/20",
        paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    };
    const label = status[0].toUpperCase() + status.slice(1);
    return (
        <Badge variant="outline" className={map[status]}>
            {label}
        </Badge>
    );
}

function SeverityBadge({ severity }: { severity: Severity }) {
    const map: Record<Severity, string> = {
        minor: "bg-sky-500/15 text-sky-300 border-sky-500/20",
        moderate: "bg-orange-500/15 text-orange-300 border-orange-500/20",
        major: "bg-red-500/15 text-red-300 border-red-500/20",
    };
    const label = severity[0].toUpperCase() + severity.slice(1);
    return (
        <Badge variant="outline" className={map[severity]}>
            {label}
        </Badge>
    );
}

function formatDamageInfo(r: DamageReportDTO) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.damageType}</span>
                <SeverityBadge severity={r.severity} />
                <StatusBadge status={r.status} />
            </div>
            <div className="text-xs text-white/70">
                {r.fee !== undefined && (
                    <span className="mr-3">Fee: {peso(r.fee)}</span>
                )}
                {r.reportedAt && (
                    <span className="mr-3">
                        Reported: {fmtDate(r.reportedAt)}
                    </span>
                )}
                {r.notes && <span className="block truncate">Notes: {r.notes}</span>}
            </div>
        </div>
    );
}

/** Resolves image URL.
 * - If backend stores absolute S3 URL -> return as-is
 * - If legacy relative path (/uploads/..) -> prefix API_BASE
 */
function toAbsoluteUrl(url?: string | null) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url; // S3/CloudFront/etc.
    return `${API_BASE}${url}`;
}

// Light client-side fetcher (kept local so we don't add new lib files)
async function fetchDamageReports(): Promise<DamageReportDTO[]> {
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
        reports: DamageReportDTO[];
    }>;
    return data.reports ?? [];
}

/** PATCH damage report (e.g. update status) */
async function patchDamageReport(
    id: string | number,
    patch: Partial<Pick<DamageReportDTO, "status" | "fee" | "notes" | "severity">>
): Promise<DamageReportDTO> {
    let resp: Response;
    try {
        resp = await fetch(
            `${API_BASE}/api/damage-reports/${encodeURIComponent(String(id))}`,
            {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            }
        );
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
        report: DamageReportDTO;
    }>;
    return data.report;
}

/** DELETE damage report */
async function deleteDamageReport(id: string | number): Promise<void> {
    let resp: Response;
    try {
        resp = await fetch(
            `${API_BASE}/api/damage-reports/${encodeURIComponent(String(id))}`,
            {
                method: "DELETE",
                credentials: "include",
            }
        );
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

    // If backend returns JSON we just ignore it here
}

/* --------------------------- Page Component --------------------------- */

export default function LibrarianDamageReportsPage() {
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [rows, setRows] = React.useState<DamageReportDTO[]>([]);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<"all" | DamageStatus>("all");

    // Per-row action states
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchDamageReports();
            setRows(data);
        } catch (err: any) {
            const msg = err?.message || "Failed to load damage reports.";
            setError(msg);
            toast.error("Failed to load", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    }

    async function handleStatusStep(report: DamageReportDTO) {
        // pending -> assessed -> paid
        let next: DamageStatus | null = null;
        if (report.status === "pending") next = "assessed";
        else if (report.status === "assessed") next = "paid";

        if (!next || next === report.status) return;

        const idStr = String(report.id);
        setUpdatingId(idStr);

        // Optimistic UI update
        const prevRows = rows;
        setRows((current) =>
            current.map((r) =>
                r.id === report.id ? { ...r, status: next as DamageStatus } : r
            )
        );

        try {
            const updated = await patchDamageReport(report.id, { status: next });
            setRows((current) =>
                current.map((r) => (r.id === updated.id ? updated : r))
            );
            toast.success("Status updated", {
                description: `Report #${updated.id} is now ${updated.status}.`,
            });
        } catch (err: any) {
            setRows(prevRows);
            const msg = err?.message || "Failed to update status.";
            toast.error("Update failed", { description: msg });
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleDelete(report: DamageReportDTO) {
        const idStr = String(report.id);
        setDeletingId(idStr);

        const previous = rows;
        setRows((current) => current.filter((r) => r.id !== report.id));

        try {
            await deleteDamageReport(report.id);
            toast.success("Damage report deleted", {
                description: `Report #${report.id} has been removed.`,
            });
        } catch (err: any) {
            setRows(previous);
            const msg = err?.message || "Failed to delete damage report.";
            toast.error("Delete failed", { description: msg });
        } finally {
            setDeletingId(null);
        }
    }

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = rows;

        if (statusFilter !== "all") {
            list = list.filter((r) => r.status === statusFilter);
        }
        if (!q) return list;

        return list.filter((r) => {
            const student =
                (r.studentEmail || "") +
                " " +
                (r.studentId || "") +
                " " +
                (r.studentName || "") +
                " " +
                String(r.userId || "");
            const book = (r.bookTitle || "") + " " + String(r.bookId || "");
            const damage =
                (r.damageType || "") +
                " " +
                (r.severity || "") +
                " " +
                (r.status || "");
            const notes = r.notes || "";
            return (
                String(r.id).includes(q) ||
                student.toLowerCase().includes(q) ||
                book.toLowerCase().includes(q) ||
                damage.toLowerCase().includes(q) ||
                notes.toLowerCase().includes(q)
            );
        });
    }, [rows, statusFilter, search]);

    return (
        <DashboardLayout title="Damage Reports">
            {/* Header: vertical on mobile, horizontal on desktop */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-start gap-2">
                    <ShieldAlert className="h-5 w-5 mt-0.5 text-white/70" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">
                            Book Damage Reports
                        </h2>
                        <p className="text-xs text-white/70">
                            Track reported damages with photos and resolve their status.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by ID, user, book, info…"
                            className="pl-9 bg-slate-900/70 border-white/20 text-white"
                        />
                    </div>

                    <div className="w-full sm:w-44">
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as "all" | DamageStatus)}
                        >
                            <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="assessed">Assessed</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                        </Select>
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
                        <CardTitle>Damage reports</CardTitle>
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
                            No damage reports found.
                        </div>
                    ) : (
                        <>
                            {/* Desktop: Table (horizontal layout) */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableCaption className="text-xs text-white/60">
                                        Showing {filtered.length}{" "}
                                        {filtered.length === 1 ? "entry" : "entries"}.
                                    </TableCaption>
                                    <TableHeader>
                                        <TableRow className="border-white/10">
                                            <TableHead className="w-[90px] text-xs font-semibold text-white/70">
                                                Damage Report ID
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Student Email (or ID)
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Book Title (or ID)
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Damage Information
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Uploaded Picture
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70 text-right">
                                                Actions
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((r) => {
                                            const student =
                                                r.studentEmail ||
                                                r.studentId ||
                                                r.studentName ||
                                                `User #${r.userId}`;
                                            const book =
                                                r.bookTitle || `Book #${r.bookId}`;
                                            const primaryPhoto =
                                                r.photoUrl ||
                                                (r.photoUrls && r.photoUrls[0]) ||
                                                undefined;
                                            const abs = toAbsoluteUrl(primaryPhoto);
                                            const totalPhotos =
                                                (r.photoUrls?.length || 0) ||
                                                (r.photoUrl ? 1 : 0);

                                            const isRowUpdating =
                                                updatingId === String(r.id);
                                            const isRowDeleting =
                                                deletingId === String(r.id);
                                            const disableActions =
                                                isRowUpdating || isRowDeleting;

                                            let statusActionLabel: string | null = null;
                                            if (r.status === "pending") {
                                                statusActionLabel = "Mark assessed";
                                            } else if (r.status === "assessed") {
                                                statusActionLabel = "Mark paid";
                                            }

                                            return (
                                                <TableRow
                                                    key={r.id}
                                                    className="border-white/5 hover:bg-white/5 transition-colors"
                                                >
                                                    <TableCell className="text-xs opacity-80">
                                                        {r.id}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {student}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {book}
                                                    </TableCell>
                                                    <TableCell className="text-sm align-top">
                                                        {formatDamageInfo(r)}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {abs ? (
                                                            <div className="flex flex-col items-start gap-1">
                                                                <a
                                                                    href={abs}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-block"
                                                                >
                                                                    <img
                                                                        src={abs}
                                                                        alt={`Damage proof #${r.id}`}
                                                                        className="h-14 w-14 object-cover rounded-md border border-white/10"
                                                                        loading="lazy"
                                                                    />
                                                                </a>
                                                                {totalPhotos > 1 && (
                                                                    <span className="text-[10px] text-white/60">
                                                                        +{totalPhotos - 1} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="opacity-60">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs">
                                                        <div className="inline-flex items-center justify-end gap-1">
                                                            {statusActionLabel && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 px-2 border-blue-400/70 text-blue-100 hover:bg-blue-500/15"
                                                                    onClick={() =>
                                                                        handleStatusStep(r)
                                                                    }
                                                                    disabled={disableActions}
                                                                >
                                                                    {isRowUpdating ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        statusActionLabel
                                                                    )}
                                                                </Button>
                                                            )}

                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-7 w-7 text-red-300 hover:text-red-100 hover:bg-red-500/15"
                                                                        disabled={disableActions}
                                                                    >
                                                                        {isRowDeleting ? (
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        )}
                                                                        <span className="sr-only">
                                                                            Delete damage report
                                                                        </span>
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>
                                                                            Delete report #
                                                                            {r.id}?
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            This action cannot be
                                                                            undone. The damage report
                                                                            will be permanently
                                                                            removed from the system.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                                                                            Cancel
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-red-600 hover:bg-red-700 text-white"
                                                                            onClick={() =>
                                                                                handleDelete(r)
                                                                            }
                                                                        >
                                                                            Delete report
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile: Stacked cards (vertical layout) */}
                            <div className="md:hidden space-y-3">
                                {filtered.map((r) => {
                                    const student =
                                        r.studentEmail ||
                                        r.studentId ||
                                        r.studentName ||
                                        `User #${r.userId}`;
                                    const book =
                                        r.bookTitle || `Book #${r.bookId}`;
                                    const primaryPhoto =
                                        r.photoUrl ||
                                        (r.photoUrls && r.photoUrls[0]) ||
                                        undefined;
                                    const abs = toAbsoluteUrl(primaryPhoto);
                                    const totalPhotos =
                                        (r.photoUrls?.length || 0) ||
                                        (r.photoUrl ? 1 : 0);

                                    const isRowUpdating =
                                        updatingId === String(r.id);
                                    const isRowDeleting =
                                        deletingId === String(r.id);
                                    const disableActions =
                                        isRowUpdating || isRowDeleting;

                                    let statusActionLabel: string | null = null;
                                    if (r.status === "pending") {
                                        statusActionLabel = "Mark assessed";
                                    } else if (r.status === "assessed") {
                                        statusActionLabel = "Mark paid";
                                    }

                                    return (
                                        <div
                                            key={r.id}
                                            className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs text-white/60">
                                                    Damage Report ID
                                                </div>
                                                <div className="text-xs font-semibold">
                                                    {r.id}
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Student Email (or ID)
                                                </div>
                                                <div className="text-sm">{student}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Book Title (or ID)
                                                </div>
                                                <div className="text-sm">{book}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Damage Information
                                                </div>
                                                <div className="text-sm">
                                                    {formatDamageInfo(r)}
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">
                                                    Uploaded Picture
                                                </div>
                                                {abs ? (
                                                    <div className="flex flex-col items-start gap-1">
                                                        <a
                                                            href={abs}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-block"
                                                        >
                                                            <img
                                                                src={abs}
                                                                alt={`Damage proof #${r.id}`}
                                                                className="h-24 w-24 object-cover rounded-md border border-white/10"
                                                                loading="lazy"
                                                            />
                                                        </a>
                                                        {totalPhotos > 1 && (
                                                            <span className="text-[10px] text-white/60">
                                                                +{totalPhotos - 1} more
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm opacity-60">
                                                        —
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions (stacked on mobile) */}
                                            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                                {statusActionLabel && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                                                        onClick={() => handleStatusStep(r)}
                                                        disabled={disableActions}
                                                    >
                                                        {isRowUpdating ? (
                                                            <span className="inline-flex items-center gap-2">
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                Updating…
                                                            </span>
                                                        ) : (
                                                            statusActionLabel
                                                        )}
                                                    </Button>
                                                )}

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full sm:w-auto border-red-500/60 text-red-300 hover:bg-red-500/15"
                                                            disabled={disableActions}
                                                        >
                                                            {isRowDeleting ? (
                                                                <span className="inline-flex items-center gap-2">
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    Deleting…
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                                    Delete
                                                                </>
                                                            )}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                                Delete report #{r.id}?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription className="text-white/70">
                                                                This action cannot be undone. The
                                                                damage report will be permanently
                                                                removed from the system.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                                                                Cancel
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                className="bg-red-600 hover:bg-red-700 text-white"
                                                                onClick={() => handleDelete(r)}
                                                            >
                                                                Delete report
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
