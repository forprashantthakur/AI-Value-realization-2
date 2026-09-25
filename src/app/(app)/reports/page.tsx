import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { REPORT_META, type ReportType } from "@/lib/reporting/builders";
import { loadPortfolio } from "@/lib/services/portfolio-service";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const p = await loadPortfolio();
  if (!p.initiatives.length) return <NoInitiatives title="Reports" description="Executive, process, CFO and portfolio reports with PDF, Excel and CSV export." canCreate={can(await getSession(), "initiative:edit")} />;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const defaultInit = sp.initiative ?? p.initiatives[0]?.id ?? "";
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        description="Consulting-style reports built from the same engine outputs as the dashboards. Export to PDF (print), Excel or CSV."
      />
      <SectionCard title="Scope">
        <form action="/reports" className="flex flex-wrap items-end gap-2 text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Organization</span>
            <select name="org" defaultValue={sp.org ?? ""} className="h-8 rounded-md border px-2">
              <option value="">All</option>
              {p.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Function</span>
            <select name="fn" defaultValue={sp.fn ?? ""} className="h-8 rounded-md border px-2">
              <option value="">All</option>
              {p.functions
                .filter((f) => f.isActive)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Initiative (Process / CFO report)</span>
            <select name="initiative" defaultValue={defaultInit} className="h-8 rounded-md border px-2">
              {p.initiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} · {i.name}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="outline">
            Apply
          </Button>
        </form>
      </SectionCard>
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(REPORT_META) as ReportType[]).map((t) => {
          const m = REPORT_META[t];
          const q = new URLSearchParams(qs);
          if (m.needsInitiative) q.set("initiative", defaultInit);
          else if (t !== "cfo") q.delete("initiative");
          const cfoQ = new URLSearchParams(qs);
          cfoQ.delete("initiative");
          const query = t === "cfo" ? cfoQ.toString() : q.toString();
          return (
            <SectionCard key={t} title={m.title} description={`${m.audience} — ${m.description}`}>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/reports/${t}?${query}`}>
                    <FileText /> Open · Print / PDF
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/export?report=${t}&format=xlsx&${query}`}>
                    <FileSpreadsheet /> Excel
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/export?report=${t}&format=csv&${query}`}>
                    <Sheet /> CSV
                  </a>
                </Button>
              </div>
              {t === "cfo" && <p className="mt-2 text-[11px] text-muted-foreground">Portfolio scope by default; open from an initiative&apos;s Reports tab for a single-initiative CFO pack.</p>}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
