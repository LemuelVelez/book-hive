/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Star,
    MessageSquare,
    AlertTriangle,
    Image as ImageIcon,
    Loader2,
    BookOpen,
    ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { fetchBooks, type BookDTO } from "@/lib/books";
import {
    fetchMyFeedbacks,
    createFeedback,
    type FeedbackDTO,
} from "@/lib/feedbacks";
import {
    fetchMyDamageReports,
    createDamageReport,
    type DamageReportDTO,
    type DamageSeverity,
} from "@/lib/damageReports";

/**
 * Format date as YYYY-MM-DD in *local* timezone
 * to avoid off-by-one issues from UTC conversions.
 */
function fmtDate(d?: string | null) {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        // en-CA -> 2025-11-13 (YYYY-MM-DD)
        return date.toLocaleDateString("en-CA");
    } catch {
        return d;
    }
}

/* ------------------------- Star rating components ------------------------- */

type StarRatingProps = {
    value: number;
    onChange?: (v: number) => void;
    readOnly?: boolean;
    size?: "sm" | "md";
};

function StarRating({ value, onChange, readOnly, size = "md" }: StarRatingProps) {
    const stars = [1, 2, 3, 4, 5];
    const baseClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

    return (
        <div className="inline-flex items-center gap-1">
            {stars.map((star) => {
                const filled = star <= value;
                const Icon = (
                    <Star
                        className={`${baseClass} ${filled ? "text-yellow-400 fill-yellow-400" : "text-slate-500"
                            }`}
                    />
                );

                if (readOnly || !onChange) {
                    return (
                        <span key={star} aria-hidden="true">
                            {Icon}
                        </span>
                    );
                }

                return (
                    <button
                        key={star}
                        type="button"
                        onClick={() => onChange(star)}
                        className="p-0.5 rounded hover:bg-white/10 transition-colors"
                        aria-label={`Set rating to ${star} star${star === 1 ? "" : "s"}`}
                    >
                        {Icon}
                    </button>
                );
            })}
        </div>
    );
}

/* ----------------------------- Main component ----------------------------- */

