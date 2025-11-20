import { API_BASE } from "@/api/auth/route";

// Helper to build absolute path to `/api/*`
const api = (p: string) => `${API_BASE}/api${p}`;

export const FINES_ROUTES = {
    my: api("/fines/my"), // GET (current user's fines)
    list: api("/fines"), // GET (librarian/admin)
    detail: (id: string | number) =>
        api(`/fines/${encodeURIComponent(String(id))}`), // not used yet
    update: (id: string | number) =>
        api(`/fines/${encodeURIComponent(String(id))}`), // PATCH (librarian/admin)
    pay: (id: string | number) =>
        api(`/fines/${encodeURIComponent(String(id))}/pay`), // POST (student pay -> pending_verification)
    uploadProofs: (id: string | number) =>
        api(`/fines/${encodeURIComponent(String(id))}/proofs`), // POST (upload proof images + metadata)
} as const;
