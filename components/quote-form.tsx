"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { calculateSummary, laborCostByProcess, packingItemCostPerPc } from "@/lib/calc";
import { saveQuoteAction } from "@/app/quotes/actions";
import { resolveAsOf } from "@/lib/masters-lookup";
import { formatNumber, formatPercent } from "@/lib/format";
import type {
  Quote,
  QuoteStatus,
  DippingProcess,
  HourlyProcess,
  PerPieceTimeProcess,
  ToolingItem,
  MaterialSnapshot,
  LaborSnapshot,
  ExchangeRateSnapshot,
  PackingSnapshot,
  TransportationSnapshot,
} from "@/lib/types";
import type { QuoteFormMasters } from "@/lib/masters-lookup";

const STATUS_OPTIONS: QuoteStatus[] = ["draft", "pending_approval", "confirmed", "comparison"];
const PACKING_CODES = ["plastic-bag", "carton-box", "paper-pallet"];
const DEFAULT_LOSS_RATE = { setting: 0.02, moulding: 0.02, cutting: 0.02, inspection: 0.02 };

type FormState = Omit<Quote, "calculated" | "updatedAt" | "updatedBy">;

/** Minimal undo/redo history: every setState call pushes the previous value,
 *  and Ctrl+Z / Ctrl+Y (wired below) walk the stacks. */
