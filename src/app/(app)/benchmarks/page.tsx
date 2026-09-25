import { evaluatePortfolio } from "@/lib/services/portfolio-service";
import { EmptyState } from "@/components/ui/misc";
import { DeleteAction } from "@/components/ui/form-helpers";
import { deleteBenchmarkAction } from "@/app/actions/admin";
import { VS_HEX } from "@/lib/services/view-models";
import type { ProcessMetrics } from "@/lib/domain/types";
import { hoursLabel, pct } from "@/lib/format";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { IllustrativeBadge } from "@/components/value/badges";
import { BenchmarkUpload } from "@/components/value/benchmark-upload";
import { BarsChart } from "@/components/charts/charts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata = { title: "Benchmarks" };

export default async function BenchmarksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [{ portfolio: p, items }, session] = await Promise.all([evaluatePortfolio({}), getSession()]);
  const bm = p.benchmarks.find((b) => b.id === sp.bm) ?? p.benchmarks[0];
  if (!bm)
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Internal benchmark engine" title="Benchmarks" description="Compare current process, industry benchmark, top quartile, post-AI target and actual post-AI." />
        <EmptyState title="No benchmarks in this workspace yet" description="Add validated enterprise or industry benchmarks (with their source). Bulk upload is available in Data Import." />
        {can(session, "reference:manage") && p.functions.length > 0 && (
          <SectionCard title="Add a benchmark">
            <BenchmarkUpload functions={p.functions.filter((x) => x.isActive)} industries={p.industries} />
          </SectionCard>
        )}
      </div>
    );
  const key = bm.metric as keyof ProcessMetrics;
  const isPct = bm.unit === "%";
  const f = (n: number) => (isPct ? pct(n, 1) : bm.unit === "hours" ? hoursLabel(n) : `${n.toFixed(1)} ${bm.unit}`);
  const inScope = items.filter((e) => e.init.functionId === bm.functionId && (!bm.industryId || p.organizations.find((o) => o.id === e.init.organizationId)?.industryId === bm.industryId));
  const data = inScope.map((e) => ({
    name: e.init.code,
    current: e.init.baseline.metrics[key] as number,
    median: bm.median,
    topQuartile: bm.topQuartile,
    target: e.init.target.metrics[key] as number,
    actual: e.init.actual ? (e.value.post[key] as number) : null,
  }));
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Internal benchmark engine"
        title="Benchmarks"
        description="Compare current process, industry benchmark, top quartile, post-AI target and actual post-AI."
        actions={p.benchmarks.some((b) => b.isIllustrative) ? <IllustrativeBadge text="Illustrative benchmarks present — replace with validated data." /> : undefined}
      />
      <SectionCard
        title={`${bm.label} — ${p.functions.find((x) => x.id === bm.functionId)?.name}${bm.industryId ? ` · ${p.industries.find((i) => i.id === bm.industryId)?.name}` : ""}`}
        description={`Source: ${bm.source}`}
        actions={
          <form action="/benchmarks" className="flex items-center gap-2">
            <select name="bm" defaultValue={bm.id} className="h-8 rounded-md border px-2 text-xs" aria-label="Benchmark">
              {p.benchmarks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} {b.isIllustrative ? "(illustrative)" : "(org)"}
                </option>
              ))}
            </select>
            <button className="h-8 rounded-md border px-2 text-xs hover:bg-muted">Show</button>
          </form>
        }
      >
        {data.length ? (
          <BarsChart
            data={data}
            xKey="name"
            fmt={isPct ? "percent" : "number"}
            series={[
              { key: "current", label: "Current (baseline)", color: "#898781" },
              { key: "median", label: "Benchmark median", color: "#c3c2b7" },
              { key: "topQuartile", label: "Top quartile", color: "#4a3aa7" },
              { key: "target", label: "Post-AI target", color: VS_HEX.target },
              { key: "actual", label: "Actual post-AI", color: VS_HEX.actual },
            ]}
            height={300}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No initiatives in scope for this benchmark.</p>
        )}
        <Table className="mt-3">
          <THead>
            <TR>
              <TH>Initiative</TH>
              <TH className="text-right">Current</TH>
              <TH className="text-right">Median</TH>
              <TH className="text-right">Top quartile</TH>
              <TH className="text-right">Target</TH>
              <TH className="text-right">Actual</TH>
              <TH>Position</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((d) => {
              const lowerBetter = !["firstTimeRight", "slaAchievement"].includes(key);
              const v = d.actual ?? d.current;
              const better = (a: number, b: number) => (lowerBetter ? a <= b : a >= b);
              const pos = better(v, d.topQuartile) ? "Top quartile" : better(v, d.median) ? "Above median" : "Below median";
              return (
                <TR key={d.name}>
                  <TD className="font-medium">{d.name}</TD>
                  <TD className="text-right">{f(d.current)}</TD>
                  <TD className="text-right text-muted-foreground">{f(d.median)}</TD>
                  <TD className="text-right text-muted-foreground">{f(d.topQuartile)}</TD>
                  <TD className="text-right">{f(d.target)}</TD>
                  <TD className="text-right font-medium">{d.actual === null ? "—" : f(d.actual)}</TD>
                  <TD className="text-xs">{pos}{d.actual === null ? " (baseline)" : ""}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </SectionCard>
      <SectionCard title="Benchmark library">
        {p.benchmarks.length === 0 ? <EmptyState title="No benchmarks yet" description="Upload validated enterprise or industry benchmarks below (or in bulk via Data Import)." /> : <Table>
          <THead>
            <TR>
              <TH>Benchmark</TH>
              <TH>Function</TH>
              <TH>Industry</TH>
              <TH className="text-right">Median</TH>
              <TH className="text-right">Top quartile</TH>
              <TH>Source</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {p.benchmarks.map((b) => (
              <TR key={b.id}>
                <TD className="font-medium">{b.label}</TD>
                <TD>{p.functions.find((x) => x.id === b.functionId)?.name}</TD>
                <TD>{b.industryId ? p.industries.find((i) => i.id === b.industryId)?.name : "Cross-industry"}</TD>
                <TD className="text-right">{b.unit === "%" ? pct(b.median, 1) : `${b.median} ${b.unit}`}</TD>
                <TD className="text-right">{b.unit === "%" ? pct(b.topQuartile, 1) : `${b.topQuartile} ${b.unit}`}</TD>
                <TD className="max-w-xs text-xs">{b.isIllustrative ? <IllustrativeBadge /> : `${b.source} · ${b.uploadedBy ?? ""}`}</TD>
                <TD className="text-right">{can(session, "reference:manage") && <DeleteAction id={b.id} action={deleteBenchmarkAction} />}</TD>
              </TR>
            ))}
          </TBody>
        </Table>}
      </SectionCard>
      {can(session, "reference:manage") && (
        <SectionCard title="Upload your own benchmark" description="Organization-provided benchmarks require a source and are shown without the illustrative label. Bulk upload via Data Import (CSV/Excel).">
          <BenchmarkUpload functions={p.functions.filter((x) => x.isActive)} industries={p.industries} />
        </SectionCard>
      )}
    </div>
  );
}
