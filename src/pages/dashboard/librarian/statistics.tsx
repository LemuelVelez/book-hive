/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  FileText,
  GraduationCap,
  Layers3,
  Loader2,
  RefreshCcw,
  Search,
  TrendingUp,
  Users,
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
  type PrintableCollegeStatisticsRecord,
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

type CollegeBreakdownRow = {
  key: string;
  label: string;
  uniqueBorrowerCount: number;
  totalBorrowCount: number;
  activeBorrowCount: number;
  topBorrowerName: string;
  topBorrowerBorrowCount: number;
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

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCollegeLabelFromCourse(course?: string | null) {
  const raw = String(course || "").trim();
  if (!raw) return "Unassigned";

  const collegeMatch = raw.match(/college of [a-z0-9&(),/\-\s]+/i);
  if (collegeMatch?.[0]) {
    return titleCase(collegeMatch[0].replace(/\s+/g, " ").trim());
  }

  const firstSegment = raw
    .split(/\s[-–—|]\s|\/|:/)
    .map((segment) => segment.trim())
    .filter(Boolean)[0];

  if (firstSegment && /^[A-Z]{2,10}$/.test(firstSegment)) {
    return firstSegment;
  }

  const lower = raw.toLowerCase();

  const keywordMap: Array<{ label: string; keywords: string[] }> = [
    {
      label: "Maritime",
      keywords: ["maritime", "marine", "nautical", "seafaring"],
    },
    {
      label: "Computer / IT",
      keywords: [
        "information technology",
        "computer science",
        "information systems",
        "information system",
        "ict",
        "bsit",
        "bscs",
        "bsis",
      ],
    },
    {
      label: "Business / Accountancy",
      keywords: [
        "accountancy",
        "accounting",
        "business",
        "marketing",
        "entrepreneurship",
        "financial management",
        "management accounting",
        "office administration",
      ],
    },
    {
      label: "Education",
      keywords: ["education", "teacher", "beed", "bsed"],
    },
    {
      label: "Engineering / Technology",
      keywords: [
        "engineering",
        "civil",
        "mechanical",
        "electrical",
        "industrial technology",
        "architecture",
      ],
    },
    {
      label: "Hospitality / Tourism",
      keywords: ["hospitality", "tourism", "hotel", "culinary"],
    },
    {
      label: "Health Sciences",
      keywords: [
        "nursing",
        "pharmacy",
        "medical technology",
        "medtech",
        "health",
        "biology",
        "psychology",
      ],
    },
    {
      label: "Criminology",
      keywords: ["criminology", "criminal justice"],
    },
    {
      label: "Arts / Sciences",
      keywords: [
        "english",
        "filipino",
        "communication",
        "political science",
        "public administration",
        "sociology",
        "arts",
        "science",
      ],
    },
  ];

  for (const entry of keywordMap) {
    if (entry.keywords.some((keyword) => lower.includes(keyword))) {
      return entry.label;
    }
  }

  return raw.length <= 40 ? raw : shortenLabel(raw, 40);
}

function normalizeCollegeLabel(college?: string | null, course?: string | null) {
  const rawCollege = String(college || "")
    .replace(/\s+/g, " ")
    .trim();

  if (rawCollege) return rawCollege;

  return normalizeCollegeLabelFromCourse(course);
}

function getBorrowerKey(record: BorrowRecordDTO) {
  return String(
    record.userId ||
      record.studentId ||
      record.studentEmail ||
      record.studentName ||
      record.id
  ).trim();
}

function getBorrowerLabel(record: BorrowRecordDTO) {
  return String(
    record.studentName ||
      record.studentId ||
      record.studentEmail ||
      `User ${record.userId}`
  ).trim();
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

type StatisticsDetailState =
  | { kind: "book"; row: StatisticsRow }
  | { kind: "college"; row: CollegeBreakdownRow }
  | null;

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 whitespace-normal wrap-break-word text-sm font-medium leading-5 text-white">{value}</div>
    </div>
  );
}

function BookStatisticsDetails({ row }: { row: StatisticsRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailField label="Book Title" value={row.title} />
      <DetailField label="Author" value={row.author} />
      <DetailField label="Library Area" value={normalizeLibraryAreaLabel(row.libraryArea)} />
      <DetailField label="Genre" value={row.genre || "—"} />
      <DetailField label="Total Borrowed" value={fmtCount(row.totalBorrowCount)} />
      <DetailField label="Currently Borrowed" value={fmtCount(row.activeBorrowCount)} />
      <DetailField label="Available Copies" value={fmtCount(row.availableCopies)} />
      <DetailField label="Total Copies" value={fmtCount(row.totalCopies)} />
    </div>
  );
}

