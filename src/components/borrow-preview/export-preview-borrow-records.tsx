import * as React from "react";
import {
  Document,
  Page,
  PDFDownloadLink,
  PDFViewer,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileText, Loader2, Printer, ScanLine } from "lucide-react";
import { toast } from "sonner";

export type PrintableBorrowRecordStatus =
  | "borrowed"
  | "returned"
  | "pending_pickup"
  | "pending_return"
  | "pending"
  | string;

export type PrintableBorrowRecord = {
  id: string | number;
  userId?: string | number | null;
  studentId?: string | number | null;
  studentName?: string | null;
  studentEmail?: string | null;
  bookTitle?: string | null;
  bookId?: string | number | null;
  status: PrintableBorrowRecordStatus;
  borrowDate?: string | null;
  dueDate?: string | null;
  returnDate?: string | null;
  fine?: number | string | null;
  extensionRequestStatus?: string | null;
  returnRequestedAt?: string | null;
  returnRequestNote?: string | null;
};

type ExportPreviewBorrowRecordsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: PrintableBorrowRecord[];
  autoPrintOnOpen?: boolean;
  fileNamePrefix?: string;
  reportTitle?: string;
  reportSubtitle?: string;
};

type BorrowRecordsPdfDocProps = {
  records: PrintableBorrowRecord[];
  generatedAtIso: string;
  reportTitle?: string;
  reportSubtitle?: string;
};

const FINE_PER_DAY = 5;

function formatPHP(n: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "PHP 0.00";
  try {
    const formatted = new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    return `PHP ${formatted}`;
  } catch {
    return `PHP ${n.toFixed(2)}`;
  }
}

function normalizeAmount(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-CA");
  } catch {
    return value;
  }
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function safeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getStudentPrimary(record: PrintableBorrowRecord) {
  return (
    (record.studentName && String(record.studentName).trim()) ||
    (record.studentEmail && String(record.studentEmail).trim()) ||
    (record.studentId ? `Student ID: ${record.studentId}` : null) ||
    (record.userId ? `User ID: ${record.userId}` : null) ||
    "Unknown borrower"
  );
}

function getStudentSecondary(record: PrintableBorrowRecord) {
  const parts: string[] = [];

  if (record.studentId) parts.push(`Student ID: ${record.studentId}`);
  if (
    record.studentEmail &&
    String(record.studentEmail).trim() !== getStudentPrimary(record)
  ) {
    parts.push(String(record.studentEmail).trim());
  }
  if (!record.studentId && !record.studentEmail && record.userId) {
    parts.push(`User ID: ${record.userId}`);
  }

  return parts.join(" · ");
}

function getBookPrimary(record: PrintableBorrowRecord) {
  return (
    (record.bookTitle && String(record.bookTitle).trim()) ||
    (record.bookId ? `Book #${record.bookId}` : null) ||
    "Unknown book"
  );
}

function getOverdueDays(dueDate?: string | null) {
  if (!dueDate) return 0;

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;

  const now = new Date();
  const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = todayLocal.getTime() - dueLocal.getTime();
  const rawDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return rawDays > 0 ? rawDays : 0;
}

function isReturnedStatus(status: PrintableBorrowRecordStatus) {
  return String(status).toLowerCase().trim() === "returned";
}

function isPendingStatus(status: PrintableBorrowRecordStatus) {
  const s = String(status).toLowerCase().trim();
  return s === "pending_pickup" || s === "pending_return" || s === "pending";
}

function isBorrowedStatus(status: PrintableBorrowRecordStatus) {
  return String(status).toLowerCase().trim() === "borrowed";
}

function statusText(record: PrintableBorrowRecord) {
  const s = String(record.status).toLowerCase().trim();
  const overdueDays = getOverdueDays(record.dueDate);
  const isOverdue =
    (isBorrowedStatus(record.status) ||
      s === "pending_return" ||
      s === "pending") &&
    overdueDays > 0;

  if (s === "returned") return "Returned";
  if (s === "pending_pickup") return "Pending pickup";
  if (s === "pending_return" || s === "pending") return "Pending return";
  if (isOverdue) return "Overdue";
  if (s === "borrowed") return "Borrowed";

  return s || "Unknown";
}

