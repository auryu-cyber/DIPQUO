import { listMasterCodes, resolveCurrentMaster } from "@/lib/masters";
import type { MaterialRecord, PackingCostRecord, LaborRateRecord, TransportationRecord } from "@/lib/masters";

export interface QuoteFormMasters {
  materials: { code: string; current: MaterialRecord | null }[];
  packingItems: { code: string; current: PackingCostRecord | null }[];
  laborRate: LaborRateRecord | null;
  transportation: TransportationRecord | null;
}

/** Everything the quote form needs to populate its master-data dropdowns, in one round trip. */
export async function loadQuoteFormMasters(): Promise<QuoteFormMasters> {
  const [materialCodes, packingCodes, laborRate, transportation] = await Promise.all([
    listMasterCodes("materials"),
    listMasterCodes("packing-costs"),
    resolveCurrentMaster<LaborRateRecord>("labor-rates", "default"),
    resolveCurrentMaster<TransportationRecord>("transportation", "default"),
  ]);

  const materials = await Promise.all(
    materialCodes.map(async (code) => ({
      code,
      current: await resolveCurrentMaster<MaterialRecord>("materials", code),
    }))
  );

  const packingItems = await Promise.all(
    packingCodes.map(async (code) => ({
      code,
      current: await resolveCurrentMaster<PackingCostRecord>("packing-costs", code),
    }))
  );

  return { materials, packingItems, laborRate, transportation };
}
