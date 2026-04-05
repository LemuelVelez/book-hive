/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users2,
  RefreshCcw,
  Loader2,
  Search,
  Check,
  X,
  Trash2,
  UserPlus,
  Save,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
  Wand2,
  Mail,
  Copy,
  CalendarDays,
  BadgeCheck,
  Clock3,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter as DialogFooterUI,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { useSession } from "@/hooks/use-session";
import {
  type Role,
  approveUserById,
  disapproveUserById,
  deleteUserById,
  createUser,
  sendLoginCredentialsById,
} from "@/lib/authentication";
import { ROUTES } from "@/api/auth/route";

type VisibleRole =
  | "student"
  | "faculty"
  | "assistant_librarian"
  | "librarian"
  | "admin";

type UserRowDTO = {
  id: string;
  email: string;
  fullName: string;

  /**
   * ✅ role is used for authorization, guards, and admin role management
   */
  role: VisibleRole;

  /**
   * accountType is informational only
   */
  accountType: VisibleRole;

  // approval
  isApproved: boolean;
  approvedAt?: string | null;

  // optional timestamps
  createdAt?: string | null;

  // ✅ display picture
  avatarUrl?: string | null;
};

function roleBadgeClasses(role: VisibleRole) {
  switch (role) {
    case "admin":
      return "bg-red-600/80 hover:bg-red-600 text-white border-red-500/70";
    case "librarian":
      return "bg-purple-600/80 hover:bg-purple-600 text-white border-purple-500/70";
    case "assistant_librarian":
      return "bg-indigo-600/80 hover:bg-indigo-600 text-white border-indigo-500/70";
    case "faculty":
      return "bg-amber-600/80 hover:bg-amber-600 text-white border-amber-500/70";
    default:
      return "bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500/70"; // student
  }
}

function roleLabel(role: VisibleRole) {
  switch (role) {
    case "assistant_librarian":
      return "assistant librarian";
    default:
      return role;
  }
}

function roleDescription(role: VisibleRole) {
  switch (role) {
    case "admin":
      return "System-wide access and administrative controls.";
    case "librarian":
      return "Primary library staff with operational access.";
    case "assistant_librarian":
      return "Assistant librarian accounts aligned to the librarian flow.";
    case "faculty":
      return "Faculty members with role-based borrowing and account access.";
    case "student":
    default:
      return "Student accounts for regular borrowing and profile access.";
  }
}

function approvalBadgeClasses(approved: boolean) {
  return approved
    ? "bg-emerald-600/80 hover:bg-emerald-600 text-white border-emerald-500/70"
    : "bg-orange-600/80 hover:bg-orange-600 text-white border-orange-500/70";
}

const ROLE_OPTIONS: VisibleRole[] = [
  "student",
  "faculty",
  "assistant_librarian",
  "librarian",
  "admin",
];

const DISPLAY_ROLE_GROUPS: VisibleRole[] = ROLE_OPTIONS;

const ACCOUNT_TYPE_OPTIONS: VisibleRole[] = [
  "student",
  "faculty",
  "assistant_librarian",
  "librarian",
  "admin",
];

type BusyState =
  | { id: string; action: "approve" | "disapprove" | "delete" | "role" | "credentials" }
  | null;

type ConfirmState =
  | { type: "delete"; id: string }
  | { type: "role"; id: string; from: VisibleRole; to: VisibleRole }
  | null;

function normalizeRole(raw: unknown): VisibleRole {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "student") return "student";
  if (
    v === "assistant_librarian" ||
    v === "assistant librarian" ||
    v === "assistant-librarian"
  ) {
    return "assistant_librarian";
  }
  if (v === "librarian") return "librarian";
  if (v === "faculty") return "faculty";
  if (v === "admin") return "admin";
  return "student";
}

function accountTypeFromRole(role: Role): VisibleRole {
  switch (role) {
    case "student":
    case "faculty":
    case "assistant_librarian":
    case "librarian":
    case "admin":
      return role;
    default:
      return "student";
  }
}

