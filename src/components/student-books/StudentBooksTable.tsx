import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    AlertTriangle,
    CheckCircle2,
    CircleOff,
    Clock3,
} from "lucide-react";

import type { BookWithStatus } from "@/components/student-books/types";
import {
    fmtDate,
    fmtLibraryArea,
    getBookBorrowMeta,
    getSubjects,
    peso,
} from "@/components/student-books/utils";
import BorrowBookDialog from "@/components/student-books/BorrowBookDialog";

type StudentBooksTableProps = {
    rows: BookWithStatus[];
    borrowBusyId: string | null;
    onBorrow: (book: BookWithStatus, copiesRequested: number) => Promise<boolean>;
};

export default function StudentBooksTable({
    rows,
    borrowBusyId,
    onBorrow,
}: StudentBooksTableProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const dragStateRef = React.useRef({
        active: false,
        startX: 0,
        scrollLeft: 0,
        pointerId: -1,
        dragged: false,
    });
    const [isDragging, setIsDragging] = React.useState(false);

    const endDrag = React.useCallback((pointerId?: number) => {
        const container = containerRef.current;
        const dragState = dragStateRef.current;

        if (
            container &&
            dragState.pointerId !== -1 &&
            container.hasPointerCapture?.(dragState.pointerId)
        ) {
            try {
                container.releasePointerCapture(
                    pointerId ?? dragState.pointerId
                );
            } catch {
                // ignore release failures
            }
        }

        dragState.active = false;
        dragState.pointerId = -1;
        setIsDragging(false);
    }, []);

    const handlePointerDown = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const container = containerRef.current;
            if (!container) return;

            if (e.pointerType === "mouse" && e.button !== 0) return;
            if (container.scrollWidth <= container.clientWidth) return;

            dragStateRef.current.active = true;
            dragStateRef.current.startX = e.clientX;
            dragStateRef.current.scrollLeft = container.scrollLeft;
            dragStateRef.current.pointerId = e.pointerId;
            dragStateRef.current.dragged = false;

            setIsDragging(true);

            try {
                container.setPointerCapture(e.pointerId);
            } catch {
                // ignore capture failures
            }
        },
        []
    );

    const handlePointerMove = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const container = containerRef.current;
            const dragState = dragStateRef.current;

            if (!container || !dragState.active) return;

            const deltaX = e.clientX - dragState.startX;

            if (Math.abs(deltaX) > 3) {
                dragState.dragged = true;
            }

            container.scrollLeft = dragState.scrollLeft - deltaX;
        },
        []
    );

    const handleClickCapture = React.useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!dragStateRef.current.dragged) return;

            e.preventDefault();
            e.stopPropagation();
            dragStateRef.current.dragged = false;
        },
        []
    );

    return (
        <div
            ref={containerRef}
            className={`hidden overflow-x-auto rounded-md md:block ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"
                }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => endDrag(e.pointerId)}
            onPointerCancel={(e) => endDrag(e.pointerId)}
            onClickCapture={handleClickCapture}
            onDragStart={(e) => e.preventDefault()}
        >
            <Table className="min-w-[1500px]">
                <TableCaption className="text-xs text-white/60">
                    Showing {rows.length} {rows.length === 1 ? "book" : "books"}. Drag
                    left or right anywhere on the table to scroll horizontally.
                </TableCaption>

                <TableHeader>
                    <TableRow className="border-white/10">
                        <TableHead className="text-xs font-semibold text-white/70">
                            Call no.
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            Acc. no.
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            Title
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            Sub.
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            Pub. year
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            Author
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            ISBN
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            Area
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            Availability
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            Due date
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-white/70">
                            My status
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold text-white/70">
                            Action
                        </TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
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

                        return (
                            <TableRow
                                key={book.id}
                                className="border-white/5 transition-colors hover:bg-white/5"
                            >
                                <TableCell className="whitespace-nowrap text-sm">
                                    {book.callNumber || (
                                        <span className="opacity-50">—</span>
                                    )}
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-sm">
                                    {book.accessionNumber || (
                                        <span className="opacity-50">—</span>
                                    )}
                                </TableCell>

                                <TableCell className="min-w-[220px] text-sm font-medium">
                                    <div className="flex flex-col">
                                        <span>{book.title}</span>
                                        {book.subtitle ? (
                                            <span className="text-xs text-white/60">
                                                {book.subtitle}
                                            </span>
                                        ) : null}
                                    </div>
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-sm">
                                    {getSubjects(book)}
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-sm">
                                    {book.publicationYear || (
                                        <span className="opacity-50">—</span>
                                    )}
                                </TableCell>

                                <TableCell className="min-w-[180px] text-sm">
                                    {book.author || (
                                        <span className="opacity-50">—</span>
                                    )}
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-sm">
                                    {book.isbn || <span className="opacity-50">—</span>}
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-sm">
                                    {book.libraryArea ? (
                                        fmtLibraryArea(book.libraryArea)
                                    ) : (
                                        <span className="opacity-50">—</span>
                                    )}
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-xs">
                                    <Badge
                                        variant={borrowableNow ? "default" : "outline"}
                                        className={
                                            borrowableNow
                                                ? "border-emerald-400/80 bg-emerald-500/80 text-white hover:bg-emerald-500"
                                                : "border-red-400/70 text-red-200 hover:bg-red-500/10"
                                        }
                                    >
                                        {borrowableNow ? (
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
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-sm">
                                    {dueCell === "—" ? (
                                        <span className="opacity-50">—</span>
                                    ) : (
                                        dueCell
                                    )}
                                </TableCell>

                                <TableCell className="min-w-60 text-xs">
                                    {activeRecords.length === 0 && book.myStatus === "never" && (
                                        <span className="text-white/60">Not yet borrowed</span>
                                    )}

                                    {activeRecords.length > 0 && (
                                        <div className="space-y-1">
                                            {pendingPickupRecords.length > 0 && (
                                                <div className="inline-flex items-center gap-1 text-amber-200">
                                                    <Clock3
                                                        className="h-3 w-3 shrink-0"
                                                        aria-hidden="true"
                                                    />
                                                    <span>
                                                        Pending pickup ×
                                                        {pendingPickupRecords.length}
                                                        {" · "}
                                                        Earliest due:{" "}
                                                        <span className="font-medium">
                                                            {earliestDue}
                                                        </span>
                                                    </span>
                                                </div>
                                            )}

                                            {borrowedRecords.length > 0 && !hasOverdue && (
                                                <div className="inline-flex items-center gap-1 text-amber-200">
                                                    <Clock3
                                                        className="h-3 w-3 shrink-0"
                                                        aria-hidden="true"
                                                    />
                                                    <span>
                                                        Borrowed ×{borrowedRecords.length}
                                                        {" · "}
                                                        Earliest due:{" "}
                                                        <span className="font-medium">
                                                            {earliestDue}
                                                        </span>
                                                    </span>
                                                </div>
                                            )}

                                            {borrowedRecords.length > 0 && hasOverdue && (
                                                <div className="inline-flex items-center gap-1 text-red-300">
                                                    <AlertTriangle
                                                        className="h-3 w-3 shrink-0"
                                                        aria-hidden="true"
                                                    />
                                                    <span>
                                                        Overdue ×{borrowedRecords.length}
                                                        {" · "}
                                                        Max overdue:{" "}
                                                        <span className="font-semibold">
                                                            {overdueDaysMax} day
                                                            {overdueDaysMax === 1 ? "" : "s"}
                                                        </span>
                                                    </span>
                                                </div>
                                            )}

                                            {pendingReturnRecords.length > 0 && (
                                                <div className="text-white/70">
                                                    Return requested ×
                                                    {pendingReturnRecords.length}
                                                </div>
                                            )}

                                            {totalFine > 0 && (
                                                <div className="text-red-300">
                                                    Fine total: {peso(totalFine)}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeRecords.length === 0 &&
                                        book.myStatus === "returned" &&
                                        book.lastReturnedRecord && (
                                            <span className="inline-flex items-center gap-1 text-white/70">
                                                <CheckCircle2
                                                    className="h-3 w-3 shrink-0 text-emerald-300"
                                                    aria-hidden="true"
                                                />
                                                <span>
                                                    Returned · Last returned:{" "}
                                                    <span className="font-medium">
                                                        {fmtDate(
                                                            book.lastReturnedRecord.returnDate
                                                        )}
                                                    </span>
                                                </span>
                                            </span>
                                        )}
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-right align-top">
                                    {borrowableNow ? (
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
                                                        <Clock3
                                                            className="h-3 w-3"
                                                            aria-hidden="true"
                                                        />
                                                        Pending pickup ×
                                                        {pendingPickupRecords.length}
                                                    </span>
                                                    <span className="text-white/60">
                                                        Go to the librarian to receive the
                                                        physical book.
                                                    </span>
                                                </>
                                            )}

                                            {borrowedRecords.length > 0 && !hasOverdue && (
                                                <>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock3
                                                            className="h-3 w-3"
                                                            aria-hidden="true"
                                                        />
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
                                                    Return requested ×
                                                    {pendingReturnRecords.length}
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
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}