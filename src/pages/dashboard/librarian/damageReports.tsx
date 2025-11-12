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
import { Loader2, RefreshCcw, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/api/auth/route";

/* ----------------------------- Types ----------------------------- */

type DamageStatus = "pending" | "assessed" | "paid";
type Severity = "minor" | "moderate" | "major";

export type DamageReportDTO = {
    id: string;
    userId: string | number;
    studentEmail: string | null;
    studentId: string | null;
    studentName?: string | null;
    bookId: string | number;
    bookTitle: string | null;

    // Core damage info
    damageType: string;      // e.g., Torn Pages, Water Damage
    severity: Severity;      // minor | moderate | major
    status: DamageStatus;    // pending | assessed | paid
    fee?: number;            // optional display
    notes?: string | null;   // optional display
    reportedAt?: string;     // optional display

    // New: uploaded picture
    photoUrl?: string | null; // may be absolute S3 URL now
};

type JsonOk<T> = { ok: true } & T;

/* ------------------------ Helpers (local) ------------------------ */

function peso(n: number | string | undefined) {
    if (n === undefined) return "—";
    const num = Number(n) || 0;
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
    }).format(num);
}

function StatusBadge({ status }: { status: DamageStatus }) {
    const map: Record<DamageStatus, string> = {
        pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
        assessed: "bg-blue-500/15 text-blue-300 border-blue-500/20",
        paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    };
    const label = status[0].toUpperCase() + status.slice(1);
    return (
        <Badge variant="outline" className={map[status]}>
            {label}
        </Badge>
    );
}

function SeverityBadge({ severity }: { severity: Severity }) {
    const map: Record<Severity, string> = {
        minor: "bg-sky-500/15 text-sky-300 border-sky-500/20",
        moderate: "bg-orange-500/15 text-orange-300 border-orange-500/20",
        major: "bg-red-500/15 text-red-300 border-red-500/20",
    };
    const label = severity[0].toUpperCase() + severity.slice(1);
    return (
        <Badge variant="outline" className={map[severity]}>
            {label}
        </Badge>
    );
}

function formatDamageInfo(r: DamageReportDTO) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.damageType}</span>
                <SeverityBadge severity={r.severity} />
                <StatusBadge status={r.status} />
            </div>
            <div className="text-xs text-white/70">
                {r.fee !== undefined && (
                    <span className="mr-3">Fee: {peso(r.fee)}</span>
                )}
                {r.reportedAt && (
                    <span className="mr-3">
                        Reported: {new Date(r.reportedAt).toLocaleString()}
                    </span>
                )}
                {r.notes && <span className="block truncate">Notes: {r.notes}</span>}
            </div>
        </div>
    );
}

/** Resolves image URL.
 * - If backend stores absolute S3 URL -> return as-is
 * - If legacy relative path (/uploads/..) -> prefix API_BASE
 */
function toAbsoluteUrl(url?: string | null) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url; // S3/CloudFront/etc.
    return `${API_BASE}${url}`;
}

// Light client-side fetcher (kept local so we don't add new lib files)
async function fetchDamageReports(): Promise<DamageReportDTO[]> {
    let resp: Response;
    try {
        resp = await fetch(`${API_BASE}/api/damage-reports`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        });
    } catch (e: any) {
        const details = e?.message ? ` Details: ${e.message}` : "";
        throw new Error(
            `Cannot reach the API (${API_BASE}). Is the server running and allowing this origin?${details}`
        );
    }

    const ct = resp.headers.get("content-type")?.toLowerCase() || "";
    const isJson = ct.includes("application/json");

    if (!resp.ok) {
        if (isJson) {
            try {
                const data = (await resp.json()) as any;
                if (data && typeof data === "object" && typeof data.message === "string") {
                    throw new Error(data.message);
                }
            } catch {
                /* ignore */
            }
        } else {
            try {
                const text = await resp.text();
                if (text) throw new Error(text);
            } catch {
                /* ignore */
            }
        }
        throw new Error(`HTTP ${resp.status}`);
    }

    const data = (isJson ? await resp.json() : null) as JsonOk<{ reports: DamageReportDTO[] }>;
    return data.reports ?? [];
}

/* --------------------------- Page Component --------------------------- */

