/* eslint-disable @typescript-eslint/no-explicit-any */

import { BOOK_ROUTES } from "@/api/books/route";
import { API_BASE } from "@/api/auth/route";

export type BookDTO = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  genre: string;
  publicationYear: number;
  available: boolean;
  /**
   * Default loan duration for this book in days.
   * Used by the server when a student borrows via /borrow-records/self.
   */
  borrowDurationDays?: number | null;
};

type JsonOk<T> = { ok: true } & T;

type FetchInit = Omit<RequestInit, "body" | "credentials"> & {
  body?: BodyInit | Record<string, unknown> | null;
  asFormData?: boolean;
};

/** Safely pull a readable message out of an unknown error value */
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
    credentials: "include", // use cookies for auth session
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
  author: string;
  isbn: string;
  genre: string;
  publicationYear: number;
  available?: boolean;
  /**
   * Default loan duration for this book in days.
   * If omitted, the backend will fall back to its default (e.g. 7).
   */
  borrowDurationDays?: number;
};

export type UpdateBookPayload = Partial<CreateBookPayload>;

export async function fetchBooks(): Promise<BookDTO[]> {
  type Resp = JsonOk<{ books: BookDTO[] }>;
  const res = await requestJSON<Resp>(BOOK_ROUTES.list, { method: "GET" });
  return res.books;
}

export async function createBook(
  payload: CreateBookPayload
): Promise<BookDTO> {
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

export async function deleteBook(id: string | number): Promise<void> {
  type Resp = JsonOk<{ message?: string }>;
  await requestJSON<Resp>(BOOK_ROUTES.delete(id), {
    method: "DELETE",
  });
}
