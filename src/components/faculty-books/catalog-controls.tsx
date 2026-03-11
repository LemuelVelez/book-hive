import { ArrowUpDown, Filter, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import type {
    AvailabilityFilter,
    FacultySortOption,
    FilterMode,
} from "@/components/faculty-books/types"

type FacultyBooksCatalogControlsProps = {
    rowsCount: number
    booksCount: number
    search: string
    onSearchChange: (value: string) => void
    filterMode: FilterMode
    onFilterModeChange: (value: FilterMode) => void
    availabilityFilter: AvailabilityFilter
    onAvailabilityFilterChange: (value: AvailabilityFilter) => void
    sortOption: FacultySortOption
    onSortOptionChange: (value: FacultySortOption) => void
    onClear: () => void
    hasCatalogControlsApplied: boolean
    maxActiveBorrows: number
    defaultBorrowDurationDays: number
    activeBorrowCount: number
    remainingBorrowSlots: number
}

export function FacultyBooksCatalogControls({
    rowsCount,
    booksCount,
    search,
    onSearchChange,
    filterMode,
    onFilterModeChange,
    availabilityFilter,
    onAvailabilityFilterChange,
    sortOption,
    onSortOptionChange,
    onClear,
    hasCatalogControlsApplied,
    maxActiveBorrows,
    defaultBorrowDurationDays,
    activeBorrowCount,
    remainingBorrowSlots,
}: FacultyBooksCatalogControlsProps) {
    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold">Books you can borrow</h3>
                    <p className="text-xs text-white/70">
                        Showing {rowsCount} of {booksCount} {booksCount === 1 ? "book" : "books"}.
                    </p>
                    <p className="text-xs text-amber-100/90">
                        Faculty policy: up to {maxActiveBorrows} active books, default borrow
                        duration of {defaultBorrowDurationDays} days. You currently have{" "}
                        <span className="font-semibold">{activeBorrowCount}</span> active
                        book{activeBorrowCount === 1 ? "" : "s"} and{" "}
                        <span className="font-semibold">{remainingBorrowSlots}</span> remaining
                        slot{remainingBorrowSlots === 1 ? "" : "s"}.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <div className="relative min-w-0 md:col-span-2 xl:col-span-4">
                        <Search
                            className="absolute left-3 top-2.5 h-4 w-4 text-white/50"
                            aria-hidden="true"
                        />
                        <Input
                            type="search"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search call no., accession, title, subtitle, author, ISBN, subjects…"
                            autoComplete="off"
                            aria-label="Search books"
                            className="pl-9 bg-slate-900/70 border-white/20 text-white"
                        />
                    </div>

                    <Select
                        value={filterMode}
                        onValueChange={(value) => onFilterModeChange(value as FilterMode)}
                    >
                        <SelectTrigger
                            className="w-full bg-slate-900/70 border-white/20 text-white"
                            aria-label="Filter my books"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="h-4 w-4 text-white/60" />
                                <SelectValue placeholder="My records filter" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 text-white border-white/10">
                            <SelectItem value="all">All books</SelectItem>
                            <SelectItem value="available">Available only</SelectItem>
                            <SelectItem value="unavailable">Unavailable only</SelectItem>
                            <SelectItem value="borrowedByMe">Borrowed by me</SelectItem>
                            <SelectItem value="history">My history</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={availabilityFilter}
                        onValueChange={(value) =>
                            onAvailabilityFilterChange(value as AvailabilityFilter)
                        }
                    >
                        <SelectTrigger
                            className="w-full bg-slate-900/70 border-white/20 text-white"
                            aria-label="Availability filter"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="h-4 w-4 text-white/60" />
                                <SelectValue placeholder="Availability" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 text-white border-white/10">
                            <SelectItem value="all">All availability</SelectItem>
                            <SelectItem value="available">Available only</SelectItem>
                            <SelectItem value="unavailable">Unavailable only</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={sortOption}
                        onValueChange={(value) => onSortOptionChange(value as FacultySortOption)}
                    >
                        <SelectTrigger
                            className="w-full bg-slate-900/70 border-white/20 text-white"
                            aria-label="Sort books"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <ArrowUpDown className="h-4 w-4 text-white/60" />
                                <SelectValue placeholder="Sort books" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 text-white border-white/10">
                            <SelectItem value="catalog">Catalog order</SelectItem>
                            <SelectItem value="call_no_asc">Call no. (A–Z)</SelectItem>
                            <SelectItem value="call_no_desc">Call no. (Z–A)</SelectItem>
                            <SelectItem value="accession_asc">Accession no. (A–Z)</SelectItem>
                            <SelectItem value="accession_desc">Accession no. (Z–A)</SelectItem>
                            <SelectItem value="title_asc">Title (A–Z)</SelectItem>
                            <SelectItem value="title_desc">Title (Z–A)</SelectItem>
                            <SelectItem value="author_asc">Author (A–Z)</SelectItem>
                            <SelectItem value="author_desc">Author (Z–A)</SelectItem>
                            <SelectItem value="pub_year_desc">
                                Publication year (Newest first)
                            </SelectItem>
                            <SelectItem value="pub_year_asc">
                                Publication year (Oldest first)
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-4 sm:flex-row sm:flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={onClear}
                            disabled={!hasCatalogControlsApplied}
                        >
                            <X className="mr-2 h-4 w-4" />
                            Clear
                        </Button>
                    </div>
                </div>
            </div>

            <p className="mt-2 text-[11px] text-white/60">
                When you borrow a book online, its status starts as{" "}
                <span className="font-semibold text-amber-200">Pending pickup</span> until a
                librarian confirms pickup. After confirmation it will appear as{" "}
                <span className="font-semibold text-emerald-200">Borrowed</span>.
            </p>
        </>
    )
}