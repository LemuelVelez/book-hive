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

  // ✅ NEW: approval fields (for newly registered users)
  isApproved?: boolean;
  approvedAt?: string | null;

  // ✅ profile fields
  studentId?: string | null;
  course?: string | null;
  yearLevel?: string | null;

  // ✅ avatar
  avatarUrl?: string | null;
};

export type UserListItemDTO = {
  id: string;
  email: string;
  fullName: string;
  accountType: Role;
  avatarUrl?: string | null;

  // approval
  isApproved: boolean;
  approvedAt?: string | null;

  // optional timestamps
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

function normalizeRole(raw: unknown): Role {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "student") return "student";
  if (v === "librarian") return "librarian";
  if (v === "faculty") return "faculty";
  if (v === "admin") return "admin";
  return "other";
}

function normalizeUserDTO(u: any): UserDTO {
  const id = String(u?.id ?? "").trim();
  const email = String(u?.email ?? "").trim();
  const fullName = String(u?.fullName ?? u?.full_name ?? "").trim();

  const accountType = normalizeRole(
    u?.accountType ?? u?.account_type ?? u?.role ?? "student"
  );

  const isEmailVerified = Boolean(
    u?.isEmailVerified ?? u?.is_email_verified ?? false
  );

  const isApproved = u?.isApproved ?? u?.is_approved ?? undefined;
  const approvedAt = (u?.approvedAt ?? u?.approved_at ?? null) as string | null;

  const studentId = (u?.studentId ?? u?.student_id ?? null) as string | null;
  const course = (u?.course ?? null) as string | null;
  const yearLevel = (u?.yearLevel ?? u?.year_level ?? null) as string | null;

  const avatarUrl = (u?.avatarUrl ?? u?.avatar_url ?? null) as string | null;

  return {
    id,
    email,
    fullName,
    accountType,
    role: u?.role ? normalizeRole(u.role) : undefined,
    isEmailVerified,
    isApproved: isApproved === undefined ? undefined : Boolean(isApproved),
    approvedAt,
    studentId,
    course,
    yearLevel,
    avatarUrl,
  };
}

function normalizeUserListItem(u: any): UserListItemDTO | null {
  if (!u) return null;

  const id = String(u.id ?? "").trim();
  const email = String(u.email ?? "").trim();
  if (!id || !email) return null;

  const fullName = String(u.fullName ?? u.full_name ?? "").trim();
  const accountType = normalizeRole(u.accountType ?? u.account_type ?? u.role ?? "student");

  const isApproved = Boolean(u.isApproved ?? u.is_approved ?? false);
  const approvedAt = (u.approvedAt ?? u.approved_at ?? null) as string | null;
  const createdAt = (u.createdAt ?? u.created_at ?? null) as string | null;
  const avatarUrl = (u.avatarUrl ?? u.avatar_url ?? null) as string | null;

  return {
    id,
    email,
    fullName,
    accountType,
    avatarUrl,
    isApproved,
    approvedAt,
    createdAt,
  };
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
  type Resp = JsonOk<{ user: any }>;
  try {
    const r = await requestJSON<Resp>(ROUTES.auth.me, { method: "GET" });
    return normalizeUserDTO(r.user);
  } catch {
    return null;
  }
}

export async function login(email: string, password: string) {
  type Resp = JsonOk<{ user: any }>;
  const r = await requestJSON<Resp>(ROUTES.auth.login, {
    method: "POST",
    body: { email, password },
  });
  return { ...r, user: normalizeUserDTO(r.user) } as JsonOk<{ user: UserDTO }>;
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
  type Resp = JsonOk<{ user: any }>;
  const r = await requestJSON<Resp>(ROUTES.auth.register, {
    method: "POST",
    body: payload,
  });
  return { ...r, user: normalizeUserDTO(r.user) } as JsonOk<{ user: UserDTO }>;
}

export async function resendVerifyEmail(email: string) {
  type Resp = JsonOk<{ message: string }>;
  return requestJSON<Resp>(ROUTES.auth.verifyEmail, {
    method: "POST",
    body: { email },
  });
}

/** ✅ confirm verification using token (lets Settings verify without logout) */
export async function confirmVerifyEmail(token: string) {
  type Resp = JsonOk<{ message: string }>;
  return requestJSON<Resp>(ROUTES.auth.verifyConfirm, {
    method: "POST",
    body: { token },
  });
}

