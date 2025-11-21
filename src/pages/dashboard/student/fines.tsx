/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    ReceiptText,
    RefreshCcw,
    Loader2,
    Search,
    Clock3,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    CreditCard,
    QrCode,
    UploadCloud,
    Download,
} from "lucide-react";
import { toast } from "sonner";

import {
    fetchMyFines,
    requestFinePayment,
    fetchPaymentConfig,
    uploadFineProofImage,
    fetchFineProofs,
    type FineDTO,
    type FineStatus,
    type PaymentConfigDTO,
    type FineProofDTO,
} from "@/lib/fines";

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

type StatusFilter = "all" | FineStatus;

// How the student actually paid when uploading a receipt
type PaymentMethod = "gcash" | "maya" | "bank_transfer" | "other";

/**
 * Turn the UI payment-method choice into a compact `kind` string
 * that is stored together with the proof image. The librarian will
 * later see this value when verifying proofs.
 */
function buildProofKindForMethod(method: PaymentMethod | null | undefined): string {
    if (!method) return "student_payment";
    switch (method) {
        case "gcash":
            return "student_payment:gcash";
        case "maya":
            return "student_payment:maya";
        case "bank_transfer":
            return "student_payment:bank_transfer";
        case "other":
            return "student_payment:other";
        default:
            return "student_payment";
    }
}

/**
 * Infer a PaymentMethod from a stored proof.kind string.
 * Used to pre-select the payment method when viewing/updating
 * an existing pending payment.
 */
function paymentMethodFromProofKind(
    kind: string | null | undefined
): PaymentMethod | null {
    if (!kind) return null;
    const k = kind.toLowerCase();

    if (k.includes("gcash")) return "gcash";
    if (k.includes("maya")) return "maya";
    if (k.includes("bank")) return "bank_transfer";
    if (k.includes("other")) return "other";

    return null;
}

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

function peso(n: number) {
    if (typeof n !== "number" || Number.isNaN(n)) return "₱0.00";
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 2,
        }).format(n);
    } catch {
        return `₱${n.toFixed(2)}`;
    }
}

// Normalize any "fine-like" value into a safe number
function normalizeFine(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = typeof value === "number" ? value : Number(value);
    return Number.isNaN(num) ? 0 : num;
}

/**
 * Best-effort helper to detect if a fine is related to a damage report.
 * This matches what the librarian sees and works whether the backend
 * stores explicit damage fields or only a "damage" reason.
 */
function isDamageFine(fine: FineDTO): boolean {
    const anyFine = fine as any;
    const reason = (fine.reason || "").toLowerCase();

    return Boolean(
        anyFine.damageReportId ||
        anyFine.damageId ||
        anyFine.damageType ||
        anyFine.damageDescription ||
        anyFine.damageDetails ||
        reason.includes("damage") ||
        reason.includes("lost book")
    );
}

// Reusable scrollbar styling for dark, thin *vertical* scrollbars (dialog content)
const dialogScrollbarClasses =
    "overflow-y-auto " +
    "[scrollbar-width:thin] [scrollbar-color:#111827_transparent] " +
    "[&::-webkit-scrollbar]:w-1.5 " +
    "[&::-webkit-scrollbar-track]:bg-transparent " +
    "[&::-webkit-scrollbar-thumb]:bg-slate-400 " +
    "[&::-webkit-scrollbar-thumb]:rounded-full " +
    "[&::-webkit-scrollbar-thumb:hover]:bg-slate-300";

