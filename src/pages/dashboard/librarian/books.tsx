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

export default function LibrarianBooksPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");

    // Dialog + form state (Add)
    const [addOpen, setAddOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [title, setTitle] = React.useState("");
    const [author, setAuthor] = React.useState("");
    const [isbn, setIsbn] = React.useState("");
    const [genre, setGenre] = React.useState("");
    const [pubYear, setPubYear] = React.useState("");
    const [borrowDuration, setBorrowDuration] = React.useState("7");
    const [available, setAvailable] = React.useState(true);
    const [formError, setFormError] = React.useState<string>("");

    // Dialog + form state (Edit)
    const [editOpen, setEditOpen] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [editBookId, setEditBookId] = React.useState<string | null>(null);
    const [editTitle, setEditTitle] = React.useState("");
    const [editAuthor, setEditAuthor] = React.useState("");
    const [editIsbn, setEditIsbn] = React.useState("");
    const [editGenre, setEditGenre] = React.useState("");
    const [editPubYear, setEditPubYear] = React.useState("");
    const [editBorrowDuration, setEditBorrowDuration] = React.useState("");
    const [editAvailable, setEditAvailable] = React.useState(true);
    const [editError, setEditError] = React.useState<string>("");

    const resetForm = () => {
        setTitle("");
        setAuthor("");
        setIsbn("");
        setGenre("");
        setPubYear("");
        setBorrowDuration("7");
        setAvailable(true);
        setFormError("");
    };

    const resetEditForm = () => {
        setEditBookId(null);
        setEditTitle("");
        setEditAuthor("");
        setEditIsbn("");
        setEditGenre("");
        setEditPubYear("");
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

    const handleCreateBook = async () => {
        setFormError("");

        if (!title.trim() || !author.trim()) {
            const msg = "Title and author are required.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (!pubYear.trim()) {
            const msg = "Publication year is required.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const yearNum = Number(pubYear);
        if (!Number.isFinite(yearNum) || yearNum < 1000 || yearNum > 9999) {
            const msg = "Please enter a valid 4-digit publication year.";
            setFormError(msg);
            toast.error("Validation error", { description: msg });
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

        setSaving(true);
        try {
            const created = await createBook({
                title: title.trim(),
                author: author.trim(),
                isbn: isbn.trim(),
                genre: genre.trim(),
                publicationYear: yearNum,
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
        setEditTitle(book.title);
        setEditAuthor(book.author);
        setEditIsbn(book.isbn || "");
        setEditGenre(book.genre || "");
        setEditPubYear(
            typeof book.publicationYear === "number"
                ? String(book.publicationYear)
                : ""
        );
        setEditBorrowDuration(
            typeof book.borrowDurationDays === "number" &&
                book.borrowDurationDays > 0
                ? String(book.borrowDurationDays)
                : borrowDuration // fall back to current default
        );
        setEditAvailable(book.available);
        setEditError("");
        setEditOpen(true);
    };

    const handleUpdateBook = async () => {
        if (!editBookId) return;
        setEditError("");

        if (!editTitle.trim() || !editAuthor.trim()) {
            const msg = "Title and author are required.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        if (!editPubYear.trim()) {
            const msg = "Publication year is required.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
            return;
        }

        const yearNum = Number(editPubYear);
        if (!Number.isFinite(yearNum) || yearNum < 1000 || yearNum > 9999) {
            const msg = "Please enter a valid 4-digit publication year.";
            setEditError(msg);
            toast.error("Validation error", { description: msg });
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

        setEditing(true);
        try {
            const updated = await updateBook(editBookId, {
                title: editTitle.trim(),
                author: editAuthor.trim(),
                isbn: editIsbn.trim(),
                genre: editGenre.trim(),
                publicationYear: yearNum,
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
            return (
                b.title.toLowerCase().includes(q) ||
                b.author.toLowerCase().includes(q) ||
                (b.isbn && b.isbn.toLowerCase().includes(q)) ||
                (b.genre && b.genre.toLowerCase().includes(q))
            );
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

                        {/* Scrollable dialog with thin, dark scrollbar */}
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

                            <div className="space-y-4 py-2">
                                <Field>
                                    <FieldLabel className="text-white">Title</FieldLabel>
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
                                    <FieldLabel className="text-white">Genre</FieldLabel>
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
                                </Field>

                                <Field>
                                    <FieldLabel className="text-white">
                                        Default borrow duration (days)
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
                                        book. Librarians can still extend the due date later if needed.
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

                    <div className="space-y-4 py-2">
                        <Field>
                            <FieldLabel className="text-white">Title</FieldLabel>
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
                            <FieldLabel className="text-white">Genre</FieldLabel>
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
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">
                                Default borrow duration (days)
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

                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by title, author, ISBN, genre…"
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
                                            {/* 🔒 Display-only availability (no onClick) */}
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
                                                {/* ✏️ Edit button with Lucide Edit icon */}
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

                                                {/* ✅ AlertDialog for delete confirmation */}
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
