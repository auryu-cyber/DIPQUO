import { getJsonFile, listDir, listSubdirs } from "@/lib/github";

export type MasterType = "materials" | "labor-rates" | "packing-costs" | "transportation" | "exchange-rates";

export interface MasterRecordBase {
  effectiveFrom: string; // YYYY-MM-DD
  conditions: Record<string, string>;
  recordedAt: string;
  recordedBy: string;
  note?: string;
}

export interface MaterialRecord extends MasterRecordBase {
  materialCode: string;
  displayName: string;
  pricePerKg: number;
}

export interface LaborRateRecord extends MasterRecordBase {
  hourlyChargeTHB: number;
}

export interface PackingCostRecord extends MasterRecordBase {
  itemCode: string;
  displayName: string;
  priceTHB: number;
  qtyPerUnit: number;
}

export interface TransportationRecord extends MasterRecordBase {
  vehicleTHB: number;
  fuelTHB: number;
  qtyPerTrip: number;
}

/** THB-based FX rate: multiply a THB amount by these to get the JPY / USD equivalent. */
export interface ExchangeRateRecord extends MasterRecordBase {
  jpyPerThb: number;
  usdPerThb: number;
}

/** List every master "code" (e.g. material code) that exists under a master type. */
export async function listMasterCodes(type: MasterType): Promise<string[]> {
  return listSubdirs(`masters/${type}`);
}

/** All dated records for one master code, newest first (each still holds its own effectiveFrom). */
export async function listMasterHistory<T extends MasterRecordBase>(
  type: MasterType,
  code: string
): Promise<{ path: string; data: T }[]> {
  const files = await listDir(`masters/${type}/${code}`);
  const dated = files.filter((f) => f.endsWith(".json")).sort().reverse();
  const records = await Promise.all(
    dated.map(async (f) => {
      const path = `masters/${type}/${code}/${f}`;
      const res = await getJsonFile<T>(path);
      return res ? { path, data: res.data } : null;
    })
  );
  return records.filter((r): r is { path: string; data: T } => r !== null);
}

/** The record in effect on a given date (defaults to today) — the "current" value. */
export async function resolveCurrentMaster<T extends MasterRecordBase>(
  type: MasterType,
  code: string,
  asOf: string = new Date().toISOString().slice(0, 10)
): Promise<T | null> {
  const history = await listMasterHistory<T>(type, code);
  const inEffect = history.find((r) => r.data.effectiveFrom <= asOf);
  return inEffect?.data ?? null;
}

/** Add a new dated master record. Records are immutable: this always creates a new file, never overwrites. */
export async function addMasterRecord<T extends MasterRecordBase>(
  type: MasterType,
  code: string,
  data: T,
  authorEmail: string
): Promise<void> {
  const path = `masters/${type}/${code}/${data.effectiveFrom}.json`;
  const { putJsonFile } = await import("@/lib/github");
  await putJsonFile(path, data, `master(${type}/${code}): add record effective ${data.effectiveFrom}`, authorEmail);
}
