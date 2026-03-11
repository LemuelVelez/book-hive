/* eslint-disable @typescript-eslint/no-explicit-any */
import { DAMAGE_ROUTES } from "@/api/damageReports/route";
import { API_BASE } from "@/api/auth/route";

export type DamageStatus = "pending" | "assessed" | "paid";
export type DamageSeverity = "minor" | "moderate" | "major";

export type DamageReportDTO = {
    id: string;

    /** The user who submitted/reported the damage (often current borrower at the time). */
    userId: string;
    studentEmail: string | null;
    studentId: string | null;
    studentName?: string | null;

    /** The user who is LIABLE for the damage (can be previous borrower). */
    liableUserId: string | null;
    liableStudentEmail: string | null;
    liableStudentId: string | null;
    liableStudentName?: string | null;

    bookId: string;
    bookTitle: string | null;

    damageType: string;
    severity: DamageSeverity;
    fee: number;
    status: DamageStatus;

    /** True if moved into the paid/archive table. */
    archived: boolean;

    reportedAt: string;
    paidAt: string | null;

    notes: string | null;
    photoUrls: string[]; // up to 3 URLs
};

type JsonOk<T> = { ok: true } & T;

type FetchInit = Omit<RequestInit, "body" | "credentials"> & {
    body?: BodyInit | Record<string, unknown> | null;
    asFormData?: boolean;
};

/** Safely pull a readable message out of an unknown error value */
function getErrorMessage(e: unknown): string {
    if (!e) return "";
    if (typeof e === "string") return e;
    if (typeof e === "object" && "message" in e) {
        const m = (e as { message?: unknown }).message;
        return typeof m === "string" ? m : "";
    }
    try {
        return JSON.stringify(e);
    } catch {
        return "";
    }
}

function normalizeOfficialReceiptNumber(raw: unknown): string | null {
    if (raw === undefined || raw === null) return null;
    const value = String(raw).trim();
    return value.length > 0 ? value : null;
}

function ensureOfficialReceiptNumber(raw: unknown): string {
    const value = normalizeOfficialReceiptNumber(raw);
    if (!value) {
        throw new Error(
            "Official receipt number is required when marking a damage report as paid."
        );
    }
    return value;
}

async function requestJSON<T = unknown>(url: string, init: FetchInit = {}): Promise<T> {
    const { asFormData, body, headers, ...rest } = init;

    const finalInit: RequestInit = {
        credentials: "include",
        method: "GET",
        ...rest,
        headers: new Headers(headers || {}),
    };

    if (body instanceof FormData || asFormData) {
        finalInit.body = body as BodyInit;
    } else if (body !== undefined && body !== null) {
        (finalInit.headers as Headers).set("Content-Type", "application/json");
        finalInit.body = JSON.stringify(body);
    }

    let resp: Response;
    try {
        resp = await fetch(url, finalInit);
    } catch (e) {
        const details = getErrorMessage(e);
        const tail = details ? ` Details: ${details}` : "";
        throw new Error(
            `Cannot reach the API (${API_BASE}). Is the server running and allowing this origin?${tail}`
        );
    }

    const ct = resp.headers.get("content-type")?.toLowerCase() || "";
    const isJson = ct.includes("application/json");

    if (!resp.ok) {
        let message = `HTTP ${resp.status}`;
        if (isJson) {
            try {
                const data = (await resp.json()) as any;
                if (data && typeof data === "object" && typeof data.message === "string") {
                    message = data.message;
                }
            } catch {
                /* empty */
            }
        } else {
            try {
                const text = await resp.text();
                if (text) message = text;
            } catch {
                /* empty */
            }
        }
        throw new Error(message);
    }

    return (isJson ? resp.json() : (null as any)) as Promise<T>;
}

/* ----------------------- Public Damage Reports API ----------------------- */

export async function fetchMyDamageReports(): Promise<DamageReportDTO[]> {
    type Resp = JsonOk<{ reports: DamageReportDTO[] }>;
    const res = await requestJSON<Resp>(DAMAGE_ROUTES.my, { method: "GET" });
    return res.reports;
}

export type CreateDamageReportPayload = {
    bookId: string | number;
    damageType: string;
    severity: DamageSeverity;
    notes?: string | null;
    fee?: number | null;
    photos?: File[]; // up to 3 files
};

