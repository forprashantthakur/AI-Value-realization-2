import { NextResponse } from "next/server";
import { z } from "zod";
import { MeasurementRowSchema } from "@/lib/domain/schemas";
import { getRepository } from "@/lib/data";
import { getIdentityStore } from "@/lib/identity";
import { hashToken } from "@/lib/identity/password";
import { newId } from "@/lib/ids";

/**
 * API ingestion: POST /api/ingest/measurements
 * Authorization: Bearer <workspace API key>   (generate it in Administration → Workspace)
 * Body: { "rows": [ { initiative, month, phase, volume, adoptionRate, ... } ] }
 * The key identifies the workspace; rows can only reach that workspace's initiatives.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!key) return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  const workspace = await (await getIdentityStore()).findWorkspaceByApiKeyHash(hashToken(key));
  if (!workspace) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = z.object({ rows: z.array(MeasurementRowSchema).min(1).max(5000) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid payload", issues: body.error.issues.slice(0, 20) }, { status: 400 });
  const repo = await getRepository(workspace.id);
  const p = await repo.loadPortfolio();
  const grouped = new Map<string, z.infer<typeof MeasurementRowSchema>[]>();
  for (const r of body.data.rows) {
    const init = p.initiatives.find((i) => i.code === r.initiative || i.id === r.initiative);
    if (!init) return NextResponse.json({ error: `Unknown initiative ${r.initiative}` }, { status: 400 });
    grouped.set(init.id, [...(grouped.get(init.id) ?? []), r]);
  }
  for (const [id, rows] of grouped) {
    await repo.upsertMeasurements(id, rows.map(({ initiative: _i, ...m }) => (void _i, m)));
    await repo.appendAudit([{ id: newId("aud"), at: new Date().toISOString(), userId: "api", userName: "Ingestion API", entity: "Measurement", entityId: id, initiativeId: id, field: "api-ingest", previous: null, next: `${rows.length} rows` }]);
  }
  return NextResponse.json({ imported: body.data.rows.length });
}
