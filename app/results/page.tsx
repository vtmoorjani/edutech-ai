"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  SkillGapResultT,
  ProfileInputT,
  RecommendationResultT,
} from "@/lib/schemas";
import type { Course } from "@/lib/data";
import { track, FUNNEL } from "@/lib/analytics";
import { FeedbackWidget } from "@/components/feedback-widget";

type RecWithCourse = RecommendationResultT["recommendations"][number] & {
  course: Course;
};

export default function ResultsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileInputT | null>(null);
  const [gap, setGap] = useState<SkillGapResultT | null>(null);
  const [recs, setRecs] = useState<RecWithCourse[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [shortlistSize, setShortlistSize] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);

  useEffect(() => {
    const p = sessionStorage.getItem("skillpath:profile");
    const g = sessionStorage.getItem("skillpath:gap");
    if (!p || !g) {
      router.replace("/intake");
      return;
    }
    setProfile(JSON.parse(p));
    setGap(JSON.parse(g));
  }, [router]);

  async function loadRecommendations() {
    if (!profile || !gap) return;
    setRecsLoading(true);
    setRecsError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, gap }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRecsError(json.error || "Recommendation failed");
        return;
      }
      const list = json.recommendations as RecWithCourse[];
      setRecs(list);
      setShortlistSize(json.shortlist_size ?? null);
      // Pre-select the top 3 by default — most users will start there.
      setSelected(new Set(list.slice(0, 3).map((r) => r.course_id)));
      track(FUNNEL.RECS_VIEWED, {
        count: list.length,
        shortlist_size: json.shortlist_size ?? null,
      });
    } catch (err) {
      setRecsError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRecsLoading(false);
    }
  }

  function toggleSelected(courseId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  async function buildRoadmap() {
    if (!profile || !gap || !recs || selected.size === 0) return;
    setRoadmapLoading(true);
    setRoadmapError(null);
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          gap,
          selected_course_ids: Array.from(selected),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRoadmapError(json.error || "Roadmap generation failed");
        return;
      }
      const selectedRecs = recs.filter((r) => selected.has(r.course_id));
      sessionStorage.setItem(
        "skillpath:selected_recs",
        JSON.stringify(selectedRecs),
      );
      sessionStorage.setItem("skillpath:roadmap", JSON.stringify(json.roadmap));
      track(FUNNEL.ROADMAP_BUILT, {
        course_count: selected.size,
        phase_count: json.roadmap?.phases?.length ?? 0,
      });
      router.push("/roadmap");
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRoadmapLoading(false);
    }
  }

  if (!gap || !profile) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-zinc-500">
        Loading…
      </main>
    );
  }

  const grouped = gap.gaps.reduce<Record<string, typeof gap.gaps>>(
    (acc, g) => {
      (acc[g.category] ||= []).push(g);
      return acc;
    },
    {},
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/intake" className="text-sm text-zinc-500 hover:underline">
        ← Edit profile
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Your skill gap for {profile.target_role}
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">{gap.summary}</p>

      {gap.transferable_strengths.length > 0 && (
        <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            What you bring with you
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-emerald-900 dark:text-emerald-100">
            {gap.transferable_strengths.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 space-y-6">
        <h2 className="text-xl font-semibold">Skill-by-skill breakdown</h2>
        {Object.entries(grouped).map(([cat, gaps]) => (
          <div
            key={cat}
            className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="border-b border-zinc-200 px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              {cat.replace(/_/g, " ")}
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {gaps.map((g) => (
                <li key={g.skill_id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{g.skill_name}</div>
                      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {g.rationale}
                      </div>
                    </div>
                    <GapBadge size={g.gap_size} />
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Current: <Level v={g.current_level} /> · Target:{" "}
                    <Level v={g.target_level} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {gap.adjacent_skills_to_prioritize.length > 0 && (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Prioritize these next</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {gap.adjacent_skills_to_prioritize.map((s, i) => (
              <span
                key={i}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800"
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Recommended courses</h2>
          {shortlistSize != null && (
            <span className="text-xs text-zinc-500">
              Ranked from {shortlistSize} candidates
            </span>
          )}
        </div>

        {!recs && !recsLoading && (
          <div className="mt-4">
            <button
              onClick={loadRecommendations}
              className="inline-flex h-12 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get my course recommendations
            </button>
            <p className="mt-2 text-xs text-zinc-500">10–25s. AI-generated.</p>
          </div>
        )}

        {recsLoading && (
          <div className="mt-4 text-sm text-zinc-500">
            Ranking courses against your skill gap…
          </div>
        )}

        {recsError && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {recsError}
          </div>
        )}

        {recs && recs.length === 0 && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            No courses in our catalog match your budget and time constraints.
            Try increasing your budget or extending your timeline.
          </div>
        )}

        {recs && recs.length > 0 && (
          <ul className="mt-4 space-y-4 pb-32">
            {recs.map((r) => (
              <RecCard
                key={r.course_id}
                rec={r}
                selected={selected.has(r.course_id)}
                onToggle={() => toggleSelected(r.course_id)}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-12 text-xs text-zinc-500">
        Recommendations are AI-generated from a curated catalog. Always verify
        course details on the provider's site before purchasing.
      </p>

      {recs && recs.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
            <div className="text-sm">
              <div className="font-medium">
                {selected.size} course{selected.size === 1 ? "" : "s"} selected
              </div>
              {roadmapError && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {roadmapError}
                </div>
              )}
            </div>
            <button
              onClick={buildRoadmap}
              disabled={selected.size === 0 || roadmapLoading}
              className="inline-flex h-11 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {roadmapLoading ? "Building roadmap…" : "Build my roadmap →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function RecCard({
  rec,
  selected,
  onToggle,
}: {
  rec: RecWithCourse;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const c = rec.course;
  return (
    <li
      className={`rounded-2xl border p-5 transition-colors ${
        selected
          ? "border-zinc-900 bg-white ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start gap-4">
        <label className="mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-5 w-5 cursor-pointer rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
            aria-label={`Select ${c.title} for roadmap`}
          />
        </label>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>#{rec.rank}</span>
                <span>·</span>
                <span>{c.platform}</span>
                {c.provider && (
                  <>
                    <span>·</span>
                    <span>{c.provider}</span>
                  </>
                )}
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  track(FUNNEL.COURSE_CLICKED, {
                    course_id: c.id,
                    platform: c.platform,
                    rank: rec.rank,
                  })
                }
                className="mt-1 block text-lg font-semibold hover:underline"
              >
                {c.title}
              </a>
              <div className="mt-1 text-xs text-zinc-500">
                {c.duration_hours}h · ${c.price_usd} · {c.level} · {c.format}
                {c.rating != null && <> · ★ {c.rating}</>}
              </div>
            </div>
            <ScoreBadge score={rec.match_score} />
          </div>

          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            {rec.why_recommended}
          </p>

          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-3 text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          >
            {open ? "Hide details" : "Why this? Why now? Tradeoffs?"}
          </button>

          {open && (
            <div className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-950">
              <Detail label="Why now">{rec.why_now}</Detail>
              {rec.gaps_addressed.length > 0 && (
                <Detail label="Gaps it closes">
                  {rec.gaps_addressed.join(", ")}
                </Detail>
              )}
              {rec.gaps_not_covered.length > 0 && (
                <Detail label="Gaps it does NOT cover">
                  {rec.gaps_not_covered.join(", ")}
                </Detail>
              )}
              <Detail label="Tradeoffs">{rec.tradeoffs}</Detail>
              <Detail label="Ideal for">{rec.ideal_learner}</Detail>
            </div>
          )}

          <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <FeedbackWidget courseId={c.id} />
          </div>
        </div>
      </div>
    </li>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score);
  const tone =
    pct >= 80
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : pct >= 60
        ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {pct}% match
    </span>
  );
}

function GapBadge({ size }: { size: "none" | "small" | "medium" | "large" }) {
  const map = {
    none: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    small: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    large: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  } as const;
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${map[size]}`}
    >
      gap: {size}
    </span>
  );
}

function Level({ v }: { v: "none" | "low" | "medium" | "high" }) {
  return <span className="font-medium text-zinc-700 dark:text-zinc-300">{v}</span>;
}
