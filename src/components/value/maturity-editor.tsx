"use client";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { MATURITY_DIMENSIONS, type MaturityAssessment, type MaturityDimension } from "@/lib/domain/types";
import { saveMaturityAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, StatusText, useAction } from "@/components/ui/form-helpers";

const blank = (v: number) => Object.fromEntries(MATURITY_DIMENSIONS.map((d) => [d, v])) as Record<MaturityDimension, number>;

/** Score each dimension 1–5 (current and target) for one organization. */
export function MaturityEditor({ organizationId, assessment }: { organizationId: string; assessment?: MaturityAssessment }) {
  const { pending, msg, run } = useAction();
  const [scores, setScores] = useState(assessment?.scores ?? blank(1));
  const [target, setTarget] = useState(assessment?.target ?? blank(3));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const sel = (value: number, onChange: (n: number) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 rounded-md border border-input bg-card px-1.5 text-xs">
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n}>{n}</option>
      ))}
    </select>
  );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveMaturityAction({ organizationId, assessedOn: date, scores, target }), "Assessment saved.");
      }}
    >
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {MATURITY_DIMENSIONS.map((d) => (
          <div key={d} className="flex items-center justify-between gap-2 border-b py-1 text-xs">
            <span className="min-w-0 flex-1">{d}</span>
            <span className="text-[10px] text-muted-foreground">now</span>
            {sel(scores[d], (n) => setScores({ ...scores, [d]: n }), `${d} current`)}
            <span className="text-[10px] text-muted-foreground">target</span>
            {sel(target[d], (n) => setTarget({ ...target, [d]: n }), `${d} target`)}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Assessment date" htmlFor="mat-date">
          <Input id="mat-date" type="date" className="h-8 w-40 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save assessment
        </Button>
        <StatusText msg={msg} />
      </div>
      <p className="text-[11px] text-muted-foreground">1 = Ad hoc · 2 = Emerging · 3 = Defined · 4 = Managed · 5 = Optimized. Saving replaces the organization&apos;s current assessment and is recorded in the audit log.</p>
    </form>
  );
}
