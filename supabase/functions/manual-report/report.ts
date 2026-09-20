export type TransactionRow = {
  transaction_no: string;
  subject: string;
  entity: string;
  transaction_type?: string | null;
  status: string;
  required_action: string;
  entry_date?: string;
  sent_date?: string | null;
  outgoing_letter_no?: string | null;
  sent_to?: string | null;
  notes?: string | null;
};

export type ReportRow = TransactionRow & {
  entryDateHijri: string;
  sentDateHijri: string | null;
  waitingDays: number | null;
};

export type ReportModel = {
  generatedTitle: string;
  generatedAt: {
    dayName: string;
    gregorianDate: string;
    hijriDate: string;
    time: string;
  };
  summary: {
    open: number;
    progress: number;
    wait: number;
    follow: number;
    late: number;
  };
  rows: ReportRow[];
};

const RIYADH_TIME_ZONE = "Asia/Riyadh";

const STATUS_PRIORITY = new Map([
  ["متأخرة", 0],
  ["تحتاج إلحاقي", 1],
  ["بانتظار رد", 2],
  ["تحت الإجراء", 3],
  ["قيد الإجراء", 4],
]);

function dateParts(
  value: Date,
  locale: string,
  calendar?: string,
): { year: string; month: string; day: string } {
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: RIYADH_TIME_ZONE,
    calendar,
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    formatted.find((item) => item.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
}

function isoDate(value: Date, calendar?: string): string {
  const parts = dateParts(value, calendar ? "ar-SA" : "en-CA", calendar);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateOnlyUtc(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

function hijriDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const date = dateOnlyUtc(value);
  return date ? isoDate(date, "islamic-umalqura") : value;
}

function workingDaysBetween(startValue: string | null | undefined, endValue: string): number | null {
  if (!startValue) return null;
  const start = dateOnlyUtc(startValue);
  const end = dateOnlyUtc(endValue);
  if (!start || !end || start >= end) return 0;
  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 5 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function buildGeneratedAt(now: Date): ReportModel["generatedAt"] {
  return {
    dayName: new Intl.DateTimeFormat("ar-SA", {
      timeZone: RIYADH_TIME_ZONE,
      weekday: "long",
    }).format(now),
    gregorianDate: isoDate(now),
    hijriDate: isoDate(now, "islamic-umalqura"),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: RIYADH_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now),
  };
}

export function buildReportModel(rows: TransactionRow[], now: Date): ReportModel {
  const generatedAt = buildGeneratedAt(now);
  const openRows = rows
    .filter((row) => row.status !== "منتهية")
    .toSorted((a, b) =>
      (STATUS_PRIORITY.get(a.status) ?? 99) - (STATUS_PRIORITY.get(b.status) ?? 99) ||
      a.transaction_no.localeCompare(b.transaction_no, "ar", { numeric: true })
    )
    .map((row) => ({
      ...row,
      entryDateHijri: hijriDateOnly(row.entry_date) ?? "—",
      sentDateHijri: hijriDateOnly(row.sent_date),
      waitingDays: workingDaysBetween(row.sent_date, generatedAt.gregorianDate),
    }));

  return {
    generatedTitle: "التقرير اليومي لمتابعة أعمال قسم الشؤون القانونية",
    generatedAt,
    summary: {
      open: openRows.length,
      progress: openRows.filter((row) => ["قيد الإجراء", "تحت الإجراء"].includes(row.status)).length,
      wait: openRows.filter((row) => row.status === "بانتظار رد").length,
      follow: openRows.filter((row) => row.status === "تحتاج إلحاقي").length,
      late: openRows.filter((row) => row.status === "متأخرة").length,
    },
    rows: openRows,
  };
}
