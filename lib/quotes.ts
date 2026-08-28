import { getJsonFile, putJsonFile, deleteFile } from "@/lib/github";
import { calculateSummary } from "@/lib/calc";
import type { Quote, QuoteIndex, QuoteIndexEntry } from "@/lib/types";

export async function listQuoteIndex(): Promise<QuoteIndexEntry[]> {
  const res = await getJsonFile<QuoteIndex>("index.json");
  return res?.data.quotes ?? [];
}

export async function getQuote(id: string, variant: string): Promise<{ quote: Quote; sha: string } | null> {
  const res = await getJsonFile<Quote>(`quotes/${id}/${variant}.json`);
  if (!res) return null;
  return { quote: res.data, sha: res.sha };
}

/** Resolves "id/variant" strings (as used in the ?ids= query param) to full quotes, skipping any that no longer exist. */
export async function getQuotesByIds(ids: string[]): Promise<Quote[]> {
  const results = await Promise.all(
    ids.map(async (idVariant) => {
      const [id, variant] = idVariant.split("/");
      if (!id || !variant) return null;
      const res = await getQuote(id, variant);
      return res?.quote ?? null;
    })
  );
  return results.filter((q): q is Quote => q !== null);
}

export interface SaveQuoteInput {
  quote: Omit<Quote, "calculated" | "updatedAt" | "updatedBy">;
  previousSha?: string;
  updatedBy: string;
  /** The quote's id/variant before this edit — set when editing an existing quote so a
   *  change to id/variant is handled as a rename (old file removed) rather than a stray copy. */
  renameFrom?: { id: string; variant: string };
}

/** Recomputes the summary, commits the quote file, and keeps index.json in sync.
 *  Handles a Product ID / Variant rename by writing the new file and removing the old one. */
export async function saveQuote({ quote, previousSha, updatedBy, renameFrom }: SaveQuoteInput): Promise<Quote> {
  const calculated = calculateSummary({
    material: quote.material,
    labor: quote.labor,
    packing: quote.packing,
    transportation: quote.transportation,
    overheadRate: quote.overheadRate,
    profitRate: quote.profitRate,
    finalPriceToCustomer: quote.finalPriceOverride,
  });

  const fullQuote: Quote = {
    ...quote,
    updatedAt: new Date().toISOString(),
    updatedBy,
    calculated,
  };

  const isRename = Boolean(renameFrom && (renameFrom.id !== quote.id || renameFrom.variant !== quote.variant));
  const path = `quotes/${quote.id}/${quote.variant}.json`;
  const action = previousSha && !isRename ? "update" : "create";
  await putJsonFile(
    path,
    fullQuote,
    `quote(${quote.id}/${quote.variant}): ${action} by ${updatedBy}`,
    updatedBy,
    isRename ? undefined : previousSha
  );

  if (isRename && renameFrom && previousSha) {
    const oldPath = `quotes/${renameFrom.id}/${renameFrom.variant}.json`;
    await deleteFile(
      oldPath,
      `quote(${renameFrom.id}/${renameFrom.variant}): renamed to ${quote.id}/${quote.variant} by ${updatedBy}`,
      previousSha
    );
  }

  await upsertIndexEntry(fullQuote, path, updatedBy, isRename ? renameFrom : undefined);
  return fullQuote;
}

async function upsertIndexEntry(
  quote: Quote,
  path: string,
  updatedBy: string,
  removeKey?: { id: string; variant: string }
): Promise<void> {
  const existing = await getJsonFile<QuoteIndex>("index.json");
  let quotes = existing?.data.quotes ?? [];
  if (removeKey) {
    quotes = quotes.filter((q) => !(q.id === removeKey.id && q.variant === removeKey.variant));
  }
  const entry: QuoteIndexEntry = {
    id: quote.id,
    variant: quote.variant,
    productName: quote.productName,
    customerName: quote.customerName,
    inquiryDate: quote.inquiryDate,
    material: quote.material.name,
    monthlyQty: quote.monthlyQty,
    finalPriceToCustomer: quote.calculated.finalPriceToCustomer,
    grossMarginPct: quote.calculated.grossMarginPct,
    status: quote.status,
    updatedAt: quote.updatedAt,
    updatedBy: quote.updatedBy,
    path,
  };
  const next = quotes.filter((q) => !(q.id === quote.id && q.variant === quote.variant));
  next.push(entry);
  await putJsonFile(
    "index.json",
    { quotes: next } satisfies QuoteIndex,
    `index: update entry for ${quote.id}/${quote.variant}`,
    updatedBy,
    existing?.sha
  );
}
