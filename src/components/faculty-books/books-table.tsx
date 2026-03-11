import * as React from "react"
import {
    CheckCircle2,
    CircleOff,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

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
    shouldIgnoreHorizontalDrag,
} from "@/components/faculty-books/utils"

type FacultyBooksTableProps = {
    rows: BookWithStatus[]
    borrowBusyId: string | null
    borrowDialogBookId: string | null
    borrowCopies: number
    onBorrowDialogBookChange: (bookId: string | null) => void
    onBorrowCopiesChange: (value: number) => void
    onBorrow: (book: BookWithStatus, copiesRequested: number) => void | Promise<void>
}

export function FacultyBooksTable({
    rows,
    borrowBusyId,
    borrowDialogBookId,
    borrowCopies,
    onBorrowDialogBookChange,
    onBorrowCopiesChange,
    onBorrow,
}: FacultyBooksTableProps) {
    const tableScrollRef = React.useRef<HTMLDivElement | null>(null)
    const tableDragPointerIdRef = React.useRef<number | null>(null)
    const tableDragStartXRef = React.useRef(0)
    const tableDragStartScrollLeftRef = React.useRef(0)
    const [isTableDragging, setIsTableDragging] = React.useState(false)

    const stopTableDrag = React.useCallback(() => {
        const el = tableScrollRef.current
        const pointerId = tableDragPointerIdRef.current

        if (el && pointerId !== null) {
            try {
                el.releasePointerCapture(pointerId)
            } catch {
                // noop
            }
        }

        tableDragPointerIdRef.current = null
        setIsTableDragging(false)
    }, [])

    const handleTablePointerDown = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const el = tableScrollRef.current
            if (!el) return
            if (e.pointerType === "mouse" && e.button !== 0) return
            if (shouldIgnoreHorizontalDrag(e.target)) return

            tableDragPointerIdRef.current = e.pointerId
            tableDragStartXRef.current = e.clientX
            tableDragStartScrollLeftRef.current = el.scrollLeft

            try {
                el.setPointerCapture(e.pointerId)
            } catch {
                // noop
            }

            setIsTableDragging(true)
        },
        []
    )

    const handleTablePointerMove = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const el = tableScrollRef.current
            if (!el) return
            if (!isTableDragging) return
            if (tableDragPointerIdRef.current !== e.pointerId) return

            const deltaX = e.clientX - tableDragStartXRef.current
            el.scrollLeft = tableDragStartScrollLeftRef.current - deltaX
            e.preventDefault()
        },
        [isTableDragging]
    )

    const handleTablePointerUp = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (tableDragPointerIdRef.current !== e.pointerId) return
            stopTableDrag()
        },
        [stopTableDrag]
    )

    React.useEffect(() => {
        return () => {
            stopTableDrag()
        }
    }, [stopTableDrag])

    return (
        <>
            <div className="mb-2 hidden md:flex items-center justify-between gap-2 text-[11px] text-white/60">
                <span>Drag the table left or right to view more columns.</span>
                <span>You can still use the horizontal scrollbar if needed.</span>
            </div>

            <Table
                ref={tableScrollRef}
                className="min-w-[1380px]"
                containerClassName={`hidden md:block rounded-md ${isTableDragging ? "cursor-grabbing select-none" : "cursor-grab"
                    }`}
                containerProps={{
                    onPointerDown: handleTablePointerDown,
                    onPointerMove: handleTablePointerMove,
                    onPointerUp: handleTablePointerUp,
                    onPointerCancel: stopTableDrag,
                    onLostPointerCapture: stopTableDrag,
                }}
            >
                <TableCaption className="text-xs text-white/60">
                    Showing {rows.length} {rows.length === 1 ? "book" : "books"}. Sorted and
                    filtered catalog view for faculty borrowers.
                </TableCaption>

                <TableHeader>
                    <TableRow className="border-white/10">
                        <TableHead className="min-w-[140px] text-xs font-semibold text-white/70">
                            Call no.
                        </TableHead>
                        <TableHead className="min-w-[130px] text-xs font-semibold text-white/70">
                            Acc. no.
                        </TableHead>
                        <TableHead className="min-w-[220px] text-xs font-semibold text-white/70">
                            Title
                        </TableHead>
                        <TableHead className="min-w-[180px] text-xs font-semibold text-white/70">
                            Sub.
                        </TableHead>
                        <TableHead className="min-w-[90px] text-xs font-semibold text-white/70">
                            Pub. year
                        </TableHead>
                        <TableHead className="min-w-[170px] text-xs font-semibold text-white/70">
                            Author
                        </TableHead>
                        <TableHead className="min-w-[140px] text-xs font-semibold text-white/70">
                            ISBN
                        </TableHead>
                        <TableHead className="min-w-[180px] text-xs font-semibold text-white/70">
                            Subjects
                        </TableHead>
                        <TableHead className="min-w-[140px] text-xs font-semibold text-white/70">
                            Availability
                        </TableHead>
                        <TableHead className="min-w-[120px] text-xs font-semibold text-white/70">
                            Due date
                        </TableHead>
                        <TableHead className="min-w-[260px] text-xs font-semibold text-white/70">
                            My status
                        </TableHead>
                        <TableHead className="min-w-[220px] text-right text-xs font-semibold text-white/70">
                            Action
                        </TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {rows.map((book) => {
                        const remaining = getRemainingCopies(book)
                        const borrowableNow = isBorrowable(book)
                        const maxCopies = remaining
                        const borrowBtnLabel =
                            book.activeRecords.length > 0 ? "Borrow more" : "Borrow"
                        const {
                            activeRecords,
                            dueCell,
                        } = getBookBorrowMeta(book)

                        return (
                            <TableRow
                                key={book.id}
                                className="border-white/5 hover:bg-white/5 transition-colors"
                            >
                                <TableCell className="align-top text-sm text-white/85 whitespace-normal wrap-break-word">
                                    {book.callNumber || <span className="opacity-50">—</span>}
                                </TableCell>

                                <TableCell className="align-top text-sm text-white/85 whitespace-normal wrap-break-word">
                                    {book.accessionNumber || (
                                        <span className="opacity-50">—</span>
                                    )}
                                </TableCell>

                                <TableCell className="align-top">
                                    <div className="text-sm font-medium text-white whitespace-normal wrap-break-word">
                                        {book.title}
                                    </div>
                                </TableCell>

                                <TableCell className="align-top text-sm text-white/80 whitespace-normal wrap-break-word">
                                    {book.subtitle || <span className="opacity-50">—</span>}
                                </TableCell>

                                <TableCell className="align-top text-sm text-white/80">
                                    {book.publicationYear || <span className="opacity-50">—</span>}
                                </TableCell>

                                <TableCell className="align-top text-sm text-white/90 whitespace-normal wrap-break-word">
                                    {book.author || <span className="opacity-50">—</span>}
                                </TableCell>

                                <TableCell className="align-top text-sm text-white/80 whitespace-normal wrap-break-word">
                                    {book.isbn || <span className="opacity-50">—</span>}
                                </TableCell>

                                <TableCell className="align-top text-sm text-white/80 whitespace-normal wrap-break-word">
                                    {book.subjects ||
                                        book.genre ||
                                        book.category ||
                                        <span className="opacity-50">—</span>}
                                </TableCell>

                                <TableCell className="align-top text-xs">
                                    <Badge
                                        variant={borrowableNow ? "default" : "outline"}
                                        className={
                                            borrowableNow
                                                ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80"
                                                : "border-red-400/70 text-red-200 hover:bg-red-500/10"
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
                                </TableCell>

                                <TableCell className="align-top text-sm text-white/80 whitespace-normal wrap-break-word">
                                    {dueCell === "—" ? <span className="opacity-50">—</span> : dueCell}
                                </TableCell>

                                <TableCell className="align-top text-xs whitespace-normal wrap-break-word">
                                    <FacultyBookStatus book={book} />
                                </TableCell>

                                <TableCell className="align-top text-right">
                                    {borrowableNow ? (
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
                                            triggerLabel={borrowBtnLabel}
                                            triggerDisabled={maxCopies <= 0}
                                        />
                                    ) : activeRecords.length > 0 ? (
                                        <span className="inline-flex flex-col items-end text-xs text-amber-200 whitespace-normal wrap-break-word">
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
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </>
    )
}