"use client";

import { useState, useTransition } from "react";
import { saveCustomerAction, deleteCustomerAction } from "@/app/customers/actions";
import type { CustomerRecord } from "@/lib/customers";

type FormValues = { customerName: string; industry: string; businessType: string; product: string };

const BLANK: FormValues = { customerName: "", industry: "", businessType: "", product: "" };

function toFormValues(c?: CustomerRecord): FormValues {
  return {
    customerName: c?.customerName ?? "",
    industry: c?.industry ?? "",
    businessType: c?.businessType ?? "",
    product: c?.product ?? "",
  };
}

export function CustomerList({ customers }: { customers: CustomerRecord[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormValues>(BLANK);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormValues>(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitAdd() {
    setError(null);
    if (!addForm.customerName.trim()) {
      setError("Customer Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await saveCustomerAction({
        customerName: addForm.customerName,
        industry: addForm.industry || undefined,
        businessType: addForm.businessType || undefined,
        product: addForm.product || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to save.");
        return;
      }
      setAddOpen(false);
      setAddForm(BLANK);
    });
  }

  function startEdit(c: CustomerRecord) {
    setError(null);
    setAddOpen(false);
    setEditingId(c.id);
    setEditForm(toFormValues(c));
  }

  function submitEdit(id: string) {
    setError(null);
    if (!editForm.customerName.trim()) {
      setError("Customer Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await saveCustomerAction({
        id,
        customerName: editForm.customerName,
        industry: editForm.industry || undefined,
        businessType: editForm.businessType || undefined,
        product: editForm.product || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to save.");
        return;
      }
      setEditingId(null);
    });
  }

  function submitDelete(c: CustomerRecord) {
    setError(null);
    if (!window.confirm(`Delete customer "${c.customerName}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteCustomerAction(c.id);
      if (!res.ok) setError(res.error ?? "Failed to delete.");
    });
  }

  return (
    <div className="bg-white rounded-[14px] border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-knt-navy">Customers</div>
        <button
          onClick={() => {
            setEditingId(null);
            setAddOpen((o) => !o);
          }}
          className="text-xs text-knt-blue font-medium"
        >
          {addOpen ? "Cancel" : "+ Add Customer"}
        </button>
      </div>

      {error && <div className="mb-2 text-xs text-knt-red">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Customer Name</th>
              <th className="text-left text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Industry</th>
              <th className="text-left text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Business Type</th>
              <th className="text-left text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Product</th>
              <th className="text-right text-[10.5px] font-medium text-gray-400 px-2.5 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} className="bg-knt-ivory/60">
                  <td className="px-2.5 py-1.5">
                    <input
                      value={editForm.customerName}
                      onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))}
                      className="edit-input"
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <input
                      value={editForm.industry}
                      onChange={(e) => setEditForm((f) => ({ ...f, industry: e.target.value }))}
                      className="edit-input"
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <input
                      value={editForm.businessType}
                      onChange={(e) => setEditForm((f) => ({ ...f, businessType: e.target.value }))}
                      className="edit-input"
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <input
                      value={editForm.product}
                      onChange={(e) => setEditForm((f) => ({ ...f, product: e.target.value }))}
                      className="edit-input"
                    />
                  </td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => submitEdit(c.id)}
                      disabled={isPending}
                      className="text-knt-blue font-medium mr-2 disabled:opacity-50"
                    >
                      {isPending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500">
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td className="px-2.5 py-1.5 font-medium text-knt-navy">{c.customerName}</td>
                  <td className="px-2.5 py-1.5 text-gray-600">{c.industry || "-"}</td>
                  <td className="px-2.5 py-1.5 text-gray-600">{c.businessType || "-"}</td>
                  <td className="px-2.5 py-1.5 text-gray-600">{c.product || "-"}</td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(c)} className="text-knt-blue font-medium mr-2">
                      Edit
                    </button>
                    <button onClick={() => submitDelete(c)} disabled={isPending} className="text-knt-red disabled:opacity-50">
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
            {customers.length === 0 && !addOpen && (
              <tr>
                <td colSpan={5} className="text-center text-sm text-gray-400 py-8">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2.5 items-end">
          <div>
            <div className="text-[11px] text-gray-500 mb-1">Customer Name *</div>
            <input
              value={addForm.customerName}
              onChange={(e) => setAddForm((f) => ({ ...f, customerName: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <div className="text-[11px] text-gray-500 mb-1">Industry</div>
            <input
              value={addForm.industry}
              onChange={(e) => setAddForm((f) => ({ ...f, industry: e.target.value }))}
              className="input"
              placeholder="e.g. Home Appliance, Automotive, Medical"
            />
          </div>
          <div>
            <div className="text-[11px] text-gray-500 mb-1">Business Type</div>
            <input
              value={addForm.businessType}
              onChange={(e) => setAddForm((f) => ({ ...f, businessType: e.target.value }))}
              className="input"
              placeholder="e.g. Manufacturer, Trading Company"
            />
          </div>
          <div>
            <div className="text-[11px] text-gray-500 mb-1">Product</div>
            <input
              value={addForm.product}
              onChange={(e) => setAddForm((f) => ({ ...f, product: e.target.value }))}
              className="input"
              placeholder="e.g. Wire Harness, Copper Pipe"
            />
          </div>
          <div className="col-span-4">
            <button
              onClick={submitAdd}
              disabled={isPending}
              className="bg-knt-navy text-white rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save Customer"}
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
