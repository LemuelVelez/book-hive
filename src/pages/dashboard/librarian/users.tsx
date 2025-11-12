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
import { Users2, RefreshCcw, Loader2, Search } from "lucide-react";
import { API_BASE } from "@/api/auth/route";

type Role = "student" | "librarian" | "faculty" | "admin" | "other";

type UserRow = {
    id: string;
    email: string;
    fullName: string;
    accountType: Role;
};

// Try to normalize possibly different server payload shapes
function normalizeUser(u: any): UserRow | null {
    if (!u) return null;
    const id = String(u.id ?? "").trim();
    const email = String(u.email ?? "").trim();
    const fullName = String(u.fullName ?? u.full_name ?? "").trim();
    const roleRaw = (u.accountType ?? u.role ?? "student") as string;

    if (!id || !email) return null;

    const accountType: Role =
        roleRaw === "librarian" ||
            roleRaw === "faculty" ||
            roleRaw === "admin" ||
            roleRaw === "other"
            ? (roleRaw as Role)
            : "student";

    return { id, email, fullName, accountType };
}

async function fetchUsersFromApi(): Promise<UserRow[]> {
    const endpoint = `${API_BASE}/api/users`;
    const res = await fetch(endpoint, { method: "GET", credentials: "include" });

    // If the endpoint doesn't exist yet, surface a helpful message.
    if (!res.ok) {
        const msgText = (await res.text()).trim() || `HTTP ${res.status}`;
        throw new Error(
            `Failed to fetch users from ${endpoint}. ${msgText || ""}`.trim()
        );
    }

    // Accept either an array or an object with { users: [...] }
    let data: any = null;
    try {
        data = await res.json();
    } catch {
        throw new Error("Server responded with invalid JSON.");
    }

    const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];

    const normalized: UserRow[] = arr
        .map(normalizeUser)
        .filter(Boolean) as UserRow[];

    return normalized;
}

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

export default function LibrarianUsersPage() {
    const [users, setUsers] = React.useState<UserRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState("");

    const loadUsers = React.useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const list = await fetchUsersFromApi();
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
                u.fullName.toLowerCase().includes(q) ||
                u.accountType.toLowerCase().includes(q)
            );
        });
    }, [users, search]);

    return (
        <DashboardLayout title="Users">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Users2 className="h-5 w-5" />
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Users directory</h2>
                        <p className="text-xs text-white/70">
                            Read-only list of registered users (ID, Email, Name, Role).
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
                    >
                        {refreshing || loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCcw className="h-4 w-4" />
                        )}
                        <span className="sr-only">Refresh</span>
                    </Button>
                </div>
            </div>

            <Card className="bg-slate-800/60 border-white/10">
                <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle>Users</CardTitle>

                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by ID, email, name, role…"
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
                            <span className="text-xs opacity-80">
                                Try a different search.
                            </span>
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
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Email
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Full name
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold text-white/70">
                                        Role
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((u) => (
                                    <TableRow
                                        key={u.id}
                                        className="border-white/5 hover:bg-white/5 transition-colors"
                                    >
                                        <TableCell className="text-xs opacity-80 max-w-[180px] truncate font-mono">
                                            {u.id}
                                        </TableCell>
                                        <TableCell className="text-sm opacity-90">{u.email}</TableCell>
                                        <TableCell className="text-sm">
                                            {u.fullName || <span className="opacity-50">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="default"
                                                className={roleBadgeClasses(u.accountType)}
                                            >
                                                {u.accountType}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Note: This page is intentionally read-only for the Librarian role. */}
        </DashboardLayout>
    );
}
