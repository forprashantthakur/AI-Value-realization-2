"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import type { AppSettings, GovernanceStep, Role } from "@/lib/domain/types";
import { STATUS_LABEL } from "@/lib/domain/labels";
import { saveGovernanceAction, saveSettingsAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type Res = { ok: boolean; error?: string };
function useSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Res>, okText = "Saved.") =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Failed" });
      if (r.ok) router.refresh();
    });
  const Msg = () => (msg ? <span className={cn("text-xs", msg.ok ? "text-[#006300]" : "text-red-700")}>{msg.text}</span> : null);
  return { pending, run, Msg };
}

function Fld({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} {...rest} />
    </div>
  );
}

export function GovernanceEditor({ steps, roles }: { steps: GovernanceStep[]; roles: { id: Role; name: string }[] }) {
  const { pending, run, Msg } = useSubmit();
  const [s, setS] = useState(steps);
  const toggle = (i: number, r: Role) =>
    setS(s.map((x, j) => (j === i ? { ...x, allowedRoles: x.allowedRoles.includes(r) ? x.allowedRoles.filter((y) => y !== r) : [...x.allowedRoles, r] } : x)));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
              <th className="py-1.5">Step</th>
              {roles.map((r) => (
                <th key={r.id} className="px-1 text-center font-medium normal-case">
                  {r.name}
                </th>
              ))}
              <th className="px-1 text-center">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {s.map((x, i) => (
              <tr key={i} className="border-b">
                <td className="py-1.5 pr-2">
                  <p className="font-medium">
                    {STATUS_LABEL[x.from]} → {STATUS_LABEL[x.to]}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{x.label}</p>
                </td>
                {roles.map((r) => (
                  <td key={r.id} className="px-1 text-center">
                    <input type="checkbox" checked={x.allowedRoles.includes(r.id)} onChange={() => toggle(i, r.id)} aria-label={`${r.name} may ${x.label}`} />
                  </td>
                ))}
                <td className="text-center">
                  <input type="checkbox" checked={x.requiresEvidence} onChange={() => setS(s.map((y, j) => (j === i ? { ...y, requiresEvidence: !y.requiresEvidence } : y)))} aria-label="Requires evidence" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" disabled={pending} onClick={() => run(() => saveGovernanceAction(s), "Workflow saved.")}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />} Save workflow
      </Button>
      <Msg />
    </div>
  );
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const { pending, run, Msg } = useSubmit();
  const [s, setS] = useState(settings);
  const W = s.scorecardWeights;
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          saveSettingsAction({
            reportingCurrency: s.reportingCurrency,
            discountRate: s.discountRate,
            horizonYears: s.horizonYears,
            defaultProductiveHours: s.defaultProductiveHours,
            roiBasis: s.roiBasis,
            rampUp: s.rampUp,
            compositeScoreEnabled: s.compositeScoreEnabled,
            scorecardWeights: s.scorecardWeights,
            realizedValueModel: s.realizedValueModel,
          }),
          "Settings saved — every metric has been recalculated.",
        );
      }}
    >
      <fieldset className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <legend className="section-title mb-2">Financial method</legend>
        <Fld id="dr" label="Discount rate %" type="number" step="0.1" min={0} max={50} value={Math.round(s.discountRate * 1000) / 10} onChange={(e) => setS({ ...s, discountRate: Number(e.target.value) / 100 })} />
        <Fld id="hz" label="ROI horizon (years)" type="number" min={1} max={10} value={s.horizonYears} onChange={(e) => setS({ ...s, horizonYears: Number(e.target.value) })} />
        <Fld id="ph" label="Default productive hours / FTE" type="number" min={800} max={2400} value={s.defaultProductiveHours} onChange={(e) => setS({ ...s, defaultProductiveHours: Number(e.target.value) })} />
        <Fld id="cur" label="Reporting currency" value={s.reportingCurrency} maxLength={3} onChange={(e) => setS({ ...s, reportingCurrency: e.target.value.toUpperCase() })} />
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="basis">ROI basis (which benefits count)</Label>
          <select id="basis" value={s.roiBasis} onChange={(e) => setS({ ...s, roiBasis: e.target.value as AppSettings["roiBasis"] })} className="h-9 w-full rounded-md border px-2 text-sm">
            <option value="CASHABLE_ONLY">Cashable savings only (most conservative)</option>
            <option value="CASHABLE_AND_AVOIDANCE">Cashable + cost avoidance</option>
            <option value="ALL_FINANCIAL">All financial (incl. revenue, working capital, risk)</option>
          </select>
        </div>
        <Fld
          id="ramp"
          label="Benefit ramp by year (%, comma-sep.)"
          value={s.rampUp.map((x) => Math.round(x * 100)).join(",")}
          onChange={(e) => setS({ ...s, rampUp: e.target.value.split(",").map((x) => Math.min(1, Math.max(0, Number(x) / 100))).filter((x) => Number.isFinite(x)) })}
        />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="section-title">Scorecard weights</legend>
        <div className="flex items-center gap-2 text-xs">
          <Switch checked={s.compositeScoreEnabled} onCheckedChange={(c) => setS({ ...s, compositeScoreEnabled: c })} aria-label="Enable composite score" />
          Show composite score (weighted average of the transparent dimensions)
        </div>
        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {(Object.keys(W) as (keyof typeof W)[]).map((k) => (
            <Fld key={k} id={`w-${k}`} label={k.replace(/([A-Z])/g, " $1").toLowerCase()} type="number" min={0} max={100} value={W[k]} onChange={(e) => setS({ ...s, scorecardWeights: { ...W, [k]: Number(e.target.value) } })} />
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="section-title">Realized-value model (top-down cross-check)</legend>
        <p className="text-xs text-muted-foreground">Realized = Potential × Adoption × Performance × Attribution. Toggle factors to match your method.</p>
        <div className="flex flex-wrap gap-4 text-xs">
          {(["useAdoption", "usePerformance", "useAttribution"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <Switch checked={s.realizedValueModel[k]} onCheckedChange={(c) => setS({ ...s, realizedValueModel: { ...s.realizedValueModel, [k]: c } })} aria-label={k} />
              {k.replace("use", "")}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save settings
        </Button>
        <Msg />
      </div>
    </form>
  );
}