function initialsFromName(name: string) {
  const s = String(name || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

function resolveAvatarUrl(url?: string | null) {
  const s = String(url ?? "").trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")) return s;
  // common case: backend returns "uploads/..." without leading slash
  return `/${s}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function UserAvatar({
  name,
  email,
  avatarUrl,
  size = 36,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = React.useState(false);
  const resolved = resolveAvatarUrl(avatarUrl);
  const label = String(name || "").trim() || String(email || "").trim() || "User";
  const showImg = !!resolved && !broken;

  return (
    <div
      className="rounded-full overflow-hidden border border-white/10 bg-slate-900/40 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      title={label}
    >
      {showImg ? (
        <img
          src={resolved!}
          alt={`${label} avatar`}
          className="h-full w-full object-cover object-center"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-[11px] font-semibold text-white/80">{initialsFromName(label)}</span>
      )}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/50">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

async function requestJSON<T = unknown>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });

  const ct = res.headers.get("content-type")?.toLowerCase() || "";
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      if (isJson) {
        const data: any = await res.json();
        msg = data?.message || data?.error || msg;
      } else {
        const text = await res.text();
        if (text) msg = text;
      }
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return (isJson ? (await res.json()) : (null as any)) as T;
}

function normalizeUserRow(u: any): UserRowDTO | null {
  if (!u) return null;

  const id = String(u.id ?? "").trim();
  const email = String(u.email ?? "").trim();
  if (!id || !email) return null;

  const fullName = String(u.fullName ?? u.full_name ?? "").trim();

  // ✅ accountType informational only
  const accountType = normalizeRole(u.accountType ?? u.account_type ?? "student");

  // ✅ role is authoritative (fallback to accountType if backend doesn’t send role)
  const role = normalizeRole(u.role ?? u.userRole ?? u.user_role ?? accountType);

  const isApproved = Boolean(u.isApproved ?? u.is_approved ?? false);
  const approvedAt = (u.approvedAt ?? u.approved_at ?? null) as string | null;
  const createdAt = (u.createdAt ?? u.created_at ?? null) as string | null;

  // ✅ avatar url
  const avatarUrl = (u.avatarUrl ?? u.avatar_url ?? null) as string | null;

  return {
    id,
    email,
    fullName,
    role,
    accountType,
    avatarUrl,
    isApproved,
    approvedAt,
    createdAt,
  };
}

async function listUsersWithRole(): Promise<UserRowDTO[]> {
  const data = await requestJSON<any>(ROUTES.users.list, { method: "GET" });
  const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
  return arr.map(normalizeUserRow).filter(Boolean) as UserRowDTO[];
}

/**
 * ✅ Update role ONLY (do not change accountType).
 * This bypasses lib/updateUserRoleById which may also send accountType.
 */
async function updateUserRoleRoleOnly(id: string, role: VisibleRole) {
  const data = await requestJSON<any>(ROUTES.users.updateRole(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return data;
}

function genPasswordReadable(len = 12) {
  try {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint8Array(Math.max(16, len));
    window.crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
    // add a tiny complexity suffix (still readable)
    return `${out}A1!`;
  } catch {
    // fallback
    return `Temp${Math.random().toString(36).slice(2, 10)}A1!`;
  }
}

async function copyToClipboard(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Copy failed", { description: "Your browser blocked clipboard access." });
  }
}

export default function AdminUsersPage() {
  const { user: sessionUser } = useSession();
  const selfId = sessionUser?.id ? String(sessionUser.id) : "";

  const [users, setUsers] = React.useState<UserRowDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const [busy, setBusy] = React.useState<BusyState>(null);

  // Role drafts per user row (for "Change role" UX)
  const [roleDraft, setRoleDraft] = React.useState<Record<string, VisibleRole>>({});

  // Create user dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [cFullName, setCFullName] = React.useState("");
  const [cEmail, setCEmail] = React.useState("");
  const [cPassword, setCPassword] = React.useState("");
  const [showCreatePassword, setShowCreatePassword] = React.useState(false);
  const [cAutoPassword, setCAutoPassword] = React.useState(true);
  const [cRole, setCRole] = React.useState<VisibleRole>("student");

  // accountType is informational only
  const [cAccountType, setCAccountType] = React.useState<VisibleRole>("student");

  // Optional student fields (only if cAccountType === "student")
  const [cStudentId, setCStudentId] = React.useState("");
  const [cCourse, setCCourse] = React.useState("");
  const [cYearLevel, setCYearLevel] = React.useState("");

  const [cApproveNow, setCApproveNow] = React.useState(true);

  // ✅ send credentials on create
  const [cSendCredentials, setCSendCredentials] = React.useState(true);

  // Confirm dialog state (delete / role change)
  const [confirm, setConfirm] = React.useState<ConfirmState>(null);

  // ✅ credentials dialog (send/resend)
  const [credOpen, setCredOpen] = React.useState(false);
  const [credUser, setCredUser] = React.useState<UserRowDTO | null>(null);
  const [credUseCustomPassword, setCredUseCustomPassword] = React.useState(false);
  const [credPassword, setCredPassword] = React.useState("");
  const [showCredPassword, setShowCredPassword] = React.useState(false);

  React.useEffect(() => {
    // keep accountType sensible by default when changing role
    setCAccountType(accountTypeFromRole(cRole));
  }, [cRole]);

  React.useEffect(() => {
    // ✅ Best UX: auto-generate a temp password when dialog opens (if enabled)
    if (createOpen && cAutoPassword) {
      const trimmed = cPassword.trim();
      if (!trimmed) setCPassword(genPasswordReadable());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, cAutoPassword]);

  React.useEffect(() => {
    // If user turns auto on and password is empty, fill it
    if (cAutoPassword) {
      const trimmed = cPassword.trim();
      if (!trimmed) setCPassword(genPasswordReadable());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cAutoPassword]);

  const resetCreateForm = () => {
    setCFullName("");
    setCEmail("");
    setCPassword("");
    setShowCreatePassword(false);
    setCAutoPassword(true);
    setCRole("student");
    setCAccountType("student");
    setCStudentId("");
    setCCourse("");
    setCYearLevel("");
    setCApproveNow(true);
    setCSendCredentials(true);
  };

  const resetCredForm = () => {
    setCredUseCustomPassword(false);
    setCredPassword("");
    setShowCredPassword(false);
  };

  const loadUsers = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await listUsersWithRole();
      setUsers(list);
      setRoleDraft((prev) => {
        const next: Record<string, VisibleRole> = { ...prev };
        for (const u of list) next[u.id] = next[u.id] ?? u.role;
        return next;
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to load users. Ensure the backend has GET /api/users.";
      setError(msg);
      toast.error("Failed to load users", { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUsers();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.id.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.fullName || "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.accountType.toLowerCase().includes(q) ||
        (u.isApproved ? "approved" : "pending").includes(q)
      );
    });
  }, [users, search]);

  const pendingCount = React.useMemo(() => users.filter((u) => !u.isApproved).length, [users]);

  const countsByRole = React.useMemo(() => {
    const m: Record<VisibleRole, number> = {
      student: 0,
      faculty: 0,
      assistant_librarian: 0,
      librarian: 0,
      admin: 0,
    };
    for (const u of users) m[u.role] = (m[u.role] ?? 0) + 1;
    return m;
  }, [users]);

  const roleGroups = React.useMemo(() => {
    return DISPLAY_ROLE_GROUPS.map((role) => {
      const entries = filtered.filter((u) => u.role === role);
      return {
        role,
        entries,
        total: entries.length,
        approved: entries.filter((u) => u.isApproved).length,
        pending: entries.filter((u) => !u.isApproved).length,
      };
    });
  }, [filtered]);

  const onApprove = async (id: string) => {
    setBusy({ id, action: "approve" });
    try {
      await approveUserById(id);
      toast.success("User approved");
      await loadUsers();
    } catch (e: any) {
      toast.error("Approve failed", { description: e?.message || "Unknown error" });
    } finally {
      setBusy(null);
    }
  };

  const onDisapprove = async (id: string) => {
    setBusy({ id, action: "disapprove" });
    try {
      await disapproveUserById(id);
      toast.success("User disapproved");
      await loadUsers();
    } catch (e: any) {
      toast.error("Disapprove failed", {
        description: e?.message || "Unknown error",
      });
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (id: string) => {
    setBusy({ id, action: "delete" });
    try {
      await deleteUserById(id);
      toast.success("User deleted");
      await loadUsers();
    } catch (e: any) {
      toast.error("Delete failed", { description: e?.message || "Unknown error" });
    } finally {
      setBusy(null);
    }
  };

  const onUpdateRole = async (id: string, nextRole: VisibleRole) => {
    setBusy({ id, action: "role" });
    try {
      await updateUserRoleRoleOnly(id, nextRole);
      toast.success("Role updated");
      await loadUsers();
    } catch (e: any) {
      toast.error("Role update failed", {
        description: e?.message || "Unknown error",
      });
    } finally {
      setBusy(null);
    }
  };

  const submitCreateUser = async () => {
    const fullName = cFullName.trim();
    const email = cEmail.trim();

    if (!fullName) {
      toast.error("Validation error", { description: "Full name is required." });
      return;
    }
    if (!email) {
      toast.error("Validation error", { description: "Email is required." });
      return;
    }

    const pwd = (cPassword || "").trim() || (cAutoPassword ? genPasswordReadable() : "");
    if (!pwd || pwd.length < 8) {
      toast.error("Validation error", {
        description: cAutoPassword
          ? "Temporary password could not be generated. Please try again."
          : "Password must be at least 8 characters.",
      });
      return;
    }

    // Keep UI state consistent if we generated a password on the fly
    if (!cPassword.trim() && cAutoPassword) setCPassword(pwd);

    // Student fields depend on accountType (informational classification), not role
    if (cAccountType === "student") {
      if (!cStudentId.trim()) {
        toast.error("Validation error", { description: "Student ID is required." });
        return;
      }
      if (!cCourse.trim()) {
        toast.error("Validation error", { description: "Course/Program is required." });
        return;
      }
      if (!cYearLevel.trim()) {
        toast.error("Validation error", { description: "Year level is required." });
        return;
      }
    }

    setCreating(true);
    try {
      const result = await createUser({
        fullName,
        email,
        password: pwd, // ✅ admin sees what will be emailed
        autoGeneratePassword: cAutoPassword,
        role: cRole, // ✅ effective role
        accountType: cAccountType, // ✅ informational only
        isApproved: cApproveNow,
        studentId: cAccountType === "student" ? cStudentId.trim() : undefined,
        course: cAccountType === "student" ? cCourse.trim() : undefined,
        yearLevel: cAccountType === "student" ? cYearLevel.trim() : undefined,
        sendLoginCredentials: cSendCredentials,
      });

      const created = result.user;

      // If backend ignores isApproved on create, do best-effort approve after creation.
      if (cApproveNow && created?.id) {
        try {
          await approveUserById(String(created.id));
        } catch {
          // ignore - backend may already have approved or disallow
        }
      }

      const creds = result.credentials;

      if (creds?.requested) {
        if (creds.sent) {
          toast.success("User created & credentials emailed", {
            description: "If the user didn’t receive it, use the key button in the user card to resend.",
          });
        } else {
          toast.error("User created, but email sending failed", {
            description:
              creds.error ||
              "Check SMTP settings (GMAIL_USER / GMAIL_APP_PASSWORD) and server logs, then resend from the user card.",
          });
        }
      } else {
        toast.success("User created", {
          description:
            "Credentials were not emailed. Use the key button in the user card to send/reset credentials anytime.",
        });
      }

      setCreateOpen(false);
      resetCreateForm();
      await loadUsers();
    } catch (e: any) {
      toast.error("Create failed", { description: e?.message || "Unknown error" });
    } finally {
      setCreating(false);
    }
  };

  const openCredentialsDialog = (u: UserRowDTO) => {
    setCredUser(u);
    resetCredForm();
    setCredOpen(true);
  };

  const submitSendCredentials = async () => {
    if (!credUser) return;

    if (credUseCustomPassword) {
      const p = credPassword.trim();
      if (!p) {
        toast.error("Validation error", {
          description: "Enter a temporary password or turn off custom password.",
        });
        return;
      }
      if (p.length < 8) {
        toast.error("Validation error", { description: "Password must be at least 8 characters." });
        return;
      }
    }

    setBusy({ id: credUser.id, action: "credentials" });
    try {
      await sendLoginCredentialsById(
        credUser.id,
        credUseCustomPassword ? { password: credPassword.trim() } : undefined
      );

      toast.success("Login credentials sent", {
        description: `An email was sent to ${credUser.email}. The user’s password was reset.`,
      });

      setCredOpen(false);
      setCredUser(null);
      resetCredForm();
    } catch (e: any) {
      toast.error("Send failed", { description: e?.message || "Unknown error" });
    } finally {
      setBusy(null);
    }
  };

  const renderUserAccordion = (u: UserRowDTO) => {
    const isBusyApprove = busy?.id === u.id && busy?.action === "approve";
    const isBusyDisapprove = busy?.id === u.id && busy?.action === "disapprove";
    const isBusyDelete = busy?.id === u.id && busy?.action === "delete";
    const isBusyRole = busy?.id === u.id && busy?.action === "role";
    const isBusyCred = busy?.id === u.id && busy?.action === "credentials";
    const anyBusyForRow = busy?.id === u.id;

    const currentRole = u.role;
    const draft = roleDraft[u.id] ?? currentRole;
    const roleChanged = draft !== currentRole;

    const isSelf = !!selfId && u.id === selfId;

    return (
      <AccordionItem
        key={u.id}
        value={u.id}
        className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 px-0 shadow-sm transition-colors hover:border-white/20"
      >
        <AccordionTrigger className="px-4 py-3 text-white hover:no-underline [&>svg]:mt-0.5">
          <div className="flex w-full min-w-0 items-center gap-3 text-left">
            <UserAvatar name={u.fullName} email={u.email} avatarUrl={u.avatarUrl} size={36} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">
              {(u.fullName || "Unnamed user")} • {u.email} • {roleLabel(currentRole)} • {u.isApproved ? "Approved" : "Pending"}
            </span>
            <Badge variant="default" className={approvalBadgeClasses(u.isApproved)}>
              {u.isApproved ? "approved" : "pending"}
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent className="border-t border-white/10 px-4 pb-4 pt-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/20 text-white/90 hover:bg-white/10"
              >
                Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[95svh] overflow-auto border-white/10 bg-slate-950 text-white sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle className="pr-6 text-left">{u.fullName || "Unnamed user"}</DialogTitle>
                <DialogDescription className="text-left text-white/65">
                  {u.email} • {roleLabel(currentRole)} • {u.isApproved ? "Approved" : "Pending"}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[calc(95svh-8rem)] space-y-4 overflow-y-auto pr-1">
                <div className="flex items-start gap-3 min-w-0">
                  <UserAvatar name={u.fullName} email={u.email} avatarUrl={u.avatarUrl} size={44} />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate max-w-full">
                        {u.fullName || "Unnamed user"}
                      </h3>
                      {isSelf ? (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">
                          You
                        </span>
                      ) : null}
                      <Badge variant="default" className={approvalBadgeClasses(u.isApproved)}>
                        {u.isApproved ? "approved" : "pending"}
                      </Badge>
                      <Badge variant="default" className={roleBadgeClasses(currentRole)}>
                        {roleLabel(currentRole)}
                      </Badge>
                    </div>

                    <div className="text-sm text-white/80 break-all">{u.email}</div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono max-w-full truncate">
                        ID: {u.id}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                        Account type: {roleLabel(u.accountType)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <StatPill
                    icon={<CalendarDays className="h-3.5 w-3.5" />}
                    label="Created"
                    value={formatDateTime(u.createdAt)}
                  />
                  <StatPill
                    icon={<BadgeCheck className="h-3.5 w-3.5" />}
                    label="Approved at"
                    value={formatDateTime(u.approvedAt)}
                  />
                  <StatPill
                    icon={<Clock3 className="h-3.5 w-3.5" />}
                    label="Status"
                    value={u.isApproved ? "Active access" : "Needs review"}
                  />
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-white/55">Change role</Label>
                    <Select
                      value={draft}
                      onValueChange={(v) => setRoleDraft((p) => ({ ...p, [u.id]: v as VisibleRole }))}
                      disabled={isSelf || anyBusyForRow}
                    >
                      <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white disabled:opacity-60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 text-white border-white/10">
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {roleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {roleChanged ? (
                    <span className="block text-xs text-violet-200">
                      Pending change to <span className="font-semibold">{roleLabel(draft)}</span>
                    </span>
                  ) : (
                    <span className="block text-xs text-white/45">No unsaved role changes.</span>
                  )}

                  {isSelf ? (
                    <p className="text-xs text-white/50">You can’t change your own role here.</p>
                  ) : (
                    <p className="text-xs text-white/45">
                      Permissions follow the selected role. Account type remains informational only.
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start border-white/20 text-white/90 hover:bg-white/10"
                    onClick={() => openCredentialsDialog(u)}
                    disabled={anyBusyForRow}
                    title="Send / resend login credentials"
                  >
                    {isBusyCred ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                    Credentials
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start border-white/20 text-white/90 hover:bg-white/10"
                    disabled={!roleChanged || anyBusyForRow || isSelf}
                    onClick={() => {
                      const from = currentRole;
                      const to = draft;
                      setConfirm({ type: "role", id: u.id, from, to });
                    }}
                    title={roleChanged ? "Update role" : "No role changes"}
                  >
                    {isBusyRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save role
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start border-white/20 text-white/90 hover:bg-white/10"
                    onClick={() => onApprove(u.id)}
                    disabled={u.isApproved || anyBusyForRow}
                    title={u.isApproved ? "Already approved" : "Approve user"}
                  >
                    {isBusyApprove ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Approve
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start border-white/20 text-white/90 hover:bg-white/10"
                    onClick={() => onDisapprove(u.id)}
                    disabled={!u.isApproved || anyBusyForRow}
                    title={!u.isApproved ? "Already pending" : "Disapprove user"}
                  >
                    {isBusyDisapprove ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                    Disapprove
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full justify-start hover:opacity-95"
                    onClick={() => setConfirm({ type: "delete", id: u.id })}
                    disabled={anyBusyForRow || isSelf}
                    title={isSelf ? "You can’t delete yourself" : "Delete user"}
                  >
                    {isBusyDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <DashboardLayout title="Users">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users2 className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold leading-tight">Admin user management</h2>
            <p className="text-xs text-white/70">
              Add users, change roles, approve or disapprove accounts, resend credentials, and remove users.
              Pending: <span className="font-semibold text-orange-200">{pendingCount}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
              <span className="inline-flex items-center gap-1">
                <Badge className={roleBadgeClasses("student")}>{roleLabel("student")}</Badge>
                <span className="opacity-80">{countsByRole.student}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge className={roleBadgeClasses("faculty")}>{roleLabel("faculty")}</Badge>
                <span className="opacity-80">{countsByRole.faculty}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge className={roleBadgeClasses("assistant_librarian")}>
                  {roleLabel("assistant_librarian")}
                </Badge>
                <span className="opacity-80">{countsByRole.assistant_librarian}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge className={roleBadgeClasses("librarian")}>{roleLabel("librarian")}</Badge>
                <span className="opacity-80">{countsByRole.librarian}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge className={roleBadgeClasses("admin")}>{roleLabel("admin")}</Badge>
                <span className="opacity-80">{countsByRole.admin}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog
            open={createOpen}
            onOpenChange={(o) => {
              setCreateOpen(o);
              if (!o) resetCreateForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600">
                <UserPlus className="mr-2 h-4 w-4" />
                Add user
              </Button>
            </DialogTrigger>

            <DialogContent className="support-scroll w-[92vw] sm:w-auto max-h-[95svh] overflow-y-auto bg-slate-900 text-white border-white/10">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <UserPlus className="h-5 w-5" />
                  Create new user
                </DialogTitle>
                <DialogDescription className="text-white/70">
                  Create an account directly (admin). You can optionally approve the user immediately.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-1">
                <div className="grid gap-2">
                  <Label htmlFor="c-fullname">Full name</Label>
                  <Input
                    id="c-fullname"
                    value={cFullName}
                    onChange={(e) => setCFullName(e.target.value)}
                    placeholder="Juan Dela Cruz"
                    className="bg-slate-900/70 border-white/10 text-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="c-email">Email</Label>
                  <Input
                    id="c-email"
                    type="email"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-slate-900/70 border-white/10 text-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Temporary password</Label>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="c-auto-pass"
                      checked={cAutoPassword}
                      onCheckedChange={(v) => setCAutoPassword(v === true)}
                    />
                    <div className="grid gap-1">
                      <Label htmlFor="c-auto-pass" className="text-sm text-white/80">
                        Auto-generate a temporary password
                      </Label>
                      <p className="text-xs text-white/55">
                        Recommended. You can regenerate and copy it anytime before creating the user.
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <Input
                      id="c-password"
                      type={showCreatePassword ? "text" : "password"}
                      value={cPassword}
                      onChange={(e) => {
                        if (cAutoPassword) return;
                        setCPassword(e.target.value);
                      }}
                      readOnly={cAutoPassword}
                      placeholder="At least 8 characters"
                      className="bg-slate-900/70 border-white/10 text-white pr-28"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setCPassword(genPasswordReadable())}
                        className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                        aria-label="Generate password"
                        title="Generate password"
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const p = cPassword.trim();
                          if (!p) return toast.error("Nothing to copy");
                          void copyToClipboard(p, "Temporary password copied");
                        }}
                        className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                        aria-label="Copy password"
                        title="Copy password"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowCreatePassword((s) => !s)}
                        className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                        aria-label={showCreatePassword ? "Hide password" : "Show password"}
                        title={showCreatePassword ? "Hide password" : "Show password"}
                      >
                        {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-white/50">
                    Tip: Use a temporary password and let the user change it after logging in.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Role (used for access control)</Label>
                  <Select value={cRole} onValueChange={(v) => setCRole(v as VisibleRole)}>
                    <SelectTrigger className="bg-slate-900/70 border-white/10 text-white">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 text-white border-white/10">
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {cRole === "assistant_librarian" ? (
                    <p className="text-xs text-white/50">
                      Use this for assistant librarian accounts. Route access will follow the librarian dashboard flow.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label>Account type (informational only)</Label>
                  <Select value={cAccountType} onValueChange={(v) => setCAccountType(v as VisibleRole)}>
                    <SelectTrigger className="bg-slate-900/70 border-white/10 text-white">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 text-white border-white/10">
                      {ACCOUNT_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {roleLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-white/50">
                    This classifies the user profile only and does not control permissions.
                  </p>
                </div>

                {cAccountType === "student" && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="mb-3 flex items-center gap-2 text-xs text-white/70">
                      <ShieldAlert className="h-4 w-4" />
                      Student fields (required)
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="c-studentid">Student ID</Label>
                        <Input
                          id="c-studentid"
                          value={cStudentId}
                          onChange={(e) => setCStudentId(e.target.value)}
                          placeholder="e.g., TC-20-A-00001"
                          className="bg-slate-900/70 border-white/10 text-white"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="c-course">Course / Program</Label>
                        <Input
                          id="c-course"
                          value={cCourse}
                          onChange={(e) => setCCourse(e.target.value)}
                          placeholder="e.g., BS Information Systems"
                          className="bg-slate-900/70 border-white/10 text-white"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="c-year">Year level</Label>
                        <Input
                          id="c-year"
                          value={cYearLevel}
                          onChange={(e) => setCYearLevel(e.target.value)}
                          placeholder="e.g., 1st / 2nd / 3rd / 4th"
                          className="bg-slate-900/70 border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <Mail className="h-4 w-4" />
                    Email delivery
                  </div>

                  <div className="mt-3 flex items-start gap-2">
                    <Checkbox
                      id="c-send-credentials"
                      checked={cSendCredentials}
                      onCheckedChange={(v) => setCSendCredentials(v === true)}
                    />
                    <div className="grid gap-1">
                      <Label htmlFor="c-send-credentials" className="text-sm text-white/80">
                        Send login credentials to the user
                      </Label>
                      <p className="text-xs text-white/55">
                        Sends an email containing their login email + temporary password (and a verify-email link if needed).
                        You can resend anytime from the user card using the key button.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-2">
                    <Checkbox id="c-approve" checked={cApproveNow} onCheckedChange={(v) => setCApproveNow(v === true)} />
                    <Label htmlFor="c-approve" className="text-sm text-white/80">
                      Approve immediately
                    </Label>
                  </div>
                </div>
              </div>

              <DialogFooterUI className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateOpen(false);
                    resetCreateForm();
                  }}
                  className="border-white/15 bg-black/50 text-white hover:text-white hover:bg-white/10"
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitCreateUser}
                  disabled={creating}
                  className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                >
                  {creating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Create user
                    </span>
                  )}
                </Button>
              </DialogFooterUI>
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-white/20 text-white/90 hover:bg-white/10"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh"
            title="Refresh"
          >
            {refreshing || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card className="bg-slate-800/60 border-white/10">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Users</CardTitle>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, email, name, role, account type, approved…"
                className="pl-9 bg-slate-900/70 border-white/20 text-white"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-red-300">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/70">
              No users found.
              <br />
              <span className="text-xs opacity-80">Try a different search.</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-orange-100/80">Pending users</div>
                  <div className="mt-1 text-2xl font-semibold text-orange-100">{filtered.filter((u) => !u.isApproved).length}</div>
                  <p className="mt-1 text-xs text-orange-100/70">Still waiting for approval or follow-up actions.</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-100/80">Approved users</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-100">{filtered.filter((u) => u.isApproved).length}</div>
                  <p className="mt-1 text-xs text-emerald-100/70">Currently approved and ready for role-based access.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs uppercase tracking-wide text-white/60">Showing results</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{filtered.length}</div>
                  <p className="mt-1 text-xs text-white/55">
                    Role groups stay collapsed by default, and each user opens from their own name accordion.
                  </p>
                </div>
              </div>

              <Accordion
                type="multiple"
                className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3"
              >
                {roleGroups.map((group) => (
                  <AccordionItem
                    key={group.role}
                    value={group.role}
                    className="self-start overflow-hidden rounded-2xl border border-white/10 bg-slate-900/35 px-0"
                  >
                    <AccordionTrigger className="px-4 py-3 text-white hover:no-underline">
                      <div className="flex flex-col items-start gap-2 text-left sm:flex-row sm:flex-wrap sm:items-center">
                        <Badge className={roleBadgeClasses(group.role)}>{roleLabel(group.role)}</Badge>
                        <span className="text-sm font-semibold text-white">{group.total} user{group.total === 1 ? "" : "s"}</span>
                        <span className="text-xs text-white/55">{roleDescription(group.role)}</span>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/65">
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
                            Approved: {group.approved}
                          </span>
                          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5">
                            Pending: {group.pending}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t border-white/10 px-4 pb-4 pt-4">
                      {group.total === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
                          No {roleLabel(group.role)} users match the current search.
                        </div>
                      ) : (
                        <Accordion type="multiple" className="space-y-3">
                          {group.entries.map(renderUserAccordion)}
                        </Accordion>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm dialog (Delete / Role change) */}
      <Dialog open={!!confirm} onOpenChange={(o) => (!o ? setConfirm(null) : null)}>
        <DialogContent className="max-h-[95svh] overflow-auto bg-slate-900 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {confirm?.type === "delete" ? "Delete user?" : "Change user role?"}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {confirm?.type === "delete"
                ? "This action cannot be undone."
                : confirm
                ? `Change role from "${roleLabel(confirm.from)}" to "${roleLabel(confirm.to)}"?`
                : null}
            </DialogDescription>
          </DialogHeader>

          {confirm?.type === "role" && (confirm.to === "admin" || confirm.from === "admin") ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <div className="inline-flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                <span className="font-medium">Admin role warning</span>
              </div>
              <p className="mt-1 text-xs text-amber-200/90">
                Assigning or removing admin privileges can affect access to the system.
              </p>
            </div>
          ) : null}

          <DialogFooterUI className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirm(null)}
              className="border-white/15 bg-black/50 text-white hover:text-white hover:bg-white/10"
              disabled={!!busy}
            >
              Cancel
            </Button>

            {confirm?.type === "delete" ? (
              <Button
                type="button"
                variant="destructive"
                disabled={!!busy}
                onClick={async () => {
                  const id = confirm.id;
                  setConfirm(null);
                  await onDelete(id);
                }}
              >
                Delete
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                disabled={!!busy || !confirm}
                onClick={async () => {
                  if (!confirm || confirm.type !== "role") return;
                  const { id, to } = confirm;
                  setConfirm(null);
                  await onUpdateRole(id, to);
                }}
              >
                Change role
              </Button>
            )}
          </DialogFooterUI>
        </DialogContent>
      </Dialog>

      {/* ✅ Credentials dialog */}
      <Dialog
        open={credOpen}
        onOpenChange={(o) => {
          setCredOpen(o);
          if (!o) {
            setCredUser(null);
            resetCredForm();
          }
        }}
      >
        <DialogContent className="max-h-[95svh] overflow-auto bg-slate-900 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Send / resend login credentials
            </DialogTitle>
            <DialogDescription className="text-white/70">
              This will email the user their login credentials. Sending credentials will reset the user’s password.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/60">User</div>
              <div className="mt-1 text-sm font-semibold text-white">{credUser?.fullName || "—"}</div>
              <div className="mt-1 text-sm text-white/80">{credUser?.email || "—"}</div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <div className="inline-flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                <span className="font-medium">Important</span>
              </div>
              <p className="mt-1 text-xs text-amber-200/90">
                Sending credentials will overwrite the user’s existing password.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="cred-custom"
                checked={credUseCustomPassword}
                onCheckedChange={(v) => setCredUseCustomPassword(v === true)}
              />
              <div className="grid gap-1">
                <Label htmlFor="cred-custom" className="text-sm text-white/80">
                  Set a specific temporary password (optional)
                </Label>
                <p className="text-xs text-white/55">
                  If off, the system will generate a new temporary password automatically.
                </p>
              </div>
            </div>

            {credUseCustomPassword ? (
              <div className="grid gap-2">
                <Label htmlFor="cred-pass">Temporary password</Label>
                <div className="relative">
                  <Input
                    id="cred-pass"
                    type={showCredPassword ? "text" : "password"}
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="bg-slate-900/70 border-white/10 text-white pr-20"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setCredPassword(genPasswordReadable())}
                      className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                      aria-label="Generate password"
                      title="Generate password"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowCredPassword((s) => !s)}
                      className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                      aria-label={showCredPassword ? "Hide password" : "Show password"}
                      title={showCredPassword ? "Hide password" : "Show password"}
                    >
                      {showCredPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-white/55">The user should change this password immediately after logging in.</p>
              </div>
            ) : null}
          </div>

          <DialogFooterUI className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCredOpen(false)}
              className="border-white/15 bg-black/50 text-white hover:text-white hover:bg-white/10"
              disabled={!!busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
              disabled={!!busy || !credUser}
              onClick={submitSendCredentials}
            >
              {busy?.action === "credentials" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send credentials
                </span>
              )}
            </Button>
          </DialogFooterUI>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}