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

export function BooksCatalogTable({
    books,
    onEdit,
    onDelete,
    cellScrollbarClasses,
}: BooksCatalogTableProps) {
    return (
        <Table>
            <TableCaption className="text-xs text-white/60">
                Showing {books.length} {books.length === 1 ? "book" : "books"}.
            </TableCaption>

            <TableHeader>
                <TableRow className="border-white/10">
                    <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                        ID
                    </TableHead>
                    <TableHead className="w-[200px] text-xs font-semibold text-white/70">
                        Title
                    </TableHead>
                    <TableHead className="w-[150px] text-xs font-semibold text-white/70">
                        Author
                    </TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold text-white/70">
                        Accession #
                    </TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold text-white/70">
                        Barcode
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold text-white/70">
                        Call no.
                    </TableHead>
                    <TableHead className="w-[140px] text-xs font-semibold text-white/70">
                        Library area
                    </TableHead>
                    <TableHead className="w-[140px] text-xs font-semibold text-white/70">
                        Inventory
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold text-white/70">
                        ISBN
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold text-white/70">
                        Genre
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-white/70">
                        Pub. year
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-white/70">
                        Loan days
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-white/70">
                        Available
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                        Actions
                    </TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {books.map((book) => {
                    const inv = getInventory(book);
                    const area = book.libraryArea ? String(book.libraryArea) : "";
                    const areaLabel = area ? formatLibraryAreaLabel(area) : "—";
                    const borrowable = isBorrowableByCopies(book);

                    return (
                        <TableRow
                            key={book.id}
                            className="border-white/5 hover:bg-white/5 transition-colors"
                        >
                            <TableCell className="text-xs opacity-80">{book.id}</TableCell>

                            <TableCell
                                className={
                                    "text-sm font-medium align-top w-[90px] max-w-[90px] " +
                                    cellScrollbarClasses
                                }
                            >
                                {book.title}
                            </TableCell>

                            <TableCell
                                className={
                                    "text-sm opacity-90 align-top w-[90px] max-w-[90px] " +
                                    cellScrollbarClasses
                                }
                            >
                                {book.author || <span className="opacity-50">—</span>}
                            </TableCell>

                            <TableCell
                                className={
                                    "text-sm opacity-80 align-top w-[90px] max-w-[90px] " +
                                    cellScrollbarClasses
                                }
                            >
                                {book.accessionNumber ? (
                                    book.accessionNumber
                                ) : (
                                    <span className="opacity-50">—</span>
                                )}
                            </TableCell>

                            <TableCell
                                className={
                                    "text-sm opacity-80 align-top w-[90px] max-w-[90px] " +
                                    cellScrollbarClasses
                                }
                            >
                                {book.barcode ? book.barcode : <span className="opacity-50">—</span>}
                            </TableCell>

                            <TableCell
                                className={
                                    "text-sm opacity-80 align-top w-[70px] max-w-[70px] " +
                                    cellScrollbarClasses
                                }
                            >
                                {book.callNumber ? (
                                    book.callNumber
                                ) : (
                                    <span className="opacity-50">—</span>
                                )}
                            </TableCell>

                            <TableCell
                                className={
                                    "text-sm opacity-80 align-top w-[85px] max-w-[85px] " +
                                    cellScrollbarClasses
                                }
                            >
                                {area ? areaLabel : <span className="opacity-50">—</span>}
                            </TableCell>

                            <TableCell className="text-sm opacity-90">
                                {inv.remaining === null && inv.total === null ? (
                                    <span className="opacity-50">—</span>
                                ) : (
                                    <div className="leading-tight">
                                        <div className="font-medium">
                                            {inv.remaining ?? "—"} / {inv.total ?? "—"}
                                        </div>
                                        <div className="text-[11px] text-white/60">
                                            Borrowed: {inv.borrowed ?? "—"}
                                        </div>
                                    </div>
                                )}
                            </TableCell>

                            <TableCell
                                className={
                                    "text-sm opacity-80 align-top w-[60px] max-w-[60px] " +
                                    cellScrollbarClasses
                                }
                            >
                                {book.isbn || <span className="opacity-50">—</span>}
                            </TableCell>

                            <TableCell
                                className={
                                    "text-sm opacity-80 align-top w-[50px] max-w-[50px] " +
                                    cellScrollbarClasses
                                }
                            >
                                {book.genre || <span className="opacity-50">—</span>}
                            </TableCell>

                            <TableCell className="text-sm opacity-80">
                                {book.publicationYear || <span className="opacity-50">—</span>}
                            </TableCell>

                            <TableCell className="text-sm opacity-80">
                                {typeof book.borrowDurationDays === "number" &&
                                    book.borrowDurationDays > 0 ? (
                                    <>
                                        {book.borrowDurationDays} day
                                        {book.borrowDurationDays === 1 ? "" : "s"}
                                    </>
                                ) : (
                                    <span className="opacity-50">—</span>
                                )}
                            </TableCell>

                            <TableCell>
                                <Badge
                                    variant={borrowable ? "default" : "outline"}
                                    className={
                                        borrowable
                                            ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80"
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
                            </TableCell>

                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="text-sky-300 hover:text-sky-100 hover:bg-sky-500/15"
                                        onClick={() => onEdit(book)}
                                    >
                                        <Edit className="h-4 w-4" />
                                        <span className="sr-only">Edit</span>
                                    </Button>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="text-red-300 hover:text-red-100 hover:bg-red-500/15"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete</span>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete “{book.title}”?</AlertDialogTitle>
                                                <AlertDialogDescription className="text-white/70">
                                                    This action cannot be undone. This will permanently remove
                                                    the book from the catalog.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                                                    Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-red-600 hover:bg-red-700 text-white"
                                                    onClick={() => onDelete(book)}
                                                >
                                                    Delete book
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
