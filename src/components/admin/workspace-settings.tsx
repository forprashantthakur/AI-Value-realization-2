"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, Save, Trash2 } from "lucide-react";
import { deleteWorkspaceAction, leaveWorkspaceAction, renameWorkspaceAction, revokeApiKeyAction, rotateApiKeyAction } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton, Field, StatusText, useAction } from "@/components/ui/form-helpers";

export function WorkspaceSettings({ name, hasApiKey, canManage, isAdmin }: { name: string; hasApiKey: boolean; canManage: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const rename = useAction();
  const key = useAction();
  const danger = useAction();
  const [n, setN] = useState(name);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Workspace name</h3>
        <form
          className="flex max-w-lg items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            rename.run(() => renameWorkspaceAction(n), "Workspace renamed.");
          }}
        >
          <Field label="Name" htmlFor="ws-name" className="flex-1">
            <Input id="ws-name" value={n} disabled={!canManage} onChange={(e) => setN(e.target.value)} />
          </Field>
          {canManage && (
            <Button type="submit" size="sm" disabled={rename.pending || n.trim() === name}>
              {rename.pending ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          )}
        </form>
        <StatusText msg={rename.msg} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Ingestion API key</h3>
        <p className="max-w-2xl text-xs text-muted-foreground">
          Systems (ERP, process mining, agent telemetry) can push monthly measurements to <code className="rounded bg-muted px-1">POST /api/ingest/measurements</code> with{" "}
          <code className="rounded bg-muted px-1">Authorization: Bearer &lt;key&gt;</code>. The key only reaches this workspace. It is shown once — store it in your secret manager.
        </p>
        <p className="text-xs">Status: {hasApiKey ? <span className="font-medium text-[#006300]">active</span> : <span className="text-muted-foreground">no key</span>}</p>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={key.pending} onClick={() => key.run(() => rotateApiKeyAction(), "New key generated — copy it now.", (r) => setNewKey((r as { data?: { key: string } }).data?.key ?? null))}>
              <KeyRound /> {hasApiKey ? "Rotate key" : "Generate key"}
            </Button>
            {hasApiKey && (
              <ConfirmButton disabled={key.pending} onConfirm={() => key.run(() => revokeApiKeyAction(), "Key revoked.", () => setNewKey(null))} confirmText="Revoke key?">
                Revoke
              </ConfirmButton>
            )}
          </div>
        )}
        {newKey && <code className="block max-w-2xl break-all rounded-md border bg-muted/40 p-2 text-[11px]">{newKey}</code>}
        <StatusText msg={key.msg} />
      </section>

      <section className="space-y-2 rounded-lg border border-red-200 p-3">
        <h3 className="text-sm font-medium text-red-800">Leave or delete</h3>
        <div className="flex flex-wrap items-center gap-2">
          <ConfirmButton
            disabled={danger.pending}
            confirmText="Leave workspace?"
            onConfirm={() =>
              danger.run(
                () => leaveWorkspaceAction(),
                null,
                () => router.push("/"),
              )
            }
          >
            <LogOut className="h-3.5 w-3.5" /> Leave this workspace
          </ConfirmButton>
        </div>
        {isAdmin && (
          <form
            className="flex max-w-lg flex-wrap items-end gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              danger.run(
                () => deleteWorkspaceAction(confirm),
                null,
                () => router.push("/"),
              );
            }}
          >
            <Field label={`Type "${name}" to permanently delete this workspace and all of its data`} htmlFor="ws-del" className="flex-1">
              <Input id="ws-del" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button type="submit" size="sm" variant="destructive" disabled={danger.pending || confirm.trim() !== name}>
              <Trash2 /> Delete workspace
            </Button>
          </form>
        )}
        <StatusText msg={danger.msg} />
      </section>
    </div>
  );
}
