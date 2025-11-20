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

// ✅ shadcn Dialog for image preview & assessment
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// ✅ Reuse shared damage report types from lib
import type {
    DamageReportDTO,
    DamageStatus,
    DamageSeverity,
} from "@/lib/damageReports";

/* ----------------------------- Types ----------------------------- */

// Local alias for clarity inside this page
type Severity = DamageSeverity;

// Local row type: we extend the shared DTO with optional legacy `photoUrl`
type DamageReportRow = DamageReportDTO & {
    photoUrl?: string | null;
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

function formatDamageInfo(r: DamageReportRow) {
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

/**
 * Simple suggested fine policy (you can later move this to backend/config):
 * - minor: ₱50
 * - moderate: ₱150
 * - major: ₱300
 */
function suggestedFineFromSeverity(severity: Severity): number {
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

// Light client-side fetcher (kept local so we don't add new lib functions)
async function fetchDamageReports(): Promise<DamageReportRow[]> {
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

/** PATCH damage report (e.g. update status, fee, severity, notes) */
async function patchDamageReport(
    id: string | number,
    patch: Partial<
        Pick<DamageReportRow, "status" | "fee" | "notes" | "severity">
    >
): Promise<DamageReportRow> {
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
        report: DamageReportRow;
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

    const [rows, setRows] = React.useState<DamageReportRow[]>([]);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<"all" | DamageStatus>(
        "all"
    );

    // Per-row action states
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);

    // Image preview dialog state
    const [photoDialogOpen, setPhotoDialogOpen] = React.useState(false);
    const [photoDialogImages, setPhotoDialogImages] = React.useState<string[]>([]);
    const [photoDialogIndex, setPhotoDialogIndex] = React.useState(0);

    // Assessment dialog state
    const [assessOpen, setAssessOpen] = React.useState(false);
    const [assessReport, setAssessReport] = React.useState<DamageReportRow | null>(
        null
    );
    const [assessSeverity, setAssessSeverity] = React.useState<Severity>("minor");
    const [assessStatus, setAssessStatus] =
        React.useState<DamageStatus>("pending");
    const [assessFee, setAssessFee] = React.useState<string>("");
    const [assessNotes, setAssessNotes] = React.useState<string>("");
    const [assessSaving, setAssessSaving] = React.useState(false);
    const [feeEdited, setFeeEdited] = React.useState(false);

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
        void load();
    }, [load]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    }

    async function handleStatusStep(report: DamageReportRow) {
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

    async function handleDelete(report: DamageReportRow) {
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

    /* ---------------------- Image preview helpers ---------------------- */

    function openPhotoDialog(images: string[], startIndex = 0) {
        if (!images || !images.length) return;
        setPhotoDialogImages(images);
        setPhotoDialogIndex(
            Math.min(Math.max(startIndex, 0), images.length - 1)
        );
        setPhotoDialogOpen(true);
    }

    const currentPhotoUrl =
        photoDialogImages.length > 0
            ? photoDialogImages[
            Math.min(
                Math.max(photoDialogIndex, 0),
                photoDialogImages.length - 1
            )
            ]
            : "";

    function showPrevPhoto() {
        setPhotoDialogIndex((idx) => {
            if (!photoDialogImages.length) return 0;
            return (idx - 1 + photoDialogImages.length) % photoDialogImages.length;
        });
    }

    function showNextPhoto() {
        setPhotoDialogIndex((idx) => {
            if (!photoDialogImages.length) return 0;
            return (idx + 1) % photoDialogImages.length;
        });
    }

    /* ---------------------- Assessment dialog helpers ---------------------- */

    function openAssessDialog(report: DamageReportRow) {
        setAssessReport(report);

        const initialSeverity = report.severity ?? "minor";
        setAssessSeverity(initialSeverity);

        const defaultStatus: DamageStatus =
            report.status === "pending" ? "assessed" : report.status;
        setAssessStatus(defaultStatus);

        const baseFine =
            typeof report.fee === "number"
                ? report.fee
                : suggestedFineFromSeverity(initialSeverity);
        setAssessFee(String(baseFine));
        setAssessNotes(report.notes ?? "");
        setFeeEdited(false);
        setAssessOpen(true);
    }

    function closeAssessDialog() {
        if (assessSaving) return;
        setAssessOpen(false);
        setAssessReport(null);
        setAssessNotes("");
        setAssessFee("");
        setFeeEdited(false);
    }

    async function handleAssessSave() {
        if (!assessReport) return;

        const trimmed = assessFee.trim();
        const parsed = trimmed === "" ? 0 : Number(trimmed);

        if (!Number.isFinite(parsed) || parsed < 0) {
            toast.warning("Invalid fine amount", {
                description: "Fine must be a number greater than or equal to 0.",
            });
            return;
        }

        setAssessSaving(true);
        const prevRows = rows;

        // Optimistic update
        setRows((current) =>
            current.map((r) =>
                r.id === assessReport.id
                    ? {
                        ...r,
                        severity: assessSeverity,
                        status: assessStatus,
                        fee: parsed,
                        notes: assessNotes.trim() || null,
                    }
                    : r
            )
        );

        try {
            const updated = await patchDamageReport(assessReport.id, {
                severity: assessSeverity,
                status: assessStatus,
                fee: parsed,
                notes: assessNotes.trim() || null,
            });

            setRows((current) =>
                current.map((r) => (r.id === updated.id ? updated : r))
            );

            toast.success("Assessment saved", {
                description: `Report #${updated.id} updated (status: ${updated.status}, fine: ${peso(
                    updated.fee
                )}).`,
            });
            closeAssessDialog();
        } catch (err: any) {
            setRows(prevRows);
            const msg = err?.message || "Failed to save assessment.";
            toast.error("Assessment failed", { description: msg });
        } finally {
            setAssessSaving(false);
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
                            Track reported damages with photos, assess fines, and resolve
                            statuses.
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
                                            const book = r.bookTitle || `Book #${r.bookId}`;

                                            const rawPhotos: string[] = (
                                                r.photoUrls && r.photoUrls.length
                                                    ? r.photoUrls
                                                    : r.photoUrl
                                                        ? [r.photoUrl]
                                                        : []
                                            ).filter(Boolean) as string[];

                                            const absPhotos = rawPhotos
                                                .map((url) => toAbsoluteUrl(url))
                                                .filter(Boolean);
                                            const primaryAbs = absPhotos[0] || "";
                                            const totalPhotos = absPhotos.length;

                                            const isRowUpdating = updatingId === String(r.id);
                                            const isRowDeleting = deletingId === String(r.id);
                                            const disableActions = isRowUpdating || isRowDeleting;

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
                                                        {primaryAbs ? (
                                                            <div className="flex flex-col items-start gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openPhotoDialog(absPhotos, 0)}
                                                                    className="cursor-pointer inline-block"
                                                                >
                                                                    <img
                                                                        src={primaryAbs}
                                                                        alt={`Damage proof #${r.id}`}
                                                                        className="h-14 w-14 object-cover rounded-md border border-white/10"
                                                                        loading="lazy"
                                                                    />
                                                                </button>
                                                                {totalPhotos > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openPhotoDialog(absPhotos, 0)}
                                                                        className="text-[10px] text-white/60 hover:text-white/90 underline-offset-2 hover:underline"
                                                                    >
                                                                        +{totalPhotos - 1} more
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="opacity-60">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs">
                                                        <div className="inline-flex items-center justify-end gap-1">
                                                            {/* Assess button */}
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 px-2 border-amber-400/70 text-amber-100 hover:bg-amber-500/15"
                                                                onClick={() => openAssessDialog(r)}
                                                                disabled={disableActions}
                                                            >
                                                                Assess &amp; set fine
                                                            </Button>

                                                            {/* Quick status step (optional) */}
                                                            {statusActionLabel && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 px-2 border-blue-400/70 text-blue-100 hover:bg-blue-500/15"
                                                                    onClick={() => handleStatusStep(r)}
                                                                    disabled={disableActions}
                                                                >
                                                                    {isRowUpdating ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        statusActionLabel
                                                                    )}
                                                                </Button>
                                                            )}

                                                            {/* Delete */}
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
                                                                            Delete report #{r.id}?
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            This action cannot be undone. The damage
                                                                            report will be permanently removed from
                                                                            the system.
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
                                    const book = r.bookTitle || `Book #${r.bookId}`;

                                    const rawPhotos: string[] = (
                                        r.photoUrls && r.photoUrls.length
                                            ? r.photoUrls
                                            : r.photoUrl
                                                ? [r.photoUrl]
                                                : []
                                    ).filter(Boolean) as string[];

                                    const absPhotos = rawPhotos
                                        .map((url) => toAbsoluteUrl(url))
                                        .filter(Boolean);
                                    const primaryAbs = absPhotos[0] || "";
                                    const totalPhotos = absPhotos.length;

                                    const isRowUpdating = updatingId === String(r.id);
                                    const isRowDeleting = deletingId === String(r.id);
                                    const disableActions = isRowUpdating || isRowDeleting;

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
                                                {primaryAbs ? (
                                                    <div className="flex flex-col items-start gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openPhotoDialog(absPhotos, 0)}
                                                            className="cursor-pointer inline-block"
                                                        >
                                                            <img
                                                                src={primaryAbs}
                                                                alt={`Damage proof #${r.id}`}
                                                                className="h-24 w-24 object-cover rounded-md border border-white/10"
                                                                loading="lazy"
                                                            />
                                                        </button>
                                                        {totalPhotos > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openPhotoDialog(absPhotos, 0)}
                                                                className="text-[10px] text-white/60 hover:text-white/90 underline-offset-2 hover:underline"
                                                            >
                                                                +{totalPhotos - 1} more
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm opacity-60">—</div>
                                                )}
                                            </div>

                                            {/* Actions (stacked on mobile) */}
                                            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
                                                    onClick={() => openAssessDialog(r)}
                                                    disabled={disableActions}
                                                >
                                                    Assess &amp; set fine
                                                </Button>

                                                {statusActionLabel && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-full sm:w-auto border-blue-400/70 text-blue-100 hover:bg-blue-500/15"
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
                                                                This action cannot be undone. The damage report
                                                                will be permanently removed from the system.
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

            {/* Image preview dialog */}
            <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
                <DialogContent className="max-w-3xl bg-slate-900 text-white border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            Damage photo preview
                            {photoDialogImages.length > 1
                                ? ` (${photoDialogIndex + 1} of ${photoDialogImages.length
                                })`
                                : ""}
                        </DialogTitle>
                    </DialogHeader>
                    {currentPhotoUrl ? (
                        <div className="mt-2 flex flex-col gap-4">
                            <div className="relative max-h-[70vh] overflow-hidden rounded-lg border border-white/20 bg-black/40">
                                <img
                                    src={currentPhotoUrl}
                                    alt="Damage proof"
                                    className="max-h-[70vh] w-full object-contain"
                                />
                            </div>
                            {photoDialogImages.length > 1 && (
                                <div className="flex items-center justify-between text-xs text-white/70">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-white/20 text-white/80 hover:bg-white/10"
                                        onClick={showPrevPhoto}
                                    >
                                        Previous
                                    </Button>
                                    <span>
                                        Image {photoDialogIndex + 1} of {photoDialogImages.length}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-white/20 text-white/80 hover:bg-white/10"
                                        onClick={showNextPhoto}
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-white/60">No image to preview.</p>
                    )}
                </DialogContent>
            </Dialog>

            {/* Assessment dialog */}
            <Dialog
                open={assessOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeAssessDialog();
                    } else if (assessReport) {
                        // keep as-is if reopened while state still there
                        setAssessOpen(true);
                    }
                }}
            >
                <DialogContent className="max-w-2xl bg-slate-900 text-white border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            Assess damage report
                            {assessReport ? ` #${assessReport.id}` : ""}
                        </DialogTitle>
                    </DialogHeader>

                    {assessReport ? (
                        <div className="mt-3 space-y-4 text-sm">
                            {/* Context */}
                            <div className="rounded-md border border-white/10 bg-slate-900/70 px-3 py-2">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                                    <div>
                                        <div className="text-xs text-white/60">Student</div>
                                        <div className="text-sm font-medium">
                                            {assessReport.studentName ||
                                                assessReport.studentEmail ||
                                                assessReport.studentId ||
                                                `User #${assessReport.userId}`}
                                        </div>
                                    </div>
                                    <div className="mt-2 md:mt-0">
                                        <div className="text-xs text-white/60">Book</div>
                                        <div className="text-sm font-medium">
                                            {assessReport.bookTitle || `Book #${assessReport.bookId}`}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-white/70">
                                    <div>Damage: {assessReport.damageType}</div>
                                    {assessReport.reportedAt && (
                                        <div>Reported: {fmtDate(assessReport.reportedAt)}</div>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Left: severity + status + notes */}
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">
                                            Severity
                                        </label>
                                        <Select
                                            value={assessSeverity}
                                            onValueChange={(v) => {
                                                const sev = v as Severity;
                                                setAssessSeverity(sev);
                                                if (!feeEdited) {
                                                    setAssessFee(
                                                        String(suggestedFineFromSeverity(sev))
                                                    );
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                                <SelectItem value="minor">
                                                    Minor (cosmetic)
                                                </SelectItem>
                                                <SelectItem value="moderate">
                                                    Moderate (affects reading)
                                                </SelectItem>
                                                <SelectItem value="major">
                                                    Major (pages missing / severe)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">
                                            Status
                                        </label>
                                        <Select
                                            value={assessStatus}
                                            onValueChange={(v) =>
                                                setAssessStatus(v as DamageStatus)
                                            }
                                        >
                                            <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                                <SelectItem value="pending">
                                                    Pending (not yet assessed)
                                                </SelectItem>
                                                <SelectItem value="assessed">
                                                    Assessed (awaiting payment)
                                                </SelectItem>
                                                <SelectItem value="paid">
                                                    Paid (settled by student)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">
                                            Notes for record{" "}
                                            <span className="text-white/40">(optional)</span>
                                        </label>
                                        <textarea
                                            value={assessNotes}
                                            onChange={(e) => setAssessNotes(e.target.value)}
                                            rows={4}
                                            className="w-full rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                                            placeholder="Example: Damage existed before this borrower; no fee charged. Or: Student admitted spilling water on pages."
                                        />
                                    </div>
                                </div>

                                {/* Right: fine */}
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80 flex items-center justify-between gap-2">
                                            Assessed fine (₱)
                                            <span className="text-[10px] text-white/50">
                                                Set to 0 if borrower is not liable
                                            </span>
                                        </label>
                                        <Input
                                            value={assessFee}
                                            onChange={(e) => {
                                                setAssessFee(e.target.value);
                                                setFeeEdited(true);
                                            }}
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            className="bg-slate-900/70 border-white/20 text-white"
                                        />
                                    </div>

                                    <div className="rounded-md border border-dashed border-white/15 bg-slate-900/40 px-3 py-2 text-[11px] text-white/70 space-y-1.5">
                                        <div>
                                            Suggested fine for{" "}
                                            <span className="font-semibold">
                                                {assessSeverity.charAt(0).toUpperCase() +
                                                    assessSeverity.slice(1)}
                                            </span>{" "}
                                            damage:{" "}
                                            <span className="font-semibold text-amber-200">
                                                {peso(suggestedFineFromSeverity(assessSeverity))}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="text-[11px] text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                                            onClick={() => {
                                                setAssessFee(
                                                    String(suggestedFineFromSeverity(assessSeverity))
                                                );
                                                setFeeEdited(false);
                                            }}
                                        >
                                            Use suggested fine
                                        </button>
                                        <p>
                                            You can override this amount based on library policy.
                                        </p>
                                        <p>
                                            If the book was already damaged when borrowed, or
                                            another borrower is responsible, set the fine to{" "}
                                            <span className="font-semibold">0</span> and explain in
                                            the notes.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-white/20 text-white hover:bg-black/20"
                                    disabled={assessSaving}
                                    onClick={closeAssessDialog}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    className="bg-amber-600 hover:bg-amber-700 text-white"
                                    disabled={assessSaving}
                                    onClick={() => void handleAssessSave()}
                                >
                                    {assessSaving ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving…
                                        </span>
                                    ) : (
                                        "Save assessment"
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-white/60">No report selected.</p>
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
