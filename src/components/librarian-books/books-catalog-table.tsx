import * as React from "react";
import { Edit, Trash2, CheckCircle2, CircleOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { BookDTO } from "@/lib/books";
import {
    formatLibraryAreaLabel,
    getInventory,
    isBorrowableByCopies,
} from "./books-constants";

type BooksCatalogTableProps = {
    books: BookDTO[];
    onEdit: (book: BookDTO) => void;
    onDelete: (book: BookDTO) => void;
    cellScrollbarClasses: string;
};

const DRAG_THRESHOLD_PX = 5;

function AvailabilityBadge({ borrowable }: { borrowable: boolean }) {
    return (
        <Badge
            variant={borrowable ? "default" : "outline"}
            className={
                borrowable
                    ? "border-emerald-400/80 bg-emerald-500/80 text-white hover:bg-emerald-500"
                    : "border-red-400/70 text-red-200 hover:bg-red-500/10"
            }
        >
            {borrowable ? (
                <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Available
                </span>
            ) : (
                <span className="inline-flex items-center gap-1">
                    <CircleOff className="h-3 w-3" />
                    Unavailable
                </span>
            )}
        </Badge>
    );
}

function DeleteBookDialog({
    book,
    onDelete,
}: {
    book: BookDTO;
    onDelete: (book: BookDTO) => void;
}) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-red-300 hover:bg-red-500/15 hover:text-red-100"
                >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{book.title}”?</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/70">
                        This action cannot be undone. This will permanently remove the
                        book from the catalog.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={() => onDelete(book)}
                    >
                        Delete book
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function CatalogField({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-white/50">
                {label}
            </div>
            <div className="mt-1 wrap-break-word text-sm leading-5 text-white/85">
                {value}
            </div>
        </div>
    );
}

function getSubjectsValue(book: BookDTO) {
    return (
        (book.subjects && String(book.subjects).trim()) ||
        (book.genre && String(book.genre).trim()) ||
        (book.category && String(book.category).trim()) ||
        "—"
    );
}

function getLoanDaysLabel(book: BookDTO) {
    if (
        typeof book.borrowDurationDays === "number" &&
        book.borrowDurationDays > 0
    ) {
        return `${book.borrowDurationDays} day${
            book.borrowDurationDays === 1 ? "" : "s"
        }`;
    }

    return "—";
}

function isInteractiveTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
        target.closest(
            [
                "button",
                "a",
                "input",
                "select",
                "textarea",
                "[role='button']",
                "[role='link']",
                "[role='menuitem']",
                "[data-no-drag-scroll='true']",
            ].join(", ")
        )
    );
}

