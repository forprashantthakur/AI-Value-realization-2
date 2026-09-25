import Link from "next/link";
import { loadPortfolio } from "@/lib/services/portfolio-service";
import { PageHeader } from "@/components/value/page-header";
import { BaselineWizard } from "@/components/initiative/baseline-wizard";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "New initiative — Baseline assessment" };

export default async function NewInitiativePage() {
  const [p, s] = await Promise.all([loadPortfolio(), getSession()]);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Discover → Baseline" title="Baseline assessment wizard" description="Capture the process before AI so value can be measured after. Every later benefit is computed against these numbers." />
      {can(s, "initiative:edit") && (p.organizations.length === 0 || p.businessUnits.length === 0 || p.processes.length === 0) ? (
        <EmptyState
          title="Set up the client structure first"
          description={`An initiative belongs to an organization, a business unit and a process. Missing: ${[p.organizations.length === 0 && "organization", p.businessUnits.length === 0 && "business unit", p.processes.length === 0 && "process"].filter(Boolean).join(", ")}.`}
          action={
            <Link href={p.processes.length === 0 && p.organizations.length > 0 && p.businessUnits.length > 0 ? "/admin?tab=processes" : "/admin?tab=organizations"} className="text-xs font-medium text-primary hover:underline">
              Open Administration
            </Link>
          }
        />
      ) : can(s, "initiative:edit") ? (
        <BaselineWizard
          organizations={p.organizations}
          businessUnits={p.businessUnits}
          functions={p.functions.filter((f) => f.isActive)}
          processes={p.processes}
          industries={p.industries}
          defaultProductiveHours={p.settings.defaultProductiveHours}
          owner={s.name}
        />
      ) : (
        <EmptyState title="Your role cannot create initiatives" description="Ask a workspace administrator for a role with the “Create and edit initiatives” permission." />
      )}
    </div>
  );
}
