import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ProfileInput, SkillGapResult } from "@/lib/schemas";
import { SKILLS, getRole } from "@/lib/data";
import { skillGapSystem, skillGapUserPrompt } from "@/lib/prompts";
import { callStructured } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ProfileInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // MVP: AI Product Manager is the only target role
  const roleId = "ai_product_manager";
  const role = getRole(roleId);

  try {
    const { data, usage } = await callStructured({
      schema: SkillGapResult,
      systemBlocks: skillGapSystem(role, roleId, SKILLS),
      userPrompt: skillGapUserPrompt(parsed.data),
      maxTokens: 6000,
      effort: "medium",
    });

    return NextResponse.json({
      gap: data,
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
