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
import { Loader2, RefreshCcw, Search, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/api/auth/route";

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

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { DamageReportDTO, DamageStatus, DamageSeverity } from "@/lib/damageReports";
import { fetchDamageReports, updateDamageReport, deleteDamageReport } from "@/lib/damageReports";

/* ----------------------------- Types ----------------------------- */

type Severity = DamageSeverity;

type DamageReportRow = DamageReportDTO & {
    photoUrl?: string | null;
    fullName?: string | null;
    full_name?: string | null;

    // legacy/alt keys
    liableFullName?: string | null;
    liable_full_name?: string | null;
};

/* ------------------------ Helpers (local) ------------------------ */

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

function peso(n: number | string | undefined) {
    if (n === undefined) return "—";
    const num = Number(n) || 0;
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
    }).format(num);
}

function StatusBadge({ status, archived }: { status: DamageStatus; archived?: boolean }) {
    const map: Record<DamageStatus, string> = {
        pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
        assessed: "bg-blue-500/15 text-blue-300 border-blue-500/20",
        paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    };
    const label = status[0].toUpperCase() + status.slice(1);
    return (
        <div className="inline-flex items-center gap-2">
            <Badge variant="outline" className={map[status]}>
                {label}
            </Badge>
            {archived ? (
                <Badge
                    variant="outline"
                    className="bg-white/5 text-white/70 border-white/10"
                    title="Moved to paid/archive record"
                >
                    Archived
                </Badge>
            ) : null}
        </div>
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

function getReportedByName(r: DamageReportRow): string {
    const anyR = r as any;
    const name =
        (r.studentName ?? null) ||
        (r.fullName ?? null) ||
        (anyR.studentName ?? null) ||
        (anyR.fullName ?? null) ||
        (anyR.full_name ?? null);

    if (name && String(name).trim()) return String(name).trim();

    return (
        r.studentEmail ||
        r.studentId ||
        (anyR.student_email as string | undefined) ||
        (anyR.student_id as string | undefined) ||
        `User #${r.userId}`
    );
}

function getLiableName(r: DamageReportRow): string {
    const anyR = r as any;

    const liableId =
        (r.liableUserId ?? null) ||
        (anyR.liableUserId ?? null) ||
        (anyR.liable_user_id ?? null);

    if (!liableId) return "—";

    const name =
        (r.liableStudentName ?? null) ||
        (anyR.liableStudentName ?? null) ||
        (r.liableFullName ?? null) ||
        (anyR.liableFullName ?? null) ||
        (anyR.liable_full_name ?? null);

    if (name && String(name).trim()) return String(name).trim();

    return (
        r.liableStudentEmail ||
        r.liableStudentId ||
        (anyR.liable_email as string | undefined) ||
        (anyR.liable_student_id as string | undefined) ||
        `User #${liableId}`
    );
}

function formatDamageInfo(r: DamageReportRow) {
    const paidLabel = r.paidAt ? fmtDate(r.paidAt) : "—";
    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.damageType}</span>
                <SeverityBadge severity={r.severity} />
                <StatusBadge status={r.status} archived={r.archived} />
            </div>

            <div className="text-xs text-white/70">
                {r.fee !== undefined && <span className="mr-3">Fine: {peso(r.fee)}</span>}
                {r.reportedAt && <span className="mr-3">Reported: {fmtDate(r.reportedAt)}</span>}
                {(r.status === "paid" || r.archived) && (
                    <span className="mr-3">Paid: {paidLabel}</span>
                )}
                {r.notes && <span className="block truncate">Notes: {r.notes}</span>}
            </div>
        </div>
    );
}

