"use client";
import { setCurrency } from "@/lib/format";

/** Sets the workspace currency for client-side formatting (charts, editors). */
export function CurrencyInit({ code }: { code: string }) {
  setCurrency(code);
  return null;
}
