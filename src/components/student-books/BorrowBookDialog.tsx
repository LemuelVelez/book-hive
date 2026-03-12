import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Minus, Plus } from "lucide-react";

import type { BookWithStatus } from "@/components/student-books/types";
import {
    clampInt,
    fmtDurationDays,
    fmtLibraryArea,
    getBorrowedCopies,
    getHistoricalBorrowCount,
    getSubjects,
    getTotalCopies,
    isLibraryUseOnly,
} from "@/components/student-books/utils";

type BorrowBookDialogProps = {
    book: BookWithStatus;
    maxCopies: number;
    busy: boolean;
    triggerLabel: string;
    onConfirm: (book: BookWithStatus, copiesRequested: number) => Promise<boolean>;
};

export default function BorrowBookDialog({
    book,
    maxCopies,
    busy,
    triggerLabel,
    onConfirm,
}: BorrowBookDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [qty, setQty] = React.useState(1);

    const safeMaxCopies = Math.max(1, maxCopies);
    const safeQty = clampInt(qty, 1, safeMaxCopies);
    const libraryUseOnly = isLibraryUseOnly(book);
    const totalCopies = getTotalCopies(book);
    const borrowedCopies = getBorrowedCopies(book);
    const historicalBorrowCount = getHistoricalBorrowCount(book);

    const stopPointerPropagation = React.useCallback(
        (e: React.PointerEvent<HTMLElement>) => {
            e.stopPropagation();
        },
        []
    );

    const stopMousePropagation = React.useCallback(
        (e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation();
        },
        []
    );

    React.useEffect(() => {
        if (!open) {
            setQty(1);
            return;
        }

        if (qty !== safeQty) {
            setQty(safeQty);
        }
    }, [open, qty, safeQty]);

    async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
        e.stopPropagation();

        if (busy || maxCopies <= 0 || libraryUseOnly) return;

        const ok = await onConfirm(book, safeQty);

        if (ok) {
            setOpen(false);
            setQty(1);
        }
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (busy && !nextOpen) return;

                setOpen(nextOpen);
                if (!nextOpen) {
                    setQty(1);
                }
            }}
        >
            <AlertDialogTrigger asChild>
                <Button
                    type="button"
                    size="sm"
                    data-no-drag-scroll="true"
                    onPointerDown={stopPointerPropagation}
                    onClick={stopMousePropagation}
                    className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                    disabled={busy || maxCopies <= 0 || libraryUseOnly}
                >
                    {triggerLabel}
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent
                data-no-drag-scroll="true"
                onPointerDownCapture={stopPointerPropagation}
                onClick={stopMousePropagation}
                className="border-white/10 bg-slate-900 text-white"
            >
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm borrow</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/70">
                        You are about to borrow{" "}
                        <span className="font-semibold text-white">“{book.title}”</span>{" "}
                        by{" "}
                        <span className="font-semibold text-white">
                            {book.author || "—"}
                        </span>
                        . Please confirm the details below.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="mt-3 space-y-1 text-sm text-white/80">
                    <p>
                        <span className="text-white/60">Call no.:</span>{" "}
                        {book.callNumber || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Accession #:</span>{" "}
                        {book.accessionNumber || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Library area:</span>{" "}
                        {fmtLibraryArea(book.libraryArea)}
                    </p>
                    <p>
                        <span className="text-white/60">Borrowing policy:</span>{" "}
                        {libraryUseOnly ? "Library use only" : "Borrowable"}
                    </p>
                    <p>
                        <span className="text-white/60">ISBN:</span> {book.isbn || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Edition:</span>{" "}
                        {book.edition || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Publisher:</span>{" "}
                        {book.publisher || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Subjects:</span>{" "}
                        {getSubjects(book)}
                    </p>
                    <p>
                        <span className="text-white/60">Publication year:</span>{" "}
                        {book.publicationYear || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Tracked now:</span>{" "}
                        {borrowedCopies}
                        {totalCopies > 0
                            ? ` of ${totalCopies} cop${totalCopies === 1 ? "y" : "ies"} currently borrowed`
                            : " currently borrowed"}
                    </p>
                    <p>
                        <span className="text-white/60">Recorded borrow history:</span>{" "}
                        {historicalBorrowCount === null
                            ? "—"
                            : `${historicalBorrowCount} borrow${historicalBorrowCount === 1 ? "" : "s"}`}
                    </p>
                    <p>
                        <span className="text-white/60">Default loan duration:</span>{" "}
                        {fmtDurationDays(book.borrowDurationDays)}
                    </p>

                    <div className="pt-3">
                        <div className="mb-1 text-xs font-medium text-white/80">
                            Copies to borrow
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                data-no-drag-scroll="true"
                                onPointerDown={stopPointerPropagation}
                                onClick={(e) => {
                                    stopMousePropagation(e);
                                    setQty((value) => clampInt(value - 1, 1, safeMaxCopies));
                                }}
                                className="border-white/20 text-white hover:bg-white/10"
                                disabled={busy || safeQty <= 1 || libraryUseOnly}
                                aria-label="Decrease copies"
                            >
                                <Minus className="h-4 w-4" aria-hidden="true" />
                            </Button>

                            <Input
                                value={String(safeQty)}
                                onChange={(e) =>
                                    setQty(
                                        clampInt(
                                            Number(e.target.value),
                                            1,
                                            safeMaxCopies
                                        )
                                    )
                                }
                                onPointerDown={stopPointerPropagation}
                                onClick={stopMousePropagation}
                                data-no-drag-scroll="true"
                                inputMode="numeric"
                                className="h-9 w-16 border-white/20 bg-slate-900/70 text-center text-white"
                                aria-label="Copies to borrow"
                                disabled={busy || libraryUseOnly}
                            />

                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                data-no-drag-scroll="true"
                                onPointerDown={stopPointerPropagation}
                                onClick={(e) => {
                                    stopMousePropagation(e);
                                    setQty((value) => clampInt(value + 1, 1, safeMaxCopies));
                                }}
                                className="border-white/20 text-white hover:bg-white/10"
                                disabled={busy || safeQty >= safeMaxCopies || libraryUseOnly}
                                aria-label="Increase copies"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                            </Button>

                            <span className="text-xs text-white/60">Max {maxCopies}</span>
                        </div>

                        <p className="mt-1 text-[11px] text-white/60">
                            Remaining copies available right now: {maxCopies}.
                        </p>
                    </div>

                    <p className="mt-2 text-xs text-white/60">
                        The due date will be set automatically based on the library
                        policy. Any overdue days may incur fines.
                    </p>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel
                        data-no-drag-scroll="true"
                        onPointerDown={stopPointerPropagation}
                        onClick={stopMousePropagation}
                        className="border-white/20 text-white hover:bg-black/20"
                        disabled={busy}
                    >
                        Cancel
                    </AlertDialogCancel>

                    <Button
                        type="button"
                        data-no-drag-scroll="true"
                        onPointerDown={stopPointerPropagation}
                        onClick={handleConfirm}
                        className="bg-purple-600 text-white hover:bg-purple-700"
                        disabled={busy || maxCopies <= 0 || libraryUseOnly}
                    >
                        {busy ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                />
                                Borrowing…
                            </span>
                        ) : (
                            "Confirm borrow"
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}