import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { evaluatePortfolio } from "@/lib/services/portfolio-service";
import { comparisonRows } from "@/lib/services/initiative-vm";
import { VS_HEX } from "@/lib/services/view-models";
import { MODE_LABEL } from "@/lib/domain/labels";
import { AUTOMATION_MODES, type ProcessNode } from "@/lib/domain/types";
import { money, pct } from "@/lib/format";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { ComparisonTable } from "@/components/value/comparison-table";
import { IllustrativeBadge } from "@/components/value/badges";
import { BarsChart } from "@/components/charts/charts";
import { cn } from "@/lib/utils";

export const metadata = { title: "Processes" };

const MODE_COLOR: Record<string, string> = {
  MANUAL: "#c3c2b7",
  RULES_BASED: "#9ec5f4",
  RPA: "#86b6ef",
  AI_ASSISTED: "#5598e7",
  AI_AUTOMATED: "#2a78d6",
  AGENT_EXECUTED: "#4a3aa7",
  HUMAN_IN_THE_LOOP: "#eda100",
  HUMAN_APPROVED: "#eb6834",
};

export default async function ProcessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { portfolio: p, items } = await evaluatePortfolio({});
  if (!p.initiatives.length) return <NoInitiatives title="Processes" description="Process hierarchy with AI value overlays." canCreate={can(await getSession(), "initiative:edit")} />;
  const live = items.filter((e) => e.init.actual);
  const selected = live.find((e) => e.init.id === sp.initiative) ?? live[0];
  const fnFilter = sp.fn ?? selected?.init.functionId ?? p.functions.find((f) => p.processes.some((x) => x.functionId === f.id))?.id ?? "";
  const tree = (parent: string | null, fn: string, depth = 0): { n: ProcessNode; depth: number }[] =>
    p.processes.filter((x) => x.functionId === fn && x.parentId === parent).flatMap((n) => [{ n, depth }, ...tree(n.id, fn, depth + 1)]);
  const rows = tree(null, fnFilter);
  const modeCounts = AUTOMATION_MODES.map((m) => ({ name: MODE_LABEL[m], count: p.processes.filter((x) => x.automationMode === m && x.level !== "PROCESS").length, color: MODE_COLOR[m] }));
  const initByProcess = (id: string) => items.filter((e) => e.init.processId === id);
  const v = selected?.value;
  const b = selected?.init.baseline.metrics;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Process model"
        title="Processes"
        description="Function → Process → Sub-process → Activity → Task → AI agent. Each node is classified by execution mode; initiatives attach at any level."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <SectionCard
          title="Process hierarchy & activity classification"
          actions={
            <div className="flex flex-wrap gap-1 text-xs">
              {p.functions
                .filter((f) => f.isActive)
                .map((f) => (
                  <Link key={f.id} href={`/processes?fn=${f.id}${sp.initiative ? `&initiative=${sp.initiative}` : ""}`} className={cn("rounded px-1.5 py-0.5", f.id === fnFilter ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                    {f.name}
                  </Link>
                ))}
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 font-medium">Node</th>
                  <th className="py-1.5 font-medium">Level</th>
                  <th className="py-1.5 font-medium">Execution mode</th>
                  <th className="py-1.5 font-medium">AI initiatives</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ n, depth }) => (
                  <tr key={n.id} className="border-b last:border-0">
                    <td className="py-1.5" style={{ paddingLeft: depth * 18 }}>
                      <span className={depth === 0 ? "font-semibold" : ""}>{n.name}</span>
                    </td>
                    <td className="py-1.5 text-muted-foreground">{n.level.toLowerCase()}</td>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: MODE_COLOR[n.automationMode] }} />
                        {MODE_LABEL[n.automationMode]}
                      </span>
                    </td>
                    <td className="py-1.5">
                      {initByProcess(n.id).map((e) => (
                        <Link key={e.init.id} href={`/processes?fn=${fnFilter}&initiative=${e.init.id}`} className="mr-1 rounded border px-1 hover:border-primary">
                          {e.init.code}
                        </Link>
                      ))}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      No processes configured for this function yet — add them in Administration.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title="Execution mode mix" description="Sub-processes, activities and tasks across all functions.">
          <BarsChart data={modeCounts} xKey="name" layout="horizontal-bars" colorBy="color" fmt="number" series={[{ key: "count", label: "Nodes" }]} height={280} labels />
        </SectionCard>
      </div>

      {selected && v && b && (
        <SectionCard
          title={`Process comparison — ${selected.init.name}`}
          q="outcomes"
          description="Before AI vs after AI on identical KPI definitions."
          actions={
            <form className="flex items-center gap-2" action="/processes">
              <input type="hidden" name="fn" value={fnFilter} />
              <select name="initiative" defaultValue={selected.init.id} className="h-8 rounded-md border px-2 text-xs" aria-label="Initiative">
                {live.map((e) => (
                  <option key={e.init.id} value={e.init.id}>
                    {e.init.code} · {e.init.name}
                  </option>
                ))}
              </select>
              <button className="h-8 rounded-md border px-2 text-xs hover:bg-muted">Compare</button>
            </form>
          }
        >
          <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <div className="space-y-2">
              <ComparisonTable rows={comparisonRows(selected.init, v, p.benchmarks)} showBenchmark />
              <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <IllustrativeBadge text="Benchmarks illustrative" /> Replace with validated enterprise or industry data in Benchmarks.
              </p>
            </div>
            <div className="space-y-3">
              <BarsChart
                data={[
                  { name: "Touch time (min)", Baseline: b.avgHandlingMinutes, "Post-AI": v.post.avgHandlingMinutes },
                  { name: "Cycle time (h)", Baseline: b.cycleTimeHours, "Post-AI": v.post.cycleTimeHours },
                  { name: "FTE requirement", Baseline: v.capacity.baselineRequiredFte.value, "Post-AI": v.capacity.postRequiredFte.value },
                ]}
                xKey="name"
                fmt="number"
                series={[
                  { key: "Baseline", label: "Baseline", color: "#898781" },
                  { key: "Post-AI", label: "Post-AI", color: VS_HEX.actual },
                ]}
                height={200}
              />
              <BarsChart
                data={[{ name: "Cost / transaction", Baseline: v.cost.perTxnBaseline.value, "Post-AI": v.cost.perTxnPost.value }]}
                xKey="name"
                series={[
                  { key: "Baseline", label: "Baseline", color: "#898781" },
                  { key: "Post-AI", label: "Post-AI (incl. AI run cost)", color: VS_HEX.actual },
                ]}
                height={160}
                layout="horizontal-bars"
                labels
              />
              <p className="text-xs text-muted-foreground">
                Annual AI-attributed benefit {money(v.totals.counted)} · adoption {pct(v.post.adoptionRate)} · automation {pct(v.post.automationRate)}
              </p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
