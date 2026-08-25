export type QuoteStatus = "draft" | "pending_approval" | "confirmed" | "comparison";

export interface DippingProcess {
  name: string;
  qtyPerShot: number;
  cycleTimeMin: number;
  machines: number;
  lossRate: number;
}

export interface HourlyProcess {
  name: string;
  qtyPerHour: number;
  lossRate: number;
}

export interface PerPieceTimeProcess {
  name: string;
  secPerPc: number;
  lossRate: number;
}

export type LaborProcess = DippingProcess | HourlyProcess | PerPieceTimeProcess;

export interface MaterialSnapshot {
  name: string;
  pricePerKg: number;
  weightG: number;
  lossRate: { setting: number; moulding: number; cutting: number; inspection: number };
  overridden?: boolean;
}

export interface LaborSnapshot {
  hourlyChargeTHB: number;
  processes: LaborProcess[];
}

export interface PackingItem {
  name: string;
  priceTHB: number;
  qtyPerUnit: number;
}

export interface PackingSnapshot {
  items: PackingItem[];
}

export interface TransportationSnapshot {
  vehicleTHB: number;
  fuelTHB: number;
  qtyPerTrip: number;
}

export interface ToolingItem {
  name: string;
  qty?: number;
  unitPriceTHB?: number;
  totalTHB?: number;
}

export interface ToolingSnapshot {
  items: ToolingItem[];
  customerMarkup: number;
}

export interface CalculatedSummary {
  materialCostPerPc: number;
  laborCostPerPc: number;
  packingCostPerPc: number;
  transportationCostPerPc: number;
  cogs: number;
  overhead: number;
  profit: number;
  totalPrice: number;
  materialPct: number;
  grossMarginPct: number;
  finalPriceToCustomer: number;
}

export interface Quote {
  id: string;
  variant: string;
  productName: string;
  status: QuoteStatus;
  monthlyQty: number;
  updatedAt: string;
  updatedBy: string;

  materialRef: { materialCode: string; effectiveFrom: string };
  material: MaterialSnapshot;

  laborRef: { record: string };
  labor: LaborSnapshot;

  packingRef: { records: string[] };
  packing: PackingSnapshot;

  transportationRef: { record: string };
  transportation: TransportationSnapshot;

  tooling: ToolingSnapshot;

  overheadRate: number;
  profitRate: number;

  calculated: CalculatedSummary;
}

export interface QuoteIndexEntry {
  id: string;
  variant: string;
  productName: string;
  material: string;
  monthlyQty: number;
  finalPriceToCustomer: number;
  grossMarginPct: number;
  status: QuoteStatus;
  updatedAt: string;
  updatedBy: string;
  path: string;
}

export interface QuoteIndex {
  quotes: QuoteIndexEntry[];
}
