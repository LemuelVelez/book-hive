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
} from "lucide-react";
import {
    fetchBooks,
    createBook,
    updateBook,
    deleteBook,
    type BookDTO,
} from "@/lib/books";

export default function LibrarianBooksPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");

    // Dialog + form state
    const [addOpen, setAddOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [title, setTitle] = React.useState("");
    const [author, setAuthor] = React.useState("");
    const [isbn, setIsbn] = React.useState("");
    const [genre, setGenre] = React.useState("");
    const [pubYear, setPubYear] = React.useState("");
    const [available, setAvailable] = React.useState(true);
    const [formError, setFormError] = React.useState<string>("");

    const resetForm = () => {
        setTitle("");
        setAuthor("");
        setIsbn("");
        setGenre("");
        setPubYear("");
        setAvailable(true);
        setFormError("");
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
        loadBooks();
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

        setSaving(true);
        try {
            const created = await createBook({
                title: title.trim(),
                author: author.trim(),
                isbn: isbn.trim(),
                genre: genre.trim(),
                publicationYear: yearNum,
                available,
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

    const handleToggleAvailable = async (book: BookDTO) => {
        const nextAvailable = !book.available;
        // Optimistic update
        setBooks((prev) =>
            prev.map((b) =>
                b.id === book.id ? { ...b, available: nextAvailable } : b
            )
        );

        try {
            const updated = await updateBook(book.id, { available: nextAvailable });
            setBooks((prev) =>
                prev.map((b) => (b.id === updated.id ? updated : b))
            );
            toast.success("Availability updated", {
                description: `"${updated.title}" is now ${updated.available ? "available" : "unavailable"
                    }.`,
            });
        } catch (err: any) {
            // Rollback
            setBooks((prev) =>
                prev.map((b) =>
                    b.id === book.id ? { ...b, available: book.available } : b
                )
            );
            const msg =
                err?.message || "Failed to update availability. Please try again.";
            toast.error("Update failed", { description: msg });
        }
    };

    const handleDelete = async (book: BookDTO) => {
        const ok = window.confirm(
            `Are you sure you want to delete "${book.title}" from the catalog?`
        );
        if (!ok) return;

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
                                    <FieldLabel className="text-white">
                                        Publication year
                                    </FieldLabel>
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
                                        <TableCell>
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1 text-xs bg-transparent border-0 cursor-pointer"
                                                onClick={() => handleToggleAvailable(book)}
                                            >
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
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="text-red-300 hover:text-red-100 hover:bg-red-500/15"
                                                onClick={() => handleDelete(book)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete</span>
                                            </Button>
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
