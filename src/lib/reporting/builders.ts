import type { WaterfallStep } from "@/components/charts/charts";
import type { Portfolio } from "../domain/types";
import { CLASS_LABEL, STAGE_LABEL, STATUS_LABEL } from "../domain/labels";
import { EVIDENCE_LABEL, LEAKAGE_CAUSE_LABEL, type EvaluatedInitiative, type PortfolioSummary } from "../value-engine";
import { fmtMetric, hoursLabel, money, num, pct } from "../format";
import { buildInsights } from "../services/insights";
import { bridgeSteps, ladderWaterfall, valueBridge } from "../services/view-models";
import { comparisonRows } from "../services/initiative-vm";

export type ReportType = "executive" | "process" | "cfo" | "portfolio";

export const REPORT_META: Record<ReportType, { title: string; audience: string; description: string; needsInitiative: boolean }> = {
  executive: { title: "Executive AI Value Report", audience: "CEO · CIO · Chief AI Officer · Board", description: "Executive summary, investment, benefits realized, ROI, productivity, major initiatives, risks and recommendations.", needsInitiative: false },
  process: { title: "Process Value Report", audience: "Process owner · Business owner", description: "Baseline, AI intervention, before/after metrics, financial impact, productivity, quality, adoption and agent metrics.", needsInitiative: true },
  cfo: { title: "CFO Validation Report", audience: "CFO · Finance controllers", description: "Cashable savings, cost avoidance, revenue impact, investment, ROI, NPV, payback, assumptions and evidence.", needsInitiative: false },
  portfolio: { title: "AI Portfolio Report", audience: "AI CoE · AI Value Office", description: "Initiatives, investments, ROI, realized value, adoption, risk and value leakage.", needsInitiative: false },
};

export type Cell = string | number;
export type ReportSection =
  | { kind: "kpis"; title: string; items: { label: string; value: string; note?: string }[] }
  | { kind: "text"; title: string; paragraphs: string[] }
  | { kind: "bullets"; title: string; items: string[] }
  | { kind: "table"; title: string; columns: string[]; rows: Cell[][]; note?: string }
  | { kind: "waterfall"; title: string; steps: WaterfallStep[]; note?: string };

export interface ReportModel {
  type: ReportType;
  title: string;
  subtitle: string;
  audience: string;
  generatedAt: string;
  generatedBy: string;
  scope: string;
  sections: ReportSection[];
  disclaimer: string[];
}

const DISCLAIMER = [
  "Benefits are AI-attributed annual run-rates. Only finance-validated value should be quoted as P&L impact; estimated and intangible value is shown separately.",
  "Capacity released is not cash: only the share declared cashable or cost-avoidance is financial.",
  "Benchmarks and model prices marked illustrative or placeholder are not market data.",
];

function execNarrative(s: PortfolioSummary, items: EvaluatedInitiative[], horizon: number): string[] {
  const live = items.filter((e) => e.init.actual);
  const top = [...live].sort((a, b) => b.value.totals.byStatusFloor.FINANCE_VALIDATED - a.value.totals.byStatusFloor.FINANCE_VALIDATED)[0];
  return [
    `The AI portfolio comprises ${s.count} initiatives (${s.liveCount} live with post-AI measurement) and ${s.agentCount} AI agents. Total AI investment is ${money(s.totalInvestment.value)} (${money(s.oneTimeInvestment.value)} one-time plus ${money(s.recurringCost.value)} annual run cost).`,
    `Live initiatives generate ${money(s.grossBenefit.value)} of AI-attributed annual benefit, of which ${money(s.financeValidated.value)} (${pct(s.financeValidated.value / Math.max(1, s.grossBenefit.value))}) is finance-validated. Net of AI run cost, annual benefit is ${money(s.netBenefit.value)}; ${horizon}-year ROI is ${fmtMetric(s.roi.roi, 0)} with simple payback of ${fmtMetric(s.roi.paybackMonths)}.`,
    `Operationally, AI has released ${s.fteReleased.value.toFixed(0)} FTE of capacity (productivity +${pct(s.productivityUplift.value)}), reduced cycle time by ${pct(s.cycleTimeReduction.value)} on a volume-weighted basis, and reached ${pct(s.adoption.value)} adoption of eligible volume.`,
    top ? `The largest finance-validated contributor is ${top.init.name} (${money(top.value.totals.byStatusFloor.FINANCE_VALIDATED)} / yr).` : "",
    `Against approved business cases, ${money(Math.max(0, s.ladder.BUSINESS_CASE - s.ladder.CURRENT_RUN_RATE))} of annual value is not yet being delivered, including ${money(s.forecastBenefit)} on initiatives not yet live.`,
  ].filter(Boolean);
}

