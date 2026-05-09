import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: plans, error } = await supabase
    .from("saved_plans")
    .select("id, name, profile_data, status, created_at, updated_at, roadmap")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform the plans for the frontend
  const transformedPlans = (plans || []).map((plan) => {
    const profileData = plan.profile_data as { target_role: string };
    const roadmap = plan.roadmap as { phases: { weeks: number; course_ids: string[] }[] };
    const totalWeeks = roadmap.phases?.reduce((sum, p) => sum + p.weeks, 0) ?? 0;
    const totalCourses = roadmap.phases?.reduce((sum, p) => sum + (p.course_ids?.length ?? 0), 0) ?? 0;

    return {
      id: plan.id,
      name: plan.name,
      target_role: profileData.target_role,
      status: plan.status,
      total_weeks: totalWeeks,
      total_courses: totalCourses,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    };
  });

  return NextResponse.json({ plans: transformedPlans });
}
