/* eslint-disable @typescript-eslint/no-explicit-any */
import { ROUTES, API_BASE } from "@/api/auth/route";

export type Role = "student" | "librarian" | "faculty" | "admin" | "other";

export type UserDTO = {
  id: string;
  email: string;
  fullName: string;
  accountType: Role;
  // Optional explicit role field if backend stores both
  role?: Role;

  isEmailVerified: boolean;

  // ✅ profile fields
  studentId?: string | null;
  course?: string | null;
  yearLevel?: string | null;

  // ✅ avatar
  avatarUrl?: string | null;
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
    credentials: "include", // cookies for session
    method: "GET",
    ...rest,
    headers: new Headers(headers || {}),
  };

  if (body instanceof FormData || asFormData) {
    // Let browser set boundary
    finalInit.body = body as BodyInit;
  } else if (body !== undefined && body !== null) {
    (finalInit.headers as Headers).set("Content-Type", "application/json");
    finalInit.body = JSON.stringify(body);
  }

  let resp: Response;
  try {
    resp = await fetch(url, finalInit);
  } catch (e) {
    // Network-level failure (connection refused / reset / DNS / etc.)
    const details = getErrorMessage(e);
    const tail = details ? ` Details: ${details}` : "";
    throw new Error(
      `Cannot reach the API (${API_BASE}). Is the server running on port 5000 and allowing ${typeof window !== "undefined" ? window.location.origin : "this origin"
      }?${tail}`
    );
  }

  const ct = resp.headers.get("content-type")?.toLowerCase() || "";
  const isJson = ct.includes("application/json");

  if (!resp.ok) {
    // Try to extract JSON error shape { ok:false, message?:string }
    let message = `HTTP ${resp.status}`;
    if (isJson) {
      try {
        const data = (await resp.json()) as unknown;
        if (
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
        ) {
          message = (data as { message: string }).message;
        }
      } catch {
        // ignore JSON parse error, fall back below
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

// -------- Public API --------

export async function me() {
  type Resp = JsonOk<{ user: UserDTO }>;
  try {
    const r = await requestJSON<Resp>(ROUTES.auth.me, { method: "GET" });
    return r.user;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string) {
  type Resp = JsonOk<{ user: UserDTO }>;
  return requestJSON<Resp>(ROUTES.auth.login, {
    method: "POST",
    body: { email, password },
  });
}

export async function logout() {
  type Resp = JsonOk<{ message?: string }>;
  try {
    await requestJSON<Resp>(ROUTES.auth.logout, { method: "POST" });
  } catch {
    // ignore
  }
}

export async function register(payload: {
  fullName: string;
  email: string;
  password: string;
  accountType: "student" | "other";
  // Explicit role saved in DB — for now should mirror accountType
  role: Role;
  studentId?: string;
  course?: string; // program
  yearLevel?: string;

  // ✅ optional avatar url (if you ever want to set on registration)
  avatarUrl?: string | null;
}) {
  type Resp = JsonOk<{ user: UserDTO }>;
  return requestJSON<Resp>(ROUTES.auth.register, {
    method: "POST",
    body: payload,
  });
}

export async function resendVerifyEmail(email: string) {
  type Resp = JsonOk<{ message: string }>;
  return requestJSON<Resp>(ROUTES.auth.verifyEmail, {
    method: "POST",
    body: { email },
  });
}

/** ✅ NEW: confirm verification using token (lets Settings verify without logout) */
export async function confirmVerifyEmail(token: string) {
  type Resp = JsonOk<{ message: string }>;
  return requestJSON<Resp>(ROUTES.auth.verifyConfirm, {
    method: "POST",
    body: { token },
  });
}

export async function checkStudentIdAvailability(studentId: string) {
  return requestJSON<{ available: boolean }>(
    ROUTES.users.checkStudentId(studentId),
    { method: "GET" }
  );
}

export async function submitSupportTicket(form: FormData) {
  type Resp = JsonOk<{ ticketId?: string }>;
  // Do NOT set Content-Type manually for FormData
  return requestJSON<Resp>(ROUTES.support.ticket, {
    method: "POST",
    body: form,
    asFormData: true,
  });
}

/* ---------------- NEW: profile update + avatar upload ---------------- */

export async function updateMyProfile(payload: {
  fullName?: string;
  email?: string; // ✅ now supported
  course?: string;
  yearLevel?: string;
}) {
  type Resp = JsonOk<{ user: UserDTO }>;
  return requestJSON<Resp>(ROUTES.users.me, {
    method: "PATCH",
    body: payload,
  });
}

export async function uploadMyAvatar(file: File) {
  type Resp = JsonOk<{ user: UserDTO }>;
  const form = new FormData();
  form.append("avatar", file);
  return requestJSON<Resp>(ROUTES.users.meAvatar, {
    method: "POST",
    body: form,
    asFormData: true,
  });
}

export async function removeMyAvatar() {
  type Resp = JsonOk<{ user: UserDTO }>;
  return requestJSON<Resp>(ROUTES.users.meAvatar, {
    method: "DELETE",
  });
}

/* ---------------- NEW: change password (logged-in) ---------------- */

export async function changePassword(currentPassword: string, newPassword: string) {
  type Resp = JsonOk<{ message?: string }>;
  return requestJSON<Resp>(ROUTES.users.mePassword, {
    method: "PATCH",
    body: { currentPassword, newPassword },
  });
}