export function buildReport(type: ReportType, p: Portfolio, items: EvaluatedInitiative[], s: PortfolioSummary, opts: { initiativeId?: string; user: string; scope: string }): ReportModel {
  const H = p.settings.horizonYears;
  const base = {
    type,
    title: REPORT_META[type].title,
    audience: REPORT_META[type].audience,
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    generatedBy: opts.user,
    scope: opts.scope,
    disclaimer: DISCLAIMER,
  };
  const forecastBC = items.filter((e) => !e.init.actual).reduce((a, e) => a + e.value.leakage.ladder.BUSINESS_CASE, 0);
  const initTable = (rows: EvaluatedInitiative[]): ReportSection => ({
    kind: "table",
    title: "Initiatives",
    columns: ["Code", "Initiative", "Stage", "Health", "One-time", "Run / yr", "Benefit / yr", "Finance-validated / yr", "ROI", "Payback (mo)", "Adoption", "Confidence"],
    rows: rows.map((e) => [
      e.init.code,
      e.init.name,
      STAGE_LABEL[e.init.stage],
      e.init.health.replace("_", " ").toLowerCase(),
      money(e.value.tco.oneTime.value),
      money(e.value.tco.recurring.value),
      `${money(e.value.totals.counted)}${e.init.actual ? "" : " (forecast)"}`,
      money(e.value.totals.byStatusFloor.FINANCE_VALIDATED),
      fmtMetric(e.value.roi.roi, 0),
      e.value.roi.paybackMonths.undefinedReason ? "n/a" : e.value.roi.paybackMonths.value.toFixed(1),
      e.init.actual ? pct(e.value.post.adoptionRate) : "—",
      e.value.confidence.toLowerCase(),
    ]),
  });

  if (type === "executive") {
    const insights = buildInsights(items);
    return {
      ...base,
      subtitle: "Is AI creating measurable, validated business value?",
      sections: [
        { kind: "text", title: "Executive summary", paragraphs: execNarrative(s, items, H) },
        {
          kind: "kpis",
          title: "Headline metrics",
          items: [
            { label: "AI investment", value: money(s.totalInvestment.value), note: "one-time + annual run" },
            { label: "Gross benefit / yr", value: money(s.grossBenefit.value), note: "live, AI-attributed" },
            { label: "Finance-validated / yr", value: money(s.financeValidated.value) },
            { label: "Net benefit / yr", value: money(s.netBenefit.value) },
            { label: `ROI (${H}-yr)`, value: fmtMetric(s.roi.roi, 0) },
            { label: "Payback", value: fmtMetric(s.roi.paybackMonths) },
            { label: "FTE capacity released", value: `${s.fteReleased.value.toFixed(0)} FTE`, note: "capacity ≠ cash" },
            { label: "Productivity uplift", value: pct(s.productivityUplift.value) },
          ],
        },
        { kind: "waterfall", title: "Value realization waterfall", steps: ladderWaterfall(s.ladder, s.leakageByCause, forecastBC) },
        initTable([...items].sort((a, b) => b.value.totals.counted - a.value.totals.counted).slice(0, 10)),
        { kind: "bullets", title: "Risks", items: insights.filter((i) => i.severity === "critical" || i.severity === "serious").slice(0, 6).map((i) => `${i.title}. ${i.detail}`) },
        {
          kind: "bullets",
          title: "Recommendations",
          items: [
            s.financeValidated.value < 0.8 * s.grossBenefit.value ? `Prioritise Finance validation of ${money(s.grossBenefit.value - s.financeValidated.value)} measured but unvalidated annual benefit before quoting it externally.` : "Maintain quarterly re-validation of realized value.",
            ...insights.filter((i) => i.severity === "warning").slice(0, 3).map((i) => `Investigate: ${i.title}.`),
            "Declare capacity disposition for every live initiative — released capacity without a committed use is not financial value.",
            "Replace illustrative benchmarks and model prices with validated internal data.",
          ],
        },
      ],
    };
  }

  if (type === "portfolio") {
    const causes = Object.entries(s.leakageByCause)
      .filter(([k, v]) => (v ?? 0) < 0 && k !== "ADOPTION_HEADROOM")
      .map(([k, v]) => [LEAKAGE_CAUSE_LABEL[k as keyof typeof LEAKAGE_CAUSE_LABEL], money(-(v ?? 0))]);
    return {
      ...base,
      subtitle: "Investments, returns, adoption, risk and leakage across the AI portfolio",
      sections: [
        {
          kind: "kpis",
          title: "Portfolio",
          items: [
            { label: "Initiatives", value: `${s.count} (${s.liveCount} live)` },
            { label: "AI agents", value: String(s.agentCount) },
            { label: "One-time investment", value: money(s.oneTimeInvestment.value) },
            { label: "Run cost / yr", value: money(s.recurringCost.value) },
            { label: "Realized value / yr", value: money(s.ladder.REALIZED) },
            { label: "Business case / yr", value: money(s.ladder.BUSINESS_CASE) },
            { label: `ROI (${H}-yr)`, value: fmtMetric(s.roi.roi, 0) },
            { label: "Adoption", value: pct(s.adoption.value) },
          ],
        },
        initTable(items),
        { kind: "table", title: "Value leakage by driver (annual)", columns: ["Driver", "Value lost / yr"], rows: causes },
        {
          kind: "table",
          title: "Risk register",
          columns: ["Initiative", "Risk level", "Health", "Owner-identified issues"],
          rows: items.filter((e) => e.init.riskLevel === "HIGH" || e.init.health !== "ON_TRACK").map((e) => [e.init.name, e.init.riskLevel.toLowerCase(), e.init.health.replace("_", " ").toLowerCase(), e.init.leakageNotes.map((n) => n.description).join(" | ") || "—"]),
        },
      ],
    };
  }

  if (type === "cfo") {
    const scoped = opts.initiativeId ? items.filter((e) => e.init.id === opts.initiativeId) : items;
    const L = scoped.filter((e) => e.init.actual);
    const sum = (f: (e: EvaluatedInitiative) => number) => L.reduce((a, e) => a + f(e), 0);
    const bridge = valueBridge(scoped, p.settings.roiBasis, H);
    const single = opts.initiativeId ? scoped[0] : null;
    return {
      ...base,
      subtitle: single ? `${single.init.code} · ${single.init.name}` : "Portfolio financial validation",
      sections: [
        {
          kind: "kpis",
          title: "Financial value (annual, AI-attributed, live initiatives)",
          items: [
            { label: "Cashable savings", value: money(sum((e) => e.value.totals.byClass.CASHABLE)) },
            { label: "Cost avoidance", value: money(sum((e) => e.value.totals.byClass.COST_AVOIDANCE)) },
            { label: "Revenue / margin", value: money(sum((e) => e.value.totals.byClass.REVENUE)) },
            { label: "Working capital", value: money(sum((e) => e.value.totals.byClass.WORKING_CAPITAL)) },
            { label: "Risk avoidance", value: money(sum((e) => e.value.totals.byClass.RISK_AVOIDANCE)) },
            { label: "Redeployed capacity (excluded)", value: money(sum((e) => e.value.totals.byClass.CAPACITY)), note: "not in ROI" },
            { label: "Finance-validated", value: money(sum((e) => e.value.totals.byStatusFloor.FINANCE_VALIDATED)) },
            { label: "One-time investment", value: money(scoped.reduce((a, e) => a + e.value.tco.oneTime.value, 0)) },
          ],
        },
        { kind: "waterfall", title: "Executive value bridge (annual)", steps: bridgeSteps(bridge), note: `Net AI value ${money(bridge.netValue)} / yr (implementation annualized over ${H} years).` },
        {
          kind: "table",
          title: "Returns by initiative — ROI under each basis",
          columns: ["Initiative", "Investment", "Run / yr", "NPV", "IRR", "Payback (mo)", "ROI cashable only", "ROI cashable + avoidance", "ROI all financial"],
          rows: scoped.map((e) => [
            e.init.name + (e.init.actual ? "" : " (forecast)"),
            money(e.value.tco.oneTime.value),
            money(e.value.tco.recurring.value),
            money(e.value.roi.npv.value),
            fmtMetric(e.value.roi.irr, 0),
            e.value.roi.paybackMonths.undefinedReason ? "n/a" : e.value.roi.paybackMonths.value.toFixed(1),
            e.value.roiByBasis.cashableOnly === null ? "n/a" : pct(e.value.roiByBasis.cashableOnly),
            e.value.roiByBasis.cashableAndAvoidance === null ? "n/a" : pct(e.value.roiByBasis.cashableAndAvoidance),
            e.value.roiByBasis.allFinancial === null ? "n/a" : pct(e.value.roiByBasis.allFinancial),
          ]),
        },
        {
          kind: "table",
          title: "Benefit lines — validation status and evidence",
          columns: ["Initiative", "Benefit", "Class", "Nature", "Attributed / yr", "Attribution", "Status", "Evidence"],
          rows: scoped.flatMap((e) =>
            e.value.benefits
              .filter((b) => b.benefit.financialClass !== "NON_FINANCIAL")
              .map((b) => [e.init.code, b.benefit.name, CLASS_LABEL[b.benefit.financialClass], b.effectiveNature.toLowerCase(), money(b.attributed), pct(b.attributionPct), STATUS_LABEL[b.benefit.status], b.benefit.evidence.map((x) => EVIDENCE_LABEL[x.type]).join(", ") || "none"]),
          ),
        },
        {
          kind: "table",
          title: "Assumptions",
          columns: ["Scope", "Assumption", "Value", "Owner"],
          rows: [
            ["Portfolio", "Discount rate", pct(p.settings.discountRate), "Finance"],
            ["Portfolio", "ROI horizon", `${H} years`, "Finance"],
            ["Portfolio", "ROI basis", p.settings.roiBasis.replaceAll("_", " ").toLowerCase(), "AI Value Office"],
            ["Portfolio", "Year-1 benefit ramp", p.settings.rampUp.map((x) => pct(x)).join(" / "), "AI Value Office"],
            ...scoped.flatMap((e) => e.init.assumptions.map((a) => [e.init.code, a.label, a.value, a.owner])),
          ],
        },
      ],
    };
  }

  // process report
  const e = items.find((x) => x.init.id === opts.initiativeId) ?? items.find((x) => x.init.actual) ?? items[0];
  const v = e.value;
  const b = e.init.baseline.metrics;
  return {
    ...base,
    subtitle: `${e.init.code} · ${e.init.name}`,
    sections: [
      {
        kind: "text",
        title: "Process & AI intervention",
        paragraphs: [
          e.init.description,
          `Baseline: ${num(b.transactionsPerYear)} transactions / yr handled by ${b.fte} FTE; handling time ${b.avgHandlingMinutes.toFixed(1)} min, cycle time ${hoursLabel(b.cycleTimeHours)}, error rate ${pct(b.errorRate, 1)}, cost per transaction ${money(v.cost.perTxnBaseline.value, { compact: false })}.`,
          `AI intervention: ${e.init.agents.length} agent(s) — ${e.init.agents.map((a) => a.name).join(", ")}. Adoption ${pct(v.post.adoptionRate)}, automation ${pct(v.post.automationRate)}.`,
          e.init.actual ? "" : "No post-AI measurement yet — figures below are forecasts from business-case targets.",
        ].filter(Boolean),
      },
      {
        kind: "table",
        title: "Before vs after",
        columns: ["Metric", "Baseline", "Target", "Post-AI", "Improvement"],
        rows: comparisonRows(e.init, v).map((r) => [r.metric, r.baseline, r.target ?? "—", r.actual, r.improvement]),
      },
      {
        kind: "kpis",
        title: "Financial impact, productivity and adoption",
        items: [
          { label: "Hours released / yr", value: num(v.capacity.hoursReleased.value) },
          { label: "FTE capacity", value: `${v.capacity.fteCapacityReleased.value.toFixed(1)} FTE` },
          { label: "Cashable savings / yr", value: money(v.totals.byClass.CASHABLE) },
          { label: "Cost avoidance / yr", value: money(v.totals.byClass.COST_AVOIDANCE) },
          { label: "Net benefit / yr", value: money(v.roi.netAnnualBenefit.value) },
          { label: "ROI", value: fmtMetric(v.roi.roi, 0) },
          { label: "Adoption", value: pct(v.post.adoptionRate) },
          { label: "Productivity uplift", value: pct(v.productivity.uplift.value) },
        ],
      },
      {
        kind: "table",
        title: "Agent metrics",
        columns: ["Agent", "Tasks / mo", "Autonomous", "Escalation", "Override", "AI cost / task", "Cost / outcome"],
        rows: e.init.agents.map((a) => {
          const x = v.agents.find((y) => y.agentId === a.id)!;
          return [a.name, num(a.performance.tasksPerMonth), pct(a.performance.autonomousCompletionRate), pct(a.performance.escalationRate), pct(a.performance.overrideRate), money(x.aiCostPerTask.value, { compact: false }), money(x.costPerOutcome.value, { compact: false })];
        }),
      },
      { kind: "waterfall", title: "Value ladder", steps: ladderWaterfall(v.leakage.ladder, v.leakage.byCause) },
    ],
  };
}
