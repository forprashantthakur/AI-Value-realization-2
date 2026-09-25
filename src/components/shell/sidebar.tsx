"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Briefcase,
  FileSpreadsheet,
  FileText,
  Gauge,
  LayoutDashboard,
  Network,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Upload,
  Workflow,
  Menu,
  Rocket,
  X,
} from "lucide-react";
import { useState } from "react";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";

const ICONS = { Rocket, Activity, Bot, Briefcase, FileSpreadsheet, FileText, Gauge, LayoutDashboard, Network, Settings, ShieldCheck, SlidersHorizontal, Target, Upload, Workflow };

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Main">
      {NAV.map((n) => {
        const Icon = ICONS[n.icon];
        const active = path === n.href || path.startsWith(n.href + "/") || (n.href === "/portfolio" && path.startsWith("/initiatives"));
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-active hover:text-white",
              active && "bg-sidebar-active font-medium text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-white" aria-hidden>
        AV
      </div>
      <div className="leading-tight">
        <p className="text-[13px] font-semibold text-white">AI Value Realization</p>
        <p className="text-[10px] uppercase tracking-wider text-sidebar-muted">Enterprise Value Management</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto bg-sidebar lg:flex">
      <Brand />
      <NavLinks />
      <div className="mt-auto px-4 py-4 text-[10px] leading-relaxed text-sidebar-muted">
        Starter model-price tiers are placeholders — replace them with your contracted rates in Administration.
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-muted" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 overflow-y-auto bg-sidebar pb-6">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <button onClick={() => setOpen(false)} className="rounded p-1 text-white/80" aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <button className="flex-1 bg-slate-900/40" aria-label="Close navigation" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
