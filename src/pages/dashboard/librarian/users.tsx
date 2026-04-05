/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Users2,
  RefreshCcw,
  Loader2,
  Search,
  Check,
  X,
  Trash2,
  Save,
  ShieldAlert,
  CalendarDays,
  BadgeCheck,
  Clock3,
} from "lucide-react";
import { useSession } from "@/hooks/use-session";
import {
  type Role,
  approveUserById,
  disapproveUserById,
  deleteUserById,
} from "@/lib/authentication";
import { ROUTES } from "@/api/auth/route";

type UserRowDTO = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  accountType: Role;
  avatarUrl?: string | null;
  isApproved: boolean;
  approvedAt?: string | null;
  createdAt?: string | null;
};

type BusyState =
  | { id: string; action: "approve" | "disapprove" | "delete" | "role" }
  | null;

type ConfirmState =
  | { type: "delete"; id: string; name: string }
  | { type: "role"; id: string; name: string; from: Role; to: Role }
  | null;

const ROLE_OPTIONS: Role[] = [
  "student",
  "faculty",
  "assistant_librarian",
  "librarian",
  "admin",
];

const DISPLAY_ROLE_GROUPS: Role[] = ROLE_OPTIONS;

function roleBadgeClasses(role: Role) {
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
      return "bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500/70";
  }
}

function roleLabel(role: Role) {
  switch (role) {
    case "assistant_librarian":
      return "assistant librarian";
    default:
      return role;
  }
}

