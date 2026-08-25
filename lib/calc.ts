import type {
  MaterialSnapshot,
  LaborSnapshot,
  LaborProcess,
  PackingSnapshot,
  TransportationSnapshot,
  ToolingSnapshot,
  CalculatedSummary,
} from "@/lib/types";

/** Mirrors the original Excel DIP cost sheet, one function per cost section. */

export function materialCostPerPc(material: MaterialSnapshot): number {
  const totalLoss =
    material.lossRate.setting +
    material.lossRate.moulding +
    material.lossRate.cutting +
    material.lossRate.inspection;
  return (material.pricePerKg / 1000) * material.weightG * (1 + totalLoss);
}

function processCostPerPc(hourlyChargeTHB: number, process: LaborProcess): number {
  let qtyPerHourAfterLoss: number;

  if ("cycleTimeMin" in process) {
    const qtyPerHour = (process.qtyPerShot * 60) / process.cycleTimeMin;
    qtyPerHourAfterLoss = qtyPerHour * process.machines * (1 - process.lossRate);
  } else if ("qtyPerHour" in process) {
    qtyPerHourAfterLoss = process.qtyPerHour * (1 - process.lossRate);
  } else {
    const qtyPerHour = 3600 / process.secPerPc;
    qtyPerHourAfterLoss = qtyPerHour * (1 - process.lossRate);
  }

  if (qtyPerHourAfterLoss <= 0) return 0;
  return hourlyChargeTHB / qtyPerHourAfterLoss;
}

export function laborCostPerPc(labor: LaborSnapshot): number {
  return labor.processes.reduce((sum, p) => sum + processCostPerPc(labor.hourlyChargeTHB, p), 0);
}

export function packingCostPerPc(packing: PackingSnapshot): number {
  return packing.items.reduce((sum, item) => {
    if (item.qtyPerUnit <= 0) return sum;
    return sum + item.priceTHB / item.qtyPerUnit;
  }, 0);
}

export function transportationCostPerPc(transportation: TransportationSnapshot): number {
  if (transportation.qtyPerTrip <= 0) return 0;
  return (transportation.vehicleTHB + transportation.fuelTHB) / transportation.qtyPerTrip;
}

export function toolingTotals(tooling: ToolingSnapshot): { totalTHB: number; customerPriceTHB: number } {
  const totalTHB = tooling.items.reduce((sum, item) => {
    if (typeof item.totalTHB === "number") return sum + item.totalTHB;
    if (typeof item.qty === "number" && typeof item.unitPriceTHB === "number") {
      return sum + item.qty * item.unitPriceTHB;
    }
    return sum;
  }, 0);
  return { totalTHB, customerPriceTHB: totalTHB * tooling.customerMarkup };
}

export interface CalcInputs {
  material: MaterialSnapshot;
  labor: LaborSnapshot;
  packing: PackingSnapshot;
  transportation: TransportationSnapshot;
  overheadRate: number;
  profitRate: number;
  /** Final price to quote the customer. Defaults to totalPrice (COGS + OH + profit) when omitted. */
  finalPriceToCustomer?: number;
}

/** Rolls every cost section up into the summary shown on the quote form / spreadsheet view. */
export function calculateSummary(inputs: CalcInputs): CalculatedSummary {
  const material = materialCostPerPc(inputs.material);
  const labor = laborCostPerPc(inputs.labor);
  const packing = packingCostPerPc(inputs.packing);
  const transportation = transportationCostPerPc(inputs.transportation);

  const cogs = material + labor + packing + transportation;
  const overhead = cogs * inputs.overheadRate;
  const profit = cogs * inputs.profitRate;
  const totalPrice = cogs + overhead + profit;

  const finalPriceToCustomer = inputs.finalPriceToCustomer ?? totalPrice;

  return {
    materialCostPerPc: round(material),
    laborCostPerPc: round(labor),
    packingCostPerPc: round(packing),
    transportationCostPerPc: round(transportation),
    cogs: round(cogs),
    overhead: round(overhead),
    profit: round(profit),
    totalPrice: round(totalPrice),
    materialPct: totalPrice > 0 ? round(material / totalPrice, 4) : 0,
    grossMarginPct: totalPrice > 0 ? round((totalPrice - cogs) / totalPrice, 4) : 0,
    finalPriceToCustomer: round(finalPriceToCustomer),
  };
}

function round(n: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
