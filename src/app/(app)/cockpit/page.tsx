import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { evaluatePortfolio, filterOptions, parseFilters } from "@/lib/services/portfolio-service";
import { bridgeSteps, ladderWaterfall, valueBridge, VS_HEX } from "@/lib/services/view-models";
import { LEAKAGE_CAUSE_LABEL } from "@/lib/value-engine";
import { fmtMetric, money, pct } from "@/lib/format";
import { FilterBar } from "@/components/value/filter-bar";
import { KpiCard } from "@/components/value/kpi-card";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { HealthBadge, ValueStateLegend } from "@/components/value/badges";
import { BarsChart, WaterfallChart } from "@/components/charts/charts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Progress } from "@/components/ui/misc";
import { LIFECYCLE_STAGES } from "@/lib/domain/types";
import { STAGE_LABEL } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "Value Cockpit" };

export default async function CockpitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const { portfolio: p, items, summary: s } = await evaluatePortfolio(filters);
  if (!p.initiatives.length) return <NoInitiatives title="AI Value Realization Cockpit" description="Potential → forecast → measured → validated → realized value, and where it leaks." canCreate={can(await getSession(), "initiative:edit")} />;
  const L = s.ladder;
  const forecastBC = items.filter((e) => !e.init.actual).reduce((a, e) => a + e.value.leakage.ladder.BUSINESS_CASE, 0);
  const liveBC = L.BUSINESS_CASE - forecastBC;
  const leakage = Math.max(0, liveBC - L.CURRENT_RUN_RATE);
  const bridge = valueBridge(items, p.settings.roiBasis, p.settings.horizonYears);
  const causes = Object.entries(s.leakageByCause)
    .filter(([k, v]) => (v ?? 0) < 0 && k !== "ADOPTION_HEADROOM")
    .map(([k, v]) => ({ name: LEAKAGE_CAUSE_LABEL[k as keyof typeof LEAKAGE_CAUSE_LABEL], value: -(v ?? 0) }))
    .sort((a, b) => b.value - a.value);
  const notes = items.flatMap((e) => e.init.leakageNotes.map((n) => ({ ...n, init: e.init })));
  const noteGroups = Object.values(
    notes.reduce<Record<string, { cause: string; count: number; est: number; examples: string[] }>>((acc, n) => {
      const k = n.cause;
      acc[k] ??= { cause: LEAKAGE_CAUSE_LABEL[k], count: 0, est: 0, examples: [] };
      acc[k].count++;
      acc[k].est += n.estimatedAnnualImpact ?? 0;
      acc[k].examples.push(n.init.code);
      return acc;
    }, {}),
  ).sort((a, b) => b.est - a.est);
  const stageRows = LIFECYCLE_STAGES.map((st) => ({
    name: STAGE_LABEL[st],
    on: items.filter((e) => e.init.stage === st && e.init.health === "ON_TRACK").length,
    risk: items.filter((e) => e.init.stage === st && e.init.health === "AT_RISK").length,
    off: items.filter((e) => e.init.stage === st && e.init.health === "OFF_TRACK").length,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Chief AI Officer · CFO"
        title="AI Value Realization Cockpit"
        description="Potential → approved → measured → validated → realized → sustained. Where value is leaking, what AI costs, and what is left after costs."
        actions={<ValueStateLegend />}
      />
      <FilterBar options={filterOptions(p)} show={["org", "industry", "bu", "fn", "initiative", "country", "status", "scenario"]} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Potential value" value={money(L.POTENTIAL)} state="forecast" sub="targets at 100% adoption" />
        <KpiCard label="Approved business case" value={money(L.BUSINESS_CASE)} state="target" sub={`${money(forecastBC)} not yet live`} />
        <KpiCard label="Measured value" value={money(L.MEASURED)} state="actual" sub={`run-rate ${money(L.CURRENT_RUN_RATE)}`} />
        <KpiCard label="Finance-validated" value={money(L.FINANCE_VALIDATED)} state="validated" sub={`${pct(L.FINANCE_VALIDATED / Math.max(1, L.CURRENT_RUN_RATE))} of run-rate`} />
        <KpiCard label="Realized value" value={money(L.REALIZED)} state="realized" />
        <KpiCard label="Sustained value" value={money(L.SUSTAINED)} state="realized" sub="≥ 2 quarters" />
        <KpiCard label="Value leakage (live)" value={money(leakage)} delta={{ text: pct(leakage / Math.max(1, liveBC)) + " of live business case", good: false }} />
        <KpiCard label="AI investment" value={fmtMetric(s.totalInvestment)} metric={s.totalInvestment} />
        <KpiCard label="Net value (annual)" value={fmtMetric(s.netBenefit)} metric={s.netBenefit} state="actual" />
        <KpiCard label={`ROI (${p.settings.horizonYears}-yr)`} value={fmtMetric(s.roi.roi, 0)} metric={s.roi.roi} />
        <KpiCard label="Payback" value={fmtMetric(s.roi.paybackMonths)} metric={s.roi.paybackMonths} />
        <KpiCard
          label="Portfolio status"
          value={`${items.filter((e) => e.init.health === "ON_TRACK").length} / ${items.length}`}
          sub={
            <span>
              on track · <span className="text-amber-700">{items.filter((e) => e.init.health === "AT_RISK").length} at risk</span> · <span className="text-red-700">{items.filter((e) => e.init.health === "OFF_TRACK").length} off track</span>
            </span>
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Value leakage waterfall" q="leakage" description="Sequential substitution: volume → adoption → automation → quality & rates → declared → validation status.">
          <WaterfallChart steps={ladderWaterfall(L, s.leakageByCause, forecastBC)} height={320} />
        </SectionCard>
        <SectionCard title="Executive value bridge (annual)" q="attribution" description={`Baseline operating cost of live processes → AI-attributed benefits → AI costs. Net AI value = ${money(bridge.netValue)} / yr.`}>
          <WaterfallChart steps={bridgeSteps(bridge)} height={320} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Computed leakage by driver" q="leakage">
          <BarsChart data={causes} xKey="name" layout="horizontal-bars" series={[{ key: "value", label: "Value lost / yr", color: "#d03b3b" }]} height={240} labels />
        </SectionCard>
        <SectionCard title="Owner-identified root causes" description="Qualitative, owner-estimated. Shown alongside — not added to — computed leakage." className="lg:col-span-2">
          <Table>
            <THead>
              <TR>
                <TH>Cause</TH>
                <TH className="text-right">Initiatives</TH>
                <TH className="text-right">Owner estimate / yr</TH>
                <TH>Where</TH>
              </TR>
            </THead>
            <TBody>
              {noteGroups.map((g) => (
                <TR key={g.cause}>
                  <TD className="font-medium">{g.cause}</TD>
                  <TD className="text-right">{g.count}</TD>
                  <TD className="text-right">{g.est ? money(g.est) : "not estimated"}</TD>
                  <TD className="text-xs text-muted-foreground">{g.examples.join(", ")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <SectionCard title="Initiative value ladder" q="realized" description="Share of approved business case now finance-validated.">
          <Table>
            <THead>
              <TR>
                <TH>Initiative</TH>
                <TH>Health</TH>
                <TH className="text-right">Business case</TH>
                <TH className="text-right">Run-rate</TH>
                <TH className="text-right">Finance-validated</TH>
                <TH className="text-right">Realized</TH>
                <TH className="w-40">Validated vs plan</TH>
              </TR>
            </THead>
            <TBody>
              {[...items]
                .sort((a, b) => b.value.leakage.ladder.BUSINESS_CASE - a.value.leakage.ladder.BUSINESS_CASE)
                .map((e) => {
                  const l = e.value.leakage.ladder;
                  const r = l.FINANCE_VALIDATED / Math.max(1, l.BUSINESS_CASE);
                  return (
                    <TR key={e.init.id}>
                      <TD>
                        <Link href={`/initiatives/${e.init.id}/value`} className="font-medium hover:text-primary">
                          {e.init.name}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">
                          {e.init.code} · {STAGE_LABEL[e.init.stage]}
                        </p>
                      </TD>
                      <TD>
                        <HealthBadge health={e.init.health} />
                      </TD>
                      <TD className="text-right">{money(l.BUSINESS_CASE)}</TD>
                      <TD className={cn("text-right", !e.init.actual && "text-muted-foreground")}>{e.init.actual ? money(l.CURRENT_RUN_RATE) : "forecast"}</TD>
                      <TD className="text-right">{money(l.FINANCE_VALIDATED)}</TD>
                      <TD className="text-right">{money(l.REALIZED)}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Progress value={r * 100} indicatorClassName="bg-[#1baf7a]" label="Validated vs plan" />
                          <span className="w-9 text-right text-[11px] tabular">{pct(r)}</span>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
            </TBody>
          </Table>
        </SectionCard>
        <SectionCard title="Portfolio status by stage">
          <BarsChart
            data={stageRows}
            xKey="name"
            layout="horizontal-bars"
            stacked
            fmt="number"
            series={[
              { key: "on", label: "On track", color: "#0ca30c" },
              { key: "risk", label: "At risk", color: "#fab219" },
              { key: "off", label: "Off track", color: "#d03b3b" },
            ]}
            height={300}
          />
          <p className="text-[11px] text-muted-foreground">Status colours always accompany a text label.</p>
        </SectionCard>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Colour key for ladder totals: potential <span style={{ color: VS_HEX.potential }}>■</span>, business case <span style={{ color: VS_HEX.target }}>■</span>, run-rate <span style={{ color: VS_HEX.actual }}>■</span>, finance-validated{" "}
        <span style={{ color: VS_HEX.validated }}>■</span>, realized <span style={{ color: VS_HEX.realized }}>■</span>, sustained <span style={{ color: VS_HEX.sustained }}>■</span>.
      </p>
    </div>
  );
}
