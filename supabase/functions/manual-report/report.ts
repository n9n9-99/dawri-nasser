export type TransactionRow = {
  transaction_no: string;
  subject: string;
  entity: string;
  status: string;
  required_action: string;
  entry_date?: string;
  notes?: string | null;
};

export type ReportModel = {
  reportDate: string;
  generatedTitle: string;
  rows: TransactionRow[];
};

const STATUS_PRIORITY = new Map([
  ["متأخرة", 0],
  ["تحتاج إلحاقي", 1],
  ["بانتظار رد", 2],
  ["تحت الإجراء", 3],
  ["قيد الإجراء", 4],
]);

export function buildReportModel(rows: TransactionRow[], reportDate: string): ReportModel {
  return {
    reportDate,
    generatedTitle: "تقرير متابعة أعمال قسم الشؤون القانونية",
    rows: rows
      .filter((row) => row.status !== "منتهية")
      .toSorted((a, b) =>
        (STATUS_PRIORITY.get(a.status) ?? 99) - (STATUS_PRIORITY.get(b.status) ?? 99) ||
        a.transaction_no.localeCompare(b.transaction_no, "ar", { numeric: true })
      ),
  };
}
