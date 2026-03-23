/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  "other",
  "faculty",
  "assistant_librarian",
  "librarian",
  "admin",
];

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
    case "other":
      return "bg-slate-600/80 hover:bg-slate-600 text-white border-slate-500/70";
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

function approvalBadgeClasses(approved: boolean) {
  return approved
    ? "bg-emerald-600/80 hover:bg-emerald-600 text-white border-emerald-500/70"
    : "bg-orange-600/80 hover:bg-orange-600 text-white border-orange-500/70";
}

function isPrivilegedRole(role: Role) {
  return role === "assistant_librarian" || role === "librarian" || role === "admin";
}

function normalizeRole(raw: unknown): Role {
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
  return "other";
}

function uniqueRoleOptions(roles: Role[]) {
  return Array.from(new Set(roles)) as Role[];
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
      className="rounded-full overflow-hidden border border-white/10 bg-slate-900/40 flex items-center justify-center"
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
        <span className="text-xs font-semibold text-white/80">{initialsFromName(label)}</span>
      )}
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
  const sessionRole = normalizeRole(sessionUser?.role ?? sessionUser?.accountType ?? "other");
  const isAdminSession = sessionRole === "admin";
  const isLibrarianSession = sessionRole === "librarian";

  const [users, setUsers] = React.useState<UserRowDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState<BusyState>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState>(null);
  const [roleDraft, setRoleDraft] = React.useState<Record<string, Role>>({});

  const loadUsers = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await listUsersWithRole();
      setUsers(list);
      setRoleDraft((prev) => {
        const next = { ...prev };
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
    void loadUsers();
  }, [loadUsers]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadUsers();
    } finally {
      setRefreshing(false);
    }
  }

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
        roleLabel(u.role).toLowerCase().includes(q) ||
        roleLabel(u.accountType).toLowerCase().includes(q) ||
        (u.isApproved ? "approved" : "pending").includes(q)
      );
    });
  }, [search, users]);

  const pendingCount = React.useMemo(() => users.filter((u) => !u.isApproved).length, [users]);

  const countsByRole = React.useMemo(() => {
    const map: Record<Role, number> = {
      student: 0,
      other: 0,
      faculty: 0,
      assistant_librarian: 0,
      librarian: 0,
      admin: 0,
    };

    for (const user of users) {
      map[user.role] = (map[user.role] ?? 0) + 1;
    }

    return map;
  }, [users]);

  async function onApprove(id: string) {
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
  }

  async function onDisapprove(id: string) {
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
  }

  async function onDelete(id: string) {
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
  }

  async function onUpdateRole(id: string, role: Role) {
    setBusy({ id, action: "role" });
    try {
      await updateUserRoleRoleOnly(id, role);
      toast.success("User role updated");
      await loadUsers();
    } catch (e: any) {
      toast.error("Role update failed", { description: e?.message || "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardLayout title="Users">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users2 className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold leading-tight">Users directory</h2>
            <p className="text-xs text-white/70">
              {isAdminSession
                ? "Admins can approve accounts, remove users, and change all user roles."
                : isLibrarianSession
                  ? "Librarians can approve accounts, remove pending users, and change student, other, and faculty roles."
                  : "Manage users, approvals, and eligible role changes."}
              {" "}
              Pending: <span className="font-semibold text-orange-200">{pendingCount}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/70">
              {ROLE_OPTIONS.map((role) => (
                <span key={role} className="inline-flex items-center gap-1">
                  <Badge className={roleBadgeClasses(role)}>{roleLabel(role)}</Badge>
                  <span className="opacity-80">{countsByRole[role]}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

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

        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
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
            <Table>
              <TableCaption className="text-xs text-white/60">
                Showing {filtered.length} {filtered.length === 1 ? "user" : "users"}.
              </TableCaption>

              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="w-24 text-xs font-semibold text-white/70">User ID</TableHead>
                  <TableHead className="w-16 text-xs font-semibold text-white/70">Photo</TableHead>
                  <TableHead className="text-xs font-semibold text-white/70">Email</TableHead>
                  <TableHead className="text-xs font-semibold text-white/70">Full name</TableHead>
                  <TableHead className="text-xs font-semibold text-white/70">Role</TableHead>
                  <TableHead className="text-xs font-semibold text-white/70">Approval</TableHead>
                  <TableHead className="text-xs font-semibold text-white/70 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.map((u) => {
                  const isBusyApprove = busy?.id === u.id && busy?.action === "approve";
                  const isBusyDisapprove = busy?.id === u.id && busy?.action === "disapprove";
                  const isBusyDelete = busy?.id === u.id && busy?.action === "delete";
                  const isBusyRole = busy?.id === u.id && busy?.action === "role";
                  const anyBusyForRow = busy?.id === u.id;
                  const isSelf = !!selfId && u.id === selfId;
                  const roleDraftValue = roleDraft[u.id] ?? u.role;
                  const roleChanged = roleDraftValue !== u.role;

                  const exemptDelete = u.role === "admin" || u.role === "librarian";
                  const targetIsPrivileged = isPrivilegedRole(u.role);
                  const draftIsPrivileged = isPrivilegedRole(roleDraftValue);
                  const selectableRoleOptions = isAdminSession
                    ? ROLE_OPTIONS
                    : uniqueRoleOptions([u.role, ...ROLE_OPTIONS.filter((role) => !isPrivilegedRole(role))]);
                  const canApprove = !u.isApproved;
                  const canDisapprove = u.isApproved && !isSelf;
                  const canDelete = !u.isApproved && !exemptDelete && !isSelf;
                  const canChangeRole =
                    !isSelf &&
                    (isAdminSession || (!targetIsPrivileged && !draftIsPrivileged));
                  const disableRoleSelect = anyBusyForRow || isSelf || (!isAdminSession && targetIsPrivileged);
                  const roleSaveTitle = isSelf
                    ? "You cannot change your own role"
                    : !isAdminSession && targetIsPrivileged
                      ? "Only admins can change assistant librarian, librarian, or admin accounts"
                      : !isAdminSession && draftIsPrivileged
                        ? "Librarians cannot assign assistant librarian, librarian, or admin roles"
                        : roleChanged
                          ? "Save role"
                          : "No role changes";

                  return (
                    <TableRow key={u.id} className="border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell className="text-xs opacity-80 max-w-56 truncate font-mono">
                        {u.id}
                        {isSelf ? (
                          <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80">you</span>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <UserAvatar name={u.fullName} email={u.email} avatarUrl={u.avatarUrl} size={34} />
                      </TableCell>

                      <TableCell className="text-sm opacity-90">{u.email}</TableCell>

                      <TableCell className="text-sm">{u.fullName || <span className="opacity-50">—</span>}</TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                            <Badge variant="default" className={roleBadgeClasses(u.role)}>
                              {roleLabel(u.role)}
                            </Badge>

                            <Select
                              value={roleDraftValue}
                              onValueChange={(value) => setRoleDraft((prev) => ({ ...prev, [u.id]: value as Role }))}
                              disabled={disableRoleSelect}
                            >
                              <SelectTrigger className="h-8 w-full lg:w-44 bg-slate-900/70 border-white/20 text-white disabled:opacity-60">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 text-white border-white/10">
                                {selectableRoleOptions.map((role) => (
                                  <SelectItem
                                    key={role}
                                    value={role}
                                    disabled={!isAdminSession && isPrivilegedRole(role)}
                                  >
                                    {roleLabel(role)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="text-xs text-white/45">
                            Account type (info): <span className="text-white/70">{roleLabel(u.accountType)}</span>
                          </div>

                          {roleChanged ? (
                            <div className="text-xs text-white/50">
                              Pending role change: <span className="font-medium text-white/80">{roleLabel(roleDraftValue)}</span>
                            </div>
                          ) : null}

                          {isSelf ? <div className="text-xs text-white/50">You cannot change your own role.</div> : null}
                          {!isSelf && !isAdminSession && targetIsPrivileged ? (
                            <div className="text-xs text-white/50">
                              Only admins can change assistant librarian, librarian, or admin accounts.
                            </div>
                          ) : null}
                          {!isSelf && isLibrarianSession && !targetIsPrivileged ? (
                            <div className="text-xs text-white/50">
                              Librarians can assign student, other, or faculty roles only.
                            </div>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="default" className={approvalBadgeClasses(u.isApproved)}>
                          {u.isApproved ? "approved" : "pending"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2 flex-wrap justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            disabled={!roleChanged || !canChangeRole || anyBusyForRow}
                            onClick={() =>
                              setConfirm({
                                type: "role",
                                id: u.id,
                                name: u.fullName || u.email,
                                from: u.role,
                                to: roleDraftValue,
                              })
                            }
                            title={roleSaveTitle}
                            aria-label="Save role"
                          >
                            {isBusyRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={() => onApprove(u.id)}
                            disabled={!canApprove || anyBusyForRow}
                            title={canApprove ? "Approve user" : "Already approved"}
                            aria-label="Approve user"
                          >
                            {isBusyApprove ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={() => onDisapprove(u.id)}
                            disabled={!canDisapprove || anyBusyForRow}
                            title={canDisapprove ? "Disapprove user" : "Cannot disapprove this user"}
                            aria-label="Disapprove user"
                          >
                            {isBusyDisapprove ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="hover:opacity-95"
                            onClick={() => setConfirm({ type: "delete", id: u.id, name: u.fullName || u.email })}
                            disabled={!canDelete || anyBusyForRow}
                            title={canDelete ? "Delete pending user" : "Only pending non-librarian, non-admin users can be deleted"}
                          >
                            {isBusyDelete ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
                  if (!confirm || confirm.type !== "delete") return;
                  const { id } = confirm;
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
