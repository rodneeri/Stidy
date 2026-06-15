import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectAI, aiErrorResponse } from "@/lib/ai/models";

export const maxDuration = 60;

const AnalysisSchema = z.object({
  headline: z.string().describe("One punchy sentence on how the student is doing in this subject"),
  points: z
    .array(
      z.object({
        tone: z.enum(["positive", "warning", "tip"]),
        text: z.string(),
      }),
    )
    .describe("3 to 5 specific, actionable insights grounded in the actual numbers"),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  try {
    const object = await generateObjectAI({
      schema: AnalysisSchema,
      tier: "heavy",
      groqFallback: true,
      maxWaitSec: 30,
      prompt:
        "You are an academic advisor. Analyse this student's performance in a single course and " +
        "give concise, specific, encouraging-but-honest insights. Reference the categories, their " +
        "weights, and the target. Call out strengths, risks (e.g. a heavily-weighted item still " +
        "ungraded, or a weak category that matters a lot), and concrete next steps. Keep each point " +
        "to one sentence and base everything on the numbers provided.\n\nDATA:\n" +
        JSON.stringify(body, null, 2),
    });

    return NextResponse.json(object);
  } catch (err) {
    const { status, body } = aiErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
