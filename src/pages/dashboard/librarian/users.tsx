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
import { toast } from "sonner";
import {
    Users2,
    RefreshCcw,
    Loader2,
    Search,
    Check,
    X,
    Trash2,
} from "lucide-react";
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

    /**
     * ✅ role is used for authorization/guards
     */
    role: Role;

    /**
     * accountType is informational only
     */
    accountType: Role;

    // ✅ display picture
    avatarUrl?: string | null;

    isApproved: boolean;
    approvedAt?: string | null;
    createdAt?: string | null;
};

function roleBadgeClasses(role: Role) {
    switch (role) {
        case "admin":
            return "bg-red-600/80 hover:bg-red-600 text-white border-red-500/70";
        case "librarian":
            return "bg-purple-600/80 hover:bg-purple-600 text-white border-purple-500/70";
        case "faculty":
            return "bg-amber-600/80 hover:bg-amber-600 text-white border-amber-500/70";
        case "other":
            return "bg-slate-600/80 hover:bg-slate-600 text-white border-slate-500/70";
        default:
            return "bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500/70"; // student
    }
}

function approvalBadgeClasses(approved: boolean) {
    return approved
        ? "bg-emerald-600/80 hover:bg-emerald-600 text-white border-emerald-500/70"
        : "bg-orange-600/80 hover:bg-orange-600 text-white border-orange-500/70";
}

type BusyState =
    | { id: string; action: "approve" | "disapprove" | "delete" }
    | null;

function normalizeRole(raw: unknown): Role {
    const v = String(raw ?? "").trim().toLowerCase();
    if (v === "student") return "student";
    if (v === "librarian") return "librarian";
    if (v === "faculty") return "faculty";
    if (v === "admin") return "admin";
    return "other";
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
                <span className="text-[11px] font-semibold text-white/80">
                    {initialsFromName(label)}
                </span>
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
    const arr: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.users)
            ? data.users
            : [];
    return arr.map(normalizeUserRow).filter(Boolean) as UserRowDTO[];
}

export default function LibrarianUsersPage() {
    const [users, setUsers] = React.useState<UserRowDTO[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState("");
    const [busy, setBusy] = React.useState<BusyState>(null);

    const loadUsers = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const list = await listUsersWithRole();
            setUsers(list);
        } catch (err: any) {
            const msg =
                err?.message ||
                "Failed to load users. Ensure the backend has GET /api/users.";
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

    const pendingCount = React.useMemo(
        () => users.filter((u) => !u.isApproved).length,
        [users]
    );

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

    return (
        <DashboardLayout title="Users">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Users2 className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Users directory</h2>
                        <p className="text-xs text-white/70">
                            Manage newly registered users (approve/disapprove/delete). Pending:{" "}
                            <span className="font-semibold text-orange-200">{pendingCount}</span>
                        </p>
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
                        {refreshing || loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCcw className="h-4 w-4" />
                        )}
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
                                    <TableHead className="w-[90px] text-xs font-semibold text-white/70">
                                        User ID
                                    </TableHead>
                                    <TableHead className="w-16 text-xs font-semibold text-white/70">
                                        Photo
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Email</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Full name</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Role</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">Approval</TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((u) => {
                                    const isBusyApprove = busy?.id === u.id && busy?.action === "approve";
                                    const isBusyDisapprove = busy?.id === u.id && busy?.action === "disapprove";
                                    const isBusyDelete = busy?.id === u.id && busy?.action === "delete";
                                    const anyBusyForRow = busy?.id === u.id;

                                    /**
                                     * ✅ Use ROLE for rules/guards.
                                     * accountType is informational only.
                                     */
                                    const exempt = u.role === "admin" || u.role === "librarian";

                                    const canApprove = !u.isApproved && !exempt;
                                    const canDisapprove = u.isApproved && !exempt;
                                    const canDelete = !u.isApproved && !exempt;

                                    return (
                                        <TableRow
                                            key={u.id}
                                            className="border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell className="text-xs opacity-80 max-w-[180px] truncate font-mono">
                                                {u.id}
                                            </TableCell>

                                            <TableCell>
                                                <UserAvatar
                                                    name={u.fullName}
                                                    email={u.email}
                                                    avatarUrl={u.avatarUrl}
                                                    size={34}
                                                />
                                            </TableCell>

                                            <TableCell className="text-sm opacity-90">{u.email}</TableCell>

                                            <TableCell className="text-sm">
                                                {u.fullName || <span className="opacity-50">—</span>}
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="default" className={roleBadgeClasses(u.role)}>
                                                        {u.role}
                                                    </Badge>
                                                    <div className="text-[11px] text-white/45">
                                                        Account type (info):{" "}
                                                        <span className="text-white/70">{u.accountType}</span>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <Badge variant="default" className={approvalBadgeClasses(u.isApproved)}>
                                                    {u.isApproved ? "approved" : "pending"}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    {/* Approve */}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="border-white/20 text-white/90 hover:bg-white/10"
                                                        onClick={() => onApprove(u.id)}
                                                        disabled={!canApprove || anyBusyForRow}
                                                        title={
                                                            canApprove
                                                                ? "Approve user"
                                                                : "Cannot approve (already approved or exempt role)"
                                                        }
                                                        aria-label="Approve user"
                                                    >
                                                        {isBusyApprove ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Check className="h-4 w-4" />
                                                        )}
                                                    </Button>

                                                    {/* Disapprove */}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="border-white/20 text-white/90 hover:bg-white/10"
                                                        onClick={() => onDisapprove(u.id)}
                                                        disabled={!canDisapprove || anyBusyForRow}
                                                        title={
                                                            canDisapprove
                                                                ? "Disapprove user"
                                                                : "Cannot disapprove (pending or exempt role)"
                                                        }
                                                        aria-label="Disapprove user"
                                                    >
                                                        {isBusyDisapprove ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <X className="h-4 w-4" />
                                                        )}
                                                    </Button>

                                                    {/* Delete */}
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="destructive"
                                                        className="hover:opacity-95"
                                                        onClick={() => onDelete(u.id)}
                                                        disabled={!canDelete || anyBusyForRow}
                                                        title={
                                                            canDelete
                                                                ? "Delete newly registered user"
                                                                : "Only pending, non-exempt users can be deleted"
                                                        }
                                                    >
                                                        {isBusyDelete ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                        <span className="ml-1">Delete</span>
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
        </DashboardLayout>
    );
}
