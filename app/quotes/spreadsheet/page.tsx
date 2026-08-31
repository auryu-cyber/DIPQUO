import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getQuotesByIds } from "@/lib/quotes";
import type { Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROWS: { label: string; value: (q: Quote) => string; bold?: boolean; section?: boolean }[] = [
  { label: "Monthly Qty (pcs)", value: (q) => q.monthlyQty.toLocaleString() },
  { label: "Cost Breakdown (THB/pc)", value: () => "", section: true },
  { label: "Material Cost", value: (q) => q.calculated.materialCostPerPc.toFixed(3) },
  { label: "Labor Cost", value: (q) => q.calculated.laborCostPerPc.toFixed(3) },
  { label: "Packing Cost", value: (q) => q.calculated.packingCostPerPc.toFixed(3) },
  { label: "Transportation Cost", value: (q) => q.calculated.transportationCostPerPc.toFixed(3) },
  { label: "COGS", value: (q) => q.calculated.cogs.toFixed(3), bold: true },
  { label: "OH", value: (q) => q.calculated.overhead.toFixed(3) },
  { label: "Profit", value: (q) => q.calculated.profit.toFixed(3) },
  { label: "Summary", value: () => "", section: true },
  { label: "Total price", value: (q) => q.calculated.totalPrice.toFixed(3), bold: true },
  { label: "Material %", value: (q) => `${(q.calculated.materialPct * 100).toFixed(1)}%` },
  { label: "Gross Margin", value: (q) => `${(q.calculated.grossMarginPct * 100).toFixed(1)}%` },
  { label: "Final Price to Customer", value: (q) => `${q.calculated.finalPriceToCustomer.toFixed(2)} THB`, bold: true },
];

export default async function SpreadsheetPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = ids ? ids.split(",") : [];
  const quotes = await getQuotesByIds(idList);
  const query = ids ? `?ids=${encodeURIComponent(ids)}` : "";

  return (
    <AppShell>
      <div className="flex flex-col h-screen">
        <div className="flex items-center justify-between px-8 pt-6 pb-3">
          <div>
            <div className="text-[11px] text-gray-400">
              <Link href="/quotes" className="hover:underline">
                Quotes
              </Link>{" "}
              &nbsp;›&nbsp; Spreadsheet View
            </div>
            <div className="font-heading text-xl font-bold text-knt-navy">
              {quotes.length} Quotes Expanded to Spreadsheet
            </div>
          </div>
          <div className="flex gap-2.5">
            <a
              href={`/api/export/csv${query}`}
              className="flex items-center gap-2 bg-white text-gray-700 border border-knt-pale-blue rounded-[9px] px-4 py-2.5 text-[12.5px] font-medium"
            >
              Download CSV
            </a>
            <a
              href={`/api/export/xlsx${query}`}
              className="flex items-center gap-2 bg-white text-gray-700 border border-knt-pale-blue rounded-[9px] px-4 py-2.5 text-[12.5px] font-medium"
            >
              Download Excel
            </a>
          </div>
        </div>

        <div className="flex-1 mx-8 mb-8 bg-white rounded-[14px] border border-gray-100 overflow-auto">
          {quotes.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-16">
              No quotes selected. Go back to the list and select at least one.
            </div>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="text-left bg-[#454142] text-white font-medium px-4 py-2.5 border border-gray-200">Item</th>
                  {quotes.map((q) => (
                    <th key={`${q.id}/${q.variant}`} className="bg-knt-navy text-white font-medium px-4 py-2.5 border border-gray-200 text-center">
                      {q.id}
                      <div className="font-normal opacity-75 text-[11px]">{q.material.name}{q.variant !== "current" ? ` · ${q.variant}` : ""}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) =>
                  row.section ? (
                    <tr key={row.label} className="bg-knt-pale-blue">
                      <td colSpan={quotes.length + 1} className="font-bold text-knt-navy text-[11.5px] px-4 py-1.5 border border-gray-200">
                        {row.label}
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.label}>
                      <td className={`bg-gray-50 px-4 py-2 border border-gray-200 ${row.bold ? "font-bold" : ""}`}>{row.label}</td>
                      {quotes.map((q) => (
                        <td key={`${q.id}/${q.variant}`} className={`text-right px-4 py-2 border border-gray-200 ${row.bold ? "font-bold" : ""}`}>
                          {row.value(q)}
                        </td>
                      ))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
