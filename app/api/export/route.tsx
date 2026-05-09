import { NextResponse } from "next/server";
import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProfileInput, RoadmapResult } from "@/lib/schemas";
import { COURSE_BY_ID, type Course } from "@/lib/data";
import { RoadmapDocument } from "@/lib/pdf/roadmap-pdf";

export const runtime = "nodejs";

const Body = z.object({
  profile: ProfileInput,
  roadmap: RoadmapResult,
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

  const { profile, roadmap } = parsed.data;
  const courseIds = Array.from(
    new Set(roadmap.phases.flatMap((p) => p.course_ids)),
  );
  const courses: Course[] = courseIds
    .map((id) => COURSE_BY_ID[id])
    .filter((c): c is Course => c != null);

  try {
    const buffer = await renderToBuffer(
      <RoadmapDocument
        profile={profile}
        roadmap={roadmap}
        courses={courses}
      />,
    );

    const filename = `skillpath-roadmap-${profile.target_role
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown PDF error";
    return NextResponse.json(
      { error: `PDF generation failed: ${message}` },
      { status: 500 },
    );
  }
}
