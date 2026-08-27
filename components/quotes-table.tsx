"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuoteIndexEntry } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-knt-blue/[0.14] text-[#0f6fa8]",
  comparison: "bg-knt-pale-blue text-knt-navy",
  pending_approval: "bg-knt-ivory text-knt-brown",
  draft: "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  comparison: "Comparison",
  pending_approval: "Pending Approval",
  draft: "Draft",
};

function rowKey(q: QuoteIndexEntry) {
  return `${q.id}::${q.variant}`;
}

export function QuotesTable({ quotes }: { quotes: QuoteIndexEntry[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quotes;
    return quotes.filter(
      (q) => q.productName.toLowerCase().includes(term) || q.material.toLowerCase().includes(term)
    );
  }, [quotes, search]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectedIds(): string[] {
    return quotes.filter((q) => selected.has(rowKey(q))).map((q) => `${q.id}/${q.variant}`);
  }

  function expandToSpreadsheet() {
    const ids = selectedIds();
    if (ids.length === 0) return;
    router.push(`/quotes/spreadsheet?ids=${encodeURIComponent(ids.join(","))}`);
  }

  function exportCsv() {
    const ids = selectedIds();
    const query = ids.length > 0 ? `?ids=${encodeURIComponent(ids.join(","))}` : "";
    // Full navigation (not router.push) is required so the browser treats the
    // response's Content-Disposition: attachment header as a file download.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/export/csv${query}`;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-8 pt-6 pb-4">
        <div className="font-heading text-2xl font-bold text-knt-navy">Quotes</div>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 bg-knt-blue text-white rounded-[9px] px-5 py-2.5 text-[13px] font-medium shadow-[0_4px_10px_rgba(65,182,230,0.35)]"
        >
          + New Quote
        </Link>
      </div>

      <div className="flex items-center gap-3 px-8 pb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product or material"
          className="w-72 rounded-[9px] border border-knt-pale-blue bg-white px-3.5 py-2 text-xs outline-none focus:border-knt-blue"
        />
        <div className="flex-1" />
        {selected.size > 0 && (
          <div className="text-xs font-medium text-knt-blue bg-knt-blue/10 rounded-full px-3.5 py-1.5">
            {selected.size} selected
          </div>
        )}
        <button
          onClick={expandToSpreadsheet}
          disabled={selected.size === 0}
          className="flex items-center gap-1.5 bg-knt-navy text-white rounded-lg px-3.5 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Expand to Spreadsheet
        </button>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 bg-white text-gray-700 border border-knt-pale-blue rounded-lg px-3.5 py-2 text-xs font-medium"
        >
          Export
        </button>
      </div>

      <div className="flex-1 mx-8 mb-6 bg-white rounded-[14px] border border-gray-100 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-9" />
              <Th>Product</Th>
              <Th>Material</Th>
              <Th>Monthly Qty</Th>
              <Th>Unit Price (THB)</Th>
              <Th>Gross Margin</Th>
              <Th>Updated</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => {
              const key = rowKey(q);
              const checked = selected.has(key);
              return (
                <tr key={key} className={checked ? "bg-knt-blue/[0.06]" : ""}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(key)}
                      className="w-[15px] h-[15px] accent-[#41B6E6]"
                    />
                  </Td>
                  <Td>
                    <Link href={`/quotes/${q.id}/${q.variant}`} className="font-medium text-knt-navy hover:underline">
                      {q.productName}
                      {q.variant !== "current" ? ` (${q.variant})` : ""}
                    </Link>
                  </Td>
                  <Td>{q.material}</Td>
                  <Td>{q.monthlyQty.toLocaleString()} pcs</Td>
                  <Td className="font-medium">{q.finalPriceToCustomer.toFixed(2)}</Td>
                  <Td>{(q.grossMarginPct * 100).toFixed(1)}%</Td>
                  <Td className="text-gray-400">{new Date(q.updatedAt).toLocaleDateString()}</Td>
                  <Td>{q.updatedBy}</Td>
                  <Td>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full ${STATUS_STYLE[q.status] ?? ""}`}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/quotes/new?copyFrom=${encodeURIComponent(`${q.id}/${q.variant}`)}`}
                      className="text-knt-blue text-[11.5px] font-medium hover:underline whitespace-nowrap"
                    >
                      Duplicate
                    </Link>
                  </Td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-sm text-gray-400 py-12">
                  No quotes yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[11px] font-medium text-gray-500 px-3.5 py-2.5 border-b border-knt-pale-blue">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`text-[13px] text-gray-700 px-3.5 py-3 border-b border-gray-100 ${className}`}>{children}</td>;
}
