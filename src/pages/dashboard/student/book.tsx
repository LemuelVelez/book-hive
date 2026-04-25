/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertTriangle,
    ArrowUpDown,
    BookOpen,
    CheckCircle2,
    Clock3,
    Filter,
    Loader2,
    RefreshCcw,
    Search,
    X,
} from "lucide-react";
import { toast } from "sonner";

import { fetchBooks, type BookDTO } from "@/lib/books";
import {
    fetchMyBorrowRecords,
    createSelfBorrowRecords,
    getBorrowReservationExpiryDate,
    isBorrowRecordCurrentlyActive,
    type BorrowRecordDTO,
} from "@/lib/borrows";

import type { BookWithStatus } from "@/components/student-books/types";
import BorrowBookDialog from "@/components/student-books/BorrowBookDialog";
import {
    buildCatalogSortKey,
    compareNullableNumber,
    compareText,
    fmtDate,
    fmtDurationDays,
    fmtLibraryArea,
    getBookBorrowMeta,
    getBorrowedCopies,
    getHistoricalBorrowCount,
    getRemainingCopies,
    getSubjects,
    getTotalCopies,
    isBorrowable,
    isLibraryUseOnly,
    matchesAllTokens,
    normalizeSearchText,
    peso,
    sortRecordsNewestFirst,
    tokenizeSearch,
} from "@/components/student-books/utils";

type FilterMode =
    | "all"
    | "available"
    | "unavailable"
    | "borrowedByMe"
    | "history"
    | "libraryUseOnly";

type CatalogAvailabilityFilter = "all" | "available" | "unavailable";
type CatalogSortOption =
    | "catalog"
    | "call_no_asc"
    | "call_no_desc"
    | "accession_asc"
    | "accession_desc"
    | "title_asc"
    | "title_desc"
    | "pub_year_desc"
    | "pub_year_asc";

function formatDetailValue(value: unknown, fallback = "—") {
    if (typeof value === "number") return String(value);
    if (typeof value === "string") {
        const normalized = value.trim();
        return normalized || fallback;
    }
    return fallback;
}

function buildBorrowAssignmentSummary(
    records: Array<Pick<BorrowRecordDTO, "copyNumber" | "accessionNumber">>
) {
    const labels = records
        .map((record) => {
            const parts: string[] = [];

            if (typeof record.copyNumber === "number" && Number.isFinite(record.copyNumber)) {
                parts.push(`Copy ${record.copyNumber}`);
            }

            const accessionNumber = String(record.accessionNumber ?? "").trim();
            if (accessionNumber) {
                parts.push(`Accession ${accessionNumber}`);
            }

            return parts.join(" • ");
        })
        .filter(Boolean);

    if (labels.length === 0) return "";
    if (labels.length === 1) return ` Assigned copy: ${labels[0]}.`;

    return ` Assigned copies: ${labels.join(", ")}.`;
}


function getEarliestReservationExpiryDate(records: BorrowRecordDTO[]) {
    return records
        .map((record) => getBorrowReservationExpiryDate(record))
        .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
}

function getEarliestReservationExpiryLabel(records: BorrowRecordDTO[]) {
    const earliest = getEarliestReservationExpiryDate(records);

    if (!earliest) {
        return null;
    }

    return new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(earliest);
}

function formatReservationCountdown(expiryDate: Date | null, nowMs: number) {
    if (!expiryDate) return null;

    const remainingMs = expiryDate.getTime() - nowMs;
    if (remainingMs <= 0) return "Expired";

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getNextCountdownTickDelay(nowMs = Date.now()) {
    const delayToNextSecond = 1000 - (nowMs % 1000);
    return delayToNextSecond <= 0 ? 1000 : delayToNextSecond;
}

function useLiveNowMs(active = true) {
    const [nowMs, setNowMs] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!active) return;

        let timer: number | null = null;

        const tick = () => {
            const currentNowMs = Date.now();
            setNowMs(currentNowMs);
            timer = window.setTimeout(tick, getNextCountdownTickDelay(currentNowMs));
        };

        const syncNow = () => {
            setNowMs(Date.now());
        };

        tick();
        window.addEventListener("focus", syncNow);
        document.addEventListener("visibilitychange", syncNow);

        return () => {
            if (timer !== null) {
                window.clearTimeout(timer);
            }
            window.removeEventListener("focus", syncNow);
            document.removeEventListener("visibilitychange", syncNow);
        };
    }, [active]);

    return nowMs;
}
function getStudentStatusMeta(book: BookWithStatus): { label: string; classes: string } {
    if (isLibraryUseOnly(book)) {
        return {
            label: "Library Use Only",
            classes: "border-amber-400/30 bg-amber-500/15 text-amber-100",
        };
    }

    if (isBorrowable(book)) {
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
            <div className="mt-1 text-sm text-white/90 wrap-break-word">
                {children ?? value ?? "—"}
            </div>
        </div>
    );
}

