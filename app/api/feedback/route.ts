import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { COURSE_BY_ID } from "@/lib/data";

export const runtime = "nodejs";

const Body = z.object({
  course_id: z.string().min(1),
  recommendation_id: z.string().uuid().optional(),
  thumbs: z.union([z.literal(1), z.literal(-1)]),
  reason: z.string().max(1000).optional(),
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

  // Reject feedback for courses that aren't in the catalog (defensive).
  if (!COURSE_BY_ID[parsed.data.course_id]) {
    return NextResponse.json({ error: "Unknown course" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Anonymous feedback isn't persisted in this MVP — sign-in required.
    return NextResponse.json(
      { error: "auth_required" },
      { status: 401 },
    );
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    recommendation_id: parsed.data.recommendation_id ?? null,
    thumbs: parsed.data.thumbs,
    reason: parsed.data.reason ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
