import type { BookDTO } from "@/lib/books"
import type { BorrowRecordDTO } from "@/lib/borrows"

export type FilterMode =
    | "all"
    | "available"
    | "unavailable"
    | "borrowedByMe"
    | "history"

export type AvailabilityFilter = "all" | "available" | "unavailable"

export type FacultySortOption =
    | "catalog"
    | "call_no_asc"
    | "call_no_desc"
    | "accession_asc"
    | "accession_desc"
    | "title_asc"
    | "title_desc"
    | "author_asc"
    | "author_desc"
    | "pub_year_desc"
    | "pub_year_asc"

export type BookWithStatus = BookDTO & {
    myStatus: "never" | "active" | "returned"
    activeRecords: BorrowRecordDTO[]
    lastReturnedRecord?: BorrowRecordDTO | null
    lastRecord?: BorrowRecordDTO | null
}