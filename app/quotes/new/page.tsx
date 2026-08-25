import { AppShell } from "@/components/app-shell";
import { QuoteForm } from "@/components/quote-form";
import { loadQuoteFormMasters } from "@/lib/masters-lookup";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const masters = await loadQuoteFormMasters();
  return (
    <AppShell>
      <QuoteForm masters={masters} />
    </AppShell>
  );
}
