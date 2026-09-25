"use client";
import { useState } from "react";
import { Check, Copy, Loader2, Mail, UserPlus } from "lucide-react";
import type { RoleDefinition } from "@/lib/domain/types";
import type { InvitationRecord, MemberRecord } from "@/lib/identity/store";
import { inviteMemberAction, removeMemberAction, revokeInvitationAction, updateMemberAction } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton, Field, NativeSelect, StatusText, useAction } from "@/components/ui/form-helpers";

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
      <code className="min-w-0 flex-1 truncate text-[11px]">{url}</code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard unavailable: the link is selectable */
          }
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function InviteForm({ roles }: { roles: RoleDefinition[] }) {
  const { pending, msg, fieldErrors, run } = useAction();
  const [form, setForm] = useState({ email: "", name: "", roleKey: "VIEWER", title: "" });
  const [link, setLink] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setLink(null);
        run(
          () => inviteMemberAction(form),
          `Invitation created for ${form.email}. Send them the link below — it works once and expires in 14 days.`,
          (r) => {
            const path = (r as { data?: { path: string } }).data?.path;
            if (path) setLink(`${window.location.origin}${path}`);
            setForm({ email: "", name: "", roleKey: form.roleKey, title: "" });
          },
        );
      }}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <UserPlus className="h-4 w-4" /> Invite a member
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Email" htmlFor="inv-email" error={fieldErrors.email}>
          <Input id="inv-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
        </Field>
        <Field label="Name (optional)" htmlFor="inv-name">
          <Input id="inv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Role" htmlFor="inv-role">
          <NativeSelect id="inv-role" value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value })}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Job title (optional)" htmlFor="inv-title">
          <Input id="inv-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Finance Controller" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Mail />} Create invitation link
        </Button>
        <StatusText msg={msg} />
      </div>
      {link && <CopyLink url={link} />}
    </form>
  );
}

function MemberRow({ m, roles, isSelf }: { m: MemberRecord; roles: RoleDefinition[]; isSelf: boolean }) {
  const { pending, msg, run } = useAction();
  const [title, setTitle] = useState(m.title);
  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-2">
        <p className="font-medium">
          {m.name} {isSelf && <span className="text-[11px] font-normal text-muted-foreground">(you)</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">{m.email}</p>
      </td>
      <td className="py-2 pr-2">
        <Input
          aria-label={`Title for ${m.name}`}
          className="h-8 text-xs"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== m.title && run(() => updateMemberAction({ userId: m.userId, title }), "Title saved.")}
        />
      </td>
      <td className="py-2 pr-2">
        <NativeSelect
          aria-label={`Role for ${m.name}`}
          className="h-8 text-xs"
          value={m.roleKey}
          disabled={pending}
          onChange={(e) => {
            const roleKey = e.target.value;
            run(() => updateMemberAction({ userId: m.userId, roleKey }), `${m.name} is now ${roles.find((r) => r.id === roleKey)?.name}.`);
          }}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
        <StatusText msg={msg} className="mt-1" />
      </td>
      <td className="py-2 text-[11px] text-muted-foreground">{m.joinedAt.slice(0, 10)}</td>
      <td className="py-2 text-right">
        {!isSelf && (
          <ConfirmButton disabled={pending} onConfirm={() => run(() => removeMemberAction(m.userId), `${m.name} was removed.`)} confirmText="Remove?">
            Remove
          </ConfirmButton>
        )}
      </td>
    </tr>
  );
}

export function MembersManager({ members, invitations, roles, selfId }: { members: MemberRecord[]; invitations: InvitationRecord[]; roles: RoleDefinition[]; selfId: string }) {
  const { pending, msg, run } = useAction();
  const open = invitations.filter((i) => !i.acceptedAt);
  return (
    <div className="space-y-4">
      <InviteForm roles={roles} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1.5 font-medium">Member</th>
              <th className="py-1.5 font-medium">Title</th>
              <th className="py-1.5 font-medium">Role</th>
              <th className="py-1.5 font-medium">Joined</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRow key={`${m.userId}-${m.roleKey}`} m={m} roles={roles} isSelf={m.userId === selfId} />
            ))}
          </tbody>
        </table>
      </div>
      {open.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Pending invitations</p>
          {open.map((i) => {
            const expired = new Date(i.expiresAt).getTime() < Date.now();
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
                <span className="font-medium">{i.email}</span>
                <span className="text-muted-foreground">
                  {roles.find((r) => r.id === i.roleKey)?.name ?? i.roleKey} · invited by {i.invitedBy} · {expired ? "expired" : `expires ${i.expiresAt.slice(0, 10)}`}
                </span>
                <ConfirmButton className="ml-auto" disabled={pending} onConfirm={() => run(() => revokeInvitationAction(i.id), "Invitation revoked.")} confirmText="Revoke?">
                  Revoke
                </ConfirmButton>
              </div>
            );
          })}
          <StatusText msg={msg} />
        </div>
      )}
    </div>
  );
}
