"use client";

import { useMemo, useState, useTransition } from "react";
import { calculateSummary } from "@/lib/calc";
import { saveQuoteAction } from "@/app/quotes/actions";
import type {
  Quote,
  QuoteStatus,
  DippingProcess,
  HourlyProcess,
  PerPieceTimeProcess,
  ToolingItem,
} from "@/lib/types";
import type { QuoteFormMasters } from "@/lib/masters-lookup";

const STATUS_OPTIONS: QuoteStatus[] = ["draft", "pending_approval", "confirmed", "comparison"];

type FormState = Omit<Quote, "calculated" | "updatedAt" | "updatedBy">;

function emptyForm(masters: QuoteFormMasters): FormState {
  const firstMaterial = masters.materials[0];
  const packingByCode = new Map(masters.packingItems.map((p) => [p.code, p.current]));

  return {
    id: "",
    variant: "current",
    productName: "",
    status: "draft",
    monthlyQty: 0,
    materialRef: {
      materialCode: firstMaterial?.code ?? "",
      effectiveFrom: firstMaterial?.current?.effectiveFrom ?? "",
    },
    material: {
      name: firstMaterial?.current?.displayName ?? "",
      pricePerKg: firstMaterial?.current?.pricePerKg ?? 0,
      weightG: 0,
      lossRate: { setting: 0.02, moulding: 0.02, cutting: 0.02, inspection: 0.02 },
    },
    laborRef: { record: masters.laborRate ? `labor-rates/default/${masters.laborRate.effectiveFrom}` : "" },
    labor: {
      hourlyChargeTHB: masters.laborRate?.hourlyChargeTHB ?? 0,
      processes: [
        { name: "Dipping", qtyPerShot: 0, cycleTimeMin: 1, machines: 1, lossRate: 0.04 } satisfies DippingProcess,
        { name: "Cutting (Manual)", qtyPerHour: 0, lossRate: 0.02 } satisfies HourlyProcess,
        { name: "Inspection", secPerPc: 0, lossRate: 0.02 } satisfies PerPieceTimeProcess,
        { name: "Packing", secPerPc: 0, lossRate: 0.02 } satisfies PerPieceTimeProcess,
      ],
    },
    packingRef: { records: [] },
    packing: {
      items: ["plastic-bag", "carton-box", "paper-pallet"].map((code) => {
        const rec = packingByCode.get(code);
        return { name: rec?.displayName ?? code, priceTHB: rec?.priceTHB ?? 0, qtyPerUnit: rec?.qtyPerUnit ?? 1 };
      }),
    },
    transportationRef: {
      record: masters.transportation ? `transportation/default/${masters.transportation.effectiveFrom}` : "",
    },
    transportation: {
      vehicleTHB: masters.transportation?.vehicleTHB ?? 0,
      fuelTHB: masters.transportation?.fuelTHB ?? 0,
      qtyPerTrip: masters.transportation?.qtyPerTrip ?? 1,
    },
    tooling: { items: [], customerMarkup: 1.25 },
    overheadRate: 0.1,
    profitRate: 0.5,
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
  const [form, setForm] = useState<FormState>(initialQuote ?? emptyForm(masters));
  const [finalPriceOverride, setFinalPriceOverride] = useState<number | null>(
    initialQuote?.calculated.finalPriceToCustomer ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(
    () =>
      calculateSummary({
        material: form.material,
        labor: form.labor,
        packing: form.packing,
        transportation: form.transportation,
        overheadRate: form.overheadRate,
        profitRate: form.profitRate,
        finalPriceToCustomer: finalPriceOverride ?? undefined,
      }),
    [form, finalPriceOverride]
  );

  function selectMaterial(code: string) {
    const rec = masters.materials.find((m) => m.code === code)?.current;
    if (!rec) return;
    setForm((f) => ({
      ...f,
      materialRef: { materialCode: code, effectiveFrom: rec.effectiveFrom },
      material: { ...f.material, name: rec.displayName, pricePerKg: rec.pricePerKg },
    }));
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
      setError("Product Name is required.");
      return;
    }
    startTransition(async () => {
      const result = await saveQuoteAction(form, previousSha);
      if (result && !result.ok) {
        setError(result.error ?? "Failed to save.");
      }
    });
  }

  const toolingTotal = form.tooling.items.reduce(
    (sum, it) => sum + (it.totalTHB ?? (it.qty ?? 0) * (it.unitPriceTHB ?? 0)),
    0
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex items-center justify-between px-8 pt-6 pb-3">
        <div>
          <div className="text-[11px] text-gray-400">Quotes &nbsp;›&nbsp; {initialQuote ? "Edit" : "New"} {form.id || "quote"}</div>
          <div className="font-heading text-xl font-bold text-knt-navy">
            {initialQuote ? `Edit Quote — ${form.id}` : "New Quote"}
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
            <div className="grid grid-cols-4 gap-3.5">
              <Field label="Product Name / ID">
                <input
                  value={form.id}
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value, productName: e.target.value }))}
                  disabled={Boolean(initialQuote)}
                  className="input"
                  placeholder="F4P0010"
                />
              </Field>
              <Field label="Variant">
                <input
                  value={form.variant}
                  onChange={(e) => setForm((f) => ({ ...f, variant: e.target.value }))}
                  disabled={Boolean(initialQuote)}
                  className="input"
                  placeholder="current"
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

          <Section title="Material Cost">
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
                      {m.current?.displayName ?? m.code}
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
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.material.lossRate[k]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        material: { ...f.material, lossRate: { ...f.material.lossRate, [k]: Number(e.target.value) } },
                      }))
                    }
                    className="input"
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3 text-sm font-medium text-knt-navy">
              Material Cost/pc: {summary.materialCostPerPc.toFixed(3)} THB
            </div>
          </Section>

          <Section title="Labor Cost (by Process)">
            <div className="grid grid-cols-2 gap-3">
              {form.labor.processes.map((p, i) => (
                <div key={p.name} className="proc-card">
                  <div className="text-[12.5px] font-medium text-knt-navy mb-2">{p.name}</div>
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
                    <NumField label="Loss Rate" value={p.lossRate} step={0.01} onChange={(v) => updateProcess(i, { lossRate: v })} />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumField
                label="Hourly Charge (THB/hour)"
                value={form.labor.hourlyChargeTHB}
                onChange={(v) => setForm((f) => ({ ...f, labor: { ...f.labor, hourlyChargeTHB: v } }))}
              />
              <div className="flex items-end justify-end text-sm font-bold text-knt-navy pb-1.5">
                Total Labor Cost: {summary.laborCostPerPc.toFixed(3)} THB/pc
              </div>
            </div>
          </Section>

          <div className="flex gap-4">
            <Section title="Packing Cost" className="flex-1">
              {form.packing.items.map((item, i) => (
                <div key={item.name} className="grid grid-cols-3 gap-2 mb-2 items-end">
                  <div className="text-xs text-gray-600 col-span-1">{item.name}</div>
                  <NumField label="Price (THB)" value={item.priceTHB} onChange={(v) => updatePackingItem(i, { priceTHB: v })} />
                  <NumField label="Qty/unit" value={item.qtyPerUnit} onChange={(v) => updatePackingItem(i, { qtyPerUnit: v })} />
                </div>
              ))}
              <div className="text-sm font-bold text-knt-navy mt-2">
                Total Packing Cost: {summary.packingCostPerPc.toFixed(3)} THB/pc
              </div>
            </Section>

            <Section title="Transportation Cost" className="flex-1">
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
                Total Transportation Cost: {summary.transportationCostPerPc.toFixed(3)} THB/pc
              </div>
            </Section>
          </div>

          <Section title="Tooling Cost (Initial Investment)">
            {form.tooling.items.map((item, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 mb-2 items-end">
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
                <button onClick={() => removeToolingItem(i)} className="text-xs text-knt-red text-left">
                  Remove
                </button>
              </div>
            ))}
            <button onClick={addToolingItem} className="text-xs text-knt-blue mt-1">
              + Add item
            </button>
            <div className="flex justify-end gap-8 mt-3">
              <div className="text-right">
                <div className="text-[11px] text-gray-400">Total</div>
                <div className="text-sm font-bold">{toolingTotal.toLocaleString()} THB</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-400">Customer Price (×{form.tooling.customerMarkup})</div>
                <div className="text-sm font-bold text-knt-navy">
                  {(toolingTotal * form.tooling.customerMarkup).toLocaleString()} THB
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
            <SumRow label={`OH (${form.overheadRate * 100}%)`} value={summary.overhead} />
            <SumRow label={`Profit (${form.profitRate * 100}%)`} value={summary.profit} />
            <div className="bg-knt-ivory rounded-[10px] p-3.5 mt-2 flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total price</span>
                <span className="font-bold">{summary.totalPrice.toFixed(3)} THB</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Material % / Gross Margin</span>
                <span>
                  {(summary.materialPct * 100).toFixed(1)}% / {(summary.grossMarginPct * 100).toFixed(1)}%
                </span>
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
              <div className="text-[11px] text-knt-blue-gray">THB / pc</div>
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

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[14px] border border-gray-100 p-5 ${className}`}>
      <div className="text-sm font-bold text-knt-navy mb-3">{title}</div>
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
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="input" />
    </Field>
  );
}

function SumRow({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-xs py-1.5 border-b border-gray-100 ${bold ? "font-bold text-knt-navy" : "text-gray-700"}`}>
      <span>{label}</span>
      <span>{value.toFixed(3)} THB</span>
    </div>
  );
}