/** ✅ NEW: send verification email for currently logged-in user */
export async function sendMyVerifyEmail() {
  type Resp = JsonOk<{ message: string }>;
  return requestJSON<Resp>(ROUTES.users.meVerifyEmail, {
    method: "POST",
    body: {},
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

/* ---------------- profile update + avatar upload ---------------- */

export async function updateMyProfile(payload: {
  fullName?: string;
  email?: string; // ✅ now supported
  course?: string;
  yearLevel?: string;
}) {
  type Resp = JsonOk<{ user: any }>;
  const r = await requestJSON<Resp>(ROUTES.users.me, {
    method: "PATCH",
    body: payload,
  });
  return { ...r, user: normalizeUserDTO(r.user) } as JsonOk<{ user: UserDTO }>;
}

export async function uploadMyAvatar(file: File) {
  type Resp = JsonOk<{ user: any }>;
  const form = new FormData();
  form.append("avatar", file);
  const r = await requestJSON<Resp>(ROUTES.users.meAvatar, {
    method: "POST",
    body: form,
    asFormData: true,
  });
  return { ...r, user: normalizeUserDTO(r.user) } as JsonOk<{ user: UserDTO }>;
}

export async function removeMyAvatar() {
  type Resp = JsonOk<{ user: any }>;
  const r = await requestJSON<Resp>(ROUTES.users.meAvatar, {
    method: "DELETE",
  });
  return { ...r, user: normalizeUserDTO(r.user) } as JsonOk<{ user: UserDTO }>;
}

/* ---------------- change password (logged-in) ---------------- */

export async function changePassword(currentPassword: string, newPassword: string) {
  type Resp = JsonOk<{ message?: string }>;
  return requestJSON<Resp>(ROUTES.users.mePassword, {
    method: "PATCH",
    body: { currentPassword, newPassword },
  });
}

/* ---------------- librarian/admin user management ---------------- */

export async function listUsers(): Promise<UserListItemDTO[]> {
  const data = await requestJSON<any>(ROUTES.users.list, { method: "GET" });
  const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
  return arr.map(normalizeUserListItem).filter(Boolean) as UserListItemDTO[];
}

export async function listPendingUsers(): Promise<UserListItemDTO[]> {
  const data = await requestJSON<any>(ROUTES.users.pending, { method: "GET" });
  const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
  return arr.map(normalizeUserListItem).filter(Boolean) as UserListItemDTO[];
}

export async function approveUserById(id: string) {
  type Resp = JsonOk<{ message?: string }>;
  return requestJSON<Resp>(ROUTES.users.approve(id), {
    method: "PATCH",
    body: {},
  });
}

export async function disapproveUserById(id: string) {
  type Resp = JsonOk<{ message?: string }>;
  return requestJSON<Resp>(ROUTES.users.disapprove(id), {
    method: "PATCH",
    body: {},
  });
}

export async function deleteUserById(id: string) {
  type Resp = JsonOk<{ message?: string }>;
  return requestJSON<Resp>(ROUTES.users.delete(id), {
    method: "DELETE",
  });
}

/* ---------------- admin create user + role change ---------------- */

export type CreateUserPayload = {
  fullName: string;
  email: string;
  password: string;
  role: Role;

  // Some backends store both. If yours doesn’t, it can ignore one.
  accountType?: Role;

  // Optional (primarily student)
  studentId?: string;
  course?: string;
  yearLevel?: string;

  // Optional approval on create (backend may ignore)
  isApproved?: boolean;
};

export async function createUser(payload: CreateUserPayload): Promise<UserDTO> {
  const data = await requestJSON<any>(ROUTES.users.create, {
    method: "POST",
    body: payload as any,
  });

  // Accept shapes: { ok:true, user }, { user }, or direct user object
  const user = data?.user ?? data;
  return normalizeUserDTO(user);
}

export async function updateUserRoleById(id: string, role: Role): Promise<UserDTO> {
  const data = await requestJSON<any>(ROUTES.users.updateRole(id), {
    method: "PATCH",
    body: { role, accountType: role },
  });

  const user = data?.user ?? data;
  return normalizeUserDTO(user);
}
