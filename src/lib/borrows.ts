/* eslint-disable @typescript-eslint/no-explicit-any */
import { BORROW_ROUTES } from "@/api/borrows/route";
import { API_BASE } from "@/api/auth/route";

export type BorrowStatus =
    | "borrowed"
    | "pending" // legacy
    | "pending_pickup" // student reserved online, not yet picked up
    | "pending_return" // return has been requested and is awaiting librarian processing
    | "returned";

export type ExtensionRequestStatus = "none" | "pending" | "approved" | "disapproved";

export type BorrowerRole =
    | "student"
    | "faculty"
    | "librarian"
    | "admin"
    | "guest"
    | "other";

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

    // ✅ Return request workflow info
    returnRequestedAt?: string | null;
    returnRequestedBy?: number | null;
    returnRequestedByName?: string | null;
    returnRequestNote?: string | null;
};

export type BorrowPolicyDTO = {
    role: BorrowerRole;
    /**
     * Maximum simultaneously active borrow records allowed for the role.
     * Faculty requirement: maximum 10 books.
     */
    maxActiveBorrows: number;

    /**
     * Default borrow period in days for the role.
     * Faculty default here is 30 days unless backend returns a different value.
     */
    defaultBorrowDurationDays: number;

    /**
     * Optional cap for how many copies can be requested in one action.
     * Falls back to maxActiveBorrows when omitted.
     */
    maxPerAction?: number | null;
};

export type BorrowNotificationSummary = {
    pendingPickupCount: number;
    pendingReturnCount: number;
    pendingExtensionCount: number;
    pendingLegacyCount: number;
    actionableCount: number;
};

export const BORROW_NOTIFICATION_SYNC_EVENT =
    "bookhive:borrow-notifications-changed";

type JsonOk<T> = { ok: true } & T;

type FetchInit = Omit<RequestInit, "body" | "credentials"> & {
    body?: BodyInit | Record<string, unknown> | null;
    asFormData?: boolean;
};

type BorrowCreateResponse = JsonOk<{
    record?: BorrowRecordDTO | null;
    records?: BorrowRecordDTO[] | null;
    createdCount?: number;
}>;

const DEFAULT_BORROW_POLICIES: Record<BorrowerRole, BorrowPolicyDTO> = {
    student: {
        role: "student",
        maxActiveBorrows: 3,
        defaultBorrowDurationDays: 7,
        maxPerAction: 3,
    },
    faculty: {
        role: "faculty",
        maxActiveBorrows: 10,
        defaultBorrowDurationDays: 30,
        maxPerAction: 10,
    },
    librarian: {
        role: "librarian",
        maxActiveBorrows: 10,
        defaultBorrowDurationDays: 30,
        maxPerAction: 10,
    },
    admin: {
        role: "admin",
        maxActiveBorrows: 10,
        defaultBorrowDurationDays: 30,
        maxPerAction: 10,
    },
    guest: {
        role: "guest",
        maxActiveBorrows: 1,
        defaultBorrowDurationDays: 3,
        maxPerAction: 1,
    },
    other: {
        role: "other",
        maxActiveBorrows: 1,
        defaultBorrowDurationDays: 7,
        maxPerAction: 1,
    },
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

function normalizeCreatedBorrowRecords(payload: {
    record?: BorrowRecordDTO | null;
    records?: BorrowRecordDTO[] | null;
}): BorrowRecordDTO[] {
    if (Array.isArray(payload.records) && payload.records.length > 0) {
        return payload.records.filter(
            (item): item is BorrowRecordDTO =>
                Boolean(item && typeof item === "object" && typeof item.id === "string")
        );
    }

    if (payload.record && typeof payload.record === "object") {
        return [payload.record];
    }

    return [];
}

function normalizeBorrowPolicies(
    policies: BorrowPolicyDTO[] | null | undefined
): BorrowPolicyDTO[] {
    if (!Array.isArray(policies)) return [];
    return policies.filter(
        (item): item is BorrowPolicyDTO =>
            Boolean(
                item &&
                    typeof item === "object" &&
                    typeof item.role === "string" &&
                    typeof item.maxActiveBorrows === "number" &&
                    typeof item.defaultBorrowDurationDays === "number"
            )
    );
}

function normalizeNotificationMetric(value: unknown): number {
    const num = Math.floor(Number(value));
    return Number.isFinite(num) && num > 0 ? num : 0;
}

function emitBorrowNotificationSyncEvent(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(BORROW_NOTIFICATION_SYNC_EVENT));
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

    /**
     * ✅ how many copies to borrow in one action
     * (Backend will create 1 borrow record per copy.)
     */
    quantity?: number;
};

