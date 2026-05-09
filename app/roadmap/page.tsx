"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProfileInputT, RoadmapResultT } from "@/lib/schemas";
import type { Course } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { track, FUNNEL } from "@/lib/analytics";

type SelectedRec = {
  course_id: string;
  rank: number;
  match_score: number;
  why_recommended: string;
  why_now?: string;
  gaps_addressed?: string[];
  gaps_not_covered?: string[];
  tradeoffs?: string;
  ideal_learner?: string;
  course: Course;
};

type EditablePhase = RoadmapResultT["phases"][number];

const SAVE_PENDING_KEY = "skillpath:save_pending";

export default function RoadmapPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-zinc-500">
          Loading…
        </main>
      }
    >
      <RoadmapInner />
    </Suspense>
  );
}

function RoadmapInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfileInputT | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapResultT | null>(null);
  const [selectedRecs, setSelectedRecs] = useState<SelectedRec[] | null>(null);
  const [phases, setPhases] = useState<EditablePhase[] | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load from sessionStorage.
  useEffect(() => {
    const p = sessionStorage.getItem("skillpath:profile");
    const r = sessionStorage.getItem("skillpath:roadmap");
    const s = sessionStorage.getItem("skillpath:selected_recs");
    if (!p || !r || !s) {
      router.replace("/intake");
      return;
    }
    const parsedRoadmap = JSON.parse(r) as RoadmapResultT;
    setProfile(JSON.parse(p));
    setRoadmap(parsedRoadmap);
    setPhases(parsedRoadmap.phases);
    setSelectedRecs(JSON.parse(s));
  }, [router]);

  const courseLookup = useMemo(() => {
    const map = new Map<string, Course>();
    selectedRecs?.forEach((r) => map.set(r.course_id, r.course));
    return map;
  }, [selectedRecs]);

  const totalSelectedCost = useMemo(
    () => selectedRecs?.reduce((sum, r) => sum + r.course.price_usd, 0) ?? 0,
    [selectedRecs],
  );
  const totalWeeks = useMemo(
    () => phases?.reduce((sum, p) => sum + p.weeks, 0) ?? 0,
    [phases],
  );

  const savePlan = useCallback(async () => {
    if (!profile || !roadmap || !selectedRecs || !phases) return;
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Mark intent so we resume after OAuth.
        sessionStorage.setItem(SAVE_PENDING_KEY, "1");
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/roadmap?save=1")}`,
          },
        });
        if (error) {
          setSaveError(error.message);
          setSaving(false);
        }
        return;
      }

      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          gap: JSON.parse(sessionStorage.getItem("skillpath:gap") || "null"),
          recommendations: selectedRecs.map(({ course: _course, ...r }) => r),
          roadmap: { ...roadmap, phases },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error || "Save failed");
        setSaving(false);
        return;
      }
      sessionStorage.removeItem(SAVE_PENDING_KEY);
      track(FUNNEL.ROADMAP_SAVED, { plan_id: json.plan_id });
      router.push(`/plans/${json.plan_id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
      setSaving(false);
    }
  }, [profile, roadmap, selectedRecs, phases, router]);

  // Auto-resume save after OAuth roundtrip.
  useEffect(() => {
    if (!profile || !roadmap || !selectedRecs) return;
    const pending = sessionStorage.getItem(SAVE_PENDING_KEY);
    if (pending === "1" && searchParams.get("save") === "1") {
      void savePlan();
    }
  }, [profile, roadmap, selectedRecs, searchParams, savePlan]);

  if (!roadmap || !profile || !selectedRecs || !phases) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-zinc-500">
        Loading…
      </main>
    );
  }

  function updatePhase(idx: number, patch: Partial<EditablePhase>) {
    setPhases((prev) =>
      prev ? prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)) : prev,
    );
  }

  async function downloadPdf() {
    if (!profile || !roadmap || !phases) return;
    setPdfBusy(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          roadmap: { ...roadmap, phases },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "PDF export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skillpath-roadmap-${profile.target_role
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      track(FUNNEL.PDF_EXPORTED, { from: "roadmap" });
    } finally {
      setPdfBusy(false);
    }
  }

  async function copyLinkedInPost() {
    if (!roadmap) return;
    const text =
      roadmap.linkedin_update_suggestion ||
      `I just mapped out my ${profile?.target_role} learning path with SkillPath AI — ${totalWeeks} weeks across ${phases?.length ?? 0} phases.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      track(FUNNEL.LINKEDIN_COPIED);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      alert("Couldn't access clipboard. Copy manually:\n\n" + text);
    }
  }

  const overTimeline = totalWeeks > profile.timeline_weeks;
  const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.origin : "",
  )}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/results" className="text-sm text-zinc-500 hover:underline">
        ← Back to recommendations
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Your {profile.target_role} roadmap
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {selectedRecs.length} courses · {totalWeeks} weeks · ${totalSelectedCost} total
        {overTimeline && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {totalWeeks - profile.timeline_weeks} weeks over your timeline
          </span>
        )}
      </p>

      <ol className="mt-8 space-y-4">
        {phases.map((phase, idx) => (
          <PhaseCard
            key={`${phase.phase}-${idx}`}
            phase={phase}
            courseLookup={courseLookup}
            onChange={(patch) => updatePhase(idx, patch)}
          />
        ))}
      </ol>

      {roadmap.portfolio_project && (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Capstone project
          </h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {roadmap.portfolio_project}
          </p>
        </section>
      )}

      {roadmap.linkedin_update_suggestion && (
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              LinkedIn update suggestion
            </h2>
            <button
              onClick={copyLinkedInPost}
              className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400"
            >
              {copied ? "Copied ✓" : "Copy text"}
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
            {roadmap.linkedin_update_suggestion}
          </p>
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          onClick={savePlan}
          disabled={saving}
          className="inline-flex h-12 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? "Saving…" : "Save my plan"}
        </button>
        <button
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="inline-flex h-12 items-center rounded-full border border-zinc-300 px-6 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {pdfBusy ? "Generating PDF…" : "Export as PDF"}
        </button>
        <a
          href={linkedinShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center rounded-full border border-zinc-300 px-6 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Share on LinkedIn
        </a>
      </div>

      {saveError && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {saveError}
        </div>
      )}

      <p className="mt-6 text-xs text-zinc-500">
        Saving requires Google sign-in. AI-generated. Edit any phase name or
        duration above before saving.
      </p>
    </main>
  );
}

