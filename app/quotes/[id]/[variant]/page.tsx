import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { QuoteForm } from "@/components/quote-form";
import { getQuote } from "@/lib/quotes";
import { loadQuoteFormMasters } from "@/lib/masters-lookup";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string; variant: string }>;
}) {
  const { id, variant } = await params;
  const [result, masters] = await Promise.all([getQuote(id, variant), loadQuoteFormMasters()]);

  if (!result) notFound();

  return (
    <AppShell>
      <QuoteForm masters={masters} initialQuote={result.quote} previousSha={result.sha} />
    </AppShell>
  );
}
