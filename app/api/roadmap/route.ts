import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ProfileInput, SkillGapResult, RoadmapResult } from "@/lib/schemas";
import { COURSE_BY_ID, SKILLS } from "@/lib/data";
import { roadmapSystem, roadmapUserPrompt } from "@/lib/prompts";
import { callStructured } from "@/lib/anthropic";

export const runtime = "nodejs";

const Body = z.object({
  profile: ProfileInput,
  gap: SkillGapResult,
  selected_course_ids: z.array(z.string()).min(1).max(10),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { profile, gap, selected_course_ids } = parsed.data;

  const selected = selected_course_ids
    .map((id) => COURSE_BY_ID[id])
    .filter((c): c is NonNullable<typeof c> => c != null);

  if (selected.length === 0) {
    return NextResponse.json(
      { error: "None of the selected course IDs are in the catalog." },
      { status: 400 },
    );
  }
  const validIds = new Set(selected.map((c) => c.id));

  try {
    const { data, usage } = await callStructured({
      schema: RoadmapResult,
      systemBlocks: roadmapSystem(selected, SKILLS),
      userPrompt: roadmapUserPrompt(profile, gap),
      maxTokens: 4000,
      effort: "medium",
    });

    // Sanitize each phase: drop any course IDs the model invented or inverted.
    const cleanedPhases = data.phases.map((p) => ({
      ...p,
      course_ids: p.course_ids.filter((id) => validIds.has(id)),
    }));

    return NextResponse.json({
      roadmap: { ...data, phases: cleanedPhases },
      meta: {
        cache_read_tokens: usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited — please retry in a moment." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI provider error (${err.status}): ${err.message}` },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