export async function createDamageReport(payload: CreateDamageReportPayload): Promise<DamageReportDTO> {
    const fd = new FormData();
    fd.append("bookId", String(payload.bookId));
    fd.append("damageType", payload.damageType);
    fd.append("severity", payload.severity);

    if (payload.notes != null && payload.notes !== "") {
        fd.append("notes", payload.notes);
    }

    if (payload.fee != null) {
        fd.append("fee", String(payload.fee));
    }

    if (payload.photos && payload.photos.length) {
        payload.photos.slice(0, 3).forEach((file) => {
            fd.append("photos", file);
        });
    }

    type Resp = JsonOk<{ report: DamageReportDTO }>;
    const res = await requestJSON<Resp>(DAMAGE_ROUTES.create, {
        method: "POST",
        body: fd,
        asFormData: true,
    });

    return res.report;
}

/**
 * List all damage reports (librarian/admin).
 * Backend returns UNION of active + archived/paid.
 */
export async function fetchDamageReports(): Promise<DamageReportDTO[]> {
    type Resp = JsonOk<{ reports: DamageReportDTO[] }>;
    const res = await requestJSON<Resp>(DAMAGE_ROUTES.list, { method: "GET" });
    return res.reports;
}

export type UpdateDamageReportPayload = Partial<{
    status: DamageStatus;
    severity: DamageSeverity;
    fee: number;
    notes: string | null;

    /** Liable user can differ from reporter/current borrower */
    liableUserId: string | number | null;

    /**
     * Cashier proof / official receipt number.
     * Required by backend when status becomes "paid".
     */
    officialReceiptNumber: string | null;
    orNumber: string | null;
    receiptNumber: string | null;
}>;

function buildDamageReportUpdatePayload(
    payload: UpdateDamageReportPayload
): Record<string, unknown> {
    const next: Record<string, unknown> = {};

    if (payload.status !== undefined) next.status = payload.status;
    if (payload.severity !== undefined) next.severity = payload.severity;
    if (payload.fee !== undefined) next.fee = payload.fee;
    if (payload.notes !== undefined) next.notes = payload.notes;
    if (payload.liableUserId !== undefined) next.liableUserId = payload.liableUserId;

    const hasReceiptField =
        payload.officialReceiptNumber !== undefined ||
        payload.orNumber !== undefined ||
        payload.receiptNumber !== undefined;

    if (payload.status === "paid") {
        next.officialReceiptNumber = ensureOfficialReceiptNumber(
            payload.officialReceiptNumber ??
                payload.orNumber ??
                payload.receiptNumber
        );
    } else if (hasReceiptField) {
        const value = normalizeOfficialReceiptNumber(
            payload.officialReceiptNumber ??
                payload.orNumber ??
                payload.receiptNumber
        );

        if (value) {
            next.officialReceiptNumber = value;
        }
    }

    return next;
}

/**
 * Update a damage report (status, severity, fee, notes, liable user).
 * If status becomes "paid", backend archives it into a separate table.
 */
export async function updateDamageReport(
    id: string | number,
    payload: UpdateDamageReportPayload
): Promise<DamageReportDTO> {
    type Resp = JsonOk<{ report: DamageReportDTO }>;
    const res = await requestJSON<Resp>(DAMAGE_ROUTES.update(id), {
        method: "PATCH",
        body: buildDamageReportUpdatePayload(payload),
    });
    return res.report;
}

/**
 * Explicit helper for the UI "Mark as Paid" action on damage reports.
 * Requires a cashier OR # as proof before the API request is sent.
 */
export async function markDamageReportAsPaid(
    id: string | number,
    officialReceiptNumber: string,
    extra?: Partial<Pick<UpdateDamageReportPayload, "fee" | "notes" | "liableUserId" | "severity">>
): Promise<DamageReportDTO> {
    return updateDamageReport(id, {
        status: "paid",
        fee: extra?.fee,
        notes: extra?.notes,
        liableUserId: extra?.liableUserId,
        severity: extra?.severity,
        officialReceiptNumber: ensureOfficialReceiptNumber(officialReceiptNumber),
    });
}

/**
 * Delete a damage report (librarian/admin).
 * Works for both active and archived.
 */
export async function deleteDamageReport(id: string | number): Promise<void> {
    type Resp = JsonOk<{ message?: string }>;
    await requestJSON<Resp>(DAMAGE_ROUTES.delete(id), {
        method: "DELETE",
    });
}