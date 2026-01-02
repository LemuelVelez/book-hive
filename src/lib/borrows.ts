/* eslint-disable @typescript-eslint/no-explicit-any */
import { BORROW_ROUTES } from "@/api/borrows/route";
import { API_BASE } from "@/api/auth/route";

export type BorrowStatus =
    | "borrowed"
    | "pending" // legacy
    | "pending_pickup" // student reserved online, not yet picked up
    | "pending_return" // student requested return; waiting for librarian
    | "returned";

export type ExtensionRequestStatus = "none" | "pending" | "approved" | "disapproved";

export type BorrowRecordDTO = {
    id: string;
    userId: string;
    studentEmail: string | null;
    studentId: string | null;
    studentName: string | null;
    bookId: string;
    bookTitle: string | null;
    borrowDate: string; // ISO date (YYYY-MM-DD)
    dueDate: string; // ISO date
    returnDate: string | null; // ISO date or null
    status: BorrowStatus;
    fine: number; // pesos

    // ✅ Approved extension info
    extensionCount: number;
    extensionTotalDays: number;
    lastExtensionDays: number | null;
    lastExtendedAt: string | null;
    lastExtensionReason: string | null;

    // ✅ Extension request workflow info
    extensionRequestStatus?: ExtensionRequestStatus;
    extensionRequestedDays?: number | null;
    extensionRequestedAt?: string | null;
    extensionRequestedReason?: string | null;
    extensionDecidedAt?: string | null;
    extensionDecidedBy?: number | null;
    extensionDecisionNote?: string | null;
};

type JsonOk<T> = { ok: true } & T;

type FetchInit = Omit<RequestInit, "body" | "credentials"> & {
    body?: BodyInit | Record<string, unknown> | null;
    asFormData?: boolean;
};

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

/* ----------------------- Public Borrow Records API ----------------------- */

export type CreateBorrowPayload = {
    userId: string | number;
    bookId: string | number;
    borrowDate?: string; // YYYY-MM-DD (defaults server-side to today)
    dueDate: string; // YYYY-MM-DD
};

export type UpdateBorrowPayload = Partial<{
    returnDate: string | null; // YYYY-MM-DD or null
    status: BorrowStatus;
    fine: number;
    dueDate: string; // YYYY-MM-DD
}>;

export async function fetchBorrowRecords(): Promise<BorrowRecordDTO[]> {
    type Resp = JsonOk<{ records: BorrowRecordDTO[] }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.list, { method: "GET" });
    return res.records;
}

/**
 * List borrow records for the currently authenticated user (any role).
 */
export async function fetchMyBorrowRecords(): Promise<BorrowRecordDTO[]> {
    type Resp = JsonOk<{ records: BorrowRecordDTO[] }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.my, { method: "GET" });
    return res.records;
}

export async function createBorrowRecord(
    payload: CreateBorrowPayload
): Promise<BorrowRecordDTO> {
    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.create, {
        method: "POST",
        body: payload,
    });
    return res.record;
}

/**
 * Student self-service borrow: userId is taken from the session on the server.
 * Server will compute dueDate based on per-book borrow_duration_days.
 * We now always start self-borrows in "pending_pickup" on the server so that a
 * librarian must confirm physical pickup before it becomes "borrowed".
 */
export async function createSelfBorrow(
    bookId: string | number
): Promise<BorrowRecordDTO> {
    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.createSelf, {
        method: "POST",
        body: { bookId },
    });
    return res.record;
}

/**
 * Student online action: request to return a book.
 * - Sets status to "pending_return"
 * - Does NOT change return_date
 * - The book remains unavailable until a librarian marks it as "returned".
 */
export async function requestBorrowReturn(
    id: string | number
): Promise<BorrowRecordDTO> {
    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.update(id), {
        method: "PATCH",
        body: {
            status: "pending_return",
        },
    });
    return res.record;
}

export type BorrowExtensionResponse = {
    record: BorrowRecordDTO;
    message?: string;
};

/**
 * ✅ Extension behavior (matches backend):
 * - student/guest/faculty: creates an extension REQUEST (pending approval)
 * - librarian/admin: extends immediately (approved)
 *
 * POST /api/borrow-records/:id/extend
 * Body: { days: number, reason?: string }
 */
export async function requestBorrowExtension(
    id: string | number,
    days: number,
    reason?: string
): Promise<BorrowExtensionResponse> {
    if (!Number.isFinite(days) || days <= 0) {
        throw new Error("days must be a positive number.");
    }

    type Resp = JsonOk<{ record: BorrowRecordDTO; message?: string }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.extend(id), {
        method: "POST",
        body: {
            days: Math.floor(days),
            reason: reason && reason.trim() ? reason.trim() : undefined,
        },
    });

    return { record: res.record, message: res.message };
}

/**
 * Librarian/Admin: approve a pending extension request.
 * POST /api/borrow-records/:id/extend/approve
 * Body: { note?: string }
 */
export async function approveBorrowExtensionRequest(
    id: string | number,
    note?: string
): Promise<BorrowRecordDTO> {
    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.extendApprove(id), {
        method: "POST",
        body: { note: note && note.trim() ? note.trim() : undefined },
    });
    return res.record;
}

/**
 * Librarian/Admin: disapprove a pending extension request.
 * POST /api/borrow-records/:id/extend/disapprove
 * Body: { note?: string }
 */
export async function disapproveBorrowExtensionRequest(
    id: string | number,
    note?: string
): Promise<BorrowRecordDTO> {
    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.extendDisapprove(id), {
        method: "POST",
        body: { note: note && note.trim() ? note.trim() : undefined },
    });
    return res.record;
}

/**
 * Librarian/Admin action: confirm that the student has physically
 * received the book.
 * - Sets status to "borrowed"
 * - Keeps existing borrowDate / dueDate / fine values.
 */
export async function markBorrowAsBorrowed(
    id: string | number
): Promise<BorrowRecordDTO> {
    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.update(id), {
        method: "PATCH",
        body: {
            status: "borrowed",
        },
    });
    return res.record;
}

export type MarkBorrowReturnedOptions = {
    returnDate?: string;
    fine?: number;
};

/**
 * Librarian/Admin action: finalize the return.
 * - Sets status to "returned"
 * - Sets return_date (defaults to today)
 * - Optionally sets fine (overdue + damage) in pesos.
 * - Marks the book as available again (on the server).
 * - The fine you send here (e.g. 100) is persisted and shown to students.
 */
export async function markBorrowReturned(
    id: string | number,
    options: MarkBorrowReturnedOptions = {}
): Promise<BorrowRecordDTO> {
    const body: UpdateBorrowPayload = {
        status: "returned",
        returnDate: options.returnDate ?? new Date().toISOString().slice(0, 10),
    };

    if (typeof options.fine === "number") {
        body.fine = options.fine;
    }

    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.update(id), {
        method: "PATCH",
        body,
    });
    return res.record;
}

/**
 * Librarian/Admin action: modify the due date (e.g. extend loan).
 * This lets you lengthen the due date for valid reasons; the server
 * will automatically recalculate dynamic fines for active borrows.
 */
export async function updateBorrowDueDate(
    id: string | number,
    dueDate: string
): Promise<BorrowRecordDTO> {
    const body: UpdateBorrowPayload = {
        dueDate,
    };

    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.update(id), {
        method: "PATCH",
        body,
    });
    return res.record;
}
