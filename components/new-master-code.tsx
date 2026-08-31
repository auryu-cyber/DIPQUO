"use client";

import { useState, useTransition } from "react";
import { addMasterRecordAction } from "@/app/masters/actions";
import type { MasterType } from "@/lib/masters";
import type { FieldSpec } from "@/components/master-item";

export function NewMasterCode({ type, fields }: { type: MasterType; fields: FieldSpec[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<Record<string, string>>({});

  function submit() {
    setError(null);
    if (!code.trim() || !displayName.trim()) {
      setError("Code and Display Name are required.");
      return;
    }
    const payload: Record<string, unknown> = { effectiveFrom, displayName, conditions: {} };
    for (const f of fields) payload[f.key] = Number(values[f.key] ?? 0);

    startTransition(async () => {
      const res = await addMasterRecordAction(type, code.trim(), payload as never);
      if (!res.ok) {
        setError(res.error ?? "Failed to save.");
        return;
      }
      setOpen(false);
      setCode("");
      setDisplayName("");
      setValues({});
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-knt-blue font-medium">
        + Add new item
      </button>
    );
  }

  return (
    <div className="border border-dashed border-knt-blue-gray rounded-xl p-4 grid grid-cols-4 gap-2.5 items-end">
      <div>
        <div className="text-[11px] text-gray-500 mb-1">Code</div>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. pecoat-500" className="input" />
      </div>
      <div className="col-span-2">
        <div className="text-[11px] text-gray-500 mb-1">Display Name</div>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" />
      </div>
      <div>
        <div className="text-[11px] text-gray-500 mb-1">Effective From</div>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="input" />
      </div>
      {fields.map((f) => (
        <div key={f.key}>
          <div className="text-[11px] text-gray-500 mb-1">{f.label}</div>
          <input
            type="number"
            step={f.step ?? 0.01}
            value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="input"
          />
        </div>
      ))}
      <div className="col-span-4 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={isPending}
          className="bg-knt-navy text-white rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Create"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-500">
          Cancel
        </button>
        {error && <span className="text-xs text-knt-red">{error}</span>}
      </div>

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
