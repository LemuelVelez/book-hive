/* eslint-disable @typescript-eslint/no-explicit-any */
import { ROUTES, API_BASE } from "@/api/auth/route";

export type Role = "student" | "librarian" | "faculty" | "admin" | "other";

export type UserDTO = {
  id: string;
  email: string;
  fullName: string;

  /**
   * accountType is typically student/other (end-user classification),
   * but some backends also reuse it for staff roles.
   */
  accountType: Role;

  /**
   * ✅ role is what guards/redirects should rely on.
   * Some DBs keep both fields; role can change while accountType stays student.
   */
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

  /**
   * Keep accountType as-is (student/other in many systems),
   * but DO NOT rely on it for routing decisions.
   */
  const accountType = normalizeRole(
    u?.accountType ?? u?.account_type ?? "student"
  );

  /**
   * ✅ role is the effective authorization role.
   * IMPORTANT: prioritize `u.role` over accountType.
   */
  const role = normalizeRole(
    u?.role ?? u?.accountType ?? u?.account_type ?? "student"
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
    role, // ✅ always set role (guards/redirects use this)
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

  // keep list item compatible, but still normalize
  const accountType = normalizeRole(
    u.accountType ?? u.account_type ?? u.role ?? "student"
  );

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
        // ignore
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
  role: Role;
  studentId?: string;
  course?: string;
  yearLevel?: string;
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

export async function confirmVerifyEmail(token: string) {
  type Resp = JsonOk<{ message: string }>;
  return requestJSON<Resp>(ROUTES.auth.verifyConfirm, {
    method: "POST",
    body: { token },
  });
}

export async function sendMyVerifyEmail() {
  type Resp = JsonOk<{ message: string }>;
  return requestJSON<Resp>(ROUTES.users.meVerifyEmail, {
    method: "POST",
    body: {},
  });
}

export async function checkStudentIdAvailability(studentId: string) {
  return requestJSON<{ available: boolean }>(ROUTES.users.checkStudentId(studentId), {
    method: "GET",
  });
}

export async function submitSupportTicket(form: FormData) {
  type Resp = JsonOk<{ ticketId?: string }>;
  return requestJSON<Resp>(ROUTES.support.ticket, {
    method: "POST",
    body: form,
    asFormData: true,
  });
}

/* ---------------- profile update + avatar upload ---------------- */

export type UpdateMyProfilePayload = {
  fullName?: string;
  email?: string;
  course?: string;

  // preferred casing
  yearLevel?: string | null;
  studentId?: string | null;

  // backend compatibility (some APIs expect snake_case)
  year_level?: string | null;
  student_id?: string | null;
};

function sameNullable(a: unknown, b: unknown) {
  // compares string-ish values, keeping null meaningful
  const an = a === undefined ? undefined : a === null ? null : String(a).trim();
  const bn = b === undefined ? undefined : b === null ? null : String(b).trim();
  return an === bn;
}

export async function updateMyProfile(payload: UpdateMyProfilePayload) {
  type Resp = JsonOk<{ user: any }>;

  const hasStudentId =
    Object.prototype.hasOwnProperty.call(payload, "studentId") ||
    Object.prototype.hasOwnProperty.call(payload, "student_id");

  const hasYearLevel =
    Object.prototype.hasOwnProperty.call(payload, "yearLevel") ||
    Object.prototype.hasOwnProperty.call(payload, "year_level");

  const desiredStudentId =
    payload.studentId !== undefined ? payload.studentId : payload.student_id;

  const desiredYearLevel =
    payload.yearLevel !== undefined ? payload.yearLevel : payload.year_level;

  // Build camelCase body first (most common for JSON APIs)
  const bodyCamel: any = {};
  if (payload.fullName !== undefined) bodyCamel.fullName = payload.fullName;
  if (payload.email !== undefined) bodyCamel.email = payload.email;
  if (payload.course !== undefined) bodyCamel.course = payload.course;
  if (hasYearLevel) bodyCamel.yearLevel = desiredYearLevel;
  if (hasStudentId) bodyCamel.studentId = desiredStudentId;

  const doPatch = async (body: any) => {
    const r = await requestJSON<Resp>(ROUTES.users.me, {
      method: "PATCH",
      body,
    });
    return { ...r, user: normalizeUserDTO(r.user) } as JsonOk<{ user: UserDTO }>;
  };

  // 1) Try camelCase update
  try {
    const r1 = await doPatch(bodyCamel);

    // If server ignored studentId/yearLevel (common mismatch: expects snake_case),
    // retry ONLY those fields using snake_case to ensure they persist.
    const needStudentRetry =
      hasStudentId && !sameNullable(r1.user.studentId, desiredStudentId);
    const needYearRetry =
      hasYearLevel && !sameNullable(r1.user.yearLevel, desiredYearLevel);

    if (needStudentRetry || needYearRetry) {
      const bodySnake: any = {};
      if (needStudentRetry) bodySnake.student_id = desiredStudentId;
      if (needYearRetry) bodySnake.year_level = desiredYearLevel;

      const r2 = await doPatch(bodySnake);
      return r2;
    }

    return r1;
  } catch (e1) {
    // 2) If camelCase failed and student/year fields exist, try snake_case.
    // This protects strict validators that reject unknown keys like `studentId`.
    if (hasStudentId || hasYearLevel) {
      const bodySnakeAll: any = {};
      if (payload.fullName !== undefined) bodySnakeAll.fullName = payload.fullName;
      if (payload.email !== undefined) bodySnakeAll.email = payload.email;
      if (payload.course !== undefined) bodySnakeAll.course = payload.course;

      if (hasStudentId) bodySnakeAll.student_id = desiredStudentId;
      if (hasYearLevel) bodySnakeAll.year_level = desiredYearLevel;

      // NOTE: no useless try/catch here — if it fails, the thrown error is the "most recent" one.
      return doPatch(bodySnakeAll);
    }
    throw e1;
  }
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
  const arr: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.users)
      ? data.users
      : [];
  return arr.map(normalizeUserListItem).filter(Boolean) as UserListItemDTO[];
}

export async function listPendingUsers(): Promise<UserListItemDTO[]> {
  const data = await requestJSON<any>(ROUTES.users.pending, { method: "GET" });
  const arr: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.users)
      ? data.users
      : [];
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
  accountType?: Role;
  studentId?: string;
  course?: string;
  yearLevel?: string;
  isApproved?: boolean;
};

export async function createUser(payload: CreateUserPayload): Promise<UserDTO> {
  const data = await requestJSON<any>(ROUTES.users.create, {
    method: "POST",
    body: payload as any,
  });

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
