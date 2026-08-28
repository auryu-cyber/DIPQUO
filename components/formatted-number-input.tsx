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
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
      value={editing ? text : formatNumber(value)}
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
