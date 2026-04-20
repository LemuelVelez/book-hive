/* eslint-disable @typescript-eslint/no-explicit-any */

import { BOOK_ROUTES } from "@/api/books/route";
import { API_BASE } from "@/api/auth/route";

export type Role = "student" | "librarian" | "faculty" | "admin" | "other";

export type LibraryArea =
  | "filipiniana"
  | "general_circulation"
  | "maritime"
  | "periodicals"
  | "thesis_dissertations"
  | "rizaliana"
  | "special_collection"
  | "fil_gen_reference"
  | "general_reference"
  | "fiction";

export type BookDTO = {
  id: string;

  // Primary
  accessionNumber?: string;
  title: string;
  subtitle?: string;
  author: string;
  edition?: string;

  // Identifiers
  isbn: string;
  issn?: string;

  // Classification
  subjects?: string;
  genre: string;

  // Publication
  placeOfPublication?: string;
  publisher?: string;
  publicationYear: number;
  copyrightYear?: number | null;

  // Physical description / notes
  pages?: number | null;
  otherDetails?: string;
  dimensions?: string;
  notes?: string;
  series?: string;
  category?: string;
  addedEntries?: string;

  // Copy details
  barcode?: string;
  callNumber?: string;
  copyNumber?: number | null;
  volumeNumber?: string;
  libraryArea?: LibraryArea | null;
  parentBookId?: string | null;

  /**
   * numberOfCopies = REMAINING/AVAILABLE copies for this record.
   * Backend also sends:
   * - totalCopies = total inventory copies represented by this record
   * - borrowedCopies = active borrows (status <> returned)
   */
  numberOfCopies?: number;
  totalCopies?: number;
  borrowedCopies?: number;

  /**
   * Library-use-only books are still returned in the choices/list
   * but must be visually separated in the UI and cannot be borrowed.
   */
  isLibraryUseOnly?: boolean;
  canBorrow?: boolean;

  /**
   * Borrow tracking:
   * - activeBorrowCount = how many active borrow rows currently exist
   * - totalBorrowCount = how many times this book has ever been borrowed
   */
  activeBorrowCount?: number;
  totalBorrowCount?: number;

  available: boolean;

  /**
   * Default loan duration for this book in days.
   * Used by server when borrowing via /borrow-records/self.
   */
  borrowDurationDays?: number | null;
  copies?: BookDTO[];
};

type JsonOk<T> = { ok: true } & T;

type FetchInit = Omit<RequestInit, "body" | "credentials"> & {
  body?: BodyInit | Record<string, unknown> | null;
  asFormData?: boolean;
};

function getErrorMessage(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    return typeof m === "string" ? m : "";
  }
  try {
    return JSON.stringify(e);
  } catch {
    return "";
  }
}

