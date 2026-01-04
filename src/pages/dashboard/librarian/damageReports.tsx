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

import type { UserListItemDTO } from "@/lib/authentication";
import { listUsers } from "@/lib/authentication";

import { fetchFines, type FineDTO } from "@/lib/fines";

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

type FinePaidIndex = {
    ids: Set<string>;
    paidAtById: Map<string, string | null>;
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

function normalizeDamageStatus(value: any): DamageStatus | null {
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return null;
    if (s === "pending" || s.startsWith("pend")) return "pending";
    if (s === "assessed" || s.startsWith("assess")) return "assessed";
    if (s === "paid" || s.startsWith("paid")) return "paid";
    return null;
}

function serverArchivedFlag(v: any): boolean {
    return v === true || v === "true" || v === 1 || v === "1";
}

/** Server-side paid/archived detection (based on report fields only). */
function isServerArchivedRecord(r: DamageReportRow) {
    const st = normalizeDamageStatus((r as any).status) ?? "pending";
    const archived = serverArchivedFlag((r as any).archived);
    const paidAt = (r as any).paidAt;
    return archived || st === "paid" || Boolean(paidAt);
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
        (r.liableUserId ?? null) || (anyR.liableUserId ?? null) || (anyR.liable_user_id ?? null);

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

function formatDamageInfo(
    r: DamageReportRow,
    opts?: { uiStatus?: DamageStatus; uiArchived?: boolean; uiPaidAt?: string | null }
) {
    const uiStatus = opts?.uiStatus ?? (normalizeDamageStatus((r as any).status) ?? "pending");
    const uiArchived = opts?.uiArchived ?? serverArchivedFlag((r as any).archived);
    const uiPaidAt = opts?.uiPaidAt ?? (r as any).paidAt ?? null;

    const paidLabel = uiPaidAt ? fmtDate(uiPaidAt) : "—";

    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.damageType}</span>
                <SeverityBadge severity={r.severity} />
                <StatusBadge status={uiStatus} archived={uiArchived} />
            </div>

            <div className="text-xs text-white/70">
                {r.fee !== undefined && <span className="mr-3">Fine: {peso(r.fee)}</span>}
                {r.reportedAt && <span className="mr-3">Reported: {fmtDate(r.reportedAt)}</span>}
                {(uiStatus === "paid" || uiArchived) && <span className="mr-3">Paid: {paidLabel}</span>}
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

/**
 * Suggested fine policy:
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

function userDisplayLabel(u: UserListItemDTO) {
    const name = (u.fullName || "").trim();
    const email = (u.email || "").trim();
    const main = name || email || `User #${u.id}`;
    const role = (u.accountType || "").trim();
    return { main, sub: `${email || "—"}${role ? ` • ${role}` : ""}` };
}

/* --------------------------- Page Component --------------------------- */

export default function LibrarianDamageReportsPage() {
    // ✅ Requested scrollbar style for dialogs
    const dialogScrollbarClasses =
        "[scrollbar-width:thin] [scrollbar-color:#334155_transparent] " +
        "[&::-webkit-scrollbar]:w-2 " +
        "[&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [rows, setRows] = React.useState<DamageReportRow[]>([]);
    const [search, setSearch] = React.useState("");

    /**
     * ✅ ACTIVE filter applies ONLY to ACTIVE list:
     * - ACTIVE list: pending + assessed (not archived/paid)
     * - PAID ARCHIVE: paid OR archived OR paid via fines
     */
    const [activeStatusFilter, setActiveStatusFilter] = React.useState<"all" | "pending" | "assessed">(
        "all"
    );

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

    // ✅ Liable user selection (shadcn Select)
    const [assessLiableUserId, setAssessLiableUserId] = React.useState<string>(""); // "" means unassigned
    const LIABLE_NONE = "__none__";

    const [users, setUsers] = React.useState<UserListItemDTO[]>([]);
    const [usersLoading, setUsersLoading] = React.useState(false);
    const [usersError, setUsersError] = React.useState<string | null>(null);
    const [liableUserQuery, setLiableUserQuery] = React.useState("");

    const [assessSaving, setAssessSaving] = React.useState(false);
    const [feeEdited, setFeeEdited] = React.useState(false);

    // ✅ Only these account types can be liable:
    const LIABLE_ALLOWED = React.useMemo(() => new Set<string>(["student", "faculty", "other"]), []);

    // ✅ Index of PAID damage-report fines (so paid damage is ALWAYS shown in Paid archive automatically)
    const [finePaidIndex, setFinePaidIndex] = React.useState<FinePaidIndex>(() => ({
        ids: new Set<string>(),
        paidAtById: new Map<string, string | null>(),
    }));

    const getUiArchiveInfo = React.useCallback(
        (r: DamageReportRow) => {
            const idStr = String((r as any).id);

            // server fields
            const serverArchived = isServerArchivedRecord(r);

            // fines-based paid detection (if fine for this damage report is paid)
            const paidByFine = finePaidIndex.ids.has(idStr);

            const archived = serverArchived || paidByFine;

            // If it is archived (by server OR by fine), treat as paid in UI
            const status: DamageStatus = archived
                ? "paid"
                : normalizeDamageStatus((r as any).status) ?? "pending";

            const paidAt: string | null = archived
                ? (r.paidAt ?? finePaidIndex.paidAtById.get(idStr) ?? null)
                : (r.paidAt ?? null);

            return { archived, status, paidAt };
        },
        [finePaidIndex]
    );

    const load = React.useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            // Load reports and fines in parallel.
            const [reportsRes, finesRes] = await Promise.allSettled([fetchDamageReports(), fetchFines()]);

            if (reportsRes.status === "rejected") {
                throw reportsRes.reason;
            }

            const reports = (reportsRes.value ?? []) as DamageReportRow[];
            setRows(reports);

            // Build finePaidIndex (damageReportId -> paidAt)
            const ids = new Set<string>();
            const paidAtById = new Map<string, string | null>();

            if (finesRes.status === "fulfilled") {
                const fines = (finesRes.value ?? []) as FineDTO[];
                for (const f of fines) {
                    const anyF = f as any;
                    const drId = (f.damageReportId ?? anyF.damageReportId ?? anyF.damageId ?? anyF.damageReportID) as
                        | string
                        | number
                        | null
                        | undefined;

                    if (drId == null) continue;

                    const st = String((f as any).status ?? "").trim().toLowerCase();
                    if (st !== "paid") continue;

                    const key = String(drId);
                    ids.add(key);

                    // best-effort paid timestamp for UI
                    const paidAt = (f.resolvedAt ?? f.updatedAt ?? null) as string | null;
                    paidAtById.set(key, paidAt);
                }
            } else {
                const msg =
                    (finesRes.reason as any)?.message ||
                    "Could not load fines. Paid archive may be incomplete until the next refresh.";
                toast.error("Failed to load fines", { description: msg });
            }

            setFinePaidIndex({ ids, paidAtById });
        } catch (err: any) {
            const msg = err?.message || "Failed to load damage reports.";
            setError(msg);
            setRows([]);
            setFinePaidIndex({ ids: new Set(), paidAtById: new Map() });
            toast.error("Failed to load", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    const loadUsers = React.useCallback(async () => {
        setUsersError(null);
        setUsersLoading(true);
        try {
            const list = await listUsers();
            setUsers(list);
        } catch (err: any) {
            const msg = err?.message || "Failed to load users.";
            setUsersError(msg);
            toast.error("Failed to load users", { description: msg });
        } finally {
            setUsersLoading(false);
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
     * - Paid/archived (including paid-by-fines) cannot be updated
     */
    async function handleStatusStep(report: DamageReportRow) {
        const ui = getUiArchiveInfo(report);
        if (ui.archived || ui.status === "paid") return;

        let next: DamageStatus | null = null;
        const st = normalizeDamageStatus((report as any).status) ?? "pending";
        if (st === "pending") next = "assessed";
        if (!next || next === st) return;

        const idStr = String(report.id);
        setUpdatingId(idStr);

        const prevRows = rows;
        setRows((current) => current.map((r) => (r.id === report.id ? { ...r, status: next } : r)));

        try {
            const updated = (await updateDamageReport(report.id, { status: next })) as DamageReportRow;
            setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)));
            toast.success("Status updated", {
                description: `Report #${updated.id} is now ${normalizeDamageStatus((updated as any).status) ?? updated.status}.`,
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

        const ui = getUiArchiveInfo(report);

        const initialSeverity = report.severity ?? "minor";
        setAssessSeverity(initialSeverity);

        // If already paid (server OR fine-paid), force paid in UI and lock editing
        if (ui.archived || ui.status === "paid") {
            setAssessStatus("paid");
        } else {
            const current = normalizeDamageStatus((report as any).status) ?? "pending";
            const defaultStatus: DamageStatus = current === "pending" ? "assessed" : current;
            setAssessStatus(defaultStatus);
        }

        const baseFine = typeof report.fee === "number" ? report.fee : suggestedFineFromSeverity(initialSeverity);
        setAssessFee(String(baseFine));

        setAssessNotes(report.notes ?? "");
        setFeeEdited(false);

        // Default liable user:
        const defaultLiable = report.liableUserId ?? report.userId ?? "";
        setAssessLiableUserId(defaultLiable ? String(defaultLiable) : "");

        setLiableUserQuery("");

        // ✅ Load users lazily (only when opening the dialog)
        if (!usersLoading && users.length === 0) {
            void loadUsers();
        }

        setAssessOpen(true);
    }

    function closeAssessDialog() {
        if (assessSaving) return;
        setAssessOpen(false);
        setAssessReport(null);
        setAssessNotes("");
        setAssessFee("");
        setAssessLiableUserId("");
        setLiableUserQuery("");
        setFeeEdited(false);
    }

    async function handleAssessSave() {
        if (!assessReport) return;

        const ui = getUiArchiveInfo(assessReport);

        // Paid/archived cannot be edited (includes "paid via fines")
        if (ui.archived || ui.status === "paid") {
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

        // ✅ Enforce eligible liable roles
        const liableStr = assessLiableUserId.trim();
        if (liableStr !== "") {
            const found = users.find((u) => String(u.id) === liableStr) || null;
            if (found && !LIABLE_ALLOWED.has(String(found.accountType))) {
                toast.warning("Ineligible liable user", {
                    description: "Only Student, Faculty, and Other accounts can be set as liable.",
                });
                return;
            }
        }

        // ✅ Liable user payload (supports numeric ids OR string ids)
        let liablePayload: string | number | null = null;
        if (liableStr !== "") {
            liablePayload = /^\d+$/.test(liableStr) ? Number(liableStr) : liableStr;
        }

        const selectedUser =
            liableStr === "" ? null : users.find((u) => String(u.id) === liableStr) || null;

        const markingPaid = assessStatus === "paid";
        const optimisticPaidAt = markingPaid ? new Date().toISOString() : null;

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
                        liableUserId: liablePayload == null ? null : String(liablePayload),

                        // optimistic archive move
                        archived: markingPaid ? true : (r as any).archived,
                        paidAt: markingPaid ? ((r as any).paidAt ?? optimisticPaidAt) : (r as any).paidAt,

                        // optimistic-only UI helpers
                        liableStudentName:
                            liablePayload == null
                                ? null
                                : selectedUser?.fullName ?? (r as any).liableStudentName ?? null,
                        liableStudentEmail:
                            liablePayload == null
                                ? null
                                : selectedUser?.email ?? (r as any).liableStudentEmail ?? null,
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
                liableUserId: liablePayload,
            })) as DamageReportRow;

            setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)));

            const updatedUi = getUiArchiveInfo(updated);
            const paidNote =
                updatedUi.status === "paid" || updatedUi.archived ? ` (archived, paid: ${fmtDate(updatedUi.paidAt)})` : "";

            toast.success("Assessment saved", {
                description: `Report #${updated.id} updated (status: ${updatedUi.status}, fine: ${peso(updated.fee)})${paidNote}.`,
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

    const eligibleUsers = React.useMemo(() => {
        return users.filter((u) => LIABLE_ALLOWED.has(String(u.accountType)));
    }, [users, LIABLE_ALLOWED]);

    const filteredUsers = React.useMemo(() => {
        const q = liableUserQuery.trim().toLowerCase();
        const base = eligibleUsers;
        if (!q) return base;

        return base.filter((u) => {
            const hay = `${u.id} ${u.fullName ?? ""} ${u.email ?? ""} ${u.accountType ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [eligibleUsers, liableUserQuery]);

    const selectedLiableUser = React.useMemo(() => {
        if (!assessLiableUserId) return null;
        return users.find((u) => String(u.id) === assessLiableUserId) || null;
    }, [users, assessLiableUserId]);

    function matchesSearch(r: DamageReportRow, qLower: string) {
        if (!qLower) return true;

        const reportedBy = getReportedByName(r);
        const liableBy = getLiableName(r);

        const user = `${reportedBy} ${r.studentEmail || ""} ${r.studentId || ""} ${String(r.userId || "")}`;
        const liable = `${liableBy} ${r.liableStudentEmail || ""} ${r.liableStudentId || ""} ${String(r.liableUserId || "")}`;
        const book = `${r.bookTitle || ""} ${String(r.bookId || "")}`;
        const damage = `${r.damageType || ""} ${r.severity || ""} ${String((r as any).status || "")}`;
        const notes = r.notes || "";
        const paid = r.paidAt ? fmtDate(r.paidAt) : "";

        return (
            String(r.id).includes(qLower) ||
            user.toLowerCase().includes(qLower) ||
            liable.toLowerCase().includes(qLower) ||
            book.toLowerCase().includes(qLower) ||
            damage.toLowerCase().includes(qLower) ||
            notes.toLowerCase().includes(qLower) ||
            paid.toLowerCase().includes(qLower)
        );
    }

    const qLower = search.trim().toLowerCase();

    const activeList = React.useMemo(() => {
        let list = rows.filter((r) => !getUiArchiveInfo(r).archived);

        if (activeStatusFilter !== "all") {
            list = list.filter((r) => getUiArchiveInfo(r).status === activeStatusFilter);
        }

        if (qLower) {
            list = list.filter((r) => matchesSearch(r, qLower));
        }

        return [...list].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    }, [rows, activeStatusFilter, qLower, getUiArchiveInfo]);

    const paidArchiveList = React.useMemo(() => {
        let list = rows.filter((r) => getUiArchiveInfo(r).archived);

        if (qLower) {
            list = list.filter((r) => matchesSearch(r, qLower));
        }

        return [...list].sort((a, b) => {
            const ua = getUiArchiveInfo(a);
            const ub = getUiArchiveInfo(b);
            const da = ua.paidAt || a.reportedAt || "";
            const db = ub.paidAt || b.reportedAt || "";
            return String(db).localeCompare(String(da));
        });
    }, [rows, qLower, getUiArchiveInfo]);

    const counts = React.useMemo(() => {
        let activeCount = 0;
        let paidCount = 0;
        for (const r of rows) {
            if (getUiArchiveInfo(r).archived) paidCount += 1;
            else activeCount += 1;
        }
        return { activeCount, paidCount };
    }, [rows, getUiArchiveInfo]);

    function renderDesktopTable(list: DamageReportRow[], mode: "active" | "paid") {
        return (
            <Table>
                <TableCaption className="text-xs text-white/60">
                    Showing {list.length} {list.length === 1 ? "entry" : "entries"}.
                    {mode === "paid" ? " These are paid/archived records." : " These are active (unpaid) records."}
                </TableCaption>
                <TableHeader>
                    <TableRow className="border-white/10">
                        <TableHead className="w-[90px] text-xs font-semibold text-white/70">Report ID</TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">Reported by</TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">Liable user</TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">Book</TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">Damage info</TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">Photo</TableHead>
                        <TableHead className="text-xs font-semibold text-white/70 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {list.map((r) => {
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

                        const ui = getUiArchiveInfo(r);

                        let statusActionLabel: string | null = null;
                        if (!ui.archived && ui.status === "pending") statusActionLabel = "Mark assessed";

                        return (
                            <TableRow key={r.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="text-xs opacity-80">{r.id}</TableCell>
                                <TableCell className="text-sm">{reportedBy}</TableCell>
                                <TableCell className="text-sm">{liableBy}</TableCell>
                                <TableCell className="text-sm">{book}</TableCell>
                                <TableCell className="text-sm align-top">
                                    {formatDamageInfo(r, { uiStatus: ui.status, uiArchived: ui.archived, uiPaidAt: ui.paidAt })}
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
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 border-amber-400/70 text-amber-100 hover:bg-amber-500/15"
                                            onClick={() => openAssessDialog(r)}
                                            disabled={disableActions}
                                        >
                                            {ui.archived ? "View" : "Assess / liability"}
                                        </Button>

                                        {mode === "active" && statusActionLabel ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 border-blue-400/70 text-blue-100 hover:bg-blue-500/15"
                                                onClick={() => handleStatusStep(r)}
                                                disabled={disableActions}
                                            >
                                                {isRowUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : statusActionLabel}
                                            </Button>
                                        ) : null}

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
                                                        This action cannot be undone. The damage report (active or archived) will be permanently removed from the system.
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
        );
    }

    function renderMobileCards(list: DamageReportRow[], mode: "active" | "paid") {
        return (
            <div className="space-y-3">
                {list.map((r) => {
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

                    const ui = getUiArchiveInfo(r);

                    let statusActionLabel: string | null = null;
                    if (!ui.archived && ui.status === "pending") statusActionLabel = "Mark assessed";

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
                                <div className="text-sm">
                                    {formatDamageInfo(r, { uiStatus: ui.status, uiArchived: ui.archived, uiPaidAt: ui.paidAt })}
                                </div>
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
                                    {ui.archived ? "View" : "Assess / liability"}
                                </Button>

                                {mode === "active" && statusActionLabel ? (
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
                                ) : null}

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
                                                This action cannot be undone. The damage report (active or archived) will be permanently removed from the system.
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
        );
    }

    const assessUi = React.useMemo(() => {
        if (!assessReport) return { archived: false, status: "pending" as DamageStatus, paidAt: null as string | null };
        return getUiArchiveInfo(assessReport);
    }, [assessReport, getUiArchiveInfo]);

    return (
        <DashboardLayout title="Damage Reports">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-start gap-2">
                    <ShieldAlert className="h-5 w-5 mt-0.5 text-white/70" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Book Damage Reports</h2>
                        <p className="text-xs text-white/70">
                            Paid damage fines automatically appear under <span className="font-semibold">Paid Archive</span>.
                        </p>
                        <p className="mt-1 text-[11px] text-white/60">
                            Active: <span className="font-semibold text-amber-200">{counts.activeCount}</span> • Paid archive:{" "}
                            <span className="font-semibold text-emerald-200">{counts.paidCount}</span>
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

                    {/* Active-only status filter */}
                    <div className="w-full sm:w-44">
                        <Select
                            value={activeStatusFilter}
                            onValueChange={(v) => setActiveStatusFilter(v as "all" | "pending" | "assessed")}
                        >
                            <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                <SelectValue placeholder="Active filter" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                <SelectItem value="all">Active: All</SelectItem>
                                <SelectItem value="pending">Active: Pending</SelectItem>
                                <SelectItem value="assessed">Active: Assessed</SelectItem>
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

            {/* ACTIVE RECORDS */}
            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <CardTitle>Active damage reports (unpaid)</CardTitle>
                        <div className="text-xs text-white/60">
                            If a damage fine is already paid, it will automatically move to the Paid archive.
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
                    ) : activeList.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            No active damage reports found.
                            <div className="text-xs text-white/60 mt-1">Paid reports are shown in the Paid Archive section below.</div>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block">{renderDesktopTable(activeList, "active")}</div>
                            <div className="md:hidden">{renderMobileCards(activeList, "active")}</div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* PAID ARCHIVE RECORDS */}
            <Card className="mt-4 bg-slate-800/40 border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <CardTitle>Paid archive</CardTitle>
                        <div className="text-xs text-white/60">
                            Includes reports marked paid/archived, plus reports whose linked fine is already paid.
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="overflow-x-auto">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center text-sm text-red-300">{error}</div>
                    ) : paidArchiveList.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">No paid/archived records yet.</div>
                    ) : (
                        <>
                            <div className="hidden md:block">{renderDesktopTable(paidArchiveList, "paid")}</div>
                            <div className="md:hidden">{renderMobileCards(paidArchiveList, "paid")}</div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Image preview dialog (smaller + scroll container + custom scrollbar) */}
            <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
                <DialogContent className="max-w-3xl bg-slate-900 text-white border-white/10 max-h-[70vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            Damage photo preview
                            {photoDialogImages.length > 1 ? ` (${photoDialogIndex + 1} of ${photoDialogImages.length})` : ""}
                        </DialogTitle>
                    </DialogHeader>

                    <div className={`max-h-[calc(70vh-4.25rem)] overflow-y-auto pr-2 ${dialogScrollbarClasses}`}>
                        {currentPhotoUrl ? (
                            <div className="mt-2 flex flex-col gap-4">
                                <div className="relative max-h-[52vh] overflow-hidden rounded-lg border border-white/20 bg-black/40">
                                    <img src={currentPhotoUrl} alt="Damage proof" className="max-h-[52vh] w-full object-contain" />
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
                    </div>
                </DialogContent>
            </Dialog>

            {/* Assessment dialog (smaller height + vertical scrollbar + custom scrollbar) */}
            <Dialog
                open={assessOpen}
                onOpenChange={(open) => {
                    if (!open) closeAssessDialog();
                    else if (assessReport) setAssessOpen(true);
                }}
            >
                <DialogContent className="max-w-2xl bg-slate-900 text-white border-white/10 max-h-[72vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            {assessReport && (assessUi.archived || assessUi.status === "paid")
                                ? "View archived damage report"
                                : "Assess damage report"}
                            {assessReport ? ` #${assessReport.id}` : ""}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Scrollable content area */}
                    <div className={`max-h-[calc(72vh-4.25rem)] overflow-y-auto pr-2 ${dialogScrollbarClasses}`}>
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
                                        {(assessUi.archived || assessUi.status === "paid") && <div>Paid: {fmtDate(assessUi.paidAt)}</div>}
                                    </div>
                                </div>

                                {assessUi.archived || assessUi.status === "paid" ? (
                                    <div className="rounded-md border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-white/70">
                                        This report is already <span className="font-semibold">paid/archived</span> (or its linked fine is paid) and cannot be edited.
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
                                                disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
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
                                                disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
                                            >
                                                <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-900 text-white border-white/10">
                                                    <SelectItem value="pending">Pending (not yet assessed)</SelectItem>
                                                    <SelectItem value="assessed">Assessed (awaiting payment)</SelectItem>
                                                    <SelectItem value="paid">Paid (move to archive)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[11px] text-white/55">
                                                Setting status to <span className="font-semibold">Paid</span> moves this report to the Paid Archive.
                                            </p>
                                        </div>

                                        {/* ✅ Liable user selection using shadcn Select (eligible roles only) */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-white/80">
                                                Liable user <span className="text-white/40">(student / faculty / other only)</span>
                                            </label>

                                            <div className="space-y-2">
                                                <Input
                                                    value={liableUserQuery}
                                                    onChange={(e) => setLiableUserQuery(e.target.value)}
                                                    placeholder="Filter users by name / email / ID…"
                                                    className="bg-slate-900/70 border-white/20 text-white"
                                                    disabled={assessSaving || assessUi.archived || assessUi.status === "paid" || usersLoading}
                                                />

                                                <Select
                                                    value={assessLiableUserId ? assessLiableUserId : LIABLE_NONE}
                                                    onValueChange={(v) => setAssessLiableUserId(v === LIABLE_NONE ? "" : v)}
                                                    disabled={assessSaving || assessUi.archived || assessUi.status === "paid" || usersLoading}
                                                >
                                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                                        <SelectValue placeholder={usersLoading ? "Loading users…" : "Select a user"} />
                                                    </SelectTrigger>

                                                    <SelectContent className="bg-slate-900 text-white border-white/10 max-h-80">
                                                        <SelectItem value={LIABLE_NONE}>Unassigned (no liable user)</SelectItem>

                                                        {filteredUsers.map((u) => {
                                                            const { main, sub } = userDisplayLabel(u);
                                                            return (
                                                                <SelectItem key={u.id} value={String(u.id)}>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm">{main}</span>
                                                                        <span className="text-[11px] text-white/60">{sub}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>

                                                {usersError ? (
                                                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                                                        {usersError}
                                                        <div className="mt-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 border-white/20 text-white hover:bg-white/10"
                                                                onClick={() => void loadUsers()}
                                                                disabled={usersLoading}
                                                            >
                                                                {usersLoading ? (
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        Loading…
                                                                    </span>
                                                                ) : (
                                                                    "Retry loading users"
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : null}

                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        className="text-[11px] text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline disabled:opacity-50"
                                                        onClick={() => setAssessLiableUserId(String(assessReport.userId))}
                                                        disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
                                                    >
                                                        Use reported-by user
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="text-[11px] text-white/60 hover:text-white/90 underline-offset-2 hover:underline disabled:opacity-50"
                                                        onClick={() => setAssessLiableUserId("")}
                                                        disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
                                                    >
                                                        Clear liable user
                                                    </button>
                                                </div>

                                                <div className="text-[11px] text-white/55">
                                                    The fine will be charged to the selected liable user. If{" "}
                                                    <span className="font-semibold">Unassigned</span>, liability is considered “unassigned”.
                                                </div>

                                                {assessLiableUserId ? (
                                                    <div className="rounded-md border border-white/10 bg-slate-900/40 px-3 py-2 text-[11px] text-white/70">
                                                        <div className="font-semibold text-white/80">Selected liable user</div>
                                                        {selectedLiableUser ? (
                                                            <div className="mt-1">
                                                                <div className="text-white/90">
                                                                    {selectedLiableUser.fullName || `User #${selectedLiableUser.id}`}
                                                                </div>
                                                                <div className="text-white/60">
                                                                    {selectedLiableUser.email} • {selectedLiableUser.accountType}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-1 text-white/70">User #{assessLiableUserId}</div>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
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
                                                disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
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
                                                disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
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
                                                disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
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

                                    {!(assessUi.archived || assessUi.status === "paid") ? (
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
                                            ) : assessStatus === "paid" ? (
                                                "Save & move to archive"
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
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
