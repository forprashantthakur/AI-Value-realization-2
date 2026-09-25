import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Plus } from "lucide-react";
import { evaluatePortfolio, filterOptions, parseFilters } from "@/lib/services/portfolio-service";
import { fmtMetric, money, pct } from "@/lib/format";
import { FilterBar } from "@/components/value/filter-bar";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { ConfidenceBadge, HealthBadge, StageBadge } from "@/components/value/badges";
import { BubbleChart, type BubblePoint } from "@/components/charts/charts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { HEALTH_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "AI Portfolio" };

const HEALTH_COLOR = { ON_TRACK: "#2a78d6", AT_RISK: "#eb6834", OFF_TRACK: "#d03b3b" };
const RISK_COLOR = { LOW: "#2a78d6", MEDIUM: "#eb6834", HIGH: "#1baf7a" };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const colorBy = sp.color === "risk" ? "risk" : sp.color === "status" ? "status" : "health";
  const { portfolio: p, items } = await evaluatePortfolio(filters);
  if (!p.initiatives.length) return <NoInitiatives title="AI Portfolio" description="Every AI initiative with its stage, value, ROI and health." canCreate={can(await getSession(), "initiative:edit")} />;
  const points: BubblePoint[] = items.map((e, i) => {
    const liveV = !!e.init.actual;
    const group =
      colorBy === "risk" ? `${e.init.riskLevel.charAt(0)}${e.init.riskLevel.slice(1).toLowerCase()} risk` : colorBy === "status" ? (liveV ? "Measured (live)" : "Forecast only") : HEALTH_LABEL[e.init.health];
    const color = colorBy === "risk" ? RISK_COLOR[e.init.riskLevel] : colorBy === "status" ? (liveV ? "#2a78d6" : "#9ec5f4") : HEALTH_COLOR[e.init.health];
    return {
      id: e.init.id,
      name: `${e.init.code} · ${e.init.name}`,
      x: e.init.complexity + ((i % 5) - 2) * 0.07, // small jitter so equal complexities don't overlap
      y: e.value.totals.counted,
      z: e.value.tco.oneTime.value,
      group,
      color,
      href: `/initiatives/${e.init.id}/overview`,
      meta: `${liveV ? "Measured" : "Forecast"} · ROI ${e.value.roi.roi.undefinedReason ? "n/a" : pct(e.value.roi.roi.value)}`,
    };
  });
  const groups = [...new Map(points.map((pt) => [pt.group, pt.color])).entries()].map(([key, color]) => ({ key, color }));
  const sorted = [...items].sort((a, b) => b.value.totals.counted - a.value.totals.counted);
  const colorLink = (c: string) => {
    const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "color" ? [[k, v]] : [])));
    q.set("color", c);
    return `/portfolio?${q.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="AI portfolio management"
        title="AI Portfolio"
        description={`${items.length} initiatives across ${new Set(items.map((e) => e.init.organizationId)).size} organizations. Click a bubble or row to open the initiative.`}
        actions={
          <Button asChild>
            <Link href="/portfolio/new">
              <Plus /> New initiative
            </Link>
          </Button>
        }
      />
      <FilterBar options={filterOptions(p)} show={["industry", "fn", "process", "bu", "tech", "agent", "stage", "org", "country", "status", "roiMin", "roiMax"]} />
      {items.length === 0 ? (
        <EmptyState title="No initiatives match" />
      ) : (
        <>
          <SectionCard
            title="Value heatmap — complexity vs business value"
            q="next"
            description="X = implementation complexity (1–5) · Y = AI-attributed annual benefit (forecast where not live) · bubble = one-time investment."
            actions={
              <div className="flex gap-1 text-xs">
                <span className="text-muted-foreground">Colour by:</span>
                {(["health", "risk", "status"] as const).map((c) => (
                  <Link key={c} href={colorLink(c)} className={cn("rounded px-1.5", colorBy === c ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                    {c === "status" ? "value status" : c}
                  </Link>
                ))}
              </div>
            }
          >
            <BubbleChart points={points} groups={groups} xLabel="Implementation complexity" yLabel="Annual benefit" height={400} />
            <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
              <span>↖ Quick wins: high value, low complexity</span>
              <span>↗ Strategic bets: high value, high complexity</span>
              <span>↙ Incremental: low value, low complexity</span>
              <span>↘ Reconsider: low value, high complexity</span>
            </div>
          </SectionCard>
          <SectionCard title="Initiatives">
            <Table>
              <THead>
                <TR>
                  <TH>Initiative</TH>
                  <TH>Stage</TH>
                  <TH>Health</TH>
                  <TH className="text-right">One-time</TH>
                  <TH className="text-right">Run / yr</TH>
                  <TH className="text-right">Benefit / yr</TH>
                  <TH className="text-right">ROI</TH>
                  <TH className="text-right">Payback</TH>
                  <TH className="text-right">Adoption</TH>
                  <TH>Evidence</TH>
                  <TH className="text-right">Score</TH>
                </TR>
              </THead>
              <TBody>
                {sorted.map((e) => (
                  <TR key={e.init.id}>
                    <TD>
                      <Link href={`/initiatives/${e.init.id}/overview`} className="font-medium hover:text-primary">
                        {e.init.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        {e.init.code} · {p.organizations.find((o) => o.id === e.init.organizationId)?.name} · {p.functions.find((f) => f.id === e.init.functionId)?.name} · {e.init.aiTechnology}
                      </p>
                    </TD>
                    <TD>
                      <StageBadge stage={e.init.stage} />
                    </TD>
                    <TD>
                      <HealthBadge health={e.init.health} />
                    </TD>
                    <TD className="text-right">{money(e.value.tco.oneTime.value)}</TD>
                    <TD className="text-right">{money(e.value.tco.recurring.value)}</TD>
                    <TD className={cn("text-right font-medium", !e.init.actual && "text-muted-foreground")}>
                      {money(e.value.totals.counted)}
                      {!e.init.actual && <span className="block text-[10px] font-normal">forecast</span>}
                    </TD>
                    <TD className={cn("text-right", e.value.roi.roi.value < 0 && "text-red-700")}>{fmtMetric(e.value.roi.roi, 0)}</TD>
                    <TD className="text-right">{fmtMetric(e.value.roi.paybackMonths)}</TD>
                    <TD className="text-right">{e.init.actual ? pct(e.value.post.adoptionRate) : "—"}</TD>
                    <TD>
                      <ConfidenceBadge level={e.value.confidence} compact />
                    </TD>
                    <TD className="text-right tabular">{e.value.scorecard.composite !== null && e.init.actual ? e.value.scorecard.composite.toFixed(0) : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <p className="mt-2 text-[11px] text-muted-foreground">Score = transparent weighted scorecard (achievement vs plan); see each initiative&apos;s Overview for the breakdown. Stage names: {Object.values(STAGE_LABEL).join(" → ")}.</p>
          </SectionCard>
        </>
      )}
    </div>
  );
}