function getStatusStyle(record: PrintableBorrowRecord, styles: typeof pdfStyles) {
  const s = String(record.status).toLowerCase().trim();
  const overdueDays = getOverdueDays(record.dueDate);
  const isOverdue =
    (s === "borrowed" || s === "pending_return" || s === "pending") &&
    overdueDays > 0;

  if (s === "returned") return styles.statusReturned;
  if (s === "pending_pickup" || s === "pending_return" || s === "pending") {
    return styles.statusPending;
  }
  if (isOverdue) return styles.statusOverdue;
  if (s === "borrowed") return styles.statusBorrowed;
  return styles.statusDefault;
}

function chunkRecords<T>(items: T[], size: number): T[][] {
  if (!items.length) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    fontSize: 9,
    color: "#0f172a",
    fontFamily: "Helvetica",
    lineHeight: 1.3,
  },
  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  heroCompact: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: 700,
  },
  heroSub: {
    color: "#cbd5e1",
    fontSize: 9,
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: "row",
    marginBottom: 10,
  },
  metaCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 8,
    marginRight: 6,
    backgroundColor: "#f8fafc",
  },
  metaCardLast: {
    marginRight: 0,
  },
  metaLabel: {
    fontSize: 8,
    color: "#475569",
  },
  metaValue: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: 700,
    color: "#0f172a",
  },
  sectionTitle: {
    fontSize: 10,
    color: "#0f172a",
    fontWeight: 700,
    marginBottom: 6,
  },
  pageIndicator: {
    fontSize: 7.7,
    color: "#475569",
    textAlign: "right",
    marginBottom: 4,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: "flex-start",
  },
  colBorrowId: { width: "9%", paddingRight: 4 },
  colStudent: { width: "19%", paddingRight: 6 },
  colBook: { width: "23%", paddingRight: 6 },
  colBorrowDate: { width: "10%", paddingRight: 4 },
  colDueDate: { width: "10%", paddingRight: 4 },
  colReturnDate: { width: "10%", paddingRight: 4 },
  colStatus: {
    width: "12%",
    paddingRight: 4,
    alignItems: "center",
  },
  colFine: { width: "7%", alignItems: "flex-end" },
  th: {
    fontSize: 8.1,
    fontWeight: 700,
    color: "#1e293b",
  },
  thCenter: {
    fontSize: 8.1,
    fontWeight: 700,
    color: "#1e293b",
    textAlign: "center",
  },
  thRight: {
    fontSize: 8.1,
    fontWeight: 700,
    color: "#1e293b",
    textAlign: "right",
  },
  td: {
    fontSize: 8.35,
    color: "#0f172a",
    lineHeight: 1.25,
  },
  tdSubtle: {
    fontSize: 7.45,
    color: "#475569",
    marginTop: 1,
    lineHeight: 1.2,
  },
  tdRight: {
    fontSize: 8.35,
    color: "#0f172a",
    lineHeight: 1.25,
    textAlign: "right",
  },
  emptyRowText: {
    fontSize: 8.4,
    color: "#475569",
    textAlign: "center",
  },
  statusBadgeWrap: {
    minHeight: 14,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 7.2,
    lineHeight: 1.1,
    color: "#ffffff",
    fontWeight: 700,
    textAlign: "center",
  },
  statusBorrowed: { backgroundColor: "#7c3aed" },
  statusReturned: { backgroundColor: "#059669" },
  statusPending: { backgroundColor: "#d97706" },
  statusOverdue: { backgroundColor: "#dc2626" },
  statusDefault: { backgroundColor: "#334155" },
  totalsWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  totalsLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalsLabel: {
    color: "#334155",
    fontSize: 9,
  },
  totalsValue: {
    color: "#0f172a",
    fontSize: 9,
    fontWeight: 700,
  },
  totalsGrand: {
    marginTop: 4,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  notesWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 8,
  },
  notesTitle: {
    fontSize: 9,
    color: "#0f172a",
    fontWeight: 700,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 8,
    color: "#334155",
    marginBottom: 2,
    lineHeight: 1.25,
  },
  footer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7.5,
    color: "#64748b",
  },
});

