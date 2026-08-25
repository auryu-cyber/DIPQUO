"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { saveQuote as saveQuoteInternal } from "@/lib/quotes";
import { appendLog } from "@/lib/logs";
import { QuoteConflictError } from "@/lib/github";
import type { Quote } from "@/lib/types";

export interface SaveQuoteResult {
  ok: boolean;
  error?: string;
}

export async function saveQuoteAction(
  quote: Omit<Quote, "calculated" | "updatedAt" | "updatedBy">,
  previousSha: string | undefined
): Promise<SaveQuoteResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, error: "Not signed in." };
  }

  try {
    await saveQuoteInternal({ quote, previousSha, updatedBy: email });

    await appendLog(
      "activity",
      {
        type: "activity",
        at: new Date().toISOString(),
        user: email,
        action: previousSha ? "edited" : "created",
        target: `${quote.id}/${quote.variant}`,
      },
      email
    );

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quote.id}/${quote.variant}`);
  } catch (err) {
    if (err instanceof QuoteConflictError) {
      return { ok: false, error: "Someone else updated this quote. Reload the page and try again." };
    }
    console.error("Failed to save quote", err);
    return { ok: false, error: "Failed to save the quote. Please try again." };
  }

  redirect(`/quotes/${quote.id}/${quote.variant}`);
}
