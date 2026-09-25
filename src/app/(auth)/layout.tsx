export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar text-xs font-bold text-white" aria-hidden>
          AV
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">AI Value Realization</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Enterprise Value Management</p>
        </div>
      </div>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}