export type UpdateBorrowPayload = Partial<{
    returnDate: string | null; // YYYY-MM-DD or null
    status: BorrowStatus;
    fine: number;
    dueDate: string; // YYYY-MM-DD
}>;

export function getDefaultBorrowPolicy(role: BorrowerRole): BorrowPolicyDTO {
    return DEFAULT_BORROW_POLICIES[role] ?? DEFAULT_BORROW_POLICIES.other;
}

export function getFacultyBorrowPolicy(): BorrowPolicyDTO {
    return getDefaultBorrowPolicy("faculty");
}

export function getFacultyBorrowMaxBooks(): number {
    return getFacultyBorrowPolicy().maxActiveBorrows;
}

export function getFacultyBorrowDurationDays(): number {
    return getFacultyBorrowPolicy().defaultBorrowDurationDays;
}

export function validateBorrowQuantityForRole(
    role: BorrowerRole,
    quantity: number
): void {
    const policy = getDefaultBorrowPolicy(role);
    const allowed = policy.maxPerAction ?? policy.maxActiveBorrows;
    const normalized = Math.floor(Number(quantity));

    if (!Number.isFinite(normalized) || normalized <= 0) {
        throw new Error("Quantity must be a positive whole number.");
    }

    if (normalized > allowed) {
        throw new Error(
            `${role.charAt(0).toUpperCase() + role.slice(1)} can only borrow up to ${allowed} book${allowed === 1 ? "" : "s"} per request.`
        );
    }
}

export async function fetchBorrowPolicies(): Promise<BorrowPolicyDTO[]> {
    type Resp = JsonOk<{ policies?: BorrowPolicyDTO[] | null }>;

    try {
        const res = await requestJSON<Resp>(BORROW_ROUTES.policies, { method: "GET" });
        const normalized = normalizeBorrowPolicies(res.policies);
        return normalized.length > 0
            ? normalized
            : Object.values(DEFAULT_BORROW_POLICIES);
    } catch {
        return Object.values(DEFAULT_BORROW_POLICIES);
    }
}

export async function fetchBorrowPolicyForRole(
    role: BorrowerRole
): Promise<BorrowPolicyDTO> {
    type Resp = JsonOk<{ policy?: BorrowPolicyDTO | null }>;

    try {
        const res = await requestJSON<Resp>(BORROW_ROUTES.policyByRole(role), {
            method: "GET",
        });

        if (
            res.policy &&
            typeof res.policy === "object" &&
            typeof res.policy.role === "string" &&
            typeof res.policy.maxActiveBorrows === "number" &&
            typeof res.policy.defaultBorrowDurationDays === "number"
        ) {
            return res.policy;
        }
    } catch {
        // fall back to local defaults below
    }

    return getDefaultBorrowPolicy(role);
}

export async function fetchBorrowRecords(): Promise<BorrowRecordDTO[]> {
    type Resp = JsonOk<{ records: BorrowRecordDTO[] }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.list, { method: "GET" });
    return res.records;
}

export async function fetchBorrowNotificationSummary(): Promise<BorrowNotificationSummary> {
    type Resp = JsonOk<{
        summary?: Partial<BorrowNotificationSummary> | null;
    }>;

    const res = await requestJSON<Resp>(BORROW_ROUTES.notificationSummary, {
        method: "GET",
    });

    const summary = res.summary ?? {};

    return {
        pendingPickupCount: normalizeNotificationMetric(summary.pendingPickupCount),
        pendingReturnCount: normalizeNotificationMetric(summary.pendingReturnCount),
        pendingExtensionCount: normalizeNotificationMetric(summary.pendingExtensionCount),
        pendingLegacyCount: normalizeNotificationMetric(summary.pendingLegacyCount),
        actionableCount: normalizeNotificationMetric(summary.actionableCount),
    };
}

/**
 * List borrow records for the currently authenticated user (any role).
 * This now includes librarian return-request metadata so student/faculty
 * can see if a librarian requested them to return the book.
 */
export async function fetchMyBorrowRecords(): Promise<BorrowRecordDTO[]> {
    type Resp = JsonOk<{ records: BorrowRecordDTO[] }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.my, { method: "GET" });
    return res.records;
}

