import * as React from "react";
import { BookOpen, Loader2, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/dashboard-layout";
import {
    BookFormDialog,
    getDefaultBookFormValues,
    type BookFormValues,
    type InventorySnapshot,
} from "@/components/librarian-books/book-form-dialog";
import { BooksCatalogFilters } from "@/components/librarian-books/books-catalog-filters";
import { BooksCatalogTable } from "@/components/librarian-books/books-catalog-table";
import {
    LIBRARY_AREA_OTHER_VALUE,
    buildCatalogSortKey,
    compareNullableNumber,
    compareText,
    type CatalogAvailabilityFilter,
    type CatalogSortOption,
    formatLibraryAreaLabel,
    getErrorMessage,
    getInventory,
    isBorrowableByCopies,
    isKnownLibraryArea,
    matchesAllTokens,
    normalizeOtherLibraryArea,
    normalizeSearchText,
    parsePositiveIntOrNull,
    parseYearOrNull,
    tokenizeSearch,
} from "@/components/librarian-books/books-constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    createBook,
    deleteBook,
    fetchBooks,
    updateBook,
    type BookDTO,
    type LibraryArea,
} from "@/lib/books";

function buildCreatePayloadPagesValue(raw: string): number | string | null {
    const value = raw.trim();
    if (!value) return null;

    const numeric = parsePositiveIntOrNull(value);
    if (numeric !== null) return numeric;

    return value;
}

function buildEditFormValues(book: BookDTO): {
    values: BookFormValues;
    inventory: InventorySnapshot;
} {
    const rawPages = (book as { pages?: unknown }).pages;
    const inventory = getInventory(book);
    const currentArea = (book.libraryArea || "").trim();

    const currentTotalCopies =
        typeof inventory.total === "number" && inventory.total > 0 ? inventory.total : 1;

    return {
        values: {
            ...getDefaultBookFormValues(),
            title: book.title || "",
            author: book.author || "",
            isbn: book.isbn || "",
            issn: book.issn || "",
            accessionNumber: book.accessionNumber || "",
            subjects:
                (book.subjects && String(book.subjects).trim()) ||
                (book.genre && String(book.genre).trim()) ||
                (book.category && String(book.category).trim()) ||
                "",
            subtitle: book.subtitle || "",
            edition: book.edition || "",
            pubYear:
                typeof book.publicationYear === "number"
                    ? String(book.publicationYear)
                    : "",
            placeOfPublication: book.placeOfPublication || "",
            publisher: book.publisher || "",
            pages: rawPages !== undefined && rawPages !== null ? String(rawPages) : "",
            otherDetails: book.otherDetails || "",
            dimensions: book.dimensions || "",
            notes: book.notes || "",
            series: book.series || "",
            addedEntries: book.addedEntries || "",
            barcode: book.barcode || "",
            callNumber: book.callNumber || "",
            copyNumber:
                typeof book.copyNumber === "number" ? String(book.copyNumber) : "",
            volumeNumber: book.volumeNumber || "",
            numberOfCopies: String(currentTotalCopies),
            copiesMode: "set",
            copiesToAdd: "",
            libraryAreaOption: currentArea
                ? isKnownLibraryArea(currentArea)
                    ? currentArea
                    : LIBRARY_AREA_OTHER_VALUE
                : "",
            libraryAreaOther:
                currentArea && !isKnownLibraryArea(currentArea) ? currentArea : "",
            borrowDuration:
                typeof book.borrowDurationDays === "number" &&
                book.borrowDurationDays > 0
                    ? String(book.borrowDurationDays)
                    : "7",
            available: book.available,
        },
        inventory,
    };
}

