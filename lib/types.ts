export type QuoteStatus = "draft" | "pending_approval" | "confirmed" | "comparison";

export type ProjectType = "new_model" | "switch_from_other" | "other";

export type OrderStatus = "in_negotiation" | "ordered" | "lost" | "on_hold";

export type Currency = "THB" | "JPY" | "USD";

export interface MassProductionStart {
  year: number;
  granularity: "month" | "quarter" | "half";
  /** Interpreted per granularity: month 1-12, quarter 1-4, half 1-2. Omitted when not yet decided. */
  period?: number;
}

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

export interface ExchangeRateSnapshot {
  jpyPerThb: number;
  usdPerThb: number;
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

  customerName: string;
  projectName: string;
  projectType: ProjectType;
  /** Required only when projectType is "other". */
  projectTypeOther?: string;
  massProductionStart: MassProductionStart;
  /** The date the customer's quote request was received. */
  inquiryDate: string;
  orderStatus: OrderStatus;
  /** The currency actually quoted/answered to the customer. */
  customerCurrency: Currency;

  /** The master-data date used to resolve every *Ref below ("as of" date). */
  pricingDate: string;

  materialRef: { materialCode: string; effectiveFrom: string };
  material: MaterialSnapshot;

  laborRef: { record: string; effectiveFrom: string };
  labor: LaborSnapshot;

  packingRef: { records: string[]; effectiveFrom: string };
  packing: PackingSnapshot;

  transportationRef: { record: string; effectiveFrom: string };
  transportation: TransportationSnapshot;

  exchangeRateRef: { record: string; effectiveFrom: string };
  exchangeRate: ExchangeRateSnapshot;

  tooling: ToolingSnapshot;

  overheadRate: number;
  profitRate: number;
  /** Manual override of the calculated total price. When unset, calculated.finalPriceToCustomer
   *  equals the calculated total (COGS + OH + profit). */
  finalPriceOverride?: number;

  calculated: CalculatedSummary;
}

export interface QuoteIndexEntry {
  id: string;
  variant: string;
  productName: string;
  customerName: string;
  inquiryDate: string;
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
