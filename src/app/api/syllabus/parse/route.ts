import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SyllabusSchema } from "@/features/syllabus/schema";
import { generateObjectAI, aiErrorResponse } from "@/lib/ai/models";

// Vision parsing can take a few seconds.
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const object = await generateObjectAI({
      schema: SyllabusSchema,
      tier: "heavy",
      maxWaitSec: 30,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "You are parsing a university course syllabus / class guide. Extract the course " +
                "name, code, professor, and the grading structure.\n" +
                "TOP-LEVEL categories: each weight is the percentage of the FINAL grade.\n" +
                "If a category is broken down into sub-components (e.g. 'Continuous assessment 60%' " +
                "containing 'Test 1 20%, Test 2 20%'), put those in that category's `items`, where " +
                "each item weight is its percentage WITHIN the category (so a category's item " +
                "weights typically sum to 100). If a category has no sub-components, use an empty " +
                "items array. If a field is missing, return null. Keep names concise.",
            },
            { type: "file", data: bytes, mediaType: file.type || "application/pdf" },
          ],
        },
      ],
    });

    return NextResponse.json(object);
  } catch (err) {
    const { status, body } = aiErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
