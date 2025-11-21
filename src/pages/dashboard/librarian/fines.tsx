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

import {
    ReceiptText,
    RefreshCcw,
    Loader2,
    Search,
    Clock3,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    QrCode,
    Download,
} from "lucide-react";
import { toast } from "sonner";

import {
    fetchFines,
    updateFine,
    fetchFineProofs,
    fetchPaymentConfig,
    savePaymentConfig,
    type FineDTO,
    type FineStatus,
    type FineProofDTO,
    type PaymentConfigDTO,
} from "@/lib/fines";

type StatusFilter = "all" | "unresolved" | FineStatus;

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

function fmtDateTime(d?: string | null) {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        return date.toLocaleString();
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

function statusWeight(status: FineStatus): number {
    switch (status) {
        case "active":
            return 0;
        case "pending_verification":
            return 1;
        case "paid":
            return 2;
        case "cancelled":
            return 3;
        default:
            return 4;
    }
}

/**
 * Turn the raw `kind` string stored with each payment proof
 * into something readable for librarians.
 */
function formatProofKind(kind: string | null | undefined): string {
    if (!kind) return "Not specified";
    const k = kind.toLowerCase();

    if (k === "student_payment") {
        return "Student payment (method not specified)";
    }

    if (k === "student_payment:gcash" || k === "gcash") {
        return "Online – GCash";
    }

    if (k === "student_payment:maya" || k === "maya") {
        return "Online – Maya";
    }

    if (k === "student_payment:bank_transfer" || k === "bank_transfer") {
        return "Online – Bank transfer / deposit";
    }

    if (k === "student_payment:other" || k === "other") {
        return "Online – Other method";
    }

    // Fallback – show the raw value if it's something custom
    return kind;
}

export default function LibrarianFinesPage() {
    const [fines, setFines] = React.useState<FineDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] =
        React.useState<StatusFilter>("unresolved");
    const [updateBusyId, setUpdateBusyId] = React.useState<string | null>(null);

    // Payment settings (global e-wallet + QR)
    const [paymentConfig, setPaymentConfig] =
        React.useState<PaymentConfigDTO | null>(null);
    const [paymentSettingsLoading, setPaymentSettingsLoading] =
        React.useState(false);
    const [savingPaymentSettings, setSavingPaymentSettings] =
        React.useState(false);
    const [eWalletPhoneInput, setEWalletPhoneInput] = React.useState("");
    const [qrFile, setQrFile] = React.useState<File | null>(null);

    // Proofs (payment screenshots)
    const [proofsByFineId, setProofsByFineId] = React.useState<
        Record<string, FineProofDTO[]>
    >({});
    const [proofsLoadingForId, setProofsLoadingForId] = React.useState<
        string | null
    >(null);

    const loadFines = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchFines();
            setFines(data);
        } catch (err: any) {
            const msg = err?.message || "Failed to load fines.";
            setError(msg);
            toast.error("Failed to load fines", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    const loadPaymentSettings = React.useCallback(async () => {
        setPaymentSettingsLoading(true);
        try {
            const cfg = await fetchPaymentConfig();
            setPaymentConfig(cfg);
            setEWalletPhoneInput(cfg?.eWalletPhone || "");
        } catch (err: any) {
            const msg =
                err?.message || "Failed to load e-wallet payment configuration.";
            toast.error("Failed to load payment settings", { description: msg });
        } finally {
            setPaymentSettingsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadFines();
        void loadPaymentSettings();
    }, [loadFines, loadPaymentSettings]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await loadFines();
        } finally {
            setRefreshing(false);
        }
    }

    async function handleSavePaymentSettings() {
        setSavingPaymentSettings(true);
        try {
            const cfg = await savePaymentConfig(eWalletPhoneInput.trim(), qrFile);
            setPaymentConfig(cfg);
            setEWalletPhoneInput(cfg.eWalletPhone || "");
            setQrFile(null);
            toast.success("Payment settings saved", {
                description:
                    "Students will now see this e-wallet number and QR code when paying fines.",
            });
        } catch (err: any) {
            const msg =
                err?.message || "Failed to save e-wallet payment configuration.";
            toast.error("Could not save settings", { description: msg });
        } finally {
            setSavingPaymentSettings(false);
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
        } catch (err: any) {
            const msg =
                err?.message || "Failed to load payment proof images for this fine.";
            toast.error("Could not load proofs", { description: msg });
        } finally {
            setProofsLoadingForId(null);
        }
    }

    const filtered = React.useMemo(() => {
        let rows = [...fines];

        if (statusFilter === "unresolved") {
            rows = rows.filter(
                (f) => f.status === "active" || f.status === "pending_verification"
            );
        } else if (statusFilter !== "all") {
            rows = rows.filter((f) => f.status === statusFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter((f) => {
                const haystack = `${f.id} ${f.studentName ?? ""} ${f.studentEmail ?? ""} ${f.studentId ?? ""
                    } ${f.bookTitle ?? ""} ${f.bookId ?? ""} ${f.reason ?? ""}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        // Group by status, then newest first
        return rows.sort((a, b) => {
            const sa = statusWeight(a.status);
            const sb = statusWeight(b.status);
            if (sa !== sb) return sa - sb;
            return b.createdAt.localeCompare(a.createdAt);
        });
    }, [fines, statusFilter, search]);

    const stats = React.useMemo(() => {
        let activeCount = 0;
        let pendingCount = 0;
        let paidCount = 0;
        let cancelledCount = 0;
        let activeTotal = 0;
        let pendingTotal = 0;

        for (const f of fines) {
            const amt = normalizeFine(f.amount);
            switch (f.status) {
                case "active":
                    activeCount += 1;
                    if (amt > 0) activeTotal += amt;
                    break;
                case "pending_verification":
                    pendingCount += 1;
                    if (amt > 0) pendingTotal += amt;
                    break;
                case "paid":
                    paidCount += 1;
                    break;
                case "cancelled":
                    cancelledCount += 1;
                    break;
                default:
                    break;
            }
        }

        return {
            activeCount,
            pendingCount,
            paidCount,
            cancelledCount,
            activeTotal,
            pendingTotal,
        };
    }, [fines]);

    async function handleUpdateStatus(
        fine: FineDTO,
        newStatus: FineStatus,
        opts?: { successTitle?: string; successDescription?: string }
    ) {
        if (fine.status === newStatus) return;

        setUpdateBusyId(fine.id);
        try {
            const updated = await updateFine(fine.id, { status: newStatus });

            setFines((prev) =>
                prev.map((f) => (f.id === updated.id ? updated : f))
            );

            toast.success(opts?.successTitle ?? "Fine updated", {
                description: opts?.successDescription,
            });
        } catch (err: any) {
            const msg = err?.message || "Failed to update fine.";
            toast.error("Update failed", { description: msg });
        } finally {
            setUpdateBusyId(null);
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

    // Reusable scrollbar styling for dark, thin horizontal scrollbars
    const cellScrollbarClasses =
        "overflow-x-auto whitespace-nowrap " +
        "[scrollbar-width:thin] [scrollbar-color:#111827_transparent] " +
        "[&::-webkit-scrollbar]:h-1.5 " +
        "[&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

    return (
        <DashboardLayout title="Fines">
            {/* Global payment config (e-wallet + QR) */}
            <Card className="mb-4 bg-slate-800/70 border-emerald-500/30">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="flex items-start gap-2">
                            <QrCode className="h-5 w-5 mt-0.5 text-emerald-300" />
                            <div>
                                <CardTitle className="text-base">
                                    E-wallet payment settings
                                </CardTitle>
                                <p className="text-xs text-white/70">
                                    Set the e-wallet phone number and QR code students will use
                                    when paying their fines online. This information is displayed
                                    in the student &ldquo;Pay fine&rdquo; dialog.
                                </p>
                            </div>
                        </div>
                        <div className="text-xs text-white/70 flex items-center gap-2">
                            {paymentSettingsLoading ? (
                                <span className="inline-flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Loading payment settings…
                                </span>
                            ) : paymentConfig?.eWalletPhone || paymentConfig?.qrCodeUrl ? (
                                <span>
                                    Payment channel is{" "}
                                    <span className="font-semibold text-emerald-200">
                                        configured
                                    </span>
                                </span>
                            ) : (
                                <span className="text-amber-200/90">
                                    No payment details configured yet.
                                </span>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-1">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)]">
                        <div className="space-y-2">
                            <label className="text-xs text-white/80">
                                E-wallet phone number
                            </label>
                            <Input
                                value={eWalletPhoneInput}
                                onChange={(e) => setEWalletPhoneInput(e.target.value)}
                                placeholder="09xx-xxx-xxxx"
                                className="bg-slate-900/70 border-white/20 text-white text-sm"
                            />
                            <p className="text-[11px] text-white/60">
                                Example: the mobile number linked to your GCash or Maya account.
                                This will be shown to students together with the QR code.
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={savingPaymentSettings || paymentSettingsLoading}
                                    onClick={() => void handleSavePaymentSettings()}
                                >
                                    {savingPaymentSettings ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving…
                                        </span>
                                    ) : (
                                        "Save payment settings"
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs text-white/70"
                                    disabled={savingPaymentSettings}
                                    onClick={() => {
                                        setEWalletPhoneInput(paymentConfig?.eWalletPhone || "");
                                        setQrFile(null);
                                    }}
                                >
                                    Reset changes
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-white/80 flex items-center gap-1">
                                <QrCode className="h-4 w-4" />
                                Payment QR code image
                            </label>
                            <Input
                                type="file"
                                accept="image/*"
                                className="bg-slate-900/70 border-white/20 text-xs text-white file:text-xs file:text-white file:bg-slate-700 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    setQrFile(file);
                                }}
                            />
                            {qrFile && (
                                <p className="text-[11px] text-white/60">
                                    Selected new QR:{" "}
                                    <span className="font-semibold">{qrFile.name}</span>
                                </p>
                            )}
                            {paymentConfig?.qrCodeUrl && (
                                <div className="mt-2 flex gap-3 items-center">
                                    <div className="w-24 h-24 rounded border border-white/15 bg-black/30 flex items-center justify-center overflow-hidden">
                                        <img
                                            src={paymentConfig.qrCodeUrl}
                                            alt="Current payment QR code"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    </div>
                                    <div className="text-[11px] text-white/70 space-y-1">
                                        <p>Current QR code students see when paying fines.</p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="text-xs"
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
                                </div>
                            )}
                            {!paymentConfig?.qrCodeUrl &&
                                !qrFile &&
                                !paymentSettingsLoading && (
                                    <p className="text-[11px] text-amber-200/90">
                                        No QR code uploaded yet. Students will still see the e-wallet
                                        number, but uploading a QR makes it easier for them to pay
                                        online.
                                    </p>
                                )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <ReceiptText className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">
                            Fines &amp; payment verification
                        </h2>
                        <p className="text-xs text-white/70">
                            Review all fines across users, confirm payments (online or over the
                            counter), and keep circulation balances accurate.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-200/90">
                            Use this page to verify{" "}
                            <span className="font-semibold">pending verification</span> fines
                            after a student or other user submits payment and a screenshot.
                            Confirming a payment marks the fine as{" "}
                            <span className="font-semibold text-emerald-200">Paid</span>, or
                            you can revert it back to{" "}
                            <span className="font-semibold">Active</span> or{" "}
                            <span className="font-semibold">Cancelled</span> if needed. You can
                            also mark fines as paid directly for{" "}
                            <span className="font-semibold">over-the-counter</span> payments.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-white/70">
                    <div className="flex flex-col items-start sm:items-end">
                        <span>
                            Active fines:{" "}
                            <span className="font-semibold text-amber-300">
                                {stats.activeCount} ({peso(stats.activeTotal)})
                            </span>
                        </span>
                        <span>
                            Pending verification:{" "}
                            <span className="font-semibold text-emerald-200">
                                {stats.pendingCount} ({peso(stats.pendingTotal)})
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
                    {/* Controls row */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <CardTitle>All fines</CardTitle>

                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                            {/* Search */}
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by user, book, or reason…"
                                    className="pl-9 bg-slate-900/70 border-white/20 text-white"
                                />
                            </div>

                            {/* Status filter */}
                            <div className="w-full md:w-60">
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                                >
                                    <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10">
                                        <SelectItem value="unresolved">
                                            Unresolved (Active + Pending)
                                        </SelectItem>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active only</SelectItem>
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
                            No fines matched your filters.
                            <br />
                            <span className="text-xs opacity-80">
                                Try clearing the search or changing the status filter.
                            </span>
                        </div>
                    ) : (
                        <Table>
                            <TableCaption className="text-xs text-white/60">
                                Showing {filtered.length}{" "}
                                {filtered.length === 1 ? "fine" : "fines"}. Use the actions on
                                each row to confirm payments or adjust statuses as needed.
                            </TableCaption>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="w-[70px] text-xs font-semibold text-white/70">
                                        Fine ID
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        User
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Book
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Status
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        ₱Amount
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Created
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Resolved
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((fine) => {
                                    const amount = normalizeFine(fine.amount);
                                    const busy = updateBusyId === fine.id;
                                    const proofsForFine: FineProofDTO[] =
                                        proofsByFineId[fine.id] || [];

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
                                                        {fine.studentName ||
                                                            fine.studentEmail ||
                                                            "—"}
                                                    </span>
                                                    {(fine.studentId || fine.studentEmail) && (
                                                        <span className="text-xs text-white/70">
                                                            {fine.studentId && (
                                                                <>
                                                                    ID: {fine.studentId}
                                                                    {fine.studentEmail && " · "}
                                                                </>
                                                            )}
                                                            {fine.studentEmail}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell
                                                className={
                                                    "text-sm align-top w-[100px] max-w-[100px] " +
                                                    cellScrollbarClasses
                                                }
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <span>
                                                        {fine.bookTitle ? (
                                                            fine.bookTitle
                                                        ) : fine.bookId ? (
                                                            <>Book #{fine.bookId}</>
                                                        ) : (
                                                            <span className="opacity-60">—</span>
                                                        )}
                                                    </span>
                                                    {fine.borrowRecordId && (
                                                        <span className="text-xs text-white/70">
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
                                                                    · Returned {fmtDate(
                                                                        fine.borrowReturnDate
                                                                    )}
                                                                </>
                                                            )}
                                                        </span>
                                                    )}
                                                    {fine.reason && (
                                                        <span className="text-xs text-white/70">
                                                            {fine.reason}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{renderStatusBadge(fine.status)}</TableCell>
                                            <TableCell className="text-sm">
                                                {peso(amount)}
                                            </TableCell>
                                            <TableCell className="text-xs opacity-80">
                                                {fmtDate(fine.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-xs opacity-80">
                                                {fine.resolvedAt ? fmtDate(fine.resolvedAt) : "—"}
                                            </TableCell>
                                            <TableCell
                                                className={
                                                    "text-right w-[130px] max-w-[140px] " +
                                                    cellScrollbarClasses
                                                }
                                            >
                                                {/* Horizontal actions with spacing and scroll */}
                                                <div className="inline-flex items-center justify-end gap-2 min-w-max">
                                                    {/* Actions for pending_verification */}
                                                    {fine.status === "pending_verification" && (
                                                        <>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                        disabled={busy}
                                                                    >
                                                                        {busy ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Saving…
                                                                            </span>
                                                                        ) : (
                                                                            "Confirm payment"
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>
                                                                            Confirm payment for this fine?
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            This will mark the fine for{" "}
                                                                            <span className="font-semibold">
                                                                                {fine.studentName ||
                                                                                    fine.studentEmail ||
                                                                                    `User #${fine.userId}`}
                                                                            </span>{" "}
                                                                            as{" "}
                                                                            <span className="font-semibold text-emerald-200">
                                                                                Paid
                                                                            </span>
                                                                            .
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <div className="mt-3 text-sm text-white/80 space-y-1">
                                                                        <p>
                                                                            <span className="text-white/60">
                                                                                Amount:
                                                                            </span>{" "}
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
                                                                    </div>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel
                                                                            className="border-white/20 text-white hover:bg-black/20"
                                                                            disabled={busy}
                                                                        >
                                                                            Cancel
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                            disabled={busy}
                                                                            onClick={() =>
                                                                                void handleUpdateStatus(
                                                                                    fine,
                                                                                    "paid",
                                                                                    {
                                                                                        successTitle:
                                                                                            "Payment verified",
                                                                                        successDescription:
                                                                                            "The fine has been marked as paid.",
                                                                                    }
                                                                                )
                                                                            }
                                                                        >
                                                                            {busy ? (
                                                                                <span className="inline-flex items-center gap-2">
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    Saving…
                                                                                </span>
                                                                            ) : (
                                                                                "Confirm"
                                                                            )}
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>

                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="border-amber-400/50 text-amber-200/80"
                                                                        disabled={busy}
                                                                    >
                                                                        {busy ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Saving…
                                                                            </span>
                                                                        ) : (
                                                                            "Reject payment"
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>
                                                                            Reject this payment?
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            This will move the fine back to{" "}
                                                                            <span className="font-semibold">
                                                                                Active (unpaid)
                                                                            </span>
                                                                            . Use this when the reported payment
                                                                            cannot be verified.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel
                                                                            className="border-white/20 text-white hover:bg-black/20"
                                                                            disabled={busy}
                                                                        >
                                                                            Cancel
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-amber-600 hover:bg-amber-700 text-white"
                                                                            disabled={busy}
                                                                            onClick={() =>
                                                                                void handleUpdateStatus(
                                                                                    fine,
                                                                                    "active",
                                                                                    {
                                                                                        successTitle:
                                                                                            "Payment rejected",
                                                                                        successDescription:
                                                                                            "The fine has been moved back to Active.",
                                                                                    }
                                                                                )
                                                                            }
                                                                        >
                                                                            {busy ? (
                                                                                <span className="inline-flex items-center gap-2">
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    Saving…
                                                                                </span>
                                                                            ) : (
                                                                                "Move back to Active"
                                                                            )}
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>

                                                            {/* View proofs */}
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="border-emerald-400/60 text-emerald-200/80"
                                                                        onClick={() => void handleLoadProofs(fine.id)}
                                                                    >
                                                                        {proofsLoadingForId === fine.id ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Loading proofs…
                                                                            </span>
                                                                        ) : (
                                                                            "View proof images"
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white max-h-[80vh] overflow-y-auto">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>
                                                                            Payment proof for fine {fine.id}
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            Screenshots or receipts uploaded by the
                                                                            student will appear below. Use these to
                                                                            verify the payment before confirming.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <div className="mt-3 space-y-3">
                                                                        {proofsLoadingForId === fine.id ? (
                                                                            <div className="flex items-center justify-center py-6 text-sm text-white/70">
                                                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                                                Loading proofs…
                                                                            </div>
                                                                        ) : proofsForFine.length ? (
                                                                            proofsForFine.map((proof) => (
                                                                                <div
                                                                                    key={proof.id}
                                                                                    className="border border-white/15 rounded-md p-2 bg-black/20"
                                                                                >
                                                                                    <div className="flex items-center justify-between text-[11px] text-white/60 mb-1">
                                                                                        <span>Proof #{proof.id}</span>
                                                                                        <span>
                                                                                            {fmtDateTime(proof.uploadedAt)}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="text-[11px] text-emerald-200 mb-2">
                                                                                        Payment method:{" "}
                                                                                        <span className="font-semibold">
                                                                                            {formatProofKind(proof.kind)}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="w-full flex justify-center">
                                                                                        <img
                                                                                            src={proof.imageUrl}
                                                                                            alt={`Payment proof ${proof.id}`}
                                                                                            className="max-h-80 w-auto object-contain rounded"
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
                                                                            ))
                                                                        ) : (
                                                                            <p className="text-sm text-amber-200/90">
                                                                                No payment screenshots have been uploaded
                                                                                for this fine yet.
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogAction className="bg-slate-700 hover:bg-slate-600 text-white">
                                                                            Close
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    )}

                                                    {/* Actions for active fines (over-the-counter payments) */}
                                                    {fine.status === "active" && (
                                                        <>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                        disabled={busy}
                                                                    >
                                                                        {busy ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Saving…
                                                                            </span>
                                                                        ) : (
                                                                            "Mark as paid (OTC)"
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>
                                                                            Mark this fine as paid (over the counter)?
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            Use this when payment is taken in-person at
                                                                            the library counter and you want to record the
                                                                            fine as{" "}
                                                                            <span className="font-semibold text-emerald-200">
                                                                                Paid
                                                                            </span>
                                                                            .
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <div className="mt-3 text-sm text-white/80 space-y-1">
                                                                        <p>
                                                                            <span className="text-white/60">
                                                                                Amount:
                                                                            </span>{" "}
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
                                                                    </div>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel
                                                                            className="border-white/20 text-white hover:bg-black/20"
                                                                            disabled={busy}
                                                                        >
                                                                            Cancel
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                            disabled={busy}
                                                                            onClick={() =>
                                                                                void handleUpdateStatus(fine, "paid", {
                                                                                    successTitle:
                                                                                        "Fine marked as paid (over the counter)",
                                                                                    successDescription:
                                                                                        "The fine has been recorded as paid via over-the-counter payment.",
                                                                                })
                                                                            }
                                                                        >
                                                                            {busy ? (
                                                                                <span className="inline-flex items-center gap-2">
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    Saving…
                                                                                </span>
                                                                            ) : (
                                                                                "Confirm"
                                                                            )}
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>

                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="border-slate-400/50 text-slate-100"
                                                                        disabled={busy}
                                                                    >
                                                                        {busy ? (
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Saving…
                                                                            </span>
                                                                        ) : (
                                                                            "Cancel fine"
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>
                                                                            Cancel this fine?
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-white/70">
                                                                            This will mark the fine as{" "}
                                                                            <span className="font-semibold">
                                                                                Cancelled
                                                                            </span>{" "}
                                                                            and set its resolved date to now. Use this
                                                                            when the fine has been waived.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel
                                                                            className="border-white/20 text-white hover:bg-black/20"
                                                                            disabled={busy}
                                                                        >
                                                                            Keep fine
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-slate-500 hover:bg-slate-600 text-white"
                                                                            disabled={busy}
                                                                            onClick={() =>
                                                                                void handleUpdateStatus(
                                                                                    fine,
                                                                                    "cancelled",
                                                                                    {
                                                                                        successTitle: "Fine cancelled",
                                                                                        successDescription:
                                                                                            "The fine has been cancelled.",
                                                                                    }
                                                                                )
                                                                            }
                                                                        >
                                                                            {busy ? (
                                                                                <span className="inline-flex items-center gap-2">
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    Saving…
                                                                                </span>
                                                                            ) : (
                                                                                "Cancel fine"
                                                                            )}
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    )}

                                                    {/* No actions for paid/cancelled */}
                                                    {(fine.status === "paid" ||
                                                        fine.status === "cancelled") && (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                disabled
                                                                className="border-white/20 text-white/60"
                                                            >
                                                                No actions
                                                            </Button>
                                                        )}
                                                </div>
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
