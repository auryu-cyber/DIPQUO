"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";

/** A number input that displays #,###.## when not focused, and the raw digits
 *  (for easy editing) while focused. */
export function FormattedNumberInput({
  value,
  onChange,
  className = "input",
  placeholder,
  decimals = 2,
  grouping = true,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
  /** Decimal places shown when not focused. */
  decimals?: number;
  /** Whether to show a thousands separator — turn off for things like a bare year (2026, not 2,026). */
  grouping?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const display = grouping ? formatNumber(value, decimals) : value.toFixed(decimals);

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
      value={editing ? text : display}
      onFocus={() => {
        setEditing(true);
        setText(value === 0 ? "" : String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const cleaned = raw.replace(/,/g, "");
        if (cleaned === "" || cleaned === "-") {
          onChange(0);
          return;
        }
        const parsed = Number(cleaned);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => setEditing(false)}
    />
  );
}
