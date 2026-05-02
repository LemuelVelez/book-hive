import { API_BASE } from "@/api/auth/route";

// Helper to build absolute path to `/api/*`
const api = (p: string) => `${API_BASE}/api${p}`;

export const BORROW_ROUTES = {
  list: api("/borrow-records"), // GET (librarian/admin)
  create: api("/borrow-records"), // POST (librarian/admin)
  detail: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}`), // GET (future)
  update: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}`), // PATCH
  delete: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}`), // DELETE (optional)

  my: api("/borrow-records/my"), // GET (current user's borrow records)
  summary: api("/borrow-records/summary"), // GET (staff notification summary)
  createSelf: api("/borrow-records/self"), // POST (student/faculty self-service borrow)

  // optional policy endpoints for role-based borrowing rules
  policies: api("/borrow-records/policies"), // GET
  policyByRole: (role: string) =>
    api(`/borrow-records/policies/${encodeURIComponent(String(role))}`), // GET

  // extend due date
  // - student/guest/faculty: creates an extension request (pending)
  // - librarian/admin: can directly extend immediately (approved)
  extend: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}/extend`), // POST

  // librarian/admin decision routes
  extendApprove: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}/extend/approve`), // POST
  extendDisapprove: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}/extend/disapprove`), // POST

  // librarian/admin can request the borrower to return the book
  requestReturn: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}/request-return`), // POST

  // damage reports are filed by librarian/admin users and read-only for borrowers
  damageReports: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}/damage-reports`), // GET
  createDamageReport: (id: string | number) =>
    api(`/borrow-records/${encodeURIComponent(String(id))}/damage-reports`), // POST

  // sync dashboard-style borrow notifications to email
  emailNotificationSync: api("/borrow-records/notifications/email-sync"), // POST
} as const;