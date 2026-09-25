import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { AlertTriangle, ArrowRight, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { evaluatePortfolio, filterOptions, parseFilters } from "@/lib/services/portfolio-service";
import { buildInsights } from "@/lib/services/insights";
import { ladderWaterfall, VS_HEX } from "@/lib/services/view-models";
import { groupBenefits } from "@/lib/value-engine";
import { fmtMetric, monthLabel, money, pct } from "@/lib/format";
import { FilterBar } from "@/components/value/filter-bar";
import { KpiCard } from "@/components/value/kpi-card";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { ConfidenceBadge, ValueStateLegend } from "@/components/value/badges";
import { BarsChart, TrendChart, WaterfallChart } from "@/components/charts/charts";
import { EmptyState } from "@/components/ui/misc";
import { CLASS_LABEL } from "@/lib/domain/labels";

export const metadata = { title: "Executive Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const { portfolio: p, items, summary: s } = await evaluatePortfolio(filters);
  if (!p.initiatives.length) return <NoInitiatives title="Executive Dashboard" description="Portfolio value, ROI, adoption and leakage across all AI initiatives." canCreate={can(await getSession(), "initiative:edit")} />;
  const options = filterOptions(p);

  if (!items.length)
    return (
      <div className="space-y-4">
        <PageHeader title="Executive Dashboard" />
        <FilterBar options={options} />
        <EmptyState title="No initiatives match these filters" description="Reset filters to see the full portfolio." />
      </div>
    );

  const live = items.filter((e) => e.init.actual);
  const fnName = (id: string) => p.functions.find((f) => f.id === id)?.name ?? id;
  const indName = (id: string) => p.industries.find((i) => i.id === id)?.name ?? id;
  const orgInd = (orgId: string) => p.organizations.find((o) => o.id === orgId)?.industryId ?? "";
  const procName = (id: string) => p.processes.find((x) => x.id === id)?.name ?? id;

  const byFunction = groupBenefits(items, (e) => fnName(e.init.functionId)).map((g) => ({ name: g.key, benefit: g.benefit, validated: g.financeValidated, investment: g.investment + g.recurring }));
  const byIndustry = groupBenefits(items, (e) => indName(orgInd(e.init.organizationId))).map((g) => ({ name: g.key, benefit: g.benefit, validated: g.financeValidated }));
  const byProcess = groupBenefits(live, (e) => procName(e.init.processId)).slice(0, 10).map((g) => ({ name: g.key, benefit: g.benefit }));
  const roiRows = live
    .filter((e) => !e.value.roi.roi.undefinedReason)
    .map((e) => ({ name: e.init.name, roi: e.value.roi.roi.value, color: e.value.roi.roi.value < 0 ? "#d03b3b" : e.value.roi.roi.value < 1 ? "#eda100" : "#2a78d6" }))
    .sort((a, b) => b.roi - a.roi);
  const opsRows = live
    .map((e) => ({ name: e.init.code, productivity: e.value.productivity.uplift.value, cycle: e.value.productivity.cycleTime.value, cost: e.value.cost.reduction.value }))
    .sort((a, b) => b.productivity - a.productivity);
  const monthly = s.monthly.map((m) => ({ month: monthLabel(m.month), realized: m.financialBenefit, planned: m.plannedBenefit, aiCost: m.aiRunCost, adoption: m.adoption, cumulative: m.cumulativeNet }));
  const agents = live
    .flatMap((e) => e.init.agents.map((a) => ({ name: a.name, autonomy: a.performance.autonomousCompletionRate, target: a.automationPct, tasks: a.performance.tasksPerMonth })))
    .sort((a, b) => b.tasks - a.tasks)
    .slice(0, 10);
  const forecastBC = items.filter((e) => !e.init.actual).reduce((a, e) => a + e.value.leakage.ladder.BUSINESS_CASE, 0);
  const leakage = Object.entries(s.leakageByCause)
    .filter(([k, v]) => (v ?? 0) < 0 && !["ADOPTION_HEADROOM"].includes(k))
    .map(([k, v]) => ({ name: k === "AWAITING_VALIDATION" ? "Awaiting validation" : k.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), value: -(v ?? 0) }))
    .sort((a, b) => b.value - a.value);
  const classRows = (["CASHABLE", "COST_AVOIDANCE", "REVENUE", "WORKING_CAPITAL", "RISK_AVOIDANCE", "CAPACITY"] as const).map((c) => ({ name: CLASS_LABEL[c], value: s.byClass[c] ?? 0, color: c === "CAPACITY" ? "#c3c2b7" : VS_HEX.actual }));
  const insights = buildInsights(items).slice(0, 6);

  const roi = s.roi.roi;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Executive view"
        title="Executive Dashboard"
        description="Is AI creating business value? Investment, outcomes, realized and validated value, attribution, leakage and next actions — every figure is traceable to its formula."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Portfolio evidence</span>
            <ConfidenceBadge level={s.confidence} />
          </div>
        }
      />
      <FilterBar options={options} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Total AI investment" value={fmtMetric(s.totalInvestment)} metric={s.totalInvestment} sub={`${money(s.oneTimeInvestment.value)} one-time + ${money(s.recurringCost.value)}/yr run`} />
        <KpiCard label="Gross benefits (annual)" value={fmtMetric(s.grossBenefit)} metric={s.grossBenefit} state="actual" sub={`+ ${money(s.forecastBenefit)} forecast-only`} />
        <KpiCard label="Finance-validated" value={fmtMetric(s.financeValidated)} metric={s.financeValidated} state="validated" sub={`${pct(s.financeValidated.value / Math.max(1, s.grossBenefit.value))} of gross`} />
        <KpiCard label="Net benefits (annual)" value={fmtMetric(s.netBenefit)} metric={s.netBenefit} state="actual" />
        <KpiCard label={`ROI (${p.settings.horizonYears}-yr)`} value={fmtMetric(roi, 0)} metric={roi} sub={`NPV ${money(s.roi.npv.value)}`} />
        <KpiCard label="Payback" value={fmtMetric(s.roi.paybackMonths)} metric={s.roi.paybackMonths} sub="simple, run-rate" />
        <KpiCard label="FTE capacity released" value={fmtMetric(s.fteReleased)} metric={s.fteReleased} sub="capacity ≠ cash" />
        <KpiCard label="Productivity uplift" value={fmtMetric(s.productivityUplift, 0)} metric={s.productivityUplift} />
        <KpiCard label="Cycle-time reduction" value={fmtMetric(s.cycleTimeReduction, 0)} metric={s.cycleTimeReduction} />
        <KpiCard label="AI adoption" value={fmtMetric(s.adoption, 0)} metric={s.adoption} />
        <KpiCard label="AI agents" value={String(s.agentCount)} sub={`${items.reduce((a, e) => a + e.init.agents.filter((x) => x.status === "LIVE").length, 0)} live`} />
        <KpiCard label="Processes transformed" value={String(s.processesTransformed)} sub={`${s.liveCount} of ${s.count} initiatives live`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <SectionCard className="xl:col-span-3" title="Value realization waterfall" q="realized" description="From full potential to sustained value. Deltas are computed by sequential substitution; see Cockpit for detail." actions={<ValueStateLegend />}>
          <WaterfallChart steps={ladderWaterfall(s.ladder, s.leakageByCause, forecastBC)} height={300} />
        </SectionCard>
        <SectionCard className="xl:col-span-2" title="AI investment vs value by function" q="invest" description="Year-1 AI cost (one-time + run) vs attributed annual benefit.">
          <BarsChart
            data={byFunction}
            xKey="name"
            series={[
              { key: "investment", label: "AI investment (yr 1)", color: "#898781" },
              { key: "benefit", label: "Gross benefit / yr", color: VS_HEX.actual },
              { key: "validated", label: "Finance-validated / yr", color: VS_HEX.validated },
            ]}
            height={300}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Benefits by industry" q="outcomes">
          <BarsChart data={byIndustry} xKey="name" layout="horizontal-bars" series={[{ key: "benefit", label: "Gross / yr", color: VS_HEX.actual }, { key: "validated", label: "Finance-validated", color: VS_HEX.validated }]} height={280} />
        </SectionCard>
        <SectionCard title="Benefits by process (top 10)" q="outcomes">
          <BarsChart data={byProcess} xKey="name" layout="horizontal-bars" series={[{ key: "benefit", label: "Gross / yr", color: VS_HEX.actual }]} height={280} />
        </SectionCard>
        <SectionCard title="Benefit type" q="attribution" description="Attributed annual value by financial class. Redeployed capacity (grey) is not counted in ROI.">
          <BarsChart data={classRows} xKey="name" layout="horizontal-bars" colorBy="color" series={[{ key: "value", label: "Attributed / yr" }]} height={280} labels />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="ROI by initiative" q="realized" description={`${p.settings.horizonYears}-year ROI on live initiatives. Amber < 100%, red < 0%.`}>
          <BarsChart data={roiRows} xKey="name" layout="horizontal-bars" colorBy="color" series={[{ key: "roi", label: "ROI" }]} fmt="percent" height={Math.max(260, roiRows.length * 30)} labels />
        </SectionCard>
        <SectionCard title="Productivity, cycle-time and cost improvement" q="outcomes" description="Per live initiative (code). Cost reduction includes AI run cost.">
          <BarsChart
            data={opsRows}
            xKey="name"
            fmt="percent"
            series={[
              { key: "productivity", label: "Productivity uplift", color: "#2a78d6" },
              { key: "cycle", label: "Cycle-time reduction", color: "#eb6834" },
              { key: "cost", label: "Cost / txn reduction", color: "#1baf7a" },
            ]}
            height={Math.max(260, roiRows.length * 30)}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Forecast vs realized benefit (monthly)" q="realized" description="Realized = derived labour + quality benefit from monthly measurements (attributed).">
          <TrendChart data={monthly} xKey="month" series={[{ key: "planned", label: "Business-case plan", color: VS_HEX.target, dashed: true }, { key: "realized", label: "Realized (derived)", color: VS_HEX.actual }]} />
        </SectionCard>
        <SectionCard title="AI cost vs benefit (monthly)" q="invest">
          <TrendChart data={monthly} xKey="month" series={[{ key: "realized", label: "Benefit", color: VS_HEX.actual }]} bars={[{ key: "aiCost", label: "AI run cost", color: "#e34948" }]} />
        </SectionCard>
        <SectionCard title="AI adoption trend" q="outcomes" description="Volume-weighted share of transactions through the AI path.">
          <TrendChart data={monthly} xKey="month" fmt="percent" area series={[{ key: "adoption", label: "Adoption", color: VS_HEX.actual }]} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Value leakage by driver" q="leakage" description="Annual value lost vs business case, by computed driver.">
          {leakage.length ? <BarsChart data={leakage} xKey="name" layout="horizontal-bars" series={[{ key: "value", label: "Value lost / yr", color: "#d03b3b" }]} height={260} labels /> : <EmptyState title="No leakage computed" />}
        </SectionCard>
        <SectionCard title="Agent performance (top 10 by volume)" q="outcomes" description="Autonomous completion vs designed automation.">
          <BarsChart
            data={agents}
            xKey="name"
            layout="horizontal-bars"
            fmt="percent"
            series={[
              { key: "target", label: "Designed automation", color: "#c3c2b7" },
              { key: "autonomy", label: "Autonomous completion", color: VS_HEX.actual },
            ]}
            height={300}
          />
        </SectionCard>
        <SectionCard title="What should management investigate next?" q="next" description="Rule-based findings from computed data, most severe first.">
          <ul className="space-y-2">
            {insights.map((i, k) => {
              const Icon = i.severity === "critical" ? OctagonAlert : i.severity === "serious" ? TriangleAlert : i.severity === "warning" ? AlertTriangle : Info;
              const color = i.severity === "critical" ? "text-[#d03b3b]" : i.severity === "serious" ? "text-[#c2410c]" : i.severity === "warning" ? "text-amber-600" : "text-sky-700";
              return (
                <li key={k}>
                  <Link href={i.href} className="group flex gap-2 rounded-md border p-2 hover:bg-muted/50">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-label={i.severity} />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{i.title}</span>
                      <span className="line-clamp-2 block text-[11px] text-muted-foreground">{i.detail}</span>
                    </span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 self-center opacity-0 transition-opacity group-hover:opacity-60" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
