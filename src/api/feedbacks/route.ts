import { API_BASE } from "@/api/auth/route";

// Helper to build absolute path to `/api/*`
const api = (p: string) => `${API_BASE}/api${p}`;

export const FEEDBACK_ROUTES = {
    list: api("/feedbacks"), // GET (librarian/admin)
    create: api("/feedbacks"), // POST (student + staff)
    my: api("/feedbacks/my"), // GET (current user's feedbacks)
} as const;
