import { Loader2, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    formatDamageInfo,
    getLiableName,
    getReportedByName,
    toAbsoluteUrl,
} from "./helpers";

import type { DamageListMode, DamageReportRow, UiArchiveInfo } from "./types";

type DamageReportsSectionProps = {
    title: string;
    description: string;
    loading: boolean;
    error: string | null;
    list: DamageReportRow[];
    mode: DamageListMode;
    updatingId: string | null;
    deletingId: string | null;
    getUiArchiveInfo: (report: DamageReportRow) => UiArchiveInfo;
    onOpenPhotoDialog: (images: string[], startIndex?: number) => void;
    onOpenAssessDialog: (report: DamageReportRow) => void;
    onStatusStep: (report: DamageReportRow) => void | Promise<void>;
    onDelete: (report: DamageReportRow) => void | Promise<void>;
};

export function DamageReportsSection({
    title,
    description,
    loading,
    error,
    list,
    mode,
    updatingId,
    deletingId,
    getUiArchiveInfo,
    onOpenPhotoDialog,
    onOpenAssessDialog,
    onStatusStep,
    onDelete,
}: DamageReportsSectionProps) {
    function renderDesktopTable(items: DamageReportRow[]) {
        return (
            <Table>
                <TableCaption className="text-xs text-white/60">
                    Showing {items.length} {items.length === 1 ? "entry" : "entries"}.
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
                    {items.map((r) => {
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
                                                onClick={() => onOpenPhotoDialog(absPhotos, 0)}
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
                                                    onClick={() => onOpenPhotoDialog(absPhotos, 0)}
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
                                            onClick={() => onOpenAssessDialog(r)}
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
                                                onClick={() => onStatusStep(r)}
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
                                                        onClick={() => onDelete(r)}
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

    function renderMobileCards(items: DamageReportRow[]) {
        return (
            <div className="space-y-3">
                {items.map((r) => {
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
                                            onClick={() => onOpenPhotoDialog(absPhotos, 0)}
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
                                                onClick={() => onOpenPhotoDialog(absPhotos, 0)}
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
                                    onClick={() => onOpenAssessDialog(r)}
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
                                        onClick={() => onStatusStep(r)}
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
                                                onClick={() => onDelete(r)}
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

    const emptyMessage =
        mode === "paid"
            ? "No paid/archived records yet."
            : "No active damage reports found.";

    const emptySubMessage =
        mode === "paid"
            ? null
            : "Paid reports are shown in the Paid Archive section below.";

    return (
        <Card className={mode === "paid" ? "mt-4 bg-slate-800/40 border-white/10" : "bg-slate-800/60 border-white/10"}>
            <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <CardTitle>{title}</CardTitle>
                    <div className="text-xs text-white/60">{description}</div>
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
                ) : list.length === 0 ? (
                    <div className="py-10 text-center text-sm text-white/70">
                        {emptyMessage}
                        {emptySubMessage ? <div className="text-xs text-white/60 mt-1">{emptySubMessage}</div> : null}
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block">{renderDesktopTable(list)}</div>
                        <div className="md:hidden">{renderMobileCards(list)}</div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}