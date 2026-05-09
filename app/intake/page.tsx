"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProfileInputT } from "@/lib/schemas";
import { track, FUNNEL } from "@/lib/analytics";

const FORMATS = [
  { value: "self_paced", label: "Self-paced" },
  { value: "cohort", label: "Cohort-based" },
  { value: "live", label: "Live instructor" },
  { value: "hybrid", label: "Hybrid" },
] as const;

const OUTCOMES = [
  { value: "skills", label: "Practical skills" },
  { value: "portfolio", label: "Portfolio artifact" },
  { value: "certificate", label: "Certificate" },
  { value: "job_ready", label: "Job readiness" },
] as const;

export default function IntakePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track(FUNNEL.ASSESSMENT_STARTED);
  }, []);

  const [form, setForm] = useState({
    current_role: "",
    target_role: "AI Product Manager",
    years_experience: 8,
    current_skills_text: "",
    resume_text: "",
    weekly_hours: 5,
    budget_usd: 1000,
    timeline_weeks: 12,
    preferred_formats: ["self_paced", "cohort"] as string[],
    desired_outcomes: ["skills", "portfolio"] as string[],
    intent: "",
  });

  function toggleArr(key: "preferred_formats" | "desired_outcomes", val: string) {
    setForm((f) => {
      const set = new Set(f[key]);
      if (set.has(val)) set.delete(val);
      else set.add(val);
      return { ...f, [key]: Array.from(set) };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: ProfileInputT = {
      current_role: form.current_role.trim(),
      target_role: form.target_role.trim(),
      years_experience: Number(form.years_experience),
      current_skills: form.current_skills_text
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      resume_text: form.resume_text.trim() || undefined,
      weekly_hours: Number(form.weekly_hours),
      budget_usd: Number(form.budget_usd),
      timeline_weeks: Number(form.timeline_weeks),
      preferred_formats: form.preferred_formats as ProfileInputT["preferred_formats"],
      desired_outcomes: form.desired_outcomes as ProfileInputT["desired_outcomes"],
      intent: form.intent.trim() || undefined,
    };

    try {
      const res = await fetch("/api/skill-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong");
        setSubmitting(false);
        return;
      }
      sessionStorage.setItem("skillpath:profile", JSON.stringify(payload));
      sessionStorage.setItem("skillpath:gap", JSON.stringify(json.gap));
      track(FUNNEL.ASSESSMENT_COMPLETED, {
        target_role: payload.target_role,
        years_experience: payload.years_experience,
        weekly_hours: payload.weekly_hours,
        budget_usd: payload.budget_usd,
        timeline_weeks: payload.timeline_weeks,
        gap_count: json.gap?.gaps?.length ?? 0,
      });
      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Tell us about you
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        ~5 minutes. We'll analyze your skill gap and recommend a learning path.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <Field label="Current role">
          <input
            required
            type="text"
            value={form.current_role}
            onChange={(e) => setForm({ ...form, current_role: e.target.value })}
            placeholder="e.g. Product Manager, Business Analyst"
            className={inputCls}
          />
        </Field>

        <Field label="Target role" hint="MVP supports AI Product Manager">
          <input
            required
            type="text"
            value={form.target_role}
            disabled
            className={`${inputCls} opacity-60`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Years of experience">
            <input
              required
              type="number"
              min={0}
              max={60}
              value={form.years_experience}
              onChange={(e) =>
                setForm({ ...form, years_experience: Number(e.target.value) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Weekly hours available">
            <input
              required
              type="number"
              min={1}
              max={60}
              value={form.weekly_hours}
              onChange={(e) =>
                setForm({ ...form, weekly_hours: Number(e.target.value) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Budget (USD)">
            <input
              required
              type="number"
              min={0}
              max={50000}
              step={50}
              value={form.budget_usd}
              onChange={(e) =>
                setForm({ ...form, budget_usd: Number(e.target.value) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Timeline (weeks)">
            <input
              required
              type="number"
              min={1}
              max={104}
              value={form.timeline_weeks}
              onChange={(e) =>
                setForm({ ...form, timeline_weeks: Number(e.target.value) })
              }
              className={inputCls}
            />
          </Field>
        </div>

        <Field
          label="Current skills"
          hint="Comma- or newline-separated. We'll match these against the role taxonomy."
        >
          <textarea
            value={form.current_skills_text}
            onChange={(e) =>
              setForm({ ...form, current_skills_text: e.target.value })
            }
            rows={3}
            placeholder="e.g. product strategy, stakeholder management, SQL, basic Python"
            className={inputCls}
          />
        </Field>

        <Field
          label="Resume or LinkedIn text (optional)"
          hint="Paste in any extra context — we'll extract additional skills from it."
        >
          <textarea
            value={form.resume_text}
            onChange={(e) => setForm({ ...form, resume_text: e.target.value })}
            rows={5}
            className={inputCls}
          />
        </Field>

        <Field label="Preferred learning formats">
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <Pill
                key={f.value}
                active={form.preferred_formats.includes(f.value)}
                onClick={() => toggleArr("preferred_formats", f.value)}
              >
                {f.label}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="What do you want out of this?">
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <Pill
                key={o.value}
                active={form.desired_outcomes.includes(o.value)}
                onClick={() => toggleArr("desired_outcomes", o.value)}
              >
                {o.label}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Intent (optional)" hint="One line about your goal.">
          <input
            type="text"
            value={form.intent}
            onChange={(e) => setForm({ ...form, intent: e.target.value })}
            placeholder="e.g. Move into an AI PM role at a Series B startup within 6 months"
            className={inputCls}
          />
        </Field>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting ? "Analyzing your skill gap…" : "Get my skill gap"}
        </button>
        <p className="text-xs text-zinc-500">
          AI-generated. Takes 10–20 seconds.
        </p>
      </form>
    </main>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium">{label}</div>
      {hint && (
        <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>
      )}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
