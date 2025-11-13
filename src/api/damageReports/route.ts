import { API_BASE } from "@/api/auth/route";

// Helper to build absolute path to `/api/*`
const api = (p: string) => `${API_BASE}/api${p}`;

export const DAMAGE_ROUTES = {
    list: api("/damage-reports"), // GET (librarian/admin)
    create: api("/damage-reports"), // POST (student + staff)
    my: api("/damage-reports/my"), // GET (current user's reports)
    update: (id: string | number) =>
        api(`/damage-reports/${encodeURIComponent(String(id))}`), // PATCH
    delete: (id: string | number) =>
        api(`/damage-reports/${encodeURIComponent(String(id))}`), // DELETE (librarian/admin)
} as const;
