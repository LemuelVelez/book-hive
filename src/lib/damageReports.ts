/* eslint-disable @typescript-eslint/no-explicit-any */
import { DAMAGE_ROUTES } from "@/api/damageReports/route";
import { API_BASE } from "@/api/auth/route";

export type DamageStatus = "pending" | "assessed" | "paid";
export type DamageSeverity = "minor" | "moderate" | "major";

export type DamageReportDTO = {
    id: string;
    userId: string;
    studentEmail: string | null;
    studentId: string | null;
    studentName?: string | null;
    bookId: string;
    bookTitle: string | null;
    damageType: string;
    severity: DamageSeverity;
    fee: number;
    status: DamageStatus;
    reportedAt: string;
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

async function requestJSON<T = unknown>(
    url: string,
    init: FetchInit = {}
): Promise<T> {
    const { asFormData, body, headers, ...rest } = init;

    const finalInit: RequestInit = {
        credentials: "include", // use cookies for auth session
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

export async function createDamageReport(
    payload: CreateDamageReportPayload
): Promise<DamageReportDTO> {
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
        // backend expects field "photos" (array), max 3
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
}>;

/**
 * Update a damage report (status, severity, fee, notes).
 * Used by the librarian dashboard for assessments.
 */
export async function updateDamageReport(
    id: string | number,
    payload: UpdateDamageReportPayload
): Promise<DamageReportDTO> {
    type Resp = JsonOk<{ report: DamageReportDTO }>;
    const res = await requestJSON<Resp>(DAMAGE_ROUTES.update(id), {
        method: "PATCH",
        body: payload,
    });
    return res.report;
}

/**
 * Delete a damage report (librarian/admin).
 */
export async function deleteDamageReport(
    id: string | number
): Promise<void> {
    type Resp = JsonOk<{ message?: string }>;
    await requestJSON<Resp>(DAMAGE_ROUTES.delete(id), {
        method: "DELETE",
    });
}
