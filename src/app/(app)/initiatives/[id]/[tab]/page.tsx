import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileText } from "lucide-react";
import { evaluateOne } from "@/lib/services/portfolio-service";
import { comparisonRows, buildValueTree } from "@/lib/services/initiative-vm";
import { ladderWaterfall, VS_HEX } from "@/lib/services/view-models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { INITIATIVE_TABS } from "@/components/initiative/tabs";
import { LifecycleStepper } from "@/components/initiative/lifecycle";
import { SnapshotEditor } from "@/components/initiative/snapshot-editor";
import { BenefitActions } from "@/components/initiative/benefit-actions";
import { CostEditor, DispositionEditor, ScenarioWorkbench } from "@/components/initiative/editors";
import { AgentEditor } from "@/components/initiative/agent-editor";
import { AssumptionsEditor, BusinessCaseEditor, DeclaredBenefitEditor, DeleteActualSnapshot, DeleteAgent, DeleteBenefit, KpiValuesEditor, LeakageNotesEditor, MeasurementEditor } from "@/components/initiative/crud-editors";
import { SectionCard } from "@/components/value/page-header";
import { KpiCard } from "@/components/value/kpi-card";
import { ExplainButton } from "@/components/value/explain";
import { ValueTree } from "@/components/value/value-tree";
import { AgentFlow } from "@/components/value/agent-flow";
import { ComparisonTable } from "@/components/value/comparison-table";
import { ConfidenceBadge, IllustrativeBadge, NatureBadge, StatusBadge, ValueStateLegend } from "@/components/value/badges";
import { BarsChart, TrendChart, WaterfallChart } from "@/components/charts/charts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState, Progress } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, CLASS_LABEL, MODE_LABEL, STAGE_GATE, STAGE_LABEL } from "@/lib/domain/labels";
import { EVIDENCE_LABEL, countsInRoi, escalationSensitivity, computeRoi } from "@/lib/value-engine";
import { fmtMetric, monthLabel, money, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function InitiativeTab({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const { id, tab } = await params;
  if (!INITIATIVE_TABS.some(([s]) => s === tab)) notFound();
  const r = await evaluateOne(id);
  if (!r) notFound();
  const session = await getSession();
  const { portfolio: p, init, value: v } = r;
  const basis = p.settings.roiBasis;

  switch (tab) {
    // -----------------------------------------------------------------------
    case "overview": {
      const sc = v.scorecard;
      return (
        <div className="space-y-4">
          <SectionCard title="Value realization lifecycle" description={`Current stage: ${STAGE_LABEL[init.stage]}. Gate to exit: ${STAGE_GATE[init.stage]}.`}>
            <LifecycleStepper stage={init.stage} />
          </SectionCard>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Gross benefit / yr" value={money(v.totals.counted)} metric={v.roi.grossAnnualBenefit} state={v.isForecast ? "forecast" : "actual"} />
            <KpiCard label="Finance-validated / yr" value={money(v.leakage.ladder.FINANCE_VALIDATED)} state="validated" />
            <KpiCard label="Net benefit / yr" value={fmtMetric(v.roi.netAnnualBenefit)} metric={v.roi.netAnnualBenefit} state={v.isForecast ? "forecast" : "actual"} />
            <KpiCard label="FTE capacity released" value={fmtMetric(v.capacity.fteCapacityReleased)} metric={v.capacity.fteCapacityReleased} sub="capacity ≠ cash" state={v.isForecast ? "forecast" : "actual"} />
            <KpiCard label="Productivity uplift" value={fmtMetric(v.productivity.uplift, 0)} metric={v.productivity.uplift} state={v.isForecast ? "forecast" : "actual"} />
            <KpiCard label="NPV" value={fmtMetric(v.roi.npv)} metric={v.roi.npv} sub={`@ ${pct(p.settings.discountRate)} discount`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Value tree" description="Trace every financial outcome back to operational drivers and agents. Expand nodes; click ⓘ for the calculation.">
              <ValueTree root={buildValueTree(init, v, basis)} />
            </SectionCard>
            <SectionCard
              title="AI value scorecard"
              description="Each dimension = actual achievement vs business-case plan (100 = plan met, capped at 120). No black-box scoring."
              actions={sc.composite !== null ? <span className="text-sm font-semibold tabular">Composite {sc.composite.toFixed(0)}/100</span> : undefined}
            >
              <div className="space-y-2.5">
                {sc.dimensions.map((d) => (
                  <div key={d.key} className={cn("space-y-1", !d.available && "opacity-50")}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">
                        {d.label} <span className="font-normal text-muted-foreground">· weight {d.weight}</span>
                      </span>
                      <span className="tabular">{d.available ? `${Math.min(d.score, 120).toFixed(0)}` : "no data"}</span>
                    </div>
                    <Progress value={d.available ? Math.min(100, d.score) : 0} indicatorClassName={d.score >= 90 ? "bg-[#1baf7a]" : d.score >= 70 ? "bg-[#eda100]" : "bg-[#d03b3b]"} label={d.label} />
                    <p className="text-[11px] text-muted-foreground">
                      Actual {d.actual} vs plan {d.target} — {d.basis}
                    </p>
                  </div>
                ))}
                <p className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">{sc.compositeExplanation} Weights are configurable in Settings.</p>
              </div>
            </SectionCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="About" className="lg:col-span-2">
              <p className="text-sm">{init.description}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                {[
                  ["Use case", init.useCase],
                  ["Business owner", init.owner],
                  ["AI product owner", init.productOwner],
                  ["Finance validator", init.financeValidator || "—"],
                  ["Country", init.country],
                  ["Go-live", init.goLiveDate ?? "Not yet"],
                  ["Complexity", `${init.complexity}/5`],
                  ["Strategic alignment", `${init.strategicAlignment}/5`],
                  ["Risk", init.riskLevel.toLowerCase()],
                ].map(([k, val]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{val}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
            <SectionCard title="Top-down cross-check" description="Realized = Potential × Adoption × Performance × Attribution">
              <p className="text-2xl font-semibold tabular">
                {fmtMetric(v.realizedModel)} <ExplainButton metric={v.realizedModel} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                vs bottom-up run-rate {money(v.leakage.ladder.CURRENT_RUN_RATE)}. Performance vs target: {pct(v.performanceVsTarget)}. Large differences point to non-linear effects or data gaps.
              </p>
            </SectionCard>
          </div>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "business-case": {
      const bcRoi = computeRoi({
        annualBenefit: v.leakage.ladder.BUSINESS_CASE,
        oneTimeInvestment: init.businessCase.approvedInvestment || v.tco.oneTime.value,
        recurringAnnualCost: v.tco.recurring.value,
        discountRate: p.settings.discountRate,
        horizonYears: init.businessCase.horizonYears,
        rampUp: p.settings.rampUp,
      });
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiCard label="Potential value / yr" value={money(v.leakage.ladder.POTENTIAL)} state="forecast" sub="target at 100% adoption" />
            <KpiCard label="Business-case value / yr" value={money(v.leakage.ladder.BUSINESS_CASE)} state="target" sub={`planned adoption ${pct(init.businessCase.plannedAdoption)}`} />
            <KpiCard label="Approved investment" value={money(init.businessCase.approvedInvestment)} sub={`actual ${money(v.tco.oneTime.value)}`} />
            <KpiCard label="Business-case ROI" value={fmtMetric(bcRoi.roi, 0)} metric={bcRoi.roi} state="target" />
            <KpiCard label="Business-case NPV" value={fmtMetric(bcRoi.npv)} metric={bcRoi.npv} state="target" />
            <KpiCard label="Business-case payback" value={fmtMetric(bcRoi.paybackMonths)} metric={bcRoi.paybackMonths} state="target" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Case for change" actions={can(session, "initiative:edit") ? <BusinessCaseEditor initiativeId={init.id} bc={init.businessCase} /> : undefined}>
              <p className="text-sm">{init.businessCase.problemStatement}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {init.businessCase.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Sponsor {init.businessCase.sponsor} · {init.businessCase.approvedDate ? `Approved ${init.businessCase.approvedDate} by ${init.businessCase.approvedBy}` : "Not yet approved"} · Horizon {init.businessCase.horizonYears} years
              </p>
            </SectionCard>
            <SectionCard title="Assumptions register" description="Every assumption used in the calculations, with owner.">
              {can(session, "initiative:edit") && <div className="mb-3"><AssumptionsEditor key={JSON.stringify(init.assumptions)} initiativeId={init.id} items={init.assumptions} owner={session.name} /></div>}
              <Table>
                <THead>
                  <TR>
                    <TH>Assumption</TH>
                    <TH>Value</TH>
                    <TH>Owner</TH>
                  </TR>
                </THead>
                <TBody>
                  {!can(session, "initiative:edit") && init.assumptions.map((a) => (
                    <TR key={a.id}>
                      <TD>
                        <p className="font-medium">{a.label}</p>
                        <p className="text-[11px] text-muted-foreground">{a.rationale}</p>
                      </TD>
                      <TD>{a.value}</TD>
                      <TD className="text-muted-foreground">{a.owner}</TD>
                    </TR>
                  ))}
                  <TR>
                    <TD>
                      <p className="font-medium">Discount rate · ROI basis · ramp-up</p>
                      <p className="text-[11px] text-muted-foreground">Portfolio settings</p>
                    </TD>
                    <TD>
                      {pct(p.settings.discountRate)} · {basis.replaceAll("_", " ").toLowerCase()} · {p.settings.rampUp.map((x) => pct(x)).join("/")}
                    </TD>
                    <TD className="text-muted-foreground">AI Value Office</TD>
                  </TR>
                </TBody>
              </Table>
            </SectionCard>
          </div>
          <SectionCard title="Business-case cash-flow schedule" description="Forecast using approved targets and planned adoption (not measured values).">
            <Table>
              <THead>
                <TR>
                  <TH>Year</TH>
                  <TH className="text-right">Benefit</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Net</TH>
                  <TH className="text-right">Discounted net</TH>
                  <TH className="text-right">Cumulative</TH>
                </TR>
              </THead>
              <TBody>
                {bcRoi.schedule.slice(0, init.businessCase.horizonYears + 1).map((y) => (
                  <TR key={y.year}>
                    <TD>Y{y.year}</TD>
                    <TD className="text-right">{money(y.benefit)}</TD>
                    <TD className="text-right">{money(y.cost)}</TD>
                    <TD className="text-right font-medium">{money(y.net)}</TD>
                    <TD className="text-right">{money(y.discountedNet)}</TD>
                    <TD className={cn("text-right", y.cumulative < 0 ? "text-red-700" : "text-[#006300]")}>{money(y.cumulative)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </SectionCard>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "process": {
      const root = p.processes.find((x) => x.id === init.processId);
      if (!root) return <EmptyState title="Process not found" description="The process this initiative was attached to was removed. Edit the initiative details to choose another process." />;
      const parentChain: typeof p.processes = [];
      let cur = root;
      while (cur?.parentId) {
        const par = p.processes.find((x) => x.id === cur.parentId);
        if (!par) break;
        parentChain.unshift(par);
        cur = par;
      }
      const children = (pid: string, depth: number): { node: (typeof p.processes)[number]; depth: number }[] =>
        p.processes.filter((x) => x.parentId === pid).flatMap((n) => [{ node: n, depth }, ...children(n.id, depth + 1)]);
      const rows = [{ node: root, depth: 0 }, ...children(root.id, 1)];
      const fn = p.functions.find((f) => f.id === init.functionId);
      const org = p.organizations.find((o) => o.id === init.organizationId);
      const bu = p.businessUnits.find((b) => b.id === init.businessUnitId);
      const ind = p.industries.find((i) => i.id === org?.industryId);
      return (
        <div className="space-y-4">
          <SectionCard title="Process hierarchy" description="Enterprise → Industry → Business Unit → Function → Process → Sub-process → Activity → Task → AI Agent">
            <p className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {[org?.name, ind?.name, bu?.name, fn?.name, ...parentChain.map((x) => x.name)].filter(Boolean).map((x, i) => (
                <span key={i}>
                  {x} <span className="mx-0.5">›</span>
                </span>
              ))}
              <span className="font-medium text-foreground">{root.name}</span>
            </p>
            <Table>
              <THead>
                <TR>
                  <TH>Node</TH>
                  <TH>Level</TH>
                  <TH>Execution mode</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ node, depth }) => (
                  <TR key={node.id}>
                    <TD style={{ paddingLeft: 12 + depth * 20 }} className={depth === 0 ? "font-semibold" : ""}>
                      {node.name}
                    </TD>
                    <TD className="text-muted-foreground">{node.level.toLowerCase()}</TD>
                    <TD>
                      <span className="rounded border px-1.5 py-0.5 text-[11px]">{MODE_LABEL[node.automationMode]}</span>
                    </TD>
                  </TR>
                ))}
                {init.agents.map((a) => (
                  <TR key={a.id}>
                    <TD style={{ paddingLeft: 12 + (rows.length > 1 ? 2 : 1) * 20 }} className="text-[#4a3aa7]">
                      🤖 {a.name}
                    </TD>
                    <TD className="text-muted-foreground">AI agent</TD>
                    <TD>
                      <span className="rounded border px-1.5 py-0.5 text-[11px]">{MODE_LABEL[a.humanInLoopModel]}</span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </SectionCard>
          <SectionCard title="Agentic process flow">
            <AgentFlow agents={init.agents} />
          </SectionCard>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "baseline": {
      const recon = v.capacity.reconciliation;
      return (
        <div className="space-y-4">
          {recon.status !== "OK" && (
            <div className={cn("flex gap-2 rounded-lg border p-3 text-xs", recon.status === "FAIL" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900")}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Baseline reconciliation: {recon.status}</p>
                <p>{recon.message}</p>
                <p className="mt-1">Current labour basis: {init.laborBasis === "FTE_CALIBRATED" ? "FTE-calibrated (hours scaled to reported FTE)" : "Activity-based"}.</p>
              </div>
            </div>
          )}
          <SectionCard title="Baseline assessment" description="Capture the process before AI. The same KPI set is re-captured after implementation.">
            <SnapshotEditor
              initiativeId={init.id}
              kind="BASELINE"
              initial={init.baseline}
              baseline={init.baseline.metrics}
              productiveHours={init.productiveHoursPerFte}
              laborBasis={init.laborBasis}
              canEdit={can(session, "measurement:edit")}
              defaultOwner={init.owner}
            />
          </SectionCard>
          <SectionCard title="Process-specific KPIs" description="Baseline, target and post-AI values for KPIs defined in Administration.">
            {init.kpis.length > 0 && <KpiTable init={init} kpis={p.kpis} />}
            {can(session, "measurement:edit") ? (
              <div className={init.kpis.length ? "mt-4 border-t pt-3" : ""}>
                <KpiValuesEditor key={JSON.stringify(init.kpis)} initiativeId={init.id} items={init.kpis} kpis={p.kpis} />
              </div>
            ) : (
              init.kpis.length === 0 && <p className="text-xs text-muted-foreground">No process-specific KPIs.</p>
            )}
          </SectionCard>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "intervention": {
      return (
        <div className="space-y-4">
          <SectionCard title="Agentic process flow" description="Multiple agents in one workflow, in execution order." actions={can(session, "initiative:edit") ? <AgentEditor initiativeId={init.id} modelPrices={p.modelPrices} /> : undefined}>
            <AgentFlow agents={init.agents} />
          </SectionCard>
          <SectionCard title="AI intervention design">
            <Table>
              <THead>
                <TR>
                  <TH>Agent</TH>
                  <TH>Technology / model</TH>
                  <TH>Human-in-loop</TH>
                  <TH>Tasks automated</TH>
                  <TH>Tasks augmented</TH>
                  <TH className="text-right">Automation</TH>
                  <TH>Deployed</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {init.agents.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <p className="font-medium">{a.name}</p>
                      <p className="max-w-xs text-[11px] text-muted-foreground">{a.description}</p>
                    </TD>
                    <TD className="text-xs">
                      {a.technology}
                      <br />
                      <span className="text-muted-foreground">{p.modelPrices.find((m) => m.id === a.modelPriceId)?.tier ?? "—"}</span>
                    </TD>
                    <TD className="text-xs">{MODE_LABEL[a.humanInLoopModel]}</TD>
                    <TD className="text-xs">{a.tasksAutomated.join(", ") || "—"}</TD>
                    <TD className="text-xs">{a.tasksAugmented.join(", ") || "—"}</TD>
                    <TD className="text-right">{pct(a.automationPct)}</TD>
                    <TD className="text-xs">
                      {a.deploymentDate} <span className="text-muted-foreground">({a.status.toLowerCase()})</span>
                    </TD>
                    <TD className="whitespace-nowrap">{can(session, "initiative:edit") && <><AgentEditor initiativeId={init.id} modelPrices={p.modelPrices} agent={a} /><DeleteAgent initiativeId={init.id} agentId={a.id} /></>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {init.agents.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">No AI agents defined yet. Use “Add agent” above to describe each agent in the workflow.</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              Use case: {init.useCase} · Adoption {pct(v.post.adoptionRate)} of eligible volume · {num(v.post.transactionsPerYear)} transactions / yr · {v.adoption.eligibleUsers} eligible users
            </p>
          </SectionCard>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "post-ai": {
      const series = v.monthly.map((m) => ({ month: monthLabel(m.month), aht: m.ahtMinutes, cycle: m.cycleTimeHours, err: m.errorRate, adoption: m.adoption, productivity: m.productivityIndex }));
      const bench = p.benchmarks.filter((b) => b.functionId === init.functionId);
      return (
        <div className="space-y-4">
          {init.actual ? (
            <>
              <SectionCard
                title="Before AI vs after AI"
                description="Same KPI definitions as baseline. Improvements computed by the value engine."
                actions={bench.length ? <IllustrativeBadge text="Benchmarks illustrative" /> : undefined}
              >
                <ComparisonTable rows={comparisonRows(init, v, bench)} showBenchmark={bench.length > 0} />
              </SectionCard>
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Before / after (%)">
                  <BarsChart
                    data={[
                      { name: "Error rate", Baseline: init.baseline.metrics.errorRate, Target: init.target.metrics.errorRate, "Post-AI": v.post.errorRate },
                      { name: "Rework rate", Baseline: init.baseline.metrics.reworkRate, Target: init.target.metrics.reworkRate, "Post-AI": v.post.reworkRate },
                      { name: "SLA", Baseline: init.baseline.metrics.slaAchievement, Target: init.target.metrics.slaAchievement, "Post-AI": v.post.slaAchievement },
                      { name: "First-time-right", Baseline: init.baseline.metrics.firstTimeRight, Target: init.target.metrics.firstTimeRight, "Post-AI": v.post.firstTimeRight },
                    ]}
                    xKey="name"
                    fmt="percent"
                    series={[
                      { key: "Baseline", label: "Baseline", color: "#898781" },
                      { key: "Target", label: "Target", color: VS_HEX.target },
                      { key: "Post-AI", label: "Post-AI actual", color: VS_HEX.actual },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Handling time trend (min)" description="Monthly measurements — value evolves with adoption.">
                  <TrendChart data={series} xKey="month" fmt="minutes" series={[{ key: "aht", label: "AHT (min)", color: VS_HEX.actual }]} refX={init.goLiveDate ? { x: monthLabel(init.goLiveDate.slice(0, 7)), label: "Go-live" } : undefined} />
                </SectionCard>
                <SectionCard title="Cycle-time trend (hours)">
                  <TrendChart data={series} xKey="month" fmt="hours" series={[{ key: "cycle", label: "Cycle time (h)", color: "#eb6834" }]} />
                </SectionCard>
                <SectionCard title="Quality trend (error rate)">
                  <TrendChart data={series} xKey="month" fmt="percent" series={[{ key: "err", label: "Error rate", color: "#d03b3b" }]} />
                </SectionCard>
              </div>
            </>
          ) : (
            <EmptyState title="No post-AI measurement yet" description="Capture the same KPIs after go-live. Until then, all value remains forecast." />
          )}
          <SectionCard
            title={init.actual ? "Update post-AI measurement" : "Capture post-AI measurement"}
            description="Post-AI values are blended across AI and non-AI volume at the measured adoption rate."
            actions={init.actual && can(session, "measurement:edit") ? <DeleteActualSnapshot initiativeId={init.id} /> : undefined}
          >
            <SnapshotEditor
              initiativeId={init.id}
              kind="ACTUAL"
              initial={init.actual}
              baseline={init.baseline.metrics}
              productiveHours={init.productiveHoursPerFte}
              laborBasis={init.laborBasis}
              canEdit={can(session, "measurement:edit")}
              defaultOwner={init.owner}
            />
          </SectionCard>
          <SectionCard title="Monthly measurements" description="Time series that drives trends, realized value and adoption curves. Enter here, import CSV/Excel, or push via the ingestion API.">
            <MeasurementEditor key={init.series.map((m) => m.month).join()} initiativeId={init.id} series={init.series} canEdit={can(session, "measurement:edit")} />
          </SectionCard>
          {init.kpis.length > 0 && (
            <SectionCard title="Process-specific KPIs">
              <KpiTable init={init} kpis={p.kpis} />
            </SectionCard>
          )}
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "value": {
      const canSubmit = can(session, "benefit:submit");
      const fin = v.benefits.filter((b) => b.benefit.financialClass !== "NON_FINANCIAL");
      const intangible = v.benefits.filter((b) => b.benefit.financialClass === "NON_FINANCIAL");
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Hours released / yr" value={fmtMetric(v.capacity.hoursReleased)} metric={v.capacity.hoursReleased} />
            <KpiCard label="FTE capacity equivalent" value={fmtMetric(v.capacity.fteCapacityReleased)} metric={v.capacity.fteCapacityReleased} />
            <KpiCard label="Cashable savings" value={money(v.totals.byClass.CASHABLE)} sub="attributed / yr" state={v.isForecast ? "forecast" : "actual"} />
            <KpiCard label="Cost avoidance" value={money(v.totals.byClass.COST_AVOIDANCE)} sub="attributed / yr" state={v.isForecast ? "forecast" : "actual"} />
            <KpiCard label="Redeployed capacity" value={money(v.totals.byClass.CAPACITY)} sub="economic value, not cash" />
            <KpiCard label="Measured vs estimated" value={`${money(v.totals.measured)} / ${money(v.totals.estimated)}`} sub={`${v.totals.intangibleCount} intangible line(s)`} />
          </div>
          <SectionCard
            title="Benefit register"
            description="Measured, estimated and intangible value kept separate. Governance status gates where each line appears on the value ladder."
            actions={
              <div className="flex items-center gap-2">
                {canSubmit && <DeclaredBenefitEditor initiativeId={init.id} owner={init.owner} />}
                <ConfidenceBadge level={v.confidence} />
              </div>
            }
          >
            <Table>
              <THead>
                <TR>
                  <TH>Benefit</TH>
                  <TH>Class</TH>
                  <TH>Nature</TH>
                  <TH className="text-right">Gross / yr</TH>
                  <TH className="text-right">Attribution</TH>
                  <TH className="text-right">AI-attributed</TH>
                  <TH>Evidence</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Governance</TH>
                </TR>
              </THead>
              <TBody>
                {fin.map((b) => {
                  const dc = v.benefitConfidence[b.benefit.id];
                  const counted = countsInRoi(b.benefit.financialClass, basis);
                  return (
                    <TR key={b.benefit.id}>
                      <TD>
                        <p className="font-medium">{b.benefit.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {CATEGORY_LABEL[b.benefit.category]} · {b.benefit.source.kind === "DERIVED" ? "calculated from process metrics" : "owner-declared"}
                          {!counted && " · not counted in ROI"}
                        </p>
                      </TD>
                      <TD className="text-xs">{CLASS_LABEL[b.benefit.financialClass]}</TD>
                      <TD>
                        <NatureBadge nature={b.effectiveNature} />
                      </TD>
                      <TD className="text-right">{money(b.gross)}</TD>
                      <TD className="text-right">
                        {pct(b.attributionPct)}
                        <br />
                        <span className="text-[10px] text-muted-foreground">{b.benefit.confidence.toLowerCase()}</span>
                      </TD>
                      <TD className={cn("text-right font-semibold", !counted && "text-muted-foreground")}>
                        <span className="inline-flex items-center gap-1">
                          {money(b.attributed)} <ExplainButton metric={b.metric} />
                        </span>
                      </TD>
                      <TD>
                        {dc && <ConfidenceBadge level={dc.level} compact />}
                        <p className="text-[10px] text-muted-foreground">{b.benefit.evidence.length} item(s)</p>
                      </TD>
                      <TD>
                        <StatusBadge status={b.benefit.status} />
                      </TD>
                      <TD>
                        <BenefitActions
                          benefitId={b.benefit.id}
                          status={b.benefit.status}
                          role={session.role}
                          steps={p.settings.governance}
                          evidenceCount={b.benefit.evidence.length}
                          attributionPct={b.benefit.attributionPct}
                          confidence={b.benefit.confidence}
                          canSubmit={canSubmit}
                        />
                        {canSubmit && (
                          <div className="mt-1 flex justify-end gap-1">
                            {b.benefit.source.kind === "DECLARED" && b.benefit.status === "PROPOSED" && <DeclaredBenefitEditor initiativeId={init.id} owner={init.owner} benefit={b.benefit} />}
                            {["PROPOSED", "MEASURED"].includes(b.benefit.status) && <DeleteBenefit initiativeId={init.id} benefitId={b.benefit.id} />}
                          </div>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            {intangible.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="eyebrow">Intangible value — tracked, never monetised</p>
                {intangible.map((b) => (
                  <div key={b.benefit.id} className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs">
                    <NatureBadge nature="INTANGIBLE" />
                    <span className="font-medium">{b.benefit.name}</span>
                    <span className="text-muted-foreground">{CATEGORY_LABEL[b.benefit.category]}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <StatusBadge status={b.benefit.status} />
                      {canSubmit && b.benefit.source.kind === "DECLARED" && b.benefit.status === "PROPOSED" && <DeclaredBenefitEditor initiativeId={init.id} owner={init.owner} benefit={b.benefit} />}
                      {canSubmit && ["PROPOSED", "MEASURED"].includes(b.benefit.status) && <DeleteBenefit initiativeId={init.id} benefitId={b.benefit.id} />}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Capacity released vs cashable savings" description="Released capacity is only money when the business commits to what happens to it.">
              <DispositionEditor
                initiativeId={init.id}
                initial={init.disposition}
                hoursReleased={v.capacity.hoursReleased.value}
                productiveHours={init.productiveHoursPerFte}
                hourlyCost={v.capacity.hourlyCost}
                canEdit={can(session, "initiative:edit")}
              />
            </SectionCard>
            <SectionCard title="Value ladder for this initiative" q="leakage" actions={<ValueStateLegend />}>
              <WaterfallChart steps={ladderWaterfall(v.leakage.ladder, v.leakage.byCause)} height={300} />
              {v.leakage.qualitative.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="eyebrow">Owner-identified leakage causes (qualitative, not additive)</p>
                  {v.leakage.qualitative.map((n) => (
                    <p key={n.id} className="text-xs">
                      <span className="font-medium">{n.cause.replaceAll("_", " ").toLowerCase()}:</span> {n.description}
                      {n.estimatedAnnualImpact ? <span className="text-muted-foreground"> (~{money(n.estimatedAnnualImpact)} est.)</span> : null}
                    </p>
                  ))}
                </div>
              )}
              {can(session, "initiative:edit") && (
                <details className="mt-3 rounded-md border p-2">
                  <summary className="cursor-pointer text-xs font-medium">Record leakage causes</summary>
                  <div className="mt-2">
                    <LeakageNotesEditor key={JSON.stringify(init.leakageNotes)} initiativeId={init.id} items={init.leakageNotes} owner={session.name} />
                  </div>
                </details>
              )}
            </SectionCard>
          </div>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "costs": {
      const cats = (["IMPLEMENTATION", "TECHNOLOGY", "OPERATING"] as const).map((c) => ({ name: c.charAt(0) + c.slice(1).toLowerCase(), oneTime: v.tco.byCategory[c].oneTime, recurring: v.tco.byCategory[c].recurring }));
      const roi = v.roi;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <KpiCard label="One-time investment" value={fmtMetric(v.tco.oneTime)} metric={v.tco.oneTime} />
            <KpiCard label="Recurring AI cost / yr" value={fmtMetric(v.tco.recurring)} metric={v.tco.recurring} />
            <KpiCard label={`TCO (${init.businessCase.horizonYears}-yr)`} value={money(v.tco.tcoOverHorizon(init.businessCase.horizonYears))} />
            <KpiCard label="ROI" value={fmtMetric(roi.roi, 0)} metric={roi.roi} state={v.isForecast ? "forecast" : "actual"} />
            <KpiCard label="NPV" value={fmtMetric(roi.npv)} metric={roi.npv} />
            <KpiCard label="IRR" value={fmtMetric(roi.irr, 0)} metric={roi.irr} />
            <KpiCard label="Payback" value={fmtMetric(roi.paybackMonths)} metric={roi.paybackMonths} sub={`ramp-adjusted ${fmtMetric(roi.cumulativePaybackMonths)}`} />
            <KpiCard label="Benefit-cost ratio" value={fmtMetric(roi.benefitCostRatio)} metric={roi.benefitCostRatio} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <SectionCard title="AI investment / TCO" description="One-time vs recurring, by category. LLM token cost is derived from agent telemetry × configured model prices.">
              <CostEditor initiativeId={init.id} costs={init.costs} canEdit={can(session, "cost:edit")} />
              {v.tco.derivedLlmAnnual > 0 && (
                <p className="mt-2 text-xs">
                  + Derived <strong>LLM/API tokens</strong>: {money(v.tco.derivedLlmAnnual)} / yr <IllustrativeBadge text="Illustrative model prices" />
                </p>
              )}
            </SectionCard>
            <SectionCard title="Cost by category">
              <BarsChart data={cats} xKey="name" series={[{ key: "oneTime", label: "One-time", color: "#898781" }, { key: "recurring", label: "Recurring / yr", color: "#e34948" }]} height={240} />
            </SectionCard>
          </div>
          <SectionCard title="ROI engine — cash-flow schedule" description={`ROI basis: ${basis.replaceAll("_", " ").toLowerCase()}. Discount rate ${pct(p.settings.discountRate)}.`}>
            <Table>
              <THead>
                <TR>
                  <TH>Year</TH>
                  <TH className="text-right">Benefit</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Net cash flow</TH>
                  <TH className="text-right">Discounted</TH>
                  <TH className="text-right">Cumulative</TH>
                </TR>
              </THead>
              <TBody>
                {roi.schedule.map((y) => (
                  <TR key={y.year} className={y.year > init.businessCase.horizonYears ? "text-muted-foreground" : ""}>
                    <TD>Y{y.year}{y.year > init.businessCase.horizonYears ? " (beyond horizon)" : ""}</TD>
                    <TD className="text-right">{money(y.benefit)}</TD>
                    <TD className="text-right">{money(y.cost)}</TD>
                    <TD className="text-right font-medium">{money(y.net)}</TD>
                    <TD className="text-right">{money(y.discountedNet)}</TD>
                    <TD className={cn("text-right", y.cumulative < 0 ? "text-red-700" : "text-[#006300]")}>{money(y.cumulative)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              3-year value {money(roi.value3y.value)} (NPV {money(roi.npv3y)}) · 5-year value {money(roi.value5y.value)} (NPV {money(roi.npv5y)}). ROI by basis — cashable only:{" "}
              {v.roiByBasis.cashableOnly !== null ? pct(v.roiByBasis.cashableOnly) : "n/a"}; cashable + avoidance: {v.roiByBasis.cashableAndAvoidance !== null ? pct(v.roiByBasis.cashableAndAvoidance) : "n/a"}; all financial:{" "}
              {v.roiByBasis.allFinancial !== null ? pct(v.roiByBasis.allFinancial) : "n/a"}.
            </p>
          </SectionCard>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "adoption": {
      const a = v.adoption;
      const series = v.monthly.map((m) => ({ month: monthLabel(m.month), adoption: m.adoption, automation: m.automation, benefit: m.financialBenefit, aiCost: m.aiRunCost, roi: m.cumulativeRoi }));
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <KpiCard label="Eligible users" value={num(a.eligibleUsers)} />
            <KpiCard label="Monthly active users" value={num(a.activeUsers)} />
            <KpiCard label="User adoption" value={fmtMetric(a.userAdoption, 0)} metric={a.userAdoption} />
            <KpiCard label="Transaction adoption" value={fmtMetric(a.transactionAdoption, 0)} metric={a.transactionAdoption} sub={`plan ${pct(init.target.metrics.adoptionRate)}`} />
            <KpiCard label="AI-assisted txns / yr" value={num(a.aiAssistedTransactions)} />
            <KpiCard label="AI-automated txns / yr" value={num(a.aiAutomatedTransactions)} />
            <KpiCard label="AI acceptance rate" value={fmtMetric(a.acceptanceRate, 0)} metric={a.acceptanceRate} />
            <KpiCard label="Human override / escalation" value={`${pct(a.overrideRate)} / ${pct(a.escalationRate)}`} sub={`agent failure ${pct(a.failureRate)}`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Adoption vs benefit" description="Adoption (share) and benefit (currency) shown on separate charts — never a dual axis.">
              <TrendChart data={series} xKey="month" fmt="percent" series={[{ key: "adoption", label: "Adoption", color: VS_HEX.actual }, { key: "automation", label: "Automation", color: "#1baf7a" }]} height={200} />
              <TrendChart data={series} xKey="month" series={[{ key: "benefit", label: "Monthly financial benefit", color: VS_HEX.validated }]} height={180} area />
            </SectionCard>
            <SectionCard title="AI cost vs benefit and ROI trend">
              <TrendChart data={series} xKey="month" series={[{ key: "benefit", label: "Benefit", color: VS_HEX.actual }]} bars={[{ key: "aiCost", label: "AI run cost", color: "#e34948" }]} height={200} />
              <TrendChart data={series} xKey="month" fmt="percent" series={[{ key: "roi", label: "Cumulative ROI (incl. one-time)", color: "#4a3aa7" }]} height={180} />
            </SectionCard>
          </div>
          <SectionCard title="Realized value model" description="Configurable top-down model (Settings).">
            <p className="text-sm">
              Potential {money(v.leakage.ladder.POTENTIAL)} × adoption {pct(v.post.adoptionRate)} × performance {pct(v.performanceVsTarget)} × attribution {pct(v.totals.derivedAttribution)} ={" "}
              <strong>{fmtMetric(v.realizedModel)}</strong> <ExplainButton metric={v.realizedModel} />
            </p>
          </SectionCard>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "agents": {
      return (
        <div className="space-y-4">
          <SectionCard title="Agent performance" description="Operational performance linked to economics. Higher escalation → more human effort → higher cost per outcome → lower realized ROI.">
            {init.agents.length === 0 ? (
              <EmptyState title="No agents" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Agent</TH>
                    <TH className="text-right">Tasks / mo</TH>
                    <TH className="text-right">Completion</TH>
                    <TH className="text-right">Autonomous</TH>
                    <TH className="text-right">Escalation</TH>
                    <TH className="text-right">Override</TH>
                    <TH className="text-right">Error</TH>
                    <TH className="text-right">Halluc. / mo</TH>
                    <TH className="text-right">Tool success</TH>
                    <TH className="text-right">Latency</TH>
                    <TH className="text-right">Tokens / task</TH>
                    <TH className="text-right">AI cost / task</TH>
                    <TH className="text-right">Cost / outcome</TH>
                    <TH className="text-right">Reliability</TH>
                  </TR>
                </THead>
                <TBody>
                  {init.agents.map((a) => {
                    const e = v.agents.find((x) => x.agentId === a.id)!;
                    const pf = a.performance;
                    return (
                      <TR key={a.id}>
                        <TD className="font-medium">{a.name}</TD>
                        <TD className="text-right">{num(pf.tasksPerMonth)}</TD>
                        <TD className="text-right">{pct(pf.taskCompletionRate)}</TD>
                        <TD className={cn("text-right", pf.autonomousCompletionRate < a.automationPct - 0.08 && "text-red-700")}>{pct(pf.autonomousCompletionRate)}</TD>
                        <TD className="text-right">{pct(pf.escalationRate)}</TD>
                        <TD className={cn("text-right", pf.overrideRate > 0.12 && "text-red-700")}>{pct(pf.overrideRate)}</TD>
                        <TD className="text-right">{pct(pf.errorRate, 1)}</TD>
                        <TD className="text-right">{pf.hallucinationEventsPerMonth}</TD>
                        <TD className="text-right">{pct(pf.toolCallSuccessRate)}</TD>
                        <TD className="text-right">{pf.avgLatencySeconds}s</TD>
                        <TD className="text-right">{num(e.tokensPerTask)}</TD>
                        <TD className="text-right">
                          <span className="inline-flex items-center gap-1">
                            {money(e.aiCostPerTask.value, { compact: false })} <ExplainButton metric={e.aiCostPerTask} />
                          </span>
                        </TD>
                        <TD className="text-right">
                          <span className="inline-flex items-center gap-1">
                            {money(e.costPerOutcome.value, { compact: false })} <ExplainButton metric={e.costPerOutcome} />
                          </span>
                        </TD>
                        <TD className="text-right">
                          <span className="inline-flex items-center gap-1">
                            {fmtMetric(e.reliability, 0)} <ExplainButton metric={e.reliability} />
                          </span>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </SectionCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="AI FinOps — model economics" actions={<IllustrativeBadge text="Illustrative prices" />}>
              <Table>
                <THead>
                  <TR>
                    <TH>Agent</TH>
                    <TH>Model tier</TH>
                    <TH className="text-right">Monthly LLM</TH>
                    <TH className="text-right">Annual LLM</TH>
                    <TH className="text-right">Human hrs / mo</TH>
                  </TR>
                </THead>
                <TBody>
                  {v.agents.map((e) => {
                    const a = init.agents.find((x) => x.id === e.agentId)!;
                    return (
                      <TR key={e.agentId}>
                        <TD>{e.agentName}</TD>
                        <TD className="text-xs text-muted-foreground">{p.modelPrices.find((m) => m.id === a.modelPriceId)?.tier ?? "not configured"}</TD>
                        <TD className="text-right">{money(e.monthlyLlmCost.value)}</TD>
                        <TD className="text-right">
                          <span className="inline-flex items-center gap-1">
                            {money(e.annualLlmCost.value)} <ExplainButton metric={e.annualLlmCost} />
                          </span>
                        </TD>
                        <TD className="text-right">
                          <span className="inline-flex items-center gap-1">
                            {num(e.humanHoursPerMonth.value)} <ExplainButton metric={e.humanHoursPerMonth} />
                          </span>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">
                Cost per business process: {money(v.tco.derivedLlmAnnual)} LLM / yr · Cost per transaction (AI run): {money(v.tco.recurring.value / Math.max(1, v.post.transactionsPerYear), { compact: false })}
              </p>
            </SectionCard>
            <SectionCard title="Agent performance → ROI sensitivity" description="Annual human cost added if escalation rises by 10 percentage points, and the resulting net benefit.">
              <Table>
                <THead>
                  <TR>
                    <TH>Agent</TH>
                    <TH className="text-right">Added cost / yr</TH>
                    <TH className="text-right">Net benefit after</TH>
                  </TR>
                </THead>
                <TBody>
                  {init.agents.map((a) => {
                    const add = escalationSensitivity(a, v.capacity.hourlyCost, 0.1) * v.totals.derivedAttribution;
                    return (
                      <TR key={a.id}>
                        <TD>{a.name}</TD>
                        <TD className="text-right text-red-700">−{money(add)}</TD>
                        <TD className="text-right">{money(v.roi.netAnnualBenefit.value - add)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              <p className="mt-2 text-[11px] text-muted-foreground">Formula: tasks/mo × Δescalation × human minutes per escalation ÷ 60 × loaded hourly cost × 12 × attribution.</p>
            </SectionCard>
          </div>
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "evidence": {
      return (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Data confidence is a <strong>rule-based</strong> rating (source quality, measurement frequency, evidence breadth, sample size, finance validation). It is not a statistical confidence level.
          </p>
          {v.benefits.map((b) => {
            const dc = v.benefitConfidence[b.benefit.id];
            return (
              <SectionCard key={b.benefit.id} title={b.benefit.name} actions={<div className="flex items-center gap-2">{dc && <ConfidenceBadge level={dc.level} />}<StatusBadge status={b.benefit.status} /></div>}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    {b.benefit.evidence.length ? (
                      <ul className="space-y-1.5">
                        {b.benefit.evidence.map((e) => (
                          <li key={e.id} className="rounded-md border px-3 py-1.5 text-xs">
                            <span className="font-medium">{EVIDENCE_LABEL[e.type]}</span> — {e.description}
                            <span className="block text-[11px] text-muted-foreground">
                              {e.reference} · {e.providedBy} · {e.date}
                              {e.sampleSize ? ` · n=${e.sampleSize.toLocaleString("en-IN")}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">No evidence attached.</p>
                    )}
                    {b.benefit.history.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="eyebrow">Governance history</p>
                        {b.benefit.history.map((h) => (
                          <p key={h.id} className="text-[11px]">
                            {h.date} · {h.by} ({h.role.replaceAll("_", " ").toLowerCase()}): {h.from.toLowerCase()} → <strong>{h.to.toLowerCase()}</strong> — {h.comment}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {dc && (
                    <div className="space-y-1.5 text-xs">
                      <p className="eyebrow">
                        Confidence basis — {dc.points}/{dc.maxPoints} points
                      </p>
                      {dc.factors.map((f) => (
                        <div key={f.factor} className="flex items-center gap-2">
                          <span className="w-36 shrink-0">{f.factor}</span>
                          <Progress value={(f.points / f.max) * 100} className="w-20" label={f.factor} />
                          <span className="w-8 tabular">
                            {f.points}/{f.max}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{f.basis}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>
            );
          })}
        </div>
      );
    }
    // -----------------------------------------------------------------------
    case "scenarios":
      return (
        <SectionCard title="Scenario analysis" description="Conservative · Expected · Aggressive. Move a slider — ROI recalculates instantly with the same engine.">
          <ScenarioWorkbench init={init} settings={p.settings} modelPrices={p.modelPrices} canEdit={can(session, "scenario:edit")} />
        </SectionCard>
      );
    // -----------------------------------------------------------------------
    case "reports":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["process", "Process Value Report", "Baseline, AI intervention, before/after, financial impact, productivity, quality, adoption and agent metrics."],
            ["cfo", "CFO Validation Report", "Cashable savings, cost avoidance, revenue, investment, ROI, NPV, payback, assumptions and evidence."],
          ].map(([t, name, desc]) => (
            <SectionCard key={t} title={name} description={desc}>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/reports/${t}?initiative=${init.id}`}>
                    <FileText /> Open / print (PDF)
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/export?report=${t}&initiative=${init.id}&format=xlsx`}>Excel</a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/export?report=${t}&initiative=${init.id}&format=csv`}>CSV</a>
                </Button>
              </div>
            </SectionCard>
          ))}
        </div>
      );
    // -----------------------------------------------------------------------
    case "audit": {
      const entries = p.audit.filter((a) => a.initiativeId === init.id);
      return (
        <SectionCard title="Audit trail" description="Every change to measurements, costs, benefits and governance status — who, when, previous and new value.">
          {!can(session, "audit:view") ? (
            <EmptyState title="Not permitted" description="Your role cannot view the audit trail." />
          ) : entries.length === 0 ? (
            <EmptyState title="No audit entries yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Who</TH>
                  <TH>Entity</TH>
                  <TH>Field</TH>
                  <TH>Previous</TH>
                  <TH>New</TH>
                  <TH>Reason</TH>
                </TR>
              </THead>
              <TBody>
                {entries.slice(0, 300).map((e) => (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap text-xs">{e.at.slice(0, 16).replace("T", " ")}</TD>
                    <TD className="text-xs">{e.userName}</TD>
                    <TD className="text-xs text-muted-foreground">{e.entity}</TD>
                    <TD className="text-xs font-medium">{e.field}</TD>
                    <TD className="max-w-[160px] truncate text-xs text-muted-foreground">{e.previous ?? "—"}</TD>
                    <TD className="max-w-[160px] truncate text-xs">{e.next ?? "—"}</TD>
                    <TD className="max-w-[220px] truncate text-xs text-muted-foreground">{e.reason ?? ""}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </SectionCard>
      );
    }
  }
  notFound();
}

function KpiTable({ init, kpis }: { init: import("@/lib/domain/types").Initiative; kpis: import("@/lib/domain/types").KpiDefinition[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>KPI</TH>
          <TH className="text-right">Baseline</TH>
          <TH className="text-right">Target</TH>
          <TH className="text-right">Actual</TH>
          <TH className="text-right">Improvement</TH>
        </TR>
      </THead>
      <TBody>
        {init.kpis.map((k) => {
          const d = kpis.find((x) => x.id === k.kpiId);
          const f = (n: number) => (d?.unit === "%" ? pct(n, 1) : `${n.toLocaleString("en-IN")} ${d?.unit ?? ""}`);
          const imp = k.actual === null ? null : d?.direction === "HIGHER_IS_BETTER" ? (k.actual - k.baseline) / Math.abs(k.baseline || 1) : (k.baseline - k.actual) / Math.abs(k.baseline || 1);
          return (
            <TR key={k.kpiId}>
              <TD>
                <p className="font-medium">{d?.name ?? k.kpiId}</p>
                <p className="text-[11px] text-muted-foreground">{d?.description}</p>
              </TD>
              <TD className="text-right">{f(k.baseline)}</TD>
              <TD className="text-right text-muted-foreground">{f(k.target)}</TD>
              <TD className="text-right font-medium">{k.actual === null ? "—" : f(k.actual)}</TD>
              <TD className={cn("text-right font-semibold", imp !== null && imp > 0 ? "text-[#006300]" : "text-red-700")}>{imp === null ? "—" : pct(imp)}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

