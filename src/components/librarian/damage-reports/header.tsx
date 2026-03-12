import { Loader2, RefreshCcw, Search, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import type { ActiveStatusFilter } from "./types";

type DamageReportsHeaderProps = {
    search: string;
    onSearchChange: (value: string) => void;
    activeStatusFilter: ActiveStatusFilter;
    onActiveStatusFilterChange: (value: ActiveStatusFilter) => void;
    refreshing: boolean;
    loading: boolean;
    onRefresh: () => void;
    counts: {
        activeCount: number;
        paidCount: number;
    };
};

export function DamageReportsHeader({
    search,
    onSearchChange,
    activeStatusFilter,
    onActiveStatusFilterChange,
    refreshing,
    loading,
    onRefresh,
    counts,
}: DamageReportsHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 mt-0.5 text-white/70" />
                <div>
                    <h2 className="text-lg font-semibold leading-tight">Book Damage Reports</h2>
                    <p className="text-xs text-white/70">
                        Paid damage fines automatically appear under <span className="font-semibold">Paid Archive</span>.
                    </p>
                    <p className="mt-1 text-[11px] text-white/60">
                        Active: <span className="font-semibold text-amber-200">{counts.activeCount}</span> • Paid archive:{" "}
                        <span className="font-semibold text-emerald-200">{counts.paidCount}</span>
                    </p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search by ID, reported by, liable user, book…"
                        className="pl-9 bg-slate-900/70 border-white/20 text-white"
                    />
                </div>

                <div className="w-full sm:w-44">
                    <Select
                        value={activeStatusFilter}
                        onValueChange={(v) => onActiveStatusFilterChange(v as ActiveStatusFilter)}
                    >
                        <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                            <SelectValue placeholder="Active filter" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 text-white border-white/10">
                            <SelectItem value="all">Active: All</SelectItem>
                            <SelectItem value="pending">Active: Pending</SelectItem>
                            <SelectItem value="assessed">Active: Assessed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-white/20 text-white/90 hover:bg-white/10"
                    onClick={onRefresh}
                    disabled={refreshing || loading}
                >
                    {refreshing || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    <span className="sr-only">Refresh</span>
                </Button>
            </div>
        </div>
    );
}