export default function StudentInsightsHubPage() {
    const [books, setBooks] = React.useState<BookDTO[]>([]);
    const [myFeedbacks, setMyFeedbacks] = React.useState<FeedbackDTO[]>([]);
    const [myDamageReports, setMyDamageReports] = React.useState<DamageReportDTO[]>([]);

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [refreshing, setRefreshing] = React.useState(false);

    // Feedback form state
    const [feedbackBookId, setFeedbackBookId] = React.useState<string>("");
    const [rating, setRating] = React.useState<number>(0);
    const [comment, setComment] = React.useState<string>("");
    const [submittingFeedback, setSubmittingFeedback] = React.useState(false);

    // Damage report form state
    const [damageBookId, setDamageBookId] = React.useState<string>("");
    const [damageSeverity, setDamageSeverity] = React.useState<DamageSeverity>("minor");
    const [damageDescription, setDamageDescription] = React.useState<string>("");
    const [damageNotes, setDamageNotes] = React.useState<string>("");
    const [damageFiles, setDamageFiles] = React.useState<File[]>([]);
    const [submittingDamage, setSubmittingDamage] = React.useState(false);

    // Image preview dialog state
    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [previewImages, setPreviewImages] = React.useState<string[]>([]);
    const [previewIndex, setPreviewIndex] = React.useState(0);

    const hasPreviewImage = previewImages.length > 0;
    const currentPreviewUrl = hasPreviewImage
        ? previewImages[Math.min(Math.max(previewIndex, 0), previewImages.length - 1)]
        : "";

    function openPreview(images: string[], index = 0) {
        if (!images || !images.length) return;
        setPreviewImages(images);
        setPreviewIndex(index);
        setPreviewOpen(true);
    }

    function showPrev() {
        setPreviewIndex((idx) => {
            if (!previewImages.length) return 0;
            return (idx - 1 + previewImages.length) % previewImages.length;
        });
    }

    function showNext() {
        setPreviewIndex((idx) => {
            if (!previewImages.length) return 0;
            return (idx + 1) % previewImages.length;
        });
    }

    const loadAll = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const [booksData, feedbacksData, damageData] = await Promise.all([
                fetchBooks(),
                fetchMyFeedbacks(),
                fetchMyDamageReports(),
            ]);

            setBooks(booksData);
            setMyFeedbacks(feedbacksData);
            setMyDamageReports(damageData);
        } catch (err: any) {
            const msg =
                err?.message ||
                "Failed to load insights data. Please try again later.";
            setError(msg);
            toast.error("Failed to load Insights Hub", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadAll();
    }, [loadAll]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await loadAll();
        } finally {
            setRefreshing(false);
        }
    }

    /* ------------------------- Feedback form handlers ------------------------ */

    async function handleSubmitFeedback(e: React.FormEvent) {
        e.preventDefault();
        if (!feedbackBookId) {
            toast.warning("Select a book first", {
                description: "Please choose which book you’re rating.",
            });
            return;
        }
        if (rating < 1 || rating > 5) {
            toast.warning("Set a rating", {
                description: "Tap on the stars to set a rating between 1 and 5.",
            });
            return;
        }

        setSubmittingFeedback(true);
        try {
            const fb = await createFeedback({
                bookId: feedbackBookId,
                rating,
                comment: comment.trim() || null,
            });

            setMyFeedbacks((prev) => [fb, ...prev]);
            toast.success("Feedback submitted", {
                description: "Thank you for helping improve the library collection.",
            });

            // Reset form
            setFeedbackBookId("");
            setRating(0);
            setComment("");
        } catch (err: any) {
            const msg = err?.message || "Could not submit feedback.";
            toast.error("Feedback failed", { description: msg });
        } finally {
            setSubmittingFeedback(false);
        }
    }

    /* ---------------------- Damage report form handlers --------------------- */

    function handleDamageFilesChange(
        e: React.ChangeEvent<HTMLInputElement>
    ) {
        const files = e.target.files;
        if (!files) {
            setDamageFiles([]);
            return;
        }
        const arr = Array.from(files).slice(0, 3);
        setDamageFiles(arr);
    }

    async function handleSubmitDamageReport(e: React.FormEvent) {
        e.preventDefault();

        if (!damageBookId) {
            toast.warning("Select a book first", {
                description: "Please choose which book is damaged.",
            });
            return;
        }
        if (!damageDescription.trim()) {
            toast.warning("Describe the damage", {
                description: "Add a short description of the damage.",
            });
            return;
        }

        setSubmittingDamage(true);
        try {
            const report = await createDamageReport({
                bookId: damageBookId,
                damageType: damageDescription.trim(),
                severity: damageSeverity,
                notes: damageNotes.trim() || null,
                photos: damageFiles,
            });

            setMyDamageReports((prev) => [report, ...prev]);
            toast.success("Damage report submitted", {
                description:
                    "Thank you for reporting this. A librarian will assess it soon.",
            });

            // Reset form
            setDamageBookId("");
            setDamageSeverity("minor");
            setDamageDescription("");
            setDamageNotes("");
            setDamageFiles([]);
        } catch (err: any) {
            const msg = err?.message || "Could not submit damage report.";
            toast.error("Damage report failed", { description: msg });
        } finally {
            setSubmittingDamage(false);
        }
    }

    const bookOptions = books.map((b) => ({
        id: b.id,
        label: `${b.title} — ${b.author}`,
    }));

    return (
        <DashboardLayout title="Insights Hub">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">
                            Insights Hub
                        </h2>
                        <p className="text-xs text-white/70">
                            Share feedback on books and report damaged copies to help keep
                            the library collection in good shape.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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
                            <BookOpen className="h-4 w-4" />
                        )}
                        <span className="sr-only">Refresh</span>
                    </Button>
                </div>
            </div>

            {error && !loading && (
                <div className="mb-4 text-sm text-red-300">{error}</div>
            )}

            {/* Feedback + history */}
            <Card className="mb-6 bg-slate-800/60 border-white/10">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-300" />
                        <CardTitle>Book feedback</CardTitle>
                    </div>
                    <p className="mt-1 text-xs text-white/70">
                        Rate books you&apos;ve read and add an optional comment. Your
                        feedback helps other students discover helpful titles.
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
                        {/* Feedback form */}
                        <form className="space-y-4" onSubmit={handleSubmitFeedback}>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80">
                                    Select book
                                </label>
                                <Select
                                    value={feedbackBookId}
                                    onValueChange={(v) => setFeedbackBookId(v)}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Choose a book to rate" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10 max-h-64">
                                        {bookOptions.length === 0 ? (
                                            <div className="px-2 py-2 text-xs text-white/60">
                                                No books available.
                                            </div>
                                        ) : (
                                            bookOptions.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>
                                                    {b.label}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80">
                                    Rating
                                </label>
                                <div className="flex items-center gap-2">
                                    <StarRating
                                        value={rating}
                                        onChange={setRating}
                                        size="md"
                                    />
                                    <span className="text-xs text-white/60">
                                        {rating ? `${rating} / 5` : "Tap to rate"}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80">
                                    Comment <span className="text-white/40">(optional)</span>
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={4}
                                    className="w-full rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/70"
                                    placeholder="What did you like or dislike about this book?"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                disabled={submittingFeedback || loading}
                            >
                                {submittingFeedback ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Submitting…
                                    </span>
                                ) : (
                                    "Submit feedback"
                                )}
                            </Button>
                        </form>

                        {/* My feedback list */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-white/90">
                                    Your feedback
                                </h3>
                                {myFeedbacks.length > 0 && (
                                    <span className="text-[11px] text-white/60">
                                        {myFeedbacks.length}{" "}
                                        {myFeedbacks.length === 1 ? "entry" : "entries"}
                                    </span>
                                )}
                            </div>
                            {loading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : myFeedbacks.length === 0 ? (
                                <div className="rounded-md border border-dashed border-white/20 px-3 py-4 text-xs text-white/60">
                                    You haven&apos;t submitted any feedback yet.
                                    <br />
                                    <span className="opacity-80">
                                        Start by selecting a book and rating it on the left.
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 support-scroll">
                                    {myFeedbacks.map((fb) => (
                                        <div
                                            key={fb.id}
                                            className="rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-xs"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-white">
                                                        {fb.bookTitle ?? `Book #${fb.bookId}`}
                                                    </span>
                                                    <span className="text-[10px] text-white/50">
                                                        {fmtDate(fb.createdAt)}
                                                    </span>
                                                </div>
                                                <StarRating
                                                    value={fb.rating}
                                                    readOnly
                                                    size="sm"
                                                />
                                            </div>
                                            {fb.comment && (
                                                <p className="mt-1 text-[11px] text-white/80">
                                                    {fb.comment}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Damage reports */}
            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-300" />
                        <CardTitle>Report damaged book</CardTitle>
                    </div>
                    <p className="mt-1 text-xs text-white/70">
                        If you notice a damaged book, submit a report with details and up
                        to three photos so the librarian can assess it.
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
                        {/* Damage report form */}
                        <form className="space-y-4" onSubmit={handleSubmitDamageReport}>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80">
                                    Select book
                                </label>
                                <Select
                                    value={damageBookId}
                                    onValueChange={(v) => setDamageBookId(v)}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Choose damaged book" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10 max-h-64">
                                        {bookOptions.length === 0 ? (
                                            <div className="px-2 py-2 text-xs text-white/60">
                                                No books available.
                                            </div>
                                        ) : (
                                            bookOptions.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>
                                                    {b.label}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80">
                                    Severity
                                </label>
                                <Select
                                    value={damageSeverity}
                                    onValueChange={(v) => setDamageSeverity(v as DamageSeverity)}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="minor">Minor (cosmetic)</SelectItem>
                                        <SelectItem value="moderate">
                                            Moderate (affects reading)
                                        </SelectItem>
                                        <SelectItem value="major">
                                            Major (pages missing / severe)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80">
                                    Description of the damage
                                </label>
                                <textarea
                                    value={damageDescription}
                                    onChange={(e) => setDamageDescription(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                                    placeholder="Example: Front cover is torn, some pages wrinkled from water."
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80">
                                    Extra notes{" "}
                                    <span className="text-white/40">(optional)</span>
                                </label>
                                <textarea
                                    value={damageNotes}
                                    onChange={(e) => setDamageNotes(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                                    placeholder="Add any other information that might help the librarian."
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Upload pictures of damage
                                    <span className="text-[10px] text-white/50">
                                        (max 3 images)
                                    </span>
                                </label>
                                <Input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleDamageFilesChange}
                                    className="bg-slate-900/70 border-white/20 text-white file:bg-slate-800 file:border-0 file:text-xs file:px-3 file:py-1.5 file:text-white"
                                />
                                {damageFiles.length > 0 && (
                                    <div className="mt-1 text-[10px] text-white/70 space-y-0.5">
                                        <div>Selected files:</div>
                                        <ul className="list-disc list-inside space-y-0.5">
                                            {damageFiles.map((f, idx) => (
                                                <li key={idx} className="truncate">
                                                    {f.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                disabled={submittingDamage || loading}
                            >
                                {submittingDamage ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Submitting…
                                    </span>
                                ) : (
                                    "Submit damage report"
                                )}
                            </Button>

                            <p className="text-[10px] text-amber-200/80 flex items-start gap-1.5">
                                <AlertTriangle className="h-3 w-3 mt-0.5" />
                                A librarian will review your report and may assess a fee if the
                                damage is serious or due to misuse.
                            </p>
                        </form>

                        {/* My damage reports */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-white/90">
                                    Your damage reports
                                </h3>
                                {myDamageReports.length > 0 && (
                                    <span className="text-[11px] text-white/60">
                                        {myDamageReports.length}{" "}
                                        {myDamageReports.length === 1 ? "report" : "reports"}
                                    </span>
                                )}
                            </div>

                            {loading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : myDamageReports.length === 0 ? (
                                <div className="rounded-md border border-dashed border-white/20 px-3 py-4 text-xs text-white/60">
                                    You haven&apos;t submitted any damage reports yet.
                                    <br />
                                    <span className="opacity-80">
                                        Only submit a report if you notice damage so we can fix or
                                        replace the copy.
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 support-scroll">
                                    {myDamageReports.map((r) => (
                                        <div
                                            key={r.id}
                                            className="rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-xs"
                                        >
                                            {/* ⬇️ MOBILE: vertical, DESKTOP: same horizontal layout */}
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                <div className="space-y-0.5">
                                                    <div className="font-medium text-white">
                                                        {r.bookTitle ?? `Book #${r.bookId}`}
                                                    </div>
                                                    <div className="text-[10px] text-white/50">
                                                        Reported: {fmtDate(r.reportedAt)}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <Badge
                                                            className={
                                                                r.status === "paid"
                                                                    ? "bg-emerald-600/80 border-emerald-400/70"
                                                                    : r.status === "assessed"
                                                                        ? "text-white bg-amber-600/80 border-amber-400/70"
                                                                        : "text-white bg-slate-700/80 border-slate-500/70"
                                                            }
                                                        >
                                                            {r.status === "pending"
                                                                ? "Pending review"
                                                                : r.status === "assessed"
                                                                    ? "Assessed"
                                                                    : "Paid"}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="border-white/30 text-white/80"
                                                        >
                                                            {r.severity === "minor"
                                                                ? "Minor"
                                                                : r.severity === "moderate"
                                                                    ? "Moderate"
                                                                    : "Major"}
                                                        </Badge>
                                                        {r.fee > 0 && (
                                                            <span className="text-[11px] text-red-300 font-medium">
                                                                ₱{r.fee.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {r.photoUrls.length > 0 && (
                                                    <div className="flex flex-col items-start sm:items-end gap-1 mt-2 sm:mt-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => openPreview(r.photoUrls, 0)}
                                                            className="cursor-pointer relative h-14 w-20 overflow-hidden rounded-md border border-white/20 bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                                            aria-label="Preview damage photos"
                                                        >
                                                            <img
                                                                src={r.photoUrls[0]}
                                                                alt="Damage"
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </button>
                                                        {r.photoUrls.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openPreview(r.photoUrls, 0)}
                                                                className="text-[10px] text-white/60 hover:text-white/90 underline-offset-2 hover:underline"
                                                            >
                                                                +{r.photoUrls.length - 1} more
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <p className="mt-1 text-[11px] text-white/80">
                                                {r.damageType}
                                            </p>
                                            {r.notes && (
                                                <p className="mt-0.5 text-[11px] text-white/70">
                                                    Notes: {r.notes}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Image preview dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-3xl bg-slate-900 text-white border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            Damage photo preview
                            {previewImages.length > 1
                                ? ` (${previewIndex + 1} of ${previewImages.length})`
                                : ""}
                        </DialogTitle>
                    </DialogHeader>
                    {currentPreviewUrl ? (
                        <div className="mt-2 flex flex-col gap-4">
                            <div className="relative max-h-[70vh] overflow-hidden rounded-lg border border-white/20 bg-black/40">
                                <img
                                    src={currentPreviewUrl}
                                    alt="Damage report photo"
                                    className="max-h-[70vh] w-full object-contain"
                                />
                            </div>
                            {previewImages.length > 1 && (
                                <div className="flex items-center justify-between text-xs text-white/70">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-white/20 text-white/80 hover:bg-white/10"
                                        onClick={showPrev}
                                    >
                                        Previous
                                    </Button>
                                    <span>
                                        Image {previewIndex + 1} of {previewImages.length}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-white/20 text-white/80 hover:bg-white/10"
                                        onClick={showNext}
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-white/60">No image to preview.</p>
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
