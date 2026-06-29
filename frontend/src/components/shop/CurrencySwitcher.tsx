"use client";

import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/currency";

interface Props {
  value: string;
  onChange: (currency: string) => void;
  className?: string;
}

export default function CurrencySwitcher({ value, onChange, className = "" }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={"chip cursor-pointer bg-surface2 border border-line text-ink text-xs font-semibold rounded-lg px-2 py-1 " + className}
      aria-label="Currency"
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}
