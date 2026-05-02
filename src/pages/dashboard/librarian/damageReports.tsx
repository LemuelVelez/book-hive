/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { FileText, Loader2, RefreshCcw, Search, Send } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchBooks, type BookDTO } from "@/lib/books";
import type { UserListItemDTO } from "@/lib/authentication";
import { listUsers } from "@/lib/authentication";
import type { FineDTO } from "@/lib/fines";
import { fetchFines } from "@/lib/fines";
import type { DamageStatus } from "@/lib/damageReports";
import { createDamageReport, deleteDamageReport, fetchDamageReports, updateDamageReport } from "@/lib/damageReports";

import { DamageReportsSection } from "@/components/librarian/damage-reports/list-section";
import { PhotoPreviewDialog } from "@/components/librarian/damage-reports/photo-preview-dialog";
import { AssessmentDialog } from "@/components/librarian/damage-reports/assessment-dialog";
import ExportPreviewDamageReports, {
    type PrintableDamageRecord,
} from "@/components/librarian/damage-reports-preview/export-preview-damage-reports";

import type {
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

    const [exportPreviewOpen, setExportPreviewOpen] = React.useState(false);

    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [booksLoading, setBooksLoading] = React.useState(false);
    const [booksError, setBooksError] = React.useState<string | null>(null);

    const [createBorrowerId, setCreateBorrowerId] = React.useState("");
    const [createBookId, setCreateBookId] = React.useState("");
    const [createDamageType, setCreateDamageType] = React.useState("");
    const [createSeverity, setCreateSeverity] = React.useState<Severity>("minor");
    const [createFee, setCreateFee] = React.useState(() => String(suggestedFineFromSeverity("minor")));
    const [createNotes, setCreateNotes] = React.useState("");
    const [createPhotos, setCreatePhotos] = React.useState<File[]>([]);
    const [createPhotosInputKey, setCreatePhotosInputKey] = React.useState(0);
    const [createSaving, setCreateSaving] = React.useState(false);

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

    const loadBooks = React.useCallback(async () => {
        setBooksError(null);
        setBooksLoading(true);
        try {
            const list = await fetchBooks();
            setBooks(list);
        } catch (err: any) {
            const msg = err?.message || "Failed to load books.";
            setBooksError(msg);
            toast.error("Failed to load books", { description: msg });
        } finally {
            setBooksLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    React.useEffect(() => {
        void loadUsers();
        void loadBooks();
    }, [loadUsers, loadBooks]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await Promise.all([load(), loadUsers(), loadBooks()]);
        } finally {
            setRefreshing(false);
        }
    }

    async function handleCreateReport(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const borrowerId = createBorrowerId.trim();
        const bookId = createBookId.trim();
        const damageType = createDamageType.trim();
        const trimmedFee = createFee.trim();
        const parsedFee = trimmedFee === "" ? 0 : Number(trimmedFee);

        if (!borrowerId) {
            toast.warning("Select a borrower", {
                description: "Choose the borrower who will receive this damage report.",
            });
            return;
        }

        const selectedBorrower = users.find((u) => String(u.id) === borrowerId) || null;
        if (selectedBorrower && !LIABLE_ALLOWED.has(String(selectedBorrower.accountType))) {
            toast.warning("Ineligible borrower", {
                description: "Only Student, Faculty, and Other accounts can receive damage reports.",
            });
            return;
        }

        if (!bookId) {
            toast.warning("Select a book", {
                description: "Choose the returned book with damage.",
            });
            return;
        }

        if (!damageType) {
            toast.warning("Enter damage details", {
                description: "Describe the damage found by the librarian.",
            });
            return;
        }

        if (!Number.isFinite(parsedFee) || parsedFee < 0) {
            toast.warning("Invalid fine amount", {
                description: "Fine must be a number greater than or equal to 0.",
            });
            return;
        }

        setCreateSaving(true);
        try {
            const created = (await createDamageReport({
                liableUserId: /^\d+$/.test(borrowerId) ? Number(borrowerId) : borrowerId,
                bookId: /^\d+$/.test(bookId) ? Number(bookId) : bookId,
                damageType,
                severity: createSeverity,
                fee: parsedFee,
                notes: createNotes.trim() || null,
                photos: createPhotos,
            })) as DamageReportRow;

            setRows((current) => [created, ...current.filter((r) => String(r.id) !== String(created.id))]);
            setCreateBorrowerId("");
            setCreateBookId("");
            setCreateDamageType("");
            setCreateSeverity("minor");
            setCreateFee(String(suggestedFineFromSeverity("minor")));
            setCreateNotes("");
            setCreatePhotos([]);
            setCreatePhotosInputKey((key) => key + 1);

            toast.success("Damage report sent", {
                description: `Report #${created.id} was sent to ${selectedBorrower?.fullName ?? selectedBorrower?.email ?? "the borrower"}.`,
            });
        } catch (err: any) {
            const msg = err?.message || "Failed to send damage report.";
            toast.error("Send failed", { description: msg });
        } finally {
            setCreateSaving(false);
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

    const bookOptions = React.useMemo(() => {
        return books.map((book) => ({
            id: String(book.id),
            label: `${book.title}${book.author ? ` — ${book.author}` : ""}`,
        }));
    }, [books]);

    const selectedCreateBorrower = React.useMemo(() => {
        if (!createBorrowerId) return null;
        return users.find((u) => String(u.id) === createBorrowerId) || null;
    }, [users, createBorrowerId]);

    const selectedCreateBook = React.useMemo(() => {
        if (!createBookId) return null;
        return books.find((book) => String(book.id) === createBookId) || null;
    }, [books, createBookId]);

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

        if (qLower) {
            list = list.filter((r) => matchesSearch(r, qLower));
        }

        return [...list].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    }, [rows, qLower, getUiArchiveInfo]);

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

    const exportRecords = React.useMemo<PrintableDamageRecord[]>(() => {
        const mapRowToPrintable = (
            record: DamageReportRow,
            scopeLabel: "active" | "paid_archive"
        ): PrintableDamageRecord => {
            const anyRecord = record as any;
            const ui = getUiArchiveInfo(record);

            const rawPhotos: string[] = (
                record.photoUrls && record.photoUrls.length ? record.photoUrls : record.photoUrl ? [record.photoUrl] : []
            ).filter(Boolean) as string[];

            return {
                id: record.id,
                reportedBy: getReportedByName(record),
                reportedByEmail:
                    record.studentEmail ??
                    anyRecord.student_email ??
                    anyRecord.reportedByEmail ??
                    null,
                reportedBySchoolId:
                    record.studentId ??
                    anyRecord.student_id ??
                    anyRecord.reportedBySchoolId ??
                    null,
                liableUser: getLiableName(record),
                liableUserEmail:
                    record.liableStudentEmail ??
                    anyRecord.liable_email ??
                    anyRecord.liableUserEmail ??
                    null,
                liableUserSchoolId:
                    record.liableStudentId ??
                    anyRecord.liable_student_id ??
                    anyRecord.liableUserSchoolId ??
                    null,
                bookTitle: record.bookTitle ?? null,
                bookId: record.bookId ?? null,
                damageType: record.damageType ?? null,
                severity: record.severity,
                status: ui.status,
                archived: ui.archived,
                fee: typeof record.fee === "number" ? record.fee : Number(record.fee ?? 0),
                reportedAt: record.reportedAt ?? null,
                paidAt: ui.paidAt ?? null,
                notes: record.notes ?? null,
                photoCount: rawPhotos.length,
                scopeLabel,
            };
        };

        return [
            ...activeList.map((record) => mapRowToPrintable(record, "active")),
            ...paidArchiveList.map((record) => mapRowToPrintable(record, "paid_archive")),
        ];
    }, [activeList, paidArchiveList, getUiArchiveInfo]);

    const exportSubtitle = React.useMemo(() => {
        const searchLabel = search.trim() ? `search: "${search.trim()}"` : "no search filter";

        return `Printable report for the current damage reports view (${searchLabel}).`;
    }, [search]);

    return (
        <DashboardLayout title="Damage Reports">
            <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold leading-tight text-white">Damage Reports</h2>
                        <p className="mt-1 text-xs text-white/65">
                            Review reported book damage, assess liability, and archive reports after payment.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 text-xs text-white/70 sm:flex-row sm:items-center">
                        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-amber-100">
                            Active: {counts.activeCount}
                        </span>
                        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                            Paid archive: {counts.paidCount}
                        </span>
                    </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by user, book, damage type, notes, or paid date…"
                            className="border-white/20 bg-slate-950/60 pl-9 text-white placeholder:text-white/45"
                        />
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

            <form
                onSubmit={handleCreateReport}
                className="mb-4 rounded-xl border border-white/10 bg-slate-900/40 p-4"
            >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h3 className="text-base font-semibold leading-tight text-white">Send damage report to borrower</h3>
                        <p className="mt-1 text-xs text-white/65">
                            Create the report as the librarian, assign the liable borrower, and make it readable in the borrower account.
                        </p>
                    </div>
                    <Button
                        type="submit"
                        className="bg-amber-600 text-white hover:bg-amber-700"
                        disabled={createSaving || usersLoading || booksLoading}
                    >
                        {createSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        Send Report
                    </Button>
                </div>

                {(usersError || booksError) && (
                    <div className="mt-3 rounded-md border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                        {usersError || booksError}
                    </div>
                )}

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/80">Borrower</label>
                        <select
                            value={createBorrowerId}
                            onChange={(event) => setCreateBorrowerId(event.target.value)}
                            className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                            disabled={createSaving || usersLoading}
                        >
                            <option value="" className="bg-slate-950 text-white">
                                {usersLoading ? "Loading borrowers…" : "Select borrower"}
                            </option>
                            {eligibleUsers.map((user) => (
                                <option key={user.id} value={String(user.id)} className="bg-slate-950 text-white">
                                    {user.fullName ?? "Unnamed user"}
                                    {user.email ? ` — ${user.email}` : ""}
                                    {user.accountType ? ` (${user.accountType})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/80">Returned book</label>
                        <select
                            value={createBookId}
                            onChange={(event) => setCreateBookId(event.target.value)}
                            className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                            disabled={createSaving || booksLoading}
                        >
                            <option value="" className="bg-slate-950 text-white">
                                {booksLoading ? "Loading books…" : "Select book"}
                            </option>
                            {bookOptions.map((book) => (
                                <option key={book.id} value={book.id} className="bg-slate-950 text-white">
                                    {book.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/80">Damage found</label>
                        <Input
                            value={createDamageType}
                            onChange={(event) => setCreateDamageType(event.target.value)}
                            placeholder="Example: torn pages, water damage, broken cover"
                            className="border-white/20 bg-slate-950/60 text-white placeholder:text-white/45"
                            disabled={createSaving}
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-white/80">Severity</label>
                            <select
                                value={createSeverity}
                                onChange={(event) => {
                                    const nextSeverity = event.target.value as Severity;
                                    setCreateSeverity(nextSeverity);
                                    setCreateFee(String(suggestedFineFromSeverity(nextSeverity)));
                                }}
                                className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                                disabled={createSaving}
                            >
                                <option value="minor" className="bg-slate-950 text-white">Minor</option>
                                <option value="moderate" className="bg-slate-950 text-white">Moderate</option>
                                <option value="major" className="bg-slate-950 text-white">Major</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-white/80">Fine</label>
                            <Input
                                value={createFee}
                                onChange={(event) => setCreateFee(event.target.value)}
                                inputMode="decimal"
                                placeholder="0"
                                className="border-white/20 bg-slate-950/60 text-white placeholder:text-white/45"
                                disabled={createSaving}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-xs font-medium text-white/80">Notes</label>
                        <textarea
                            value={createNotes}
                            onChange={(event) => setCreateNotes(event.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                            placeholder="Add exact damage details to send to the borrower."
                            disabled={createSaving}
                        />
                    </div>

                    <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-xs font-medium text-white/80">Damage photos</label>
                        <Input
                            key={createPhotosInputKey}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => {
                                const files = Array.from(event.target.files ?? []).slice(0, 3);
                                setCreatePhotos(files);
                            }}
                            className="border-white/20 bg-slate-950/60 text-white file:mr-3 file:rounded-md file:border-0 file:bg-amber-500/20 file:px-3 file:py-1.5 file:text-xs file:text-amber-100"
                            disabled={createSaving}
                        />
                    </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-white/70 sm:grid-cols-3">
                    <div className="rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
                        <span className="text-white/45">Reported by:</span>{" "}
                        <span className="font-medium text-white">Current librarian account</span>
                    </div>
                    <div className="rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
                        <span className="text-white/45">Borrower:</span>{" "}
                        <span className="font-medium text-white">
                            {selectedCreateBorrower?.fullName ?? selectedCreateBorrower?.email ?? "Not selected"}
                        </span>
                    </div>
                    <div className="rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
                        <span className="text-white/45">Book:</span>{" "}
                        <span className="font-medium text-white">
                            {selectedCreateBook?.title ?? "Not selected"}
                        </span>
                    </div>
                </div>
            </form>

            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
                <div className="text-xs text-white/65">
                    Export uses the current filtered list from both <span className="font-semibold text-white/85">Active</span> and{" "}
                    <span className="font-semibold text-white/85">Paid archive</span> sections.
                </div>

                <Button
                    type="button"
                    onClick={() => setExportPreviewOpen(true)}
                    className="bg-sky-600 hover:bg-sky-700 text-white"
                    disabled={loading || (!!error && exportRecords.length === 0)}
                >
                    <FileText className="mr-2 h-4 w-4" />
                    Preview / Export PDF
                </Button>
            </div>

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

            <ExportPreviewDamageReports
                open={exportPreviewOpen}
                onOpenChange={setExportPreviewOpen}
                records={exportRecords}
                fileNamePrefix="bookhive-damage-reports"
                reportTitle="BookHive Library • Damage Reports"
                reportSubtitle={exportSubtitle}
            />
        </DashboardLayout>
    );
}