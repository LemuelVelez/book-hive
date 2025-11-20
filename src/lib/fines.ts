/* eslint-disable @typescript-eslint/no-explicit-any */
import { FINES_ROUTES } from "@/api/fines/route";
import { API_BASE } from "@/api/auth/route";
import type { BorrowStatus } from "@/lib/borrows";

export type FineStatus = "active" | "pending_verification" | "paid" | "cancelled";

export type FineDTO = {
  id: string;
  userId: string;
  borrowRecordId: string | null;
  amount: number;
  status: FineStatus;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;

  studentEmail: string | null;
  studentId: string | null;
  studentName: string | null;

  bookId: string | null;
  bookTitle: string | null;
  borrowStatus: BorrowStatus | null;
  borrowDueDate: string | null;
  borrowReturnDate: string | null;
};

export type FineProofDTO = {
  id: string;
  fineId: string;
  imageUrl: string;
  kind: string;
  uploadedAt: string;
};

export type PaymentConfigDTO = {
  eWalletPhone: string | null;
  qrCodeUrl: string | null;
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
 *   - status: active | pending_verification | paid | cancelled
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
    if (params.userId !== undefined && params.userId !== null && params.userId !== "") {
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
 * Student action: request payment for their own fine.
 * - Sets status to "pending_verification" on the server.
 */
export async function requestFinePayment(
  id: string | number
): Promise<FineDTO> {
  type Resp = JsonOk<{ fine: FineDTO }>;
  const res = await requestJSON<Resp>(FINES_ROUTES.pay(id), {
    method: "POST",
  });
  return res.fine;
}

/**
 * Librarian/Admin action: general fine update.
 */
export type UpdateFinePayload = Partial<{
  status: FineStatus;
  amount: number;
  reason: string | null;
}>;

export async function updateFine(
  id: string | number,
  payload: UpdateFinePayload
): Promise<FineDTO> {
  type Resp = JsonOk<{ fine: FineDTO }>;
  const res = await requestJSON<Resp>(FINES_ROUTES.update(id), {
    method: "PATCH",
    body: payload,
  });
  return res.fine;
}

/* ---------------- Payment proofs (images) ---------------- */

/**
 * Upload a proof image (e.g. student payment screenshot) for a fine.
 * Uses Amazon S3 on the backend.
 */
export async function uploadFineProofImage(
  id: string | number,
  file: File | Blob,
  opts?: { kind?: string }
): Promise<FineProofDTO> {
  const form = new FormData();
  form.append("image", file);
  if (opts?.kind) {
    form.append("kind", opts.kind);
  }

  type Resp = JsonOk<{ proof: FineProofDTO }>;
  const res = await requestJSON<Resp>(FINES_ROUTES.uploadProofs(id), {
    method: "POST",
    body: form,
    asFormData: true,
  });
  return res.proof;
}

/**
 * List proof images for a fine (librarian / student).
 */
export async function fetchFineProofs(
  id: string | number
): Promise<FineProofDTO[]> {
  type Resp = JsonOk<{ proofs: FineProofDTO[] }>;
  const res = await requestJSON<Resp>(FINES_ROUTES.uploadProofs(id), {
    method: "GET",
  });
  return res.proofs;
}

/* ---------------- Global payment config (e-wallet + QR) ---------------- */

export async function fetchPaymentConfig(): Promise<PaymentConfigDTO | null> {
  type Resp = JsonOk<{ config: PaymentConfigDTO | null }>;
  const res = await requestJSON<Resp>(FINES_ROUTES.paymentConfig, {
    method: "GET",
  });
  return res.config ?? null;
}

/**
 * Save the library payment settings (librarian/admin only).
 * - eWalletPhone: string (empty string will clear the number)
 * - qrCodeFile: optional File to replace the QR image
 */
export async function savePaymentConfig(
  eWalletPhone: string,
  qrCodeFile?: File | null
): Promise<PaymentConfigDTO> {
  const form = new FormData();
  form.append("eWalletPhone", eWalletPhone);
  if (qrCodeFile) {
    form.append("qrCode", qrCodeFile);
  }

  type Resp = JsonOk<{ config: PaymentConfigDTO }>;
  const res = await requestJSON<Resp>(FINES_ROUTES.paymentConfig, {
    method: "POST",
    body: form,
    asFormData: true,
  });
  return res.config;
}
