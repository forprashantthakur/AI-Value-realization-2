import { Sidebar, MobileNav } from "@/components/shell/sidebar";
import { PersonaSwitcher } from "@/components/shell/persona-switcher";
import { AdvisorPanel } from "@/components/advisor/advisor-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSession } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/rbac";
import { loadPortfolio } from "@/lib/services/portfolio-service";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, portfolio, repo] = await Promise.all([getSession(), loadPortfolio(), getRepository()]);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
            <MobileNav />
            <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="truncate">
                {portfolio.organizations.length} organizations · {portfolio.initiatives.length} AI initiatives
              </span>
              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Fictional demo data</span>
              <span className="rounded border px-1.5 py-0.5 text-[10px]" title="Data source">
                {repo.kind === "prisma" ? "PostgreSQL" : "In-memory demo store"}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <AdvisorPanel />
              <PersonaSwitcher
                current={session.userId}
                users={portfolio.users.map((u) => ({ id: u.id, name: u.name, role: roleLabel(u.role) }))}
              />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-5 sm:px-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
