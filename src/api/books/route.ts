import { API_BASE } from "@/api/auth/route";

// Helper to build absolute path to `/api/*`
const api = (p: string) => `${API_BASE}/api${p}`;

export const BOOK_ROUTES = {
  list: api("/books"), // GET
  create: api("/books"), // POST
  detail: (id: string | number) =>
    api(`/books/${encodeURIComponent(String(id))}`),
  update: (id: string | number) =>
    api(`/books/${encodeURIComponent(String(id))}`), // PATCH/PUT
  delete: (id: string | number) =>
    api(`/books/${encodeURIComponent(String(id))}`), // DELETE

  // ✅ NEW: add copies endpoint
  addCopies: (id: string | number) =>
    api(`/books/${encodeURIComponent(String(id))}/copies`), // POST
} as const;
