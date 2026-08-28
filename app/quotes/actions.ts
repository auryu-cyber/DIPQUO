"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { saveQuote as saveQuoteInternal, getQuote } from "@/lib/quotes";
import { appendLog } from "@/lib/logs";
import { QuoteConflictError } from "@/lib/github";
import { formatNumber } from "@/lib/format";
import type { Quote } from "@/lib/types";

export interface SaveQuoteResult {
  ok: boolean;
  error?: string;
}

/** Compares the fields most likely to matter to a reader of the activity log and
 *  produces "Label: old → new" strings for anything that actually changed. */
function diffQuoteFields(oldQ: Quote | null, newQ: Quote): string[] {
  if (!oldQ) return [];
  const changes: string[] = [];
  const text = (label: string, oldVal: unknown, newVal: unknown) => {
    if (oldVal !== newVal) changes.push(`${label}: ${oldVal ?? "-"} → ${newVal ?? "-"}`);
  };
  const num = (label: string, oldVal: number, newVal: number, decimals = 2) => {
    if (oldVal !== newVal) changes.push(`${label}: ${formatNumber(oldVal, decimals)} → ${formatNumber(newVal, decimals)}`);
  };

  text("Product Name", oldQ.productName, newQ.productName);
  text("Customer Name", oldQ.customerName, newQ.customerName);
  text("Project Name", oldQ.projectName, newQ.projectName);
  text("Status", oldQ.status, newQ.status);
  text("Order Status", oldQ.orderStatus, newQ.orderStatus);
  num("Monthly Qty", oldQ.monthlyQty, newQ.monthlyQty, 0);
  num("Material Price (THB/kg)", oldQ.material.pricePerKg, newQ.material.pricePerKg);
  num("Weight (g/pc)", oldQ.material.weightG, newQ.material.weightG, 3);
  num("Hourly Charge (THB/h)", oldQ.labor.hourlyChargeTHB, newQ.labor.hourlyChargeTHB);
  num("Tooling Customer Markup", oldQ.tooling.customerMarkup, newQ.tooling.customerMarkup, 3);
  num("Overhead Rate", oldQ.overheadRate * 100, newQ.overheadRate * 100, 1);
  num("Profit Rate", oldQ.profitRate * 100, newQ.profitRate * 100, 1);
  num("Final Price to Customer", oldQ.calculated.finalPriceToCustomer, newQ.calculated.finalPriceToCustomer, 3);
  text("Pricing Date", oldQ.pricingDate, newQ.pricingDate);

  return changes;
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
  if (!quote.massProductionStart?.year) {
    return { ok: false, error: "Mass Production Start Year is required." };
  }

  let oldQuote: Quote | null = null;
  if (previousSha) {
    const sourceId = renameFrom?.id ?? quote.id;
    const sourceVariant = renameFrom?.variant ?? quote.variant;
    const existing = await getQuote(sourceId, sourceVariant);
    oldQuote = existing?.quote ?? null;
  }

  try {
    const saved = await saveQuoteInternal({ quote, previousSha, updatedBy: email, renameFrom });
    const changes = diffQuoteFields(oldQuote, saved);

    await appendLog(
      "activity",
      {
        type: "activity",
        at: new Date().toISOString(),
        user: email,
        action: previousSha ? "edited" : "created",
        target: `${quote.id}/${quote.variant}`,
        detail: changes.length > 0 ? changes.join("; ") : previousSha ? "No field changes" : "Created",
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

export interface DuplicateQuotesResult {
  ok: boolean;
  error?: string;
  created?: { id: string; variant: string }[];
}

/** Duplicates each selected quote in place as a new draft (unique variant, no link back
 *  to the source), so the caller can then open and edit each copy individually. */
export async function duplicateQuotesAction(idVariantPairs: string[]): Promise<DuplicateQuotesResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, error: "Not signed in." };
  }
  if (idVariantPairs.length === 0) {
    return { ok: false, error: "No quotes selected." };
  }

  const created: { id: string; variant: string }[] = [];
  try {
    for (let i = 0; i < idVariantPairs.length; i++) {
      const [id, variant] = idVariantPairs[i].split("/");
      if (!id || !variant) continue;
      const existing = await getQuote(id, variant);
      if (!existing) continue;

      // Quote is a structural superset of the save payload type; assigning through a
      // variable (not an object literal) skips the excess-property check for calculated/
      // updatedAt/updatedBy, which the spread below then naturally leaves out.
      const quotePayload: Omit<Quote, "calculated" | "updatedAt" | "updatedBy"> = existing.quote;
      const newVariant = `${variant}-copy-${Date.now().toString(36)}${i}`;
      const saved = await saveQuoteInternal({
        quote: { ...quotePayload, variant: newVariant, status: "draft" },
        updatedBy: email,
      });
      created.push({ id: saved.id, variant: saved.variant });
    }

    await appendLog(
      "activity",
      {
        type: "activity",
        at: new Date().toISOString(),
        user: email,
        action: "created",
        target: created.map((c) => `${c.id}/${c.variant}`).join(", "),
        detail: `Duplicated ${created.length} quote(s) from selection`,
      },
      email
    ).catch((err) => console.error("Failed to log bulk duplicate", err));

    revalidatePath("/quotes");
  } catch (err) {
    console.error("Failed to duplicate quotes", err);
    return { ok: false, error: "Failed to duplicate one or more quotes. Please try again.", created };
  }

  return { ok: true, created };
}
