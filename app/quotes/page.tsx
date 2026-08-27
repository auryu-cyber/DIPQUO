import { listQuoteIndex } from "@/lib/quotes";
import { AppShell } from "@/components/app-shell";
import { QuotesTable } from "@/components/quotes-table";
import type { QuoteIndexEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  let quotes: QuoteIndexEntry[];
  let loadError: string | null = null;
  try {
    quotes = await listQuoteIndex();
  } catch (err) {
    quotes = [];
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <AppShell>
      {loadError && (
        <div className="mx-8 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load quotes from GitHub: {loadError}
        </div>
      )}
      <QuotesTable quotes={quotes} />
    </AppShell>
  );
}
