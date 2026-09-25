"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { Assumption, Benefit, BusinessCase, BusinessUnit, FunctionDomain, Initiative, KpiDefinition, KpiValue, LeakageNote, Measurement, Organization, ProcessNode } from "@/lib/domain/types";
import { CONFIDENCE_LEVELS, FINANCIAL_CLASSES, HEALTH, LEAKAGE_CAUSES, LIFECYCLE_STAGES, VALUE_CATEGORIES } from "@/lib/domain/types";
import { CATEGORY_LABEL, CLASS_LABEL, HEALTH_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import {
  deleteActualSnapshotAction,
  deleteAgentAction,
  deleteBenefitAction,
  deleteInitiativeAction,
  deleteMeasurementAction,
  saveAssumptionsAction,
  saveBusinessCaseAction,
  saveDeclaredBenefitAction,
  saveKpiValuesAction,
  saveLeakageNotesAction,
  saveMeasurementAction,
  updateInitiativeAction,
} from "@/app/actions/initiative";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmButton, Field, NativeSelect, StatusText, useAction } from "@/components/ui/form-helpers";

const pretty = (s: string) => s.charAt(0) + s.slice(1).replaceAll("_", " ").toLowerCase();
const num = (v: string) => (v === "" ? 0 : Number(v));

// ---------------------------------------------------------------------------------------------
// Initiative details
// ---------------------------------------------------------------------------------------------
type Ref = { organizations: Organization[]; businessUnits: BusinessUnit[]; functions: FunctionDomain[]; processes: ProcessNode[] };

