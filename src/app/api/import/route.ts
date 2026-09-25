import { NextResponse } from "next/server";
import { MeasurementRowSchema } from "@/lib/domain/schemas";
import { parseTabular } from "@/lib/integrations/parse";
import { getOptionalSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

/** Dry-run parse + validation of an uploaded file. The commit happens via a server action. */
export async function POST(req: Request) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(session, "data:import")) return NextResponse.json({ error: "Your role cannot import data." }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  const rows = await parseTabular(file.name, Buffer.from(await file.arrayBuffer()));
  const results = rows.map((r, i) => {
    const p = MeasurementRowSchema.safeParse(r);
    return { row: i + 2, ok: p.success, data: p.success ? p.data : r, error: p.success ? null : p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") };
  });
  return NextResponse.json({ total: rows.length, valid: results.filter((r) => r.ok).length, results });
}
