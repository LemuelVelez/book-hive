/* eslint-disable @typescript-eslint/no-explicit-any */
import { FINES_ROUTES } from "@/api/fines/route";
import { API_BASE } from "@/api/auth/route";
import type { BorrowStatus } from "@/lib/borrows";

/**
 * Over-the-counter only:
 * - Removed: pending_verification, payment config, proof uploads, student pay flow
 */
export type FineStatus = "active" | "paid" | "cancelled";

export const DEFAULT_FINE_PER_HOUR = 10;

export type FineDTO = {
  id: string;
  userId: string;

  // For normal fines created from borrow_records
  borrowRecordId: string | null;

  // For fines generated from damage_reports (see backend syncFineForDamageReport)
  damageReportId: string | null;

  amount: number;
  status: FineStatus;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;

  /**
   * Cashier proof / official receipt number.
   * Backend requires this when status becomes "paid".
   */
  officialReceiptNumber: string | null;

  studentEmail: string | null;
  studentId: string | null;
  studentName: string | null;

  bookId: string | null;
  bookTitle: string | null;
  borrowStatus: BorrowStatus | null;
  borrowDueDate: string | null;
  borrowReturnDate: string | null;

  /**
   * Borrow-overdue metrics returned by backend so UI can show the actual
   * overdue duration instead of incorrectly showing 0 day(s).
   */
  finePerHour: number | null;
  overdueHours: number | null;
  overdueDays: number | null;
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

function normalizeOfficialReceiptNumber(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  return value.length > 0 ? value : null;
}

function ensureOfficialReceiptNumber(raw: unknown): string {
  const value = normalizeOfficialReceiptNumber(raw);
  if (!value) {
    throw new Error(
      "Official receipt number is required when marking a fine as paid."
    );
  }
  return value;
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
        if (
          data &&
          typeof data === "object" &&
          typeof (data as any).message === "string"
        ) {
          message = (data as any).message;
        }
      } catch {
        /* ignore */
      }
    } else {
      try {
        const text = await resp.text();
        if (text) message = text;
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }

  return (isJson ? resp.json() : (null as any)) as Promise<T>;
}

/* ----------------------- Public Fines API ----------------------- */

/**
 * List fines for the current authenticated user (student / other).
 */
export async function fetchMyFines(): Promise<FineDTO[]> {
  type Resp = JsonOk<{ fines: FineDTO[] }>;
  const res = await requestJSON<Resp>(FINES_ROUTES.my, { method: "GET" });
  return res.fines;
}

/**
 * List fines (librarian/admin).
 * Optional filters:
 *   - userId: limit to a specific user
 *   - status: active | paid | cancelled
 */
export type FetchFinesParams = Partial<{
  userId: string | number;
  status: FineStatus;
}>;

export async function fetchFines(params?: FetchFinesParams): Promise<FineDTO[]> {
  type Resp = JsonOk<{ fines: FineDTO[] }>;

  let url = FINES_ROUTES.list;

  if (params) {
    const search = new URLSearchParams();
    if (
      params.userId !== undefined &&
      params.userId !== null &&
      params.userId !== ""
    ) {
      search.set("userId", String(params.userId));
    }
    if (params.status) {
      search.set("status", params.status);
    }
    const qs = search.toString();
    if (qs) {
      url += `?${qs}`;
    }
  }

  const res = await requestJSON<Resp>(url, { method: "GET" });
  return res.fines;
}

/**
 * Librarian/Admin action: update fine.
 * - status: active | paid | cancelled
 * - amount: >= 0
 * - reason: optional note
 * - officialReceiptNumber/orNumber/receiptNumber: cashier OR #
 */
export type UpdateFinePayload = Partial<{
  status: FineStatus;
  amount: number;
  reason: string | null;
  officialReceiptNumber: string | null;
  orNumber: string | null;
  receiptNumber: string | null;
}>;

function buildFineUpdatePayload(
  payload: UpdateFinePayload
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  if (payload.status !== undefined) {
    next.status = payload.status;
  }

  if (payload.amount !== undefined) {
    next.amount = payload.amount;
  }

  if (payload.reason !== undefined) {
    next.reason = payload.reason;
  }

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

export async function updateFine(
  id: string | number,
  payload: UpdateFinePayload
): Promise<FineDTO> {
  type Resp = JsonOk<{ fine: FineDTO }>;
  const res = await requestJSON<Resp>(FINES_ROUTES.update(id), {
    method: "PATCH",
    body: buildFineUpdatePayload(payload),
  });
  return res.fine;
}

/**
 * Explicit helper for the UI "Mark as Paid" action.
 * Requires a cashier OR # as proof before the API request is sent.
 */
export async function markFineAsPaid(
  id: string | number,
  officialReceiptNumber: string,
  extra?: Partial<Pick<UpdateFinePayload, "amount" | "reason">>
): Promise<FineDTO> {
  return updateFine(id, {
    status: "paid",
    amount: extra?.amount,
    reason: extra?.reason,
    officialReceiptNumber: ensureOfficialReceiptNumber(officialReceiptNumber),
  });
}