function CollegeStatisticsDetails({ row }: { row: CollegeBreakdownRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailField label="College" value={row.label} />
      <DetailField label="Unique Borrowers" value={fmtCount(row.uniqueBorrowerCount)} />
      <DetailField label="Total Borrowed" value={fmtCount(row.totalBorrowCount)} />
      <DetailField label="Currently Borrowed" value={fmtCount(row.activeBorrowCount)} />
      <DetailField label="Top Borrower" value={row.topBorrowerName || "—"} />
      <DetailField
        label="Top Borrower Borrow Count"
        value={`${fmtCount(row.topBorrowerBorrowCount)} borrow record${row.topBorrowerBorrowCount === 1 ? "" : "s"}`}
      />
    </div>
  );
}

function CollegeBreakdownAccordion({
  rows,
  onOpenDetails,
}: {
  rows: CollegeBreakdownRow[];
  onOpenDetails: (row: CollegeBreakdownRow) => void;
}) {
  return (
    <Accordion type="multiple" className="space-y-3">
      {rows.map((row) => {
        const summary = `${row.label} • ${fmtCount(row.uniqueBorrowerCount)} borrowers • ${fmtCount(row.totalBorrowCount)} total • ${fmtCount(row.activeBorrowCount)} active • Top: ${row.topBorrowerName || "—"}`;

        return (
          <AccordionItem
            key={row.key}
            value={row.key}
            className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 px-3 text-white"
          >
            <AccordionTrigger className="items-start gap-3 py-3 text-left hover:no-underline [&>svg]:ml-3 [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:self-start [&>svg]:text-white/80 [&>svg]:opacity-100">
              <span className="block min-w-0 flex-1 whitespace-normal wrap-break-word pr-2 text-sm font-medium leading-5" title={summary}>
                {summary}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-0">
              <Button
                type="button"
                onClick={() => onOpenDetails(row)}
                className="h-9 bg-sky-500 text-slate-950 hover:bg-sky-400"
              >
                Details
              </Button>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function BookStatisticsAccordion({
  rows,
  onOpenDetails,
}: {
  rows: StatisticsRow[];
  onOpenDetails: (row: StatisticsRow) => void;
}) {
  return (
    <Accordion type="multiple" className="space-y-3">
      {rows.map((row) => {
        const summary = `${row.title} • ${normalizeLibraryAreaLabel(row.libraryArea)} • ${fmtCount(row.totalBorrowCount)} total • ${fmtCount(row.activeBorrowCount)} active • ${fmtCount(row.availableCopies)}/${fmtCount(row.totalCopies)} available`;

        return (
          <AccordionItem
            key={row.id}
            value={row.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 px-3 text-white"
          >
            <AccordionTrigger className="items-start gap-3 py-3 text-left hover:no-underline [&>svg]:ml-3 [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:self-start [&>svg]:text-white/80 [&>svg]:opacity-100">
              <span className="block min-w-0 flex-1 whitespace-normal wrap-break-word pr-2 text-sm font-medium leading-5" title={summary}>
                {summary}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-0">
              <Button
                type="button"
                onClick={() => onOpenDetails(row)}
                className="h-9 bg-sky-500 text-slate-950 hover:bg-sky-400"
              >
                Details
              </Button>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export default function LibrarianStatisticsPage() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [rows, setRows] = React.useState<StatisticsRow[]>([]);
  const [borrowRecords, setBorrowRecords] = React.useState<BorrowRecordDTO[]>([]);
  const [search, setSearch] = React.useState("");
  const [areaFilter, setAreaFilter] = React.useState("all");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [selectedDetail, setSelectedDetail] = React.useState<StatisticsDetailState>(null);

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
      setBorrowRecords(borrowRecords);
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


  const filteredBorrowRecords = React.useMemo(() => {
    const allowedBookIds = new Set(filtered.map((row) => String(row.id)));

    return borrowRecords.filter((record) => allowedBookIds.has(String(record.bookId || "")));
  }, [borrowRecords, filtered]);

  const uniqueBorrowerCount = React.useMemo(() => {
    return new Set(
      filteredBorrowRecords
        .map((record) => getBorrowerKey(record))
        .filter((value) => value.length > 0)
    ).size;
  }, [filteredBorrowRecords]);

  const collegeBreakdown = React.useMemo<CollegeBreakdownRow[]>(() => {
    const map = new Map<
      string,
      CollegeBreakdownRow & {
        borrowers: Map<string, { name: string; totalBorrowCount: number }>;
      }
    >();

    for (const record of filteredBorrowRecords) {
      const label = normalizeCollegeLabel(record.college, record.course);
      const key = label.toLowerCase();

      const current = map.get(key) ?? {
        key,
        label,
        uniqueBorrowerCount: 0,
        totalBorrowCount: 0,
        activeBorrowCount: 0,
        topBorrowerName: "—",
        topBorrowerBorrowCount: 0,
        borrowers: new Map<string, { name: string; totalBorrowCount: number }>(),
      };

      current.totalBorrowCount += 1;

      if (record.status !== "returned") {
        current.activeBorrowCount += 1;
      }

      const borrowerKey = getBorrowerKey(record);
      const borrower = current.borrowers.get(borrowerKey) ?? {
        name: getBorrowerLabel(record),
        totalBorrowCount: 0,
      };

      borrower.totalBorrowCount += 1;
      current.borrowers.set(borrowerKey, borrower);

      map.set(key, current);
    }

    return Array.from(map.values())
      .map((entry) => {
        const rankedBorrowers = Array.from(entry.borrowers.values()).sort((a, b) => {
          if (b.totalBorrowCount !== a.totalBorrowCount) {
            return b.totalBorrowCount - a.totalBorrowCount;
          }

          return a.name.localeCompare(b.name);
        });

        const topBorrower = rankedBorrowers[0];

        return {
          key: entry.key,
          label: entry.label,
          uniqueBorrowerCount: entry.borrowers.size,
          totalBorrowCount: entry.totalBorrowCount,
          activeBorrowCount: entry.activeBorrowCount,
          topBorrowerName: topBorrower?.name || "—",
          topBorrowerBorrowCount: topBorrower?.totalBorrowCount || 0,
        };
      })
      .sort((a, b) => {
        if (b.totalBorrowCount !== a.totalBorrowCount) {
          return b.totalBorrowCount - a.totalBorrowCount;
        }

        if (b.uniqueBorrowerCount !== a.uniqueBorrowerCount) {
          return b.uniqueBorrowerCount - a.uniqueBorrowerCount;
        }

        return a.label.localeCompare(b.label);
      });
  }, [filteredBorrowRecords]);

  const collegeBreakdownChartData = React.useMemo(
    () =>
      collegeBreakdown.slice(0, 8).map((row) => ({
        name: shortenLabel(row.label, 18),
        fullLabel: row.label,
        uniqueBorrowerCount: row.uniqueBorrowerCount,
        totalBorrowCount: row.totalBorrowCount,
        activeBorrowCount: row.activeBorrowCount,
        topBorrowerName: row.topBorrowerName,
      })),
    [collegeBreakdown]
  );

  const topCollege = collegeBreakdown[0] ?? null;

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

  const printableCollegeRecords = React.useMemo<PrintableCollegeStatisticsRecord[]>(
    () =>
      collegeBreakdown.map((row) => ({
        college: row.label,
        uniqueBorrowerCount: row.uniqueBorrowerCount,
        totalBorrowCount: row.totalBorrowCount,
        activeBorrowCount: row.activeBorrowCount,
        topBorrowerName: row.topBorrowerName,
        topBorrowerBorrowCount: row.topBorrowerBorrowCount,
      })),
    [collegeBreakdown]
  );

  return (
    <DashboardLayout title="Statistics">
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold leading-tight">Book Borrowing Statistics</h2>
          <p className="text-xs text-white/70">
            Track how many times each book was borrowed, what is currently out, and which colleges account for the most borrower activity in the current filter.
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

      <div className="grid gap-3 mb-4 md:grid-cols-2 xl:grid-cols-6">
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
          title="Unique Borrowers"
          value={fmtCount(uniqueBorrowerCount)}
          subtitle="Distinct users behind the filtered borrow records."
        />
        <StatsCard
          title="Colleges Represented"
          value={fmtCount(collegeBreakdown.length)}
          subtitle="Student colleges found in the filtered borrow data."
        />
        <StatsCard
          title="Top College"
          value={topCollege?.label || "—"}
          subtitle={
            topCollege
              ? `${fmtCount(topCollege.totalBorrowCount)} borrow record${topCollege.totalBorrowCount === 1 ? "" : "s"}`
              : "No student college data for this filter."
          }
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


      <GraphCard
        title="Borrowers by college"
        subtitle="Shows which student colleges account for the most borrower activity for the current book filter."
        icon={<GraduationCap className="h-4 w-4" />}
      >
        {collegeBreakdown.length === 0 ? (
          <div className="text-sm text-white/60">No borrower college data available for this filter.</div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collegeBreakdownChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#cbd5e1", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      content={<ChartTooltip valueFormatter={fmtCount} />}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      formatter={(value: number) => fmtCount(value)}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || "College"}
                    />
                    <Legend wrapperStyle={{ color: "#e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="totalBorrowCount" name="Total Borrowed" radius={[8, 8, 0, 0]} fill="#60a5fa" />
                    <Bar dataKey="uniqueBorrowerCount" name="Unique Borrowers" radius={[8, 8, 0, 0]} fill="#34d399" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/60">Top college</div>
                  <div className="mt-1 text-sm font-semibold text-white">{topCollege?.label || "—"}</div>
                  <div className="mt-1 text-xs text-white/55">
                    {topCollege
                      ? `${fmtCount(topCollege.totalBorrowCount)} borrow records from ${fmtCount(topCollege.uniqueBorrowerCount)} borrower${topCollege.uniqueBorrowerCount === 1 ? "" : "s"}`
                      : "No college activity found yet."}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/60">Top borrower in leading college</div>
                  <div className="mt-1 text-sm font-semibold text-white">{topCollege?.topBorrowerName || "—"}</div>
                  <div className="mt-1 text-xs text-white/55">
                    {topCollege
                      ? `${fmtCount(topCollege.topBorrowerBorrowCount)} borrow record${topCollege.topBorrowerBorrowCount === 1 ? "" : "s"}`
                      : "Waiting for borrower data."}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Users className="h-3.5 w-3.5" />
                    <span>Unique borrowers</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">{fmtCount(uniqueBorrowerCount)}</div>
                  <div className="mt-1 text-xs text-white/55">Across {fmtCount(collegeBreakdown.length)} college group{collegeBreakdown.length === 1 ? "" : "s"} in the filtered view.</div>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-xs text-white/60">
                Borrower activity grouped by student college for the current filter.
              </p>
              <CollegeBreakdownAccordion
                rows={collegeBreakdown}
                onOpenDetails={(row) => setSelectedDetail({ kind: "college", row })}
              />
            </div>
          </>
        )}
      </GraphCard>

      <Card className="bg-slate-800/60 border-white/10 mt-4">
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

        <CardContent>
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
              <div className="space-y-3">
                <p className="text-xs text-white/60">
                  Showing {filtered.length} {filtered.length === 1 ? "book" : "books"}.
                </p>
                <BookStatisticsAccordion
                  rows={filtered}
                  onOpenDetails={(row) => setSelectedDetail({ kind: "book", row })}
                />
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
                      <GraduationCap className="h-4 w-4" />
                      <span className="text-sm font-medium">College overview</span>
                    </div>
                    <p className="mt-2 text-xs text-white/70">
                      Borrow activity comes from <span className="font-semibold text-white">{fmtCount(collegeBreakdown.length)}</span> student college group{collegeBreakdown.length === 1 ? "" : "s"} and <span className="font-semibold text-white">{fmtCount(uniqueBorrowerCount)}</span> unique borrower{uniqueBorrowerCount === 1 ? "" : "s"} in the current filter.
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

      <Dialog
        open={selectedDetail !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDetail(null);
        }}
      >
        <DialogContent className="max-h-[95svh] overflow-hidden border-white/10 bg-slate-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="whitespace-normal wrap-break-word pr-8 text-left text-white">
              {selectedDetail?.kind === "book"
                ? selectedDetail.row.title
                : selectedDetail?.kind === "college"
                  ? selectedDetail.row.label
                  : "Details"}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(95svh-8rem)] overflow-y-auto pr-1">
            {selectedDetail?.kind === "book" ? (
              <BookStatisticsDetails row={selectedDetail.row} />
            ) : selectedDetail?.kind === "college" ? (
              <CollegeStatisticsDetails row={selectedDetail.row} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ExportPreviewStatistics
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        records={printableRecords}
        collegeRecords={printableCollegeRecords}
        fileNamePrefix="bookhive-statistics-report"
        reportTitle="BookHive Library • Statistics Report"
        reportSubtitle="Printable report for librarian book borrowing statistics and borrower student college activity."
      />
    </DashboardLayout>
  );
}