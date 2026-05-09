import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ProfileInput,
  SkillGapResult,
  RoadmapResult,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { COURSE_BY_ID } from "@/lib/data";

export const runtime = "nodejs";

const SavedRec = z.object({
  course_id: z.string(),
  rank: z.number().int().min(1),
  match_score: z.number().min(0).max(100),
  why_recommended: z.string(),
  why_now: z.string().optional(),
  gaps_addressed: z.array(z.string()).optional(),
  gaps_not_covered: z.array(z.string()).optional(),
  tradeoffs: z.string().optional(),
  ideal_learner: z.string().optional(),
});

const Body = z.object({
  profile: ProfileInput,
  gap: SkillGapResult,
  recommendations: z.array(SavedRec),
  roadmap: RoadmapResult,
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

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

  const { profile, gap, recommendations, roadmap } = parsed.data;

  // Drop any course IDs that aren't in the catalog (defensive).
  const validRecs = recommendations.filter((r) => COURSE_BY_ID[r.course_id]);
  if (validRecs.length === 0) {
    return NextResponse.json(
      { error: "No valid recommendations in payload" },
      { status: 400 },
    );
  }

  // Upsert profile.
  const { error: profErr } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      current_role: profile.current_role,
      target_role: profile.target_role,
      years_experience: profile.years_experience,
      current_skills: profile.current_skills,
      weekly_hours: profile.weekly_hours,
      budget_usd: profile.budget_usd,
      timeline_weeks: profile.timeline_weeks,
      preferred_formats: profile.preferred_formats,
      desired_outcomes: profile.desired_outcomes,
      intent: profile.intent ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (profErr) {
    return NextResponse.json(
      { error: `Profile save failed: ${profErr.message}` },
      { status: 500 },
    );
  }

  // Insert gap.
  const { data: gapRow, error: gapErr } = await supabase
    .from("skill_gaps")
    .insert({
      user_id: user.id,
      target_role: profile.target_role,
      result: gap,
    })
    .select("id")
    .single();
  if (gapErr || !gapRow) {
    return NextResponse.json(
      { error: `Gap save failed: ${gapErr?.message}` },
      { status: 500 },
    );
  }

  // Insert recommendations.
  const recRows = validRecs.map((r) => ({
    user_id: user.id,
    gap_id: gapRow.id,
    course_id: r.course_id,
    rank: r.rank,
    match_score: r.match_score,
    result: r,
  }));
  const { error: recsErr } = await supabase
    .from("recommendations")
    .insert(recRows);
  if (recsErr) {
    return NextResponse.json(
      { error: `Recommendations save failed: ${recsErr.message}` },
      { status: 500 },
    );
  }

  // Insert roadmap.
  const { data: roadmapRow, error: roadmapErr } = await supabase
    .from("roadmaps")
    .insert({
      user_id: user.id,
      target_role: profile.target_role,
      result: roadmap,
    })
    .select("id")
    .single();
  if (roadmapErr || !roadmapRow) {
    return NextResponse.json(
      { error: `Roadmap save failed: ${roadmapErr?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    plan_id: roadmapRow.id,
    gap_id: gapRow.id,
  });
}
