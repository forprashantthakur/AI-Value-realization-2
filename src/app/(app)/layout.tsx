import { Sidebar, MobileNav } from "@/components/shell/sidebar";
import { UserMenu, WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import { CurrencyInit } from "@/components/shell/currency-init";
import { AdvisorPanel } from "@/components/advisor/advisor-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAuth, getSession } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/rbac";
import { loadPortfolio } from "@/lib/services/portfolio-service";
import { usesDatabase } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const [auth, portfolio] = await Promise.all([getAuth(), loadPortfolio()]);
  const workspaces = (auth?.workspaces ?? []).map((w) => ({ id: w.id, name: w.name, role: w.id === session.tenantId ? session.roleName : roleLabel(w.roleKey) }));
  return (
    <TooltipProvider delayDuration={200}>
      <CurrencyInit code={portfolio.settings.reportingCurrency} />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
            <MobileNav />
            <WorkspaceSwitcher current={session.tenantId} workspaces={workspaces} />
            <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground md:flex">
              <span className="truncate">
                {portfolio.organizations.length} organization{portfolio.organizations.length === 1 ? "" : "s"} · {portfolio.initiatives.length} AI initiative{portfolio.initiatives.length === 1 ? "" : "s"}
              </span>
              {!usesDatabase() && (
                <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" title="Set DATABASE_URL to persist data">
                  Temporary in-memory store
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <AdvisorPanel />
              <UserMenu name={session.name} email={session.email} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-5 sm:px-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
