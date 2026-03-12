/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { toast } from "sonner";

import DashboardLayout from "@/components/dashboard-layout";
import type { UserListItemDTO } from "@/lib/authentication";
import { listUsers } from "@/lib/authentication";
import type { FineDTO } from "@/lib/fines";
import { fetchFines } from "@/lib/fines";
import type { DamageStatus } from "@/lib/damageReports";
import { deleteDamageReport, fetchDamageReports, updateDamageReport } from "@/lib/damageReports";

import { DamageReportsHeader } from "@/components/librarian/damage-reports/header";
import { DamageReportsSection } from "@/components/librarian/damage-reports/list-section";
import { PhotoPreviewDialog } from "@/components/librarian/damage-reports/photo-preview-dialog";
import { AssessmentDialog } from "@/components/librarian/damage-reports/assessment-dialog";

import type {
    ActiveStatusFilter,
    DamageReportRow,
    FinePaidIndex,
    Severity,
} from "@/components/librarian/damage-reports/types";

import {
    fmtDate,
    getLiableName,
    getReportedByName,
    isServerArchivedRecord,
    normalizeDamageStatus,
    peso,
    suggestedFineFromSeverity,
} from "@/components/librarian/damage-reports/helpers";

export default function LibrarianDamageReportsPage() {
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [rows, setRows] = React.useState<DamageReportRow[]>([]);
    const [search, setSearch] = React.useState("");
    const [activeStatusFilter, setActiveStatusFilter] = React.useState<ActiveStatusFilter>("all");

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
    const LIABLE_NONE = "__none__";

    const [users, setUsers] = React.useState<UserListItemDTO[]>([]);
    const [usersLoading, setUsersLoading] = React.useState(false);
    const [usersError, setUsersError] = React.useState<string | null>(null);
    const [liableUserQuery, setLiableUserQuery] = React.useState("");

    const [assessSaving, setAssessSaving] = React.useState(false);
    const [feeEdited, setFeeEdited] = React.useState(false);

    const LIABLE_ALLOWED = React.useMemo(() => new Set<string>(["student", "faculty", "other"]), []);

    const [finePaidIndex, setFinePaidIndex] = React.useState<FinePaidIndex>(() => ({
        ids: new Set<string>(),
        paidAtById: new Map<string, string | null>(),
    }));

    const getUiArchiveInfo = React.useCallback(
        (r: DamageReportRow) => {
            const idStr = String((r as any).id);
            const serverArchived = isServerArchivedRecord(r);
            const paidByFine = finePaidIndex.ids.has(idStr);
            const archived = serverArchived || paidByFine;

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
            const [reportsRes, finesRes] = await Promise.allSettled([fetchDamageReports(), fetchFines()]);

            if (reportsRes.status === "rejected") {
                throw reportsRes.reason;
            }

            const reports = (reportsRes.value ?? []) as DamageReportRow[];
            setRows(reports);

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

    function openPhotoDialog(images: string[], startIndex = 0) {
        if (!images || !images.length) return;
        setPhotoDialogImages(images);
        setPhotoDialogIndex(Math.min(Math.max(startIndex, 0), images.length - 1));
        setPhotoDialogOpen(true);
    }

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

    function openAssessDialog(report: DamageReportRow) {
        setAssessReport(report);

        const ui = getUiArchiveInfo(report);
        const initialSeverity = report.severity ?? "minor";
        setAssessSeverity(initialSeverity);

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

        const defaultLiable = report.liableUserId ?? report.userId ?? "";
        setAssessLiableUserId(defaultLiable ? String(defaultLiable) : "");
        setLiableUserQuery("");

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
                        archived: markingPaid ? true : (r as any).archived,
                        paidAt: markingPaid ? ((r as any).paidAt ?? optimisticPaidAt) : (r as any).paidAt,
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

    const assessUi = React.useMemo(() => {
        if (!assessReport) return { archived: false, status: "pending" as DamageStatus, paidAt: null as string | null };
        return getUiArchiveInfo(assessReport);
    }, [assessReport, getUiArchiveInfo]);

    return (
        <DashboardLayout title="Damage Reports">
            <DamageReportsHeader
                search={search}
                onSearchChange={setSearch}
                activeStatusFilter={activeStatusFilter}
                onActiveStatusFilterChange={setActiveStatusFilter}
                refreshing={refreshing}
                loading={loading}
                onRefresh={handleRefresh}
                counts={counts}
            />

            <DamageReportsSection
                title="Active damage reports (unpaid)"
                description="If a damage fine is already paid, it will automatically move to the Paid archive."
                loading={loading}
                error={error}
                list={activeList}
                mode="active"
                updatingId={updatingId}
                deletingId={deletingId}
                getUiArchiveInfo={getUiArchiveInfo}
                onOpenPhotoDialog={openPhotoDialog}
                onOpenAssessDialog={openAssessDialog}
                onStatusStep={handleStatusStep}
                onDelete={handleDelete}
            />

            <DamageReportsSection
                title="Paid archive"
                description="Includes reports marked paid/archived, plus reports whose linked fine is already paid."
                loading={loading}
                error={error}
                list={paidArchiveList}
                mode="paid"
                updatingId={updatingId}
                deletingId={deletingId}
                getUiArchiveInfo={getUiArchiveInfo}
                onOpenPhotoDialog={openPhotoDialog}
                onOpenAssessDialog={openAssessDialog}
                onStatusStep={handleStatusStep}
                onDelete={handleDelete}
            />

            <PhotoPreviewDialog
                open={photoDialogOpen}
                onOpenChange={setPhotoDialogOpen}
                images={photoDialogImages}
                index={photoDialogIndex}
                onPrev={showPrevPhoto}
                onNext={showNextPhoto}
            />

            <AssessmentDialog
                open={assessOpen}
                assessReport={assessReport}
                assessUi={assessUi}
                assessSeverity={assessSeverity}
                onAssessSeverityChange={(value) => {
                    setAssessSeverity(value);
                    if (!feeEdited) setAssessFee(String(suggestedFineFromSeverity(value)));
                }}
                assessStatus={assessStatus}
                onAssessStatusChange={setAssessStatus}
                assessFee={assessFee}
                onAssessFeeChange={(value) => {
                    setAssessFee(value);
                    setFeeEdited(true);
                }}
                assessNotes={assessNotes}
                onAssessNotesChange={setAssessNotes}
                assessLiableUserId={assessLiableUserId}
                onAssessLiableUserIdChange={setAssessLiableUserId}
                users={users}
                eligibleUsers={eligibleUsers}
                filteredUsers={filteredUsers}
                usersLoading={usersLoading}
                usersError={usersError}
                liableUserQuery={liableUserQuery}
                onLiableUserQueryChange={setLiableUserQuery}
                selectedLiableUser={selectedLiableUser}
                assessSaving={assessSaving}
                liableNoneValue={LIABLE_NONE}
                onRetryLoadUsers={() => void loadUsers()}
                onClose={closeAssessDialog}
                onSave={() => void handleAssessSave()}
                onUseSuggestedFine={() => {
                    setAssessFee(String(suggestedFineFromSeverity(assessSeverity)));
                    setFeeEdited(false);
                }}
                onUseReportedByUser={() => {
                    if (!assessReport) return;
                    setAssessLiableUserId(String(assessReport.userId));
                }}
                onClearLiableUser={() => setAssessLiableUserId("")}
            />
        </DashboardLayout>
    );
}