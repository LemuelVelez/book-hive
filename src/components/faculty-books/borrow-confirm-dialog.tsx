import { Loader2, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "@/components/ui/alert-dialog"

import type { BookWithStatus } from "@/components/faculty-books/types"
import {
    clampInt,
    fmtDurationDays,
    getSubjects,
} from "@/components/faculty-books/utils"

type FacultyBorrowConfirmDialogProps = {
    book: BookWithStatus
    open: boolean
    onOpenChange: (open: boolean) => void
    quantity: number
    onQuantityChange: (value: number) => void
    busy: boolean
    onConfirm: (quantity: number) => void
    maxCopies: number
    triggerLabel: string
    triggerDisabled?: boolean
}

export function FacultyBorrowConfirmDialog({
    book,
    open,
    onOpenChange,
    quantity,
    onQuantityChange,
    busy,
    onConfirm,
    maxCopies,
    triggerLabel,
    triggerDisabled = false,
}: FacultyBorrowConfirmDialogProps) {
    const safeMaxCopies = Math.max(1, maxCopies)
    const qty = clampInt(quantity, 1, safeMaxCopies)

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogTrigger asChild>
                <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    disabled={busy || triggerDisabled || maxCopies <= 0}
                >
                    {triggerLabel}
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm borrow</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/70">
                        You are about to borrow{" "}
                        <span className="font-semibold text-white">“{book.title}”</span> by{" "}
                        <span className="font-semibold text-white">{book.author || "—"}</span>.
                        Please confirm the details below.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="mt-3 text-sm text-white/80 space-y-1">
                    <p>
                        <span className="text-white/60">Call no.:</span> {book.callNumber || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Accession #:</span>{" "}
                        {book.accessionNumber || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Subtitle:</span> {book.subtitle || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Publication year:</span>{" "}
                        {book.publicationYear || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">ISBN:</span> {book.isbn || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Edition:</span> {book.edition || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Publisher:</span> {book.publisher || "—"}
                    </p>
                    <p>
                        <span className="text-white/60">Subjects:</span> {getSubjects(book)}
                    </p>
                    <p>
                        <span className="text-white/60">Default loan duration:</span>{" "}
                        {fmtDurationDays(book.borrowDurationDays)}
                    </p>

                    <div className="pt-3">
                        <div className="text-xs font-medium text-white/80 mb-1">
                            Copies to borrow
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="border-white/20 text-white hover:bg-white/10"
                                onClick={() =>
                                    onQuantityChange(clampInt(qty - 1, 1, safeMaxCopies))
                                }
                                disabled={busy || qty <= 1}
                                aria-label="Decrease copies"
                            >
                                <Minus className="h-4 w-4" aria-hidden="true" />
                            </Button>

                            <Input
                                value={String(qty)}
                                onChange={(e) =>
                                    onQuantityChange(
                                        clampInt(Number(e.target.value), 1, safeMaxCopies)
                                    )
                                }
                                inputMode="numeric"
                                className="w-16 h-9 text-center bg-slate-900/70 border-white/20 text-white"
                                aria-label="Copies to borrow"
                                disabled={busy}
                            />

                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="border-white/20 text-white hover:bg-white/10"
                                onClick={() =>
                                    onQuantityChange(clampInt(qty + 1, 1, safeMaxCopies))
                                }
                                disabled={busy || qty >= safeMaxCopies}
                                aria-label="Increase copies"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                            </Button>

                            <span className="text-xs text-white/60">Max {safeMaxCopies}</span>
                        </div>
                        <p className="text-[11px] text-white/60 mt-1">
                            Remaining copies available right now: {maxCopies}.
                        </p>
                    </div>

                    <p className="text-xs text-white/60 mt-2">
                        The due date will be set automatically based on the library policy.
                        Any overdue days may incur fines.
                    </p>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel
                        className="border-white/20 text-white hover:bg-black/20"
                        disabled={busy}
                    >
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        disabled={busy || maxCopies <= 0}
                        onClick={() => onConfirm(qty)}
                    >
                        {busy ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Borrowing…
                            </span>
                        ) : (
                            "Confirm borrow"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}