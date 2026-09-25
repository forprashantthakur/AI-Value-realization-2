import Link from "next/link";
import { evaluatePortfolio } from "@/lib/services/portfolio-service";
import { getSession } from "@/lib/auth/session";
import { can, roleLabel } from "@/lib/auth/rbac";
import { computeMaturity, MATURITY_LEVELS } from "@/lib/value-engine";
import { LIFECYCLE_STAGES, MATURITY_DIMENSIONS } from "@/lib/domain/types";
import { STAGE_GATE, STAGE_LABEL, STATUS_LABEL } from "@/lib/domain/labels";
import { money, pct } from "@/lib/format";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { HealthBadge, StatusBadge } from "@/components/value/badges";
import { BenefitActions } from "@/components/initiative/benefit-actions";
import { RadarView } from "@/components/charts/charts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata = { title: "Value Realization" };

export default async function ValueRealizationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [{ portfolio: p, items }, session] = await Promise.all([evaluatePortfolio({}), getSession()]);
  const steps = p.settings.governance;

  // Governance queue: benefit lines the current role can act on now.
  const queue = items.flatMap((e) =>
    e.value.benefits
      .filter((b) => b.benefit.financialClass !== "NON_FINANCIAL" && e.init.actual)
      .filter((b) => steps.some((s) => s.from === b.benefit.status && s.allowedRoles.includes(session.role)))
      .map((b) => ({ e, b })),
  );
  const orgId = sp.org ?? p.organizations[0].id;
  const assessment = p.maturity.find((m) => m.organizationId === orgId);
  const mat = assessment ? computeMaturity(assessment) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Benefits realization management"
        title="Value Realization"
        description="Lifecycle stage gates, the benefit governance workflow and AI value-realization maturity."
      />

      <SectionCard title="Lifecycle board" description="Discover → Baseline → Business Case → Implement → Measure → Validate → Realize → Optimize. Hover a column title for its exit gate.">
        <div className="grid grid-flow-col auto-cols-[minmax(170px,1fr)] gap-2 overflow-x-auto pb-2">
          {LIFECYCLE_STAGES.map((st, i) => {
            const col = items.filter((e) => e.init.stage === st);
            return (
              <div key={st} className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-2">
                <div title={STAGE_GATE[st]}>
                  <p className="text-xs font-semibold">
                    {i + 1}. {STAGE_LABEL[st]} <span className="font-normal text-muted-foreground">({col.length})</span>
                  </p>
                  <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">Gate: {STAGE_GATE[st]}</p>
                </div>
                {col.map((e) => (
                  <Link key={e.init.id} href={`/initiatives/${e.init.id}/overview`} className="rounded-md border bg-card p-2 shadow-sm hover:border-primary/40">
                    <p className="text-xs font-medium leading-tight">{e.init.name}</p>
                    <p className="text-[10px] text-muted-foreground">{e.init.code}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <HealthBadge health={e.init.health} />
                      <span className={cn("text-[11px] font-medium tabular", !e.init.actual && "text-muted-foreground")}>{money(e.value.totals.counted)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <SectionCard
          title={`Governance queue — ${roleLabel(session.role)}`}
          description="Benefit lines your role can advance now under the configured workflow. Switch persona (top right) to act as Business Owner or Finance Validator."
        >
          {queue.length === 0 ? (
            <EmptyState title="Nothing awaiting your action" description="Other roles may have items in their queue." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Benefit</TH>
                  <TH className="text-right">AI-attributed / yr</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {queue.slice(0, 40).map(({ e, b }) => (
                  <TR key={b.benefit.id}>
                    <TD>
                      <p className="font-medium">{b.benefit.name}</p>
                      <Link href={`/initiatives/${e.init.id}/value`} className="text-[11px] text-muted-foreground hover:text-primary">
                        {e.init.code} · {e.init.name}
                      </Link>
                    </TD>
                    <TD className="text-right">{money(b.attributed)}</TD>
                    <TD>
                      <StatusBadge status={b.benefit.status} />
                    </TD>
                    <TD>
                      <BenefitActions
                        benefitId={b.benefit.id}
                        status={b.benefit.status}
                        role={session.role}
                        steps={steps}
                        evidenceCount={b.benefit.evidence.length}
                        attributionPct={b.benefit.attributionPct}
                        confidence={b.benefit.confidence}
                        canSubmit={can(session.role, "benefit:submit")}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </SectionCard>
        <SectionCard title="Governance workflow" description="Configurable in Administration.">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="rounded-md border p-2 text-xs">
                <p className="font-medium">
                  {STATUS_LABEL[s.from]} → {STATUS_LABEL[s.to]}
                </p>
                <p className="text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-[11px]">
                  {s.allowedRoles.map((r) => roleLabel(r)).join(", ")}
                  {s.requiresEvidence && " · evidence required"}
                </p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      <SectionCard
        title="AI value realization maturity"
        description="Capability assessment across 11 dimensions. It informs where to invest in measurement capability — it never substitutes for measured ROI."
        actions={
          <div className="flex flex-wrap gap-1 text-xs">
            {p.organizations.map((o) => (
              <Link key={o.id} href={`/value-realization?org=${o.id}`} className={cn("rounded px-1.5 py-0.5", o.id === orgId ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                {o.name.split(" ")[0]}
              </Link>
            ))}
          </div>
        }
      >
        {assessment && mat ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <RadarView
              data={MATURITY_DIMENSIONS.map((d) => ({ dimension: d, current: assessment.scores[d], target: assessment.target[d] }))}
              series={[
                { key: "current", label: "Current", color: "#2a78d6" },
                { key: "target", label: "Target", color: "#eda100", dashed: true },
              ]}
            />
            <div className="space-y-3 text-xs">
              <div>
                <p className="eyebrow">Overall level</p>
                <p className="text-lg font-semibold">
                  Level {mat.level.level} — {mat.level.name}
                </p>
                <p className="text-muted-foreground">{mat.level.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Average {mat.average.toFixed(2)}. {mat.note}
                </p>
              </div>
              <div>
                <p className="eyebrow">Largest gaps to target</p>
                {mat.gaps.slice(0, 5).map((g) => (
                  <p key={g.dimension}>
                    {g.dimension}: {g.score} → {g.target} <span className="text-muted-foreground">(gap {g.gap})</span>
                  </p>
                ))}
              </div>
              <div>
                <p className="eyebrow">Levels</p>
                {MATURITY_LEVELS.map((l) => (
                  <p key={l.level} className={cn(l.level === mat.level.level && "font-semibold")}>
                    {l.level}. {l.name}
                  </p>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Assessed {assessment.assessedOn} by {assessment.assessedBy}. Measured ROI for this organization is shown on the dashboard — filter by organization.
              </p>
            </div>
          </div>
        ) : (
          <EmptyState title="No maturity assessment for this organization" />
        )}
      </SectionCard>
      <p className="text-[11px] text-muted-foreground">Realized share of portfolio run-rate: {pct(items.reduce((a, e) => a + e.value.leakage.ladder.REALIZED, 0) / Math.max(1, items.reduce((a, e) => a + e.value.leakage.ladder.CURRENT_RUN_RATE, 0)))}.</p>
    </div>
  );
}
