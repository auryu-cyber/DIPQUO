import { listMasterCodes, listMasterHistory } from "@/lib/masters";
import type {
  MaterialRecord,
  PackingCostRecord,
  LaborRateRecord,
  TransportationRecord,
  ExchangeRateRecord,
} from "@/lib/masters";

export interface QuoteFormMasters {
  materials: { code: string; history: MaterialRecord[] }[];
  packingItems: { code: string; history: PackingCostRecord[] }[];
  laborRateHistory: LaborRateRecord[];
  transportationHistory: TransportationRecord[];
  exchangeRateHistory: ExchangeRateRecord[];
}

/** Resolves the record in effect on `asOf` from a history array (newest first). */
export function resolveAsOf<T extends { effectiveFrom: string }>(history: T[], asOf: string): T | undefined {
  return history.find((r) => r.effectiveFrom <= asOf);
}

/** Everything the quote form needs — full dated history per master, so any past or future
 *  pricing date can be selected and the matching rate resolved client-side. */
export async function loadQuoteFormMasters(): Promise<QuoteFormMasters> {
  const [materialCodes, packingCodes] = await Promise.all([
    listMasterCodes("materials"),
    listMasterCodes("packing-costs"),
  ]);

  const [materials, packingItems, laborRateHistory, transportationHistory, exchangeRateHistory] = await Promise.all([
    Promise.all(
      materialCodes.map(async (code) => ({
        code,
        history: (await listMasterHistory<MaterialRecord>("materials", code)).map((r) => r.data),
      }))
    ),
    Promise.all(
      packingCodes.map(async (code) => ({
        code,
        history: (await listMasterHistory<PackingCostRecord>("packing-costs", code)).map((r) => r.data),
      }))
    ),
    listMasterHistory<LaborRateRecord>("labor-rates", "default").then((rs) => rs.map((r) => r.data)),
    listMasterHistory<TransportationRecord>("transportation", "default").then((rs) => rs.map((r) => r.data)),
    listMasterHistory<ExchangeRateRecord>("exchange-rates", "default").then((rs) => rs.map((r) => r.data)),
  ]);

  return { materials, packingItems, laborRateHistory, transportationHistory, exchangeRateHistory };
}