export function InitiativeDetailsEditor({ init, refs }: { init: Initiative; refs: Ref }) {
  const [open, setOpen] = useState(false);
  const { pending, msg, fieldErrors, run } = useAction();
  const [f, setF] = useState({
    code: init.code,
    name: init.name,
    description: init.description,
    organizationId: init.organizationId,
    businessUnitId: init.businessUnitId,
    functionId: init.functionId,
    processId: init.processId,
    country: init.country,
    useCase: init.useCase,
    aiTechnology: init.aiTechnology,
    stage: init.stage,
    health: init.health,
    owner: init.owner,
    productOwner: init.productOwner,
    financeValidator: init.financeValidator,
    complexity: init.complexity,
    strategicAlignment: init.strategicAlignment,
    riskLevel: init.riskLevel,
    productiveHoursPerFte: init.productiveHoursPerFte,
    costPerError: init.costPerError,
    laborBasis: init.laborBasis,
    startDate: init.startDate,
    goLiveDate: init.goLiveDate ?? "",
    tags: init.tags.join(", "),
  });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const bus = refs.businessUnits.filter((b) => b.organizationId === f.organizationId);
  const procs = refs.processes.filter((x) => x.functionId === f.functionId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil /> Edit details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit initiative</DialogTitle>
          <DialogDescription>Stage, health, ownership, classification and calculation parameters. Every change is audited.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                updateInitiativeAction(init.id, {
                  ...f,
                  goLiveDate: f.goLiveDate || null,
                  tags: f.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                }),
              "Saved.",
              () => setOpen(false),
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Code" htmlFor="i-code" error={fieldErrors.code}>
              <Input id="i-code" value={f.code} onChange={(e) => set({ code: e.target.value })} />
            </Field>
            <Field label="Name" htmlFor="i-name" error={fieldErrors.name} className="sm:col-span-3">
              <Input id="i-name" value={f.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="i-desc" className="sm:col-span-4">
              <Textarea id="i-desc" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Lifecycle stage" htmlFor="i-stage">
              <NativeSelect id="i-stage" value={f.stage} onChange={(e) => set({ stage: e.target.value as Initiative["stage"] })}>
                {LIFECYCLE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Health" htmlFor="i-health">
              <NativeSelect id="i-health" value={f.health} onChange={(e) => set({ health: e.target.value as Initiative["health"] })}>
                {HEALTH.map((h) => (
                  <option key={h} value={h}>
                    {HEALTH_LABEL[h]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Start date" htmlFor="i-start">
              <Input id="i-start" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </Field>
            <Field label="Go-live date" htmlFor="i-golive">
              <Input id="i-golive" type="date" value={f.goLiveDate} onChange={(e) => set({ goLiveDate: e.target.value })} />
            </Field>
            <Field label="Organization" htmlFor="i-org">
              <NativeSelect
                id="i-org"
                value={f.organizationId}
                onChange={(e) => {
                  const organizationId = e.target.value;
                  set({ organizationId, businessUnitId: refs.businessUnits.find((b) => b.organizationId === organizationId)?.id ?? "" });
                }}
              >
                {refs.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Business unit" htmlFor="i-bu">
              <NativeSelect id="i-bu" value={f.businessUnitId} onChange={(e) => set({ businessUnitId: e.target.value })}>
                {bus.length === 0 && <option value="">— add a business unit first —</option>}
                {bus.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Function" htmlFor="i-fn">
              <NativeSelect
                id="i-fn"
                value={f.functionId}
                onChange={(e) => {
                  const functionId = e.target.value;
                  set({ functionId, processId: refs.processes.find((x) => x.functionId === functionId)?.id ?? "" });
                }}
              >
                {refs.functions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Process" htmlFor="i-proc">
              <NativeSelect id="i-proc" value={f.processId} onChange={(e) => set({ processId: e.target.value })}>
                {procs.length === 0 && <option value="">— add a process first —</option>}
                {procs.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.level === "PROCESS" ? "" : "— "}
                    {x.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Country" htmlFor="i-country">
              <Input id="i-country" value={f.country} onChange={(e) => set({ country: e.target.value })} />
            </Field>
            <Field label="Use case" htmlFor="i-uc">
              <Input id="i-uc" value={f.useCase} onChange={(e) => set({ useCase: e.target.value })} />
            </Field>
            <Field label="AI technology" htmlFor="i-tech">
              <Input id="i-tech" value={f.aiTechnology} onChange={(e) => set({ aiTechnology: e.target.value })} placeholder="GenAI, Agentic AI, ML…" />
            </Field>
            <Field label="Tags" htmlFor="i-tags">
              <Input id="i-tags" value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="comma-separated" />
            </Field>
            <Field label="Business owner" htmlFor="i-owner">
              <Input id="i-owner" value={f.owner} onChange={(e) => set({ owner: e.target.value })} />
            </Field>
            <Field label="AI product owner" htmlFor="i-po">
              <Input id="i-po" value={f.productOwner} onChange={(e) => set({ productOwner: e.target.value })} />
            </Field>
            <Field label="Finance validator" htmlFor="i-fv">
              <Input id="i-fv" value={f.financeValidator} onChange={(e) => set({ financeValidator: e.target.value })} />
            </Field>
            <Field label="Risk level" htmlFor="i-risk">
              <NativeSelect id="i-risk" value={f.riskLevel} onChange={(e) => set({ riskLevel: e.target.value as Initiative["riskLevel"] })}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </NativeSelect>
            </Field>
            <Field label="Complexity (1–5)" htmlFor="i-cx">
              <Input id="i-cx" type="number" min={1} max={5} value={f.complexity} onChange={(e) => set({ complexity: num(e.target.value) })} />
            </Field>
            <Field label="Strategic alignment (1–5)" htmlFor="i-sa">
              <Input id="i-sa" type="number" min={1} max={5} value={f.strategicAlignment} onChange={(e) => set({ strategicAlignment: num(e.target.value) })} />
            </Field>
            <Field label="Productive hours / FTE / yr" htmlFor="i-ph" error={fieldErrors.productiveHoursPerFte}>
              <Input id="i-ph" type="number" min={800} max={2400} value={f.productiveHoursPerFte} onChange={(e) => set({ productiveHoursPerFte: num(e.target.value) })} />
            </Field>
            <Field label="Cost per error" htmlFor="i-cpe">
              <Input id="i-cpe" type="number" min={0} step="any" value={f.costPerError} onChange={(e) => set({ costPerError: num(e.target.value) })} />
            </Field>
            <Field label="Labour basis" htmlFor="i-lb" className="sm:col-span-2">
              <NativeSelect id="i-lb" value={f.laborBasis} onChange={(e) => set({ laborBasis: e.target.value as Initiative["laborBasis"] })}>
                <option value="FTE_CALIBRATED">FTE-calibrated (scale activity hours to reported FTE)</option>
                <option value="ACTIVITY">Activity-based (volume × handling time)</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
            </Button>
            <StatusText msg={msg} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteInitiative({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const { pending, msg, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800">
          <Trash2 /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete initiative {code}?</DialogTitle>
          <DialogDescription>This permanently removes the initiative with its measurements, benefits, evidence, agents, costs and scenarios. The audit log keeps a record of the deletion.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => deleteInitiativeAction(id, confirm),
              null,
              () => {
                setOpen(false);
                router.push("/portfolio");
              },
            );
          }}
        >
          <Field label={`Type ${code} to confirm`} htmlFor="del-code">
            <Input id="del-code" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="destructive" disabled={pending || confirm.trim() !== code}>
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete permanently
            </Button>
            <StatusText msg={msg} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Business case
// ---------------------------------------------------------------------------------------------
export function BusinessCaseEditor({ initiativeId, bc }: { initiativeId: string; bc: BusinessCase }) {
  const [open, setOpen] = useState(false);
  const { pending, msg, fieldErrors, run } = useAction();
  const [f, setF] = useState({ ...bc, approvedDate: bc.approvedDate ?? "", approvedBy: bc.approvedBy ?? "", objectives: bc.objectives.join("\n") });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil /> Edit business case
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Business case</DialogTitle>
          <DialogDescription>Approved targets are the benchmark measured value is compared against.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveBusinessCaseAction(initiativeId, {
                  ...f,
                  approvedDate: f.approvedDate || null,
                  approvedBy: f.approvedBy || null,
                  objectives: f.objectives
                    .split("\n")
                    .map((o) => o.trim())
                    .filter(Boolean),
                }),
              "Business case saved.",
              () => setOpen(false),
            );
          }}
        >
          <Field label="Problem statement" htmlFor="bc-ps" error={fieldErrors.problemStatement}>
            <Textarea id="bc-ps" rows={3} value={f.problemStatement} onChange={(e) => set({ problemStatement: e.target.value })} />
          </Field>
          <Field label="Objectives (one per line)" htmlFor="bc-obj">
            <Textarea id="bc-obj" rows={3} value={f.objectives} onChange={(e) => set({ objectives: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sponsor" htmlFor="bc-sp" error={fieldErrors.sponsor}>
              <Input id="bc-sp" value={f.sponsor} onChange={(e) => set({ sponsor: e.target.value })} />
            </Field>
            <Field label="Approved by" htmlFor="bc-ab">
              <Input id="bc-ab" value={f.approvedBy} onChange={(e) => set({ approvedBy: e.target.value })} />
            </Field>
            <Field label="Approval date" htmlFor="bc-ad">
              <Input id="bc-ad" type="date" value={f.approvedDate} onChange={(e) => set({ approvedDate: e.target.value })} />
            </Field>
            <Field label="Approved investment" htmlFor="bc-inv">
              <Input id="bc-inv" type="number" min={0} step="any" value={f.approvedInvestment} onChange={(e) => set({ approvedInvestment: num(e.target.value) })} />
            </Field>
            <Field label="Declared benefits / yr (not metric-derived)" htmlFor="bc-dec">
              <Input id="bc-dec" type="number" min={0} step="any" value={f.approvedDeclaredBenefits} onChange={(e) => set({ approvedDeclaredBenefits: num(e.target.value) })} />
            </Field>
            <Field label="Horizon (years)" htmlFor="bc-hz">
              <Input id="bc-hz" type="number" min={1} max={10} value={f.horizonYears} onChange={(e) => set({ horizonYears: num(e.target.value) })} />
            </Field>
            <Field label="Planned adoption (%)" htmlFor="bc-pa">
              <Input id="bc-pa" type="number" min={0} max={100} value={Math.round(f.plannedAdoption * 100)} onChange={(e) => set({ plannedAdoption: num(e.target.value) / 100 })} />
            </Field>
            <Field label="Full-potential adoption (%)" htmlFor="bc-fa">
              <Input id="bc-fa" type="number" min={0} max={100} value={Math.round(f.potentialAdoption * 100)} onChange={(e) => set({ potentialAdoption: num(e.target.value) / 100 })} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
            <StatusText msg={msg} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Row-list editors (assumptions, leakage notes, KPI values)
// ---------------------------------------------------------------------------------------------
function ListShell({ children, onAdd, onSave, pending, msg, addLabel, dirty }: { children: React.ReactNode; onAdd: () => void; onSave: () => void; pending: boolean; msg: ReturnType<typeof useAction>["msg"]; addLabel: string; dirty: boolean }) {
  return (
    <div className="space-y-2">
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus /> {addLabel}
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={pending || !dirty}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
        </Button>
        <StatusText msg={msg} />
      </div>
    </div>
  );
}

export function AssumptionsEditor({ initiativeId, items, owner }: { initiativeId: string; items: Assumption[]; owner: string }) {
  const [rows, setRows] = useState(items);
  const { pending, msg, run } = useAction();
  const upd = (i: number, p: Partial<Assumption>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <ListShell addLabel="Add assumption" pending={pending} msg={msg} dirty={JSON.stringify(rows) !== JSON.stringify(items)} onAdd={() => setRows([...rows, { id: "", label: "", value: "", rationale: "", owner }])} onSave={() => run(() => saveAssumptionsAction(initiativeId, rows), "Assumptions saved.")}>
      {rows.map((a, i) => (
        <div key={i} className="grid gap-1.5 rounded-md border p-2 sm:grid-cols-[1.2fr_0.8fr_1.5fr_0.8fr_auto]">
          <Input className="h-8 text-xs" aria-label="Assumption" placeholder="Assumption" value={a.label} onChange={(e) => upd(i, { label: e.target.value })} />
          <Input className="h-8 text-xs" aria-label="Value" placeholder="Value" value={a.value} onChange={(e) => upd(i, { value: e.target.value })} />
          <Input className="h-8 text-xs" aria-label="Rationale" placeholder="Rationale / source" value={a.rationale} onChange={(e) => upd(i, { rationale: e.target.value })} />
          <Input className="h-8 text-xs" aria-label="Owner" placeholder="Owner" value={a.owner} onChange={(e) => upd(i, { owner: e.target.value })} />
          <Button type="button" size="icon" variant="ghost" aria-label="Remove assumption" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No initiative-specific assumptions yet.</p>}
    </ListShell>
  );
}

export function LeakageNotesEditor({ initiativeId, items, owner }: { initiativeId: string; items: LeakageNote[]; owner: string }) {
  const [rows, setRows] = useState(items);
  const { pending, msg, run } = useAction();
  const upd = (i: number, p: Partial<LeakageNote>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <ListShell
      addLabel="Add leakage cause"
      pending={pending}
      msg={msg}
      dirty={JSON.stringify(rows) !== JSON.stringify(items)}
      onAdd={() => setRows([...rows, { id: "", cause: "LOW_ADOPTION", description: "", estimatedAnnualImpact: null, owner }])}
      onSave={() => run(() => saveLeakageNotesAction(initiativeId, rows), "Leakage notes saved.")}
    >
      {rows.map((l, i) => (
        <div key={i} className="grid gap-1.5 rounded-md border p-2 sm:grid-cols-[0.9fr_1.8fr_0.7fr_0.7fr_auto]">
          <NativeSelect className="h-8 text-xs" aria-label="Cause" value={l.cause} onChange={(e) => upd(i, { cause: e.target.value as LeakageNote["cause"] })}>
            {LEAKAGE_CAUSES.map((c) => (
              <option key={c} value={c}>
                {pretty(c)}
              </option>
            ))}
          </NativeSelect>
          <Input className="h-8 text-xs" aria-label="Description" placeholder="What is happening and what is being done" value={l.description} onChange={(e) => upd(i, { description: e.target.value })} />
          <Input className="h-8 text-xs" aria-label="Estimated annual impact" type="number" min={0} step="any" placeholder="Impact / yr" value={l.estimatedAnnualImpact ?? ""} onChange={(e) => upd(i, { estimatedAnnualImpact: e.target.value === "" ? null : Number(e.target.value) })} />
          <Input className="h-8 text-xs" aria-label="Owner" placeholder="Owner" value={l.owner} onChange={(e) => upd(i, { owner: e.target.value })} />
          <Button type="button" size="icon" variant="ghost" aria-label="Remove note" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No qualitative leakage causes recorded.</p>}
    </ListShell>
  );
}

export function KpiValuesEditor({ initiativeId, items, kpis }: { initiativeId: string; items: KpiValue[]; kpis: KpiDefinition[] }) {
  const [rows, setRows] = useState(items);
  const { pending, msg, run } = useAction();
  const upd = (i: number, p: Partial<KpiValue>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const free = kpis.filter((k) => !rows.some((r) => r.kpiId === k.id));
  if (kpis.length === 0) return <p className="text-xs text-muted-foreground">Define KPIs in Administration → KPIs first.</p>;
  return (
    <ListShell addLabel="Add KPI" pending={pending} msg={msg} dirty={JSON.stringify(rows) !== JSON.stringify(items)} onAdd={() => free[0] && setRows([...rows, { kpiId: free[0].id, baseline: 0, target: 0, actual: null }])} onSave={() => run(() => saveKpiValuesAction(initiativeId, rows), "KPIs saved.")}>
      {rows.length > 0 && (
        <div className="hidden grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_auto] gap-1.5 px-2 text-[11px] uppercase text-muted-foreground sm:grid">
          <span>KPI</span>
          <span>Baseline</span>
          <span>Target</span>
          <span>Actual (post-AI)</span>
          <span />
        </div>
      )}
      {rows.map((k, i) => {
        const def = kpis.find((x) => x.id === k.kpiId);
        return (
          <div key={i} className="grid gap-1.5 rounded-md border p-2 sm:grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_auto]">
            <NativeSelect className="h-8 text-xs" aria-label="KPI" value={k.kpiId} onChange={(e) => upd(i, { kpiId: e.target.value })}>
              {kpis
                .filter((x) => x.id === k.kpiId || !rows.some((r) => r.kpiId === x.id))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.unit})
                  </option>
                ))}
            </NativeSelect>
            <Input className="h-8 text-xs" aria-label={`${def?.name} baseline`} type="number" step="any" value={k.baseline} onChange={(e) => upd(i, { baseline: num(e.target.value) })} />
            <Input className="h-8 text-xs" aria-label={`${def?.name} target`} type="number" step="any" value={k.target} onChange={(e) => upd(i, { target: num(e.target.value) })} />
            <Input className="h-8 text-xs" aria-label={`${def?.name} actual`} type="number" step="any" placeholder="not yet" value={k.actual ?? ""} onChange={(e) => upd(i, { actual: e.target.value === "" ? null : Number(e.target.value) })} />
            <Button type="button" size="icon" variant="ghost" aria-label="Remove KPI" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
        );
      })}
    </ListShell>
  );
}

// ---------------------------------------------------------------------------------------------
// Declared benefits
// ---------------------------------------------------------------------------------------------
export function DeclaredBenefitEditor({ initiativeId, benefit, owner, attributionDefault = 0.7 }: { initiativeId: string; benefit?: Benefit; owner: string; attributionDefault?: number }) {
  const [open, setOpen] = useState(false);
  const { pending, msg, fieldErrors, run } = useAction();
  const src = benefit?.source.kind === "DECLARED" ? benefit.source : null;
  const init = {
    id: benefit?.id,
    name: benefit?.name ?? "",
    category: benefit?.category ?? ("FINANCIAL" as Benefit["category"]),
    financialClass: benefit?.financialClass ?? ("REVENUE" as Benefit["financialClass"]),
    nature: benefit?.nature ?? ("ESTIMATED" as Benefit["nature"]),
    annualValue: src?.annualValue ?? 0,
    basis: src?.basis ?? "",
    attributionPct: benefit?.attributionPct ?? attributionDefault,
    confidence: benefit?.confidence ?? ("MEDIUM" as Benefit["confidence"]),
    owner: benefit?.owner ?? owner,
    measurementFrequency: benefit?.measurementFrequency ?? ("QUARTERLY" as Benefit["measurementFrequency"]),
    notes: benefit?.notes ?? "",
  };
  const [f, setF] = useState(init);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {benefit ? (
          <Button size="sm" variant="ghost" aria-label={`Edit ${benefit.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus /> Add declared benefit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{benefit ? "Edit declared benefit" : "Add declared benefit"}</DialogTitle>
          <DialogDescription>For value the engine can&apos;t derive from process metrics — revenue uplift, working capital, risk avoided, or intangible benefits. It enters governance as Proposed.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveDeclaredBenefitAction(initiativeId, f), "Benefit saved.", () => {
              setOpen(false);
              if (!benefit) setF(init);
            });
          }}
        >
          <Field label="Benefit" htmlFor="db-name" error={fieldErrors.name}>
            <Input id="db-name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Faster quote turnaround → higher win rate" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nature" htmlFor="db-nat">
              <NativeSelect id="db-nat" value={f.nature} onChange={(e) => set({ nature: e.target.value as Benefit["nature"] })}>
                <option value="MEASURED">Measured</option>
                <option value="ESTIMATED">Estimated</option>
                <option value="INTANGIBLE">Intangible (no money value)</option>
              </NativeSelect>
            </Field>
            <Field label="Value category" htmlFor="db-cat">
              <NativeSelect id="db-cat" value={f.category} onChange={(e) => set({ category: e.target.value as Benefit["category"] })}>
                {VALUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Financial class" htmlFor="db-cls">
              <NativeSelect id="db-cls" value={f.financialClass} disabled={f.nature === "INTANGIBLE"} onChange={(e) => set({ financialClass: e.target.value as Benefit["financialClass"] })}>
                {FINANCIAL_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Annual value" htmlFor="db-val">
              <Input id="db-val" type="number" min={0} step="any" disabled={f.nature === "INTANGIBLE"} value={f.annualValue} onChange={(e) => set({ annualValue: num(e.target.value) })} />
            </Field>
            <Field label="AI attribution (%)" htmlFor="db-att">
              <Input id="db-att" type="number" min={0} max={100} value={Math.round(f.attributionPct * 100)} onChange={(e) => set({ attributionPct: num(e.target.value) / 100 })} />
            </Field>
            <Field label="Confidence" htmlFor="db-conf">
              <NativeSelect id="db-conf" value={f.confidence} onChange={(e) => set({ confidence: e.target.value as Benefit["confidence"] })}>
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {pretty(c)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Owner" htmlFor="db-own">
              <Input id="db-own" value={f.owner} onChange={(e) => set({ owner: e.target.value })} />
            </Field>
            <Field label="Measured" htmlFor="db-freq">
              <NativeSelect id="db-freq" value={f.measurementFrequency} onChange={(e) => set({ measurementFrequency: e.target.value as Benefit["measurementFrequency"] })}>
                {["REALTIME", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONE_OFF"].map((c) => (
                  <option key={c} value={c}>
                    {pretty(c)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Basis of calculation" htmlFor="db-basis" error={fieldErrors.basis}>
            <Textarea id="db-basis" rows={2} value={f.basis} onChange={(e) => set({ basis: e.target.value })} placeholder="e.g. 2.1 pp win-rate uplift × ₹40M pipeline × 22% margin (CRM, Q2)" />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
            <StatusText msg={msg} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteBenefit({ initiativeId, benefitId }: { initiativeId: string; benefitId: string }) {
  const { pending, msg, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end">
      <ConfirmButton disabled={pending} confirmText="Delete?" onConfirm={() => run(() => deleteBenefitAction(initiativeId, benefitId))}>
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Delete benefit</span>
      </ConfirmButton>
      {msg && !msg.ok && <StatusText msg={msg} />}
    </span>
  );
}

export function DeleteAgent({ initiativeId, agentId }: { initiativeId: string; agentId: string }) {
  const { pending, msg, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end">
      <ConfirmButton disabled={pending} confirmText="Delete agent?" onConfirm={() => run(() => deleteAgentAction(initiativeId, agentId))}>
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Delete agent</span>
      </ConfirmButton>
      {msg && !msg.ok && <StatusText msg={msg} />}
    </span>
  );
}

export function DeleteActualSnapshot({ initiativeId }: { initiativeId: string }) {
  const { pending, msg, run } = useAction();
  return (
    <span className="inline-flex items-center gap-2">
      <ConfirmButton disabled={pending} confirmText="Remove post-AI snapshot?" onConfirm={() => run(() => deleteActualSnapshotAction(initiativeId), "Removed — values are forecast again.")}>
        <Trash2 className="h-3.5 w-3.5" /> Remove snapshot
      </ConfirmButton>
      <StatusText msg={msg} />
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Monthly measurements
// ---------------------------------------------------------------------------------------------
const M_FIELDS: { key: keyof Measurement; label: string; pct?: boolean; int?: boolean }[] = [
  { key: "volume", label: "Volume" },
  { key: "adoptionRate", label: "Adoption %", pct: true },
  { key: "automationRate", label: "Automation %", pct: true },
  { key: "avgHandlingMinutes", label: "Handling min" },
  { key: "cycleTimeHours", label: "Cycle h" },
  { key: "errorRate", label: "Error %", pct: true },
  { key: "reworkRate", label: "Rework %", pct: true },
  { key: "aiRunCost", label: "AI run cost" },
  { key: "activeUsers", label: "Active users", int: true },
  { key: "eligibleUsers", label: "Eligible users", int: true },
];

function nextMonth(series: Measurement[]) {
  const last = series[series.length - 1]?.month;
  const d = last ? new Date(`${last}-01T00:00:00Z`) : new Date();
  if (last) d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
}

export function MeasurementEditor({ initiativeId, series, canEdit }: { initiativeId: string; series: Measurement[]; canEdit: boolean }) {
  const last = series[series.length - 1];
  const blank: Measurement = last ? { ...last, month: nextMonth(series) } : { month: nextMonth(series), phase: "PILOT", volume: 0, adoptionRate: 0, automationRate: 0, avgHandlingMinutes: 0, cycleTimeHours: 0, errorRate: 0, reworkRate: 0, aiRunCost: 0, activeUsers: 0, eligibleUsers: 0 };
  const [draft, setDraft] = useState<Measurement | null>(null);
  const { pending, msg, run } = useAction();
  const del = useAction();
  const show = (m: Measurement, k: (typeof M_FIELDS)[number]) => (k.pct ? Math.round((m[k.key] as number) * 1000) / 10 : (m[k.key] as number));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
              <th className="py-1.5 pr-2">Month</th>
              <th className="pr-2">Phase</th>
              {M_FIELDS.map((k) => (
                <th key={k.key} className="pr-2 text-right">
                  {k.label}
                </th>
              ))}
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {series.map((m) => (
              <tr key={m.month} className="border-b">
                <td className="py-1 pr-2 font-medium">{m.month}</td>
                <td className="pr-2 text-muted-foreground">{pretty(m.phase)}</td>
                {M_FIELDS.map((k) => (
                  <td key={k.key} className="pr-2 text-right tabular">
                    {show(m, k).toLocaleString()}
                  </td>
                ))}
                {canEdit && (
                  <td className="whitespace-nowrap text-right">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${m.month}`} onClick={() => setDraft({ ...m })}>
                      <Pencil />
                    </Button>
                    <ConfirmButton disabled={del.pending} confirmText="Delete?" onConfirm={() => del.run(() => deleteMeasurementAction(initiativeId, m.month), `${m.month} deleted.`)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete {m.month}</span>
                    </ConfirmButton>
                  </td>
                )}
              </tr>
            ))}
            {series.length === 0 && (
              <tr>
                <td colSpan={M_FIELDS.length + 3} className="py-4 text-center text-muted-foreground">
                  No monthly measurements yet — add a month below, import a file, or push via the API.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <StatusText msg={del.msg} />
      {canEdit && !draft && (
        <Button size="sm" variant="outline" onClick={() => setDraft(blank)}>
          <Plus /> Add month
        </Button>
      )}
      {canEdit && draft && (
        <form
          className="space-y-2 rounded-md border bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveMeasurementAction(initiativeId, draft), `${draft.month} saved.`, () => setDraft(null));
          }}
        >
          <div className="grid gap-2 sm:grid-cols-6">
            <Field label="Month" htmlFor="m-month">
              <Input id="m-month" type="month" className="h-8 text-xs" value={draft.month} onChange={(e) => setDraft({ ...draft, month: e.target.value })} />
            </Field>
            <Field label="Phase" htmlFor="m-phase">
              <NativeSelect id="m-phase" className="h-8 text-xs" value={draft.phase} onChange={(e) => setDraft({ ...draft, phase: e.target.value as Measurement["phase"] })}>
                {["BASELINE", "PILOT", "ROLLOUT", "STEADY_STATE"].map((p) => (
                  <option key={p} value={p}>
                    {pretty(p)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {M_FIELDS.map((k) => (
              <Field key={k.key} label={k.label} htmlFor={`m-${k.key}`}>
                <Input
                  id={`m-${k.key}`}
                  className="h-8 text-xs"
                  type="number"
                  min={0}
                  max={k.pct ? 100 : undefined}
                  step={k.int ? 1 : "any"}
                  value={show(draft, k)}
                  onChange={(e) => setDraft({ ...draft, [k.key]: k.pct ? num(e.target.value) / 100 : num(e.target.value) })}
                />
              </Field>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Save month
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <StatusText msg={msg} />
          </div>
        </form>
      )}
    </div>
  );
}