function StudentBorrowStatus({ book }: { book: BookWithStatus }) {
    const {
        activeRecords,
        pendingPickupRecords,
        borrowedRecords,
        pendingReturnRecords,
        totalFine,
        earliestDue,
        overdueDaysMax,
        hasOverdue,
    } = getBookBorrowMeta(book);
    const earliestReservationExpiry = React.useMemo(
        () => getEarliestReservationExpiryDate(pendingPickupRecords),
        [pendingPickupRecords]
    );
    const nowMs = useLiveNowMs(Boolean(earliestReservationExpiry));
    const reservationCountdown = formatReservationCountdown(earliestReservationExpiry, nowMs);

    if (activeRecords.length === 0 && isLibraryUseOnly(book)) {
        return (
            <span className="text-amber-200">
                Library use only · Available for in-library reading only
            </span>
        );
    }

    if (activeRecords.length === 0 && book.myStatus === "never") {
        return <span className="text-white/60">Not yet borrowed</span>;
    }

    if (activeRecords.length > 0) {
        return (
            <div className="space-y-1">
                {pendingPickupRecords.length > 0 && (
                    <div className="flex flex-col gap-1 text-amber-200">
                        <div className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>
                                Reserved ×{pendingPickupRecords.length}
                                {" · "}
                                <span className="font-medium">
                                    {getEarliestReservationExpiryLabel(pendingPickupRecords)
                                        ? `Auto-release: ${getEarliestReservationExpiryLabel(pendingPickupRecords)}`
                                        : `Earliest due: ${earliestDue}`}
                                </span>
                            </span>
                        </div>
                        {reservationCountdown && (
                            <div className="inline-flex w-fit items-center rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[11px] text-amber-100">
                                24-hour pickup countdown: {reservationCountdown}
                            </div>
                        )}
                    </div>
                )}

                {borrowedRecords.length > 0 && !hasOverdue && (
                    <div className="inline-flex items-center gap-1 text-amber-200">
                        <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                            Borrowed ×{borrowedRecords.length}
                            {" · "}Earliest due:{" "}
                            <span className="font-medium">{earliestDue}</span>
                        </span>
                    </div>
                )}

                {borrowedRecords.length > 0 && hasOverdue && (
                    <div className="inline-flex items-center gap-1 text-red-300">
                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                            Overdue ×{borrowedRecords.length}
                            {" · "}Max overdue:{" "}
                            <span className="font-semibold">
                                {overdueDaysMax} day{overdueDaysMax === 1 ? "" : "s"}
                            </span>
                        </span>
                    </div>
                )}

                {pendingReturnRecords.length > 0 && (
                    <div className="text-white/70">
                        Return requested ×{pendingReturnRecords.length}
                    </div>
                )}

                {totalFine > 0 && (
                    <div className="text-red-300">Fine total: {peso(totalFine)}</div>
                )}
            </div>
        );
    }

    if (book.myStatus === "returned" && book.lastReturnedRecord) {
        return (
            <span className="inline-flex items-center gap-1 text-white/70">
                <CheckCircle2
                    className="h-3 w-3 shrink-0 text-emerald-300"
                    aria-hidden="true"
                />
                <span>
                    Returned · Last returned:{" "}
                    <span className="font-medium">
                        {fmtDate(book.lastReturnedRecord.returnDate)}
                    </span>
                </span>
            </span>
        );
    }

    return <span className="text-white/60">—</span>;
}

function StudentBookActionControls({
    book,
    libraryUseOnly,
    borrowableNow,
    maxCopies,
    busy,
    borrowBtnLabel,
    onBorrow,
    className = "flex flex-col gap-2 sm:flex-row sm:flex-wrap",
}: {
    book: BookWithStatus;
    libraryUseOnly: boolean;
    borrowableNow: boolean;
    maxCopies: number;
    busy: boolean;
    borrowBtnLabel: string;
    onBorrow: (book: BookWithStatus, copiesRequested: number) => Promise<boolean>;
    className?: string;
}) {
    return (
        <div className={className}>
            {libraryUseOnly ? (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    className="border-amber-400/30 text-amber-100 hover:bg-transparent"
                >
                    In-library only
                </Button>
            ) : borrowableNow && maxCopies > 0 ? (
                <BorrowBookDialog
                    book={book}
                    maxCopies={maxCopies}
                    busy={busy}
                    triggerLabel={borrowBtnLabel}
                    onConfirm={onBorrow}
                />
            ) : (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    className="border-white/20 text-white/60 hover:bg-transparent"
                >
                    Not available
                </Button>
            )}
        </div>
    );
}

