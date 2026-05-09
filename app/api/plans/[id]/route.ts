import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COURSE_BY_ID } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/plans/[id]">,
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: plan, error } = await supabase
    .from("saved_plans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Hydrate course details from the catalog
  const roadmap = plan.roadmap as { phases: { course_ids: string[] }[] };
  const courseIds: string[] = (roadmap.phases ?? [])
    .flatMap((p) => p.course_ids ?? []);

  const courses = Array.from(new Set(courseIds))
    .map((cid) => COURSE_BY_ID[cid])
    .filter((c) => c != null);

  return NextResponse.json({
    plan: {
      id: plan.id,
      name: plan.name,
      target_role: (plan.profile_data as { target_role: string }).target_role,
      result: plan.roadmap,
      status: plan.status,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    },
    profile: plan.profile_data,
    skill_gaps: plan.skill_gaps,
    recommendations: plan.recommendations,
    courses,
  });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/plans/[id]">,
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { name?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name) updates.name = body.name;
  if (body.status && ["active", "completed", "archived"].includes(body.status)) {
    updates.status = body.status;
  }

  const { error } = await supabase
    .from("saved_plans")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: `Update failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/plans/[id]">,
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { error } = await supabase
    .from("saved_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: `Delete failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
