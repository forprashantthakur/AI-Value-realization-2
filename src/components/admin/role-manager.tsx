"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Plus, Save, Trash2, X } from "lucide-react";
import type { RoleDefinition, User } from "@/lib/domain/types";
import { PERMISSION_LABEL, PERMISSIONS, type Permission } from "@/lib/auth/rbac";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/app/actions/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Msg = { ok: boolean; text: string } | null;
const ADMIN = "ENTERPRISE_ADMIN";
const SHORT: Record<Permission, string> = {
  "portfolio:view": "View",
  "initiative:edit": "Initiatives",
  "initiative:delete": "Delete initiatives",
  "measurement:edit": "Measure",
  "cost:edit": "Costs",
  "benefit:submit": "Benefits",
  "scenario:edit": "Scenarios",
  "settings:edit": "Settings",
  "reference:manage": "Reference data",
  "users:manage": "Members & roles",
  "workspace:manage": "Workspace",
  "data:import": "Import",
  "report:export": "Export",
  "audit:view": "Audit",
};

function Status({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={cn("text-xs", msg.ok ? "text-[#006300]" : "text-red-700")} role="status">
      {msg.text}
    </p>
  );
}

/** Create a custom role, optionally starting from an existing role's permissions. */
function AddRole({ roles }: { roles: RoleDefinition[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<string[]>(["portfolio:view"]);
  const [from, setFrom] = useState("");
  const copy = (id: string) => {
    setFrom(id);
    setPerms(roles.find((r) => r.id === id)?.permissions ?? ["portfolio:view"]);
  };
  const toggle = (p: string) => setPerms(perms.includes(p) ? perms.filter((x) => x !== p) : [...perms, p]);
  return (
    <form
      className="space-y-3 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createRoleAction({ name, description, permissions: perms });
          if (r.ok) {
            setMsg({ ok: true, text: `Role "${name}" added. Assign it to users below.` });
            setName("");
            setDescription("");
            setPerms(["portfolio:view"]);
            setFrom("");
            router.refresh();
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <p className="section-title">Add a role</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="role-name">Role name</Label>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Risk Officer" required minLength={2} maxLength={60} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role-desc">Description</Label>
          <Input id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role does" maxLength={200} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role-copy">Start from permissions of</Label>
          <select id="role-copy" value={from} onChange={(e) => copy(e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
            <option value="">— none (view only) —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 text-xs font-medium">Permissions</legend>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {PERMISSIONS.map((p) => (
            <label key={p} className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={perms.includes(p)} disabled={p === "portfolio:view"} onChange={() => toggle(p)} />
              <span>
                {PERMISSION_LABEL[p]}
                {p === "portfolio:view" && <span className="text-muted-foreground"> (always on)</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add role
        </Button>
        <Status msg={msg} />
      </div>
    </form>
  );
}

/** One row of the role table: edit permissions inline, delete custom roles with user reassignment. */
function RoleRow({ role, roles, userCount }: { role: RoleDefinition; roles: RoleDefinition[]; userCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [perms, setPerms] = useState(role.permissions);
  const [name, setName] = useState(role.name);
  const [confirming, setConfirming] = useState(false);
  const [reassignTo, setReassignTo] = useState(roles.find((r) => r.id === "VIEWER" && r.id !== role.id)?.id ?? roles.find((r) => r.id !== role.id)?.id ?? "");
  const [msg, setMsg] = useState<Msg>(null);
  const locked = role.id === ADMIN;
  const dirty = name !== role.name || perms.slice().sort().join() !== role.permissions.slice().sort().join();

  const save = () =>
    start(async () => {
      const r = await updateRoleAction({ id: role.id, name, description: role.description, permissions: perms });
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  const remove = () =>
    start(async () => {
      const r = await deleteRoleAction({ id: role.id, reassignTo });
      if (r.ok) router.refresh();
      else setMsg({ ok: false, text: r.error });
    });

  return (
    <>
      <tr className="border-b align-top">
        <td className="py-2 pr-2">
          {locked || role.builtIn ? (
            <p className="font-medium">{role.name}</p>
          ) : (
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-40" aria-label="Role name" />
          )}
          <p className="mt-0.5 max-w-[220px] text-[11px] text-muted-foreground">{role.description}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {role.builtIn ? <Badge variant="secondary">Built-in</Badge> : <Badge variant="info">Custom</Badge>}
            {locked && (
              <Badge variant="muted">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
            <Badge variant="outline">
              {userCount} user{userCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </td>
        {PERMISSIONS.map((p) => (
          <td key={p} className="px-1 py-2 text-center">
            <input
              type="checkbox"
              aria-label={`${role.name}: ${PERMISSION_LABEL[p]}`}
              checked={locked || perms.includes(p)}
              disabled={locked || p === "portfolio:view" || pending}
              onChange={() => setPerms(perms.includes(p) ? perms.filter((x) => x !== p) : [...perms, p])}
            />
          </td>
        ))}
        <td className="py-2 pl-2">
          <div className="flex items-center justify-end gap-1">
            {!locked && (
              <Button size="sm" variant={dirty ? "default" : "outline"} className="h-7 px-2 text-[11px]" disabled={!dirty || pending} onClick={save}>
                {pending && !confirming ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
            )}
            {!role.builtIn && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setConfirming(true)} disabled={pending} aria-label={`Delete ${role.name}`}>
                <Trash2 /> Delete
              </Button>
            )}
          </div>
          <div className="mt-1 text-right">
            <Status msg={msg} />
          </div>
        </td>
      </tr>
      {confirming && (
        <tr className="border-b bg-red-50/60">
          <td colSpan={PERMISSIONS.length + 2} className="px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-red-900">Delete the “{role.name}” role?</span>
              {userCount > 0 ? (
                <>
                  <label htmlFor={`reassign-${role.id}`} className="text-red-900">
                    Move its {userCount} user{userCount === 1 ? "" : "s"} to
                  </label>
                  <select id={`reassign-${role.id}`} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-xs">
                    {roles
                      .filter((r) => r.id !== role.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </>
              ) : (
                <span className="text-red-900">No users have this role.</span>
              )}
              <span className="text-muted-foreground">It is also removed from any governance step.</span>
              <Button size="sm" variant="destructive" className="h-8" disabled={pending} onClick={remove}>
                {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete role
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirming(false)} disabled={pending}>
                <X /> Cancel
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function RoleManager({ roles, users }: { roles: RoleDefinition[]; users: User[] }) {
  return (
    <div className="space-y-4">
      <AddRole roles={roles} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-[11px] text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Role</th>
              {PERMISSIONS.map((p) => (
                <th key={p} className="px-1 py-1.5 text-center font-medium" title={PERMISSION_LABEL[p]}>
                  {SHORT[p]}
                </th>
              ))}
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <RoleRow key={`${r.id}-${r.permissions.join()}-${r.name}`} role={r} roles={roles} userCount={users.filter((u) => u.role === r.id).length} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Hover a column heading for the full permission. Enterprise Admin is locked so the platform can&apos;t lose its administrator. Built-in roles can be adjusted but not deleted.
      </p>
    </div>
  );
}
