import * as React from "react";
import { BookCopy, BookOpen, Loader2, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/dashboard-layout";
import {
    BookFormDialog,
    getDefaultBookFormValues,
    type BookFormValues,
    type InventorySnapshot,
} from "@/components/librarian-books/book-form-dialog";
import { BooksCatalogFilters } from "@/components/librarian-books/books-catalog-filters";
import {
    LIBRARY_AREA_OTHER_VALUE,
    buildCatalogSortKey,
    compareNullableNumber,
    compareText,
    type CatalogAvailabilityFilter,
    type CatalogSortOption,
    formatLibraryAreaLabel,
    getBorrowTracking,
    getErrorMessage,
    getInventory,
    isBorrowableByCopies,
    isKnownLibraryArea,
    isLibraryUseOnlyBook,
    matchesAllTokens,
    normalizeOtherLibraryArea,
    normalizeSearchText,
    parsePositiveIntOrNull,
    parseYearOrNull,
    tokenizeSearch,
} from "@/components/librarian-books/books-constants";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    addBookCopy,
    createBook,
    deleteBook,
    fetchBooks,
    updateBook,
    type BookDTO,
    type LibraryArea,
} from "@/lib/books";

type AddCopyFormValues = {
    count: string;
};

function getDefaultAddCopyFormValues(): AddCopyFormValues {
    return {
        count: "1",
    };
}

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
    const tracking = getBorrowTracking(book);
    const currentArea = (book.libraryArea || "").trim();

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
            numberOfCopies: "1",
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
            isLibraryUseOnly: Boolean(book.isLibraryUseOnly),
        },
        inventory: {
            ...inventory,
            activeBorrowCount: tracking.active,
            totalBorrowCount: tracking.total,
        },
    };
}

function formatDetailValue(value: unknown, fallback = "—") {
    if (typeof value === "number") return String(value);
    if (typeof value === "string") {
        const normalized = value.trim();
        return normalized || fallback;
    }
    return fallback;
}

function getSubjectsValue(book: BookDTO) {
    return formatDetailValue(book.subjects || book.genre || book.category || "");
}

function getLibraryAreaValue(book: BookDTO) {
    const value = String(book.libraryArea || "").trim();
    return value ? formatLibraryAreaLabel(value) : "—";
}

function getInventoryValue(book: BookDTO) {
    const inventory = getInventory(book);
    const total = typeof inventory.total === "number" ? inventory.total : 0;
    const borrowed = typeof inventory.borrowed === "number" ? inventory.borrowed : 0;
    const remaining = typeof inventory.remaining === "number" ? inventory.remaining : 0;
    return `Total: ${total} · Borrowed: ${borrowed} · Available: ${remaining}`;
}

function getBorrowTrackingValue(book: BookDTO) {
    const tracking = getBorrowTracking(book);
    const active = typeof tracking.active === "number" ? tracking.active : 0;
    const total = typeof tracking.total === "number" ? tracking.total : 0;
    return `Active: ${active} · All-time: ${total}`;
}

function getLoanDaysValue(book: BookDTO) {
    return typeof book.borrowDurationDays === "number" && book.borrowDurationDays > 0
        ? `${book.borrowDurationDays} day${book.borrowDurationDays === 1 ? "" : "s"}`
        : "—";
}

function getStatusMeta(book: BookDTO): { label: string; classes: string } {
    if (isLibraryUseOnlyBook(book)) {
        return {
            label: "Library Use Only",
            classes: "border-amber-400/30 bg-amber-500/15 text-amber-100",
        };
    }

    if (isBorrowableByCopies(book)) {
        return {
            label: "Available",
            classes: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
        };
    }

    return {
        label: "Unavailable",
        classes: "border-rose-400/30 bg-rose-500/15 text-rose-100",
    };
}

function buildAddCopyFormValues(_source: BookDTO): AddCopyFormValues {
    return {
        count: "1",
    };
}

function CatalogDetail({
    label,
    value,
    children,
    className = "",
}: {
    label: string;
    value?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`rounded-xl border border-white/10 bg-black/20 p-3 ${className}`.trim()}>
            <div className="text-[11px] uppercase tracking-wide text-white/55">{label}</div>
            <div className="mt-1 wrap-break-word text-sm text-white/90">{children ?? value ?? "—"}</div>
        </div>
    );
}

