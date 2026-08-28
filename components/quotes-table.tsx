"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuoteIndexEntry } from "@/lib/types";
import type { CustomerRecord } from "@/lib/customers";

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

function sortTime(q: QuoteIndexEntry): number {
  const d = q.inquiryDate || q.updatedAt;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function QuotesTable({ quotes, customers = [] }: { quotes: QuoteIndexEntry[]; customers?: CustomerRecord[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quotes;
    return quotes.filter(
      (q) =>
        q.productName.toLowerCase().includes(term) ||
        q.material.toLowerCase().includes(term) ||
        q.customerName?.toLowerCase().includes(term)
    );
  }, [quotes, search]);

  // Grouped by customer, newest inquiry date first — both the group order and the
  // quotes within each group.
  const groups = useMemo(() => {
    const byCustomer = new Map<string, QuoteIndexEntry[]>();
    for (const q of filtered) {
      const key = q.customerName || "(No Customer)";
      if (!byCustomer.has(key)) byCustomer.set(key, []);
      byCustomer.get(key)!.push(q);
    }
    const result = Array.from(byCustomer.entries()).map(([customer, qs]) => {
      const sorted = [...qs].sort((a, b) => sortTime(b) - sortTime(a));
      return { customer, quotes: sorted, latest: sortTime(sorted[0]) };
    });
    result.sort((a, b) => b.latest - a.latest);
    return result;
  }, [filtered]);

  function customerRecord(name: string): CustomerRecord | undefined {
    return customers.find((c) => c.customerName.toLowerCase() === name.toLowerCase());
  }

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
          placeholder="Search by customer, product, or material"
          className="w-80 rounded-[9px] border border-knt-pale-blue bg-white px-3.5 py-2 text-xs outline-none focus:border-knt-blue"
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
              <Th>Inquiry Date</Th>
              <Th>Updated</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {groups.map(({ customer, quotes: groupQuotes }) => {
              const record = customerRecord(customer);
              const popoverKey = customer;
              return (
                <Fragment key={customer}>
                  <tr className="bg-knt-pale-blue/40">
                    <td colSpan={11} className="px-3.5 py-2 relative">
                      <button
                        onClick={() => setOpenPopover((k) => (k === popoverKey ? null : popoverKey))}
                        className="font-heading text-[13px] font-bold text-knt-navy hover:underline"
                      >
                        {customer}
                      </button>
                      <span className="ml-2 text-[11px] text-gray-500">
                        {groupQuotes.length} quote{groupQuotes.length === 1 ? "" : "s"}
                      </span>
                      {openPopover === popoverKey && (
                        <div className="absolute z-10 top-full left-3.5 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-700">
                          {record ? (
                            <>
                              <div className="mb-1">
                                <span className="text-gray-400">Industry:</span> {record.industry || "-"}
                              </div>
                              <div className="mb-1">
                                <span className="text-gray-400">Business Type:</span> {record.businessType || "-"}
                              </div>
                              <div>
                                <span className="text-gray-400">Product:</span> {record.product || "-"}
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-400">No Customer Master record found for this name.</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {groupQuotes.map((q) => {
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
                        <Td className="text-gray-400">{q.inquiryDate ? new Date(q.inquiryDate).toLocaleDateString() : "-"}</Td>
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
                            className="inline-flex items-center gap-1 bg-white text-knt-navy border border-knt-pale-blue rounded-md px-2.5 py-1 text-[11px] font-medium hover:bg-knt-pale-blue/30 whitespace-nowrap"
                          >
                            Duplicate
                          </Link>
                        </Td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center text-sm text-gray-400 py-12">
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