export default function StudentFinesPage() {
    const [fines, setFines] = React.useState<FineDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
    const [payBusyId, setPayBusyId] = React.useState<string | null>(null);

    // Busy while uploading an additional proof for a pending fine
    const [pendingUpdateBusyId, setPendingUpdateBusyId] =
        React.useState<string | null>(null);

    // Global payment config (e-wallet phone + QR)
    const [paymentConfig, setPaymentConfig] =
        React.useState<PaymentConfigDTO | null>(null);
    const [paymentConfigLoading, setPaymentConfigLoading] =
        React.useState<boolean>(false);

    // Selected payment screenshot (for either active or pending dialog)
    const [selectedProofFile, setSelectedProofFile] =
        React.useState<File | null>(null);
    const [selectedProofFineId, setSelectedProofFineId] =
        React.useState<string | null>(null);
    const [selectedProofPreviewUrl, setSelectedProofPreviewUrl] =
        React.useState<string | null>(null);

    // Clean up object URL on unmount
    React.useEffect(() => {
        return () => {
            if (selectedProofPreviewUrl) {
                URL.revokeObjectURL(selectedProofPreviewUrl);
            }
        };
    }, [selectedProofPreviewUrl]);

    // Payment method the student used when paying online
    const [selectedPaymentMethod, setSelectedPaymentMethod] =
        React.useState<PaymentMethod>("gcash");
    const [selectedPaymentMethodFineId, setSelectedPaymentMethodFineId] =
        React.useState<string | null>(null);

    // Previously uploaded proofs (for preview while pending_verification)
    const [proofsByFineId, setProofsByFineId] = React.useState<
        Record<string, FineProofDTO[]>
    >({});
    const [proofsLoadingForId, setProofsLoadingForId] =
        React.useState<string | null>(null);

    const loadFines = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchMyFines();
            setFines(data);
        } catch (err: any) {
            const msg = err?.message || "Failed to load fines.";
            setError(msg);
            toast.error("Failed to load fines", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadFines();
    }, [loadFines]);

    React.useEffect(() => {
        const run = async () => {
            setPaymentConfigLoading(true);
            try {
                const cfg = await fetchPaymentConfig();
                setPaymentConfig(cfg);
            } catch (err: any) {
                const msg =
                    err?.message || "Failed to load library payment information.";
                toast.error("Could not load payment details", { description: msg });
            } finally {
                setPaymentConfigLoading(false);
            }
        };
        void run();
    }, []);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await loadFines();
        } finally {
            setRefreshing(false);
        }
    }

    const filtered = React.useMemo(() => {
        let rows = [...fines];

        if (statusFilter !== "all") {
            rows = rows.filter((f) => f.status === statusFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter((f) => {
                const anyFine = f as any;
                const haystack = `${f.id} ${f.reason ?? ""} ${f.bookTitle ?? ""} ${f.bookId ?? ""
                    } ${anyFine.damageReportId ?? ""} ${anyFine.damageDescription ?? ""
                    } ${anyFine.damageType ?? ""} ${anyFine.damageDetails ?? ""}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        // Show most recent first
        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [fines, statusFilter, search]);

    const { totalActive, totalPending } = React.useMemo(() => {
        let active = 0;
        let pending = 0;
        for (const f of fines) {
            const amt = normalizeFine(f.amount);
            if (amt <= 0) continue;
            if (f.status === "active") active += amt;
            if (f.status === "pending_verification") pending += amt;
        }
        return { totalActive: active, totalPending: pending };
    }, [fines]);

    async function handlePayFine(fine: FineDTO) {
        if (fine.status !== "active") {
            toast.info("Fine cannot be paid right now", {
                description:
                    fine.status === "pending_verification"
                        ? "This fine already has a payment pending verification."
                        : "This fine is no longer active.",
            });
            return;
        }

        // Require receipt / screenshot before proceeding
        if (!selectedProofFile || selectedProofFineId !== fine.id) {
            toast.error("Payment receipt required", {
                description:
                    "Please upload a screenshot or photo of your payment before confirming.",
            });
            return;
        }

        setPayBusyId(fine.id);
        try {
            const updated = await requestFinePayment(fine.id);

            setFines((prev) =>
                prev.map((f) => (f.id === updated.id ? updated : f))
            );

            // Upload proof screenshot (required and already checked)
            try {
                const methodForThisFine =
                    selectedPaymentMethodFineId === fine.id
                        ? selectedPaymentMethod
                        : null;

                await uploadFineProofImage(fine.id, selectedProofFile, {
                    // This `kind` is what the librarian will see under the proof
                    kind: buildProofKindForMethod(methodForThisFine),
                });
            } catch (err: any) {
                const msg =
                    err?.message ||
                    "Your payment was submitted but the screenshot upload failed. Please contact the librarian.";
                toast.error("Payment proof upload failed", { description: msg });
            } finally {
                setSelectedProofFile(null);
                setSelectedProofFineId(null);
                setSelectedPaymentMethodFineId(null);
                setSelectedProofPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                });
            }

            toast.success("Payment submitted", {
                description:
                    "Your fine payment is now marked as pending verification. A librarian will confirm it and mark the fine as paid.",
            });
        } catch (err: any) {
            const msg =
                err?.message ||
                "Could not submit your fine payment. Please try again later.";
            toast.error("Payment failed", { description: msg });
        } finally {
            setPayBusyId(null);
        }
    }

    async function handleLoadProofs(fineId: string) {
        setProofsLoadingForId(fineId);
        try {
            const proofs = await fetchFineProofs(fineId);
            setProofsByFineId((prev) => ({
                ...prev,
                [fineId]: proofs,
            }));

            // Pre-select payment method based on the latest proof, if any
            if (proofs.length > 0) {
                const latest = [...proofs].sort((a, b) => {
                    if (!a.uploadedAt || !b.uploadedAt) return 0;
                    return b.uploadedAt.localeCompare(a.uploadedAt);
                })[0];
                const inferred = paymentMethodFromProofKind(latest.kind);
                if (inferred) {
                    setSelectedPaymentMethodFineId(fineId);
                    setSelectedPaymentMethod(inferred);
                }
            }
        } catch (err: any) {
            const msg =
                err?.message || "Failed to load payment proof images for this fine.";
            toast.error("Could not load proofs", { description: msg });
        } finally {
            setProofsLoadingForId(null);
        }
    }

    async function handleUploadAdditionalProof(fine: FineDTO) {
        if (!selectedProofFile || selectedProofFineId !== fine.id) {
            toast.error("No receipt selected", {
                description: "Please choose an image file to upload.",
            });
            return;
        }

        setPendingUpdateBusyId(fine.id);
        try {
            const methodForThisFine =
                selectedPaymentMethodFineId === fine.id
                    ? selectedPaymentMethod
                    : null;

            await uploadFineProofImage(fine.id, selectedProofFile, {
                kind: buildProofKindForMethod(methodForThisFine),
            });

            toast.success("Receipt updated", {
                description:
                    "Your new receipt has been uploaded. The librarian will see it when verifying your payment.",
            });

            // Clear local selection
            setSelectedProofFile(null);
            setSelectedProofFineId(null);
            setSelectedProofPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });

            // Reload proofs so the new one appears in the preview list
            await handleLoadProofs(fine.id);
        } catch (err: any) {
            const msg =
                err?.message ||
                "Failed to upload the new receipt. Please try again or contact the librarian.";
            toast.error("Upload failed", { description: msg });
        } finally {
            setPendingUpdateBusyId(null);
        }
    }

    function renderStatusBadge(status: FineStatus) {
        if (status === "active") {
            return (
                <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white border-amber-400/80">
                    <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Active (unpaid)
                    </span>
                </Badge>
            );
        }

        if (status === "pending_verification") {
            return (
                <Badge className="bg-amber-500/70 hover:bg-amber-500 text-white border-amber-300/80">
                    <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        Pending verification
                    </span>
                </Badge>
            );
        }

        if (status === "paid") {
            return (
                <Badge className="bg-emerald-500/80 hover:bg-emerald-500 text-white border-emerald-400/80">
                    <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                    </span>
                </Badge>
            );
        }

        return (
            <Badge className="bg-slate-500/80 hover:bg-slate-500 text-white border-slate-400/80">
                <span className="inline-flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Cancelled
                </span>
            </Badge>
        );
    }

    return (
        <DashboardLayout title="My Fines">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">
                            Fines &amp; payments
                        </h2>
                        <p className="text-xs text-white/70">
                            Review all fines linked to your account{" "}
                            <span className="font-semibold">
                                (for overdue returns and book damage)
                            </span>
                            , see which are unpaid, and track payment verification.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-200/90">
                            Fines marked as{" "}
                            <span className="font-semibold">Active</span> are unpaid. When
                            you pay from this page, the fine becomes{" "}
                            <span className="font-semibold">Pending verification</span> until
                            a librarian confirms the payment and marks it as{" "}
                            <span className="font-semibold">Paid</span>.
                        </p>
                        <p className="mt-1 text-[11px] text-emerald-200/90">
                            You can also choose to pay{" "}
                            <span className="font-semibold">over the counter</span> at the
                            library. In that case, the librarian will mark your fine as paid
                            directly in the system.
                        </p>
                        <p className="mt-1 text-[11px] text-rose-200/90">
                            When the library assesses{" "}
                            <span className="font-semibold">book damage</span> and sets a
                            fee, it will also appear here as a{" "}
                            <span className="font-semibold">Damage fine</span> and can be
                            paid using the same online process.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-white/70">
                    <div className="flex flex-col items-start sm:items-end">
                        <span>
                            Active fines (unpaid):{" "}
                            <span className="font-semibold text-amber-300">
                                {peso(totalActive)}
                            </span>
                        </span>
                        <span>
                            Payments pending verification:{" "}
                            <span className="font-semibold text-emerald-200">
                                {peso(totalPending)}
                            </span>
                        </span>
                    </div>

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
                </div>
            </div>

            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <CardTitle>Fine history</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            {/* Search */}
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by book, reason, damage, or ID…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            {/* Status filter */}
                            <div className="w-full md:w-[220px]">
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active (unpaid)</SelectItem>
                                        <SelectItem value="pending_verification">
                                            Pending verification
                                        </SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
                        <div className="py-6 text-center text-sm text-red-300">{error}</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-white/70">
                            You have no fines that match your filters.
                            <br />
                            <span className="text-xs opacity-80">
                                If you recently paid a fine, it may take a moment before the
                                status is updated to <span className="font-semibold">Paid</span>.
                            </span>
                        </div>
                    ) : (
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {filtered.length}{" "}
                                {filtered.length === 1 ? "fine" : "fines"}. Active fines (for
                                overdue returns or book damage) can be paid from this page.
                                Payments move into{" "}
                                <span className="font-semibold">Pending verification</span>{" "}
                                until a librarian validates them.
                            </TableCaption>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                        Fine ID
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Book / Damage info
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Borrow
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Status
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        ₱Amount
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                                        Action
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((fine) => {
                                    const amount = normalizeFine(fine.amount);
                                    const hasRequiredProof =
                                        selectedProofFineId === fine.id && !!selectedProofFile;
                                    const proofsForFine: FineProofDTO[] =
                                        proofsByFineId[fine.id] || [];

                                    const anyFine = fine as any;
                                    const damageReportId: string | undefined =
                                        anyFine.damageReportId || anyFine.damageId;
                                    const damageDescription: string | undefined =
                                        anyFine.damageDescription ||
                                        anyFine.damageDetails ||
                                        anyFine.damageType;
                                    const damage = isDamageFine(fine);

                                    return (
                                        <TableRow
                                            key={fine.id}
                                            className="border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell className="text-xs opacity-80">
                                                {fine.id}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium">
                                                        {fine.bookTitle ? (
                                                            fine.bookTitle
                                                        ) : (
                                                            <span className="opacity-70">
                                                                General fine
                                                                {fine.borrowRecordId &&
                                                                    ` for borrow #${fine.borrowRecordId}`}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {fine.reason && (
                                                        <span className="text-xs text-white/70">
                                                            {fine.reason}
                                                        </span>
                                                    )}

                                                    {damage && (
                                                        <span className="text-[11px] text-rose-200/90 flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            <span className="font-semibold">
                                                                Damage fine
                                                            </span>
                                                            {damageReportId && (
                                                                <span className="opacity-90">
                                                                    · Report #{damageReportId}
                                                                </span>
                                                            )}
                                                            {damageDescription && (
                                                                <span className="opacity-90">
                                                                    · {damageDescription}
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs opacity-80">
                                                {fine.borrowRecordId ? (
                                                    <span>
                                                        Borrow #{fine.borrowRecordId}
                                                        {fine.borrowDueDate && (
                                                            <>
                                                                {" "}
                                                                · Due {fmtDate(fine.borrowDueDate)}
                                                            </>
                                                        )}
                                                        {fine.borrowReturnDate && (
                                                            <>
                                                                {" "}
                                                                · Returned {fmtDate(fine.borrowReturnDate)}
                                                            </>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="opacity-60">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{renderStatusBadge(fine.status)}</TableCell>
                                            <TableCell className="text-sm">
                                                {peso(amount)}
                                            </TableCell>
                                            <TableCell className="text-right space-y-1">
                                                {/* Active: initial payment with required receipt */}
                                                {fine.status === "active" && (
                                                    <AlertDialog
                                                        onOpenChange={(open) => {
                                                            if (open) {
                                                                // Reset dialog-specific state when opened
                                                                setSelectedPaymentMethod("gcash");
                                                                setSelectedPaymentMethodFineId(fine.id);
                                                                setSelectedProofFineId(fine.id);
                                                                setSelectedProofFile(null);
                                                                setSelectedProofPreviewUrl((prev) => {
                                                                    if (prev) URL.revokeObjectURL(prev);
                                                                    return null;
                                                                });
                                                            } else {
                                                                // Clear when closed
                                                                if (selectedProofFineId === fine.id) {
                                                                    setSelectedProofFineId(null);
                                                                    setSelectedProofFile(null);
                                                                    setSelectedProofPreviewUrl((prev) => {
                                                                        if (prev) URL.revokeObjectURL(prev);
                                                                        return null;
                                                                    });
                                                                }
                                                                if (selectedPaymentMethodFineId === fine.id) {
                                                                    setSelectedPaymentMethodFineId(null);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full md:w-auto inline-flex items-center gap-1"
                                                                disabled={payBusyId === fine.id}
                                                            >
                                                                {payBusyId === fine.id ? (
                                                                    <>
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                        Paying…
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CreditCard className="h-4 w-4" />
                                                                        Pay fine
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </AlertDialogTrigger>

                                                        <AlertDialogContent
                                                            className={
                                                                "bg-slate-900 border-white/10 text-white max-h-[90vh] " +
                                                                dialogScrollbarClasses
                                                            }
                                                        >
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Pay this fine now?
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription className="text-white/70">
                                                                    You&apos;re about to pay the active fine of{" "}
                                                                    <span className="font-semibold text-red-300">
                                                                        {peso(amount)}
                                                                    </span>{" "}
                                                                    {fine.bookTitle && (
                                                                        <>
                                                                            for{" "}
                                                                            <span className="font-semibold text-white">
                                                                                “{fine.bookTitle}”
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    .
                                                                    {damage && (
                                                                        <>
                                                                            {" "}
                                                                            This fine is related to a{" "}
                                                                            <span className="font-semibold">
                                                                                book damage report
                                                                            </span>
                                                                            .
                                                                        </>
                                                                    )}
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>

                                                            <div className="mt-3 text-sm text-white/80 space-y-3">
                                                                <p>
                                                                    <span className="text-white/60">Fine ID:</span>{" "}
                                                                    {fine.id}
                                                                </p>
                                                                {fine.borrowRecordId && (
                                                                    <p>
                                                                        <span className="text-white/60">
                                                                            Borrow ID:
                                                                        </span>{" "}
                                                                        {fine.borrowRecordId}
                                                                    </p>
                                                                )}

                                                                {/* Payment details from librarian */}
                                                                <div className="mt-2 rounded-md border border-dashed border-emerald-500/40 bg-emerald-500/5 p-3 text-xs space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <CreditCard className="h-4 w-4 text-emerald-300" />
                                                                        <span className="font-semibold text-emerald-200">
                                                                            Send payment via e-wallet
                                                                        </span>
                                                                    </div>

                                                                    {paymentConfigLoading ? (
                                                                        <p className="flex items-center gap-2 text-white/70">
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                            Loading payment details…
                                                                        </p>
                                                                    ) : paymentConfig &&
                                                                        (paymentConfig.eWalletPhone ||
                                                                            paymentConfig.qrCodeUrl) ? (
                                                                        <>
                                                                            {paymentConfig.eWalletPhone && (
                                                                                <p>
                                                                                    <span className="text-white/60">
                                                                                        E-wallet number:
                                                                                    </span>{" "}
                                                                                    <span className="font-mono text-sm">
                                                                                        {paymentConfig.eWalletPhone}
                                                                                    </span>
                                                                                </p>
                                                                            )}
                                                                            {paymentConfig.qrCodeUrl && (
                                                                                <div className="mt-2 flex flex-col sm:flex-row gap-3 sm:items-start">
                                                                                    <div className="flex-1 text-[11px] text-white/70 space-y-1">
                                                                                        <p className="flex items-center gap-1">
                                                                                            <QrCode className="h-3 w-3" />
                                                                                            <span>
                                                                                                Scan this QR in your e-wallet
                                                                                                app, then take a screenshot of
                                                                                                the successful payment.
                                                                                            </span>
                                                                                        </p>
                                                                                        <Button
                                                                                            type="button"
                                                                                            size="sm"
                                                                                            variant="outline"
                                                                                            className="mt-1 text-xs"
                                                                                            asChild
                                                                                        >
                                                                                            <a
                                                                                                href={paymentConfig.qrCodeUrl}
                                                                                                target="_blank"
                                                                                                rel="noreferrer"
                                                                                                download
                                                                                            >
                                                                                                <Download className="h-3 w-3 mr-1" />
                                                                                                Download QR image
                                                                                            </a>
                                                                                        </Button>
                                                                                    </div>
                                                                                    <div className="w-28 h-28 rounded border border-white/15 bg-black/30 flex items-center justify-center overflow-hidden">
                                                                                        <img
                                                                                            src={paymentConfig.qrCodeUrl}
                                                                                            alt="E-wallet QR code"
                                                                                            className="max-h-full max-w-full object-contain"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <p className="text-amber-200/90">
                                                                            Payment details have not been configured
                                                                            yet. Please contact the librarian or pay
                                                                            in person at the library counter.
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Payment method selection */}
                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-white/80 flex items-center gap-1">
                                                                        <CreditCard className="h-3 w-3" />
                                                                        Payment method used
                                                                    </label>
                                                                    <Select
                                                                        value={
                                                                            selectedPaymentMethodFineId === fine.id
                                                                                ? selectedPaymentMethod
                                                                                : "gcash"
                                                                        }
                                                                        onValueChange={(v) => {
                                                                            const next = v as PaymentMethod;
                                                                            setSelectedPaymentMethodFineId(fine.id);
                                                                            setSelectedPaymentMethod(next);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-8 w-full bg-slate-900/70 border-white/20 text-xs text-white">
                                                                            <SelectValue placeholder="Select a payment method" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-slate-900 text-white border-white/10 text-xs">
                                                                            <SelectItem value="gcash">GCash</SelectItem>
                                                                            <SelectItem value="maya">Maya</SelectItem>
                                                                            <SelectItem value="bank_transfer">
                                                                                Bank transfer / deposit
                                                                            </SelectItem>
                                                                            <SelectItem value="other">
                                                                                Other online method
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <p className="text-[11px] text-white/50">
                                                                        This information is saved together with your
                                                                        receipt so the librarian can see how you paid.
                                                                    </p>
                                                                </div>

                                                                {/* Upload screenshot / receipt */}
                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-white/80 flex items-center gap-1">
                                                                        <UploadCloud className="h-3 w-3" />
                                                                        Upload payment receipt / screenshot{" "}
                                                                        <span className="text-red-300">*</span>
                                                                    </label>
                                                                    <Input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="bg-slate-900/70 border-white/20 text-xs text-white file:text-xs file:text-white file:bg-slate-700 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0] ?? null;
                                                                            setSelectedProofFineId(fine.id);
                                                                            setSelectedProofFile(file);

                                                                            if (file) {
                                                                                setSelectedProofPreviewUrl((prev) => {
                                                                                    if (prev)
                                                                                        URL.revokeObjectURL(prev);
                                                                                    return URL.createObjectURL(file);
                                                                                });
                                                                            } else {
                                                                                setSelectedProofPreviewUrl((prev) => {
                                                                                    if (prev)
                                                                                        URL.revokeObjectURL(prev);
                                                                                    return null;
                                                                                });
                                                                            }
                                                                        }}
                                                                    />
                                                                    {selectedProofFile &&
                                                                        selectedProofFineId === fine.id && (
                                                                            <div className="mt-2 flex items-start gap-3">
                                                                                {selectedProofPreviewUrl && (
                                                                                    <div className="w-24 h-24 rounded border border-white/15 bg-black/30 flex items-center justify-center overflow-hidden">
                                                                                        <img
                                                                                            src={selectedProofPreviewUrl}
                                                                                            alt="Selected payment receipt preview"
                                                                                            className="max-h-full max-w-full object-contain"
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                                <div className="text-[11px] text-white/60 space-y-1">
                                                                                    <p className="break-all">
                                                                                        <span className="font-semibold">
                                                                                            Selected file:
                                                                                        </span>{" "}
                                                                                        {selectedProofFile.name}
                                                                                    </p>
                                                                                    <p>
                                                                                        To modify, just choose another
                                                                                        image using the upload field above.
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    <p className="text-[11px] text-amber-200/90">
                                                                        Uploading a clear screenshot or photo of your
                                                                        successful payment is{" "}
                                                                        <span className="font-semibold">
                                                                            required
                                                                        </span>{" "}
                                                                        before your payment can be submitted for
                                                                        verification.
                                                                    </p>
                                                                    <p className="text-[11px] text-white/50">
                                                                        The librarian will use this receipt and your
                                                                        selected payment method to verify your payment
                                                                        before marking the fine as{" "}
                                                                        <span className="font-semibold text-emerald-200">
                                                                            Paid
                                                                        </span>
                                                                        .
                                                                    </p>
                                                                </div>

                                                                <p className="text-[11px] text-white/70 pt-1">
                                                                    Once you confirm, this fine will be marked as{" "}
                                                                    <span className="font-semibold">
                                                                        Pending verification
                                                                    </span>
                                                                    . A librarian will verify your payment and
                                                                    then mark it as{" "}
                                                                    <span className="font-semibold text-emerald-200">
                                                                        Paid
                                                                    </span>
                                                                    .
                                                                </p>
                                                            </div>

                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel
                                                                    className="border-white/20 text-white hover:bg-black/20"
                                                                    disabled={payBusyId === fine.id}
                                                                >
                                                                    Cancel
                                                                </AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                    disabled={
                                                                        payBusyId === fine.id || !hasRequiredProof
                                                                    }
                                                                    onClick={() => void handlePayFine(fine)}
                                                                >
                                                                    {payBusyId === fine.id ? (
                                                                        <span className="inline-flex items-center gap-2">
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                            Paying…
                                                                        </span>
                                                                    ) : (
                                                                        "Confirm online payment"
                                                                    )}
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}

                                                {/* Pending verification: view + update proofs & method */}
                                                {fine.status === "pending_verification" && (
                                                    <AlertDialog
                                                        onOpenChange={(open) => {
                                                            if (open) {
                                                                setSelectedProofFineId(fine.id);
                                                                setSelectedProofFile(null);
                                                                setSelectedProofPreviewUrl((prev) => {
                                                                    if (prev) URL.revokeObjectURL(prev);
                                                                    return null;
                                                                });
                                                                void handleLoadProofs(fine.id);
                                                            } else {
                                                                if (selectedProofFineId === fine.id) {
                                                                    setSelectedProofFineId(null);
                                                                    setSelectedProofFile(null);
                                                                    setSelectedProofPreviewUrl((prev) => {
                                                                        if (prev) URL.revokeObjectURL(prev);
                                                                        return null;
                                                                    });
                                                                }
                                                                if (selectedPaymentMethodFineId === fine.id) {
                                                                    setSelectedPaymentMethodFineId(null);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-amber-400/50 text-amber-200/90 w-full md:w-auto"
                                                            >
                                                                Payment pending – view / update
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent
                                                            className={
                                                                "bg-slate-900 border-white/10 text-white max-h-[90vh] " +
                                                                dialogScrollbarClasses
                                                            }
                                                        >
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Payment pending verification
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription className="text-white/70">
                                                                    Your payment for this fine has been submitted and
                                                                    is waiting for a librarian to verify it. You can
                                                                    review the receipts you uploaded and upload a new
                                                                    one if needed.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>

                                                            <div className="mt-3 text-sm text-white/80 space-y-3">
                                                                <p>
                                                                    <span className="text-white/60">Fine ID:</span>{" "}
                                                                    {fine.id}
                                                                </p>
                                                                {fine.borrowRecordId && (
                                                                    <p>
                                                                        <span className="text-white/60">
                                                                            Borrow ID:
                                                                        </span>{" "}
                                                                        {fine.borrowRecordId}
                                                                    </p>
                                                                )}
                                                                <p>
                                                                    <span className="text-white/60">Amount:</span>{" "}
                                                                    <span className="font-semibold text-red-300">
                                                                        {peso(amount)}
                                                                    </span>
                                                                </p>
                                                                {fine.bookTitle && (
                                                                    <p>
                                                                        <span className="text-white/60">
                                                                            Book:
                                                                        </span>{" "}
                                                                        {fine.bookTitle}
                                                                    </p>
                                                                )}
                                                                {damage && (
                                                                    <p className="text-xs text-rose-200/90">
                                                                        This fine is linked to a{" "}
                                                                        <span className="font-semibold">
                                                                            book damage report
                                                                        </span>
                                                                        .
                                                                    </p>
                                                                )}

                                                                {/* Existing proofs */}
                                                                <div className="mt-2 rounded-md border border-dashed border-emerald-500/40 bg-emerald-500/5 p-3 text-xs space-y-2">
                                                                    <div className="font-semibold text-emerald-200 mb-1">
                                                                        Your uploaded receipts
                                                                    </div>
                                                                    {proofsLoadingForId === fine.id ? (
                                                                        <div className="flex items-center gap-2 text-white/70">
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                            Loading your receipts…
                                                                        </div>
                                                                    ) : proofsForFine.length ? (
                                                                        <div className="space-y-3">
                                                                            {proofsForFine.map((proof) => (
                                                                                <div
                                                                                    key={proof.id}
                                                                                    className="border border-white/15 rounded-md p-2 bg-black/20"
                                                                                >
                                                                                    <div className="flex items-center justify-between text-[11px] text-white/60 mb-1">
                                                                                        <span>
                                                                                            Receipt #{proof.id}
                                                                                        </span>
                                                                                        <span>
                                                                                            {proof.uploadedAt
                                                                                                ? new Date(
                                                                                                    proof.uploadedAt
                                                                                                ).toLocaleString()
                                                                                                : "—"}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="w-full flex justify-center">
                                                                                        <img
                                                                                            src={proof.imageUrl}
                                                                                            alt={`Uploaded receipt ${proof.id}`}
                                                                                            className="max-h-64 w-auto object-contain rounded"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="mt-2">
                                                                                        <a
                                                                                            href={proof.imageUrl}
                                                                                            target="_blank"
                                                                                            rel="noreferrer"
                                                                                            className="text-xs underline text-emerald-300 hover:text-emerald-200"
                                                                                        >
                                                                                            Open full image
                                                                                        </a>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-amber-200/90">
                                                                            No receipts are recorded yet for this fine.
                                                                            You can upload one below.
                                                                        </p>
                                                                    )}
                                                                    <p className="text-[11px] text-white/60 pt-1">
                                                                        The librarian will see all of your uploaded
                                                                        receipts when verifying your payment.
                                                                    </p>
                                                                </div>

                                                                {/* Payment method for new upload */}
                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-white/80 flex items-center gap-1">
                                                                        <CreditCard className="h-3 w-3" />
                                                                        Payment method to save with new receipt
                                                                    </label>
                                                                    <Select
                                                                        value={
                                                                            selectedPaymentMethodFineId === fine.id
                                                                                ? selectedPaymentMethod
                                                                                : "gcash"
                                                                        }
                                                                        onValueChange={(v) => {
                                                                            const next = v as PaymentMethod;
                                                                            setSelectedPaymentMethodFineId(fine.id);
                                                                            setSelectedPaymentMethod(next);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-8 w-full bg-slate-900/70 border-white/20 text-xs text-white">
                                                                            <SelectValue placeholder="Select a payment method" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-slate-900 text-white border-white/10 text-xs">
                                                                            <SelectItem value="gcash">GCash</SelectItem>
                                                                            <SelectItem value="maya">Maya</SelectItem>
                                                                            <SelectItem value="bank_transfer">
                                                                                Bank transfer / deposit
                                                                            </SelectItem>
                                                                            <SelectItem value="other">
                                                                                Other online method
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <p className="text-[11px] text-white/50">
                                                                        This applies to the{" "}
                                                                        <span className="font-semibold">
                                                                            new
                                                                        </span>{" "}
                                                                        receipt you upload. The librarian will see the
                                                                        method together with the image.
                                                                    </p>
                                                                </div>

                                                                {/* Upload NEW screenshot / receipt while pending */}
                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-white/80 flex items-center gap-1">
                                                                        <UploadCloud className="h-3 w-3" />
                                                                        Upload a new receipt / screenshot
                                                                    </label>
                                                                    <Input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="bg-slate-900/70 border-white/20 text-xs text-white file:text-xs file:text-white file:bg-slate-700 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0] ?? null;
                                                                            setSelectedProofFineId(fine.id);
                                                                            setSelectedProofFile(file);

                                                                            if (file) {
                                                                                setSelectedProofPreviewUrl((prev) => {
                                                                                    if (prev)
                                                                                        URL.revokeObjectURL(prev);
                                                                                    return URL.createObjectURL(file);
                                                                                });
                                                                            } else {
                                                                                setSelectedProofPreviewUrl((prev) => {
                                                                                    if (prev)
                                                                                        URL.revokeObjectURL(prev);
                                                                                    return null;
                                                                                });
                                                                            }
                                                                        }}
                                                                    />
                                                                    {selectedProofFile &&
                                                                        selectedProofFineId === fine.id && (
                                                                            <div className="mt-2 flex items-start gap-3">
                                                                                {selectedProofPreviewUrl && (
                                                                                    <div className="w-24 h-24 rounded border border-white/15 bg-black/30 flex items-center justify-center overflow-hidden">
                                                                                        <img
                                                                                            src={selectedProofPreviewUrl}
                                                                                            alt="New receipt preview"
                                                                                            className="max-h-full max-w-full object-contain"
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                                <div className="text-[11px] text-white/60 space-y-1">
                                                                                    <p className="break-all">
                                                                                        <span className="font-semibold">
                                                                                            Selected file:
                                                                                        </span>{" "}
                                                                                        {selectedProofFile.name}
                                                                                    </p>
                                                                                    <p>
                                                                                        To change it again, choose another
                                                                                        image using the upload field above.
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    <p className="text-[11px] text-white/50">
                                                                        Upload a new image if your previous receipt was
                                                                        incorrect, unclear, or if you used the wrong
                                                                        payment method. The fine will remain{" "}
                                                                        <span className="font-semibold">
                                                                            Pending verification
                                                                        </span>{" "}
                                                                        until a librarian reviews it.
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="border-white/20 text-white hover:bg-black/20">
                                                                    Close
                                                                </AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                    disabled={
                                                                        pendingUpdateBusyId === fine.id ||
                                                                        !(
                                                                            selectedProofFineId === fine.id &&
                                                                            selectedProofFile
                                                                        )
                                                                    }
                                                                    onClick={() =>
                                                                        void handleUploadAdditionalProof(fine)
                                                                    }
                                                                >
                                                                    {pendingUpdateBusyId === fine.id ? (
                                                                        <span className="inline-flex items-center gap-2">
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                            Uploading…
                                                                        </span>
                                                                    ) : (
                                                                        "Upload new receipt"
                                                                    )}
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}

                                                {fine.status === "paid" && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        disabled
                                                        className="border-emerald-400/50 text-emerald-200/90 w-full md:w-auto"
                                                    >
                                                        Fine paid
                                                    </Button>
                                                )}

                                                {fine.status === "cancelled" && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        disabled
                                                        className="border-slate-400/50 text-slate-200/90 w-full md:w-auto"
                                                    >
                                                        Fine cancelled
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