export default function LibrarianDamageReportsPage() {
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [rows, setRows] = React.useState<DamageReportDTO[]>([]);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<"all" | DamageStatus>("all");

    const load = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchDamageReports();
            setRows(data);
        } catch (err: any) {
            const msg = err?.message || "Failed to load damage reports.";
            setError(msg);
            toast.error("Failed to load", { description: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    }

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = rows;

        if (statusFilter !== "all") {
            list = list.filter((r) => r.status === statusFilter);
        }
        if (!q) return list;

        return list.filter((r) => {
            const student =
                (r.studentEmail || "") +
                " " +
                (r.studentId || "") +
                " " +
                (r.studentName || "") +
                " " +
                String(r.userId || "");
            const book = (r.bookTitle || "") + " " + String(r.bookId || "");
            const damage = (r.damageType || "") + " " + (r.severity || "") + " " + (r.status || "");
            const notes = r.notes || "";
            return (
                String(r.id).includes(q) ||
                student.toLowerCase().includes(q) ||
                book.toLowerCase().includes(q) ||
                damage.toLowerCase().includes(q) ||
                notes.toLowerCase().includes(q)
            );
        });
    }, [rows, statusFilter, search]);

    return (
        <DashboardLayout title="Damage Reports">
            {/* Header: vertical on mobile, horizontal on desktop */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-start gap-2">
                    <ShieldAlert className="h-5 w-5 mt-0.5 text-white/70" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Book Damage Reports</h2>
                        <p className="text-xs text-white/70">Track reported damages with photos.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by ID, user, book, info…"
                            className="pl-9 bg-slate-900/70 border-white/20 text-white"
                        />
                    </div>

                    <div className="w-full sm:w-44">
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as "all" | DamageStatus)}
                        >
                            <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 text-white border-white/10">
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="assessed">Assessed</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                        </Select>
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
                        <CardTitle>Damage reports</CardTitle>
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
                            No damage reports found.
                        </div>
                    ) : (
                        <>
                            {/* Desktop: Table (horizontal layout) */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableCaption className="text-xs text-white/60">
                                        Showing {filtered.length} {filtered.length === 1 ? "entry" : "entries"}.
                                    </TableCaption>
                                    <TableHeader>
                                        <TableRow className="border-white/10">
                                            <TableHead className="w-[90px] text-xs font-semibold text-white/70">
                                                Damage Report ID
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Student Email (or ID)
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Book Title (or ID)
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Damage Information
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-white/70">
                                                Uploaded Picture
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((r) => {
                                            const student =
                                                r.studentEmail || r.studentId || r.studentName || `User #${r.userId}`;
                                            const book = r.bookTitle || `Book #${r.bookId}`;
                                            const abs = toAbsoluteUrl(r.photoUrl);
                                            return (
                                                <TableRow
                                                    key={r.id}
                                                    className="border-white/5 hover:bg-white/5 transition-colors"
                                                >
                                                    <TableCell className="text-xs opacity-80">{r.id}</TableCell>
                                                    <TableCell className="text-sm">{student}</TableCell>
                                                    <TableCell className="text-sm">{book}</TableCell>
                                                    <TableCell className="text-sm align-top">{formatDamageInfo(r)}</TableCell>
                                                    <TableCell className="text-sm">
                                                        {abs ? (
                                                            <a
                                                                href={abs}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-block"
                                                            >
                                                                <img
                                                                    src={abs}
                                                                    alt={`Damage proof #${r.id}`}
                                                                    className="h-14 w-14 object-cover rounded-md border border-white/10"
                                                                    loading="lazy"
                                                                />
                                                            </a>
                                                        ) : (
                                                            <span className="opacity-60">—</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile: Stacked cards (vertical layout) */}
                            <div className="md:hidden space-y-3">
                                {filtered.map((r) => {
                                    const student =
                                        r.studentEmail || r.studentId || r.studentName || `User #${r.userId}`;
                                    const book = r.bookTitle || `Book #${r.bookId}`;
                                    const abs = toAbsoluteUrl(r.photoUrl);
                                    return (
                                        <div
                                            key={r.id}
                                            className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs text-white/60">Damage Report ID</div>
                                                <div className="text-xs font-semibold">{r.id}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Student Email (or ID)</div>
                                                <div className="text-sm">{student}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Book Title (or ID)</div>
                                                <div className="text-sm">{book}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Damage Information</div>
                                                <div className="text-sm">{formatDamageInfo(r)}</div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-white/60">Uploaded Picture</div>
                                                {abs ? (
                                                    <a href={abs} target="_blank" rel="noreferrer" className="inline-block">
                                                        <img
                                                            src={abs}
                                                            alt={`Damage proof #${r.id}`}
                                                            className="h-24 w-24 object-cover rounded-md border border-white/10"
                                                            loading="lazy"
                                                        />
                                                    </a>
                                                ) : (
                                                    <div className="text-sm opacity-60">—</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