function StudentBookDetailGrid({
    book,
    activeRecords,
    dueCell,
    totalCopies,
    borrowedCopies,
    remaining,
    historicalBorrowCount,
    borrowBusyId,
    onBorrow,
    showActions = true,
    className = "grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
}: {
    book: BookWithStatus;
    activeRecords: BorrowRecordDTO[];
    dueCell: React.ReactNode;
    totalCopies: number;
    borrowedCopies: number;
    remaining: number;
    historicalBorrowCount: number | null;
    borrowBusyId: string | null;
    onBorrow: (book: BookWithStatus, copiesRequested: number) => Promise<boolean>;
    showActions?: boolean;
    className?: string;
}) {
    const libraryUseOnly = isLibraryUseOnly(book);
    const { borrowableNow, borrowBtnLabel } = getBookBorrowMeta(book);
    const busy = borrowBusyId === book.id;
    const maxCopies = Math.max(0, remaining);

    return (
        <div className={className}>
            <CatalogDetail label="Call no." value={formatDetailValue(book.callNumber)} />
            <CatalogDetail
                label="Accession #"
                value={formatDetailValue(book.accessionNumber)}
            />
            <CatalogDetail label="Title" value={formatDetailValue(book.title)} />
            <CatalogDetail label="Subtitle" value={formatDetailValue(book.subtitle)} />
            <CatalogDetail label="Author" value={formatDetailValue(book.author)} />
            <CatalogDetail
                label="Publication year"
                value={formatDetailValue(book.publicationYear)}
            />
            <CatalogDetail label="Subjects" value={getSubjects(book)} />
            <CatalogDetail label="Publisher" value={formatDetailValue(book.publisher)} />
            <CatalogDetail
                label="Library area"
                value={fmtLibraryArea(book.libraryArea)}
            />
            <CatalogDetail label="ISBN" value={formatDetailValue(book.isbn)} />
            <CatalogDetail label="ISSN" value={formatDetailValue(book.issn)} />
            <CatalogDetail label="Edition" value={formatDetailValue(book.edition)} />
            <CatalogDetail
                label="Loan duration"
                value={fmtDurationDays(book.borrowDurationDays)}
            />
            <CatalogDetail label="Due / earliest due" value={dueCell} />
            <CatalogDetail label="Inventory">
                <span>
                    Total: {totalCopies} · Borrowed: {borrowedCopies} · Available: {" "}
                    {remaining}
                </span>
            </CatalogDetail>
            <CatalogDetail
                label="Recorded borrows"
                value={
                    historicalBorrowCount === null
                        ? "—"
                        : `${historicalBorrowCount} borrow${
                              historicalBorrowCount === 1 ? "" : "s"
                          }`
                }
            />
            <CatalogDetail label="My activity">
                <div className="space-y-1 text-xs leading-relaxed text-white/75">
                    <StudentBorrowStatus book={book} />
                    {activeRecords.length > 0 ? (
                        <div className="text-white/60">
                            You currently have {activeRecords.length} active record
                            {activeRecords.length === 1 ? "" : "s"} for this title.
                        </div>
                    ) : null}
                </div>
            </CatalogDetail>
            {showActions ? (
                <CatalogDetail label="Actions">
                    <StudentBookActionControls
                        book={book}
                        libraryUseOnly={libraryUseOnly}
                        borrowableNow={borrowableNow}
                        maxCopies={maxCopies}
                        busy={busy}
                        borrowBtnLabel={borrowBtnLabel}
                        onBorrow={onBorrow}
                    />
                </CatalogDetail>
            ) : null}
        </div>
    );
}

