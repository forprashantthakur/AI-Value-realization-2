"use client";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, StatusText, useAction } from "@/components/ui/form-helpers";

export function ProfileForm({ name }: { name: string }) {
  const { pending, msg, fieldErrors, run } = useAction();
  const [n, setN] = useState(name);
  return (
    <form className="flex max-w-md items-end gap-2" onSubmit={(e) => (e.preventDefault(), run(() => updateProfileAction({ name: n }), "Name updated."))}>
      <Field label="Display name" htmlFor="acc-name" error={fieldErrors.name} className="flex-1">
        <Input id="acc-name" value={n} onChange={(e) => setN(e.target.value)} />
      </Field>
      <Button type="submit" size="sm" disabled={pending || n.trim() === name}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
      </Button>
      <StatusText msg={msg} />
    </form>
  );
}

export function PasswordForm() {
  const { pending, msg, fieldErrors, run } = useAction();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.next !== f.confirm) return run(async () => ({ ok: false as const, error: "The new passwords don't match." }));
        run(() => changePasswordAction({ current: f.current, next: f.next }), "Password changed.", () => setF({ current: "", next: "", confirm: "" }));
      }}
    >
      <Field label="Current password" htmlFor="pw-cur" error={fieldErrors.current}>
        <Input id="pw-cur" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      </Field>
      <Field label="New password" htmlFor="pw-new" error={fieldErrors.next} hint="At least 10 characters.">
        <Input id="pw-new" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-conf">
        <Input id="pw-conf" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !f.current || !f.next}>
          {pending && <Loader2 className="animate-spin" />} Change password
        </Button>
        <StatusText msg={msg} />
      </div>
    </form>
  );
}