function BookCatalogDetails({
    book,
    status,
    onEdit,
    onDelete,
    onAddCopy,
}: {
    book: BookDTO;
    status: ReturnType<typeof getStatusMeta>;
    onEdit: () => void;
    onDelete: () => void;
    onAddCopy: () => void;
}) {
    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <CatalogDetail label="Call no." value={formatDetailValue(book.callNumber)} />
            <CatalogDetail label="Accession #" value={formatDetailValue(book.accessionNumber)} />
            <CatalogDetail label="Title" value={formatDetailValue(book.title)} />
            <CatalogDetail label="Sub." value={formatDetailValue(book.subtitle)} />
            <CatalogDetail label="Pub. year" value={formatDetailValue(book.publicationYear)} />
            <CatalogDetail label="Author" value={formatDetailValue(book.author)} />
            <CatalogDetail label="Subjects" value={getSubjectsValue(book)} />
            <CatalogDetail label="Publisher" value={formatDetailValue(book.publisher)} />
            <CatalogDetail label="Library area" value={getLibraryAreaValue(book)} />
            <CatalogDetail label="Inventory" value={getInventoryValue(book)} />
            <CatalogDetail label="Borrow tracking" value={getBorrowTrackingValue(book)} />
            <CatalogDetail label="Barcode" value={formatDetailValue(book.barcode)} />
            <CatalogDetail label="ISBN" value={formatDetailValue(book.isbn)} />
            <CatalogDetail label="Loan days" value={getLoanDaysValue(book)} />
            <CatalogDetail label="Status">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${status.classes}`}>
                    {status.label}
                </span>
            </CatalogDetail>
            <CatalogDetail label="Actions">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 text-white/90 hover:bg-white/10"
                        onClick={onAddCopy}
                    >
                        Add copy
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 text-white/90 hover:bg-white/10"
                        onClick={onEdit}
                    >
                        Edit
                    </Button>
                    <Button type="button" variant="destructive" onClick={onDelete}>
                        Delete
                    </Button>
                </div>
            </CatalogDetail>
        </div>
    );
}

function BookCatalogCard({
    book,
    onEdit,
    onDelete,
    onAddCopy,
}: {
    book: BookDTO;
    onEdit: (book: BookDTO) => void;
    onDelete: (book: BookDTO) => void;
    onAddCopy: (book: BookDTO) => void;
}) {
    const status = getStatusMeta(book);
    const [detailsOpen, setDetailsOpen] = React.useState(false);

    const handleEdit = React.useCallback(() => {
        setDetailsOpen(false);
        onEdit(book);
    }, [book, onEdit]);

    const handleAddCopy = React.useCallback(() => {
        setDetailsOpen(false);
        onAddCopy(book);
    }, [book, onAddCopy]);

    const handleDeleteRequest = React.useCallback(() => {
        if (
            typeof window !== "undefined" &&
            !window.confirm(
                `Delete "${formatDetailValue(book.title, "this book")}" from the catalog?`
            )
        ) {
            return;
        }

        setDetailsOpen(false);
        onDelete(book);
    }, [book, onDelete]);

    return (
        <>
            <AccordionItem
                value={book.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 px-0 shadow-sm transition-colors hover:border-white/20"
            >
                <AccordionTrigger className="gap-3 px-4 py-4 text-white hover:no-underline [&>svg]:mt-0.5 [&>svg]:shrink-0 [&>svg]:self-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2 pr-2 text-left">
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                            {formatDetailValue(book.callNumber)}
                        </span>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.classes}`}>
                            {status.label}
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold text-white">
                            {formatDetailValue(book.title)} • {formatDetailValue(book.author)}
                        </span>
                    </div>
                </AccordionTrigger>

                <AccordionContent className="border-t border-white/10 px-4 pb-4 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full border-white/20 text-white/90 hover:bg-white/10 sm:w-auto"
                        onClick={() => setDetailsOpen(true)}
                    >
                        Details
                    </Button>
                </AccordionContent>
            </AccordionItem>

            <Dialog modal open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent
                    className="w-[92vw] max-h-[95svh] overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-4xl
        [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-slate-900/70
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-slate-700
        [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
                >
                    <DialogHeader>
                        <DialogTitle className="pr-6">{formatDetailValue(book.title)}</DialogTitle>
                        <DialogDescription className="text-white/70">
                            Review the complete catalog details, inventory status, and available
                            actions for this book record.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                                {formatDetailValue(book.callNumber)}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.classes}`}>
                                {status.label}
                            </span>
                        </div>

                        <BookCatalogDetails
                            book={book}
                            status={status}
                            onEdit={handleEdit}
                            onDelete={handleDeleteRequest}
                            onAddCopy={handleAddCopy}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
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

    const [copyOpen, setCopyOpen] = React.useState(false);
    const [copying, setCopying] = React.useState(false);
    const [copyError, setCopyError] = React.useState("");
    const [copySourceBook, setCopySourceBook] = React.useState<BookDTO | null>(null);
    const [copyForm, setCopyForm] = React.useState<AddCopyFormValues>(() =>
        getDefaultAddCopyFormValues()
    );

    const patchCreateForm = React.useCallback((patch: Partial<BookFormValues>) => {
        setCreateForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const patchEditForm = React.useCallback((patch: Partial<BookFormValues>) => {
        setEditForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const patchCopyForm = React.useCallback((patch: Partial<AddCopyFormValues>) => {
        setCopyForm((prev) => ({ ...prev, ...patch }));
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

    const resetCopyForm = React.useCallback(() => {
        setCopySourceBook(null);
        setCopyForm(getDefaultAddCopyFormValues());
        setCopyError("");
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

        const resolvedBarcode = createForm.barcode.trim();
        if (!resolvedBarcode) {
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

        const copyNumberInput = createForm.copyNumber.trim();
        const copyNum = parsePositiveIntOrNull(copyNumberInput);
        if (!copyNumberInput || copyNum === null) {
            const message = "Copy number is required and must be a positive number.";
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
                barcode: resolvedBarcode,
                copyNumber: copyNum,
                volumeNumber: createForm.volumeNumber.trim(),
                libraryArea: area.value as LibraryArea,
                numberOfCopies: 1,
                available: createForm.available,
                isLibraryUseOnly: createForm.isLibraryUseOnly,
                canBorrow: !createForm.isLibraryUseOnly,
                borrowDurationDays: borrowDaysInt,
            });

            setBooks((prev) => [created, ...prev]);
            toast.success("Book added", {
                description: `"${created.title}" has been added to the catalog as a single copy record.`,
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

    const openAddCopyDialog = React.useCallback((book: BookDTO) => {
        setCopySourceBook(book);
        setCopyForm(buildAddCopyFormValues(book));
        setCopyError("");
        setCopyOpen(true);
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

        const resolvedBarcode = editForm.barcode.trim();
        if (!resolvedBarcode) {
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

        const copyNumberInput = editForm.copyNumber.trim();
        const copyNum = parsePositiveIntOrNull(copyNumberInput);
        if (!copyNumberInput || copyNum === null) {
            const message = "Copy number is required and must be a positive number.";
            setEditError(message);
            toast.error("Validation error", { description: message });
            return;
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
                barcode: resolvedBarcode,
                copyNumber: copyNum,
                volumeNumber: editForm.volumeNumber.trim(),
                libraryArea: area.value as LibraryArea,
                available: editForm.available,
                isLibraryUseOnly: editForm.isLibraryUseOnly,
                canBorrow: !editForm.isLibraryUseOnly,
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

    const handleAddCopy = async () => {
        if (!copySourceBook) return;

        setCopyError("");

        const count = parsePositiveIntOrNull(copyForm.count);
        if (count === null) {
            const message = "Please enter a valid positive number of copies to add.";
            setCopyError(message);
            toast.error("Validation error", { description: message });
            return;
        }

        setCopying(true);
        try {
            const updated = await addBookCopy(copySourceBook.id, {
                count,
            });

            setBooks((prev) => {
                const exists = prev.some((book) => book.id === updated.id);
                if (!exists) {
                    return [updated, ...prev];
                }

                return prev.map((book) => (book.id === updated.id ? updated : book));
            });
            setCopyForm(buildAddCopyFormValues(copySourceBook));

            toast.success("Copy count updated", {
                description: `${count} cop${count === 1 ? "y has" : "ies have"} been added to "${copySourceBook.title}".`,
            });
        } catch (err: unknown) {
            const message = getErrorMessage(err) || "Failed to add the copy. Please try again later.";
            setCopyError(message);
            toast.error("Failed to add copy", { description: message });
        } finally {
            setCopying(false);
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
            const tracking = getBorrowTracking(book);
            const area = book.libraryArea ? String(book.libraryArea).trim() : "";
            const areaLabel = area ? formatLibraryAreaLabel(area) : "";
            const rawPages = (book as { pages?: unknown }).pages;
            const borrowable = isBorrowableByCopies(book);
            const libraryUseOnly = isLibraryUseOnlyBook(book);

            if (libraryAreaFilter !== "all" && area !== libraryAreaFilter) {
                return false;
            }

            if (availabilityFilter === "available" && !borrowable) {
                return false;
            }

            if (availabilityFilter === "unavailable" && (borrowable || libraryUseOnly)) {
                return false;
            }

            if (availabilityFilter === "library_use_only" && !libraryUseOnly) {
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
                String(typeof book.copyNumber === "number" ? book.copyNumber : ""),
                book.volumeNumber || "",
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
                String(tracking.active ?? ""),
                String(tracking.total ?? ""),
                book.available ? "available" : "unavailable",
                libraryUseOnly ? "library use only" : "",
                libraryUseOnly ? "cannot borrow" : "borrowable",
                book.canBorrow === false ? "cannot borrow" : "can borrow",
            ]
                .map(normalizeSearchText)
                .filter(Boolean)
                .join(" ");

            return matchesAllTokens(hay, tokens);
        });

        return [...base].sort((a, b) => {
            const sectionRankA = isLibraryUseOnlyBook(a) ? 1 : 0;
            const sectionRankB = isLibraryUseOnlyBook(b) ? 1 : 0;

            if (sectionRankA !== sectionRankB) {
                return sectionRankA - sectionRankB;
            }

            switch (sortOption) {
                case "title_asc":
                    return (
                        compareText(a.title, b.title) ||
                        compareText(a.author, b.author) ||
                        compareNullableNumber(a.copyNumber, b.copyNumber, "asc") ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "title_desc":
                    return (
                        compareText(b.title, a.title) ||
                        compareText(b.author, a.author) ||
                        compareNullableNumber(a.copyNumber, b.copyNumber, "asc") ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "author_asc":
                    return (
                        compareText(a.author, b.author) ||
                        compareText(a.title, b.title) ||
                        compareNullableNumber(a.copyNumber, b.copyNumber, "asc") ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "author_desc":
                    return (
                        compareText(b.author, a.author) ||
                        compareText(b.title, a.title) ||
                        compareNullableNumber(a.copyNumber, b.copyNumber, "asc") ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "pub_year_desc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "desc") ||
                        compareText(a.title, b.title) ||
                        compareNullableNumber(a.copyNumber, b.copyNumber, "asc") ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "pub_year_asc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "asc") ||
                        compareText(a.title, b.title) ||
                        compareNullableNumber(a.copyNumber, b.copyNumber, "asc") ||
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
                        compareNullableNumber(a.copyNumber, b.copyNumber, "asc") ||
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
                        compareNullableNumber(a.copyNumber, b.copyNumber, "asc") ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );
                }

                case "catalog":
                default:
                    return (
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        }) || compareNullableNumber(a.copyNumber, b.copyNumber, "asc")
                    );
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
                            Add the first copy of a title, then use <span className="font-semibold text-white">Add copy</span>{" "}
                            to increase the inventory count for the same catalog entry without
                            creating repeated duplicate rows for saved copies.
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

            <Dialog
                modal
                open={copyOpen}
                onOpenChange={(open) => {
                    setCopyOpen(open);
                    if (!open) resetCopyForm();
                }}
            >
                <DialogContent
                    className="w-[92vw] max-h-[95svh] overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-lg
        [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-slate-900/70
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-slate-700
        [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookCopy className="h-4 w-4" />
                            Add copy
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                            Add more inventory to the selected catalog entry without creating a
                            separate duplicate row for each saved copy.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-white/80">
                            <div className="font-medium text-white">
                                {copySourceBook ? formatDetailValue(copySourceBook.title) : "—"}
                            </div>
                            <div className="mt-1 text-xs text-white/60">
                                {copySourceBook ? formatDetailValue(copySourceBook.author) : "—"}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/75">
                                    Call no. {copySourceBook ? formatDetailValue(copySourceBook.callNumber) : "—"}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/75">
                                    {copySourceBook ? getLibraryAreaValue(copySourceBook) : "—"}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/75">
                                    {copySourceBook ? getInventoryValue(copySourceBook) : "—"}
                                </span>
                            </div>
                        </div>

                        <Field>
                            <FieldLabel className="text-white">Number of copies to add *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={copyForm.count}
                                    onChange={(e) => patchCopyForm({ count: e.target.value })}
                                    placeholder="Required (positive number)"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    inputMode="numeric"
                                    autoComplete="off"
                                />
                            </FieldContent>
                            <p className="mt-1 text-[11px] text-white/60">
                                This increases the inventory count for the same book entry instead of
                                creating a repeated catalog record.
                            </p>
                        </Field>

                        {copyError ? <FieldError>{copyError}</FieldError> : null}
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full border-white/20 text-white hover:bg-black/10 hover:text-white sm:w-auto"
                            onClick={() => {
                                setCopyOpen(false);
                                resetCopyForm();
                            }}
                            disabled={copying}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            className="w-full cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 sm:w-auto"
                            onClick={handleAddCopy}
                            disabled={copying}
                        >
                            {copying ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving…
                                </span>
                            ) : (
                                "Add copies"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-28 w-full rounded-2xl" />
                            <Skeleton className="h-28 w-full rounded-2xl" />
                            <Skeleton className="h-28 w-full rounded-2xl" />
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
                        <Accordion type="multiple" className="space-y-3">
                            {filteredBooks.map((book) => (
                                <BookCatalogCard
                                    key={book.id}
                                    book={book}
                                    onEdit={openEditDialog}
                                    onDelete={handleDelete}
                                    onAddCopy={openAddCopyDialog}
                                />
                            ))}
                        </Accordion>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}