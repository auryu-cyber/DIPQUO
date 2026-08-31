import ExcelJS from "exceljs";
import type { Quote } from "@/lib/types";

interface Row {
  label: string;
  value: (q: Quote) => string | number;
}

const ROWS: Row[] = [
  { label: "Monthly Qty (pcs)", value: (q) => q.monthlyQty },
  { label: "Material Cost (THB/pc)", value: (q) => q.calculated.materialCostPerPc },
  { label: "Labor Cost (THB/pc)", value: (q) => q.calculated.laborCostPerPc },
  { label: "Packing Cost (THB/pc)", value: (q) => q.calculated.packingCostPerPc },
  { label: "Transportation Cost (THB/pc)", value: (q) => q.calculated.transportationCostPerPc },
  { label: "COGS (THB/pc)", value: (q) => q.calculated.cogs },
  { label: "OH (THB/pc)", value: (q) => q.calculated.overhead },
  { label: "Profit (THB/pc)", value: (q) => q.calculated.profit },
  { label: "Total price (THB/pc)", value: (q) => q.calculated.totalPrice },
  { label: "Material %", value: (q) => `${(q.calculated.materialPct * 100).toFixed(1)}%` },
  { label: "Gross Margin", value: (q) => `${(q.calculated.grossMarginPct * 100).toFixed(1)}%` },
  { label: "Final Price to Customer (THB)", value: (q) => q.calculated.finalPriceToCustomer },
];

function columnHeader(q: Quote): string {
  return q.variant === "current" ? q.id : `${q.id} (${q.variant})`;
}

export function buildCsv(quotes: Quote[]): string {
  const header = ["Item", ...quotes.map(columnHeader)];
  const lines = [header, ...ROWS.map((row) => [row.label, ...quotes.map((q) => String(row.value(q)))])];
  return lines.map((line) => line.map(csvEscape).join(",")).join("\n") + "\n";
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function buildXlsx(quotes: Quote[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Quotes");

  sheet.columns = [{ width: 32 }, ...quotes.map(() => ({ width: 22 }))];

  const headerRow = sheet.addRow(["Item", ...quotes.map(columnHeader)]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002D72" } };
  });

  for (const row of ROWS) {
    sheet.addRow([row.label, ...quotes.map((q) => row.value(q))]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
