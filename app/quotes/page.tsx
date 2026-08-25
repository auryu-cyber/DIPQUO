import { listQuoteIndex } from "@/lib/quotes";
import { AppShell } from "@/components/app-shell";
import { QuotesTable } from "@/components/quotes-table";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const quotes = await listQuoteIndex();

  return (
    <AppShell>
      <QuotesTable quotes={quotes} />
    </AppShell>
  );
}