function BorrowRecordsPdfDocument({
  records,
  generatedAtIso,
  reportTitle,
  reportSubtitle,
}: BorrowRecordsPdfDocProps) {
  const sorted = [...records].sort((a, b) =>
    String(b.borrowDate ?? "").localeCompare(String(a.borrowDate ?? ""))
  );

  const activeCount = sorted.filter((r) => !isReturnedStatus(r.status)).length;
  const returnedCount = sorted.filter((r) => isReturnedStatus(r.status)).length;
  const pendingCount = sorted.filter((r) => isPendingStatus(r.status)).length;
  const overdueCount = sorted.filter((r) => {
    const s = String(r.status).toLowerCase().trim();
    return (
      (s === "borrowed" || s === "pending_return" || s === "pending") &&
      getOverdueDays(r.dueDate) > 0
    );
  }).length;

  const totalFine = sorted.reduce(
    (sum, r) => sum + normalizeAmount(r.fine),
    0
  );
  const totalAutoFineExposure = sorted.reduce((sum, r) => {
    const s = String(r.status).toLowerCase().trim();
    const isFineStillAccruing =
      s === "borrowed" || s === "pending_return" || s === "pending";
    if (!isFineStillAccruing) return sum;
    return sum + getOverdueDays(r.dueDate) * FINE_PER_DAY;
  }, 0);

  const dateValues = sorted
    .map((r) => r.borrowDate)
    .filter(Boolean)
    .map((value) => new Date(String(value)))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const dateRange =
    dateValues.length > 0
      ? `${fmtDate(dateValues[0].toISOString())} → ${fmtDate(
          dateValues[dateValues.length - 1].toISOString()
        )}`
      : "—";

  const defaultTitle = "BookHive Library • Borrow Records Report";
  const defaultSubtitle =
    "Printable borrow and return records report for the current filtered list.";

  const pages = chunkRecords(sorted, 10);

  return (
    <Document title={reportTitle || defaultTitle}>
      {pages.map((pageRows, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === pages.length - 1;
        const heroStyle = isFirstPage
          ? pdfStyles.hero
          : [pdfStyles.hero, pdfStyles.heroCompact];

        return (
          <Page
            key={`borrow-records-page-${pageIndex + 1}`}
            size="A4"
            style={pdfStyles.page}
          >
            <View style={heroStyle}>
              <Text style={pdfStyles.heroTitle}>
                {reportTitle || defaultTitle}
              </Text>
              <Text style={pdfStyles.heroSub}>
                {reportSubtitle || defaultSubtitle}
                {pages.length > 1
                  ? ` • Page ${pageIndex + 1} of ${pages.length}`
                  : ""}
              </Text>
            </View>

            {isFirstPage ? (
              <>
                <View style={pdfStyles.metaGrid}>
                  <View style={pdfStyles.metaCard}>
                    <Text style={pdfStyles.metaLabel}>Generated</Text>
                    <Text style={pdfStyles.metaValue}>
                      {fmtDateTime(generatedAtIso)}
                    </Text>
                  </View>
                  <View style={pdfStyles.metaCard}>
                    <Text style={pdfStyles.metaLabel}>Rows in View</Text>
                    <Text style={pdfStyles.metaValue}>{sorted.length}</Text>
                  </View>
                  <View style={pdfStyles.metaCard}>
                    <Text style={pdfStyles.metaLabel}>Active Records</Text>
                    <Text style={pdfStyles.metaValue}>{activeCount}</Text>
                  </View>
                  <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                    <Text style={pdfStyles.metaLabel}>Returned Records</Text>
                    <Text style={pdfStyles.metaValue}>{returnedCount}</Text>
                  </View>
                </View>

                <View style={pdfStyles.metaGrid}>
                  <View style={pdfStyles.metaCard}>
                    <Text style={pdfStyles.metaLabel}>Date Coverage</Text>
                    <Text style={pdfStyles.metaValue}>{dateRange}</Text>
                  </View>
                  <View style={pdfStyles.metaCard}>
                    <Text style={pdfStyles.metaLabel}>Pending Items</Text>
                    <Text style={pdfStyles.metaValue}>{pendingCount}</Text>
                  </View>
                  <View style={pdfStyles.metaCard}>
                    <Text style={pdfStyles.metaLabel}>Overdue Items</Text>
                    <Text style={pdfStyles.metaValue}>{overdueCount}</Text>
                  </View>
                  <View style={[pdfStyles.metaCard, pdfStyles.metaCardLast]}>
                    <Text style={pdfStyles.metaLabel}>Assessed Fines</Text>
                    <Text style={pdfStyles.metaValue}>{formatPHP(totalFine)}</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={pdfStyles.pageIndicator}>
                Continuation of borrow records
              </Text>
            )}

            <Text style={pdfStyles.sectionTitle}>Borrow Items</Text>

            <View style={pdfStyles.tableHead}>
              <View style={pdfStyles.colBorrowId}>
                <Text style={pdfStyles.th}>ID</Text>
              </View>
              <View style={pdfStyles.colStudent}>
                <Text style={pdfStyles.th}>Borrower</Text>
              </View>
              <View style={pdfStyles.colBook}>
                <Text style={pdfStyles.th}>Book / Notes</Text>
              </View>
              <View style={pdfStyles.colBorrowDate}>
                <Text style={pdfStyles.th}>Borrowed</Text>
              </View>
              <View style={pdfStyles.colDueDate}>
                <Text style={pdfStyles.th}>Due</Text>
              </View>
              <View style={pdfStyles.colReturnDate}>
                <Text style={pdfStyles.th}>Returned</Text>
              </View>
              <View style={pdfStyles.colStatus}>
                <Text style={pdfStyles.thCenter}>Status</Text>
              </View>
              <View style={pdfStyles.colFine}>
                <Text style={pdfStyles.thRight}>Fine</Text>
              </View>
            </View>

            {pageRows.length ? (
              pageRows.map((record) => {
                const overdueDays = getOverdueDays(record.dueDate);
                const autoFine = overdueDays * FINE_PER_DAY;
                const statusStyle = getStatusStyle(record, pdfStyles);
                const extensionPending =
                  String(record.extensionRequestStatus ?? "")
                    .toLowerCase()
                    .trim() === "pending";

                return (
                  <View
                    key={`${String(record.id)}-${pageIndex}`}
                    style={pdfStyles.row}
                    wrap={false}
                  >
                    <View style={pdfStyles.colBorrowId}>
                      <Text style={pdfStyles.td}>{String(record.id)}</Text>
                    </View>

                    <View style={pdfStyles.colStudent}>
                      <Text style={pdfStyles.td}>
                        {getStudentPrimary(record)}
                      </Text>
                      {!!getStudentSecondary(record) && (
                        <Text style={pdfStyles.tdSubtle}>
                          {getStudentSecondary(record)}
                        </Text>
                      )}
                    </View>

                    <View style={pdfStyles.colBook}>
                      <Text style={pdfStyles.td}>{getBookPrimary(record)}</Text>
                      {extensionPending && (
                        <Text style={pdfStyles.tdSubtle}>
                          Extension request pending
                        </Text>
                      )}
                      {!!record.returnRequestedAt && (
                        <Text style={pdfStyles.tdSubtle}>
                          Return requested: {fmtDateTime(record.returnRequestedAt)}
                        </Text>
                      )}
                      {!!record.returnRequestNote && (
                        <Text style={pdfStyles.tdSubtle}>
                          Note: {record.returnRequestNote}
                        </Text>
                      )}
                      {!isReturnedStatus(record.status) &&
                        overdueDays > 0 &&
                        autoFine > 0 && (
                          <Text style={pdfStyles.tdSubtle}>
                            Overdue: {overdueDays} day
                            {overdueDays === 1 ? "" : "s"} · Auto fine:{" "}
                            {formatPHP(autoFine)}
                          </Text>
                        )}
                    </View>

                    <View style={pdfStyles.colBorrowDate}>
                      <Text style={pdfStyles.td}>{fmtDate(record.borrowDate)}</Text>
                    </View>

                    <View style={pdfStyles.colDueDate}>
                      <Text style={pdfStyles.td}>{fmtDate(record.dueDate)}</Text>
                    </View>

                    <View style={pdfStyles.colReturnDate}>
                      <Text style={pdfStyles.td}>{fmtDate(record.returnDate)}</Text>
                    </View>

                    <View style={pdfStyles.colStatus}>
                      <View style={[pdfStyles.statusBadgeWrap, statusStyle]}>
                        <Text style={pdfStyles.statusBadgeText}>
                          {statusText(record)}
                        </Text>
                      </View>
                    </View>

                    <View style={pdfStyles.colFine}>
                      <Text style={pdfStyles.tdRight}>
                        {formatPHP(normalizeAmount(record.fine))}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={pdfStyles.row}>
                <View style={{ width: "100%" }}>
                  <Text style={pdfStyles.emptyRowText}>
                    No borrow records available for this report.
                  </Text>
                </View>
              </View>
            )}

            {isLastPage ? (
              <>
                <View style={pdfStyles.totalsWrap}>
                  <View style={pdfStyles.totalsLine}>
                    <Text style={pdfStyles.totalsLabel}>Total Rows</Text>
                    <Text style={pdfStyles.totalsValue}>{sorted.length}</Text>
                  </View>
                  <View style={pdfStyles.totalsLine}>
                    <Text style={pdfStyles.totalsLabel}>Overdue Rows</Text>
                    <Text style={pdfStyles.totalsValue}>{overdueCount}</Text>
                  </View>
                  <View style={pdfStyles.totalsLine}>
                    <Text style={pdfStyles.totalsLabel}>Assessed Fine Total</Text>
                    <Text style={pdfStyles.totalsValue}>
                      {formatPHP(totalFine)}
                    </Text>
                  </View>
                  <View style={[pdfStyles.totalsLine, pdfStyles.totalsGrand]}>
                    <Text
                      style={[
                        pdfStyles.totalsLabel,
                        { fontWeight: 700 },
                      ]}
                    >
                      Estimated Auto Fine Exposure
                    </Text>
                    <Text
                      style={[
                        pdfStyles.totalsValue,
                        { fontSize: 10 },
                      ]}
                    >
                      {formatPHP(totalAutoFineExposure)}
                    </Text>
                  </View>
                </View>

                <View style={pdfStyles.notesWrap}>
                  <Text style={pdfStyles.notesTitle}>Processing Notes</Text>
                  <Text style={pdfStyles.noteText}>
                    1) This PDF reflects the current filtered borrow records shown in the dashboard.
                  </Text>
                  <Text style={pdfStyles.noteText}>
                    2) Returned rows show the final assessed fine saved in the system.
                  </Text>
                  <Text style={pdfStyles.noteText}>
                    3) Active overdue rows include an auto-fine preview based on PHP 5.00 per overdue day.
                  </Text>
                  <Text style={pdfStyles.noteText}>
                    4) Long borrower, book, and note fields are wrapped to fit the printable layout.
                  </Text>
                  <Text style={pdfStyles.noteText}>
                    (Cebuano) Ang gi-print nga report kay base sa current filtered borrow list ug naka-wrap ang taas nga text aron dili mo-slide.
                  </Text>
                </View>
              </>
            ) : null}

            <View style={pdfStyles.footer}>
              <Text style={pdfStyles.footerText}>
                BookHive Library • Generated via Borrow Records Module
              </Text>
              <Text style={pdfStyles.footerText}>
                Printed: {fmtDateTime(generatedAtIso)}
              </Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

export function ExportPreviewBorrowRecords({
  open,
  onOpenChange,
  records,
  autoPrintOnOpen = false,
  fileNamePrefix = "bookhive-borrow-records",
  reportTitle = "BookHive Library • Borrow Records Report",
  reportSubtitle = "Printable borrow and return records report for the current filtered list.",
}: ExportPreviewBorrowRecordsProps) {
  const [smartView, setSmartView] = React.useState(true);
  const [viewerHeight, setViewerHeight] = React.useState(720);
  const [generatedAtIso, setGeneratedAtIso] = React.useState(() =>
    new Date().toISOString()
  );
  const [smartPreviewUrl, setSmartPreviewUrl] = React.useState<string | null>(
    null
  );
  const [smartPreviewBusy, setSmartPreviewBusy] = React.useState(false);
  const autoPrintedRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      autoPrintedRef.current = false;
      return;
    }
    setGeneratedAtIso(new Date().toISOString());
  }, [open, records.length]);

  React.useEffect(() => {
    if (!open) return;

    const onResize = () => {
      const h = window.innerHeight;
      const next = Math.max(420, Math.min(h - 240, 1000));
      setViewerHeight(next);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  const pdfNode = React.useMemo(
    () => (
      <BorrowRecordsPdfDocument
        records={records}
        generatedAtIso={generatedAtIso}
        reportTitle={reportTitle}
        reportSubtitle={reportSubtitle}
      />
    ),
    [records, generatedAtIso, reportTitle, reportSubtitle]
  );

  React.useEffect(() => {
    let cancelled = false;
    let localUrl: string | null = null;

    async function buildSmartPreview() {
      if (!open || !records.length) {
        setSmartPreviewUrl(null);
        return;
      }

      setSmartPreviewBusy(true);
      try {
        const blob = await pdf(pdfNode).toBlob();
        if (cancelled) return;

        localUrl = URL.createObjectURL(blob);
        setSmartPreviewUrl(localUrl);
      } catch {
        if (!cancelled) {
          setSmartPreviewUrl(null);
        }
      } finally {
        if (!cancelled) {
          setSmartPreviewBusy(false);
        }
      }
    }

    void buildSmartPreview();

    return () => {
      cancelled = true;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [open, records.length, pdfNode]);

  const fileName = React.useMemo(() => {
    const ymd = new Date(generatedAtIso).toISOString().slice(0, 10);
    return `${safeToken(fileNamePrefix)}-${ymd}.pdf`;
  }, [generatedAtIso, fileNamePrefix]);

  const handlePrint = React.useCallback(async () => {
    if (!records.length) return;

    try {
      const blob = await pdf(pdfNode).toBlob();
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            toast.success("Print dialog opened", {
              description: "You can print the borrow records report now.",
            });
          } catch {
            toast.error("Could not start print", {
              description: "Try using Download PDF, then print manually.",
            });
          } finally {
            setTimeout(() => {
              if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
              URL.revokeObjectURL(blobUrl);
            }, 1500);
          }
        }, 200);
      };

      document.body.appendChild(iframe);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate PDF.";
      toast.error("Print failed", { description: message });
    }
  }, [records.length, pdfNode]);

  React.useEffect(() => {
    if (!open || !autoPrintOnOpen || autoPrintedRef.current || !records.length) {
      return;
    }
    autoPrintedRef.current = true;
    void handlePrint();
  }, [open, autoPrintOnOpen, records.length, handlePrint]);

  const activeCount = records.filter((r) => !isReturnedStatus(r.status)).length;
  const returnedCount = records.filter((r) => isReturnedStatus(r.status)).length;
  const totalFine = records.reduce(
    (sum, r) => sum + normalizeAmount(r.fine),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl bg-slate-950 border-white/10 text-white p-0 overflow-hidden h-[90svh]">
        <div className="px-5 pt-5 pb-3 border-b border-white/10">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Borrow Records PDF Preview &amp; Export
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Smart View uses a fit-width pre-rendered preview. Standard View uses
              the PDF React Viewer with toolbar for the current filtered borrow
              records list.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 space-y-4">
          <Card className="bg-slate-900/70 border-white/10">
            <CardContent className="pt-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-sky-500/20 text-sky-100 border-sky-300/40">
                    {records.length} record{records.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge className="bg-violet-500/20 text-violet-100 border-violet-300/40">
                    Active: {activeCount}
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/40">
                    Returned: {returnedCount}
                  </Badge>
                  <Badge className="bg-amber-500/20 text-amber-100 border-amber-300/40">
                    Fines: {formatPHP(totalFine)}
                  </Badge>
                  <Badge
                    className={
                      smartView
                        ? "bg-cyan-500/20 text-cyan-100 border-cyan-300/40"
                        : "bg-slate-500/20 text-slate-100 border-slate-300/40"
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      <ScanLine className="h-3.5 w-3.5" />
                      {smartView ? "Smart View (Fit Width)" : "Standard Viewer"}
                    </span>
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => setSmartView((v) => !v)}
                  >
                    {smartView ? "Use Standard Viewer" : "Use Smart View"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/10"
                    onClick={() => void handlePrint()}
                    disabled={!records.length}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print now
                  </Button>

                  <PDFDownloadLink document={pdfNode} fileName={fileName}>
                    {({ loading }) => (
                      <Button
                        type="button"
                        className="bg-sky-600 hover:bg-sky-700 text-white"
                        disabled={loading || !records.length}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Preparing…
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                          </>
                        )}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border border-white/10 bg-black/30 overflow-hidden">
            {records.length ? (
              smartView ? (
                smartPreviewBusy ? (
                  <div
                    className="flex items-center justify-center text-sm text-white/70"
                    style={{ height: viewerHeight }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Rendering smart preview…
                    </span>
                  </div>
                ) : smartPreviewUrl ? (
                  <iframe
                    title="Smart Borrow Records PDF Preview"
                    src={`${smartPreviewUrl}#view=FitH&toolbar=1&navpanes=0`}
                    style={{
                      width: "100%",
                      height: viewerHeight,
                      border: "none",
                    }}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center text-sm text-white/60"
                    style={{ height: viewerHeight }}
                  >
                    Could not render smart preview. Switch to Standard Viewer.
                  </div>
                )
              ) : (
                <PDFViewer
                  style={{
                    width: "100%",
                    height: viewerHeight,
                    border: "none",
                  }}
                  showToolbar
                >
                  {pdfNode}
                </PDFViewer>
              )
            ) : (
              <div className="h-[420px] flex items-center justify-center text-sm text-white/60">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  No borrow records available for preview.
                </span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ExportPreviewBorrowRecords;