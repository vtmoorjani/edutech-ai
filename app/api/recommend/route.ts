import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  ProfileInput,
  SkillGapResult,
  RecommendationResult,
} from "@/lib/schemas";
import { COURSE_BY_ID, SKILLS } from "@/lib/data";
import { filterAndScore } from "@/lib/scoring";
import { recommendSystem, recommendUserPrompt } from "@/lib/prompts";
import { callStructured } from "@/lib/anthropic";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  profile: ProfileInput,
  gap: SkillGapResult,
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

  const { profile, gap } = parsed.data;
  const shortlist = filterAndScore(profile, gap, 20);

  if (shortlist.length === 0) {
    return NextResponse.json({
      recommendations: [],
      meta: { reason: "no_courses_fit_filters" },
    });
  }

  const candidates = shortlist.map((s) => s.course);
  const validIds = new Set(candidates.map((c) => c.id));

  try {
    const { data, usage } = await callStructured({
      schema: RecommendationResult,
      systemBlocks: recommendSystem(candidates, SKILLS),
      userPrompt: recommendUserPrompt(profile, gap),
      maxTokens: 6000,
      effort: "medium",
    });

    // Hard guard against hallucinated course IDs.
    const validRecs = data.recommendations
      .filter((r) => validIds.has(r.course_id))
      .map((r) => ({
        ...r,
        course: COURSE_BY_ID[r.course_id],
      }));

    return NextResponse.json({
      recommendations: validRecs,
      shortlist_size: candidates.length,
      meta: {
        cache_read_tokens: usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        dropped_hallucinations:
          data.recommendations.length - validRecs.length,
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
