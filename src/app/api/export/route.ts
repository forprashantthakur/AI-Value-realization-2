import { NextResponse } from "next/server";
import { generateReport, isReportType } from "@/lib/reporting/service";
import { toCsv, toXlsx } from "@/lib/reporting/serializers";
import { parseFilters } from "@/lib/services/portfolio-service";
import { getOptionalSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("report") ?? "executive";
  const format = url.searchParams.get("format") ?? "csv";
  if (!isReportType(type)) return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(session, "report:export")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const filters = parseFilters(Object.fromEntries(url.searchParams.entries()));
  const report = await generateReport(type, filters, url.searchParams.get("initiative") ?? undefined, session.name);
  const name = `${report.title.replace(/[^A-Za-z0-9]+/g, "_")}_${new Date().toISOString().slice(0, 10)}`;
  if (format === "xlsx") {
    const buf = await toXlsx(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${name}.xlsx"`,
      },
    });
  }
  return new NextResponse(toCsv(report), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
}
