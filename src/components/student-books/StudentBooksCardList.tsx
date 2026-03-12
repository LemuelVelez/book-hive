import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertTriangle,
    CheckCircle2,
    CircleOff,
    Clock3,
} from "lucide-react";

import type { BookWithStatus } from "@/components/student-books/types";
import {
    fmtDate,
    fmtDurationDays,
    fmtLibraryArea,
    getBookBorrowMeta,
    getBorrowedCopies,
    getHistoricalBorrowCount,
    getSubjects,
    getTotalCopies,
    isLibraryUseOnly,
    peso,
} from "@/components/student-books/utils";
import BorrowBookDialog from "@/components/student-books/BorrowBookDialog";

type StudentBooksCardListProps = {
    rows: BookWithStatus[];
    borrowBusyId: string | null;
    onBorrow: (book: BookWithStatus, copiesRequested: number) => Promise<boolean>;
};

export default function StudentBooksCardList({
    rows,
    borrowBusyId,
    onBorrow,
}: StudentBooksCardListProps) {
    return (
        <div className="mt-2 space-y-3 md:hidden">
            {rows.map((book) => {
                const {
                    activeRecords,
                    pendingPickupRecords,
                    borrowedRecords,
                    pendingReturnRecords,
                    totalFine,
                    earliestDue,
                    overdueDaysMax,
                    hasOverdue,
                    dueCell,
                    remaining,
                    borrowableNow,
                    borrowBtnLabel,
                } = getBookBorrowMeta(book);

                const maxCopies = remaining;
                const libraryUseOnly = isLibraryUseOnly(book);
                const totalCopies = getTotalCopies(book);
                const borrowedCopies = getBorrowedCopies(book);
                const historicalBorrowCount = getHistoricalBorrowCount(book);

                return (
                    <div
                        key={book.id}
                        className="space-y-3 rounded-lg border border-white/10 bg-slate-900/80 p-3"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="wrap-break-word text-sm font-semibold text-white">
                                    {book.title}
                                </div>

                                {book.subtitle ? (
                                    <div className="wrap-break-word text-[11px] text-white/60">
                                        {book.subtitle}
                                    </div>
                                ) : null}

                                <div className="wrap-break-word text-[11px] text-white/60">
                                    {book.author || "—"}
                                </div>
                            </div>

                            <Badge
                                variant={
                                    libraryUseOnly
                                        ? "secondary"
                                        : borrowableNow
                                            ? "default"
                                            : "outline"
                                }
                                className={
                                    libraryUseOnly
                                        ? "border-amber-300/70 bg-amber-500/15 text-amber-100 hover:bg-amber-500/15"
                                        : borrowableNow
                                            ? "border-emerald-400/80 bg-emerald-500/80 text-white hover:bg-emerald-500"
                                            : "border-red-400/70 text-red-200 hover:bg-red-500/10"
                                }
                            >
                                {libraryUseOnly ? (
                                    <span className="inline-flex items-center gap-1">
                                        <CircleOff className="h-3 w-3" aria-hidden="true" />
                                        Library use only
                                    </span>
                                ) : borrowableNow ? (
                                    <span className="inline-flex items-center gap-1">
                                        <CheckCircle2
                                            className="h-3 w-3"
                                            aria-hidden="true"
                                        />
                                        Available{" "}
                                        <span className="opacity-80">
                                            ({remaining} left)
                                        </span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1">
                                        <CircleOff
                                            className="h-3 w-3"
                                            aria-hidden="true"
                                        />
                                        Unavailable
                                    </span>
                                )}
                            </Badge>
                        </div>

                        <div className="text-[11px] text-white/70">
                            {libraryUseOnly && activeRecords.length === 0 && (
                                <span className="text-amber-100/80">
                                    This title is visible in the catalog for in-library reading
                                    only.
                                </span>
                            )}

                            {!libraryUseOnly &&
                                activeRecords.length === 0 &&
                                book.myStatus === "never" && <span>Not yet borrowed</span>}

                            {activeRecords.length > 0 && (
                                <>
                                    {pendingPickupRecords.length > 0 && (
                                        <span>
                                            <span className="inline-flex items-center gap-1 text-amber-200">
                                                <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                Pending pickup ×{pendingPickupRecords.length}
                                            </span>
                                            <br />
                                            Earliest due:{" "}
                                            <span className="font-medium">{earliestDue}</span>
                                        </span>
                                    )}

                                    {borrowedRecords.length > 0 && !hasOverdue && (
                                        <span>
                                            <span className="inline-flex items-center gap-1 text-amber-200">
                                                <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                Borrowed ×{borrowedRecords.length}
                                            </span>
                                            <br />
                                            Earliest due:{" "}
                                            <span className="font-medium">{earliestDue}</span>
                                        </span>
                                    )}

                                    {borrowedRecords.length > 0 && hasOverdue && (
                                        <span>
                                            <span className="inline-flex items-center gap-1 text-red-300">
                                                <AlertTriangle
                                                    className="h-3 w-3"
                                                    aria-hidden="true"
                                                />
                                                Overdue
                                            </span>
                                            <br />
                                            Max overdue by{" "}
                                            <span className="font-semibold">
                                                {overdueDaysMax} day
                                                {overdueDaysMax === 1 ? "" : "s"}
                                            </span>
                                            .
                                        </span>
                                    )}

                                    {pendingReturnRecords.length > 0 && (
                                        <>
                                            <br />
                                            <span className="text-white/60">
                                                Return requested ×{pendingReturnRecords.length}
                                            </span>
                                        </>
                                    )}

                                    {totalFine > 0 && (
                                        <>
                                            <br />
                                            <span className="text-red-300">
                                                Fine total: {peso(totalFine)}
                                            </span>
                                        </>
                                    )}
                                </>
                            )}

                            {activeRecords.length === 0 &&
                                book.myStatus === "returned" &&
                                book.lastReturnedRecord && (
                                    <span>
                                        <span className="inline-flex items-center gap-1 text-emerald-200">
                                            <CheckCircle2
                                                className="h-3 w-3"
                                                aria-hidden="true"
                                            />
                                            Returned
                                        </span>
                                        <br />
                                        Last returned:{" "}
                                        <span className="font-medium">
                                            {fmtDate(book.lastReturnedRecord.returnDate)}
                                        </span>
                                    </span>
                                )}
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-white/70">
                            <div>
                                <div className="text-[10px] uppercase text-white/40">
                                    Call no.
                                </div>
                                <div className="wrap-break-word text-xs">
                                    {book.callNumber || <span className="opacity-50">—</span>}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase text-white/40">
                                    Acc. no.
                                </div>
                                <div className="wrap-break-word text-xs">
                                    {book.accessionNumber || (
                                        <span className="opacity-50">—</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase text-white/40">
                                    Sub.
                                </div>
                                <div className="wrap-break-word text-xs">
                                    {getSubjects(book)}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase text-white/40">
                                    Pub. year
                                </div>
                                <div className="text-xs">
                                    {book.publicationYear || (
                                        <span className="opacity-50">—</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase text-white/40">
                                    ISBN
                                </div>
                                <div className="wrap-break-word text-xs">
                                    {book.isbn || <span className="opacity-50">—</span>}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase text-white/40">
                                    Area
                                </div>
                                <div className="wrap-break-word text-xs">
                                    {fmtLibraryArea(book.libraryArea)}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase text-white/40">
                                    Policy
                                </div>
                                <div className="wrap-break-word text-xs">
                                    {libraryUseOnly ? "Library use only" : "Borrowable"}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase text-white/40">
                                    Now borrowed
                                </div>
                                <div className="wrap-break-word text-xs">
                                    {borrowedCopies}
                                    {totalCopies > 0
                                        ? ` of ${totalCopies} copy${totalCopies === 1 ? "" : "ies"}`
                                        : ""}
                                </div>
                            </div>

                            <div className="col-span-2">
                                <div className="text-[10px] uppercase text-white/40">
                                    Borrow tracking
                                </div>
                                <div className="wrap-break-word text-xs">
                                    {historicalBorrowCount === null
                                        ? "Current borrow count is tracked."
                                        : `Borrowed ${historicalBorrowCount} time${historicalBorrowCount === 1 ? "" : "s"} in recorded history.`}
                                </div>
                            </div>

                            <div className="col-span-2">
                                <div className="text-[10px] uppercase text-white/40">
                                    Due date
                                </div>
                                <div className="text-xs">
                                    {dueCell === "—" ? (
                                        <span className="opacity-50">—</span>
                                    ) : (
                                        dueCell
                                    )}
                                </div>
                            </div>

                            <div className="col-span-2">
                                <div className="text-[10px] uppercase text-white/40">
                                    Loan duration
                                </div>
                                <div className="text-xs">
                                    {fmtDurationDays(book.borrowDurationDays)}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-1">
                            {libraryUseOnly ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="border-amber-300/30 text-amber-100/70"
                                >
                                    Library use only
                                </Button>
                            ) : borrowableNow ? (
                                <BorrowBookDialog
                                    book={book}
                                    maxCopies={maxCopies}
                                    busy={borrowBusyId === book.id}
                                    triggerLabel={borrowBtnLabel}
                                    onConfirm={onBorrow}
                                />
                            ) : activeRecords.length > 0 ? (
                                <span className="inline-flex flex-col items-end text-xs text-amber-200">
                                    {pendingPickupRecords.length > 0 && (
                                        <>
                                            <span className="inline-flex items-center gap-1">
                                                <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                Pending pickup ×{pendingPickupRecords.length}
                                            </span>
                                            <span className="text-white/60">
                                                Go to the librarian to receive the physical book.
                                            </span>
                                        </>
                                    )}

                                    {borrowedRecords.length > 0 && !hasOverdue && (
                                        <>
                                            <span className="inline-flex items-center gap-1">
                                                <Clock3 className="h-3 w-3" aria-hidden="true" />
                                                Borrowed ×{borrowedRecords.length}
                                            </span>
                                            <span className="text-white/60">
                                                Earliest due on{" "}
                                                <span className="font-semibold">
                                                    {earliestDue}
                                                </span>
                                                .
                                            </span>
                                        </>
                                    )}

                                    {borrowedRecords.length > 0 && hasOverdue && (
                                        <>
                                            <span className="inline-flex items-center gap-1 text-red-300">
                                                <AlertTriangle
                                                    className="h-3 w-3"
                                                    aria-hidden="true"
                                                />
                                                Overdue
                                            </span>
                                            <span className="text-white/60">
                                                Max overdue by{" "}
                                                <span className="font-semibold">
                                                    {overdueDaysMax} day
                                                    {overdueDaysMax === 1 ? "" : "s"}
                                                </span>
                                                .
                                            </span>
                                        </>
                                    )}

                                    {pendingReturnRecords.length > 0 && (
                                        <span className="text-white/60">
                                            Return requested ×{pendingReturnRecords.length}
                                        </span>
                                    )}
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
                );
            })}
        </div>
    );
}