"use client";

import { useState } from "react";

function formatDigits(digits: string): string {
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let out = mm;
  if (digits.length > 2) out += "/" + dd;
  if (digits.length > 4) out += "/" + yyyy;
  return out;
}

function digitsToIso(digits: string): string | null {
  if (digits.length !== 8) return null;
  const mm = Number(digits.slice(0, 2));
  const dd = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (date.getUTCFullYear() !== yyyy || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) return null;
  return `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function isoToDigits(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [yyyy, mm, dd] = iso.split("-");
  return mm + dd + yyyy;
}

export function DateField({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (isoValue: string) => void;
  label: string;
  className?: string;
}) {
  const [digits, setDigits] = useState(() => isoToDigits(value));
  const [lastSyncedValue, setLastSyncedValue] = useState(value);

  // Stay in sync if the ISO value changes from outside this field (e.g. reset)
  // — adjusting state during render instead of in an effect avoids an extra render pass.
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDigits(isoToDigits(value));
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="MM/DD/YYYY"
        value={formatDigits(digits)}
        onChange={(e) => {
          const newDigits = e.target.value.replace(/\D/g, "").slice(0, 8);
          setDigits(newDigits);
          if (newDigits.length === 0) {
            onChange("");
            return;
          }
          const iso = digitsToIso(newDigits);
          if (iso) onChange(iso);
        }}
        className={`w-36 ${className ?? ""}`}
      />
    </label>
  );
}
