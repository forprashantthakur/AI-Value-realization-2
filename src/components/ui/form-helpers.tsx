"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type Msg = { ok: boolean; text: string } | null;
type Result = { ok: true; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Runs a server action inside a transition, shows the outcome and refreshes server data on success. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<Msg>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const run = React.useCallback(
    <R extends Result>(fn: () => Promise<R>, success?: string | null | ((r: R) => string | null), after?: (r: R) => void) =>
      start(async () => {
        const r = await fn();
        if (r.ok) {
          setFieldErrors({});
          const text = typeof success === "function" ? success(r) : success;
          setMsg(text ? { ok: true, text } : null);
          after?.(r);
          router.refresh();
        } else {
          setFieldErrors(r.fieldErrors ?? {});
          setMsg({ ok: false, text: r.error });
        }
      }),
    [router],
  );
  return { pending, msg, setMsg, fieldErrors, run };
}

export function StatusText({ msg, className }: { msg: Msg; className?: string }) {
  if (!msg) return null;
  return (
    <p className={cn("text-xs", msg.ok ? "text-[#006300]" : "text-red-700", className)} role="status">
      {msg.text}
    </p>
  );
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("h-9 w-full rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60", className)} {...props} />
));
NativeSelect.displayName = "NativeSelect";

export function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-red-700">{error}</p>}
    </div>
  );
}

/** Two-step inline confirmation for destructive actions (no browser dialogs). */
export function ConfirmButton({ onConfirm, children, confirmText = "Confirm delete", disabled, className }: { onConfirm: () => void; children: React.ReactNode; confirmText?: string; disabled?: boolean; className?: string }) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:opacity-50",
        armed ? "bg-red-600 text-white hover:bg-red-700" : "text-red-700 hover:bg-red-50",
        className,
      )}
    >
      {armed ? confirmText : children}
    </button>
  );
}

/** Delete button bound to a server action taking an id; confirms inline, then refreshes. */
export function DeleteAction({ id, action, label = "Delete", disabled }: { id: string; action: (id: string) => Promise<Result>; label?: string; disabled?: boolean }) {
  const { pending, msg, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end">
      <ConfirmButton disabled={disabled || pending} onConfirm={() => run(() => action(id))} confirmText={`${label}?`}>
        {label}
      </ConfirmButton>
      {msg && !msg.ok && <StatusText msg={msg} />}
    </span>
  );
}