function useUndoableState<T>(initial: T | (() => T)) {
  const [state, setStateRaw] = useState<T>(initial);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    setStateRaw((prev) => {
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      undoStack.current.push(prev);
      redoStack.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setStateRaw((current) => {
      const prev = undoStack.current.pop();
      if (prev === undefined) return current;
      redoStack.current.push(current);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setStateRaw((current) => {
      const next = redoStack.current.pop();
      if (next === undefined) return current;
      undoStack.current.push(current);
      return next;
    });
  }, []);

  return [state, setState, undo, redo] as const;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveMaterialAsOf(masters: QuoteFormMasters, code: string, asOf: string) {
  return resolveAsOf(masters.materials.find((m) => m.code === code)?.history ?? [], asOf);
}

function resolvePackingAsOf(masters: QuoteFormMasters, code: string, asOf: string) {
  return resolveAsOf(masters.packingItems.find((p) => p.code === code)?.history ?? [], asOf);
}

function resolveLaborSnapshot(
  masters: QuoteFormMasters,
  asOf: string
): { ref: { record: string; effectiveFrom: string }; hourlyChargeTHB: number } {
  const rec = resolveAsOf(masters.laborRateHistory, asOf);
  return {
    ref: { record: rec ? `labor-rates/default/${rec.effectiveFrom}` : "", effectiveFrom: rec?.effectiveFrom ?? asOf },
    hourlyChargeTHB: rec?.hourlyChargeTHB ?? 0,
  };
}

function resolveTransportationSnapshot(
  masters: QuoteFormMasters,
  asOf: string
): { ref: { record: string; effectiveFrom: string }; values: TransportationSnapshot } {
  const rec = resolveAsOf(masters.transportationHistory, asOf);
  return {
    ref: { record: rec ? `transportation/default/${rec.effectiveFrom}` : "", effectiveFrom: rec?.effectiveFrom ?? asOf },
    values: { vehicleTHB: rec?.vehicleTHB ?? 0, fuelTHB: rec?.fuelTHB ?? 0, qtyPerTrip: rec?.qtyPerTrip ?? 1 },
  };
}

function resolvePackingSnapshot(
  masters: QuoteFormMasters,
  asOf: string
): { ref: { records: string[]; effectiveFrom: string }; snapshot: PackingSnapshot } {
  const resolved = PACKING_CODES.map((code) => resolvePackingAsOf(masters, code, asOf));
  return {
    ref: {
      records: PACKING_CODES.map((code, i) => {
        const rec = resolved[i];
        return rec ? `packing-costs/${code}/${rec.effectiveFrom}` : "";
      }),
      effectiveFrom: asOf,
    },
    snapshot: {
      items: PACKING_CODES.map((code, i) => {
        const rec = resolved[i];
        return { name: rec?.displayName ?? code, priceTHB: rec?.priceTHB ?? 0, qtyPerUnit: rec?.qtyPerUnit ?? 1 };
      }),
    },
  };
}

function resolveExchangeSnapshot(
  masters: QuoteFormMasters,
  asOf: string
): { ref: { record: string; effectiveFrom: string }; snap: ExchangeRateSnapshot } {
  const rec = resolveAsOf(masters.exchangeRateHistory, asOf);
  return {
    ref: { record: rec ? `exchange-rates/default/${rec.effectiveFrom}` : "", effectiveFrom: rec?.effectiveFrom ?? asOf },
    snap: { jpyPerThb: rec?.jpyPerThb ?? 0, usdPerThb: rec?.usdPerThb ?? 0 },
  };
}

/** Labor loss rates for these three processes are not entered directly — they're derived
 *  live from the Material Cost loss-rate breakdown. Packing keeps its own editable rate. */
function deriveProcessLossRate(processName: string, material: MaterialSnapshot): number | null {
  const n = processName.toLowerCase();
  if (n.includes("dipping")) return 1 - (1 - material.lossRate.setting) * (1 - material.lossRate.moulding);
  if (n.includes("cutting")) return material.lossRate.cutting;
  if (n.includes("inspection")) return material.lossRate.inspection;
  return null;
}

function withDerivedLossRates(labor: LaborSnapshot, material: MaterialSnapshot): LaborSnapshot {
  return {
    ...labor,
    processes: labor.processes.map((p) => {
      const derived = deriveProcessLossRate(p.name, material);
      return derived === null ? p : { ...p, lossRate: derived };
    }),
  };
}

function toFormState(quote: Quote): FormState {
  // Quote is a structural superset of FormState (adds calculated/updatedAt/updatedBy);
  // assigning through a variable (not an object literal) skips the excess-property check.
  return quote;
}

function emptyForm(masters: QuoteFormMasters): FormState {
  const asOf = todayStr();
  const firstMaterial = masters.materials[0];
  const materialRec = firstMaterial ? resolveMaterialAsOf(masters, firstMaterial.code, asOf) : undefined;
  const laborR = resolveLaborSnapshot(masters, asOf);
  const transportR = resolveTransportationSnapshot(masters, asOf);
  const packingR = resolvePackingSnapshot(masters, asOf);
  const fx = resolveExchangeSnapshot(masters, asOf);

  return {
    id: "",
    variant: "current",
    productName: "",
    status: "draft",
    monthlyQty: 0,
    pricingDate: asOf,
    materialRef: { materialCode: firstMaterial?.code ?? "", effectiveFrom: materialRec?.effectiveFrom ?? asOf },
    material: {
      name: materialRec?.displayName ?? "",
      pricePerKg: materialRec?.pricePerKg ?? 0,
      weightG: 0,
      lossRate: { ...DEFAULT_LOSS_RATE },
    },
    laborRef: laborR.ref,
    labor: {
      hourlyChargeTHB: laborR.hourlyChargeTHB,
      processes: [
        { name: "Dipping", qtyPerShot: 0, cycleTimeMin: 1, machines: 1, lossRate: 0.04 } satisfies DippingProcess,
        { name: "Cutting (Manual)", qtyPerHour: 0, lossRate: 0.02 } satisfies HourlyProcess,
        { name: "Inspection", secPerPc: 0, lossRate: 0.02 } satisfies PerPieceTimeProcess,
        { name: "Packing", secPerPc: 0, lossRate: 0.01 } satisfies PerPieceTimeProcess,
      ],
    },
    packingRef: packingR.ref,
    packing: packingR.snapshot,
    transportationRef: transportR.ref,
    transportation: transportR.values,
    exchangeRateRef: fx.ref,
    exchangeRate: fx.snap,
    tooling: { items: [], customerMarkup: 1.25 },
    overheadRate: 0.1,
    profitRate: 0.5,
  };
}

/** Backfills the per-category effectiveFrom dates for a quote saved before they existed. */
function withDateFallbacks(base: FormState, masters: QuoteFormMasters): FormState {
  const fallback = base.pricingDate ?? todayStr();
  const materialRef = base.materialRef.effectiveFrom ? base.materialRef : { ...base.materialRef, effectiveFrom: fallback };
  const laborRef = base.laborRef.effectiveFrom ? base.laborRef : { ...base.laborRef, effectiveFrom: fallback };
  const transportationRef = base.transportationRef.effectiveFrom
    ? base.transportationRef
    : { ...base.transportationRef, effectiveFrom: fallback };
  const packingRef = base.packingRef.effectiveFrom ? base.packingRef : { ...base.packingRef, effectiveFrom: fallback };
  const exchangeRateRef = base.exchangeRateRef?.effectiveFrom
    ? base.exchangeRateRef
    : { ...(base.exchangeRateRef ?? { record: "" }), effectiveFrom: fallback };
  const exchangeRate = base.exchangeRate ?? resolveExchangeSnapshot(masters, exchangeRateRef.effectiveFrom).snap;

  return {
    ...base,
    pricingDate: fallback,
    materialRef,
    laborRef,
    transportationRef,
    packingRef,
    exchangeRateRef,
    exchangeRate,
  };
}

export function QuoteForm({
  masters,
  initialQuote,
  previousSha,
}: {
  masters: QuoteFormMasters;
  initialQuote?: Quote;
  previousSha?: string;
}) {
  const [state, setState, undoState, redoState] = useUndoableState<{
    form: FormState;
    finalPriceOverride: number | null;
  }>(() => ({
    form: initialQuote ? withDateFallbacks(toFormState(initialQuote), masters) : emptyForm(masters),
    finalPriceOverride: initialQuote?.calculated.finalPriceToCustomer ?? null,
  }));
  const { form, finalPriceOverride } = state;

  function setForm(updater: FormState | ((f: FormState) => FormState)) {
    setState((s) => ({
      ...s,
      form: typeof updater === "function" ? (updater as (f: FormState) => FormState)(s.form) : updater,
    }));
  }
  function setFinalPriceOverride(value: number | null) {
    setState((s) => ({ ...s, finalPriceOverride: value }));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoState();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redoState();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoState, redoState]);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveLabor = useMemo(() => withDerivedLossRates(form.labor, form.material), [form.labor, form.material]);
  const laborBreakdown = useMemo(() => laborCostByProcess(effectiveLabor), [effectiveLabor]);

  const summary = useMemo(
    () =>
      calculateSummary({
        material: form.material,
        labor: effectiveLabor,
        packing: form.packing,
        transportation: form.transportation,
        overheadRate: form.overheadRate,
        profitRate: form.profitRate,
        finalPriceToCustomer: finalPriceOverride ?? undefined,
      }),
    [form, effectiveLabor, finalPriceOverride]
  );

  function selectMaterial(code: string) {
    setForm((f) => {
      const asOf = f.materialRef.effectiveFrom || todayStr();
      const rec = resolveMaterialAsOf(masters, code, asOf);
      return {
        ...f,
        materialRef: { materialCode: code, effectiveFrom: rec?.effectiveFrom ?? asOf },
        material: rec
          ? { ...f.material, name: rec.displayName, pricePerKg: rec.pricePerKg, overridden: false }
          : f.material,
      };
    });
  }

  function changeMaterialDate(newDate: string) {
    setForm((f) => {
      const rec = resolveMaterialAsOf(masters, f.materialRef.materialCode, newDate);
      return {
        ...f,
        materialRef: { materialCode: f.materialRef.materialCode, effectiveFrom: rec?.effectiveFrom ?? newDate },
        material: rec
          ? { ...f.material, name: rec.displayName, pricePerKg: rec.pricePerKg, overridden: false }
          : f.material,
      };
    });
  }

  function changeLaborDate(newDate: string) {
    setForm((f) => {
      const r = resolveLaborSnapshot(masters, newDate);
      return { ...f, laborRef: r.ref, labor: { ...f.labor, hourlyChargeTHB: r.hourlyChargeTHB } };
    });
  }

  function changeTransportationDate(newDate: string) {
    setForm((f) => {
      const r = resolveTransportationSnapshot(masters, newDate);
      return { ...f, transportationRef: r.ref, transportation: r.values };
    });
  }

  function changePackingDate(newDate: string) {
    setForm((f) => {
      const r = resolvePackingSnapshot(masters, newDate);
      return { ...f, packingRef: r.ref, packing: r.snapshot };
    });
  }

  function changeExchangeRateDate(newDate: string) {
    setForm((f) => {
      const fx = resolveExchangeSnapshot(masters, newDate);
      return { ...f, exchangeRateRef: fx.ref, exchangeRate: fx.snap };
    });
  }

  function updateProcess(index: number, patch: Record<string, number>) {
    setForm((f) => ({
      ...f,
      labor: {
        ...f.labor,
        processes: f.labor.processes.map((p, i) => (i === index ? { ...p, ...patch } : p)),
      },
    }));
  }

  function updatePackingItem(index: number, patch: Record<string, number>) {
    setForm((f) => ({
      ...f,
      packing: { items: f.packing.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) },
    }));
  }

  function addToolingItem() {
    const item: ToolingItem = { name: "New item", qty: 1, unitPriceTHB: 0 };
    setForm((f) => ({ ...f, tooling: { ...f.tooling, items: [...f.tooling.items, item] } }));
  }

  function updateToolingItem(index: number, patch: Partial<ToolingItem>) {
    setForm((f) => ({
      ...f,
      tooling: { ...f.tooling, items: f.tooling.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) },
    }));
  }

  function removeToolingItem(index: number) {
    setForm((f) => ({ ...f, tooling: { ...f.tooling, items: f.tooling.items.filter((_, i) => i !== index) } }));
  }

  function save() {
    setError(null);
    if (!form.id.trim() || !form.productName.trim()) {
      setError("Product ID and Product Name are required.");
      return;
    }
    const payload = { ...form, labor: effectiveLabor };
    const renameFrom = initialQuote ? { id: initialQuote.id, variant: initialQuote.variant } : undefined;
    startTransition(async () => {
      const result = await saveQuoteAction(payload, previousSha, renameFrom);
      if (result && !result.ok) {
        setError(result.error ?? "Failed to save.");
      }
    });
  }

  const toolingTotal = form.tooling.items.reduce(
    (sum, it) => sum + (it.totalTHB ?? (it.qty ?? 0) * (it.unitPriceTHB ?? 0)),
    0
  );
  const finalPrice = finalPriceOverride ?? summary.finalPriceToCustomer;
  const monthlySales = finalPrice * form.monthlyQty;
  const monthlyGrossMargin = (finalPrice - summary.cogs) * form.monthlyQty;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex items-center justify-between px-8 pt-6 pb-3">
        <div>
          <div className="text-[11px] text-gray-400">Quotes &nbsp;›&nbsp; {initialQuote ? "Edit" : "New"} {form.id || "quote"}</div>
          <div className="font-heading text-xl font-bold text-knt-navy">
            {initialQuote ? `Edit Quote — ${initialQuote.id}` : "New Quote"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {error && <div className="text-xs text-knt-red">{error}</div>}
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-2 bg-knt-navy text-white rounded-[9px] px-5 py-2.5 text-[13px] font-medium disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save (commit to GitHub)"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 px-8 pb-8 overflow-auto">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <Section title="Product Info">
            <div className="grid grid-cols-3 gap-3.5">
              <Field label="Product ID">
                <input
                  value={form.id}
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                  className="input"
                  placeholder="F4P0010"
                />
              </Field>
              <Field label="Variant">
                <input
                  value={form.variant}
                  onChange={(e) => setForm((f) => ({ ...f, variant: e.target.value }))}
                  className="input"
                  placeholder="current"
                />
              </Field>
              <Field label="Product Name">
                <input
                  value={form.productName}
                  onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                  className="input"
                  placeholder="Product display name"
                />
              </Field>
              <Field label="Monthly Qty">
                <input
                  type="number"
                  value={form.monthlyQty}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyQty: Number(e.target.value) }))}
                  className="input"
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as QuoteStatus }))}
                  className="input"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section
            title="Material Cost"
            right={<InlineDateField value={form.materialRef.effectiveFrom} onChange={changeMaterialDate} />}
          >
            <div className="grid grid-cols-3 gap-3.5 mb-4">
              <Field label="Material (from master)">
                <select
                  value={form.materialRef.materialCode}
                  onChange={(e) => selectMaterial(e.target.value)}
                  className="input"
                >
                  <option value="">Select…</option>
                  {masters.materials.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.history[0]?.displayName ?? m.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Material Price (THB/kg)">
                <input
                  type="number"
                  value={form.material.pricePerKg}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      material: { ...f.material, pricePerKg: Number(e.target.value), overridden: true },
                    }))
                  }
                  className="input"
                />
              </Field>
              <Field label="Weight (g/pc)">
                <input
                  type="number"
                  value={form.material.weightG}
                  onChange={(e) => setForm((f) => ({ ...f, material: { ...f.material, weightG: Number(e.target.value) } }))}
                  className="input"
                />
              </Field>
            </div>
            <div className="text-[11px] text-gray-500 mb-2">Loss Rate Breakdown</div>
            <div className="grid grid-cols-4 gap-2.5">
              {(["setting", "moulding", "cutting", "inspection"] as const).map((k) => (
                <PercentField
                  key={k}
                  label={k[0].toUpperCase() + k.slice(1)}
                  value={form.material.lossRate[k]}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      material: { ...f.material, lossRate: { ...f.material.lossRate, [k]: v } },
                    }))
                  }
                />
              ))}
            </div>
            <div className="mt-3 text-sm font-medium text-knt-navy">
              Material Cost/pc: {formatNumber(summary.materialCostPerPc)} THB
            </div>
          </Section>

          <Section
            title="Labor Cost (by Process)"
            right={<InlineDateField value={form.laborRef.effectiveFrom} onChange={changeLaborDate} />}
          >
            <div className="grid grid-cols-2 gap-3">
              {form.labor.processes.map((p, i) => {
                const derived = deriveProcessLossRate(p.name, form.material);
                return (
                  <div key={p.name} className="proc-card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12.5px] font-medium text-knt-navy">{p.name}</div>
                      <div className="text-[11px] font-bold text-knt-blue">
                        {formatNumber(laborBreakdown[i]?.costPerPc ?? 0)} THB/pc
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {"cycleTimeMin" in p && (
                        <>
                          <NumField label="Qty/Shot" value={p.qtyPerShot} onChange={(v) => updateProcess(i, { qtyPerShot: v })} />
                          <NumField label="Cycle Time (min)" value={p.cycleTimeMin} onChange={(v) => updateProcess(i, { cycleTimeMin: v })} />
                          <NumField label="Machines" value={p.machines} onChange={(v) => updateProcess(i, { machines: v })} />
                        </>
                      )}
                      {"qtyPerHour" in p && (
                        <NumField label="Qty/Hour" value={p.qtyPerHour} onChange={(v) => updateProcess(i, { qtyPerHour: v })} />
                      )}
                      {"secPerPc" in p && (
                        <NumField label="Time/pc (sec)" value={p.secPerPc} onChange={(v) => updateProcess(i, { secPerPc: v })} />
                      )}
                      {derived === null ? (
                        <PercentField label="Loss Rate" value={p.lossRate} onChange={(v) => updateProcess(i, { lossRate: v })} />
                      ) : (
                        <Field label="Loss Rate (from Material)">
                          <div className="input bg-gray-50 text-gray-500">{formatPercent(derived)}</div>
                        </Field>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumField
                label="Hourly Charge (THB/hour)"
                value={form.labor.hourlyChargeTHB}
                onChange={(v) => setForm((f) => ({ ...f, labor: { ...f.labor, hourlyChargeTHB: v } }))}
              />
              <div className="flex items-end justify-end text-sm font-bold text-knt-navy pb-1.5">
                Total Labor Cost: {formatNumber(summary.laborCostPerPc)} THB/pc
              </div>
            </div>
          </Section>

          <div className="flex gap-4">
            <Section
              title="Packing Cost"
              className="flex-1"
              right={<InlineDateField value={form.packingRef.effectiveFrom} onChange={changePackingDate} />}
            >
              {form.packing.items.map((item, i) => (
                <div key={item.name} className="grid grid-cols-4 gap-2 mb-2 items-end">
                  <div className="text-xs text-gray-600 col-span-1">{item.name}</div>
                  <NumField label="Price (THB)" value={item.priceTHB} onChange={(v) => updatePackingItem(i, { priceTHB: v })} />
                  <NumField label="Qty/unit" value={item.qtyPerUnit} onChange={(v) => updatePackingItem(i, { qtyPerUnit: v })} />
                  <div className="text-[11px] text-gray-500 text-right pb-2">
                    {formatNumber(packingItemCostPerPc(item))} THB/pc
                  </div>
                </div>
              ))}
              <div className="text-sm font-bold text-knt-navy mt-2">
                Total Packing Cost: {formatNumber(summary.packingCostPerPc)} THB/pc
              </div>
            </Section>

            <Section
              title="Transportation Cost"
              className="flex-1"
              right={<InlineDateField value={form.transportationRef.effectiveFrom} onChange={changeTransportationDate} />}
            >
              <div className="grid grid-cols-3 gap-2">
                <NumField
                  label="Vehicle (THB)"
                  value={form.transportation.vehicleTHB}
                  onChange={(v) => setForm((f) => ({ ...f, transportation: { ...f.transportation, vehicleTHB: v } }))}
                />
                <NumField
                  label="Fuel (THB)"
                  value={form.transportation.fuelTHB}
                  onChange={(v) => setForm((f) => ({ ...f, transportation: { ...f.transportation, fuelTHB: v } }))}
                />
                <NumField
                  label="Qty/trip"
                  value={form.transportation.qtyPerTrip}
                  onChange={(v) => setForm((f) => ({ ...f, transportation: { ...f.transportation, qtyPerTrip: v } }))}
                />
              </div>
              <div className="text-sm font-bold text-knt-navy mt-2">
                Total Transportation Cost: {formatNumber(summary.transportationCostPerPc)} THB/pc
              </div>
            </Section>
          </div>

          <Section title="Tooling Cost (Initial Investment)">
            {form.tooling.items.map((item, i) => {
              const subtotal = item.totalTHB ?? (item.qty ?? 0) * (item.unitPriceTHB ?? 0);
              return (
                <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-end">
                  <input
                    value={item.name}
                    onChange={(e) => updateToolingItem(i, { name: e.target.value })}
                    className="input col-span-1"
                  />
                  <NumField label="Qty" value={item.qty ?? 0} onChange={(v) => updateToolingItem(i, { qty: v, totalTHB: undefined })} />
                  <NumField
                    label="Unit Price (THB)"
                    value={item.unitPriceTHB ?? 0}
                    onChange={(v) => updateToolingItem(i, { unitPriceTHB: v, totalTHB: undefined })}
                  />
                  <Field label="Subtotal">
                    <div className="input bg-gray-50 text-gray-500 text-right">{formatNumber(subtotal)} THB</div>
                  </Field>
                  <button onClick={() => removeToolingItem(i)} className="text-xs text-knt-red text-left">
                    Remove
                  </button>
                </div>
              );
            })}
            <button onClick={addToolingItem} className="text-xs text-knt-blue mt-1">
              + Add item
            </button>
            <div className="flex justify-end items-end gap-8 mt-3">
              <NumField
                label="Customer Markup (×)"
                value={form.tooling.customerMarkup}
                step={0.01}
                onChange={(v) => setForm((f) => ({ ...f, tooling: { ...f.tooling, customerMarkup: v } }))}
              />
              <div className="text-right">
                <div className="text-[11px] text-gray-400">Total</div>
                <div className="text-sm font-bold">{formatNumber(toolingTotal)} THB</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-400">Customer Price (×{form.tooling.customerMarkup})</div>
                <div className="text-sm font-bold text-knt-navy">
                  {formatNumber(toolingTotal * form.tooling.customerMarkup)} THB
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="w-[360px] shrink-0">
          <div className="sticky top-0 bg-white rounded-[14px] border border-gray-100 p-5 flex flex-col gap-2">
            <div className="text-sm font-bold text-knt-navy mb-1">Summary</div>
            <SumRow label="Material Cost" value={summary.materialCostPerPc} />
            <SumRow label="Labor Cost" value={summary.laborCostPerPc} />
            <SumRow label="Packing Cost" value={summary.packingCostPerPc} />
            <SumRow label="Transportation Cost" value={summary.transportationCostPerPc} />
            <SumRow label="COGS" value={summary.cogs} bold />
            <SumRow label={`OH (${formatNumber(form.overheadRate * 100, 0)}%)`} value={summary.overhead} />
            <SumRow label={`Profit (${formatNumber(form.profitRate * 100, 0)}%)`} value={summary.profit} />
            <div className="bg-knt-ivory rounded-[10px] p-3.5 mt-2 flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Target Total Price (calculated)</span>
                <span className="font-bold">{formatNumber(summary.totalPrice)} THB</span>
              </div>
            </div>
            <div className="bg-knt-navy rounded-xl p-4 mt-2 text-center">
              <div className="text-[11px] text-knt-blue-gray">Final Price to Customer</div>
              <input
                type="number"
                step="0.01"
                value={finalPriceOverride ?? summary.finalPriceToCustomer}
                onChange={(e) => setFinalPriceOverride(Number(e.target.value))}
                className="w-full bg-transparent text-center text-white font-heading text-2xl font-bold outline-none mt-1"
              />
              <div className="text-[11px] text-knt-blue-gray mb-2">THB / pc</div>

              <div className="flex items-center justify-between text-[10px] text-knt-blue-gray">
                <span>Exchange Rate as of</span>
                <input
                  type="date"
                  value={form.exchangeRateRef.effectiveFrom}
                  onChange={(e) => changeExchangeRateDate(e.target.value)}
                  className="bg-white/10 border border-white/25 rounded-md px-1.5 py-0.5 text-white text-[10px]"
                />
              </div>
              <div className="text-[10px] text-knt-blue-gray text-right mb-1">
                1 THB = {formatNumber(form.exchangeRate.jpyPerThb, 4)} JPY / {formatNumber(form.exchangeRate.usdPerThb, 4)} USD
              </div>
              <div className="text-[10.5px] text-knt-blue-gray flex justify-center gap-1">
                <span>≈ {formatNumber(finalPrice * form.exchangeRate.jpyPerThb)} JPY</span>
                <span>·</span>
                <span>≈ {formatNumber(finalPrice * form.exchangeRate.usdPerThb)} USD</span>
              </div>

              <div className="text-[11px] text-white/90 font-medium mt-2 pt-2 border-t border-white/15">
                Material {formatPercent(summary.materialPct)} · Gross Margin {formatPercent(summary.grossMarginPct)}
              </div>
              <div className="mt-2 pt-2 border-t border-white/15 flex flex-col gap-0.5 text-[10.5px] text-knt-blue-gray">
                <div className="flex justify-between">
                  <span>Monthly Sales</span>
                  <span className="text-white font-medium">{formatNumber(monthlySales)} THB</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Gross Margin</span>
                  <span className="text-white font-medium">{formatNumber(monthlyGrossMargin)} THB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .input {
          border: 1.5px solid var(--color-knt-pale-blue);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          background: white;
          width: 100%;
        }
        .proc-card {
          border: 1.5px solid #eef0f3;
          border-radius: 10px;
          padding: 12px;
          background: #fbfcfe;
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  children,
  className = "",
  right,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-[14px] border border-gray-100 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-knt-navy">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

/** Compact date picker used in section headers to pick which period's master rate to use. */
function InlineDateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[10.5px] text-gray-400">
      Rate as of
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-knt-pale-blue rounded-md px-1.5 py-1 text-[11px] text-gray-700"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input"
      />
    </Field>
  );
}

/** A rate stored as a 0-1 fraction, edited on screen as a percentage (e.g. 0.02 shows as 2). */
function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          value={Math.round(value * 10000) / 100}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="input pr-6"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
      </div>
    </Field>
  );
}

function SumRow({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-xs py-1.5 border-b border-gray-100 ${bold ? "font-bold text-knt-navy" : "text-gray-700"}`}>
      <span>{label}</span>
      <span>{formatNumber(value)} THB</span>
    </div>
  );
}
