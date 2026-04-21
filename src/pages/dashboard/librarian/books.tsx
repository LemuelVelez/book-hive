import * as React from "react";
import { BookCopy, BookOpen, Loader2, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/dashboard-layout";
import {
    BookFormDialog,
    getDefaultBookFormValues,
    type BookFormMode,
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
    addBookCopy,
    createBook,
    deleteBook,
    deleteBookCopy,
    fetchBooks,
    updateBook,
    updateBookCopy,
    type BookDTO,
    type LibraryArea,
} from "@/lib/books";

function getCopyRecords(book: BookDTO): BookDTO[] {
    if (Array.isArray(book.copies) && book.copies.length > 0) {
        return [...book.copies].sort((a, b) => {
            const aIsOriginal = a.id === book.id;
            const bIsOriginal = b.id === book.id;

            if (aIsOriginal !== bIsOriginal) {
                return aIsOriginal ? -1 : 1;
            }

            const aCopy =
                typeof a.copyNumber === "number" ? a.copyNumber : Number.MAX_SAFE_INTEGER;
            const bCopy =
                typeof b.copyNumber === "number" ? b.copyNumber : Number.MAX_SAFE_INTEGER;

            if (aCopy !== bCopy) return aCopy - bCopy;

            return String(a.accessionNumber || "").localeCompare(
                String(b.accessionNumber || ""),
                undefined,
                {
                    numeric: true,
                    sensitivity: "base",
                }
            );
        });
    }

    return [{ ...book, copies: undefined }];
}

function getAdditionalCopyRecords(book: BookDTO): BookDTO[] {
    return getCopyRecords(book).filter((copy) => copy.id !== book.id);
}

function isBorrowedCopy(book: BookDTO): boolean {
    if (isLibraryUseOnlyBook(book)) {
        return false;
    }

    const activeBorrowCount =
        typeof book.activeBorrowCount === "number" && Number.isFinite(book.activeBorrowCount)
            ? book.activeBorrowCount
            : typeof book.borrowedCopies === "number" && Number.isFinite(book.borrowedCopies)
              ? book.borrowedCopies
              : 0;

    return activeBorrowCount > 0 || Boolean(book.totalCopies && !book.available);
}

function getCopyDisplayLabel(groupBook: BookDTO, copy: BookDTO): string {
    if (copy.id === groupBook.id) {
        return "Original";
    }

    const additionalIndex = getAdditionalCopyRecords(groupBook).findIndex(
        (item) => item.id === copy.id
    );

    if (additionalIndex >= 0) {
        return `Copy ${additionalIndex + 1}`;
    }

    return `Copy ${formatDetailValue(copy.copyNumber, "—")}`;
}

function getStoredCopyNumberLabel(copy: BookDTO): string {
    if (typeof copy.copyNumber === "number" && Number.isFinite(copy.copyNumber)) {
        return String(copy.copyNumber);
    }

    return "—";
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
            available: Boolean(book.available),
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

function getGroupLibraryAreas(book: BookDTO) {
    const values = new Set<string>();

    getCopyRecords(book).forEach((item) => {
        const area = item.libraryArea ? String(item.libraryArea).trim() : "";
        if (area) values.add(area);
    });

    if (values.size === 0) {
        const fallback = book.libraryArea ? String(book.libraryArea).trim() : "";
        if (fallback) values.add(fallback);
    }

    return Array.from(values);
}

function getLibraryAreaValue(book: BookDTO) {
    const values = getGroupLibraryAreas(book);
    if (values.length === 0) return "—";
    return values.map((value) => formatLibraryAreaLabel(value)).join(", ");
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

function getStatusMeta(
    book: BookDTO,
    kind: "group" | "copy" = "group"
): { label: string; classes: string } {
    if (isLibraryUseOnlyBook(book)) {
        return {
            label: "Library Use Only",
            classes: "border-amber-400/30 bg-amber-500/15 text-amber-100",
        };
    }

    if (kind === "copy") {
        if (isBorrowedCopy(book)) {
            return {
                label: "Borrowed",
                classes: "border-rose-400/30 bg-rose-500/15 text-rose-100",
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
            classes: "border-slate-400/30 bg-slate-500/15 text-slate-100",
        };
    }

    const copyRecords = getCopyRecords(book);
    const borrowedCopies = copyRecords.filter((copy) => isBorrowedCopy(copy)).length;
    const availableCopies = copyRecords.filter((copy) => isBorrowableByCopies(copy)).length;

    if (borrowedCopies > 0 && availableCopies > 0) {
        return {
            label: "Borrowed",
            classes: "border-sky-400/30 bg-sky-500/15 text-sky-100",
        };
    }

    if (borrowedCopies > 0 && availableCopies === 0) {
        return {
            label: "Borrowed",
            classes: "border-rose-400/30 bg-rose-500/15 text-rose-100",
        };
    }

    if (availableCopies > 0) {
        return {
            label: "Available",
            classes: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
        };
    }

    return {
        label: "Unavailable",
        classes: "border-slate-400/30 bg-slate-500/15 text-slate-100",
    };
}

function buildAddCopyFormValues(source: BookDTO): BookFormValues {
    const { values } = buildEditFormValues(source);
    const copyRecords = getCopyRecords(source);
    const nextCopyNumber =
        copyRecords.reduce((max, item) => {
            const current = typeof item.copyNumber === "number" ? item.copyNumber : 0;
            return Math.max(max, current);
        }, 0) + 1;

    return {
        ...values,
        accessionNumber: "",
        barcode: "",
        copyNumber: nextCopyNumber > 0 ? String(nextCopyNumber) : "",
        available: true,
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
    onEdit?: () => void;
    onDelete?: () => void;
    onAddCopy?: () => void;
}) {
    const hasActions = Boolean(onEdit || onDelete || onAddCopy);

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
                <span
                    className={`inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border px-2.5 py-1 text-center text-xs font-medium ${status.classes}`}
                >
                    {status.label}
                </span>
            </CatalogDetail>

            {hasActions ? (
                <CatalogDetail label="Actions">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {onAddCopy ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="border-white/20 text-white/90 hover:bg-white/10"
                                onClick={onAddCopy}
                            >
                                Add copy
                            </Button>
                        ) : null}

                        {onEdit ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="border-white/20 text-white/90 hover:bg-white/10"
                                onClick={onEdit}
                            >
                                Edit
                            </Button>
                        ) : null}

                        {onDelete ? (
                            <Button type="button" variant="destructive" onClick={onDelete}>
                                Delete
                            </Button>
                        ) : null}
                    </div>
                </CatalogDetail>
            ) : null}
        </div>
    );
}

function BookRecordDetailsDialog({
    open,
    onOpenChange,
    book,
    kind,
    onEdit,
    onDelete,
    onAddCopy,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    book: BookDTO | null;
    kind: "book" | "copy";
    onEdit: (() => void) | undefined;
    onDelete: (() => void) | undefined;
    onAddCopy: (() => void) | undefined;
}) {
    if (!book) return null;

    const status = getStatusMeta(book, kind === "copy" ? "copy" : "group");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-[92vw] max-h-[95svh] overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-5xl
                [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
                [&::-webkit-scrollbar]:w-1.5
                [&::-webkit-scrollbar-track]:bg-slate-900/70
                [&::-webkit-scrollbar-thumb]:rounded-full
                [&::-webkit-scrollbar-thumb]:bg-slate-700
                [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
            >
                <DialogHeader>
                    <DialogTitle>
                        {kind === "copy" ? "Copy details" : "Book details"}
                    </DialogTitle>
                    <DialogDescription className="text-white/70">
                        {kind === "copy"
                            ? "Review, edit, or delete this saved copy."
                            : "Review the original book record, then edit it or add more copies."}
                    </DialogDescription>
                </DialogHeader>

                <BookCatalogDetails
                    book={book}
                    status={status}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAddCopy={kind === "book" ? onAddCopy : undefined}
                />
            </DialogContent>
        </Dialog>
    );
}

function BookCopyRecords({
    book,
    onOpenDetails,
    onEdit,
    onDelete,
}: {
    book: BookDTO;
    onOpenDetails: (book: BookDTO) => void;
    onEdit: (book: BookDTO) => void;
    onDelete: (book: BookDTO) => void;
}) {
    const copies = getCopyRecords(book);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <BookCopy className="h-4 w-4" />
                    Copy order &amp; status
                </div>
                <span className="inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-center text-[11px] text-white/70">
                    {copies.length} cop{copies.length === 1 ? "y" : "ies"}
                </span>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
                {copies.map((copy, index) => {
                    const copyStatus = getStatusMeta(copy, "copy");
                    const isOriginal = copy.id === book.id;
                    const copyLabel = getCopyDisplayLabel(book, copy);

                    return (
                        <div
                            key={copy.id || `${book.id}-copy-${index}`}
                            className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <span className="inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-center text-[11px] font-medium text-white/80">
                                    {copyLabel}
                                </span>
                                <span className="inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-center text-[11px] font-medium text-white/80">
                                    Stored copy no. {getStoredCopyNumberLabel(copy)}
                                </span>
                                <span className="inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-center text-[11px] font-medium text-white/80">
                                    {formatDetailValue(copy.accessionNumber)}
                                </span>
                                <span
                                    className={`inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border px-2 py-0.5 text-center text-[11px] font-medium ${copyStatus.classes}`}
                                >
                                    {copyStatus.label}
                                </span>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <CatalogDetail label="Barcode" value={formatDetailValue(copy.barcode)} />
                                <CatalogDetail label="Library area" value={getLibraryAreaValue(copy)} />
                                <CatalogDetail label="Volume" value={formatDetailValue(copy.volumeNumber)} />
                                <CatalogDetail label="Loan days" value={getLoanDaysValue(copy)} />
                            </div>

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-white/20 text-white/90 hover:bg-white/10"
                                    onClick={() => onOpenDetails(copy)}
                                >
                                    Details
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-white/20 text-white/90 hover:bg-white/10"
                                    onClick={() => onEdit(copy)}
                                >
                                    {isOriginal ? "Edit original" : "Edit"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => onDelete(copy)}
                                >
                                    {isOriginal ? "Delete original" : "Delete"}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function BookCatalogCard({
    book,
    isOpen,
    onToggle,
    onOpenDetails,
    onEdit,
    onDelete,
    onAddCopy,
    onOpenCopyDetails,
    onEditCopy,
    onDeleteCopy,
}: {
    book: BookDTO;
    isOpen: boolean;
    onToggle: (bookId: string) => void;
    onOpenDetails: (book: BookDTO) => void;
    onEdit: (book: BookDTO) => void;
    onDelete: (book: BookDTO) => void;
    onAddCopy: (book: BookDTO) => void;
    onOpenCopyDetails: (book: BookDTO) => void;
    onEditCopy: (book: BookDTO) => void;
    onDeleteCopy: (book: BookDTO) => void;
}) {
    const status = getStatusMeta(book);
    const copyCount = getCopyRecords(book).length;

    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 px-0 shadow-sm transition-colors hover:border-white/20">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => onToggle(book.id)}
                    className="flex min-w-0 flex-1 flex-col items-start gap-2 text-left"
                >
                    <div className="flex min-w-0 w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <span className="inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-center text-[11px] font-medium text-white/80">
                                {formatDetailValue(book.callNumber)}
                            </span>
                            <span
                                className={`inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border px-2 py-0.5 text-center text-[11px] font-medium ${status.classes}`}
                            >
                                {status.label}
                            </span>
                            <span className="inline-flex max-w-full whitespace-normal wrap-anywhere rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-center text-[11px] font-medium text-white/75">
                                {copyCount} cop{copyCount === 1 ? "y" : "ies"}
                            </span>
                        </div>

                        <span className="min-w-0 truncate text-sm font-semibold text-white">
                            {formatDetailValue(book.title)}
                        </span>
                    </div>
                </button>

                {!isOpen ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 border-white/20 text-white/90 hover:bg-white/10"
                        onClick={() => onOpenDetails(book)}
                    >
                        Details
                    </Button>
                ) : null}
            </div>

            {isOpen ? (
                <div className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={() => onOpenDetails(book)}
                        >
                            Details
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={() => onAddCopy(book)}
                        >
                            Add copy
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={() => onEdit(book)}
                        >
                            Edit original
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => onDelete(book)}
                        >
                            Delete original
                        </Button>
                    </div>

                    <BookCopyRecords
                        book={book}
                        onOpenDetails={onOpenCopyDetails}
                        onEdit={onEditCopy}
                        onDelete={onDeleteCopy}
                    />
                </div>
            ) : null}
        </div>
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
    const [openBookIds, setOpenBookIds] = React.useState<string[]>([]);

    const [addOpen, setAddOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [formError, setFormError] = React.useState("");
    const [createForm, setCreateForm] = React.useState<BookFormValues>(() =>
        getDefaultBookFormValues()
    );

    const [editOpen, setEditOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState<BookFormMode>("edit");
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
    const [copySourceBook, setCopySourceBook] = React.useState<BookDTO | null>(null);
    const [copyError, setCopyError] = React.useState("");
    const [copyForm, setCopyForm] = React.useState<BookFormValues>(() =>
        getDefaultBookFormValues()
    );

    const [deleting, setDeleting] = React.useState(false);
    const [deleteTarget, setDeleteTarget] = React.useState<{
        book: BookDTO;
        kind: "book" | "copy";
    } | null>(null);

    const [detailOpen, setDetailOpen] = React.useState(false);
    const [detailBook, setDetailBook] = React.useState<BookDTO | null>(null);
    const [detailKind, setDetailKind] = React.useState<"book" | "copy">("book");

    const patchCreateForm = React.useCallback((patch: Partial<BookFormValues>) => {
        setCreateForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const patchEditForm = React.useCallback((patch: Partial<BookFormValues>) => {
        setEditForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const patchCopyForm = React.useCallback((patch: Partial<BookFormValues>) => {
        setCopyForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const resetCreateForm = React.useCallback(() => {
        setCreateForm(getDefaultBookFormValues());
        setFormError("");
    }, []);

    const resetEditForm = React.useCallback(() => {
        setEditBookId(null);
        setEditMode("edit");
        setEditForm(getDefaultBookFormValues());
        setEditInventory(null);
        setEditError("");
    }, []);

    const resetCopyForm = React.useCallback(() => {
        setCopySourceBook(null);
        setCopyForm(getDefaultBookFormValues());
        setCopyError("");
    }, []);

    const openDetailDialog = React.useCallback((book: BookDTO, kind: "book" | "copy") => {
        setDetailBook(book);
        setDetailKind(kind);
        setDetailOpen(true);
    }, []);

    const closeDetailDialog = React.useCallback(() => {
        setDetailOpen(false);
        setDetailBook(null);
        setDetailKind("book");
    }, []);

    const requestDelete = React.useCallback((book: BookDTO, kind: "book" | "copy") => {
        setDeleteTarget({ book, kind });
    }, []);

    const clearDeleteTarget = React.useCallback(() => {
        if (deleting) return;
        setDeleteTarget(null);
    }, [deleting]);

    const loadBooks = React.useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            const data = await fetchBooks();
            setBooks(data);
        } catch (err: unknown) {
            const message =
                getErrorMessage(err) || "Failed to load books. Please try again later.";
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

    const toggleBookOpen = React.useCallback((bookId: string) => {
        setOpenBookIds((prev) =>
            prev.includes(bookId)
                ? prev.filter((value) => value !== bookId)
                : [...prev, bookId]
        );
    }, []);

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

    const buildBookPayload = React.useCallback(
        (
            form: BookFormValues
        ):
            | {
                  ok: true;
                  payload: {
                      callNumber: string;
                      accessionNumber: string;
                      title: string;
                      subtitle?: string;
                      publicationYear: number;
                      author: string;
                      placeOfPublication: string;
                      publisher: string;
                      isbn?: string;
                      issn?: string;
                      subjects?: string;
                      genre?: string;
                      category?: string;
                      edition?: string;
                      pages?: number | string | null;
                      otherDetails?: string;
                      dimensions?: string;
                      notes?: string;
                      series?: string;
                      addedEntries?: string;
                      barcode: string;
                      copyNumber: number;
                      volumeNumber?: string;
                      libraryArea: LibraryArea;
                      numberOfCopies: number;
                      available: boolean;
                      isLibraryUseOnly: boolean;
                      canBorrow: boolean;
                      borrowDurationDays: number;
                  };
              }
            | { ok: false; message: string } => {
            const resolvedCallNo = form.callNumber.trim();
            if (!resolvedCallNo) {
                return { ok: false, message: "Call number is required." };
            }

            const resolvedAccNo = form.accessionNumber.trim();
            if (!resolvedAccNo) {
                return { ok: false, message: "Accession number is required." };
            }

            const resolvedTitle = form.title.trim();
            if (!resolvedTitle) {
                return { ok: false, message: "Title is required." };
            }

            const resolvedSubtitle = form.subtitle.trim();
            const resolvedAuthor = form.author.trim();
            if (!resolvedAuthor) {
                return { ok: false, message: "Author is required." };
            }

            const pubYearNum = parseYearOrNull(form.pubYear);
            if (pubYearNum === null) {
                return {
                    ok: false,
                    message: "Publication year is required and must be a valid 4-digit year.",
                };
            }

            const resolvedPubPlace = form.placeOfPublication.trim();
            if (!resolvedPubPlace) {
                return { ok: false, message: "Place of publication is required." };
            }

            const resolvedPublisher = form.publisher.trim();
            if (!resolvedPublisher) {
                return { ok: false, message: "Publisher is required." };
            }

            const pagesValue = buildCreatePayloadPagesValue(form.pages);

            const resolvedBarcode = form.barcode.trim();
            if (!resolvedBarcode) {
                return { ok: false, message: "Barcode is required." };
            }

            const area = resolveLibraryArea(form.libraryAreaOption, form.libraryAreaOther);
            if (!area.ok) {
                return { ok: false, message: area.message };
            }

            if (!form.borrowDuration.trim()) {
                return { ok: false, message: "Borrow duration (days) is required." };
            }

            const borrowDaysNum = Number(form.borrowDuration);
            if (!Number.isFinite(borrowDaysNum) || borrowDaysNum <= 0) {
                return {
                    ok: false,
                    message: "Borrow duration must be a positive number of days.",
                };
            }
            const borrowDaysInt = Math.floor(borrowDaysNum);

            const copyNumberInput = form.copyNumber.trim();
            const copyNum = parsePositiveIntOrNull(copyNumberInput);
            if (!copyNumberInput || copyNum === null) {
                return {
                    ok: false,
                    message: "Copy number is required and must be a positive number.",
                };
            }

            const resolvedSubjects = form.subjects.trim();

            return {
                ok: true,
                payload: {
                    callNumber: resolvedCallNo,
                    accessionNumber: resolvedAccNo,
                    title: resolvedTitle,
                    subtitle: resolvedSubtitle || undefined,
                    publicationYear: pubYearNum,
                    author: resolvedAuthor,
                    placeOfPublication: resolvedPubPlace,
                    publisher: resolvedPublisher,
                    isbn: form.isbn.trim() || undefined,
                    issn: form.issn.trim() || undefined,
                    subjects: resolvedSubjects || undefined,
                    genre: resolvedSubjects || undefined,
                    category: resolvedSubjects || undefined,
                    edition: form.edition.trim() || undefined,
                    pages: pagesValue,
                    otherDetails: form.otherDetails.trim() || undefined,
                    dimensions: form.dimensions.trim() || undefined,
                    notes: form.notes.trim() || undefined,
                    series: form.series.trim() || undefined,
                    addedEntries: form.addedEntries.trim() || undefined,
                    barcode: resolvedBarcode,
                    copyNumber: copyNum,
                    volumeNumber: form.volumeNumber.trim() || undefined,
                    libraryArea: area.value as LibraryArea,
                    numberOfCopies: 1,
                    available: form.available,
                    isLibraryUseOnly: form.isLibraryUseOnly,
                    canBorrow: !form.isLibraryUseOnly,
                    borrowDurationDays: borrowDaysInt,
                },
            };
        },
        [resolveLibraryArea]
    );

    const handleCreateBook = async () => {
        setFormError("");

        const result = buildBookPayload(createForm);
        if (!result.ok) {
            setFormError(result.message);
            toast.error("Validation error", { description: result.message });
            return;
        }

        setSaving(true);
        try {
            const created = await createBook(result.payload as Parameters<typeof createBook>[0]);
            await loadBooks();

            toast.success("Book added", {
                description: `"${created.title}" has been added to the catalog as a single copy record.`,
            });

            resetCreateForm();
            setAddOpen(false);
        } catch (err: unknown) {
            const message =
                getErrorMessage(err) || "Failed to create book. Please try again later.";
            setFormError(message);
            toast.error("Failed to create book", { description: message });
        } finally {
            setSaving(false);
        }
    };

    const openEditDialog = React.useCallback((book: BookDTO, kind: "book" | "copy") => {
        const { values, inventory } = buildEditFormValues(book);
        setDetailOpen(false);
        setEditBookId(book.id);
        setEditMode(kind === "copy" ? "edit_copy" : "edit");
        setEditForm(values);
        setEditInventory(inventory);
        setEditError("");
        setEditOpen(true);
    }, []);

    const openAddCopyDialog = React.useCallback((book: BookDTO) => {
        setDetailOpen(false);
        setCopySourceBook(book);
        setCopyForm(buildAddCopyFormValues(book));
        setCopyError("");
        setCopyOpen(true);
    }, []);

    const handleUpdateBook = async () => {
        if (!editBookId) return;

        setEditError("");

        const result = buildBookPayload(editForm);
        if (!result.ok) {
            setEditError(result.message);
            toast.error("Validation error", { description: result.message });
            return;
        }

        let payload: Record<string, unknown> = result.payload;

        if (editMode !== "edit_copy") {
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

            payload = {
                ...result.payload,
                ...copiesPayload,
            };
        }

        setEditing(true);
        try {
            const updated =
                editMode === "edit_copy"
                    ? await updateBookCopy(
                          editBookId,
                          payload as Parameters<typeof updateBookCopy>[1]
                      )
                    : await updateBook(
                          editBookId,
                          payload as Parameters<typeof updateBook>[1]
                      );

            await loadBooks();

            toast.success(editMode === "edit_copy" ? "Copy updated" : "Book updated", {
                description: `"${updated.title}" has been updated.`,
            });

            setEditOpen(false);
            resetEditForm();
        } catch (err: unknown) {
            const message =
                getErrorMessage(err) || "Failed to update the record. Please try again later.";
            setEditError(message);
            toast.error("Failed to update", { description: message });
        } finally {
            setEditing(false);
        }
    };

    const handleAddCopy = async () => {
        if (!copySourceBook) return;

        setCopyError("");

        const result = buildBookPayload(copyForm);
        if (!result.ok) {
            setCopyError(result.message);
            toast.error("Validation error", { description: result.message });
            return;
        }

        setCopying(true);
        try {
            const updated = await addBookCopy(
                copySourceBook.id,
                result.payload as Parameters<typeof addBookCopy>[1]
            );
            await loadBooks();
            setCopyOpen(false);
            resetCopyForm();

            toast.success("Copy added", {
                description: `A new editable copy has been added to "${updated.title}".`,
            });
        } catch (err: unknown) {
            const message =
                getErrorMessage(err) || "Failed to add the copy. Please try again later.";
            setCopyError(message);
            toast.error("Failed to add copy", { description: message });
        } finally {
            setCopying(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        const { book, kind } = deleteTarget;
        const isOriginal = kind === "book";
        const previous = books;

        if (isOriginal) {
            setBooks((prev) => prev.filter((item) => item.id !== book.id));
        }

        setDeleting(true);
        try {
            if (isOriginal) {
                await deleteBook(book.id);
            } else {
                await deleteBookCopy(book.id);
            }

            await loadBooks();
            closeDetailDialog();
            setDeleteTarget(null);

            toast.success(isOriginal ? "Original record deleted" : "Copy deleted", {
                description: isOriginal
                    ? `"${book.title}" has been removed from the catalog.`
                    : `Copy ${formatDetailValue(book.copyNumber)} has been removed from the catalog.`,
            });
        } catch (err: unknown) {
            setBooks(previous);
            const message =
                getErrorMessage(err) || "Failed to delete the record. Please try again later.";
            toast.error("Delete failed", { description: message });
        } finally {
            setDeleting(false);
        }
    };

    const libraryAreaChoices = React.useMemo(() => {
        const values = new Set<string>();

        books.forEach((book) => {
            getGroupLibraryAreas(book).forEach((area) => {
                if (area) values.add(area);
            });
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

        return [...books]
            .filter((book) => {
                if (availabilityFilter === "available" && !isBorrowableByCopies(book)) {
                    return false;
                }

                if (availabilityFilter === "unavailable" && isBorrowableByCopies(book)) {
                    return false;
                }

                if (availabilityFilter === "library_use_only" && !isLibraryUseOnlyBook(book)) {
                    return false;
                }

                if (
                    libraryAreaFilter !== "all" &&
                    !getGroupLibraryAreas(book).includes(libraryAreaFilter)
                ) {
                    return false;
                }

                if (tokens.length === 0) return true;

                const searchable = normalizeSearchText(
                    [
                        book.title,
                        book.subtitle,
                        book.author,
                        book.subjects,
                        book.genre,
                        book.category,
                        book.accessionNumber,
                        book.callNumber,
                        book.barcode,
                        book.isbn,
                        book.issn,
                        book.publisher,
                        getLibraryAreaValue(book),
                    ]
                        .filter(Boolean)
                        .join(" ")
                );

                return matchesAllTokens(searchable, tokens);
            })
            .sort((a, b) => {
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
                            Add new titles, save editable copy records, and monitor active/all-time
                            borrow tracking.
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

            <BookRecordDetailsDialog
                open={detailOpen}
                onOpenChange={(open) => {
                    if (!open) closeDetailDialog();
                    else setDetailOpen(true);
                }}
                book={detailBook}
                kind={detailKind}
                onEdit={
                    detailBook ? () => openEditDialog(detailBook, detailKind) : undefined
                }
                onDelete={
                    detailBook ? () => requestDelete(detailBook, detailKind) : undefined
                }
                onAddCopy={
                    detailKind === "book" && detailBook
                        ? () => openAddCopyDialog(detailBook)
                        : undefined
                }
            />

            <AlertDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) clearDeleteTarget();
                }}
            >
                <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleteTarget?.kind === "copy"
                                ? "Delete copy"
                                : "Delete original record"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/70">
                            {deleteTarget
                                ? deleteTarget.kind === "copy"
                                    ? `This will permanently remove copy ${formatDetailValue(deleteTarget.book.copyNumber)} of "${formatDetailValue(deleteTarget.book.title, "this book")}" from the catalog.`
                                    : `This will permanently remove the original saved record for "${formatDetailValue(deleteTarget.book.title, "this book")}". Any additional saved copies will remain in the catalog.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                            disabled={deleting}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(event) => {
                                event.preventDefault();
                                void confirmDelete();
                            }}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <BookFormDialog
                mode={editMode}
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

            <BookFormDialog
                mode="copy"
                open={copyOpen}
                onOpenChange={(open) => {
                    setCopyOpen(open);
                    if (!open) resetCopyForm();
                }}
                values={copyForm}
                onChange={patchCopyForm}
                onSubmit={handleAddCopy}
                onCancel={() => {
                    setCopyOpen(false);
                    resetCopyForm();
                }}
                submitting={copying}
                error={copyError}
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
                        <div className="space-y-3">
                            {filteredBooks.map((book) => (
                                <BookCatalogCard
                                    key={book.id}
                                    book={book}
                                    isOpen={openBookIds.includes(book.id)}
                                    onToggle={toggleBookOpen}
                                    onOpenDetails={(record) => openDetailDialog(record, "book")}
                                    onEdit={(record) => openEditDialog(record, "book")}
                                    onDelete={(record) => requestDelete(record, "book")}
                                    onAddCopy={openAddCopyDialog}
                                    onOpenCopyDetails={(record) =>
                                        openDetailDialog(record, "copy")
                                    }
                                    onEditCopy={(record) => openEditDialog(record, "copy")}
                                    onDeleteCopy={(record) => requestDelete(record, "copy")}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}