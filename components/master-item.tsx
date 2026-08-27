"use client";

import { useState, useTransition } from "react";
import { addMasterRecordAction, updateMasterRecordAction, deleteMasterRecordAction } from "@/app/masters/actions";
import { formatNumber } from "@/lib/format";
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

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankForm(fields: FieldSpec[], hasDisplayName: boolean, entry?: HistoryEntry): Record<string, string> {
  const init: Record<string, string> = {
    effectiveFrom: entry?.effectiveFrom ?? todayStr(),
    note: entry?.note ?? "",
  };
  if (hasDisplayName) init.displayName = entry?.displayName ?? "";
  for (const f of fields) init[f.key] = entry ? String(entry.values[f.key] ?? "") : "";
  return init;
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
  const [addOpen, setAddOpen] = useState(false);
  const [editingFrom, setEditingFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const today = todayStr();
  const current = history.find((h) => h.effectiveFrom <= today) ?? history[0];

  const [addForm, setAddForm] = useState<Record<string, string>>(() => blankForm(fields, hasDisplayName, current));
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  function submitAdd() {
    setError(null);
    const values: Record<string, unknown> = { effectiveFrom: addForm.effectiveFrom, conditions: {} };
    if (addForm.note) values.note = addForm.note;
    if (hasDisplayName) values.displayName = addForm.displayName;
    for (const f of fields) values[f.key] = Number(addForm[f.key]);

    startTransition(async () => {
      const res = await addMasterRecordAction(type, code, values as never);
      if (!res.ok) {
        setError(res.error ?? "Failed to save.");
        return;
      }
      setAddOpen(false);
    });
  }

  function startEdit(h: HistoryEntry) {
    setError(null);
    setEditingFrom(h.effectiveFrom);
    setEditForm(blankForm(fields, hasDisplayName, h));
  }

  function submitEdit(originalEffectiveFrom: string) {
    setError(null);
    const values: Record<string, unknown> = { effectiveFrom: editForm.effectiveFrom, conditions: {} };
    if (editForm.note) values.note = editForm.note;
    if (hasDisplayName) values.displayName = editForm.displayName;
    for (const f of fields) values[f.key] = Number(editForm[f.key]);

    startTransition(async () => {
      const res = await updateMasterRecordAction(type, code, originalEffectiveFrom, values as never);
      if (!res.ok) {
        setError(res.error ?? "Failed to save.");
        return;
      }
      setEditingFrom(null);
    });
  }

  function submitDelete(effectiveFrom: string) {
    setError(null);
    if (!window.confirm(`Delete the rate effective ${effectiveFrom}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteMasterRecordAction(type, code, effectiveFrom);
      if (!res.ok) {
        setError(res.error ?? "Failed to delete.");
      }
    });
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-knt-navy">{displayLabel}</div>
          <div className="text-[11px] text-gray-400">
            {history.length} period rate{history.length === 1 ? "" : "s"} on file
            {current ? ` · currently ${current.effectiveFrom}` : ""}
          </div>
        </div>
        <button
          onClick={() => {
            setEditingFrom(null);
            setAddOpen((o) => !o);
          }}
          className="text-xs text-knt-blue font-medium"
        >
          {addOpen ? "Cancel" : "+ Add rate for a period"}
        </button>
      </div>

      {error && <div className="mt-2 text-xs text-knt-red">{error}</div>}

      {history.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="text-left text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Effective From</th>
                {hasDisplayName && <th className="text-left text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Name</th>}
                {fields.map((f) => (
                  <th key={f.key} className="text-right text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">
                    {f.label}
                  </th>
                ))}
                <th className="text-left text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Recorded By</th>
                <th className="text-left text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Note</th>
                <th className="text-right text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) =>
                editingFrom === h.effectiveFrom ? (
                  <tr key={h.effectiveFrom} className="bg-knt-ivory/60">
                    <td className="px-2.5 py-1.5">
                      <input
                        type="date"
                        value={editForm.effectiveFrom}
                        onChange={(e) => setEditForm((s) => ({ ...s, effectiveFrom: e.target.value }))}
                        className="edit-input"
                      />
                    </td>
                    {hasDisplayName && (
                      <td className="px-2.5 py-1.5">
                        <input
                          value={editForm.displayName ?? ""}
                          onChange={(e) => setEditForm((s) => ({ ...s, displayName: e.target.value }))}
                          className="edit-input"
                        />
                      </td>
                    )}
                    {fields.map((f) => (
                      <td key={f.key} className="px-2.5 py-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          step={f.step ?? 0.01}
                          value={editForm[f.key] ?? ""}
                          onChange={(e) => setEditForm((s) => ({ ...s, [f.key]: e.target.value }))}
                          className="edit-input text-right"
                        />
                      </td>
                    ))}
                    <td className="px-2.5 py-1.5 text-gray-500">{h.recordedBy}</td>
                    <td className="px-2.5 py-1.5">
                      <input
                        value={editForm.note ?? ""}
                        onChange={(e) => setEditForm((s) => ({ ...s, note: e.target.value }))}
                        className="edit-input"
                      />
                    </td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => submitEdit(h.effectiveFrom)}
                        disabled={isPending}
                        className="text-knt-blue font-medium mr-2 disabled:opacity-50"
                      >
                        {isPending ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditingFrom(null)} className="text-gray-500">
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={h.effectiveFrom} className={h === current ? "bg-knt-blue/[0.06]" : ""}>
                    <td className="px-2.5 py-1.5 font-medium text-knt-navy">
                      {h.effectiveFrom}
                      {h === current && (
                        <span className="ml-1.5 text-[9.5px] font-bold text-knt-blue bg-knt-blue/10 rounded-full px-1.5 py-0.5">
                          Current
                        </span>
                      )}
                    </td>
                    {hasDisplayName && <td className="px-2.5 py-1.5">{h.displayName}</td>}
                    {fields.map((f) => (
                      <td key={f.key} className="text-right px-2.5 py-1.5">
                        {formatNumber(h.values[f.key] ?? 0, f.step && f.step >= 1 ? 0 : 2)}
                      </td>
                    ))}
                    <td className="px-2.5 py-1.5 text-gray-500">{h.recordedBy}</td>
                    <td className="px-2.5 py-1.5 text-gray-400">{h.note ?? ""}</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setAddOpen(false);
                          startEdit(h);
                        }}
                        className="text-knt-blue font-medium mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => submitDelete(h.effectiveFrom)}
                        disabled={isPending}
                        className="text-knt-red disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2.5 items-end">
          {hasDisplayName && (
            <div className="col-span-2">
              <div className="text-[11px] text-gray-500 mb-1">Display Name</div>
              <input
                value={addForm.displayName ?? ""}
                onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                className="input"
              />
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key}>
              <div className="text-[11px] text-gray-500 mb-1">{f.label}</div>
              <input
                type="number"
                inputMode="decimal"
                step={f.step ?? 0.01}
                value={addForm[f.key] ?? ""}
                onChange={(e) => setAddForm((s) => ({ ...s, [f.key]: e.target.value }))}
                className="input"
              />
            </div>
          ))}
          <div>
            <div className="text-[11px] text-gray-500 mb-1">Effective From</div>
            <input
              type="date"
              value={addForm.effectiveFrom}
              onChange={(e) => setAddForm((s) => ({ ...s, effectiveFrom: e.target.value }))}
              className="input"
            />
          </div>
          <div className="col-span-4">
            <div className="text-[11px] text-gray-500 mb-1">Note</div>
            <input value={addForm.note} onChange={(e) => setAddForm((s) => ({ ...s, note: e.target.value }))} className="input" />
          </div>
          <div className="col-span-4 flex items-center gap-3">
            <button
              onClick={submitAdd}
              disabled={isPending}
              className="bg-knt-navy text-white rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save rate"}
            </button>
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
        .edit-input {
          border: 1.5px solid var(--color-knt-blue);
          border-radius: 6px;
          padding: 3px 6px;
          font-size: 12px;
          width: 100%;
          background: white;
        }
      `}</style>
    </div>
  );
}
