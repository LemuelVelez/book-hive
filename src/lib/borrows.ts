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

export type BorrowDamageSeverity =
    | "minor"
    | "moderate"
    | "major"
    | "severe"
    | string;

export type BorrowDamageReportDTO = {
    id: string;
    borrowRecordId?: string | number | null;
    bookId?: string | number | null;
    bookTitle?: string | null;
    accessionNumber?: string | null;
    copyNumber?: number | null;
    borrowerId?: string | number | null;
    borrowerName?: string | null;
    description: string;
    severity?: BorrowDamageSeverity | null;
    status?: string | null;
    reportedBy?: string | number | null;
    reportedByName?: string | null;
    reportedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    borrowerCanRead?: boolean;
    borrowerCanCreate?: false;
    borrowerCanEdit?: false;
};

export type CreateBorrowDamageReportPayload = {
    description: string;
    severity?: BorrowDamageSeverity | null;
    status?: string | null;
};

export type BorrowRecordDTO = {
    id: string;
    userId: string;
    studentEmail: string | null;
    studentId: string | null;
    studentName: string | null;
    course?: string | null;
    college?: string | null;
    bookId: string;
    bookTitle: string | null;
    accessionNumber?: string | null;
    copyNumber?: number | null;
    borrowDate: string; // ISO date (YYYY-MM-DD)
    dueDate: string; // ISO date
    returnDate: string | null; // ISO date or null
    status: BorrowStatus;
    fine: number; // pesos

    /**
     * Borrower classification returned by different backend versions.
     * Used so faculty borrowers are labeled as Faculty instead of Unassigned.
     */
    borrowerRole?: BorrowerRole | string | null;
    borrowerType?: BorrowerRole | string | null;
    userRole?: BorrowerRole | string | null;
    role?: BorrowerRole | string | null;
    accountType?: BorrowerRole | string | null;

    /**
     * Damage reports are filed by librarian/admin users and displayed
     * to the borrower as read-only information.
     */
    damageReports?: BorrowDamageReportDTO[] | null;
    latestDamageReport?: BorrowDamageReportDTO | null;

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

    /**
     * Reservation window metadata for online holds that are still awaiting pickup.
     * The backend treats expired pending-pickup holds as inactive after this window.
     */
    reservationWindowHours?: number | null;
    reservationExpiresAt?: string | null;
    reservationExpired?: boolean;
};

