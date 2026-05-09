"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProfileInputT, RoadmapResultT } from "@/lib/schemas";
import type { Course } from "@/lib/data";
import { track, FUNNEL } from "@/lib/analytics";

type Plan = {
  id: string;
  name: string;
  target_role: string;
  result: RoadmapResultT;
  status: "active" | "completed" | "archived";
  created_at: string;
  updated_at: string;
};

export default function SavedPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<ProfileInputT | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

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
        setNewName(json.plan.name);
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

  async function updateName() {
    if (!plan || newName === plan.name) {
      setEditingName(false);
      return;
    }

    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        setPlan((prev) => (prev ? { ...prev, name: newName } : prev));
      }
    } catch {
      // Silently fail
    }
    setEditingName(false);
  }

  async function updateStatus(status: Plan["status"]) {
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setPlan((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch {
      // Silently fail
    }
  }

  async function deletePlan() {
    if (!confirm("Are you sure you want to delete this plan? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/plans");
      } else {
        const json = await res.json();
        alert(json.error || "Failed to delete plan");
      }
    } catch {
      alert("Network error");
    }
  }

  async function downloadPdf() {
    if (!profile || !plan) return;
    setPdfBusy(true);
    try {
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
    } finally {
      setPdfBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-zinc-500">
        Loading saved plan...
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
          href="/plans"
          className="mt-4 inline-block text-sm text-zinc-600 hover:underline"
        >
          Back to all plans
        </Link>
      </main>
    );
  }

  if (!plan || !profile) return null;

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const totalWeeks = plan.result.phases.reduce((s, p) => s + p.weeks, 0);
  const totalCost = courses.reduce((s, c) => s + c.price_usd, 0);

  const statusColors = {
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/plans" className="text-sm text-zinc-500 hover:underline">
        ← Back to all plans
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={updateName}
                onKeyDown={(e) => e.key === "Enter" && updateName()}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-2xl font-semibold dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="cursor-pointer text-3xl font-semibold tracking-tight hover:text-zinc-600 dark:hover:text-zinc-300"
              title="Click to edit"
            >
              {plan.name}
            </h1>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[plan.status]}`}>
              {plan.status}
            </span>
            <span className="text-sm text-zinc-500">
              Created {new Date(plan.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
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

      {plan.result.portfolio_project && (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Capstone project
          </h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {plan.result.portfolio_project}
          </p>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="inline-flex h-12 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pdfBusy ? "Generating..." : "Download PDF"}
        </button>

        <select
          value={plan.status}
          onChange={(e) => updateStatus(e.target.value as Plan["status"])}
          className="inline-flex h-12 items-center rounded-full border border-zinc-300 px-6 text-sm font-medium dark:border-zinc-700"
        >
          <option value="active">Mark as Active</option>
          <option value="completed">Mark as Completed</option>
          <option value="archived">Archive</option>
        </select>

        <button
          onClick={deletePlan}
          className="inline-flex h-12 items-center rounded-full border border-red-300 px-6 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
        >
          Delete Plan
        </button>
      </div>
    </main>
  );
}
