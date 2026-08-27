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
  previousSha: string | undefined,
  renameFrom?: { id: string; variant: string }
): Promise<SaveQuoteResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, error: "Not signed in." };
  }
  if (!quote.id.trim() || !quote.variant.trim()) {
    return { ok: false, error: "Product ID and Variant are required." };
  }
  if (!quote.customerName?.trim() || !quote.projectName?.trim()) {
    return { ok: false, error: "Customer Name and Project Name are required." };
  }
  if (quote.projectType === "other" && !quote.projectTypeOther?.trim()) {
    return { ok: false, error: 'Please describe the project type when "Other" is selected.' };
  }
  if (!quote.massProductionStart?.year || !quote.massProductionStart?.period) {
    return { ok: false, error: "Mass Production Start is required." };
  }

  try {
    await saveQuoteInternal({ quote, previousSha, updatedBy: email, renameFrom });

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
    if (renameFrom && (renameFrom.id !== quote.id || renameFrom.variant !== quote.variant)) {
      revalidatePath(`/quotes/${renameFrom.id}/${renameFrom.variant}`);
    }
  } catch (err) {
    if (err instanceof QuoteConflictError) {
      return { ok: false, error: "Someone else updated this quote. Reload the page and try again." };
    }
    console.error("Failed to save quote", err);
    return { ok: false, error: "Failed to save the quote. Please try again." };
  }

  redirect(`/quotes/${quote.id}/${quote.variant}`);
}
