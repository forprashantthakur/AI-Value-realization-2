import Link from "next/link";
import { Rocket } from "lucide-react";
import { PageHeader } from "./page-header";

/** Shown by analytical pages until the workspace has at least one initiative. */
export function NoInitiatives({ title, description, canCreate }: { title: string; description: string; canCreate: boolean }) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card p-10 text-center">
        <Rocket className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">No AI initiatives in this workspace yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          This view fills in as soon as you baseline your first initiative. Set up the client&apos;s organization and processes, then run the baseline assessment.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {canCreate && (
            <Link href="/portfolio/new" className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Baseline a new initiative
            </Link>
          )}
          <Link href="/getting-started" className="inline-flex h-9 items-center rounded-md border bg-card px-3.5 text-sm font-medium hover:bg-accent">
            Getting-started checklist
          </Link>
        </div>
      </div>
    </div>
  );
}