async function requestJSON<T = unknown>(
  url: string,
  init: FetchInit = {}
): Promise<T> {
  const { asFormData, body, headers, ...rest } = init;

  const finalInit: RequestInit = {
    credentials: "include",
    method: "GET",
    ...rest,
    headers: new Headers(headers || {}),
  };

  if (body instanceof FormData || asFormData) {
    finalInit.body = body as BodyInit;
  } else if (body !== undefined && body !== null) {
    (finalInit.headers as Headers).set("Content-Type", "application/json");
    finalInit.body = JSON.stringify(body);
  }

  let resp: Response;
  try {
    resp = await fetch(url, finalInit);
  } catch (e) {
    const details = getErrorMessage(e);
    const tail = details ? ` Details: ${details}` : "";
    throw new Error(
      `Cannot reach the API (${API_BASE}). Is the server running and allowing this origin?${tail}`
    );
  }

  const ct = resp.headers.get("content-type")?.toLowerCase() || "";
  const isJson = ct.includes("application/json");

  if (!resp.ok) {
    let message = `HTTP ${resp.status}`;
    if (isJson) {
      try {
        const data = (await resp.json()) as unknown;
        if (
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
        ) {
          message = (data as { message: string }).message;
        }
      } catch {
        // ignore JSON parse error
      }
    } else {
      try {
        const text = await resp.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  return (isJson ? resp.json() : (null as any)) as Promise<T>;
}

/* ----------------------- Public Books API ----------------------- */

export type CreateBookPayload = {
  title: string;
  author?: string;

  subtitle?: string;
  edition?: string;

  // Identifiers
  isbn?: string;
  issn?: string;
  accessionNumber?: string;

  // Classification
  subjects?: string;
  genre?: string;
  category?: string;

  // Publication
  publicationYear?: number;
  placeOfPublication?: string;
  publisher?: string;
  copyrightYear?: number | null;

  // Physical description / notes
  pages?: number | string | null;
  otherDetails?: string;
  dimensions?: string;
  notes?: string;
  series?: string;
  addedEntries?: string;

  // Copy details
  barcode?: string;
  callNumber?: string;
  copyNumber?: number | null;
  volumeNumber?: string;
  libraryArea?: LibraryArea | null;

  /**
   * TOTAL inventory copies represented by this record.
   * For the librarian catalog UI, new records are saved as one physical copy.
   */
  numberOfCopies?: number;

  /**
   * Availability may be computed by backend based on remaining copies.
   */
  available?: boolean;

  /**
   * Library-use-only books remain visible in book choices
   * but are blocked from actual borrowing.
   */
  isLibraryUseOnly?: boolean;
  canBorrow?: boolean;

  /**
   * Default loan duration in days.
   */
  borrowDurationDays?: number;
};

export type UpdateBookPayload = Partial<CreateBookPayload> & {
  copiesToAdd?: number;
};

export type AddBookCopyPayload = Partial<CreateBookPayload> & {
  count?: number;
  copiesToAdd?: number;
  numberOfCopies?: number;
  accessionNumber?: string;
  copyNumber?: number;
  barcode?: string;
  callNumber?: string;
  volumeNumber?: string;
  libraryArea?: LibraryArea | null;
  borrowDurationDays?: number;
  available?: boolean;
  isLibraryUseOnly?: boolean;
};

export async function fetchBooks(): Promise<BookDTO[]> {
  type Resp = JsonOk<{ books: BookDTO[] }>;
  const res = await requestJSON<Resp>(BOOK_ROUTES.list, { method: "GET" });
  return res.books;
}

export async function createBook(payload: CreateBookPayload): Promise<BookDTO> {
  type Resp = JsonOk<{ book: BookDTO }>;
  const res = await requestJSON<Resp>(BOOK_ROUTES.create, {
    method: "POST",
    body: payload,
  });
  return res.book;
}

export async function updateBook(
  id: string | number,
  payload: UpdateBookPayload
): Promise<BookDTO> {
  type Resp = JsonOk<{ book: BookDTO }>;
  const res = await requestJSON<Resp>(BOOK_ROUTES.update(id), {
    method: "PATCH",
    body: payload,
  });
  return res.book;
}

export async function updateBookCopy(
  id: string | number,
  payload: UpdateBookPayload
): Promise<BookDTO> {
  return updateBook(id, payload);
}

export async function addBookCopy(
  id: string | number,
  payload: AddBookCopyPayload
): Promise<BookDTO> {
  type Resp = JsonOk<{ book: BookDTO }>;
  const res = await requestJSON<Resp>(BOOK_ROUTES.addCopies(id), {
    method: "POST",
    body: payload,
  });
  return res.book;
}

export async function addBookCopies(
  id: string | number,
  count: number
): Promise<BookDTO> {
  type Resp = JsonOk<{ book: BookDTO }>;
  const res = await requestJSON<Resp>(BOOK_ROUTES.addCopies(id), {
    method: "POST",
    body: { count },
  });
  return res.book;
}

export async function deleteBook(id: string | number): Promise<void> {
  type Resp = JsonOk<{ message?: string }>;
  await requestJSON<Resp>(BOOK_ROUTES.delete(id), {
    method: "DELETE",
  });
}

export async function deleteBookCopy(id: string | number): Promise<void> {
  await deleteBook(id);
}
