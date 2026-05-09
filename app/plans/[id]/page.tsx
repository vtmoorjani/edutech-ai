"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { ProfileInputT, RoadmapResultT } from "@/lib/schemas";
import type { Course } from "@/lib/data";
import { track, FUNNEL } from "@/lib/analytics";

type Plan = {
  id: string;
  target_role: string;
  result: RoadmapResultT;
  created_at: string;
};

export default function SavedPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<ProfileInputT | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/plans/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Failed to load plan");
          return;
        }
        setPlan(json.plan);
        setProfile(json.profile);
        setCourses(json.courses);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Network error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-zinc-500">
        Loading saved plan…
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
        <Link
          href="/intake"
          className="mt-4 inline-block text-sm text-zinc-600 hover:underline"
        >
          Start a new assessment →
        </Link>
      </main>
    );
  }
  if (!plan || !profile) return null;

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const totalWeeks = plan.result.phases.reduce((s, p) => s + p.weeks, 0);
  const totalCost = courses.reduce((s, c) => s + c.price_usd, 0);

  async function downloadPdf() {
    if (!profile || !plan) return;
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, roadmap: plan.result }),
    });
    if (!res.ok) {
      alert("PDF export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skillpath-roadmap-${plan.target_role
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    track(FUNNEL.PDF_EXPORTED, { from: "saved_plan", plan_id: id });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/intake" className="text-sm text-zinc-500 hover:underline">
        ← Start a new assessment
      </Link>
      <div className="mt-4 flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          {plan.target_role} roadmap
        </h1>
        <span className="text-xs text-zinc-500">
          Saved {new Date(plan.created_at).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {totalWeeks} weeks · ${totalCost} · {profile.weekly_hours}h/week
      </p>

      <ol className="mt-8 space-y-4">
        {plan.result.phases.map((phase, idx) => {
          const phaseCourses = phase.course_ids
            .map((cid) => courseById.get(cid))
            .filter((c): c is Course => c != null);
          const phaseHours = phaseCourses.reduce(
            (s, c) => s + c.duration_hours,
            0,
          );
          return (
            <li
              key={idx}
              className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Phase {phase.phase}
                  </div>
                  <div className="mt-1 text-lg font-semibold">{phase.name}</div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {phase.focus}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-500">
                  <div>{phase.weeks} weeks</div>
                  <div>{phaseHours}h total</div>
                </div>
              </div>
              {phaseCourses.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {phaseCourses.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950"
                    >
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        {c.title}
                      </a>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {c.platform} · {c.duration_hours}h · ${c.price_usd}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <div className="font-semibold uppercase tracking-wide text-zinc-500">
                    Objective
                  </div>
                  <div className="mt-1 text-zinc-700 dark:text-zinc-300">
                    {phase.objective}
                  </div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-wide text-zinc-500">
                    Output
                  </div>
                  <div className="mt-1 text-zinc-700 dark:text-zinc-300">
                    {phase.output_artifact}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={downloadPdf}
          className="inline-flex h-12 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Download PDF
        </button>
      </div>
    </main>
  );
}
