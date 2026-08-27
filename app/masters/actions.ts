"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { addMasterRecord, updateMasterRecord, deleteMasterRecord } from "@/lib/masters";
import { appendLog } from "@/lib/logs";
import type { MasterType, MasterRecordBase } from "@/lib/masters";

export interface AddMasterRecordResult {
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

export async function addMasterRecordAction(
  type: MasterType,
  code: string,
  data: MasterRecordBase & Record<string, unknown>
): Promise<AddMasterRecordResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  if (!code.trim()) {
    return { ok: false, error: "Code is required." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveFrom)) {
    return { ok: false, error: "Effective From must be a YYYY-MM-DD date." };
  }

  try {
    await addMasterRecord(type, code, { ...data, recordedAt: new Date().toISOString(), recordedBy: admin.email }, admin.email);

    await appendLog(
      "activity",
      {
        type: "activity",
        at: new Date().toISOString(),
        user: admin.email,
        action: "edited",
        target: `master:${type}/${code}`,
        detail: `Added rate effective ${data.effectiveFrom}`,
      },
      admin.email
    ).catch((err) => console.error("Failed to log master edit", err));
  } catch (err) {
    console.error("Failed to add master record", err);
    return { ok: false, error: "Failed to save. Please try again." };
  }

  revalidatePath("/masters");
  return { ok: true };
}

export async function updateMasterRecordAction(
  type: MasterType,
  code: string,
  originalEffectiveFrom: string,
  data: MasterRecordBase & Record<string, unknown>
): Promise<AddMasterRecordResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveFrom)) {
    return { ok: false, error: "Effective From must be a YYYY-MM-DD date." };
  }

  try {
    await updateMasterRecord(
      type,
      code,
      originalEffectiveFrom,
      { ...data, recordedAt: new Date().toISOString(), recordedBy: admin.email },
      admin.email
    );

    await appendLog(
      "activity",
      {
        type: "activity",
        at: new Date().toISOString(),
        user: admin.email,
        action: "edited",
        target: `master:${type}/${code}`,
        detail: `Updated rate effective ${originalEffectiveFrom} → ${data.effectiveFrom}`,
      },
      admin.email
    ).catch((err) => console.error("Failed to log master edit", err));
  } catch (err) {
    console.error("Failed to update master record", err);
    return { ok: false, error: "Failed to save. Please try again." };
  }

  revalidatePath("/masters");
  return { ok: true };
}

export async function deleteMasterRecordAction(
  type: MasterType,
  code: string,
  effectiveFrom: string
): Promise<AddMasterRecordResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };

  try {
    await deleteMasterRecord(type, code, effectiveFrom, admin.email);

    await appendLog(
      "activity",
      {
        type: "activity",
        at: new Date().toISOString(),
        user: admin.email,
        action: "edited",
        target: `master:${type}/${code}`,
        detail: `Deleted rate effective ${effectiveFrom}`,
      },
      admin.email
    ).catch((err) => console.error("Failed to log master edit", err));
  } catch (err) {
    console.error("Failed to delete master record", err);
    return { ok: false, error: "Failed to delete. Please try again." };
  }

  revalidatePath("/masters");
  return { ok: true };
}