export function BooksCatalogTable({
    books,
    onEdit,
    onDelete,
    cellScrollbarClasses,
}: BooksCatalogTableProps) {
    const wrapCellClass = `align-top whitespace-normal break-words text-sm leading-5 text-white/80 ${cellScrollbarClasses}`;

    const tableScrollRef = React.useRef<HTMLDivElement | null>(null);
    const suppressClickRef = React.useRef(false);
    const dragStateRef = React.useRef({
        pointerId: null as number | null,
        isPointerDown: false,
        startX: 0,
        startScrollLeft: 0,
    });
    const [isDragging, setIsDragging] = React.useState(false);

    const endDrag = React.useCallback(() => {
        const container = tableScrollRef.current;
        const dragState = dragStateRef.current;

        if (
            container &&
            dragState.pointerId !== null &&
            typeof container.hasPointerCapture === "function" &&
            container.hasPointerCapture(dragState.pointerId)
        ) {
            try {
                container.releasePointerCapture(dragState.pointerId);
            } catch {
                // no-op
            }
        }

        dragState.pointerId = null;
        dragState.isPointerDown = false;
        dragState.startX = 0;
        dragState.startScrollLeft = 0;
        setIsDragging(false);
    }, []);

    React.useEffect(() => {
        return () => {
            endDrag();
        };
    }, [endDrag]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "touch") return;
        if (event.button !== 0) return;
        if (isInteractiveTarget(event.target)) return;

        const container = tableScrollRef.current;
        if (!container) return;

        dragStateRef.current.pointerId = event.pointerId;
        dragStateRef.current.isPointerDown = true;
        dragStateRef.current.startX = event.clientX;
        dragStateRef.current.startScrollLeft = container.scrollLeft;
        suppressClickRef.current = false;
        setIsDragging(false);

        if (typeof container.setPointerCapture === "function") {
            try {
                container.setPointerCapture(event.pointerId);
            } catch {
                // no-op
            }
        }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const container = tableScrollRef.current;
        const dragState = dragStateRef.current;

        if (!container || !dragState.isPointerDown) return;

        const deltaX = event.clientX - dragState.startX;

        if (!isDragging && Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
            return;
        }

        if (!isDragging) {
            setIsDragging(true);
        }

        suppressClickRef.current = true;
        container.scrollLeft = dragState.startScrollLeft - deltaX;
        event.preventDefault();
    };

    const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!suppressClickRef.current) return;

        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
    };

    const handlePointerUp = () => {
        endDrag();
    };

    const handlePointerCancel = () => {
        endDrag();
    };

    const handleLostPointerCapture = () => {
        endDrag();
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3 sm:hidden">
                {books.map((book) => {
                    const inv = getInventory(book);
                    const area = book.libraryArea ? String(book.libraryArea) : "";
                    const areaLabel = area ? formatLibraryAreaLabel(area) : "—";
                    const borrowable = isBorrowableByCopies(book);
                    const subjectsValue = getSubjectsValue(book);

                    return (
                        <div
                            key={book.id}
                            className="rounded-xl border border-white/10 bg-slate-900/60 p-4"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-[11px] uppercase tracking-wide text-white/50">
                                        Catalog entry
                                    </div>
                                    <h3 className="mt-1 wrap-break-word text-sm font-semibold leading-5 text-white">
                                        {book.title || "—"}
                                    </h3>
                                    <p className="mt-1 wrap-break-word text-xs text-white/70">
                                        {book.author || "—"}
                                    </p>
                                    {book.subtitle ? (
                                        <p className="mt-1 wrap-break-word text-xs leading-5 text-white/50">
                                            {book.subtitle}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="shrink-0">
                                    <AvailabilityBadge borrowable={borrowable} />
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3">
                                <CatalogField
                                    label="Call no."
                                    value={book.callNumber || "—"}
                                />
                                <CatalogField
                                    label="Accession #"
                                    value={book.accessionNumber || "—"}
                                />
                                <CatalogField
                                    label="Publication year"
                                    value={book.publicationYear || "—"}
                                />
                                <CatalogField
                                    label="Subjects"
                                    value={subjectsValue}
                                />
                                <CatalogField
                                    label="Publisher"
                                    value={book.publisher || "—"}
                                />
                                <CatalogField
                                    label="Library area"
                                    value={areaLabel}
                                />
                                <CatalogField
                                    label="Inventory"
                                    value={
                                        inv.remaining === null && inv.total === null ? (
                                            "—"
                                        ) : (
                                            <div className="leading-5">
                                                <div className="font-medium text-white">
                                                    {inv.remaining ?? "—"} / {inv.total ?? "—"}
                                                </div>
                                                <div className="text-xs text-white/60">
                                                    Borrowed: {inv.borrowed ?? "—"}
                                                </div>
                                            </div>
                                        )
                                    }
                                />
                                <CatalogField
                                    label="Barcode"
                                    value={book.barcode || "—"}
                                />
                                <CatalogField
                                    label="ISBN"
                                    value={book.isbn || "—"}
                                />
                                <CatalogField
                                    label="Loan days"
                                    value={getLoanDaysLabel(book)}
                                />
                            </div>

                            <div className="mt-4 flex items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="border-sky-500/30 text-sky-200 hover:bg-sky-500/15 hover:text-sky-100"
                                    onClick={() => onEdit(book)}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>

                                <DeleteBookDialog book={book} onDelete={onDelete} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="hidden sm:block">
                <div
                    ref={tableScrollRef}
                    className={`overflow-x-auto ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
                    style={{ touchAction: "pan-y" }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onLostPointerCapture={handleLostPointerCapture}
                    onClickCapture={handleClickCapture}
                >
                    <Table className="min-w-[1580px] table-fixed">
                        <TableCaption className="text-xs text-white/60">
                            Showing {books.length}{" "}
                            {books.length === 1 ? "book" : "books"}.
                        </TableCaption>

                        <TableHeader>
                            <TableRow className="border-white/10">
                                <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Call no.
                                </TableHead>
                                <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Accession #
                                </TableHead>
                                <TableHead className="w-60 whitespace-nowrap text-xs font-semibold text-white/70">
                                    Title
                                </TableHead>
                                <TableHead className="w-[180px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Sub.
                                </TableHead>
                                <TableHead className="w-[100px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Pub. year
                                </TableHead>
                                <TableHead className="w-[190px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Author
                                </TableHead>
                                <TableHead className="w-[230px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Subjects
                                </TableHead>
                                <TableHead className="w-[180px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Publisher
                                </TableHead>
                                <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Library area
                                </TableHead>
                                <TableHead className="w-[130px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Inventory
                                </TableHead>
                                <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Barcode
                                </TableHead>
                                <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    ISBN
                                </TableHead>
                                <TableHead className="w-[110px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Loan days
                                </TableHead>
                                <TableHead className="w-[130px] whitespace-nowrap text-xs font-semibold text-white/70">
                                    Available
                                </TableHead>
                                <TableHead className="w-[100px] text-right text-xs font-semibold text-white/70">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {books.map((book) => {
                                const inv = getInventory(book);
                                const area = book.libraryArea ? String(book.libraryArea) : "";
                                const areaLabel = area
                                    ? formatLibraryAreaLabel(area)
                                    : "—";
                                const borrowable = isBorrowableByCopies(book);
                                const subjectsValue = getSubjectsValue(book);

                                return (
                                    <TableRow
                                        key={book.id}
                                        className="border-white/5 transition-colors hover:bg-white/5"
                                    >
                                        <TableCell
                                            className={`${wrapCellClass} font-medium text-white/85`}
                                        >
                                            {book.callNumber || (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell
                                            className={`${wrapCellClass} font-medium text-white/85`}
                                        >
                                            {book.accessionNumber || (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell
                                            className={`${wrapCellClass} font-medium text-white`}
                                        >
                                            {book.title || (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell className={wrapCellClass}>
                                            {book.subtitle ? (
                                                book.subtitle
                                            ) : (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell className={wrapCellClass}>
                                            {book.publicationYear || (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell className={wrapCellClass}>
                                            {book.author || (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell className={wrapCellClass}>
                                            {subjectsValue}
                                        </TableCell>

                                        <TableCell className={wrapCellClass}>
                                            {book.publisher ? (
                                                book.publisher
                                            ) : (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell className={wrapCellClass}>
                                            {area ? (
                                                areaLabel
                                            ) : (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="align-top text-sm leading-5 text-white/90">
                                            {inv.remaining === null && inv.total === null ? (
                                                <span className="opacity-50">—</span>
                                            ) : (
                                                <div className="leading-5">
                                                    <div className="font-medium text-white">
                                                        {inv.remaining ?? "—"} / {inv.total ?? "—"}
                                                    </div>
                                                    <div className="text-[11px] text-white/60">
                                                        Borrowed: {inv.borrowed ?? "—"}
                                                    </div>
                                                </div>
                                            )}
                                        </TableCell>

                                        <TableCell
                                            className={`${wrapCellClass} break-all`}
                                        >
                                            {book.barcode ? (
                                                book.barcode
                                            ) : (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell
                                            className={`${wrapCellClass} break-all`}
                                        >
                                            {book.isbn || (
                                                <span className="opacity-50">—</span>
                                            )}
                                        </TableCell>

                                        <TableCell className={wrapCellClass}>
                                            {getLoanDaysLabel(book)}
                                        </TableCell>

                                        <TableCell className="align-top">
                                            <AvailabilityBadge borrowable={borrowable} />
                                        </TableCell>

                                        <TableCell className="align-top text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="text-sky-300 hover:bg-sky-500/15 hover:text-sky-100"
                                                    onClick={() => onEdit(book)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                    <span className="sr-only">Edit</span>
                                                </Button>

                                                <DeleteBookDialog
                                                    book={book}
                                                    onDelete={onDelete}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}