function toAbsoluteUrl(url?: string | null) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_BASE}${url}`;
}

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

/* --------------------------- Page Component --------------------------- */

export default function LibrarianDamageReportsPage() {
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [rows, setRows] = React.useState<DamageReportRow[]>([]);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<"all" | DamageStatus>("all");

    const [updatingId, setUpdatingId] = React.useState<string | null>(null);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);

    const [photoDialogOpen, setPhotoDialogOpen] = React.useState(false);
    const [photoDialogImages, setPhotoDialogImages] = React.useState<string[]>([]);
    const [photoDialogIndex, setPhotoDialogIndex] = React.useState(0);

    const [assessOpen, setAssessOpen] = React.useState(false);
    const [assessReport, setAssessReport] = React.useState<DamageReportRow | null>(null);
    const [assessSeverity, setAssessSeverity] = React.useState<Severity>("minor");
    const [assessStatus, setAssessStatus] = React.useState<DamageStatus>("pending");
    const [assessFee, setAssessFee] = React.useState<string>("");
    const [assessNotes, setAssessNotes] = React.useState<string>("");
    const [assessLiableUserId, setAssessLiableUserId] = React.useState<string>("");
    const [assessSaving, setAssessSaving] = React.useState(false);
    const [feeEdited, setFeeEdited] = React.useState(false);

    const load = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchDamageReports();
            setRows(data as DamageReportRow[]);
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

    /**
     * Quick status helper:
     * - ONLY supports pending -> assessed
     * - Archived/paid records cannot be updated
     */
    async function handleStatusStep(report: DamageReportRow) {
        if (report.archived || report.status === "paid") return;

        let next: DamageStatus | null = null;
        if (report.status === "pending") next = "assessed";
        if (!next || next === report.status) return;

        const idStr = String(report.id);
        setUpdatingId(idStr);

        const prevRows = rows;
        setRows((current) =>
            current.map((r) => (r.id === report.id ? { ...r, status: next as DamageStatus } : r))
        );

        try {
            const updated = (await updateDamageReport(report.id, { status: next })) as DamageReportRow;
            setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)));
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
        setPhotoDialogIndex(Math.min(Math.max(startIndex, 0), images.length - 1));
        setPhotoDialogOpen(true);
    }

    const currentPhotoUrl =
        photoDialogImages.length > 0
            ? photoDialogImages[Math.min(Math.max(photoDialogIndex, 0), photoDialogImages.length - 1)]
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

        const defaultStatus: DamageStatus = report.status === "pending" ? "assessed" : report.status;
        setAssessStatus(defaultStatus);

        const baseFine =
            typeof report.fee === "number" ? report.fee : suggestedFineFromSeverity(initialSeverity);
        setAssessFee(String(baseFine));

        setAssessNotes(report.notes ?? "");
        setFeeEdited(false);

        // Default liable user:
        // - if already set, keep it
        // - otherwise default to reporter/current borrower to avoid empty liability
        const defaultLiable = report.liableUserId ?? report.userId ?? "";
        setAssessLiableUserId(defaultLiable ? String(defaultLiable) : "");

        setAssessOpen(true);
    }

    function closeAssessDialog() {
        if (assessSaving) return;
        setAssessOpen(false);
        setAssessReport(null);
        setAssessNotes("");
        setAssessFee("");
        setAssessLiableUserId("");
        setFeeEdited(false);
    }

    async function handleAssessSave() {
        if (!assessReport) return;

        // Archived/paid cannot be edited
        if (assessReport.archived || assessReport.status === "paid") {
            toast.message("Archived record", {
                description: "This report is already paid/archived and can no longer be edited.",
            });
            return;
        }

        const trimmedFee = assessFee.trim();
        const parsedFee = trimmedFee === "" ? 0 : Number(trimmedFee);

        if (!Number.isFinite(parsedFee) || parsedFee < 0) {
            toast.warning("Invalid fine amount", {
                description: "Fine must be a number greater than or equal to 0.",
            });
            return;
        }

        // Liable user parsing
        const liableStr = assessLiableUserId.trim();
        const liableParsed =
            liableStr === "" ? null : Number.isFinite(Number(liableStr)) ? Number(liableStr) : NaN;

        if (liableStr !== "" && (!Number.isFinite(liableParsed as number) || (liableParsed as number) <= 0)) {
            toast.warning("Invalid liable user", {
                description: "Liable User ID must be a valid numeric user id, or leave it blank to clear.",
            });
            return;
        }

        setAssessSaving(true);
        const prevRows = rows;

        setRows((current) =>
            current.map((r) =>
                r.id === assessReport.id
                    ? {
                        ...r,
                        severity: assessSeverity,
                        status: assessStatus,
                        fee: parsedFee,
                        notes: assessNotes.trim() || null,
                        liableUserId: liableStr === "" ? null : String(liableParsed),
                    }
                    : r
            )
        );

        try {
            const updated = (await updateDamageReport(assessReport.id, {
                severity: assessSeverity,
                status: assessStatus,
                fee: parsedFee,
                notes: assessNotes.trim() || null,
                liableUserId: liableStr === "" ? null : (liableParsed as number),
            })) as DamageReportRow;

            setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)));

            const paidNote =
                updated.status === "paid" || updated.archived
                    ? ` (archived, paid: ${fmtDate(updated.paidAt)})`
                    : "";

            toast.success("Assessment saved", {
                description: `Report #${updated.id} updated (status: ${updated.status}, fine: ${peso(
                    updated.fee
                )})${paidNote}.`,
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
            const reportedBy = getReportedByName(r);
            const liableBy = getLiableName(r);

            const user =
                `${reportedBy} ${r.studentEmail || ""} ${r.studentId || ""} ${String(r.userId || "")}`;
            const liable =
                `${liableBy} ${r.liableStudentEmail || ""} ${r.liableStudentId || ""} ${String(r.liableUserId || "")}`;
            const book = `${r.bookTitle || ""} ${String(r.bookId || "")}`;
            const damage = `${r.damageType || ""} ${r.severity || ""} ${r.status || ""}`;
            const notes = r.notes || "";
            const paid = r.paidAt ? fmtDate(r.paidAt) : "";

            return (
                String(r.id).includes(q) ||
                user.toLowerCase().includes(q) ||
                liable.toLowerCase().includes(q) ||
                book.toLowerCase().includes(q) ||
                damage.toLowerCase().includes(q) ||
                notes.toLowerCase().includes(q) ||
                paid.toLowerCase().includes(q)
            );
        });
    }, [rows, statusFilter, search]);

    return (
        <DashboardLayout title="Damage Reports">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-start gap-2">
                    <ShieldAlert className="h-5 w-5 mt-0.5 text-white/70" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Book Damage Reports</h2>
                        <p className="text-xs text-white/70">
                            Assign liability, assess fines, and archive reports when paid.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by ID, reported by, liable user, book…"
                            className="pl-9 bg-slate-900/70 border-white/20 text-white"
                        />
                    </div>

                    <div className="w-full sm:w-44">
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | DamageStatus)}>
                            <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="assessed">Assessed</SelectItem>
                                <SelectItem value="paid">Paid (archived)</SelectItem>
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
                        {refreshing || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
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
                        <div className="py-6 text-center text-sm text-red-300">{error}</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">No damage reports found.</div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableCaption className="text-xs text-white/60">
                                        Showing {filtered.length} {filtered.length === 1 ? "entry" : "entries"}.
                                    </TableCaption>
                                    <TableHeader>
                                        <TableRow className="border-white/10">
                                            <TableHead className="w-[90px] text-xs font-semibold text-white/70">
                                                Report ID
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Reported by
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Liable user
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Book
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Damage info
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Photo
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70 text-right">
                                                Actions
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filtered.map((r) => {
                                            const reportedBy = getReportedByName(r);
                                            const liableBy = getLiableName(r);
                                            const book = r.bookTitle || `Book #${r.bookId}`;

                                            const rawPhotos: string[] = (
                                                r.photoUrls && r.photoUrls.length ? r.photoUrls : r.photoUrl ? [r.photoUrl] : []
                                            ).filter(Boolean) as string[];

                                            const absPhotos = rawPhotos.map((url) => toAbsoluteUrl(url)).filter(Boolean);
                                            const primaryAbs = absPhotos[0] || "";
                                            const totalPhotos = absPhotos.length;

                                            const isRowUpdating = updatingId === String(r.id);
                                            const isRowDeleting = deletingId === String(r.id);
                                            const disableActions = isRowUpdating || isRowDeleting;

                                            const isArchived = r.archived || r.status === "paid";

                                            let statusActionLabel: string | null = null;
                                            if (!isArchived && r.status === "pending") statusActionLabel = "Mark assessed";

                                            return (
                                                <TableRow
                                                    key={r.id}
                                                    className="border-white/5 hover:bg-white/5 transition-colors"
                                                >
                                                    <TableCell className="text-xs opacity-80">{r.id}</TableCell>
                                                    <TableCell className="text-sm">{reportedBy}</TableCell>
                                                    <TableCell className="text-sm">{liableBy}</TableCell>
                                                    <TableCell className="text-sm">{book}</TableCell>
                                                    <TableCell className="text-sm align-top">{formatDamageInfo(r)}</TableCell>

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
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 px-2 border-amber-400/70 text-amber-100 hover:bg-amber-500/15"
                                                                onClick={() => openAssessDialog(r)}
                                                                disabled={disableActions}
                                                            >
                                                                {isArchived ? "View" : "Assess / liability"}
                                                            </Button>

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
                                                                        <span className="sr-only">Delete damage report</span>
                                                                    </Button>
                                                                </AlertDialogTrigger>

                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Delete report #{r.id}?</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            This action cannot be undone. The damage report (active or archived)
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
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile cards */}
                            <div className="md:hidden space-y-3">
                                {filtered.map((r) => {
                                    const reportedBy = getReportedByName(r);
                                    const liableBy = getLiableName(r);
                                    const book = r.bookTitle || `Book #${r.bookId}`;

                                    const rawPhotos: string[] = (
                                        r.photoUrls && r.photoUrls.length ? r.photoUrls : r.photoUrl ? [r.photoUrl] : []
                                    ).filter(Boolean) as string[];

                                    const absPhotos = rawPhotos.map((url) => toAbsoluteUrl(url)).filter(Boolean);
                                    const primaryAbs = absPhotos[0] || "";
                                    const totalPhotos = absPhotos.length;

                                    const isRowUpdating = updatingId === String(r.id);
                                    const isRowDeleting = deletingId === String(r.id);
                                    const disableActions = isRowUpdating || isRowDeleting;

                                    const isArchived = r.archived || r.status === "paid";

                                    let statusActionLabel: string | null = null;
                                    if (!isArchived && r.status === "pending") statusActionLabel = "Mark assessed";

                                    return (
                                        <div key={r.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs text-white/60">Report ID</div>
                                                <div className="text-xs font-semibold">{r.id}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Reported by</div>
                                                <div className="text-sm">{reportedBy}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Liable user</div>
                                                <div className="text-sm">{liableBy}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Book</div>
                                                <div className="text-sm">{book}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Damage info</div>
                                                <div className="text-sm">{formatDamageInfo(r)}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Photo</div>
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

                                            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
                                                    onClick={() => openAssessDialog(r)}
                                                    disabled={disableActions}
                                                >
                                                    {isArchived ? "View" : "Assess / liability"}
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
                                                            <AlertDialogTitle>Delete report #{r.id}?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-white/70">
                                                                This action cannot be undone. The damage report (active or archived)
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
                                ? ` (${photoDialogIndex + 1} of ${photoDialogImages.length})`
                                : ""}
                        </DialogTitle>
                    </DialogHeader>

                    {currentPhotoUrl ? (
                        <div className="mt-2 flex flex-col gap-4">
                            <div className="relative max-h-[70vh] overflow-hidden rounded-lg border border-white/20 bg-black/40">
                                <img src={currentPhotoUrl} alt="Damage proof" className="max-h-[70vh] w-full object-contain" />
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
                    if (!open) closeAssessDialog();
                    else if (assessReport) setAssessOpen(true);
                }}
            >
                <DialogContent className="max-w-2xl bg-slate-900 text-white border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            {assessReport?.archived || assessReport?.status === "paid"
                                ? "View archived damage report"
                                : "Assess damage report"}
                            {assessReport ? ` #${assessReport.id}` : ""}
                        </DialogTitle>
                    </DialogHeader>

                    {assessReport ? (
                        <div className="mt-3 space-y-4 text-sm">
                            {/* Context */}
                            <div className="rounded-md border border-white/10 bg-slate-900/70 px-3 py-2">
                                <div className="grid gap-2 md:grid-cols-2">
                                    <div>
                                        <div className="text-xs text-white/60">Reported by</div>
                                        <div className="text-sm font-medium">{getReportedByName(assessReport)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-white/60">Liable user</div>
                                        <div className="text-sm font-medium">{getLiableName(assessReport)}</div>
                                    </div>
                                </div>

                                <div className="mt-2 text-xs text-white/70">
                                    <div>Book: {assessReport.bookTitle || `Book #${assessReport.bookId}`}</div>
                                    <div>Damage: {assessReport.damageType}</div>
                                    {assessReport.reportedAt && <div>Reported: {fmtDate(assessReport.reportedAt)}</div>}
                                    {(assessReport.status === "paid" || assessReport.archived) && (
                                        <div>Paid: {fmtDate(assessReport.paidAt)}</div>
                                    )}
                                </div>
                            </div>

                            {(assessReport.archived || assessReport.status === "paid") ? (
                                <div className="rounded-md border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-white/70">
                                    This report is already <span className="font-semibold">paid/archived</span> and cannot be edited.
                                </div>
                            ) : null}

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Left */}
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">Severity</label>
                                        <Select
                                            value={assessSeverity}
                                            onValueChange={(v) => {
                                                const sev = v as Severity;
                                                setAssessSeverity(sev);
                                                if (!feeEdited) setAssessFee(String(suggestedFineFromSeverity(sev)));
                                            }}
                                            disabled={assessSaving || assessReport.archived || assessReport.status === "paid"}
                                        >
                                            <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                                <SelectItem value="minor">Minor (cosmetic)</SelectItem>
                                                <SelectItem value="moderate">Moderate (affects reading)</SelectItem>
                                                <SelectItem value="major">Major (pages missing / severe)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">Status</label>
                                        <Select
                                            value={assessStatus}
                                            onValueChange={(v) => setAssessStatus(v as DamageStatus)}
                                            disabled={assessSaving || assessReport.archived || assessReport.status === "paid"}
                                        >
                                            <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                                <SelectItem value="pending">Pending (not yet assessed)</SelectItem>
                                                <SelectItem value="assessed">Assessed (awaiting payment)</SelectItem>
                                                <SelectItem value="paid">Paid (archive this report)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-white/55">
                                            Setting status to <span className="font-semibold">Paid</span> will move this record to the paid archive.
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">
                                            Liable User ID <span className="text-white/40">(can be previous borrower)</span>
                                        </label>
                                        <Input
                                            value={assessLiableUserId}
                                            onChange={(e) => setAssessLiableUserId(e.target.value)}
                                            placeholder="e.g. 123"
                                            className="bg-slate-900/70 border-white/20 text-white"
                                            disabled={assessSaving || assessReport.archived || assessReport.status === "paid"}
                                            inputMode="numeric"
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className="text-[11px] text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                                                onClick={() => setAssessLiableUserId(String(assessReport.userId))}
                                                disabled={assessSaving || assessReport.archived || assessReport.status === "paid"}
                                            >
                                                Use reported-by user
                                            </button>
                                            <button
                                                type="button"
                                                className="text-[11px] text-white/60 hover:text-white/90 underline-offset-2 hover:underline"
                                                onClick={() => setAssessLiableUserId("")}
                                                disabled={assessSaving || assessReport.archived || assessReport.status === "paid"}
                                            >
                                                Clear liable user
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-white/55">
                                            The fine will be charged to the liable user (if set). If blank, liability is considered “unassigned”.
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">
                                            Notes for record <span className="text-white/40">(optional)</span>
                                        </label>
                                        <textarea
                                            value={assessNotes}
                                            onChange={(e) => setAssessNotes(e.target.value)}
                                            rows={4}
                                            className="w-full rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                                            placeholder="Example: Damage existed before this borrower; previous borrower is liable."
                                            disabled={assessSaving || assessReport.archived || assessReport.status === "paid"}
                                        />
                                    </div>
                                </div>

                                {/* Right */}
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80 flex items-center justify-between gap-2">
                                            Assessed fine (₱)
                                            <span className="text-[10px] text-white/50">Set 0 if no fine</span>
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
                                            disabled={assessSaving || assessReport.archived || assessReport.status === "paid"}
                                        />
                                    </div>

                                    <div className="rounded-md border border-dashed border-white/15 bg-slate-900/40 px-3 py-2 text-[11px] text-white/70 space-y-1.5">
                                        <div>
                                            Suggested fine for{" "}
                                            <span className="font-semibold">
                                                {assessSeverity.charAt(0).toUpperCase() + assessSeverity.slice(1)}
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
                                                setAssessFee(String(suggestedFineFromSeverity(assessSeverity)));
                                                setFeeEdited(false);
                                            }}
                                            disabled={assessSaving || assessReport.archived || assessReport.status === "paid"}
                                        >
                                            Use suggested fine
                                        </button>
                                        <p>You can override this amount based on library policy.</p>
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
                                    Close
                                </Button>

                                {!(assessReport.archived || assessReport.status === "paid") ? (
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
                                ) : null}
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
