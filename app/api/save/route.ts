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
  name: z.string().optional(),
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

  const { profile, gap, recommendations, roadmap, name } = parsed.data;

  // Drop any course IDs that aren't in the catalog (defensive).
  const validRecs = recommendations.filter((r) => COURSE_BY_ID[r.course_id]);
  if (validRecs.length === 0) {
    return NextResponse.json(
      { error: "No valid recommendations in payload" },
      { status: 400 },
    );
  }

  // Save everything to the saved_plans table
  const { data: planRow, error: planErr } = await supabase
    .from("saved_plans")
    .insert({
      user_id: user.id,
      name: name || `${profile.target_role} Learning Plan`,
      profile_data: profile,
      skill_gaps: gap,
      recommendations: validRecs,
      roadmap: roadmap,
      status: "active",
    })
    .select("id")
    .single();

  if (planErr || !planRow) {
    return NextResponse.json(
      { error: `Save failed: ${planErr?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    plan_id: planRow.id,
  });
}