export async function createBorrowRecord(
    payload: CreateBorrowPayload
): Promise<BorrowRecordDTO> {
    const res = await requestJSON<BorrowCreateResponse>(BORROW_ROUTES.create, {
        method: "POST",
        body: payload,
    });

    const created = normalizeCreatedBorrowRecords(res);
    if (created.length === 0) {
        throw new Error("Borrow request succeeded but no created borrow record was returned.");
    }

    emitBorrowNotificationSyncEvent();
    return created[0];
}

/**
 * Student/faculty self-service borrow:
 * - userId is taken from the session on the server.
 * - server computes dueDate based on policy / per-book duration.
 * - starts in "pending_pickup".
 *
 * ✅ quantity lets the borrower reserve multiple copies (if available).
 *
 * Client-side default policy now includes:
 * - faculty maximum: 10 books
 * - faculty default duration: 30 days
 */
export async function createSelfBorrow(
    bookId: string | number,
    quantity: number = 1,
    role: BorrowerRole = "student"
): Promise<BorrowRecordDTO> {
    validateBorrowQuantityForRole(role, quantity);

    const res = await requestJSON<BorrowCreateResponse>(BORROW_ROUTES.createSelf, {
        method: "POST",
        body: { bookId, quantity },
    });

    const created = normalizeCreatedBorrowRecords(res);
    if (created.length === 0) {
        throw new Error("Borrow request succeeded but no created borrow record was returned.");
    }

    emitBorrowNotificationSyncEvent();
    return created[0];
}

/**
 * Student/faculty self-service borrow that always returns all created records.
 * This is useful when the backend creates multiple borrow rows for one request.
 */
export async function createSelfBorrowRecords(
    bookId: string | number,
    quantity: number = 1,
    role: BorrowerRole = "student"
): Promise<BorrowRecordDTO[]> {
    validateBorrowQuantityForRole(role, quantity);

    const res = await requestJSON<BorrowCreateResponse>(BORROW_ROUTES.createSelf, {
        method: "POST",
        body: { bookId, quantity },
    });

    const created = normalizeCreatedBorrowRecords(res);
    if (created.length === 0) {
        throw new Error("Borrow request succeeded but no created borrow record was returned.");
    }

    emitBorrowNotificationSyncEvent();
    return created;
}

/**
 * Borrower action: request to return a book.
 * - Sets status to "pending_return"
 * - Does NOT change return_date
 * - The book remains unavailable until a librarian marks it as "returned".
 */
export async function requestBorrowReturn(
    id: string | number,
    note?: string
): Promise<BorrowRecordDTO> {
    type Resp = JsonOk<{ record: BorrowRecordDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.update(id), {
        method: "PATCH",
        body: {
            status: "pending_return",
            ...(note && note.trim() ? { note: note.trim() } : {}),
        },
    });
    emitBorrowNotificationSyncEvent();
    return res.record;
}

export type BorrowExtensionResponse = {
    record: BorrowRecordDTO;
    message?: string;
};

export type BorrowReturnRequestResponse = {
    record: BorrowRecordDTO;
    message?: string;
};

/**
 * Librarian/Admin action: request that the borrower return the book.
 * This uses the dedicated backend route:
 * POST /api/borrow-records/:id/request-return
 */
export async function requestBorrowReturnByLibrarian(
    id: string | number,
    note?: string
): Promise<BorrowReturnRequestResponse> {
    type Resp = JsonOk<{ record: BorrowRecordDTO; message?: string }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.requestReturn(id), {
        method: "POST",
        body: {
            ...(note && note.trim() ? { note: note.trim() } : {}),
        },
    });

    emitBorrowNotificationSyncEvent();
    return { record: res.record, message: res.message };
}

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

    emitBorrowNotificationSyncEvent();
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
    emitBorrowNotificationSyncEvent();
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
    emitBorrowNotificationSyncEvent();
    return res.record;
}

/**
 * Librarian/Admin action: confirm that the student has physically
 * received the book.
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
    emitBorrowNotificationSyncEvent();
    return res.record;
}

export type MarkBorrowReturnedOptions = {
    returnDate?: string;
    fine?: number;
};

/**
 * Librarian/Admin action: finalize the return.
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
    emitBorrowNotificationSyncEvent();
    return res.record;
}

/**
 * Librarian/Admin action: modify the due date.
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