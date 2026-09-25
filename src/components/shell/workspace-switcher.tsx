"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Building2, Check, ChevronsUpDown, Loader2, LogOut, Plus, UserCog } from "lucide-react";
import { signOutAction, switchWorkspaceAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const itemCls = "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-muted";
const contentCls = "z-50 min-w-[240px] rounded-md border bg-card p-1 shadow-md";

export function WorkspaceSwitcher({ current, workspaces }: { current: string; workspaces: { id: string; name: string; role: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cur = workspaces.find((w) => w.id === current);
  return (
    <DM.Root>
      <DM.Trigger className="flex max-w-[260px] items-center gap-2 rounded-md border bg-card px-2 py-1 text-left text-xs hover:bg-muted" aria-label="Switch workspace">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className="min-w-0">
          <span className="block truncate font-medium">{cur?.name ?? "Workspace"}</span>
          <span className="block truncate text-[10px] text-muted-foreground">{cur?.role}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="start" sideOffset={4} className={contentCls}>
          <DM.Label className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Workspaces</DM.Label>
          {workspaces.map((w) => (
            <DM.Item
              key={w.id}
              className={itemCls}
              onSelect={() =>
                w.id !== current &&
                start(async () => {
                  const r = await switchWorkspaceAction(w.id);
                  if (r.ok) {
                    router.push("/dashboard");
                    router.refresh();
                  }
                })
              }
            >
              <Check className={cn("h-3.5 w-3.5", w.id === current ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              <span className="text-[10px] text-muted-foreground">{w.role}</span>
            </DM.Item>
          ))}
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item asChild className={itemCls}>
            <Link href="/workspaces/new">
              <Plus className="h-3.5 w-3.5" /> New workspace
            </Link>
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function UserMenu({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <DM.Root>
      <DM.Trigger className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold text-white" aria-label="Account menu">
        {initials}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={4} className={contentCls}>
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium">{name}</p>
            <p className="text-[11px] text-muted-foreground">{email}</p>
          </div>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item asChild className={itemCls}>
            <Link href="/account">
              <UserCog className="h-3.5 w-3.5" /> Account & password
            </Link>
          </DM.Item>
          <DM.Item
            className={itemCls}
            onSelect={async () => {
              await signOutAction();
              window.location.href = "/login";
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
