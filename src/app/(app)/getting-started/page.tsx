import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { loadPortfolio } from "@/lib/services/portfolio-service";
import { getSession } from "@/lib/auth/session";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { cn } from "@/lib/utils";

export const metadata = { title: "Getting started" };

export default async function GettingStartedPage() {
  const [p, s] = await Promise.all([loadPortfolio(), getSession()]);
  const steps = [
    { done: true, title: "Create the workspace", detail: `${s.tenantName} is ready. Each client or program gets its own workspace.`, href: "/admin?tab=workspace", cta: "Workspace settings" },
    { done: p.organizations.length > 0, title: "Add the client's organization(s) and business units", detail: `${p.organizations.length} organization(s), ${p.businessUnits.length} business unit(s).`, href: "/admin?tab=organizations", cta: "Add organizations" },
    { done: p.processes.length > 0, title: "Review functions, the process taxonomy and KPIs", detail: `${p.functions.length} functions, ${p.processes.length} process nodes, ${p.kpis.length} KPI definitions. Tailor them to the client.`, href: "/admin?tab=processes", cta: "Edit processes" },
    { done: p.modelPrices.some((m) => !m.isIllustrative), title: "Enter contracted AI model prices", detail: "Replace placeholder token prices so agent run costs are real.", href: "/admin?tab=models", cta: "Model prices" },
    { done: true, title: "Check calculation settings", detail: `Currency ${p.settings.reportingCurrency}, discount rate ${(p.settings.discountRate * 100).toFixed(0)}%, ${p.settings.horizonYears}-year horizon.`, href: "/settings", cta: "Settings", optional: true },
    { done: p.users.length > 1, title: "Invite the team", detail: "Business owners, finance validators and product owners each validate their part of the value.", href: "/admin?tab=members", cta: "Invite members" },
    { done: p.initiatives.length > 0, title: "Baseline your first AI initiative", detail: "Capture volume, effort, cost and quality before AI — every benefit is measured against it.", href: "/portfolio/new", cta: "Start baseline" },
    { done: p.initiatives.some((i) => i.actual || i.series.length > 0), title: "Capture post-AI measurements", detail: "Enter the post-AI snapshot or import monthly measurements (CSV/Excel or API).", href: "/import", cta: "Import data" },
    { done: p.initiatives.some((i) => i.benefits.some((b) => b.status !== "PROPOSED")), title: "Submit benefits for validation", detail: "Attach evidence and move benefits through Business → Finance → Realized.", href: "/value-realization", cta: "Governance queue" },
  ];
  const required = steps.filter((x) => !x.optional);
  const done = required.filter((x) => x.done).length;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Onboarding" title="Getting started" description={`Set up ${s.tenantName} to measure and prove the value of AI. ${done} of ${required.length} steps complete.`} />
      <SectionCard title="Setup checklist">
        <ol className="space-y-2">
          {steps.map((x, i) => (
            <li key={x.title} className={cn("flex items-start gap-3 rounded-md border p-3", x.done && "bg-muted/30")}>
              {x.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1baf7a]" aria-label="done" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-label="to do" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {i + 1}. {x.title} {x.optional && <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{x.detail}</p>
              </div>
              <Link href={x.href} className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent">
                {x.cta}
              </Link>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
