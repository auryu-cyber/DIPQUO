import { AppShell } from "@/components/app-shell";
import { QuoteForm } from "@/components/quote-form";
import { loadQuoteFormMasters } from "@/lib/masters-lookup";
import { getQuote } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ copyFrom?: string }>;
}) {
  const { copyFrom } = await searchParams;
  const [masters, copyFromQuote] = await Promise.all([loadQuoteFormMasters(), resolveCopySource(copyFrom)]);

  return (
    <AppShell>
      <QuoteForm masters={masters} copyFromQuote={copyFromQuote} />
    </AppShell>
  );
}

async function resolveCopySource(copyFrom: string | undefined) {
  if (!copyFrom) return undefined;
  const [id, variant] = copyFrom.split("/");
  if (!id || !variant) return undefined;
  const res = await getQuote(id, variant);
  return res?.quote;
}
