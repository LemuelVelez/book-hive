/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter as DialogFooterUI,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Field,
    FieldContent,
    FieldError,
    FieldLabel,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Plus,
    RefreshCcw,
    Loader2,
    Trash2,
    CheckCircle2,
    CircleOff,
    BookOpen,
    Search,
    Edit,
} from "lucide-react";
import {
    fetchBooks,
    createBook,
    deleteBook,
    updateBook,
    type BookDTO,
    type LibraryArea,
} from "@/lib/books";

// ✅ shadcn AlertDialog for delete confirmation
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

const LIBRARY_AREA_HELP: LibraryArea[] = [
    "filipiniana",
    "general_circulation",
    "maritime",
    "periodicals",
    "thesis_dissertations",
    "rizaliana",
    "special_collection",
    "fil_gen_reference",
    "general_reference",
    "fiction",
];

export default function LibrarianBooksPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");

    // Dialog + form state (Add)
    const [addOpen, setAddOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // Required-ish
    const [title, setTitle] = React.useState("");
    const [author, setAuthor] = React.useState("");
    const [statementOfResponsibility, setStatementOfResponsibility] = React.useState("");

    // IDs / legacy
    const [isbn, setIsbn] = React.useState("");
    const [issn, setIssn] = React.useState("");
    const [accessionNumber, setAccessionNumber] = React.useState("");
    const [genre, setGenre] = React.useState("");

    // Publication
    const [subtitle, setSubtitle] = React.useState("");
    const [edition, setEdition] = React.useState("");
    const [pubYear, setPubYear] = React.useState("");
    const [copyrightYear, setCopyrightYear] = React.useState("");
    const [placeOfPublication, setPlaceOfPublication] = React.useState("");
    const [publisher, setPublisher] = React.useState("");

    // Physical / notes
    const [pages, setPages] = React.useState("");
    const [otherDetails, setOtherDetails] = React.useState("");
    const [dimensions, setDimensions] = React.useState("");
    const [notes, setNotes] = React.useState("");
    const [series, setSeries] = React.useState("");
    const [category, setCategory] = React.useState("");
    const [addedEntries, setAddedEntries] = React.useState("");

    // Copy details (NOW REQUIRED: barcode, callNumber, libraryArea)
    const [barcode, setBarcode] = React.useState("");
    const [callNumber, setCallNumber] = React.useState("");
    const [copyNumber, setCopyNumber] = React.useState("");
    const [volumeNumber, setVolumeNumber] = React.useState("");
    const [libraryArea, setLibraryArea] = React.useState("");

    // Availability / loan rules
    const [borrowDuration, setBorrowDuration] = React.useState("7");
    const [available, setAvailable] = React.useState(true);

    const [formError, setFormError] = React.useState<string>("");

    // Dialog + form state (Edit)
    const [editOpen, setEditOpen] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [editBookId, setEditBookId] = React.useState<string | null>(null);

    const [editTitle, setEditTitle] = React.useState("");
    const [editAuthor, setEditAuthor] = React.useState("");
    const [editStatementOfResponsibility, setEditStatementOfResponsibility] = React.useState("");

    const [editIsbn, setEditIsbn] = React.useState("");
    const [editIssn, setEditIssn] = React.useState("");
    const [editAccessionNumber, setEditAccessionNumber] = React.useState("");
    const [editGenre, setEditGenre] = React.useState("");

    const [editSubtitle, setEditSubtitle] = React.useState("");
    const [editEdition, setEditEdition] = React.useState("");
    const [editPubYear, setEditPubYear] = React.useState("");
    const [editCopyrightYear, setEditCopyrightYear] = React.useState("");
    const [editPlaceOfPublication, setEditPlaceOfPublication] = React.useState("");
    const [editPublisher, setEditPublisher] = React.useState("");

    const [editPages, setEditPages] = React.useState("");
    const [editOtherDetails, setEditOtherDetails] = React.useState("");
    const [editDimensions, setEditDimensions] = React.useState("");
    const [editNotes, setEditNotes] = React.useState("");
    const [editSeries, setEditSeries] = React.useState("");
    const [editCategory, setEditCategory] = React.useState("");
    const [editAddedEntries, setEditAddedEntries] = React.useState("");

    // Copy details (NOW REQUIRED: editBarcode, editCallNumber, editLibraryArea)
    const [editBarcode, setEditBarcode] = React.useState("");
    const [editCallNumber, setEditCallNumber] = React.useState("");
    const [editCopyNumber, setEditCopyNumber] = React.useState("");
    const [editVolumeNumber, setEditVolumeNumber] = React.useState("");
    const [editLibraryArea, setEditLibraryArea] = React.useState("");

    const [editBorrowDuration, setEditBorrowDuration] = React.useState("");
    const [editAvailable, setEditAvailable] = React.useState(true);
    const [editError, setEditError] = React.useState<string>("");

    const resetForm = () => {
        setTitle("");
        setAuthor("");
        setStatementOfResponsibility("");

        setIsbn("");
        setIssn("");
        setAccessionNumber("");
        setGenre("");

        setSubtitle("");
        setEdition("");
        setPubYear("");
        setCopyrightYear("");
        setPlaceOfPublication("");
        setPublisher("");

        setPages("");
        setOtherDetails("");
        setDimensions("");
        setNotes("");
        setSeries("");
        setCategory("");
        setAddedEntries("");

        setBarcode("");
        setCallNumber("");
        setCopyNumber("");
        setVolumeNumber("");
        setLibraryArea("");

        setBorrowDuration("7");
        setAvailable(true);
        setFormError("");
    };

    const resetEditForm = () => {
        setEditBookId(null);

        setEditTitle("");
        setEditAuthor("");
        setEditStatementOfResponsibility("");

        setEditIsbn("");
        setEditIssn("");
        setEditAccessionNumber("");
        setEditGenre("");

        setEditSubtitle("");
        setEditEdition("");
        setEditPubYear("");
        setEditCopyrightYear("");
        setEditPlaceOfPublication("");
        setEditPublisher("");

        setEditPages("");
        setEditOtherDetails("");
        setEditDimensions("");
        setEditNotes("");
        setEditSeries("");
        setEditCategory("");
        setEditAddedEntries("");

        setEditBarcode("");
        setEditCallNumber("");
        setEditCopyNumber("");
        setEditVolumeNumber("");
        setEditLibraryArea("");

        setEditBorrowDuration("");
        setEditAvailable(true);
        setEditError("");
    };

    const loadBooks = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchBooks();
            setBooks(data);
        } catch (err: any) {
            const msg =
                err?.message || "Failed to load books. Please try again later.";
            setError(msg);
            toast.error("Failed to load books", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadBooks();
    }, [loadBooks]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadBooks();
        } finally {
            setRefreshing(false);
        }
    };

    const parseYearOrNull = (raw: string): number | null => {
        const v = raw.trim();
        if (!v) return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 1000 || n > 9999) return null;
        return n;
    };

    const parsePositiveIntOrNull = (raw: string): number | null => {
        const v = raw.trim();
        if (!v) return null;
        const n = Math.floor(Number(v));
        if (!Number.isFinite(n) || n <= 0) return null;
        return n;
    };

    const normalizeLibraryAreaInput = (raw: string): LibraryArea | null => {
        const v = raw.trim().toLowerCase();
        if (!v) return null;
        return LIBRARY_AREA_HELP.includes(v as LibraryArea) ? (v as LibraryArea) : null;
    };

    const libraryAreaValidationMessage = `Library area is required and must be one of: ${LIBRARY_AREA_HELP.join(
        ", "
    )}.`;

    const handleCreateBook = async () => {
        setFormError("");

        const resolvedTitle = title.trim();
        const resolvedAuthor = author.trim();
        const resolvedSOR = statementOfResponsibility.trim();

        if (!resolvedTitle) {
            const msg = "Title is required.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (!resolvedAuthor && !resolvedSOR) {
            const msg = "Author or Statement of Responsibility is required.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const pubYearNum = parseYearOrNull(pubYear);
        const copyrightYearNum = parseYearOrNull(copyrightYear);

        if (pubYear.trim() && pubYearNum === null) {
            const msg = "Please enter a valid 4-digit publication year.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (copyrightYear.trim() && copyrightYearNum === null) {
            const msg = "Please enter a valid 4-digit copyright year.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (pubYearNum === null && copyrightYearNum === null) {
            const msg = "Publication year or Copyright year is required.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        // ✅ REQUIRED copy fields
        if (!barcode.trim()) {
            const msg = "Barcode is required.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (!callNumber.trim()) {
            const msg = "Call number is required.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const libArea = normalizeLibraryAreaInput(libraryArea);
        if (!libArea) {
            setFormError(libraryAreaValidationMessage);
            toast.error("Validation error", { description: libraryAreaValidationMessage });
            return;
        }

        if (!borrowDuration.trim()) {
            const msg = "Borrow duration (days) is required.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const borrowDaysNum = Number(borrowDuration);
        if (!Number.isFinite(borrowDaysNum) || borrowDaysNum <= 0) {
            const msg = "Borrow duration must be a positive number of days.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }
        const borrowDaysInt = Math.floor(borrowDaysNum);

        const pagesNum = pages.trim() ? parsePositiveIntOrNull(pages) : null;
        if (pages.trim() && pagesNum === null) {
            const msg = "Pages must be a positive number.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const copyNum = copyNumber.trim() ? parsePositiveIntOrNull(copyNumber) : null;
        if (copyNumber.trim() && copyNum === null) {
            const msg = "Copy number must be a positive number.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        setSaving(true);
        try {
            const created = await createBook({
                title: resolvedTitle,
                author: resolvedAuthor || undefined,
                statementOfResponsibility: resolvedSOR || undefined,

                isbn: isbn.trim(),
                issn: issn.trim(),
                accessionNumber: accessionNumber.trim(),
                genre: genre.trim(),

                subtitle: subtitle.trim(),
                edition: edition.trim(),

                publicationYear: pubYearNum ?? undefined,
                copyrightYear: copyrightYearNum ?? undefined,
                placeOfPublication: placeOfPublication.trim(),
                publisher: publisher.trim(),

                pages: pagesNum,
                otherDetails: otherDetails.trim(),
                dimensions: dimensions.trim(),
                notes: notes.trim(),
                series: series.trim(),
                category: category.trim(),
                addedEntries: addedEntries.trim(),

                // ✅ required fields sent
                barcode: barcode.trim(),
                callNumber: callNumber.trim(),
                copyNumber: copyNum,
                volumeNumber: volumeNumber.trim(),
                libraryArea: libArea,

                available,
                borrowDurationDays: borrowDaysInt,
            });

            setBooks((prev) => [created, ...prev]);
            toast.success("Book added", {
                description: `"${created.title}" has been added to the catalog.`,
            });

            resetForm();
            setAddOpen(false);
        } catch (err: any) {
            const msg =
                err?.message || "Failed to create book. Please try again later.";
            setFormError(msg);
            toast.error("Failed to create book", { description: msg });
        } finally {
            setSaving(false);
        }
    };

    // ✅ Open edit dialog with selected book data
    const openEditDialog = (book: BookDTO) => {
        setEditBookId(book.id);

        setEditTitle(book.title || "");
        setEditAuthor(book.author || "");
        setEditStatementOfResponsibility(book.statementOfResponsibility || "");

        setEditIsbn(book.isbn || "");
        setEditIssn(book.issn || "");
        setEditAccessionNumber(book.accessionNumber || "");
        setEditGenre(book.genre || "");

        setEditSubtitle(book.subtitle || "");
        setEditEdition(book.edition || "");

        setEditPubYear(
            typeof book.publicationYear === "number"
                ? String(book.publicationYear)
                : ""
        );
        setEditCopyrightYear(
            typeof book.copyrightYear === "number" ? String(book.copyrightYear) : ""
        );

        setEditPlaceOfPublication(book.placeOfPublication || "");
        setEditPublisher(book.publisher || "");

        setEditPages(typeof book.pages === "number" ? String(book.pages) : "");
        setEditOtherDetails(book.otherDetails || "");
        setEditDimensions(book.dimensions || "");
        setEditNotes(book.notes || "");
        setEditSeries(book.series || "");
        setEditCategory(book.category || "");
        setEditAddedEntries(book.addedEntries || "");

        setEditBarcode(book.barcode || "");
        setEditCallNumber(book.callNumber || "");
        setEditCopyNumber(typeof book.copyNumber === "number" ? String(book.copyNumber) : "");
        setEditVolumeNumber(book.volumeNumber || "");
        setEditLibraryArea(book.libraryArea || "");

        setEditBorrowDuration(
            typeof book.borrowDurationDays === "number" && book.borrowDurationDays > 0
                ? String(book.borrowDurationDays)
                : "7"
        );
        setEditAvailable(book.available);

        setEditError("");
        setEditOpen(true);
    };

    const handleUpdateBook = async () => {
        if (!editBookId) return;
        setEditError("");

        const resolvedTitle = editTitle.trim();
        const resolvedAuthor = editAuthor.trim();
        const resolvedSOR = editStatementOfResponsibility.trim();

        if (!resolvedTitle) {
            const msg = "Title is required.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (!resolvedAuthor && !resolvedSOR) {
            const msg = "Author or Statement of Responsibility is required.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const pubYearNum = parseYearOrNull(editPubYear);
        const copyrightYearNum = parseYearOrNull(editCopyrightYear);

        if (editPubYear.trim() && pubYearNum === null) {
            const msg = "Please enter a valid 4-digit publication year.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (editCopyrightYear.trim() && copyrightYearNum === null) {
            const msg = "Please enter a valid 4-digit copyright year.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (pubYearNum === null && copyrightYearNum === null) {
            const msg = "Publication year or Copyright year is required.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        // ✅ REQUIRED copy fields
        if (!editBarcode.trim()) {
            const msg = "Barcode is required.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (!editCallNumber.trim()) {
            const msg = "Call number is required.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const libArea = normalizeLibraryAreaInput(editLibraryArea);
        if (!libArea) {
            setEditError(libraryAreaValidationMessage);
            toast.error("Validation error", { description: libraryAreaValidationMessage });
            return;
        }

        if (!editBorrowDuration.trim()) {
            const msg = "Borrow duration (days) is required.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const borrowDaysNum = Number(editBorrowDuration);
        if (!Number.isFinite(borrowDaysNum) || borrowDaysNum <= 0) {
            const msg = "Borrow duration must be a positive number of days.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }
        const borrowDaysInt = Math.floor(borrowDaysNum);

        const pagesNum = editPages.trim() ? parsePositiveIntOrNull(editPages) : null;
        if (editPages.trim() && pagesNum === null) {
            const msg = "Pages must be a positive number.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const copyNum = editCopyNumber.trim() ? parsePositiveIntOrNull(editCopyNumber) : null;
        if (editCopyNumber.trim() && copyNum === null) {
            const msg = "Copy number must be a positive number.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        setEditing(true);
        try {
            const updated = await updateBook(editBookId, {
                title: resolvedTitle,
                author: resolvedAuthor || undefined,
                statementOfResponsibility: resolvedSOR || undefined,

                isbn: editIsbn.trim(),
                issn: editIssn.trim(),
                accessionNumber: editAccessionNumber.trim(),
                genre: editGenre.trim(),

                subtitle: editSubtitle.trim(),
                edition: editEdition.trim(),

                publicationYear: pubYearNum ?? undefined,
                copyrightYear: copyrightYearNum ?? undefined,
                placeOfPublication: editPlaceOfPublication.trim(),
                publisher: editPublisher.trim(),

                pages: pagesNum,
                otherDetails: editOtherDetails.trim(),
                dimensions: editDimensions.trim(),
                notes: editNotes.trim(),
                series: editSeries.trim(),
                category: editCategory.trim(),
                addedEntries: editAddedEntries.trim(),

                // ✅ required fields sent
                barcode: editBarcode.trim(),
                callNumber: editCallNumber.trim(),
                copyNumber: copyNum,
                volumeNumber: editVolumeNumber.trim(),
                libraryArea: libArea,

                available: editAvailable,
                borrowDurationDays: borrowDaysInt,
            });

            setBooks((prev) =>
                prev.map((b) => (b.id === updated.id ? updated : b))
            );

            toast.success("Book updated", {
                description: `"${updated.title}" has been updated.`,
            });

            setEditOpen(false);
            resetEditForm();
        } catch (err: any) {
            const msg =
                err?.message || "Failed to update book. Please try again later.";
            setEditError(msg);
            toast.error("Failed to update book", { description: msg });
        } finally {
            setEditing(false);
        }
    };

    // ✅ Now only does the actual delete work (no confirm here)
    const handleDelete = async (book: BookDTO) => {
        // Optimistic remove
        const previous = books;
        setBooks((prev) => prev.filter((b) => b.id !== book.id));

        try {
            await deleteBook(book.id);
            toast.success("Book deleted", {
                description: `"${book.title}" has been removed from the catalog.`,
            });
        } catch (err: any) {
            setBooks(previous);
            const msg =
                err?.message || "Failed to delete book. Please try again later.";
            toast.error("Delete failed", { description: msg });
        }
    };

    const filteredBooks = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return books;
        return books.filter((b) => {
            const hay = [
                b.title,
                b.subtitle || "",
                b.author,
                b.statementOfResponsibility || "",
                b.isbn || "",
                b.issn || "",
                b.genre || "",
                b.category || "",
                b.accessionNumber || "",
                b.barcode || "",
                b.callNumber || "",
                b.publisher || "",
                b.placeOfPublication || "",
                b.libraryArea || "",
            ]
                .join(" ")
                .toLowerCase();

            return hay.includes(q);
        });
    }, [books, search]);

    return (
        <DashboardLayout title="Books Management">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">
                            Catalog &amp; inventory
                        </h2>
                        <p className="text-xs text-white/70">
                            Add new titles and manage availability of existing books.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="border-white/20 text-white/90 hover:bg-white/10"
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                    >
                        {refreshing || loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCcw className="h-4 w-4" />
                        )}
                        <span className="sr-only">Refresh</span>
                    </Button>

                    {/* Add book dialog */}
                    <Dialog
                        open={addOpen}
                        onOpenChange={(open) => {
                            setAddOpen(open);
                            if (!open) resetForm();
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button
                                type="button"
                                className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add book
                            </Button>
                        </DialogTrigger>

                        <DialogContent
                            className="w-[92vw] sm:max-w-lg bg-slate-900 text-white border-white/10
                         max-h-[85vh] overflow-y-auto
                         [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
                         [&::-webkit-scrollbar]:w-1.5
                         [&::-webkit-scrollbar-track]:bg-slate-900/70
                         [&::-webkit-scrollbar-thumb]:bg-slate-700
                         [&::-webkit-scrollbar-thumb]:rounded-full
                         [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
                        >
                            <DialogHeader>
                                <DialogTitle>Add a new book</DialogTitle>
                                <DialogDescription className="text-white/70">
                                    Fill in the details for the new catalog entry.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-5 py-2">
                                {/* Core */}
                                <div className="space-y-4">
                                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                        Core details
                                    </div>

                                    <Field>
                                        <FieldLabel className="text-white">Title *</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="e.g., Clean Code"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Subtitle</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={subtitle}
                                                onChange={(e) => setSubtitle(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Author</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={author}
                                                onChange={(e) => setAuthor(e.target.value)}
                                                placeholder="e.g., Robert C. Martin"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                        <p className="mt-1 text-[11px] text-white/60">
                                            Provide Author or Statement of Responsibility.
                                        </p>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">
                                            Statement of Responsibility
                                        </FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={statementOfResponsibility}
                                                onChange={(e) => setStatementOfResponsibility(e.target.value)}
                                                placeholder="Optional (can be used instead of Author)"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Edition</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={edition}
                                                onChange={(e) => setEdition(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>
                                </div>

                                {/* Identifiers */}
                                <div className="space-y-4 pt-2 border-t border-white/10">
                                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                        Identifiers
                                    </div>

                                    <Field>
                                        <FieldLabel className="text-white">Accession Number</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={accessionNumber}
                                                onChange={(e) => setAccessionNumber(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">ISBN</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={isbn}
                                                onChange={(e) => setIsbn(e.target.value)}
                                                placeholder="e.g., 9780132350884"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">ISSN</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={issn}
                                                onChange={(e) => setIssn(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Genre (legacy)</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={genre}
                                                onChange={(e) => setGenre(e.target.value)}
                                                placeholder="e.g., Software Engineering"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Category</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                placeholder="Optional (if provided, mirrors Genre)"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>
                                </div>

                                {/* Publication */}
                                <div className="space-y-4 pt-2 border-t border-white/10">
                                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                        Publication
                                    </div>

                                    <Field>
                                        <FieldLabel className="text-white">Publication year</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={pubYear}
                                                onChange={(e) => setPubYear(e.target.value)}
                                                placeholder="e.g., 2008"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                inputMode="numeric"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                        <p className="mt-1 text-[11px] text-white/60">
                                            Provide Publication year or Copyright year.
                                        </p>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Copyright year</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={copyrightYear}
                                                onChange={(e) => setCopyrightYear(e.target.value)}
                                                placeholder="Optional (4-digit year)"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                inputMode="numeric"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Place of publication</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={placeOfPublication}
                                                onChange={(e) => setPlaceOfPublication(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Publisher</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={publisher}
                                                onChange={(e) => setPublisher(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>
                                </div>

                                {/* Physical */}
                                <div className="space-y-4 pt-2 border-t border-white/10">
                                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                        Physical description & notes
                                    </div>

                                    <Field>
                                        <FieldLabel className="text-white">Pages</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={pages}
                                                onChange={(e) => setPages(e.target.value)}
                                                placeholder="Optional (positive number)"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                inputMode="numeric"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Other details</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={otherDetails}
                                                onChange={(e) => setOtherDetails(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Dimensions</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={dimensions}
                                                onChange={(e) => setDimensions(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Notes</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Series</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={series}
                                                onChange={(e) => setSeries(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Added entries</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={addedEntries}
                                                onChange={(e) => setAddedEntries(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>
                                </div>

                                {/* Copy / circulation */}
                                <div className="space-y-4 pt-2 border-t border-white/10">
                                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                        Copy & circulation
                                    </div>

                                    <Field>
                                        <FieldLabel className="text-white">Barcode *</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={barcode}
                                                onChange={(e) => setBarcode(e.target.value)}
                                                placeholder="Required"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Call number *</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={callNumber}
                                                onChange={(e) => setCallNumber(e.target.value)}
                                                placeholder="Required"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Copy number</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={copyNumber}
                                                onChange={(e) => setCopyNumber(e.target.value)}
                                                placeholder="Optional (positive number)"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                inputMode="numeric"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Volume number</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={volumeNumber}
                                                onChange={(e) => setVolumeNumber(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">Library area *</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={libraryArea}
                                                onChange={(e) => setLibraryArea(e.target.value)}
                                                placeholder="e.g., general_circulation"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                        <p className="mt-1 text-[11px] text-white/60">
                                            Allowed: {LIBRARY_AREA_HELP.join(", ")}
                                        </p>
                                    </Field>

                                    <Field>
                                        <FieldLabel className="text-white">
                                            Default borrow duration (days) *
                                        </FieldLabel>
                                        <FieldContent>
                                            <Input
                                                value={borrowDuration}
                                                onChange={(e) => setBorrowDuration(e.target.value)}
                                                placeholder="e.g., 7"
                                                className="bg-slate-900/70 border-white/20 text-white"
                                                inputMode="numeric"
                                                autoComplete="off"
                                            />
                                        </FieldContent>
                                        <p className="mt-1 text-[11px] text-white/60">
                                            This controls how many days a student can initially borrow this
                                            book.
                                        </p>
                                    </Field>

                                    <div className="flex items-center gap-2 pt-2">
                                        <Checkbox
                                            id="available"
                                            checked={available}
                                            onCheckedChange={(v) => setAvailable(v === true)}
                                        />
                                        <Label htmlFor="available" className="text-sm text-white/80">
                                            Mark as available in the catalog
                                        </Label>
                                    </div>

                                    {formError && <FieldError>{formError}</FieldError>}
                                </div>
                            </div>

                            <DialogFooterUI className="flex flex-col sm:flex-row sm:justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-white/20 text-white hover:text-white hover:bg-black/10 w-full sm:w-auto"
                                    onClick={() => {
                                        setAddOpen(false);
                                        resetForm();
                                    }}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white w-full sm:w-auto"
                                    onClick={handleCreateBook}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving…
                                        </span>
                                    ) : (
                                        "Save book"
                                    )}
                                </Button>
                            </DialogFooterUI>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Edit book dialog (global) */}
            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) resetEditForm();
                }}
            >
                <DialogContent
                    className="w-[92vw] sm:max-w-lg bg-slate-900 text-white border-white/10
                     max-h-[85vh] overflow-y-auto
                     [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
                     [&::-webkit-scrollbar]:w-1.5
                     [&::-webkit-scrollbar-track]:bg-slate-900/70
                     [&::-webkit-scrollbar-thumb]:bg-slate-700
                     [&::-webkit-scrollbar-thumb]:rounded-full
                     [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
                >
                    <DialogHeader>
                        <DialogTitle>Edit book</DialogTitle>
                        <DialogDescription className="text-white/70">
                            Update the details for this catalog entry.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Core */}
                        <div className="space-y-4">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                Core details
                            </div>

                            <Field>
                                <FieldLabel className="text-white">Title *</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        placeholder="e.g., Clean Code"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Subtitle</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editSubtitle}
                                        onChange={(e) => setEditSubtitle(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Author</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editAuthor}
                                        onChange={(e) => setEditAuthor(e.target.value)}
                                        placeholder="e.g., Robert C. Martin"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                                <p className="mt-1 text-[11px] text-white/60">
                                    Provide Author or Statement of Responsibility.
                                </p>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">
                                    Statement of Responsibility
                                </FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editStatementOfResponsibility}
                                        onChange={(e) => setEditStatementOfResponsibility(e.target.value)}
                                        placeholder="Optional (can be used instead of Author)"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Edition</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editEdition}
                                        onChange={(e) => setEditEdition(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>
                        </div>

                        {/* Identifiers */}
                        <div className="space-y-4 pt-2 border-t border-white/10">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                Identifiers
                            </div>

                            <Field>
                                <FieldLabel className="text-white">Accession Number</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editAccessionNumber}
                                        onChange={(e) => setEditAccessionNumber(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">ISBN</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editIsbn}
                                        onChange={(e) => setEditIsbn(e.target.value)}
                                        placeholder="e.g., 9780132350884"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">ISSN</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editIssn}
                                        onChange={(e) => setEditIssn(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Genre (legacy)</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editGenre}
                                        onChange={(e) => setEditGenre(e.target.value)}
                                        placeholder="e.g., Software Engineering"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Category</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        placeholder="Optional (if provided, mirrors Genre)"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>
                        </div>

                        {/* Publication */}
                        <div className="space-y-4 pt-2 border-t border-white/10">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                Publication
                            </div>

                            <Field>
                                <FieldLabel className="text-white">Publication year</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editPubYear}
                                        onChange={(e) => setEditPubYear(e.target.value)}
                                        placeholder="e.g., 2008"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        inputMode="numeric"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                                <p className="mt-1 text-[11px] text-white/60">
                                    Provide Publication year or Copyright year.
                                </p>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Copyright year</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editCopyrightYear}
                                        onChange={(e) => setEditCopyrightYear(e.target.value)}
                                        placeholder="Optional (4-digit year)"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        inputMode="numeric"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Place of publication</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editPlaceOfPublication}
                                        onChange={(e) => setEditPlaceOfPublication(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Publisher</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editPublisher}
                                        onChange={(e) => setEditPublisher(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>
                        </div>

                        {/* Physical */}
                        <div className="space-y-4 pt-2 border-t border-white/10">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                Physical description & notes
                            </div>

                            <Field>
                                <FieldLabel className="text-white">Pages</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editPages}
                                        onChange={(e) => setEditPages(e.target.value)}
                                        placeholder="Optional (positive number)"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        inputMode="numeric"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Other details</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editOtherDetails}
                                        onChange={(e) => setEditOtherDetails(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Dimensions</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editDimensions}
                                        onChange={(e) => setEditDimensions(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Notes</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Series</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editSeries}
                                        onChange={(e) => setEditSeries(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Added entries</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editAddedEntries}
                                        onChange={(e) => setEditAddedEntries(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>
                        </div>

                        {/* Copy / circulation */}
                        <div className="space-y-4 pt-2 border-t border-white/10">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                                Copy & circulation
                            </div>

                            <Field>
                                <FieldLabel className="text-white">Barcode *</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editBarcode}
                                        onChange={(e) => setEditBarcode(e.target.value)}
                                        placeholder="Required"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Call number *</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editCallNumber}
                                        onChange={(e) => setEditCallNumber(e.target.value)}
                                        placeholder="Required"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Copy number</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editCopyNumber}
                                        onChange={(e) => setEditCopyNumber(e.target.value)}
                                        placeholder="Optional (positive number)"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        inputMode="numeric"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Volume number</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editVolumeNumber}
                                        onChange={(e) => setEditVolumeNumber(e.target.value)}
                                        placeholder="Optional"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">Library area *</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editLibraryArea}
                                        onChange={(e) => setEditLibraryArea(e.target.value)}
                                        placeholder="e.g., general_circulation"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                                <p className="mt-1 text-[11px] text-white/60">
                                    Allowed: {LIBRARY_AREA_HELP.join(", ")}
                                </p>
                            </Field>

                            <Field>
                                <FieldLabel className="text-white">
                                    Default borrow duration (days) *
                                </FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={editBorrowDuration}
                                        onChange={(e) => setEditBorrowDuration(e.target.value)}
                                        placeholder="e.g., 7"
                                        className="bg-slate-900/70 border-white/20 text-white"
                                        inputMode="numeric"
                                        autoComplete="off"
                                    />
                                </FieldContent>
                                <p className="mt-1 text-[11px] text-white/60">
                                    This controls how many days a student can initially borrow this
                                    book. You can still extend specific loans later from the borrow
                                    records page.
                                </p>
                            </Field>

                            <div className="flex items-center gap-2 pt-2">
                                <Checkbox
                                    id="edit-available"
                                    checked={editAvailable}
                                    onCheckedChange={(v) => setEditAvailable(v === true)}
                                />
                                <Label
                                    htmlFor="edit-available"
                                    className="text-sm text-white/80"
                                >
                                    Mark as available in the catalog
                                </Label>
                            </div>

                            {editError && <FieldError>{editError}</FieldError>}
                        </div>
                    </div>

                    <DialogFooterUI className="flex flex-col sm:flex-row sm:justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-white/20 text-white hover:text-white hover:bg-black/10 w-full sm:w-auto"
                            onClick={() => {
                                setEditOpen(false);
                                resetEditForm();
                            }}
                            disabled={editing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white w-full sm:w-auto"
                            onClick={handleUpdateBook}
                            disabled={editing}
                        >
                            {editing ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving…
                                </span>
                            ) : (
                                "Update book"
                            )}
                        </Button>
                    </DialogFooterUI>
                </DialogContent>
            </Dialog>

            {/* Search + table */}
            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle>Books catalog</CardTitle>

                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search title, author, accession, barcode, call no., library area…"
                                className="pl-9 bg-slate-900/70 border-white/20 text-white"
                            />
                        </div>
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
                        <div className="py-6 text-center text-sm text-red-300">
                            {error}
                        </div>
                    ) : filteredBooks.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            No books found in the catalog.
                            <br />
                            <span className="text-xs opacity-80">
                                Try adjusting your search or add a new book.
                            </span>
                        </div>
                    ) : (
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {filteredBooks.length}{" "}
                                {filteredBooks.length === 1 ? "book" : "books"}.
                            </TableCaption>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                        ID
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Title
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Author
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Accession #
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Barcode
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Call no.
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Library area
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        ISBN
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
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
                                {filteredBooks.map((book) => (
                                    <TableRow
                                        key={book.id}
                                        className="border-white/5 hover:bg-white/5 transition-colors"
                                    >
                                        <TableCell className="text-xs opacity-80">
                                            {book.id}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">
                                            {book.title}
                                        </TableCell>
                                        <TableCell className="text-sm opacity-90">
                                            {book.author}
                                        </TableCell>

                                        <TableCell className="text-sm opacity-80">
                                            {book.accessionNumber ? book.accessionNumber : <span className="opacity-50">—</span>}
                                        </TableCell>

                                        <TableCell className="text-sm opacity-80">
                                            {book.barcode ? book.barcode : <span className="opacity-50">—</span>}
                                        </TableCell>

                                        <TableCell className="text-sm opacity-80">
                                            {book.callNumber ? book.callNumber : <span className="opacity-50">—</span>}
                                        </TableCell>

                                        <TableCell className="text-sm opacity-80">
                                            {book.libraryArea ? book.libraryArea : <span className="opacity-50">—</span>}
                                        </TableCell>

                                        <TableCell className="text-sm opacity-80">
                                            {book.isbn || <span className="opacity-50">—</span>}
                                        </TableCell>

                                        <TableCell className="text-sm opacity-80">
                                            {book.genre || <span className="opacity-50">—</span>}
                                        </TableCell>

                                        <TableCell className="text-sm opacity-80">
                                            {book.publicationYear || (
                                                <span className="opacity-50">—</span>
                                            )}
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
                                                variant={book.available ? "default" : "outline"}
                                                className={
                                                    book.available
                                                        ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80"
                                                        : "border-red-400/70 text-red-200 hover:bg-red-500/10"
                                                }
                                            >
                                                {book.available ? (
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
                                                    onClick={() => openEditDialog(book)}
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
                                                            <AlertDialogTitle>
                                                                Delete “{book.title}”?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription className="text-white/70">
                                                                This action cannot be undone. This will
                                                                permanently remove the book from the catalog.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                                                                Cancel
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                className="bg-red-600 hover:bg-red-700 text-white"
                                                                onClick={() => handleDelete(book)}
                                                            >
                                                                Delete book
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
