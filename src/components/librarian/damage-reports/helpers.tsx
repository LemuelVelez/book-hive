import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/api/auth/route";

import type { UserListItemDTO } from "@/lib/authentication";
import type { DamageStatus } from "@/lib/damageReports";
import type { DamageReportRow, Severity } from "./types";

export function fmtDate(d?: string | null) {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        return date.toLocaleDateString("en-CA");
    } catch {
        return d;
    }
}

export function peso(n: number | string | undefined) {
    if (n === undefined) return "—";
    const num = Number(n) || 0;
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
    }).format(num);
}

export function normalizeDamageStatus(value: any): DamageStatus | null {
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return null;
    if (s === "pending" || s.startsWith("pend")) return "pending";
    if (s === "assessed" || s.startsWith("assess")) return "assessed";
    if (s === "paid" || s.startsWith("paid")) return "paid";
    return null;
}

export function serverArchivedFlag(v: any): boolean {
    return v === true || v === "true" || v === 1 || v === "1";
}

export function isServerArchivedRecord(r: DamageReportRow) {
    const st = normalizeDamageStatus((r as any).status) ?? "pending";
    const archived = serverArchivedFlag((r as any).archived);
    const paidAt = (r as any).paidAt;
    return archived || st === "paid" || Boolean(paidAt);
}

export function StatusBadge({ status, archived }: { status: DamageStatus; archived?: boolean }) {
    const map: Record<DamageStatus, string> = {
        pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
        assessed: "bg-blue-500/15 text-blue-300 border-blue-500/20",
        paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    };

    const label = status[0].toUpperCase() + status.slice(1);

    return (
        <div className="inline-flex items-center gap-2">
            <Badge variant="outline" className={map[status]}>
                {label}
            </Badge>
            {archived ? (
                <Badge
                    variant="outline"
                    className="bg-white/5 text-white/70 border-white/10"
                    title="Moved to paid/archive record"
                >
                    Archived
                </Badge>
            ) : null}
        </div>
    );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
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

export function getReportedByName(r: DamageReportRow): string {
    const anyR = r as any;
    const name =
        (r.studentName ?? null) ||
        (r.fullName ?? null) ||
        (anyR.studentName ?? null) ||
        (anyR.fullName ?? null) ||
        (anyR.full_name ?? null);

    if (name && String(name).trim()) return String(name).trim();

    return (
        r.studentEmail ||
        r.studentId ||
        (anyR.student_email as string | undefined) ||
        (anyR.student_id as string | undefined) ||
        `User #${r.userId}`
    );
}

export function getLiableName(r: DamageReportRow): string {
    const anyR = r as any;

    const liableId =
        (r.liableUserId ?? null) || (anyR.liableUserId ?? null) || (anyR.liable_user_id ?? null);

    if (!liableId) return "—";

    const name =
        (r.liableStudentName ?? null) ||
        (anyR.liableStudentName ?? null) ||
        (r.liableFullName ?? null) ||
        (anyR.liableFullName ?? null) ||
        (anyR.liable_full_name ?? null);

    if (name && String(name).trim()) return String(name).trim();

    return (
        r.liableStudentEmail ||
        r.liableStudentId ||
        (anyR.liable_email as string | undefined) ||
        (anyR.liable_student_id as string | undefined) ||
        `User #${liableId}`
    );
}

export function formatDamageInfo(
    r: DamageReportRow,
    opts?: { uiStatus?: DamageStatus; uiArchived?: boolean; uiPaidAt?: string | null }
) {
    const uiStatus = opts?.uiStatus ?? (normalizeDamageStatus((r as any).status) ?? "pending");
    const uiArchived = opts?.uiArchived ?? serverArchivedFlag((r as any).archived);
    const uiPaidAt = opts?.uiPaidAt ?? (r as any).paidAt ?? null;

    const paidLabel = uiPaidAt ? fmtDate(uiPaidAt) : "—";

    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.damageType}</span>
                <SeverityBadge severity={r.severity} />
                <StatusBadge status={uiStatus} archived={uiArchived} />
            </div>

            <div className="text-xs text-white/70">
                {r.fee !== undefined && <span className="mr-3">Fine: {peso(r.fee)}</span>}
                {r.reportedAt && <span className="mr-3">Reported: {fmtDate(r.reportedAt)}</span>}
                {(uiStatus === "paid" || uiArchived) && <span className="mr-3">Paid: {paidLabel}</span>}
                {r.notes && <span className="block truncate">Notes: {r.notes}</span>}
            </div>
        </div>
    );
}

export function toAbsoluteUrl(url?: string | null) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_BASE}${url}`;
}

export function suggestedFineFromSeverity(severity: Severity): number {
    switch (severity) {
        case "minor":
            return 50;
        case "moderate":
            return 150;
        case "major":
            return 300;
        default:
            return 0;
    }
}

export function userDisplayLabel(u: UserListItemDTO) {
    const name = (u.fullName || "").trim();
    const email = (u.email || "").trim();
    const main = name || email || `User #${u.id}`;
    const role = (u.accountType || "").trim();
    return { main, sub: `${email || "—"}${role ? ` • ${role}` : ""}` };
}