function PhaseCard({
  phase,
  courseLookup,
  onChange,
}: {
  phase: EditablePhase;
  courseLookup: Map<string, Course>;
  onChange: (patch: Partial<EditablePhase>) => void;
}) {
  const courses = phase.course_ids
    .map((id) => courseLookup.get(id))
    .filter((c): c is Course => c != null);

  const phaseHours = courses.reduce((sum, c) => sum + c.duration_hours, 0);

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Phase {phase.phase}
          </div>
          <input
            value={phase.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="mt-1 w-full bg-transparent text-lg font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {phase.focus}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <label className="block text-xs text-zinc-500">Weeks</label>
          <input
            type="number"
            min={1}
            max={52}
            value={phase.weeks}
            onChange={(e) => onChange({ weeks: Number(e.target.value) })}
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="mt-1 text-xs text-zinc-500">{phaseHours}h total</div>
        </div>
      </div>

      {courses.length > 0 && (
        <ul className="mt-4 space-y-2">
          {courses.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950"
            >
              <div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline"
                >
                  {c.title}
                </a>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {c.platform} · {c.duration_hours}h · ${c.price_usd} · {c.format}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {courses.length === 0 && (
        <div className="mt-3 text-xs text-zinc-500 italic">
          No courses assigned to this phase.
        </div>
      )}

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
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
}