function StudentBookMobileCard({
    book,
    borrowBusyId,
    onBorrow,
}: {
    book: BookWithStatus;
    borrowBusyId: string | null;
    onBorrow: (book: BookWithStatus, copiesRequested: number) => Promise<boolean>;
}) {
    const status = getStudentStatusMeta(book);
    const {
        activeRecords,
        dueCell,
        remaining,
        borrowableNow,
        borrowBtnLabel,
    } = getBookBorrowMeta(book);
    const libraryUseOnly = isLibraryUseOnly(book);
    const totalCopies = getTotalCopies(book);
    const borrowedCopies = getBorrowedCopies(book);
    const historicalBorrowCount = getHistoricalBorrowCount(book);
    const busy = borrowBusyId === book.id;
    const maxCopies = Math.max(0, remaining);

    return (
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 p-4 shadow-sm sm:hidden">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                            {formatDetailValue(book.callNumber)}
                        </span>
                        <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.classes}`}
                        >
                            {status.label}
                        </span>
                    </div>
                    <h3 className="wrap-break-word whitespace-normal text-sm font-semibold leading-snug text-white">
                        {formatDetailValue(book.title)}
                    </h3>
                    <p className="wrap-break-word text-xs text-white/60">
                        {formatDetailValue(book.author)}
                    </p>
                </div>
            </div>

            <div className="mt-3 grid gap-2">
                <CatalogDetail
                    label="Available copies"
                    value={`${remaining} of ${totalCopies}`}
                />
                <CatalogDetail label="My status">
                    <div className="text-xs leading-relaxed">
                        <StudentBorrowStatus book={book} />
                    </div>
                </CatalogDetail>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                        >
                            View full details
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-950 text-white sm:max-w-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="pr-6 text-left">
                                {formatDetailValue(book.title)}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-left text-white/65">
                                {formatDetailValue(book.author)} · Call no. {formatDetailValue(
                                    book.callNumber
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="max-h-screen overflow-y-auto pr-1">
                            <StudentBookDetailGrid
                                book={book}
                                activeRecords={activeRecords}
                                dueCell={dueCell}
                                totalCopies={totalCopies}
                                borrowedCopies={borrowedCopies}
                                remaining={remaining}
                                historicalBorrowCount={historicalBorrowCount}
                                borrowBusyId={borrowBusyId}
                                onBorrow={onBorrow}
                                showActions={false}
                                className="grid gap-3"
                            />
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                                Close
                            </AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <StudentBookActionControls
                    book={book}
                    libraryUseOnly={libraryUseOnly}
                    borrowableNow={borrowableNow}
                    maxCopies={maxCopies}
                    busy={busy}
                    borrowBtnLabel={borrowBtnLabel}
                    onBorrow={onBorrow}
                    className="flex flex-col gap-2"
                />
            </div>
        </div>
    );
}

function StudentBookDesktopCard({
    book,
    borrowBusyId,
    onBorrow,
}: {
    book: BookWithStatus;
    borrowBusyId: string | null;
    onBorrow: (book: BookWithStatus, copiesRequested: number) => Promise<boolean>;
}) {
    const status = getStudentStatusMeta(book);
    const {
        activeRecords,
        dueCell,
        remaining,
    } = getBookBorrowMeta(book);
    const totalCopies = getTotalCopies(book);
    const borrowedCopies = getBorrowedCopies(book);
    const historicalBorrowCount = getHistoricalBorrowCount(book);

    return (
        <Dialog>
            <div className="hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 p-4 shadow-sm transition-colors hover:border-white/20 sm:block">
                <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                                {formatDetailValue(book.callNumber)}
                            </span>
                            <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.classes}`}
                            >
                                {status.label}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <h3 className="wrap-break-word text-sm font-semibold text-white/90">
                                {formatDetailValue(book.title)}
                            </h3>
                            <p className="wrap-break-word text-xs text-white/60">
                                {formatDetailValue(book.author)}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
                            <span>
                                Available: {remaining} of {totalCopies}
                            </span>
                            <span>Borrowed: {borrowedCopies}</span>
                        </div>

                        <div className="text-xs leading-relaxed text-white/75">
                            <StudentBorrowStatus book={book} />
                        </div>
                    </div>

                    <div className="flex shrink-0 items-start">
                        <DialogTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                className="border-white/20 text-white/90 hover:bg-white/10"
                            >
                                Details
                            </Button>
                        </DialogTrigger>
                    </div>
                </div>
            </div>

            <DialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-950 text-white sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="pr-6 text-left">
                        {formatDetailValue(book.title)}
                    </DialogTitle>
                    <DialogDescription className="text-left text-white/65">
                        {formatDetailValue(book.author)} · Call no. {formatDetailValue(
                            book.callNumber
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[calc(95svh-8rem)] overflow-y-auto pr-1">
                    <StudentBookDetailGrid
                        book={book}
                        activeRecords={activeRecords}
                        dueCell={dueCell}
                        totalCopies={totalCopies}
                        borrowedCopies={borrowedCopies}
                        remaining={remaining}
                        historicalBorrowCount={historicalBorrowCount}
                        borrowBusyId={borrowBusyId}
                        onBorrow={onBorrow}
                        showActions
                        className="grid gap-3"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function StudentBooksPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [myRecords, setMyRecords] = React.useState<BorrowRecordDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [filterMode, setFilterMode] = React.useState<FilterMode>("all");
    const [availabilityFilter, setAvailabilityFilter] =
        React.useState<CatalogAvailabilityFilter>("all");
    const [libraryAreaFilter, setLibraryAreaFilter] = React.useState("all");
    const [sortOption, setSortOption] = React.useState<CatalogSortOption>("catalog");
    const [borrowBusyId, setBorrowBusyId] = React.useState<string | null>(null);
    const nowMs = useLiveNowMs();

    const loadAll = React.useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            const [booksData, myRecordsData] = await Promise.all([
                fetchBooks(),
                fetchMyBorrowRecords(),
            ]);

            setBooks(booksData);
            setMyRecords(myRecordsData);
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
        void loadAll();
    }, [loadAll]);


    const nextReservationExpiryMs = React.useMemo(() => {
        const next = myRecords
            .map((record) => getBorrowReservationExpiryDate(record)?.getTime() ?? null)
            .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > Date.now())
            .sort((left, right) => left - right)[0];

        return next ?? null;
    }, [myRecords]);

    React.useEffect(() => {
        if (!nextReservationExpiryMs) return;

        const delay = Math.max(1000, nextReservationExpiryMs - Date.now() + 1500);
        const timer = window.setTimeout(() => {
            void loadAll();
        }, delay);

        return () => window.clearTimeout(timer);
    }, [loadAll, nextReservationExpiryMs]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await loadAll();
        } finally {
            setRefreshing(false);
        }
    }

    const rows: BookWithStatus[] = React.useMemo(() => {
        const byBook: BookWithStatus[] = books.map((book) => {
            const recordsForBook = myRecords.filter((r) => r.bookId === book.id);
            const sorted = sortRecordsNewestFirst(recordsForBook);

            const activeRecords = sorted.filter((record) =>
                isBorrowRecordCurrentlyActive(record, nowMs)
            );

            const returnedRecords = sorted.filter((r) => r.status === "returned");
            const lastReturnedRecord = returnedRecords[0] ?? null;
            const lastRecord = sorted[0] ?? null;

            const myStatus: "never" | "active" | "returned" =
                activeRecords.length > 0
                    ? "active"
                    : sorted.length > 0
                      ? "returned"
                      : "never";

            return {
                ...book,
                myStatus,
                activeRecords,
                lastReturnedRecord,
                lastRecord,
            };
        });

        let filtered = byBook;

        switch (filterMode) {
            case "available":
                filtered = filtered.filter((b) => isBorrowable(b));
                break;
            case "unavailable":
                filtered = filtered.filter((b) => !isBorrowable(b));
                break;
            case "borrowedByMe":
                filtered = filtered.filter((b) => b.activeRecords.length > 0);
                break;
            case "history":
                filtered = filtered.filter((b) => Boolean(b.lastRecord));
                break;
            case "libraryUseOnly":
                filtered = filtered.filter((b) => isLibraryUseOnly(b));
                break;
            case "all":
            default:
                break;
        }

        if (libraryAreaFilter !== "all") {
            filtered = filtered.filter(
                (b) => String(b.libraryArea ?? "").trim() === libraryAreaFilter
            );
        }

        if (availabilityFilter === "available") {
            filtered = filtered.filter((b) => isBorrowable(b));
        } else if (availabilityFilter === "unavailable") {
            filtered = filtered.filter((b) => !isBorrowable(b));
        }

        const tokens = tokenizeSearch(search);
        if (tokens.length > 0) {
            filtered = filtered.filter((b) => {
                const historicalBorrowCount = getHistoricalBorrowCount(b);

                const hay = [
                    b.callNumber,
                    b.accessionNumber,
                    b.title,
                    b.subtitle,
                    getSubjects(b),
                    typeof b.publicationYear === "number" ? String(b.publicationYear) : "",
                    b.author,
                    b.isbn,
                    b.issn,
                    b.publisher,
                    b.placeOfPublication,
                    b.edition,
                    b.barcode,
                    b.series,
                    b.volumeNumber,
                    b.libraryArea ? fmtLibraryArea(b.libraryArea) : "",
                    String(getRemainingCopies(b)),
                    String(getTotalCopies(b)),
                    String(getBorrowedCopies(b)),
                    historicalBorrowCount === null ? "" : String(historicalBorrowCount),
                    isLibraryUseOnly(b)
                        ? "library use only in library reference only"
                        : "borrowable",
                    b.activeRecords.length > 0 ? "borrowed" : "",
                    b.myStatus,
                ]
                    .map(normalizeSearchText)
                    .filter(Boolean)
                    .join(" ");

                return matchesAllTokens(hay, tokens);
            });
        }

        return [...filtered].sort((a, b) => {
            switch (sortOption) {
                case "call_no_asc":
                    return (
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "call_no_desc":
                    return (
                        compareText(b.callNumber, a.callNumber) ||
                        compareText(b.accessionNumber, a.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "accession_asc":
                    return (
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "accession_desc":
                    return (
                        compareText(b.accessionNumber, a.accessionNumber) ||
                        compareText(b.callNumber, a.callNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "title_asc":
                    return (
                        compareText(a.title, b.title) ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "title_desc":
                    return (
                        compareText(b.title, a.title) ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "pub_year_desc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "desc") ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "pub_year_asc":
                    return (
                        compareNullableNumber(a.publicationYear, b.publicationYear, "asc") ||
                        compareText(a.callNumber, b.callNumber) ||
                        compareText(a.accessionNumber, b.accessionNumber) ||
                        compareText(a.title, b.title) ||
                        buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                            sensitivity: "base",
                        })
                    );

                case "catalog":
                default:
                    return buildCatalogSortKey(a).localeCompare(buildCatalogSortKey(b), undefined, {
                        sensitivity: "base",
                    });
            }
        });
    }, [books, myRecords, filterMode, search, availabilityFilter, libraryAreaFilter, sortOption, nowMs]);

    const libraryAreaChoices = React.useMemo(() => {
        const values = new Set<string>();

        books.forEach((book) => {
            const area = book.libraryArea ? String(book.libraryArea).trim() : "";
            if (area) values.add(area);
        });

        return Array.from(values).sort((a, b) =>
            fmtLibraryArea(a as BookDTO["libraryArea"]).localeCompare(
                fmtLibraryArea(b as BookDTO["libraryArea"]),
                undefined,
                { sensitivity: "base" }
            )
        );
    }, [books]);

    React.useEffect(() => {
        if (libraryAreaFilter !== "all" && !libraryAreaChoices.includes(libraryAreaFilter)) {
            setLibraryAreaFilter("all");
        }
    }, [libraryAreaChoices, libraryAreaFilter]);

    const borrowableRows = React.useMemo(
        () => rows.filter((book) => !isLibraryUseOnly(book)),
        [rows]
    );

    const libraryUseOnlyRows = React.useMemo(
        () => rows.filter((book) => isLibraryUseOnly(book)),
        [rows]
    );

    const trackedBorrowSummary = React.useMemo(() => {
        return rows.reduce(
            (acc, book) => {
                acc.currentlyBorrowedCopies += getBorrowedCopies(book);

                const historicalBorrowCount = getHistoricalBorrowCount(book);
                if (historicalBorrowCount !== null) {
                    acc.hasHistoricalTracking = true;
                    acc.totalHistoricalBorrows += historicalBorrowCount;
                }

                return acc;
            },
            {
                currentlyBorrowedCopies: 0,
                totalHistoricalBorrows: 0,
                hasHistoricalTracking: false,
            }
        );
    }, [rows]);

    const clearCatalogControls = React.useCallback(() => {
        setSearch("");
        setFilterMode("all");
        setAvailabilityFilter("all");
        setLibraryAreaFilter("all");
        setSortOption("catalog");
    }, []);

    const hasCatalogControlsApplied =
        search.trim().length > 0 ||
        filterMode !== "all" ||
        availabilityFilter !== "all" ||
        libraryAreaFilter !== "all" ||
        sortOption !== "catalog";

    async function handleBorrow(
        book: BookWithStatus,
        copiesRequested = 1
    ): Promise<boolean> {
        if (isLibraryUseOnly(book)) {
            toast.info("Library use only", {
                description:
                    "This title is for in-library use only and cannot be borrowed online.",
            });
            return false;
        }

        const remaining = getRemainingCopies(book);

        if (!isBorrowable(book) || remaining <= 0) {
            toast.info("Book is not available right now.", {
                description: "There are no remaining copies to borrow.",
            });
            return false;
        }

        const requestedCopies = Math.min(
            Math.max(Math.floor(Number(copiesRequested) || 1), 1),
            remaining
        );

        setBorrowBusyId(book.id);

        try {
            const created = await createSelfBorrowRecords(book.id, requestedCopies);

            if (created.length === 0) {
                toast.error("Borrow failed", {
                    description:
                        "The borrow request did not return any created record. Please try again.",
                });
                return false;
            }

            const due = fmtDate(created[0]?.dueDate);
            const assignedCopiesSuffix = buildBorrowAssignmentSummary(created);

            if (created.length < requestedCopies) {
                toast.warning("Partial borrow completed", {
                    description: `Borrowed ${created.length} of ${requestedCopies} copies of "${book.title}". Earliest due date: ${due}.${assignedCopiesSuffix}`,
                });
            } else {
                toast.success("Borrow request submitted", {
                    description: `${created.length} cop${
                        created.length === 1 ? "y" : "ies"
                    } of "${book.title}" ${
                        created.length === 1 ? "is" : "are"
                    } now reserved for pickup for 24 hours. Earliest due date: ${due}.${assignedCopiesSuffix}`,
                });
            }

            setMyRecords((prev) => [...created.slice().reverse(), ...prev]);

            try {
                const [booksLatest, myLatest] = await Promise.all([
                    fetchBooks(),
                    fetchMyBorrowRecords(),
                ]);
                setBooks(booksLatest);
                setMyRecords(myLatest);
            } catch {
                // ignore refresh failure
            }

            return true;
        } catch (err: any) {
            const msg =
                err?.message ||
                "Could not borrow this book right now. Please try again later.";
            toast.error("Borrow failed", { description: msg });
            return false;
        } finally {
            setBorrowBusyId(null);
        }
    }

    return (
        <DashboardLayout title="Browse Books">
            <div className="w-full overflow-x-hidden">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" aria-hidden="true" />
                        <div>
                            <h2 className="text-lg font-semibold leading-tight">
                                Library catalog
                            </h2>
                            <p className="text-xs text-white/70">
                                Browse all books, including titles marked as{" "}
                                <span className="font-semibold text-amber-200">
                                    Library use only
                                </span>
                                . Borrowable books and in-library-only books are shown separately.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            aria-label="Refresh books"
                        >
                            {refreshing || loading ? (
                                <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                            )}
                            <span className="sr-only">Refresh</span>
                        </Button>
                    </div>
                </div>

                <Card className="border-white/10 bg-slate-800/60">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <CardTitle>Books you can borrow</CardTitle>
                                <p className="text-xs text-white/70">
                                    Showing {rows.length} of {books.length}{" "}
                                    {books.length === 1 ? "book" : "books"} ·{" "}
                                    {borrowableRows.length} borrowable · {libraryUseOnlyRows.length}{" "}
                                    library use only.
                                </p>
                                <p className="text-[11px] text-white/55">
                                    Tracked right now: {trackedBorrowSummary.currentlyBorrowedCopies}{" "}
                                    copy
                                    {trackedBorrowSummary.currentlyBorrowedCopies === 1 ? "" : "ies"}{" "}
                                    currently borrowed
                                    {trackedBorrowSummary.hasHistoricalTracking
                                        ? ` · ${trackedBorrowSummary.totalHistoricalBorrows} total recorded borrow${
                                              trackedBorrowSummary.totalHistoricalBorrows === 1
                                                  ? ""
                                                  : "s"
                                          }`
                                        : ""}
                                    .
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                <div className="relative min-w-0 md:col-span-2 xl:col-span-3">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                    <Input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search call no., accession no., title, subject, publication year, author, library use only…"
                                        autoComplete="off"
                                        aria-label="Search books"
                                        className="border-white/20 bg-slate-900/70 pl-9 text-white"
                                    />
                                </div>

                                <Select
                                    value={libraryAreaFilter}
                                    onValueChange={(value) => setLibraryAreaFilter(value)}
                                >
                                    <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="Library area" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="all">All library areas</SelectItem>
                                        {libraryAreaChoices.map((area) => (
                                            <SelectItem key={area} value={area}>
                                                {fmtLibraryArea(area as BookDTO["libraryArea"])}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={availabilityFilter}
                                    onValueChange={(value) =>
                                        setAvailabilityFilter(value as CatalogAvailabilityFilter)
                                    }
                                >
                                    <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="Availability" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="all">All availability</SelectItem>
                                        <SelectItem value="available">Available only</SelectItem>
                                        <SelectItem value="unavailable">Unavailable only</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filterMode}
                                    onValueChange={(value) => setFilterMode(value as FilterMode)}
                                >
                                    <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="My books" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="all">All books</SelectItem>
                                        <SelectItem value="borrowedByMe">
                                            Borrowed by me (active)
                                        </SelectItem>
                                        <SelectItem value="history">My history</SelectItem>
                                        <SelectItem value="libraryUseOnly">
                                            Library use only
                                        </SelectItem>
                                        <SelectItem value="available">
                                            Available only (my view)
                                        </SelectItem>
                                        <SelectItem value="unavailable">
                                            Unavailable only (my view)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={sortOption}
                                    onValueChange={(value) =>
                                        setSortOption(value as CatalogSortOption)
                                    }
                                >
                                    <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                                        <div className="flex items-center gap-2 truncate">
                                            <ArrowUpDown className="h-4 w-4 text-white/60" />
                                            <SelectValue placeholder="Sort books" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                                        <SelectItem value="catalog">Catalog order</SelectItem>
                                        <SelectItem value="call_no_asc">Call no. (A–Z)</SelectItem>
                                        <SelectItem value="call_no_desc">Call no. (Z–A)</SelectItem>
                                        <SelectItem value="accession_asc">
                                            Accession no. (A–Z)
                                        </SelectItem>
                                        <SelectItem value="accession_desc">
                                            Accession no. (Z–A)
                                        </SelectItem>
                                        <SelectItem value="title_asc">Title (A–Z)</SelectItem>
                                        <SelectItem value="title_desc">Title (Z–A)</SelectItem>
                                        <SelectItem value="pub_year_desc">
                                            Publication year (Newest first)
                                        </SelectItem>
                                        <SelectItem value="pub_year_asc">
                                            Publication year (Oldest first)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="flex flex-col gap-2 xl:col-span-3 sm:flex-row sm:flex-wrap">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-white/20 text-white/90 hover:bg-white/10"
                                        onClick={clearCatalogControls}
                                        disabled={!hasCatalogControlsApplied}
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <p className="mt-2 text-[11px] text-white/60">
                            When you borrow a book online, it becomes{" "}
                            <span className="font-semibold text-amber-200">
                                Reserved for up to 24 hours
                            </span>{" "}
                            while waiting for pickup confirmation. If a librarian confirms pickup
                            within that window, it changes to{" "}
                            <span className="font-semibold text-emerald-200">Borrowed</span>.
                            Otherwise the reservation expires automatically and the book becomes
                            available again. Books marked{" "}
                            <span className="font-semibold text-amber-200">
                                Library use only
                            </span>{" "}
                            stay visible in the catalog but cannot be borrowed online.
                        </p>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-28 w-full rounded-2xl" />
                                <Skeleton className="h-28 w-full rounded-2xl" />
                                <Skeleton className="h-28 w-full rounded-2xl" />
                            </div>
                        ) : error ? (
                            <div className="py-6 text-center text-sm text-red-300">
                                {error}
                            </div>
                        ) : borrowableRows.length === 0 ? (
                            <div className="py-10 text-center text-sm text-white/70">
                                No borrowable books matched your filters.
                                <br />
                                <span className="text-xs opacity-80">
                                    Try clearing the search or changing the filter.
                                </span>
                            </div>
                        ) : (
                            <section className="space-y-2">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-semibold text-white">
                                        Borrowable catalog
                                    </h3>
                                    <p className="text-xs text-white/60">
                                        {borrowableRows.length} matching{" "}
                                        {borrowableRows.length === 1 ? "title" : "titles"} can be
                                        borrowed online right now, subject to remaining copy counts.
                                    </p>
                                </div>

                                <>
                                    <div className="space-y-3 sm:hidden">
                                        {borrowableRows.map((book) => (
                                            <StudentBookMobileCard
                                                key={book.id}
                                                book={book}
                                                borrowBusyId={borrowBusyId}
                                                onBorrow={handleBorrow}
                                            />
                                        ))}
                                    </div>

                                    <div className="hidden space-y-3 sm:block">
                                        {borrowableRows.map((book) => (
                                            <StudentBookDesktopCard
                                                key={book.id}
                                                book={book}
                                                borrowBusyId={borrowBusyId}
                                                onBorrow={handleBorrow}
                                            />
                                        ))}
                                    </div>
                                </>
                            </section>
                        )}
                    </CardContent>
                </Card>

                {(!loading && !error && libraryUseOnlyRows.length > 0) ||
                (!loading && !error && filterMode === "libraryUseOnly") ? (
                    <Card className="mt-4 border-amber-400/20 bg-amber-500/5">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-1">
                                <CardTitle className="text-amber-100">
                                    Library use only
                                </CardTitle>
                                <p className="text-xs text-amber-100/70">
                                    These titles are visible in the catalog but are for in-library
                                    use only and cannot be borrowed online.
                                </p>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {libraryUseOnlyRows.length === 0 ? (
                                <div className="py-8 text-center text-sm text-amber-100/70">
                                    No library-use-only books matched your filters.
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3 sm:hidden">
                                        {libraryUseOnlyRows.map((book) => (
                                            <StudentBookMobileCard
                                                key={book.id}
                                                book={book}
                                                borrowBusyId={borrowBusyId}
                                                onBorrow={handleBorrow}
                                            />
                                        ))}
                                    </div>

                                    <div className="hidden space-y-3 sm:block">
                                        {libraryUseOnlyRows.map((book) => (
                                            <StudentBookDesktopCard
                                                key={book.id}
                                                book={book}
                                                borrowBusyId={borrowBusyId}
                                                onBorrow={handleBorrow}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </DashboardLayout>
    );
}