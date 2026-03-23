/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  BookCopy,
  FileText,
  Layers3,
  Loader2,
  RefreshCcw,
  Search,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchBooks, type BookDTO, type LibraryArea } from "@/lib/books";
import { fetchBorrowRecords, type BorrowRecordDTO } from "@/lib/borrows";
import ExportPreviewStatistics, {
  type PrintableBookStatisticsRecord,
} from "@/components/statistics-preview/export-preview-statistics";

type StatisticsRow = {
  id: string;
  title: string;
  author: string;
  genre: string;
  libraryArea: LibraryArea | null;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  activeBorrowCount: number;
  totalBorrowCount: number;
};

type BorrowCountFallback = {
  activeBorrowCount: number;
  totalBorrowCount: number;
};

type AreaBreakdownRow = {
  key: string;
  label: string;
  totalTitles: number;
  totalBorrowCount: number;
  activeBorrowCount: number;
};

type ChartTooltipPayload = {
  color?: string;
  dataKey?: string;
  name?: string;
  value?: number | string;
  payload?: Record<string, any>;
};

const PIE_COLORS = ["#22c55e", "#f59e0b", "#38bdf8", "#a855f7"];

function pickNumber(...values: Array<number | string | null | undefined>) {
  for (const value of values) {
    const num =
      typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function fmtCount(value: number) {
  try {
    return new Intl.NumberFormat("en-PH").format(value);
  } catch {
    return String(value);
  }
}

function toPercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function normalizeLibraryAreaLabel(area?: LibraryArea | string | null) {
  switch (area) {
    case "filipiniana":
      return "Filipiniana";
    case "general_circulation":
      return "General Circulation";
    case "maritime":
      return "Maritime";
    case "periodicals":
      return "Periodicals";
    case "thesis_dissertations":
      return "Thesis / Dissertations";
    case "rizaliana":
      return "Rizaliana";
    case "special_collection":
      return "Special Collection";
    case "fil_gen_reference":
      return "Fil / Gen Reference";
    case "general_reference":
      return "General Reference";
    case "fiction":
      return "Fiction";
    default:
      return "Unassigned";
  }
}

function shortenLabel(value: string, maxLength = 18) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildBorrowCountsMap(records: BorrowRecordDTO[]) {
  const map = new Map<string, BorrowCountFallback>();

  for (const record of records) {
    const key = String(record.bookId || "").trim();
    if (!key) continue;

    const current = map.get(key) ?? {
      activeBorrowCount: 0,
      totalBorrowCount: 0,
    };

    current.totalBorrowCount += 1;

    if (record.status !== "returned") {
      current.activeBorrowCount += 1;
    }

    map.set(key, current);
  }

  return map;
}

function buildStatisticsRow(book: BookDTO, fallback?: BorrowCountFallback): StatisticsRow {
  const fallbackActive = pickNumber(fallback?.activeBorrowCount);
  const fallbackTotal = pickNumber(fallback?.totalBorrowCount);

  const activeBorrowCount = Math.max(
    0,
    pickNumber(book.activeBorrowCount, book.borrowedCopies, fallbackActive, 0)
  );

  const totalBorrowCount = Math.max(
    0,
    pickNumber(book.totalBorrowCount, fallbackTotal, activeBorrowCount, 0)
  );

  const totalCopies = Math.max(
    0,
    pickNumber(book.totalCopies, pickNumber(book.numberOfCopies, 0) + activeBorrowCount, book.numberOfCopies, 0)
  );

  const availableCopies = Math.max(0, pickNumber(book.numberOfCopies, totalCopies - activeBorrowCount, 0));
  const borrowedCopies = Math.max(0, pickNumber(book.borrowedCopies, activeBorrowCount, 0));

  return {
    id: String(book.id),
    title: String(book.title || "Untitled Book"),
    author: String(book.author || "Unknown Author"),
    genre: String(book.genre || "—"),
    libraryArea: book.libraryArea ?? null,
    totalCopies,
    availableCopies,
    borrowedCopies,
    activeBorrowCount,
    totalBorrowCount,
  };
}

function StatsCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card className="bg-slate-800/60 border-white/10">
      <CardContent className="pt-5">
        <div className="text-xs uppercase tracking-wide text-white/60">{title}</div>
        <div className="mt-2 text-2xl font-bold text-white">{value}</div>
        <div className="mt-1 text-xs text-white/70">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function GraphCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-slate-800/60 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-sky-200">{icon}</span>
          <span>{title}</span>
        </CardTitle>
        <p className="text-xs text-white/65">{subtitle}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = fmtCount,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 shadow-xl">
      {label ? <div className="mb-1 text-xs font-medium text-white">{label}</div> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const numericValue = typeof entry.value === "number" ? entry.value : Number(entry.value || 0);
          return (
            <div key={`${entry.dataKey || entry.name || "item"}-${index}`} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-2 text-white/75">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color || "#38bdf8" }}
                />
                {entry.name || entry.dataKey || "Value"}
              </span>
              <span className="font-semibold text-white">{valueFormatter(Number.isFinite(numericValue) ? numericValue : 0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LibrarianStatisticsPage() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [rows, setRows] = React.useState<StatisticsRow[]>([]);
  const [search, setSearch] = React.useState("");
  const [areaFilter, setAreaFilter] = React.useState("all");
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const [books, borrowRecords] = await Promise.all([
        fetchBooks(),
        fetchBorrowRecords().catch(() => [] as BorrowRecordDTO[]),
      ]);

      const fallbackMap = buildBorrowCountsMap(borrowRecords);

      const nextRows = books
        .map((book) => buildStatisticsRow(book, fallbackMap.get(String(book.id))))
        .sort((a, b) => {
          if (b.totalBorrowCount !== a.totalBorrowCount) return b.totalBorrowCount - a.totalBorrowCount;
          if (b.activeBorrowCount !== a.activeBorrowCount) return b.activeBorrowCount - a.activeBorrowCount;
          return a.title.localeCompare(b.title);
        });

      setRows(nextRows);
    } catch (err: any) {
      const msg = err?.message || "Failed to load statistics.";
      setError(msg);
      toast.error("Failed to load", { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const areaOptions = React.useMemo(() => {
    const options = new Map<string, string>();

    for (const row of rows) {
      const value = row.libraryArea ?? "unassigned";
      options.set(value, normalizeLibraryAreaLabel(row.libraryArea));
    }

    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const rowAreaValue = row.libraryArea ?? "unassigned";

      if (areaFilter !== "all" && rowAreaValue !== areaFilter) return false;
      if (!q) return true;

      const haystack = [
        row.id,
        row.title,
        row.author,
        row.genre,
        normalizeLibraryAreaLabel(row.libraryArea),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [areaFilter, rows, search]);

  const totals = React.useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.totalTitles += 1;
        acc.totalBorrowCount += row.totalBorrowCount;
        acc.activeBorrowCount += row.activeBorrowCount;
        acc.availableCopies += row.availableCopies;
        acc.totalCopies += row.totalCopies;

        if (row.libraryArea === "filipiniana") {
          acc.filipinianaTitles += 1;
          acc.filipinianaBorrowCount += row.totalBorrowCount;
          acc.filipinianaActiveBorrowCount += row.activeBorrowCount;
        }

        return acc;
      },
      {
        totalTitles: 0,
        totalBorrowCount: 0,
        activeBorrowCount: 0,
        availableCopies: 0,
        totalCopies: 0,
        filipinianaTitles: 0,
        filipinianaBorrowCount: 0,
        filipinianaActiveBorrowCount: 0,
      }
    );
  }, [filtered]);

  const topBorrowedRows = React.useMemo(() => {
    return [...filtered]
      .sort((a, b) => {
        if (b.totalBorrowCount !== a.totalBorrowCount) return b.totalBorrowCount - a.totalBorrowCount;
        if (b.activeBorrowCount !== a.activeBorrowCount) return b.activeBorrowCount - a.activeBorrowCount;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 6);
  }, [filtered]);

  const areaBreakdown = React.useMemo<AreaBreakdownRow[]>(() => {
    const map = new Map<string, AreaBreakdownRow>();

    for (const row of filtered) {
      const key = row.libraryArea ?? "unassigned";
      const existing = map.get(key) ?? {
        key,
        label: normalizeLibraryAreaLabel(row.libraryArea),
        totalTitles: 0,
        totalBorrowCount: 0,
        activeBorrowCount: 0,
      };

      existing.totalTitles += 1;
      existing.totalBorrowCount += row.totalBorrowCount;
      existing.activeBorrowCount += row.activeBorrowCount;
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.totalBorrowCount !== a.totalBorrowCount) return b.totalBorrowCount - a.totalBorrowCount;
      return a.label.localeCompare(b.label);
    });
  }, [filtered]);

  const inventory = React.useMemo(() => {
    const borrowedNow = Math.max(0, totals.totalCopies - totals.availableCopies);
    const availableNow = Math.max(0, totals.availableCopies);
    const utilizationPercent = toPercent(borrowedNow, totals.totalCopies);
    const availabilityPercent = toPercent(availableNow, totals.totalCopies);

    return {
      borrowedNow,
      availableNow,
      utilizationPercent,
      availabilityPercent,
    };
  }, [totals.availableCopies, totals.totalCopies]);

  const topBorrowedChartData = React.useMemo(
    () =>
      topBorrowedRows.map((row) => ({
        name: shortenLabel(row.title, 20),
        fullTitle: row.title,
        author: row.author,
        totalBorrowCount: row.totalBorrowCount,
        activeBorrowCount: row.activeBorrowCount,
      })),
    [topBorrowedRows]
  );

  const areaBreakdownChartData = React.useMemo(
    () =>
      areaBreakdown.map((row) => ({
        name: shortenLabel(row.label, 18),
        fullLabel: row.label,
        totalTitles: row.totalTitles,
        totalBorrowCount: row.totalBorrowCount,
        activeBorrowCount: row.activeBorrowCount,
      })),
    [areaBreakdown]
  );

  const inventoryMixData = React.useMemo(
    () => [
      {
        name: "Available",
        value: inventory.availableNow,
        subtitle: `${inventory.availabilityPercent.toFixed(1)}% of filtered copies`,
      },
      {
        name: "Borrowed",
        value: inventory.borrowedNow,
        subtitle: `${inventory.utilizationPercent.toFixed(1)}% of filtered copies`,
      },
    ],
    [inventory.availabilityPercent, inventory.availableNow, inventory.borrowedNow, inventory.utilizationPercent]
  );

  const printableRecords = React.useMemo<PrintableBookStatisticsRecord[]>(
    () =>
      filtered.map((row) => ({
        id: row.id,
        title: row.title,
        author: row.author,
        genre: row.genre,
        libraryArea: row.libraryArea,
        totalCopies: row.totalCopies,
        availableCopies: row.availableCopies,
        borrowedCopies: row.borrowedCopies,
        activeBorrowCount: row.activeBorrowCount,
        totalBorrowCount: row.totalBorrowCount,
      })),
    [filtered]
  );

  return (
    <DashboardLayout title="Statistics">
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold leading-tight">Book Borrowing Statistics</h2>
          <p className="text-xs text-white/70">
            Track how many times each book was borrowed, what is currently out, and view quick graphical summaries for the current filter.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="border-sky-400/30 text-sky-100 hover:bg-sky-500/10"
            onClick={() => setPreviewOpen(true)}
            disabled={loading || !printableRecords.length}
          >
            <FileText className="mr-2 h-4 w-4" />
            Preview PDF
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-white/20 text-white/90 hover:bg-white/10"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            {refreshing || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 mb-4 md:grid-cols-2 xl:grid-cols-5">
        <StatsCard
          title="Book Titles"
          value={fmtCount(totals.totalTitles)}
          subtitle="Titles included in the current filter."
        />
        <StatsCard
          title="Total Borrowed"
          value={fmtCount(totals.totalBorrowCount)}
          subtitle="All-time borrow count across filtered books."
        />
        <StatsCard
          title="Currently Borrowed"
          value={fmtCount(totals.activeBorrowCount)}
          subtitle="Active borrow records not yet returned."
        />
        <StatsCard
          title="Filipiniana Borrowed"
          value={fmtCount(totals.filipinianaBorrowCount)}
          subtitle="All-time borrowed count for Filipiniana."
        />
        <StatsCard
          title="Filipiniana Active"
          value={fmtCount(totals.filipinianaActiveBorrowCount)}
          subtitle="Currently borrowed Filipiniana books."
        />
      </div>

      <div className="grid gap-4 mb-4 xl:grid-cols-3">
        <GraphCard
          title="Top borrowed books"
          subtitle="Visual ranking of the most borrowed titles in the current result set."
          icon={<BarChart3 className="h-4 w-4" />}
        >
          {topBorrowedChartData.length === 0 ? (
            <div className="text-sm text-white/60">No data available for this filter.</div>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topBorrowedChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      content={
                        <ChartTooltip
                          valueFormatter={fmtCount}
                        />
                      }
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      formatter={(value: number) => fmtCount(value)}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTitle || "Book"}
                    />
                    <Legend wrapperStyle={{ color: "#e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="totalBorrowCount" name="Total Borrowed" radius={[8, 8, 0, 0]} fill="#38bdf8" />
                    <Bar dataKey="activeBorrowCount" name="Currently Borrowed" radius={[8, 8, 0, 0]} fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/60">Top title</div>
                  <div className="mt-1 text-sm font-semibold text-white">{topBorrowedRows[0]?.title || "—"}</div>
                  <div className="mt-1 text-xs text-white/55">
                    {topBorrowedRows[0]
                      ? `${fmtCount(topBorrowedRows[0].totalBorrowCount)} all-time borrows`
                      : "No records yet."}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/60">Books ranked</div>
                  <div className="mt-1 text-sm font-semibold text-white">{fmtCount(topBorrowedRows.length)}</div>
                  <div className="mt-1 text-xs text-white/55">Top results included in the chart.</div>
                </div>
              </div>
            </>
          )}
        </GraphCard>

        <GraphCard
          title="Borrowing by area"
          subtitle="Compares total and active borrowing activity across library sections."
          icon={<Layers3 className="h-4 w-4" />}
        >
          {areaBreakdownChartData.length === 0 ? (
            <div className="text-sm text-white/60">No area breakdown available for this filter.</div>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaBreakdownChartData} layout="vertical" margin={{ top: 8, right: 8, left: 12, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={true} vertical={false} />
                    <XAxis type="number" tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#cbd5e1", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={120}
                    />
                    <Tooltip
                      content={<ChartTooltip valueFormatter={fmtCount} />}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      formatter={(value: number) => fmtCount(value)}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || "Area"}
                    />
                    <Legend wrapperStyle={{ color: "#e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="totalBorrowCount" name="Total Borrowed" radius={[0, 8, 8, 0]} fill="#a855f7" />
                    <Bar dataKey="activeBorrowCount" name="Currently Borrowed" radius={[0, 8, 8, 0]} fill="#f472b6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/60">Top area</div>
                  <div className="mt-1 text-sm font-semibold text-white">{areaBreakdown[0]?.label || "—"}</div>
                  <div className="mt-1 text-xs text-white/55">
                    {areaBreakdown[0]
                      ? `${fmtCount(areaBreakdown[0].totalBorrowCount)} all-time borrows`
                      : "No area data yet."}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/60">Areas represented</div>
                  <div className="mt-1 text-sm font-semibold text-white">{fmtCount(areaBreakdown.length)}</div>
                  <div className="mt-1 text-xs text-white/55">Distinct library sections in the filtered view.</div>
                </div>
              </div>
            </>
          )}
        </GraphCard>

        <GraphCard
          title="Current inventory mix"
          subtitle="Snapshot of how much of the filtered inventory is currently available versus borrowed."
          icon={<TrendingUp className="h-4 w-4" />}
        >
          {totals.totalCopies <= 0 ? (
            <div className="text-sm text-white/60">No inventory data available for this filter.</div>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryMixData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={68}
                      outerRadius={96}
                      paddingAngle={4}
                      stroke="rgba(15,23,42,0.9)"
                      strokeWidth={2}
                    >
                      {inventoryMixData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueFormatter={fmtCount} />} formatter={(value: number) => fmtCount(value)} />
                    <Legend wrapperStyle={{ color: "#e2e8f0", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {inventoryMixData.map((item, index) => (
                  <div key={item.name} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">{fmtCount(item.value)}</div>
                    <div className="mt-1 text-xs text-white/55">{item.subtitle}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </GraphCard>
      </div>

      <Card className="bg-slate-800/60 border-white/10">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Statistics list</CardTitle>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, author, genre, area…"
                  className="pl-9 bg-slate-900/70 border-white/20 text-white"
                />
              </div>

              <div className="w-full md:w-56">
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger className="h-9 w-full bg-slate-900/70 border-white/20 text-white">
                    <SelectValue placeholder="Library area" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white border-white/10">
                    <SelectItem value="all">All areas</SelectItem>
                    {areaOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-red-300">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/70">No statistics found.</div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableCaption className="text-xs text-white/60">
                    Showing {filtered.length} {filtered.length === 1 ? "book" : "books"}.
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-xs font-semibold text-white/70">Book</TableHead>
                      <TableHead className="text-xs font-semibold text-white/70">Area / Genre</TableHead>
                      <TableHead className="text-xs font-semibold text-white/70 text-right">Total Borrowed</TableHead>
                      <TableHead className="text-xs font-semibold text-white/70 text-right">Currently Borrowed</TableHead>
                      <TableHead className="text-xs font-semibold text-white/70 text-right">Available Copies</TableHead>
                      <TableHead className="text-xs font-semibold text-white/70 text-right">Total Copies</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.id} className="border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-white">{row.title}</span>
                            <span className="text-xs text-white/60">{row.author}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-white/80">{normalizeLibraryAreaLabel(row.libraryArea)}</span>
                            <span className="text-xs text-white/55">{row.genre || "—"}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-sm text-right">{fmtCount(row.totalBorrowCount)}</TableCell>
                        <TableCell className="text-sm text-right">{fmtCount(row.activeBorrowCount)}</TableCell>
                        <TableCell className="text-sm text-right">{fmtCount(row.availableCopies)}</TableCell>
                        <TableCell className="text-sm text-right">{fmtCount(row.totalCopies)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {filtered.map((row) => (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{row.title}</div>
                        <div className="text-xs text-white/60">{row.author}</div>
                      </div>

                      <div className="rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-100">
                        {normalizeLibraryAreaLabel(row.libraryArea)}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-xs text-white/60">Total Borrowed</div>
                        <div className="mt-1 text-sm font-medium">{fmtCount(row.totalBorrowCount)}</div>
                      </div>

                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-xs text-white/60">Currently Borrowed</div>
                        <div className="mt-1 text-sm font-medium">{fmtCount(row.activeBorrowCount)}</div>
                      </div>

                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-xs text-white/60">Available Copies</div>
                        <div className="mt-1 text-sm font-medium">{fmtCount(row.availableCopies)}</div>
                      </div>

                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-xs text-white/60">Total Copies</div>
                        <div className="mt-1 text-sm font-medium">{fmtCount(row.totalCopies)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                      <BookCopy className="h-3.5 w-3.5" />
                      <span>{row.genre || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Card className="bg-slate-900/60 border-white/10">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sky-100">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">Borrowing overview</span>
                    </div>
                    <p className="mt-2 text-xs text-white/70">
                      Filtered books have a combined <span className="font-semibold text-white">{fmtCount(totals.totalBorrowCount)}</span> all-time borrows and <span className="font-semibold text-white">{fmtCount(totals.activeBorrowCount)}</span> active borrows.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-white/10">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sky-100">
                      <BookCopy className="h-4 w-4" />
                      <span className="text-sm font-medium">Filipiniana overview</span>
                    </div>
                    <p className="mt-2 text-xs text-white/70">
                      Filipiniana titles in this filter: <span className="font-semibold text-white">{fmtCount(totals.filipinianaTitles)}</span>. Borrowed all-time: <span className="font-semibold text-white">{fmtCount(totals.filipinianaBorrowCount)}</span>.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-white/10">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sky-100">
                      <RefreshCcw className="h-4 w-4" />
                      <span className="text-sm font-medium">Inventory overview</span>
                    </div>
                    <p className="mt-2 text-xs text-white/70">
                      Available copies: <span className="font-semibold text-white">{fmtCount(totals.availableCopies)}</span> out of <span className="font-semibold text-white">{fmtCount(totals.totalCopies)}</span> total copies for the current filter.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ExportPreviewStatistics
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        records={printableRecords}
        fileNamePrefix="bookhive-statistics-report"
        reportTitle="BookHive Library • Statistics Report"
        reportSubtitle="Printable report for librarian book borrowing statistics and Filipiniana usage."
      />
    </DashboardLayout>
  );
}
