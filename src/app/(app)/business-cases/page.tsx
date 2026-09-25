import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { computeRoi } from "@/lib/value-engine";
import { evaluatePortfolio } from "@/lib/services/portfolio-service";
import { money, pct } from "@/lib/format";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { HealthBadge, StageBadge } from "@/components/value/badges";
import { KpiCard } from "@/components/value/kpi-card";
import { BarsChart } from "@/components/charts/charts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VS_HEX } from "@/lib/services/view-models";
import { cn } from "@/lib/utils";

export const metadata = { title: "Business Cases" };

export default async function BusinessCasesPage() {
  const { portfolio: p, items } = await evaluatePortfolio({});
  if (!p.initiatives.length) return <NoInitiatives title="Business Cases" description="Approved business case vs measured value." canCreate={can(await getSession(), "initiative:edit")} />;
  const rows = items.map((e) => {
    const bc = e.init.businessCase;
    const bcRoi = computeRoi({
      annualBenefit: e.value.leakage.ladder.BUSINESS_CASE,
      oneTimeInvestment: bc.approvedInvestment || e.value.tco.oneTime.value,
      recurringAnnualCost: e.value.tco.recurring.value,
      discountRate: p.settings.discountRate,
      horizonYears: bc.horizonYears,
      rampUp: p.settings.rampUp,
    });
    return { e, bc, bcRoi };
  });
  const approved = rows.filter((r) => r.bc.approvedDate);
  const approvedInv = approved.reduce((a, r) => a + r.bc.approvedInvestment, 0);
  const actualInv = approved.reduce((a, r) => a + r.e.value.tco.oneTime.value, 0);
  const liveRows = rows.filter((r) => r.e.init.actual);
  const chart = liveRows
    .map((r) => ({ name: r.e.init.code, plan: r.e.value.leakage.ladder.BUSINESS_CASE, actual: r.e.value.leakage.ladder.CURRENT_RUN_RATE, validated: r.e.value.leakage.ladder.FINANCE_VALIDATED }))
    .sort((a, b) => b.plan - a.plan);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Plan vs actual" title="Business Cases" description="Approved business cases compared with measured run-rate, validated value and actual investment." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Approved business cases" value={`${approved.length} / ${rows.length}`} />
        <KpiCard label="Approved investment" value={money(approvedInv)} state="target" />
        <KpiCard label="Actual one-time investment" value={money(actualInv)} delta={{ text: `${actualInv >= approvedInv ? "+" : ""}${pct((actualInv - approvedInv) / Math.max(1, approvedInv))} vs approved`, good: actualInv <= approvedInv }} />
        <KpiCard label="Live cases at ≥ 90% of plan" value={`${liveRows.filter((r) => r.e.value.leakage.ladder.CURRENT_RUN_RATE >= 0.9 * r.e.value.leakage.ladder.BUSINESS_CASE).length} / ${liveRows.length}`} />
      </div>
      <SectionCard title="Forecast vs realized value — live initiatives" q="realized">
        <BarsChart
          data={chart}
          xKey="name"
          series={[
            { key: "plan", label: "Business case / yr", color: VS_HEX.target },
            { key: "actual", label: "Run-rate / yr", color: VS_HEX.actual },
            { key: "validated", label: "Finance-validated / yr", color: VS_HEX.validated },
          ]}
          height={280}
        />
      </SectionCard>
      <SectionCard title="Business case register">
        <Table>
          <THead>
            <TR>
              <TH>Initiative</TH>
              <TH>Stage</TH>
              <TH>Approved</TH>
              <TH className="text-right">Approved inv.</TH>
              <TH className="text-right">Actual inv.</TH>
              <TH className="text-right">BC value / yr</TH>
              <TH className="text-right">Run-rate / yr</TH>
              <TH className="text-right">BC ROI</TH>
              <TH className="text-right">Current ROI</TH>
              <TH>Health</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(({ e, bc, bcRoi }) => (
              <TR key={e.init.id}>
                <TD>
                  <Link href={`/initiatives/${e.init.id}/business-case`} className="font-medium hover:text-primary">
                    {e.init.name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">{e.init.code}</p>
                </TD>
                <TD>
                  <StageBadge stage={e.init.stage} />
                </TD>
                <TD className="text-xs">{bc.approvedDate ?? <span className="text-muted-foreground">Pending</span>}</TD>
                <TD className="text-right">{bc.approvedInvestment ? money(bc.approvedInvestment) : "—"}</TD>
                <TD className={cn("text-right", bc.approvedInvestment && e.value.tco.oneTime.value > bc.approvedInvestment * 1.05 && "text-red-700")}>{money(e.value.tco.oneTime.value)}</TD>
                <TD className="text-right">{money(e.value.leakage.ladder.BUSINESS_CASE)}</TD>
                <TD className="text-right">{e.init.actual ? money(e.value.leakage.ladder.CURRENT_RUN_RATE) : <span className="text-muted-foreground">not live</span>}</TD>
                <TD className="text-right text-muted-foreground">{bcRoi.roi.undefinedReason ? "n/a" : pct(bcRoi.roi.value)}</TD>
                <TD className={cn("text-right font-medium", e.init.actual && e.value.roi.roi.value < bcRoi.roi.value * 0.8 && "text-red-700")}>{e.init.actual ? pct(e.value.roi.roi.value) : "—"}</TD>
                <TD>
                  <HealthBadge health={e.init.health} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </SectionCard>
    </div>
  );
}
