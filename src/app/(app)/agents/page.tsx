import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { evaluatePortfolio } from "@/lib/services/portfolio-service";
import { VS_HEX } from "@/lib/services/view-models";
import { MODE_LABEL } from "@/lib/domain/labels";
import { money, num, pct } from "@/lib/format";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { KpiCard } from "@/components/value/kpi-card";
import { AgentFlow } from "@/components/value/agent-flow";
import { IllustrativeBadge } from "@/components/value/badges";
import { TokenCalculator } from "@/components/value/token-calculator";
import { BarsChart } from "@/components/charts/charts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "AI Agents" };

export default async function AgentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { portfolio: p, items } = await evaluatePortfolio({});
  if (!p.initiatives.length) return <NoInitiatives title="AI Agents" description="Agent performance, token economics and cost per task." canCreate={can(await getSession(), "initiative:edit")} />;
  const rows = items.flatMap((e) =>
    e.init.agents.map((a) => ({ a, e, econ: e.value.agents.find((x) => x.agentId === a.id)! })),
  );
  const liveRows = rows.filter((r) => r.a.status === "LIVE");
  const tasks = liveRows.reduce((s, r) => s + r.a.performance.tasksPerMonth, 0);
  const w = (f: (r: (typeof rows)[number]) => number) => liveRows.reduce((s, r) => s + f(r) * r.a.performance.tasksPerMonth, 0) / Math.max(1, tasks);
  const llmAnnual = rows.reduce((s, r) => s + r.econ.annualLlmCost.value, 0);
  const byModel = p.modelPrices.map((m) => ({ name: m.tier, cost: rows.filter((r) => r.a.modelPriceId === m.id).reduce((s, r) => s + r.econ.annualLlmCost.value, 0) }));
  const byProcess = items
    .map((e) => ({ name: e.init.code, cost: e.value.tco.derivedLlmAnnual, perTxn: e.value.tco.derivedLlmAnnual / Math.max(1, e.value.post.transactionsPerYear) }))
    .filter((r) => r.cost > 0)
    .sort((a, b) => b.cost - a.cost);
  const flowInit = items.find((e) => e.init.id === sp.flow) ?? items[0];
  const sort = sp.sort ?? "tasks";
  const sorted = [...rows].sort((x, y) =>
    sort === "autonomy"
      ? x.a.performance.autonomousCompletionRate - y.a.performance.autonomousCompletionRate
      : sort === "cost"
        ? y.econ.annualLlmCost.value - x.econ.annualLlmCost.value
        : sort === "override"
          ? y.a.performance.overrideRate - x.a.performance.overrideRate
          : y.a.performance.tasksPerMonth - x.a.performance.tasksPerMonth,
  );

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Agentic AI · AgentOps · AI FinOps" title="AI Agents" description="Agent registry, agentic process flows, operational performance and model economics — connected to business value." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Agents" value={String(rows.length)} sub={`${liveRows.length} live · ${rows.filter((r) => r.a.status === "PILOT").length} pilot`} />
        <KpiCard label="Tasks / month (live)" value={num(tasks)} />
        <KpiCard label="Autonomous completion" value={pct(w((r) => r.a.performance.autonomousCompletionRate))} sub="task-weighted" />
        <KpiCard label="Escalation rate" value={pct(w((r) => r.a.performance.escalationRate))} sub={`override ${pct(w((r) => r.a.performance.overrideRate))}`} />
        <KpiCard label="Tool-call success" value={pct(w((r) => r.a.performance.toolCallSuccessRate))} />
        <KpiCard label="Annual LLM cost" value={money(llmAnnual)} sub="derived · illustrative prices" />
      </div>

      <SectionCard
        title="Agentic process flow"
        actions={
          <form action="/agents" className="flex items-center gap-2">
            <select name="flow" defaultValue={flowInit.init.id} className="h-8 rounded-md border px-2 text-xs" aria-label="Initiative">
              {items
                .filter((e) => e.init.agents.length > 1)
                .map((e) => (
                  <option key={e.init.id} value={e.init.id}>
                    {e.init.name} ({e.init.agents.length})
                  </option>
                ))}
            </select>
            <button className="h-8 rounded-md border px-2 text-xs hover:bg-muted">Show</button>
          </form>
        }
      >
        <AgentFlow agents={flowInit.init.agents} />
      </SectionCard>

      <SectionCard
        title="Agent registry & performance"
        description="Red = autonomy more than 8 pts below design, or override above 12%. Cost per outcome includes human intervention on escalations."
        actions={
          <div className="flex gap-1 text-xs">
            <span className="text-muted-foreground">Sort:</span>
            {["tasks", "autonomy", "override", "cost"].map((s) => (
              <Link key={s} href={`/agents?sort=${s}${sp.flow ? `&flow=${sp.flow}` : ""}`} className={cn("rounded px-1.5", sort === s ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                {s}
              </Link>
            ))}
          </div>
        }
      >
        <Table>
          <THead>
            <TR>
              <TH>Agent</TH>
              <TH>Initiative</TH>
              <TH>Mode</TH>
              <TH>Model tier</TH>
              <TH className="text-right">Tasks / mo</TH>
              <TH className="text-right">Designed</TH>
              <TH className="text-right">Autonomous</TH>
              <TH className="text-right">Escalation</TH>
              <TH className="text-right">Override</TH>
              <TH className="text-right">Halluc. / mo</TH>
              <TH className="text-right">Latency</TH>
              <TH className="text-right">AI cost / task</TH>
              <TH className="text-right">Cost / outcome</TH>
              <TH className="text-right">LLM / yr</TH>
            </TR>
          </THead>
          <TBody>
            {sorted.map(({ a, e, econ }) => {
              const pf = a.performance;
              return (
                <TR key={a.id}>
                  <TD>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{a.status}</p>
                  </TD>
                  <TD>
                    <Link href={`/initiatives/${e.init.id}/agents`} className="text-xs hover:text-primary">
                      {e.init.code}
                    </Link>
                  </TD>
                  <TD className="text-xs">{MODE_LABEL[a.humanInLoopModel]}</TD>
                  <TD className="text-xs text-muted-foreground">{p.modelPrices.find((m) => m.id === a.modelPriceId)?.tier ?? "—"}</TD>
                  <TD className="text-right">{num(pf.tasksPerMonth)}</TD>
                  <TD className="text-right">{pct(a.automationPct)}</TD>
                  <TD className={cn("text-right", a.status === "LIVE" && pf.autonomousCompletionRate < a.automationPct - 0.08 && "font-medium text-red-700")}>{a.status === "LIVE" ? pct(pf.autonomousCompletionRate) : "—"}</TD>
                  <TD className="text-right">{pct(pf.escalationRate)}</TD>
                  <TD className={cn("text-right", pf.overrideRate > 0.12 && "font-medium text-red-700")}>{pct(pf.overrideRate)}</TD>
                  <TD className="text-right">{pf.hallucinationEventsPerMonth}</TD>
                  <TD className="text-right">{pf.avgLatencySeconds}s</TD>
                  <TD className="text-right">{money(econ.aiCostPerTask.value, { compact: false })}</TD>
                  <TD className="text-right">{money(econ.costPerOutcome.value, { compact: false })}</TD>
                  <TD className="text-right">{money(econ.annualLlmCost.value)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="LLM cost by model tier" actions={<IllustrativeBadge />}>
          <BarsChart data={byModel} xKey="name" layout="horizontal-bars" series={[{ key: "cost", label: "Annual LLM cost", color: "#4a3aa7" }]} height={220} labels />
        </SectionCard>
        <SectionCard title="LLM cost by business process" description="Annual derived token cost per initiative.">
          <BarsChart data={byProcess.slice(0, 12)} xKey="name" layout="horizontal-bars" series={[{ key: "cost", label: "Annual LLM cost", color: VS_HEX.actual }]} height={300} />
        </SectionCard>
        <SectionCard title="Model price configuration" description="Prices are configuration, never hard-coded. Edit in Administration.">
          <Table>
            <THead>
              <TR>
                <TH>Tier</TH>
                <TH className="text-right">In / 1M</TH>
                <TH className="text-right">Cached / 1M</TH>
                <TH className="text-right">Out / 1M</TH>
              </TR>
            </THead>
            <TBody>
              {p.modelPrices.map((m) => (
                <TR key={m.id}>
                  <TD className="text-xs">
                    {m.tier}
                    {m.isIllustrative && <span className="ml-1 text-[10px] text-amber-700">illustrative</span>}
                  </TD>
                  <TD className="text-right">{m.inputPer1M}</TD>
                  <TD className="text-right">{m.cachedInputPer1M}</TD>
                  <TD className="text-right">{m.outputPer1M}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="mt-1 text-[11px] text-muted-foreground">Currency: {p.modelPrices[0]?.currency}.</p>
        </SectionCard>
      </div>
      <SectionCard title="AI FinOps calculator" description="Estimate AI cost per transaction, per month, per year and per business outcome.">
        <TokenCalculator prices={p.modelPrices} />
      </SectionCard>
    </div>
  );
}
