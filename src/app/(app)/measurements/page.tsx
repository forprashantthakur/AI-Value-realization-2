import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { evaluatePortfolio } from "@/lib/services/portfolio-service";
import { VS_HEX } from "@/lib/services/view-models";
import { monthLabel, money, num, pct } from "@/lib/format";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { TrendChart } from "@/components/charts/charts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Measurements" };

export default async function MeasurementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { portfolio: p, items } = await evaluatePortfolio({});
  if (!p.initiatives.length) return <NoInitiatives title="Measurements" description="Monthly post-AI measurements per initiative." canCreate={can(await getSession(), "initiative:edit")} />;
  const e = items.find((x) => x.init.id === sp.initiative) ?? items[0];
  const pts = e.value.monthly.map((m) => ({
    month: monthLabel(m.month),
    raw: m.month,
    phase: m.phase,
    adoption: m.adoption,
    benefit: m.financialBenefit,
    aiCost: m.aiRunCost,
    net: m.netBenefit,
    productivity: m.productivityIndex,
    aht: m.ahtMinutes,
    cycle: m.cycleTimeHours,
    err: m.errorRate,
    roi: m.cumulativeRoi,
    volume: m.volume,
    fte: m.fteReleased,
  }));
  const goLive = e.init.goLiveDate ? { x: monthLabel(e.init.goLiveDate.slice(0, 7)), label: "Go-live" } : undefined;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Time series"
        title="Measurements"
        description="Value evolves with adoption: baseline months → pilot → rollout → steady state. Monthly benefit is computed from monthly measurements, never stored."
        actions={
          <div className="flex items-center gap-2">
            <form action="/measurements" className="flex items-center gap-2">
              <select name="initiative" defaultValue={e.init.id} className="h-9 rounded-md border px-2 text-sm" aria-label="Initiative">
                {items.map((x) => (
                  <option key={x.init.id} value={x.init.id}>
                    {x.init.code} · {x.init.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline">
                Show
              </Button>
            </form>
            <Button asChild size="sm">
              <Link href="/import">Import measurements</Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Adoption trend">
          <TrendChart data={pts} xKey="month" fmt="percent" area series={[{ key: "adoption", label: "Adoption", color: VS_HEX.actual }]} refX={goLive} height={220} />
        </SectionCard>
        <SectionCard title="Benefit trend (attributed, derived)">
          <TrendChart data={pts} xKey="month" area series={[{ key: "benefit", label: "Monthly financial benefit", color: VS_HEX.validated }]} refX={goLive} height={220} />
        </SectionCard>
        <SectionCard title="AI cost vs benefit">
          <TrendChart data={pts} xKey="month" series={[{ key: "benefit", label: "Benefit", color: VS_HEX.actual }]} bars={[{ key: "aiCost", label: "AI run cost", color: "#e34948" }]} height={220} />
        </SectionCard>
        <SectionCard title="Productivity trend (index, baseline = 1.0)">
          <TrendChart data={pts} xKey="month" fmt="number" series={[{ key: "productivity", label: "Output per effort-hour index", color: "#4a3aa7" }]} refX={goLive} height={220} />
        </SectionCard>
        <SectionCard title="Cycle-time trend (hours)">
          <TrendChart data={pts} xKey="month" fmt="hours" series={[{ key: "cycle", label: "Cycle time", color: "#eb6834" }]} refX={goLive} height={220} />
        </SectionCard>
        <SectionCard title="Quality trend (error rate)">
          <TrendChart data={pts} xKey="month" fmt="percent" series={[{ key: "err", label: "Error rate", color: "#d03b3b" }]} refX={goLive} height={220} />
        </SectionCard>
        <SectionCard title="ROI trend (cumulative, incl. one-time investment)" className="lg:col-span-2">
          <TrendChart data={pts} xKey="month" fmt="percent" series={[{ key: "roi", label: "Cumulative ROI", color: "#1baf7a" }]} refX={goLive} height={220} />
        </SectionCard>
      </div>
      <SectionCard title={`Monthly measurements — ${e.init.name}`} description={`Source: ${e.init.actual?.source ?? "baseline time study"}. Organization: ${p.organizations.find((o) => o.id === e.init.organizationId)?.name}.`}>
        <Table>
          <THead>
            <TR>
              <TH>Month</TH>
              <TH>Phase</TH>
              <TH className="text-right">Volume</TH>
              <TH className="text-right">Adoption</TH>
              <TH className="text-right">AHT (min)</TH>
              <TH className="text-right">Cycle (h)</TH>
              <TH className="text-right">Error</TH>
              <TH className="text-right">FTE released (ann.)</TH>
              <TH className="text-right">Benefit</TH>
              <TH className="text-right">AI cost</TH>
              <TH className="text-right">Net</TH>
            </TR>
          </THead>
          <TBody>
            {pts.map((m) => (
              <TR key={m.raw}>
                <TD>{m.month}</TD>
                <TD className="text-xs text-muted-foreground">{m.phase.replace("_", " ").toLowerCase()}</TD>
                <TD className="text-right">{num(m.volume)}</TD>
                <TD className="text-right">{pct(m.adoption)}</TD>
                <TD className="text-right">{m.aht.toFixed(1)}</TD>
                <TD className="text-right">{m.cycle.toFixed(1)}</TD>
                <TD className="text-right">{pct(m.err, 1)}</TD>
                <TD className="text-right">{m.fte.toFixed(1)}</TD>
                <TD className="text-right">{money(m.benefit)}</TD>
                <TD className="text-right">{money(m.aiCost)}</TD>
                <TD className="text-right font-medium">{money(m.net)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </SectionCard>
    </div>
  );
}
