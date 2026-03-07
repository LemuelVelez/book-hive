import type { BookDTO } from "@/lib/books";
import type { BorrowRecordDTO } from "@/lib/borrows";

export type BookWithStatus = BookDTO & {
    myStatus: "never" | "active" | "returned";
    activeRecords: BorrowRecordDTO[];
    lastReturnedRecord?: BorrowRecordDTO | null;
    lastRecord?: BorrowRecordDTO | null;
};