import type { DamageReportDTO, DamageStatus, DamageSeverity } from "@/lib/damageReports";

export type Severity = DamageSeverity;

export type DamageReportRow = DamageReportDTO & {
    photoUrl?: string | null;
    fullName?: string | null;
    full_name?: string | null;

    // legacy/alt keys
    liableFullName?: string | null;
    liable_full_name?: string | null;
};

export type FinePaidIndex = {
    ids: Set<string>;
    paidAtById: Map<string, string | null>;
};

export type DamageListMode = "active" | "paid";
export type ActiveStatusFilter = "all" | "pending" | "assessed";

export type UiArchiveInfo = {
    archived: boolean;
    status: DamageStatus;
    paidAt: string | null;
};