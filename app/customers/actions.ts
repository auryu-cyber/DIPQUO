"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { saveCustomer, deleteCustomer } from "@/lib/customers";
import { appendLog } from "@/lib/logs";
import type { SaveCustomerInput } from "@/lib/customers";

export interface CustomerActionResult {
  ok: boolean;
  error?: string;
}

async function requireAdmin(): Promise<{ email: string } | { error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin || !session.user.email) {
    return { error: "Admin access required." };
  }
  return { email: session.user.email };
}

export async function saveCustomerAction(input: SaveCustomerInput): Promise<CustomerActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  if (!input.customerName.trim()) {
    return { ok: false, error: "Customer Name is required." };
  }

  try {
    await saveCustomer(input, admin.email);
    await appendLog(
      "activity",
      {
        type: "activity",
        at: new Date().toISOString(),
        user: admin.email,
        action: "edited",
        target: `customer:${input.id ?? input.customerName}`,
        detail: `Saved customer "${input.customerName}"`,
      },
      admin.email
    ).catch((err) => console.error("Failed to log customer edit", err));
  } catch (err) {
    console.error("Failed to save customer", err);
    return { ok: false, error: "Failed to save. Please try again." };
  }

  revalidatePath("/customers");
  revalidatePath("/quotes");
  return { ok: true };
}

export async function deleteCustomerAction(id: string): Promise<CustomerActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };

  try {
    await deleteCustomer(id, admin.email);
  } catch (err) {
    console.error("Failed to delete customer", err);
    return { ok: false, error: "Failed to delete. Please try again." };
  }

  revalidatePath("/customers");
  return { ok: true };
}
