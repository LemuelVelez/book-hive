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
    type FineDTO,
    type FineStatus,
    type PaymentConfigDTO,
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

export default function StudentFinesPage() {
    const [fines, setFines] = React.useState<FineDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
    const [payBusyId, setPayBusyId] = React.useState<string | null>(null);

    // Global payment config (e-wallet phone + QR)
    const [paymentConfig, setPaymentConfig] =
        React.useState<PaymentConfigDTO | null>(null);
    const [paymentConfigLoading, setPaymentConfigLoading] =
        React.useState<boolean>(false);

    // Selected payment screenshot (per fine)
    const [selectedProofFile, setSelectedProofFile] =
        React.useState<File | null>(null);
    const [selectedProofFineId, setSelectedProofFineId] =
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
                const haystack = `${f.id} ${f.reason ?? ""} ${f.bookTitle ?? ""} ${f.bookId ?? ""
                    }`.toLowerCase();
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

        setPayBusyId(fine.id);
        try {
            const updated = await requestFinePayment(fine.id);

            setFines((prev) =>
                prev.map((f) => (f.id === updated.id ? updated : f))
            );

            // Upload proof screenshot if selected for this fine
            if (selectedProofFile && selectedProofFineId === fine.id) {
                try {
                    await uploadFineProofImage(fine.id, selectedProofFile, {
                        kind: "student_payment",
                    });
                } catch (err: any) {
                    const msg =
                        err?.message ||
                        "Your payment was submitted but the screenshot upload failed. You can try again or contact the librarian.";
                    toast.error("Payment proof upload failed", { description: msg });
                } finally {
                    setSelectedProofFile(null);
                    setSelectedProofFineId(null);
                }
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
                            Review all fines linked to your account, see which are unpaid,
                            and track payment verification.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-200/90">
                            Fines marked as{" "}
                            <span className="font-semibold">Active</span> are unpaid. When
                            you pay from this page, the fine becomes{" "}
                            <span className="font-semibold">Pending verification</span> until
                            a librarian confirms the payment and marks it as{" "}
                            <span className="font-semibold">Paid</span>.
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
                                    placeholder="Search by book, reason, or ID…"
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
                                {filtered.length === 1 ? "fine" : "fines"}. Active fines can be
                                paid from this page. Payments move into{" "}
                                <span className="font-semibold">Pending verification</span>{" "}
                                until a librarian validates them.
                            </TableCaption>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                        Fine ID
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Book / Description
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
                                                {fine.status === "active" && (
                                                    <AlertDialog>
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

                                                        <AlertDialogContent className="bg-slate-900 border-white/10 text-white max-h-[90vh] overflow-y-auto">
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

                                                                {/* Upload screenshot */}
                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-white/80 flex items-center gap-1">
                                                                        <UploadCloud className="h-3 w-3" />
                                                                        Upload payment screenshot (optional but
                                                                        recommended)
                                                                    </label>
                                                                    <Input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="bg-slate-900/70 border-white/20 text-xs text-white file:text-xs file:text-white file:bg-slate-700 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0] ?? null;
                                                                            setSelectedProofFineId(fine.id);
                                                                            setSelectedProofFile(file);
                                                                        }}
                                                                    />
                                                                    {selectedProofFile &&
                                                                        selectedProofFineId === fine.id && (
                                                                            <p className="text-[11px] text-white/60">
                                                                                Selected:{" "}
                                                                                <span className="font-semibold">
                                                                                    {selectedProofFile.name}
                                                                                </span>
                                                                            </p>
                                                                        )}
                                                                    <p className="text-[11px] text-white/50">
                                                                        The librarian will use this screenshot to
                                                                        verify your payment before marking the fine
                                                                        as{" "}
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
                                                                    disabled={payBusyId === fine.id}
                                                                    onClick={() => void handlePayFine(fine)}
                                                                >
                                                                    {payBusyId === fine.id ? (
                                                                        <span className="inline-flex items-center gap-2">
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                            Paying…
                                                                        </span>
                                                                    ) : (
                                                                        "Confirm payment"
                                                                    )}
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}

                                                {fine.status === "pending_verification" && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        disabled
                                                        className="border-amber-400/50 text-amber-200/80 w-full md:w-auto"
                                                    >
                                                        Payment pending verification
                                                    </Button>
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