export default function LibrarianBooksPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [availabilityFilter, setAvailabilityFilter] =
        React.useState<CatalogAvailabilityFilter>("all");
    const [libraryAreaFilter, setLibraryAreaFilter] = React.useState("all");
    const [sortOption, setSortOption] =
        React.useState<CatalogSortOption>("catalog");

    const [addOpen, setAddOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [formError, setFormError] = React.useState("");
    const [createForm, setCreateForm] = React.useState<BookFormValues>(() =>
        getDefaultBookFormValues()
    );

    const [editOpen, setEditOpen] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [editBookId, setEditBookId] = React.useState<string | null>(null);
    const [editError, setEditError] = React.useState("");
    const [editForm, setEditForm] = React.useState<BookFormValues>(() =>
        getDefaultBookFormValues()
    );
    const [editInventory, setEditInventory] = React.useState<InventorySnapshot | null>(
        null
    );

    const patchCreateForm = React.useCallback((patch: Partial<BookFormValues>) => {
        setCreateForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const patchEditForm = React.useCallback((patch: Partial<BookFormValues>) => {
        setEditForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const resetCreateForm = React.useCallback(() => {
        setCreateForm(getDefaultBookFormValues());
        setFormError("");
    }, []);

    const resetEditForm = React.useCallback(() => {
        setEditBookId(null);
        setEditForm(getDefaultBookFormValues());
        setEditInventory(null);
        setEditError("");
    }, []);

    const loadBooks = React.useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            const data = await fetchBooks();
            setBooks(data);
        } catch (err: unknown) {
            const message = getErrorMessage(err) || "Failed to load books. Please try again later.";
            setError(message);
            toast.error("Failed to load books", { description: message });
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

    const resolveLibraryArea = React.useCallback(
        (
            option: string,
            other: string
        ): { ok: true; value: string } | { ok: false; message: string } => {
            if (!option) {
                return { ok: false, message: "Library area is required." };
            }

            if (option === LIBRARY_AREA_OTHER_VALUE) {
                const normalized = normalizeOtherLibraryArea(other);
                if (!normalized) {
                    return { ok: false, message: "Please specify the library area." };
                }
                return { ok: true, value: normalized };
            }

            if (!isKnownLibraryArea(option)) {
                return { ok: false, message: "Please select a valid library area." };
            }

            return { ok: true, value: option };
        },
        []
    );

    const handleCreateBook = async () => {
        setFormError("");

        const resolvedCallNo = createForm.callNumber.trim();
        const resolvedAccNo = createForm.accessionNumber.trim();
        const resolvedTitle = createForm.title.trim();
        const resolvedSubtitle = createForm.subtitle.trim();
        const resolvedAuthor = createForm.author.trim();
        const resolvedSubjects = createForm.subjects.trim();

        if (!resolvedCallNo) {
            const message = "Call number is required.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        if (!resolvedAccNo) {
            const message = "Accession number is required.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        if (!resolvedTitle) {
            const message = "Title is required.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const pubYearNum = parseYearOrNull(createForm.pubYear);
        if (pubYearNum === null) {
            const message =
                "Publication year is required and must be a valid 4-digit year.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        if (!resolvedAuthor) {
            const message = "Author is required.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const resolvedPubPlace = createForm.placeOfPublication.trim();
        if (!resolvedPubPlace) {
            const message = "Place of publication is required.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const resolvedPublisher = createForm.publisher.trim();
        if (!resolvedPublisher) {
            const message = "Publisher is required.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const pagesValue = buildCreatePayloadPagesValue(createForm.pages);

        if (!createForm.barcode.trim()) {
            const message = "Barcode is required.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const area = resolveLibraryArea(
            createForm.libraryAreaOption,
            createForm.libraryAreaOther
        );
        if (!area.ok) {
            setFormError(area.message);
            toast.error("Validation error", { description: area.message });
            return;
        }

        if (!createForm.borrowDuration.trim()) {
            const message = "Borrow duration (days) is required.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const borrowDaysNum = Number(createForm.borrowDuration);
        if (!Number.isFinite(borrowDaysNum) || borrowDaysNum <= 0) {
            const message = "Borrow duration must be a positive number of days.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }
        const borrowDaysInt = Math.floor(borrowDaysNum);

        const copyNum = createForm.copyNumber.trim()
            ? parsePositiveIntOrNull(createForm.copyNumber)
            : null;
        if (createForm.copyNumber.trim() && copyNum === null) {
            const message = "Copy number must be a positive number.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const copiesTotal = parsePositiveIntOrNull(createForm.numberOfCopies);
        if (copiesTotal === null) {
            const message = "Total copies must be a positive number.";
            setFormError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        setSaving(true);
        try {
            const created = await createBook({
                callNumber: resolvedCallNo,
                accessionNumber: resolvedAccNo,
                title: resolvedTitle,
                subtitle: resolvedSubtitle,
                publicationYear: pubYearNum,
                author: resolvedAuthor,
                placeOfPublication: resolvedPubPlace,
                publisher: resolvedPublisher,
                isbn: createForm.isbn.trim(),
                issn: createForm.issn.trim(),
                subjects: resolvedSubjects || undefined,
                category: resolvedSubjects || undefined,
                edition: createForm.edition.trim(),
                pages: pagesValue as any,
                otherDetails: createForm.otherDetails.trim(),
                dimensions: createForm.dimensions.trim(),
                notes: createForm.notes.trim(),
                series: createForm.series.trim(),
                addedEntries: createForm.addedEntries.trim(),
                barcode: createForm.barcode.trim(),
                copyNumber: copyNum,
                volumeNumber: createForm.volumeNumber.trim(),
                libraryArea: area.value as LibraryArea,
                numberOfCopies: copiesTotal,
                available: createForm.available,
                borrowDurationDays: borrowDaysInt,
            });

            setBooks((prev) => [created, ...prev]);
            toast.success("Book added", {
                description: `"${created.title}" has been added to the catalog.`,
            });

            resetCreateForm();
            setAddOpen(false);
        } catch (err: unknown) {
            const message = getErrorMessage(err) || "Failed to create book. Please try again later.";
            setFormError(message);
            toast.error("Failed to create book", { description: message });
        } finally {
            setSaving(false);
        }
    };

    const openEditDialog = React.useCallback((book: BookDTO) => {
        const { values, inventory } = buildEditFormValues(book);
        setEditBookId(book.id);
        setEditForm(values);
        setEditInventory(inventory);
        setEditError("");
        setEditOpen(true);
    }, []);

    const handleUpdateBook = async () => {
        if (!editBookId) return;

        setEditError("");

        const resolvedCallNo = editForm.callNumber.trim();
        const resolvedAccNo = editForm.accessionNumber.trim();
        const resolvedTitle = editForm.title.trim();
        const resolvedSubtitle = editForm.subtitle.trim();
        const resolvedAuthor = editForm.author.trim();
        const resolvedSubjects = editForm.subjects.trim();

        if (!resolvedCallNo) {
            const message = "Call number is required.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        if (!resolvedAccNo) {
            const message = "Accession number is required.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        if (!resolvedTitle) {
            const message = "Title is required.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const pubYearNum = parseYearOrNull(editForm.pubYear);
        if (pubYearNum === null) {
            const message =
                "Publication year is required and must be a valid 4-digit year.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        if (!resolvedAuthor) {
            const message = "Author is required.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const resolvedPubPlace = editForm.placeOfPublication.trim();
        if (!resolvedPubPlace) {
            const message = "Place of publication is required.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const resolvedPublisher = editForm.publisher.trim();
        if (!resolvedPublisher) {
            const message = "Publisher is required.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const pagesValue = buildCreatePayloadPagesValue(editForm.pages);

        if (!editForm.barcode.trim()) {
            const message = "Barcode is required.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const area = resolveLibraryArea(
            editForm.libraryAreaOption,
            editForm.libraryAreaOther
        );
        if (!area.ok) {
            setEditError(area.message);
            toast.error("Validation error", { description: area.message });
            return;
        }

        if (!editForm.borrowDuration.trim()) {
            const message = "Borrow duration (days) is required.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        const borrowDaysNum = Number(editForm.borrowDuration);
        if (!Number.isFinite(borrowDaysNum) || borrowDaysNum <= 0) {
            const message = "Borrow duration must be a positive number of days.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }
        const borrowDaysInt = Math.floor(borrowDaysNum);

        const copyNum = editForm.copyNumber.trim()
            ? parsePositiveIntOrNull(editForm.copyNumber)
            : null;
        if (editForm.copyNumber.trim() && copyNum === null) {
            const message = "Copy number must be a positive number.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        let copiesPayload: { numberOfCopies?: number; copiesToAdd?: number } = {};

        if (editForm.copiesMode === "set") {
            const total = parsePositiveIntOrNull(editForm.numberOfCopies);
            if (total === null) {
                const message = "Total copies must be a positive number.";
                setEditError(message);
                toast.error("Validation error", { description: message });
                return;
            }

            if (
                typeof editInventory?.borrowed === "number" &&
                total < editInventory.borrowed
            ) {
                const message = `Total copies cannot be less than currently borrowed copies (${editInventory.borrowed}).`;
                setEditError(message);
                toast.error("Validation error", { description: message });
                return;
            }

            copiesPayload = { numberOfCopies: total };
        } else {
            const increment = parsePositiveIntOrNull(editForm.copiesToAdd);
            if (increment === null) {
                const message = "Copies to add must be a positive number.";
                setEditError(message);
                toast.error("Validation error", { description: message });
                return;
            }
            copiesPayload = { copiesToAdd: increment };
        }

        setEditing(true);
        try {
            const updated = await updateBook(editBookId, {
                callNumber: resolvedCallNo,
                accessionNumber: resolvedAccNo,
                title: resolvedTitle,
                subtitle: resolvedSubtitle,
                publicationYear: pubYearNum,
                author: resolvedAuthor,
                placeOfPublication: resolvedPubPlace,
                publisher: resolvedPublisher,
                isbn: editForm.isbn.trim(),
                issn: editForm.issn.trim(),
                subjects: resolvedSubjects || undefined,
                category: resolvedSubjects || undefined,
                edition: editForm.edition.trim(),
                pages: pagesValue as any,
                otherDetails: editForm.otherDetails.trim(),
                dimensions: editForm.dimensions.trim(),
                notes: editForm.notes.trim(),
                series: editForm.series.trim(),
                addedEntries: editForm.addedEntries.trim(),
                barcode: editForm.barcode.trim(),
                copyNumber: copyNum,
                volumeNumber: editForm.volumeNumber.trim(),
                libraryArea: area.value as LibraryArea,
                ...copiesPayload,
                available: editForm.available,
                borrowDurationDays: borrowDaysInt,
            });

            setBooks((prev) => prev.map((book) => (book.id === updated.id ? updated : book)));

            toast.success("Book updated", {
                description: `"${updated.title}" has been updated.`,
            });

            setEditOpen(false);
            resetEditForm();
        } catch (err: unknown) {
            const message = getErrorMessage(err) || "Failed to update book. Please try again later.";
            setEditError(message);
            toast.error("Failed to update book", { description: message });
        } finally {
            setEditing(false);
        }
    };

    const handleDelete = async (book: BookDTO) => {
        const previous = books;
        setBooks((prev) => prev.filter((item) => item.id !== book.id));

        try {
            await deleteBook(book.id);
            toast.success("Book deleted", {
                description: `"${book.title}" has been removed from the catalog.`,
            });
        } catch (err: unknown) {
            setBooks(previous);
            const message = getErrorMessage(err) || "Failed to delete book. Please try again later.";
            toast.error("Delete failed", { description: message });
        }
    };

    const libraryAreaChoices = React.useMemo(() => {
        const values = new Set<string>();

        books.forEach((book) => {
            const area = book.libraryArea ? String(book.libraryArea).trim() : "";
            if (area) values.add(area);
        });

        return Array.from(values).sort((a, b) =>
            formatLibraryAreaLabel(a).localeCompare(formatLibraryAreaLabel(b), undefined, {
                sensitivity: "base",
            })
        );
    }, [books]);

    React.useEffect(() => {
        if (libraryAreaFilter !== "all" && !libraryAreaChoices.includes(libraryAreaFilter)) {
            setLibraryAreaFilter("all");
        }
    }, [libraryAreaChoices, libraryAreaFilter]);

    const clearCatalogControls = React.useCallback(() => {
        setSearch("");
        setAvailabilityFilter("all");
        setLibraryAreaFilter("all");
        setSortOption("catalog");
    }, []);

    const hasCatalogControlsApplied =
        search.trim().length > 0 ||
        availabilityFilter !== "all" ||
        libraryAreaFilter !== "all" ||
        sortOption !== "catalog";

    const filteredBooks = React.useMemo(() => {
        const tokens = tokenizeSearch(search);

        const base = books.filter((book) => {
            const inventory = getInventory(book);
            const area = book.libraryArea ? String(book.libraryArea).trim() : "";
            const areaLabel = area ? formatLibraryAreaLabel(area) : "";
            const rawPages = (book as { pages?: unknown }).pages;
            const borrowable = isBorrowableByCopies(book);

            if (libraryAreaFilter !== "all" && area !== libraryAreaFilter) {
                return false;
            }

            if (availabilityFilter === "available" && !borrowable) {
                return false;
            }

            if (availabilityFilter === "unavailable" && borrowable) {
                return false;
            }

            if (tokens.length === 0) {
                return true;
            }

            const hay = [
                book.title,
                book.subtitle || "",
                book.author,
                book.accessionNumber || "",
                book.callNumber || "",
                book.isbn || "",
                book.issn || "",
                book.subjects || "",
                book.genre || "",
                book.category || "",
                book.publisher || "",
                book.placeOfPublication || "",
                book.barcode || "",
                String(rawPages ?? ""),
                book.series || "",
                book.addedEntries || "",
                book.notes || "",
                book.otherDetails || "",
                String(typeof book.publicationYear === "number" ? book.publicationYear : ""),
                String(typeof book.copyrightYear === "number" ? book.copyrightYear : ""),
                area,
                areaLabel,
                String(
                    typeof book.borrowDurationDays === "number"
                        ? book.borrowDurationDays
                        : ""
                ),
                String(inventory.remaining ?? ""),
                String(inventory.total ?? ""),
                String(inventory.borrowed ?? ""),
                book.available ? "available" : "unavailable",
            ]
                .map(normalizeSearchText)
                .filter(Boolean)
                .join(" ");

            return matchesAllTokens(hay, tokens);
        });

        return [...base].sort((a, b) => {
            switch (sortOption) {
                case "title_asc":
                    return (
                        compareText(a.title, b.title) ||
                        compareText(a.author, b.author) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "title_desc":
                    return (
                        compareText(b.title, a.title) ||
                        compareText(b.author, a.author) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "author_asc":
                    return (
                        compareText(a.author, b.author) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "author_desc":
                    return (
                        compareText(b.author, a.author) ||
                        compareText(b.title, a.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "pub_year_desc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "desc") ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "pub_year_asc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "asc") ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "copies_desc": {
                    const invA = getInventory(a);
                    const invB = getInventory(b);

                    return (
                        compareNullableNumber(invA.total, invB.total, "desc") ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );
                }

                case "copies_asc": {
                    const invA = getInventory(a);
                    const invB = getInventory(b);

                    return (
                        compareNullableNumber(invA.total, invB.total, "asc") ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );
                }

                case "catalog":
                default:
                    return buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                        sensitivity: "base",
                    });
            }
        });
    }, [availabilityFilter, books, libraryAreaFilter, search, sortOption]);

    return (
        <DashboardLayout title="Books Management">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                    <BookOpen className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold leading-tight">Catalog &amp; inventory</h2>
                        <p className="text-xs text-white/70">
                            Add new titles, manage inventory copies, and monitor remaining/borrowed
                            counts.
                        </p>
                    </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
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

                    <BookFormDialog
                        mode="create"
                        open={addOpen}
                        onOpenChange={(open) => {
                            setAddOpen(open);
                            if (!open) resetCreateForm();
                        }}
                        values={createForm}
                        onChange={patchCreateForm}
                        onSubmit={handleCreateBook}
                        onCancel={() => {
                            setAddOpen(false);
                            resetCreateForm();
                        }}
                        submitting={saving}
                        error={formError}
                        trigger={
                            <Button
                                type="button"
                                className="cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add book
                            </Button>
                        }
                    />
                </div>
            </div>

            <BookFormDialog
                mode="edit"
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) resetEditForm();
                }}
                values={editForm}
                onChange={patchEditForm}
                onSubmit={handleUpdateBook}
                onCancel={() => {
                    setEditOpen(false);
                    resetEditForm();
                }}
                submitting={editing}
                error={editError}
                inventory={editInventory}
            />

            <Card className="border-white/10 bg-slate-800/60">
                <BooksCatalogFilters
                    booksCount={books.length}
                    filteredCount={filteredBooks.length}
                    booksForExcel={filteredBooks}
                    search={search}
                    onSearchChange={setSearch}
                    libraryAreaChoices={libraryAreaChoices}
                    libraryAreaFilter={libraryAreaFilter}
                    onLibraryAreaFilterChange={setLibraryAreaFilter}
                    availabilityFilter={availabilityFilter}
                    onAvailabilityFilterChange={setAvailabilityFilter}
                    sortOption={sortOption}
                    onSortOptionChange={setSortOption}
                    onClear={clearCatalogControls}
                    hasApplied={hasCatalogControlsApplied}
                />

                <CardContent className="overflow-x-auto">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center text-sm text-red-300">{error}</div>
                    ) : filteredBooks.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            No books found in the catalog.
                            <br />
                            <span className="text-xs opacity-80">
                                Try adjusting your search, sort, or filters.
                            </span>
                        </div>
                    ) : (
                        <BooksCatalogTable
                            books={filteredBooks}
                            onEdit={openEditDialog}
                            onDelete={handleDelete}
                            cellScrollbarClasses=""
                        />
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}