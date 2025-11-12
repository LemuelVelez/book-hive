/* eslint-disable @typescript-eslint/no-explicit-any */
import { FEEDBACK_ROUTES } from "@/api/feedbacks/route";
import { API_BASE } from "@/api/auth/route";

export type FeedbackDTO = {
    id: string;
    userId: string | number;
    studentEmail: string | null;
    studentId: string | null;
    bookId: string | number;
    bookTitle: string | null;
    rating: number; // 1..5
    comment: string | null;
    createdAt?: string | null;
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
        credentials: "include", // use cookies for auth session if any
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
            } catch { /* empty */ }
        } else {
            try {
                const text = await resp.text();
                if (text) message = text;
            } catch { /* empty */ }
        }
        throw new Error(message);
    }

    return (isJson ? resp.json() : (null as any)) as Promise<T>;
}

/* ----------------------- Public Feedbacks API ----------------------- */
/** GET /api/feedbacks -> { ok: true, feedbacks: FeedbackDTO[] } */
export async function fetchFeedbacks(): Promise<FeedbackDTO[]> {
    type Resp = JsonOk<{ feedbacks: FeedbackDTO[] }>;
    const res = await requestJSON<Resp>(FEEDBACK_ROUTES.list, { method: "GET" });
    return res.feedbacks;
}