function parseBorrowRecordDateTime(value: string | null | undefined): Date | null {
    const raw = String(value ?? "").trim();
    if (!raw) return null;

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

export function getBorrowReservationExpiryDate(
    record: Pick<BorrowRecordDTO, "reservationExpiresAt" | "status">
): Date | null {
    if (record.status !== "pending_pickup") return null;
    return parseBorrowRecordDateTime(record.reservationExpiresAt ?? null);
}

export function isBorrowReservationActive(
    record: Pick<BorrowRecordDTO, "status" | "reservationExpired" | "reservationExpiresAt">,
    now = Date.now()
): boolean {
    if (record.status !== "pending_pickup") return false;
    if (record.reservationExpired === true) return false;

    const expiryDate = getBorrowReservationExpiryDate(record);
    if (!expiryDate) return true;

    return expiryDate.getTime() > now;
}

export function isBorrowRecordCurrentlyActive(
    record: Pick<BorrowRecordDTO, "status" | "reservationExpired" | "reservationExpiresAt">,
    now = Date.now()
): boolean {
    if (record.status === "returned") return false;
    if (record.status === "pending_pickup") {
        return isBorrowReservationActive(record, now);
    }

    return (
        record.status === "borrowed" ||
        record.status === "pending" ||
        record.status === "pending_return"
    );
}

export function formatBorrowReservationExpiry(
    record: Pick<BorrowRecordDTO, "reservationExpiresAt" | "status">,
    locale = "en-PH"
): string | null {
    const expiryDate = getBorrowReservationExpiryDate(record);
    if (!expiryDate) return null;

    return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(expiryDate);
}


export type BorrowNotificationSummaryDTO = {
    role: string;
    canManageExtensions: boolean;
    totalRecords: number;
    actionRequiredCount: number;
    unreadCount: number;
    handledCount: number;
    readCount: number;
    pendingPickupCount: number;
    pendingReturnCount: number;
    pendingExtensionCount: number;
};


export type BorrowEmailNotificationSyncDTO = {
    role: "borrower" | "staff";
    recipient: string | null;
    emailSent: boolean;
    suppressed: boolean;
    totalNotifications: number;
    dueTodayCount: number;
    overdueCount: number;
    pendingPickupCount: number;
    pendingReturnCount: number;
    pendingExtensionCount: number;
    message: string;
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
     * Faculty uses the semester-length policy unless backend returns a different value.
     */
    defaultBorrowDurationDays: number;

    /**
     * Optional cap for how many copies can be requested in one action.
     * Falls back to maxActiveBorrows when omitted.
     */
    maxPerAction?: number | null;
};

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

export const FACULTY_SEMESTER_BORROW_DURATION_DAYS = 150;
export const FACULTY_SEMESTER_BORROW_LABEL = "Per semester";

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
        defaultBorrowDurationDays: FACULTY_SEMESTER_BORROW_DURATION_DAYS,
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

export function getFacultyBorrowDurationLabel(): string {
    return FACULTY_SEMESTER_BORROW_LABEL;
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

export async function fetchBorrowNotificationSummary(): Promise<BorrowNotificationSummaryDTO> {
    type Resp = JsonOk<{ summary: BorrowNotificationSummaryDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.summary, { method: "GET" });
    return res.summary;
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
 * - faculty default duration: per semester
 */
export async function createSelfBorrow(
    bookId: string | number,
    quantity: number = 1,
    role: BorrowerRole = "student"
): Promise<BorrowRecordDTO> {
    validateBorrowQuantityForRole(role, quantity);
    const policy = getDefaultBorrowPolicy(role);

    const res = await requestJSON<BorrowCreateResponse>(BORROW_ROUTES.createSelf, {
        method: "POST",
        body: {
            bookId,
            quantity,
            borrowDurationDays: policy.defaultBorrowDurationDays,
        },
    });

    const created = normalizeCreatedBorrowRecords(res);
    if (created.length === 0) {
        throw new Error("Borrow request succeeded but no created borrow record was returned.");
    }

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
    const policy = getDefaultBorrowPolicy(role);

    const res = await requestJSON<BorrowCreateResponse>(BORROW_ROUTES.createSelf, {
        method: "POST",
        body: {
            bookId,
            quantity,
            borrowDurationDays: policy.defaultBorrowDurationDays,
        },
    });

    const created = normalizeCreatedBorrowRecords(res);
    if (created.length === 0) {
        throw new Error("Borrow request succeeded but no created borrow record was returned.");
    }

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


/**
 * Borrower/staff read access for damage reports attached to a borrow record.
 * Borrowers should only call this read method so they can view reports filed by the librarian.
 */
export async function fetchBorrowDamageReports(
    id: string | number
): Promise<BorrowDamageReportDTO[]> {
    type Resp = JsonOk<{ reports?: BorrowDamageReportDTO[] | null; report?: BorrowDamageReportDTO | null }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.damageReports(id), {
        method: "GET",
    });

    if (Array.isArray(res.reports)) return res.reports;
    return res.report ? [res.report] : [];
}

/**
 * Librarian/Admin action: file a damage report for a borrowed/returned book.
 * Borrower users must not use this write action; borrowers only read the reports.
 */
export async function createBorrowDamageReportByLibrarian(
    id: string | number,
    payload: CreateBorrowDamageReportPayload
): Promise<BorrowDamageReportDTO> {
    const description = String(payload.description || "").trim();
    if (!description) {
        throw new Error("Damage report description is required.");
    }

    type Resp = JsonOk<{ report: BorrowDamageReportDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.createDamageReport(id), {
        method: "POST",
        body: {
            description,
            severity: payload.severity || undefined,
            status: payload.status || undefined,
        },
    });
    return res.report;
}

/**
 * Sync dashboard-style borrow notifications to the signed-in user's email.
 *
 * Borrowers receive reminders for due-today / overdue books and librarian
 * return requests. Staff receive a digest for borrow workflow alerts plus
 * due-date reminders that need attention.
 */
export async function syncBorrowEmailNotifications(): Promise<BorrowEmailNotificationSyncDTO> {
    type Resp = JsonOk<{ sync: BorrowEmailNotificationSyncDTO }>;
    const res = await requestJSON<Resp>(BORROW_ROUTES.emailNotificationSync, {
        method: "POST",
    });
    return res.sync;
}