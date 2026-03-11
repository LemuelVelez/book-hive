import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react"

import type { BookWithStatus } from "@/components/faculty-books/types"
import {
    fmtDate,
    getBookBorrowMeta,
    peso,
} from "@/components/faculty-books/utils"

export function FacultyBookStatus({ book }: { book: BookWithStatus }) {
    const {
        activeRecords,
        pendingPickupRecords,
        borrowedRecords,
        pendingReturnRecords,
        totalFine,
        earliestDue,
        overdueDaysMax,
        hasOverdue,
    } = getBookBorrowMeta(book)

    if (activeRecords.length === 0 && book.myStatus === "never") {
        return <span className="text-white/60">Not yet borrowed</span>
    }

    if (activeRecords.length > 0) {
        return (
            <div className="space-y-1">
                {pendingPickupRecords.length > 0 && (
                    <div className="inline-flex items-center gap-1 text-amber-200">
                        <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                            Pending pickup ×{pendingPickupRecords.length}
                            {" · "}Earliest due:{" "}
                            <span className="font-medium">{earliestDue}</span>
                        </span>
                    </div>
                )}

                {borrowedRecords.length > 0 && !hasOverdue && (
                    <div className="inline-flex items-center gap-1 text-amber-200">
                        <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                            Borrowed ×{borrowedRecords.length}
                            {" · "}Earliest due:{" "}
                            <span className="font-medium">{earliestDue}</span>
                        </span>
                    </div>
                )}

                {borrowedRecords.length > 0 && hasOverdue && (
                    <div className="inline-flex items-center gap-1 text-red-300">
                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                            Overdue ×{borrowedRecords.length}
                            {" · "}Max overdue:{" "}
                            <span className="font-semibold">
                                {overdueDaysMax} day{overdueDaysMax === 1 ? "" : "s"}
                            </span>
                        </span>
                    </div>
                )}

                {pendingReturnRecords.length > 0 && (
                    <div className="text-white/70">
                        Return requested ×{pendingReturnRecords.length}
                    </div>
                )}

                {totalFine > 0 && (
                    <div className="text-red-300">Fine total: {peso(totalFine)}</div>
                )}
            </div>
        )
    }

    if (book.myStatus === "returned" && book.lastReturnedRecord) {
        return (
            <span className="inline-flex items-center gap-1 text-white/70">
                <CheckCircle2
                    className="h-3 w-3 text-emerald-300 shrink-0"
                    aria-hidden="true"
                />
                <span>
                    Returned · Last returned:{" "}
                    <span className="font-medium">
                        {fmtDate(book.lastReturnedRecord.returnDate)}
                    </span>
                </span>
            </span>
        )
    }

    return <span className="text-white/60">—</span>
}

export function FacultyBookActionState({ book }: { book: BookWithStatus }) {
    const {
        activeRecords,
        pendingPickupRecords,
        borrowedRecords,
        pendingReturnRecords,
        earliestDue,
        overdueDaysMax,
        hasOverdue,
    } = getBookBorrowMeta(book)

    if (activeRecords.length === 0) return null

    return (
        <>
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
                        Earliest due on <span className="font-semibold">{earliestDue}</span>.
                    </span>
                </>
            )}

            {borrowedRecords.length > 0 && hasOverdue && (
                <>
                    <span className="inline-flex items-center gap-1 text-red-300">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Overdue
                    </span>
                    <span className="text-white/60">
                        Max overdue by{" "}
                        <span className="font-semibold">
                            {overdueDaysMax} day{overdueDaysMax === 1 ? "" : "s"}
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
        </>
    )
}