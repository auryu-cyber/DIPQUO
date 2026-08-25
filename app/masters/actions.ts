"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { addMasterRecord } from "@/lib/masters";
import { appendLog } from "@/lib/logs";
import type { MasterType, MasterRecordBase } from "@/lib/masters";

export interface AddMasterRecordResult {
  ok: boolean;
  error?: string;
}

export async function addMasterRecordAction(
  type: MasterType,
  code: string,
  data: MasterRecordBase & Record<string, unknown>
): Promise<AddMasterRecordResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin || !session.user.email) {
    return { ok: false, error: "Admin access required." };
  }
  if (!code.trim()) {
    return { ok: false, error: "Code is required." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveFrom)) {
    return { ok: false, error: "Effective From must be a YYYY-MM-DD date." };
  }

  try {
    await addMasterRecord(
      type,
      code,
      { ...data, recordedAt: new Date().toISOString(), recordedBy: session.user.email },
      session.user.email
    );

    await appendLog(
      "activity",
      {
        type: "activity",
        at: new Date().toISOString(),
        user: session.user.email,
        action: "edited",
        target: `master:${type}/${code}`,
        detail: `Added revision effective ${data.effectiveFrom}`,
      },
      session.user.email
    ).catch((err) => console.error("Failed to log master edit", err));
  } catch (err) {
    console.error("Failed to add master record", err);
    return { ok: false, error: "Failed to save. Please try again." };
  }

  revalidatePath("/masters");
  return { ok: true };
}
