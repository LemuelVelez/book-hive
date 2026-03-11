import {
    CheckCircle2,
    CircleOff,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { FacultyBorrowConfirmDialog } from "@/components/faculty-books/borrow-confirm-dialog"
import {
    FacultyBookActionState,
    FacultyBookStatus,
} from "@/components/faculty-books/book-status"
import type { BookWithStatus } from "@/components/faculty-books/types"
import {
    getBookBorrowMeta,
    getRemainingCopies,
    isBorrowable,
} from "@/components/faculty-books/utils"

type FacultyBooksMobileListProps = {
    rows: BookWithStatus[]
    borrowBusyId: string | null
    borrowDialogBookId: string | null
    borrowCopies: number
    onBorrowDialogBookChange: (bookId: string | null) => void
    onBorrowCopiesChange: (value: number) => void
    onBorrow: (book: BookWithStatus, copiesRequested: number) => void | Promise<void>
    facultyMaxActiveBorrows: number
    defaultBorrowDurationDays: number
    activeBorrowCount: number
    remainingBorrowSlots: number
}

export function FacultyBooksMobileList({
    rows,
    borrowBusyId,
    borrowDialogBookId,
    borrowCopies,
    onBorrowDialogBookChange,
    onBorrowCopiesChange,
    onBorrow,
    facultyMaxActiveBorrows,
    defaultBorrowDurationDays,
    activeBorrowCount,
    remainingBorrowSlots,
}: FacultyBooksMobileListProps) {
    return (
        <div className="md:hidden space-y-3 mt-2">
            {rows.map((book) => {
                const remaining = getRemainingCopies(book)
                const borrowableNow = isBorrowable(book)
                const maxCopies = Math.min(remaining, remainingBorrowSlots)
                const canBorrowThisBook = borrowableNow && maxCopies > 0
                const borrowBtnLabel =
                    book.activeRecords.length > 0 ? "Borrow more" : "Borrow"
                const { activeRecords, dueCell } = getBookBorrowMeta(book)

                return (
                    <div
                        key={book.id}
                        className="rounded-lg border border-white/10 bg-slate-900/80 p-3 space-y-3"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-white wrap-break-word">
                                    {book.title}
                                </div>
                                {book.subtitle ? (
                                    <div className="text-[11px] text-white/60 wrap-break-word">
                                        {book.subtitle}
                                    </div>
                                ) : null}
                                <div className="text-[11px] text-white/60 wrap-break-word">
                                    {book.author}
                                </div>
                            </div>

                            <Badge
                                variant={borrowableNow ? "default" : "outline"}
                                className={
                                    borrowableNow
                                        ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80 shrink-0"
                                        : "border-red-400/70 text-red-200 hover:bg-red-500/10 shrink-0"
                                }
                            >
                                {borrowableNow ? (
                                    <span className="inline-flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                        Available{" "}
                                        <span className="opacity-80">({remaining} left)</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1">
                                        <CircleOff className="h-3 w-3" aria-hidden="true" />
                                        Unavailable
                                    </span>
                                )}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-white/70">
                            <div>
                                <div className="uppercase text-white/40">Call no.</div>
                                <div className="text-white/85 wrap-break-word">
                                    {book.callNumber || <span className="opacity-50">—</span>}
                                </div>
                            </div>

                            <div>
                                <div className="uppercase text-white/40">Acc. no.</div>
                                <div className="text-white/85 wrap-break-word">
                                    {book.accessionNumber || (
                                        <span className="opacity-50">—</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="uppercase text-white/40">Sub.</div>
                                <div className="text-white/85 wrap-break-word">
                                    {book.subtitle || <span className="opacity-50">—</span>}
                                </div>
                            </div>

                            <div>
                                <div className="uppercase text-white/40">Pub. year</div>
                                <div className="text-white/85">
                                    {book.publicationYear || <span className="opacity-50">—</span>}
                                </div>
                            </div>

                            <div>
                                <div className="uppercase text-white/40">ISBN</div>
                                <div className="text-white/85 wrap-break-word">
                                    {book.isbn || <span className="opacity-50">—</span>}
                                </div>
                            </div>

                            <div>
                                <div className="uppercase text-white/40">Subjects</div>
                                <div className="text-white/85 wrap-break-word">
                                    {book.subjects ||
                                        book.genre ||
                                        book.category ||
                                        <span className="opacity-50">—</span>}
                                </div>
                            </div>

                            <div className="col-span-2">
                                <div className="uppercase text-white/40">Due date</div>
                                <div className="text-white/85 wrap-break-word">
                                    {dueCell === "—" ? <span className="opacity-50">—</span> : dueCell}
                                </div>
                            </div>
                        </div>

                        <div className="text-[11px] text-white/70">
                            <FacultyBookStatus book={book} />
                        </div>

                        <div className="flex justify-end pt-1">
                            {canBorrowThisBook ? (
                                <FacultyBorrowConfirmDialog
                                    book={book}
                                    open={borrowDialogBookId === book.id}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            onBorrowDialogBookChange(book.id)
                                            onBorrowCopiesChange(1)
                                        } else {
                                            onBorrowDialogBookChange(null)
                                            onBorrowCopiesChange(1)
                                        }
                                    }}
                                    quantity={borrowDialogBookId === book.id ? borrowCopies : 1}
                                    onQuantityChange={onBorrowCopiesChange}
                                    busy={borrowBusyId === book.id}
                                    onConfirm={(qty) => void onBorrow(book, qty)}
                                    maxCopies={maxCopies}
                                    remainingBorrowSlots={remainingBorrowSlots}
                                    facultyMaxActiveBorrows={facultyMaxActiveBorrows}
                                    defaultBorrowDurationDays={defaultBorrowDurationDays}
                                    triggerLabel={borrowBtnLabel}
                                    triggerDisabled={maxCopies <= 0}
                                />
                            ) : borrowableNow && remainingBorrowSlots <= 0 ? (
                                <span className="inline-flex flex-col items-end text-xs text-white/70">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled
                                        className="border-white/20 text-white/60"
                                    >
                                        Limit reached
                                    </Button>
                                    <span className="mt-1 text-right">
                                        You already have {activeBorrowCount}/
                                        {facultyMaxActiveBorrows} active books.
                                    </span>
                                </span>
                            ) : activeRecords.length > 0 ? (
                                <span className="inline-flex flex-col items-end text-xs text-amber-200">
                                    <FacultyBookActionState book={book} />
                                </span>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="border-white/20 text-white/60"
                                >
                                    Not available
                                </Button>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}