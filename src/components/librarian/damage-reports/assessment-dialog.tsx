import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { UserListItemDTO } from "@/lib/authentication";
import type { DamageStatus } from "@/lib/damageReports";
import type { DamageReportRow, Severity, UiArchiveInfo } from "./types";
import {
    fmtDate,
    getLiableName,
    getReportedByName,
    peso,
    suggestedFineFromSeverity,
    userDisplayLabel,
} from "./helpers";

type AssessmentDialogProps = {
    open: boolean;
    assessReport: DamageReportRow | null;
    assessUi: UiArchiveInfo;
    assessSeverity: Severity;
    onAssessSeverityChange: (value: Severity) => void;
    assessStatus: DamageStatus;
    onAssessStatusChange: (value: DamageStatus) => void;
    assessFee: string;
    onAssessFeeChange: (value: string) => void;
    assessNotes: string;
    onAssessNotesChange: (value: string) => void;
    assessLiableUserId: string;
    onAssessLiableUserIdChange: (value: string) => void;
    users: UserListItemDTO[];
    eligibleUsers: UserListItemDTO[];
    filteredUsers: UserListItemDTO[];
    usersLoading: boolean;
    usersError: string | null;
    liableUserQuery: string;
    onLiableUserQueryChange: (value: string) => void;
    selectedLiableUser: UserListItemDTO | null;
    assessSaving: boolean;
    liableNoneValue: string;
    onRetryLoadUsers: () => void | Promise<void>;
    onClose: () => void;
    onSave: () => void | Promise<void>;
    onUseSuggestedFine: () => void;
    onUseReportedByUser: () => void;
    onClearLiableUser: () => void;
};

export function AssessmentDialog({
    open,
    assessReport,
    assessUi,
    assessSeverity,
    onAssessSeverityChange,
    assessStatus,
    onAssessStatusChange,
    assessFee,
    onAssessFeeChange,
    assessNotes,
    onAssessNotesChange,
    assessLiableUserId,
    onAssessLiableUserIdChange,
    filteredUsers,
    usersLoading,
    usersError,
    liableUserQuery,
    onLiableUserQueryChange,
    selectedLiableUser,
    assessSaving,
    liableNoneValue,
    onRetryLoadUsers,
    onClose,
    onSave,
    onUseSuggestedFine,
    onUseReportedByUser,
    onClearLiableUser,
}: AssessmentDialogProps) {
    const dialogScrollbarClasses =
        "[scrollbar-width:thin] [scrollbar-color:#334155_transparent] " +
        "[&::-webkit-scrollbar]:w-2 " +
        "[&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose();
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

                <div className={`max-h-[calc(72vh-4.25rem)] overflow-y-auto pr-2 ${dialogScrollbarClasses}`}>
                    {assessReport ? (
                        <div className="mt-3 space-y-4 text-sm">
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
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">Severity</label>
                                        <Select
                                            value={assessSeverity}
                                            onValueChange={(v) => onAssessSeverityChange(v as Severity)}
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
                                            onValueChange={(v) => onAssessStatusChange(v as DamageStatus)}
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

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80">
                                            Liable user <span className="text-white/40">(student / faculty / other only)</span>
                                        </label>

                                        <div className="space-y-2">
                                            <Input
                                                value={liableUserQuery}
                                                onChange={(e) => onLiableUserQueryChange(e.target.value)}
                                                placeholder="Filter users by name / email / ID…"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                disabled={assessSaving || assessUi.archived || assessUi.status === "paid" || usersLoading}
                                            />

                                            <Select
                                                value={assessLiableUserId ? assessLiableUserId : liableNoneValue}
                                                onValueChange={(v) => onAssessLiableUserIdChange(v === liableNoneValue ? "" : v)}
                                                disabled={assessSaving || assessUi.archived || assessUi.status === "paid" || usersLoading}
                                            >
                                                <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                                    <SelectValue placeholder={usersLoading ? "Loading users…" : "Select a user"} />
                                                </SelectTrigger>

                                                <SelectContent className="bg-slate-900 text-white border-white/10 max-h-80">
                                                    <SelectItem value={liableNoneValue}>Unassigned (no liable user)</SelectItem>

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
                                                            onClick={onRetryLoadUsers}
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
                                                    onClick={onUseReportedByUser}
                                                    disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
                                                >
                                                    Use reported-by user
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-[11px] text-white/60 hover:text-white/90 underline-offset-2 hover:underline disabled:opacity-50"
                                                    onClick={onClearLiableUser}
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
                                            onChange={(e) => onAssessNotesChange(e.target.value)}
                                            rows={4}
                                            className="w-full rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                                            placeholder="Example: Damage existed before this borrower; previous borrower is liable."
                                            disabled={assessSaving || assessUi.archived || assessUi.status === "paid"}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-white/80 flex items-center justify-between gap-2">
                                            Assessed fine (₱)
                                            <span className="text-[10px] text-white/50">Set 0 if no fine</span>
                                        </label>
                                        <Input
                                            value={assessFee}
                                            onChange={(e) => onAssessFeeChange(e.target.value)}
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
                                            onClick={onUseSuggestedFine}
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
                                    onClick={onClose}
                                >
                                    Close
                                </Button>

                                {!(assessUi.archived || assessUi.status === "paid") ? (
                                    <Button
                                        type="button"
                                        className="bg-amber-600 hover:bg-amber-700 text-white"
                                        disabled={assessSaving}
                                        onClick={onSave}
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
    );
}