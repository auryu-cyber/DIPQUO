"use client";

import { useState, useTransition } from "react";
import { addMasterRecordAction } from "@/app/masters/actions";
import type { MasterType } from "@/lib/masters";

export interface FieldSpec {
  key: string;
  label: string;
  step?: number;
}

export interface HistoryEntry {
  effectiveFrom: string;
  values: Record<string, number>;
  displayName?: string;
  note?: string;
  recordedBy: string;
}

export function MasterItem({
  type,
  code,
  displayLabel,
  fields,
  history,
  hasDisplayName = false,
}: {
  type: MasterType;
  code: string;
  displayLabel: string;
  fields: FieldSpec[];
  history: HistoryEntry[];
  hasDisplayName?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const current = history[0];

  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {
      effectiveFrom: new Date().toISOString().slice(0, 10),
      note: "",
    };
    if (hasDisplayName) init.displayName = current?.displayName ?? "";
    for (const f of fields) init[f.key] = current ? String(current.values[f.key] ?? "") : "";
    return init;
  });

  function submit() {
    setError(null);
    const values: Record<string, unknown> = { effectiveFrom: form.effectiveFrom, conditions: {} };
    if (form.note) values.note = form.note;
    if (hasDisplayName) values.displayName = form.displayName;
    for (const f of fields) values[f.key] = Number(form[f.key]);

    startTransition(async () => {
      const res = await addMasterRecordAction(type, code, values as never);
      if (!res.ok) {
        setError(res.error ?? "Failed to save.");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-knt-navy">{displayLabel}</div>
          <div className="text-[11px] text-gray-400">
            {current ? `Effective ${current.effectiveFrom} · by ${current.recordedBy}` : "No records yet"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {current && (
            <div className="flex gap-4 text-xs text-gray-600">
              {fields.map((f) => (
                <div key={f.key} className="text-right">
                  <div className="text-[10px] text-gray-400">{f.label}</div>
                  <div className="font-medium">{current.values[f.key]}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-knt-blue font-medium">
            {open ? "Cancel" : "Add revision"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2.5 items-end">
          {hasDisplayName && (
            <div className="col-span-2">
              <div className="text-[11px] text-gray-500 mb-1">Display Name</div>
              <input
                value={form.displayName ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="input"
              />
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key}>
              <div className="text-[11px] text-gray-500 mb-1">{f.label}</div>
              <input
                type="number"
                step={f.step ?? 0.01}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                className="input"
              />
            </div>
          ))}
          <div>
            <div className="text-[11px] text-gray-500 mb-1">Effective From</div>
            <input
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm((s) => ({ ...s, effectiveFrom: e.target.value }))}
              className="input"
            />
          </div>
          <div className="col-span-4">
            <div className="text-[11px] text-gray-500 mb-1">Note</div>
            <input value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} className="input" />
          </div>
          <div className="col-span-4 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={isPending}
              className="bg-knt-navy text-white rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save revision"}
            </button>
            {error && <span className="text-xs text-knt-red">{error}</span>}
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          border: 1.5px solid var(--color-knt-pale-blue);
          border-radius: 8px;
          padding: 7px 9px;
          font-size: 12.5px;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
