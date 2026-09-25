import { NextResponse } from "next/server";
import { z } from "zod";
import { answerDeterministic } from "@/lib/advisor/engine";
import { getNarrator, guardNumbers } from "@/lib/advisor/narrator";
import { evaluatePortfolio } from "@/lib/services/portfolio-service";
import { getOptionalSession } from "@/lib/auth/session";

const Body = z.object({ question: z.string().min(3).max(500) });

export async function POST(req: Request) {
  if (!(await getOptionalSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a question (3–500 characters)." }, { status: 400 });
  const { portfolio, items } = await evaluatePortfolio({});
  const answer = answerDeterministic(parsed.data.question, portfolio, items);
  const narrator = getNarrator();
  const text = guardNumbers(answer, await narrator.narrate(answer));
  return NextResponse.json({ ...answer, text, narratedBy: narrator.name });
}
