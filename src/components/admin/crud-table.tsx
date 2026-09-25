"use client";
import { useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { ConfirmButton, NativeSelect, StatusText, useAction } from "@/components/ui/form-helpers";
import { cn } from "@/lib/utils";

export type Column =
  | { key: string; label: string; type: "text"; placeholder?: string; width?: string; required?: boolean }
  | { key: string; label: string; type: "number"; step?: number; min?: number; width?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; nullable?: string; width?: string }
  | { key: string; label: string; type: "switch" }
  | { key: string; label: string; type: "list"; placeholder?: string; width?: string };

type Row = Record<string, unknown> & { id: string };
type Result = { ok: true; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function Cell({ col, value, onChange, disabled }: { col: Column; value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  const cls = "h-8 text-xs";
  switch (col.type) {
    case "text":
      return <Input className={cls} aria-label={col.label} placeholder={col.placeholder} disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input className={cls} aria-label={col.label} type="number" step={col.step ?? "any"} min={col.min} disabled={disabled} value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />;
    case "select":
      return (
        <NativeSelect className={cls} aria-label={col.label} disabled={disabled} value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
          {col.nullable !== undefined && <option value="">{col.nullable}</option>}
          {col.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
    case "switch":
      return <Switch aria-label={col.label} disabled={disabled} checked={Boolean(value)} onCheckedChange={onChange} />;
    case "list":
      return (
        <Input
          className={cls}
          aria-label={col.label}
          placeholder={col.placeholder ?? "Comma-separated"}
          disabled={disabled}
          value={Array.isArray(value) ? value.join(", ") : String(value ?? "")}
          onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trimStart()))}
        />
      );
  }
}

const clean = (row: Row, columns: Column[]) => {
  const out: Row = { ...row };
  for (const c of columns) if (c.type === "list" && Array.isArray(out[c.key])) out[c.key] = (out[c.key] as string[]).map((s) => s.trim()).filter(Boolean);
  return out;
};

function EditableRow({ row, columns, onSave, onDelete, canEdit, deleteHint, isNew, onCancel }: { row: Row; columns: Column[]; onSave: (r: Row) => Promise<Result>; onDelete?: (id: string) => Promise<Result>; canEdit: boolean; deleteHint?: string; isNew?: boolean; onCancel?: () => void }) {
  const [draft, setDraft] = useState(row);
  const { pending, msg, run } = useAction();
  const dirty = JSON.stringify(draft) !== JSON.stringify(row);
  return (
    <>
      <tr className={cn("border-b align-middle", isNew && "bg-primary/5")}>
        {columns.map((c) => (
          <td key={c.key} className={cn("py-1 pr-1", "width" in c && c.width)}>
            <Cell col={c} value={draft[c.key]} disabled={!canEdit || pending} onChange={(v) => setDraft({ ...draft, [c.key]: v })} />
          </td>
        ))}
        {canEdit && (
          <td className="whitespace-nowrap py-1 text-right">
            <Button size="sm" variant={dirty || isNew ? "default" : "outline"} disabled={pending || (!dirty && !isNew)} onClick={() => run(() => onSave(clean(draft, columns)), isNew ? "Added." : "Saved.", () => isNew && onCancel?.())}>
              {pending ? <Loader2 className="animate-spin" /> : isNew ? <Plus /> : <Save />} {isNew ? "Add" : "Save"}
            </Button>
            {isNew ? (
              <Button size="sm" variant="ghost" onClick={onCancel} aria-label="Cancel">
                <X />
              </Button>
            ) : (
              onDelete && (
                <ConfirmButton disabled={pending} onConfirm={() => run(() => onDelete(row.id), "Deleted.")} confirmText="Delete?">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Delete</span>
                </ConfirmButton>
              )
            )}
          </td>
        )}
      </tr>
      {msg && (
        <tr>
          <td colSpan={columns.length + 1} className="pb-1">
            <StatusText msg={msg} />
            {!msg.ok && deleteHint && <p className="text-[11px] text-muted-foreground">{deleteHint}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Generic inline editor for reference records: edit in place, add a row, delete with confirmation.
 * `onSave` / `onDelete` are server actions; permissions are enforced on the server.
 */
export function CrudTable({ rows, columns, onSave, onDelete, newRow, canEdit, addLabel = "Add", empty = "Nothing here yet.", deleteHint }: { rows: Row[]; columns: Column[]; onSave: (r: Row) => Promise<Result>; onDelete?: (id: string) => Promise<Result>; newRow: Row; canEdit: boolean; addLabel?: string; empty?: string; deleteHint?: string }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className="py-1.5 pr-1 font-medium">
                  {c.label}
                </th>
              ))}
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <EditableRow key={`${r.id}-${JSON.stringify(r)}`} row={r} columns={columns} onSave={onSave} onDelete={onDelete} canEdit={canEdit} deleteHint={deleteHint} />
            ))}
            {adding && <EditableRow row={newRow} columns={columns} onSave={onSave} canEdit isNew onCancel={() => setAdding(false)} />}
            {rows.length === 0 && !adding && (
              <tr>
                <td colSpan={columns.length + 1} className="py-6 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canEdit && !adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  );
}
