import { z } from "zod";

/** Structured shape the AI extracts from an uploaded syllabus / class guide. */
export const SyllabusSchema = z.object({
  name: z.string().describe("The course / subject name"),
  code: z.string().nullable().describe("Course code such as MATH 102, if present"),
  professor: z.string().nullable().describe("Instructor / professor name, if present"),
  categories: z
    .array(
      z.object({
        name: z.string().describe("Grading component, e.g. Midterm, Continuous Assessment"),
        weight: z.number().describe("Its percentage of the FINAL grade (0-100)"),
        items: z
          .array(
            z.object({
              name: z.string().describe("Sub-component, e.g. Test 1, Quiz, Lab report"),
              weight: z
                .number()
                .describe("Its percentage WITHIN this category (0-100), not of the final grade"),
            }),
          )
          .describe(
            "Sub-gradings inside this category if the syllabus breaks it down further. " +
              "Empty array if the category has no sub-components.",
          ),
      }),
    )
    .describe("The grading breakdown; top-level category weights should sum to ~100"),
});

export type ParsedSyllabus = z.infer<typeof SyllabusSchema>;
