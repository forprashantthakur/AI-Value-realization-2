"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { acceptInvitationAction, createWorkspaceAction, signInAction, signUpAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/ui/form-helpers";
import { Switch } from "@/components/ui/misc";

type R = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD", "CAD", "CHF"];

function useSubmit(to: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submit = (fn: () => Promise<R>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        router.replace(to);
        router.refresh();
      } else {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  return { pending, error, fieldErrors, submit };
}

function ErrorBox({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
      {error}
    </p>
  ) : null;
}

export function LoginForm({ allowSignup }: { allowSignup: boolean }) {
  const { pending, error, fieldErrors, submit } = useSubmit("/dashboard");
  const [f, setF] = useState({ email: "", password: "" });
  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), submit(() => signInAction(f)))}>
      <div>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-xs text-muted-foreground">Access your client workspaces.</p>
      </div>
      <Field label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input id="email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Password" htmlFor="password" error={fieldErrors.password}>
        <Input id="password" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <ErrorBox error={error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Sign in
      </Button>
      {allowSignup ? (
        <p className="text-center text-xs text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">Access is by invitation. Ask your workspace administrator for a link.</p>
      )}
    </form>
  );
}

function WorkspaceFields({ f, setF, fieldErrors }: { f: { workspaceName: string; currency: string; starter: boolean }; setF: (p: Partial<{ workspaceName: string; currency: string; starter: boolean }>) => void; fieldErrors: Record<string, string> }) {
  return (
    <>
      <Field label="Workspace name" htmlFor="ws" error={fieldErrors.workspaceName ?? fieldErrors.name} hint="One workspace per client or program. You can create more later.">
        <Input id="ws" required value={f.workspaceName} onChange={(e) => setF({ workspaceName: e.target.value })} placeholder="e.g. Acme Corp — AI Value Program" />
      </Field>
      <Field label="Reporting currency" htmlFor="cur">
        <NativeSelect id="cur" value={f.currency} onChange={(e) => setF({ currency: e.target.value })}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex items-start gap-3 rounded-md border p-3 text-xs">
        <Switch checked={f.starter} onCheckedChange={(v) => setF({ starter: v })} aria-label="Include starter catalog" />
        <span>
          <span className="font-medium">Include the starter catalog</span>
          <span className="block text-muted-foreground">Industries, a Finance/Procurement/HR process taxonomy, KPI definitions and placeholder model-price tiers — all editable. No client data.</span>
        </span>
      </label>
    </>
  );
}

export function SignupForm() {
  const { pending, error, fieldErrors, submit } = useSubmit("/getting-started");
  const [f, setF] = useState({ name: "", email: "", password: "", workspaceName: "", currency: "INR", starter: true, title: "" });
  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), submit(() => signUpAction(f)))}>
      <div>
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="text-xs text-muted-foreground">You&apos;ll be the administrator of your first workspace.</p>
      </div>
      <Field label="Your name" htmlFor="name" error={fieldErrors.name}>
        <Input id="name" autoComplete="name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Work email" htmlFor="email" error={fieldErrors.email}>
        <Input id="email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Password" htmlFor="password" error={fieldErrors.password} hint="At least 10 characters.">
        <Input id="password" type="password" autoComplete="new-password" required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <WorkspaceFields f={f} setF={(p) => setF({ ...f, ...p })} fieldErrors={fieldErrors} />
      <ErrorBox error={error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Create account & workspace
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function NewWorkspaceForm({ first }: { first: boolean }) {
  const { pending, error, fieldErrors, submit } = useSubmit("/getting-started");
  const [f, setF] = useState({ workspaceName: "", currency: "INR", starter: true, title: "" });
  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), submit(() => createWorkspaceAction({ name: f.workspaceName, currency: f.currency, starter: f.starter, title: f.title })))}>
      <div>
        <h1 className="text-lg font-semibold">{first ? "Create your first workspace" : "New workspace"}</h1>
        <p className="text-xs text-muted-foreground">Each workspace keeps one client&apos;s organizations, initiatives, members and settings completely separate.</p>
      </div>
      <WorkspaceFields f={f} setF={(p) => setF({ ...f, ...p })} fieldErrors={fieldErrors} />
      <Field label="Your title in this workspace (optional)" htmlFor="title">
        <Input id="title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Engagement lead" />
      </Field>
      <ErrorBox error={error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Create workspace
      </Button>
      {!first && (
        <p className="text-center text-xs">
          <Link href="/dashboard" className="text-muted-foreground hover:underline">
            Cancel
          </Link>
        </p>
      )}
    </form>
  );
}

export function AcceptInviteForm({ token, email, workspace, role, mode, defaultName }: { token: string; email: string; workspace: string; role: string; mode: "join" | "create" | "password"; defaultName: string }) {
  const { pending, error, fieldErrors, submit } = useSubmit("/dashboard");
  const [f, setF] = useState({ name: defaultName, password: "" });
  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), submit(() => acceptInvitationAction({ token, ...f })))}>
      <div>
        <h1 className="text-lg font-semibold">Join {workspace}</h1>
        <p className="text-xs text-muted-foreground">
          You&apos;ve been invited as <span className="font-medium">{role}</span> ({email}).
        </p>
      </div>
      {mode === "create" && (
        <>
          <Field label="Your name" htmlFor="name" error={fieldErrors.name}>
            <Input id="name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Choose a password" htmlFor="password" error={fieldErrors.password} hint="At least 10 characters.">
            <Input id="password" type="password" autoComplete="new-password" required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
        </>
      )}
      {mode === "password" && (
        <Field label={`Password for ${email}`} htmlFor="password" hint="You already have an account — confirm it to join this workspace.">
          <Input id="password" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
      )}
      <ErrorBox error={error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Accept invitation
      </Button>
    </form>
  );
}
