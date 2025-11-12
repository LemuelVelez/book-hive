import { API_BASE } from "@/api/auth/route";

// Helper to build absolute path to `/api/*`
const api = (p: string) => `${API_BASE}/api${p}`;

export const BORROW_ROUTES = {
    list: api("/borrow-records"),           // GET
    create: api("/borrow-records"),         // POST
    detail: (id: string | number) =>
        api(`/borrow-records/${encodeURIComponent(String(id))}`), // GET (future)
    update: (id: string | number) =>
        api(`/borrow-records/${encodeURIComponent(String(id))}`), // PATCH
    delete: (id: string | number) =>
        api(`/borrow-records/${encodeURIComponent(String(id))}`), // DELETE (optional)
} as const;
