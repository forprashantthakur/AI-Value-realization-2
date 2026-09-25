import type { Metric, MetricUnit } from "./value-engine/metric";

import { cache } from "react";

export const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$", JPY: "¥", AUD: "A$", CAD: "C$", CHF: "CHF " };
export const CURRENCIES = Object.keys(CURRENCY_SYMBOL);
export const currencySymbol = (code: string) => CURRENCY_SYMBOL[code] ?? `${code} `;

// Server renders keep the workspace currency in a per-request store (React cache) so concurrent
// requests for different workspaces never share it; the browser uses the module-level fallback.
const requestCurrency = cache((): { symbol: string | null } => ({ symbol: null }));
let fallbackSymbol = "₹";
export function setCurrency(code: string) {
  const s = currencySymbol(code);
  fallbackSymbol = s;
  try {
    requestCurrency().symbol = s;
  } catch {
    /* outside a request */
  }
}
function sym() {
  try {
    return requestCurrency().symbol ?? fallbackSymbol;
  } catch {
    return fallbackSymbol;
  }
}

/** ₹31.3M style — compact, consistent with the brief's examples. */
export function money(v: number, opts: { compact?: boolean; digits?: number } = {}): string {
  if (!Number.isFinite(v)) return "—";
  const compact = opts.compact ?? true;
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (!compact || a < 10_000) return `${sign}${sym()}${a.toLocaleString("en-IN", { maximumFractionDigits: a < 100 ? 2 : 0 })}`;
  const d = opts.digits ?? 1;
  if (a >= 1e9) return `${sign}${sym()}${(a / 1e9).toFixed(d)}B`;
  if (a >= 1e6) return `${sign}${sym()}${(a / 1e6).toFixed(d)}M`;
  return `${sign}${sym()}${(a / 1e3).toFixed(0)}K`;
}

export function pct(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export function fmtUnit(v: number, unit: MetricUnit, digits?: number): string {
  switch (unit) {
    case "currency":
      return money(v);
    case "percent":
      return pct(v, digits ?? 1);
    case "hours":
      return `${num(v)} h`;
    case "minutes":
      return `${num(v, 1)} min`;
    case "days":
      return `${num(v, 1)} d`;
    case "fte":
      return `${num(v, 1)} FTE`;
    case "months":
      return `${num(v, 1)} mo`;
    case "years":
      return `${num(v, 1)} yr`;
    case "ratio":
      return `${v.toFixed(2)}×`;
    case "tokens":
      return num(v);
    default:
      return num(v, digits ?? 1);
  }
}

export function fmtMetric(m: Metric, digits?: number): string {
  if (m.undefinedReason) return "n/a";
  return fmtUnit(m.value, m.unit, digits);
}

export function hoursLabel(h: number): string {
  if (h >= 48) return `${(h / 24).toFixed(1)} days`;
  if (h >= 1) return `${h.toFixed(1)} h`;
  return `${(h * 60).toFixed(0)} min`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
