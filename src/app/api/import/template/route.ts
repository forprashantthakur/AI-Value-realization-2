import { MEASUREMENT_TEMPLATE_COLUMNS } from "@/lib/integrations/connectors";

export async function GET() {
  const example = ["INIT-01", "2026-09", "STEADY_STATE", "41800", "0.81", "0.66", "9.9", "28.1", "0.029", "0.04", "720000", "58", "60"];
  const body = `${MEASUREMENT_TEMPLATE_COLUMNS.join(",")}\n${example.join(",")}\n`;
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="measurements_template.csv"' } });
}
