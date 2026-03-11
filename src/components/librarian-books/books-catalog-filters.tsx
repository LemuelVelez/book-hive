import { ArrowUpDown, Filter, Search, X } from "lucide-react";

import { BooksExcelPreviewDialog } from "@/components/librarian-books/books-excel-preview-dialog";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { BookDTO } from "@/lib/books";
import {
    type CatalogAvailabilityFilter,
    type CatalogSortOption,
    formatLibraryAreaLabel,
} from "./books-constants";

type BooksCatalogFiltersProps = {
    booksCount: number;
    filteredCount: number;
    booksForExcel: BookDTO[];
    search: string;
    onSearchChange: (value: string) => void;
    libraryAreaChoices: string[];
    libraryAreaFilter: string;
    onLibraryAreaFilterChange: (value: string) => void;
    availabilityFilter: CatalogAvailabilityFilter;
    onAvailabilityFilterChange: (value: CatalogAvailabilityFilter) => void;
    sortOption: CatalogSortOption;
    onSortOptionChange: (value: CatalogSortOption) => void;
    onClear: () => void;
    hasApplied: boolean;
};

export function BooksCatalogFilters({
    booksCount,
    filteredCount,
    booksForExcel,
    search,
    onSearchChange,
    libraryAreaChoices,
    libraryAreaFilter,
    onLibraryAreaFilterChange,
    availabilityFilter,
    onAvailabilityFilterChange,
    sortOption,
    onSortOptionChange,
    onClear,
    hasApplied,
}: BooksCatalogFiltersProps) {
    return (
        <CardHeader className="pb-2">
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                        <CardTitle>Books catalog</CardTitle>
                        <p className="text-xs text-white/70">
                            Showing {filteredCount} of {booksCount}{" "}
                            {booksCount === 1 ? "book" : "books"}.
                        </p>
                    </div>

                    <div className="relative min-w-0 sm:w-full sm:max-w-sm lg:max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                        <Input
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search keyword, call no., accession, title, author, publisher, subjects, inventory…"
                            className="border-white/20 bg-slate-900/70 pl-9 text-white"
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    <Select
                        value={libraryAreaFilter}
                        onValueChange={onLibraryAreaFilterChange}
                    >
                        <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="h-4 w-4 text-white/60" />
                                <SelectValue placeholder="Library area" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-900 text-white">
                            <SelectItem value="all">All library areas</SelectItem>
                            {libraryAreaChoices.map((area) => (
                                <SelectItem key={area} value={area}>
                                    {formatLibraryAreaLabel(area)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={availabilityFilter}
                        onValueChange={(value) =>
                            onAvailabilityFilterChange(value as CatalogAvailabilityFilter)
                        }
                    >
                        <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="h-4 w-4 text-white/60" />
                                <SelectValue placeholder="Availability" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-900 text-white">
                            <SelectItem value="all">All availability</SelectItem>
                            <SelectItem value="available">Available only</SelectItem>
                            <SelectItem value="unavailable">Unavailable only</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={sortOption}
                        onValueChange={(value) => onSortOptionChange(value as CatalogSortOption)}
                    >
                        <SelectTrigger className="w-full border-white/20 bg-slate-900/70 text-white">
                            <div className="flex items-center gap-2 truncate">
                                <ArrowUpDown className="h-4 w-4 text-white/60" />
                                <SelectValue placeholder="Sort books" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-900 text-white">
                            <SelectItem value="catalog">Catalog order</SelectItem>
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
                            <SelectItem value="copies_desc">Copies (Most first)</SelectItem>
                            <SelectItem value="copies_asc">Copies (Fewest first)</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-3 sm:flex-row sm:flex-wrap">
                        <BooksExcelPreviewDialog books={booksForExcel} />
                        <Button
                            type="button"
                            variant="outline"
                            className="border-white/20 text-white/90 hover:bg-white/10"
                            onClick={onClear}
                            disabled={!hasApplied}
                        >
                            <X className="mr-2 h-4 w-4" />
                            Clear
                        </Button>
                    </div>
                </div>
            </div>
        </CardHeader>
    );
}