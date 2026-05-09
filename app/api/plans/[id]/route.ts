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

  // RLS already scopes to user_id, but pass it explicitly for clarity.
  const { data: roadmap, error: rmErr } = await supabase
    .from("roadmaps")
    .select("id, target_role, result, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (rmErr) {
    return NextResponse.json({ error: rmErr.message }, { status: 500 });
  }
  if (!roadmap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Hydrate course details from the catalog (not stored in DB — single source of truth is /data).
  const courseIds: string[] = (roadmap.result?.phases ?? [])
    .flatMap((p: { course_ids?: string[] }) => p.course_ids ?? []);

  const courses = Array.from(new Set(courseIds))
    .map((cid) => COURSE_BY_ID[cid])
    .filter((c) => c != null);

  return NextResponse.json({
    plan: {
      id: roadmap.id,
      target_role: roadmap.target_role,
      result: roadmap.result,
      created_at: roadmap.created_at,
    },
    profile,
    courses,
  });
}