function roleDescription(role: Role) {
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

function isProtectedRole(role: Role) {
  return role === "assistant_librarian" || role === "librarian" || role === "admin";
}

function isLibrarianAssignableRole(role: Role) {
  return role === "student" || role === "faculty" || role === "assistant_librarian";
}

function uniqueRoleOptions(items: Role[]) {
  return Array.from(new Set(items)) as Role[];
}

function normalizeRole(raw: unknown): Role {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "student") return "student";
  if (value === "faculty") return "faculty";
  if (
    value === "assistant_librarian" ||
    value === "assistant librarian" ||
    value === "assistant-librarian"
  ) {
    return "assistant_librarian";
  }
  if (value === "librarian") return "librarian";
  if (value === "admin") return "admin";
  return "student";
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
  const accountType = normalizeRole(u.accountType ?? u.account_type ?? "student");
  const role = normalizeRole(u.role ?? u.userRole ?? u.user_role ?? accountType);
  const isApproved = Boolean(u.isApproved ?? u.is_approved ?? false);
  const approvedAt = (u.approvedAt ?? u.approved_at ?? null) as string | null;
  const createdAt = (u.createdAt ?? u.created_at ?? null) as string | null;
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

async function updateUserRoleRoleOnly(id: string, role: Role) {
  const data = await requestJSON<any>(ROUTES.users.updateRole(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return data;
}

export default function LibrarianUsersPage() {
  const { user: sessionUser } = useSession();
  const selfId = sessionUser?.id ? String(sessionUser.id) : "";
  const sessionRole = normalizeRole(sessionUser?.role);
  const isAdminSession = sessionRole === "admin";

  const [users, setUsers] = React.useState<UserRowDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState<BusyState>(null);
  const [roleDraft, setRoleDraft] = React.useState<Record<string, Role>>({});
  const [confirm, setConfirm] = React.useState<ConfirmState>(null);
  const [detailsUserId, setDetailsUserId] = React.useState<string | null>(null);

  const loadUsers = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await listUsersWithRole();
      setUsers(list);
      setRoleDraft((prev) => {
        const next: Record<string, Role> = { ...prev };
        for (const user of list) next[user.id] = next[user.id] ?? user.role;
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
    const counts: Record<Role, number> = {
      student: 0,
      faculty: 0,
      assistant_librarian: 0,
      librarian: 0,
      admin: 0,
      other: 0,
    };

    for (const user of users) counts[user.role] = (counts[user.role] ?? 0) + 1;
    return counts;
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
      toast.error("Disapprove failed", { description: e?.message || "Unknown error" });
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

  const onUpdateRole = async (id: string, nextRole: Role) => {
    setBusy({ id, action: "role" });
    try {
      await updateUserRoleRoleOnly(id, nextRole);
      toast.success("Role updated");
      await loadUsers();
    } catch (e: any) {
      toast.error("Role update failed", { description: e?.message || "Unknown error" });
    } finally {
      setBusy(null);
    }
  };

  const renderUserAccordion = (u: UserRowDTO) => {
    const isBusyApprove = busy?.id === u.id && busy?.action === "approve";
    const isBusyDisapprove = busy?.id === u.id && busy?.action === "disapprove";
    const isBusyDelete = busy?.id === u.id && busy?.action === "delete";
    const isBusyRole = busy?.id === u.id && busy?.action === "role";
    const anyBusyForRow = busy?.id === u.id;
    const isSelf = !!selfId && u.id === selfId;
    const draft = roleDraft[u.id] ?? u.role;
    const roleChanged = draft !== u.role;

    const exemptDelete = u.role === "admin" || u.role === "librarian";
    const targetIsProtected = isProtectedRole(u.role);
    const draftNeedsAdmin = draft === "librarian" || draft === "admin";
    const selectableRoleOptions = isAdminSession
      ? ROLE_OPTIONS
      : uniqueRoleOptions([u.role, ...ROLE_OPTIONS.filter((role) => isLibrarianAssignableRole(role))]);

    const canApprove = !u.isApproved;
    const canDisapprove = u.isApproved && !isSelf;
    const canDelete = !u.isApproved && !exemptDelete && !isSelf;
    const canChangeRole = !isSelf && (isAdminSession || (!targetIsProtected && !draftNeedsAdmin));
    const disableRoleSelect = anyBusyForRow || isSelf || (!isAdminSession && targetIsProtected);

    const roleHint = isSelf
      ? "You cannot change your own role."
      : !isAdminSession && targetIsProtected
        ? "Only admins can change assistant librarian, librarian, or admin accounts."
        : !isAdminSession && draftNeedsAdmin
          ? "Librarians cannot assign librarian or admin roles."
          : roleChanged
            ? `Pending role change: ${roleLabel(draft)}`
            : "No unsaved role changes.";

    return (
      <AccordionItem
        key={u.id}
        value={u.id}
        className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-800/60 px-0 shadow-sm transition-colors hover:border-white/20"
      >
        <AccordionTrigger className="gap-3 px-4 py-3 text-white hover:no-underline [&>svg]:mt-0.5 [&>svg]:shrink-0 [&>svg]:self-center">
          <div className="min-w-0 flex flex-1 items-center gap-3 pr-2 text-left">
            <UserAvatar name={u.fullName} email={u.email} avatarUrl={u.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {u.fullName || "Unnamed user"} • {u.email} • {roleLabel(u.role)}
              </div>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="border-t border-white/10 px-4 pb-4 pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full border-white/20 text-white/90 hover:bg-white/10 sm:w-auto"
            onClick={() => setDetailsUserId(u.id)}
          >
            Details
          </Button>
        </AccordionContent>

        <Dialog open={detailsUserId === u.id} onOpenChange={(open) => setDetailsUserId(open ? u.id : null)}>
          <DialogContent className="w-[96vw] max-h-[95svh] overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-4xl
        [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-slate-900/70
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-slate-700
        [&::-webkit-scrollbar-thumb:hover]:bg-slate-600">
            <DialogHeader>
              <DialogTitle className="pr-6">{u.fullName || "Unnamed user"}</DialogTitle>
              <DialogDescription className="text-white/70">
                Review account details, approval status, role changes, and available user actions.
              </DialogDescription>
            </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-3 min-w-0">
              <UserAvatar name={u.fullName} email={u.email} avatarUrl={u.avatarUrl} size={44} />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="max-w-full truncate text-sm font-semibold text-white">
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
                  <Badge variant="default" className={roleBadgeClasses(u.role)}>
                    {roleLabel(u.role)}
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
                <div className="text-xs uppercase tracking-wide text-white/55">Change role</div>
                <Select
                  value={draft}
                  onValueChange={(value) => setRoleDraft((prev) => ({ ...prev, [u.id]: value as Role }))}
                  disabled={disableRoleSelect}
                >
                  <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white disabled:opacity-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white border-white/10">
                    {selectableRoleOptions.map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                        disabled={!isAdminSession && (role === "librarian" || role === "admin")}
                      >
                        {roleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-white/50">{roleHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start border-white/20 text-white/90 hover:bg-white/10"
                onClick={() => {
                  if (!canChangeRole) return;
                  setConfirm({
                    type: "role",
                    id: u.id,
                    name: u.fullName || u.email,
                    from: u.role,
                    to: draft,
                  });
                }}
                disabled={!roleChanged || !canChangeRole || anyBusyForRow}
                title={
                  isSelf
                    ? "You cannot change your own role"
                    : !isAdminSession && targetIsProtected
                      ? "Only admins can change assistant librarian, librarian, or admin accounts"
                      : !isAdminSession && draftNeedsAdmin
                        ? "Librarians cannot assign librarian or admin roles"
                        : roleChanged
                          ? "Save role"
                          : "No role changes"
                }
              >
                {isBusyRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save role
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full justify-start border-white/20 text-white/90 hover:bg-white/10"
                onClick={() => onApprove(u.id)}
                disabled={!canApprove || anyBusyForRow}
                title={canApprove ? "Approve user" : "Already approved"}
              >
                {isBusyApprove ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Approve
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full justify-start border-white/20 text-white/90 hover:bg-white/10"
                onClick={() => onDisapprove(u.id)}
                disabled={!canDisapprove || anyBusyForRow}
                title={canDisapprove ? "Disapprove user" : "Cannot disapprove this user"}
              >
                {isBusyDisapprove ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Disapprove
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="w-full justify-start hover:opacity-95"
                onClick={() => setConfirm({ type: "delete", id: u.id, name: u.fullName || u.email })}
                disabled={!canDelete || anyBusyForRow}
                title={
                  canDelete
                    ? "Delete pending user"
                    : "Only pending non-librarian, non-admin users can be deleted"
                }
              >
                {isBusyDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete
              </Button>
            </div>
          </div>

          </DialogContent>
        </Dialog>
      </AccordionItem>
    );
  };

  return (
    <DashboardLayout title="Users">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users2 className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold leading-tight">Librarian user management</h2>
            <p className="text-xs text-white/70">
              Review users, approve or disapprove access, apply allowed role changes, and remove eligible pending
              accounts. Pending: <span className="font-semibold text-orange-200">{pendingCount}</span>
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
                  <div className="mt-1 text-2xl font-semibold text-orange-100">
                    {filtered.filter((u) => !u.isApproved).length}
                  </div>
                  <p className="mt-1 text-xs text-orange-100/70">Still waiting for approval or follow-up actions.</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-100/80">Approved users</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-100">
                    {filtered.filter((u) => u.isApproved).length}
                  </div>
                  <p className="mt-1 text-xs text-emerald-100/70">Currently approved and ready for role-based access.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs uppercase tracking-wide text-white/60">Showing results</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{filtered.length}</div>
                  <p className="mt-1 text-xs text-white/55">
                    Role groups stay collapsed by default, and each user opens from their own accordion card.
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
                    <AccordionTrigger className="gap-3 px-4 py-3 text-white hover:no-underline [&>svg]:shrink-0 [&>svg]:self-center">
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 pr-2 text-left sm:flex-row sm:flex-wrap sm:items-center">
                        <Badge className={roleBadgeClasses(group.role)}>{roleLabel(group.role)}</Badge>
                        <span className="text-sm font-semibold text-white">
                          {group.total} user{group.total === 1 ? "" : "s"}
                        </span>
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

      <Dialog open={!!confirm} onOpenChange={(open) => (!open ? setConfirm(null) : undefined)}>
        <DialogContent className="bg-slate-900 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {confirm?.type === "delete" ? "Delete user?" : "Change user role?"}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {confirm?.type === "delete"
                ? `Delete ${confirm.name}? This action cannot be undone.`
                : confirm
                  ? `Change ${confirm.name} from ${roleLabel(confirm.from)} to ${roleLabel(confirm.to)}?`
                  : null}
            </DialogDescription>
          </DialogHeader>

          {confirm?.type === "role" && (confirm.to === "admin" || confirm.from === "admin") ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <div className="inline-flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                <span className="font-medium">Admin role warning</span>
              </div>
              <p className="mt-1 text-xs text-amber-100/90">
                Changing admin access can affect who can manage the whole system. Make sure this update is intentional.
              </p>
            </div>
          ) : null}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-white/15 bg-black/50 text-white hover:text-white hover:bg-white/10"
              onClick={() => setConfirm(null)}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}