"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Plan = {
  id: string;
  name: string;
  target_role: string;
  status: "active" | "completed" | "archived";
  total_weeks: number;
  total_courses: number;
  created_at: string;
  updated_at: string;
};

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAuthAndLoad() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login?next=/plans");
        return;
      }

      try {
        const res = await fetch("/api/plans");
        const json = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(json.error || "Failed to load plans");
          return;
        }
        setPlans(json.plans);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Network error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkAuthAndLoad();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function deletePlan(id: string) {
    if (!confirm("Are you sure you want to delete this plan?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPlans((prev) => prev.filter((p) => p.id !== id));
      } else {
        const json = await res.json();
        alert(json.error || "Failed to delete plan");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  async function updateStatus(id: string, status: Plan["status"]) {
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setPlans((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status } : p))
        );
      }
    } catch {
      // Silently fail
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="text-sm text-zinc-500">Loading your plans...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
        <Link
          href="/intake"
          className="mt-4 inline-block text-sm text-zinc-600 hover:underline"
        >
          Start a new assessment
        </Link>
      </main>
    );
  }

  const activePlans = plans.filter((p) => p.status === "active");
  const completedPlans = plans.filter((p) => p.status === "completed");
  const archivedPlans = plans.filter((p) => p.status === "archived");

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">My Learning Plans</h1>
        <Link
          href="/intake"
          className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New Plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
            No saved plans yet
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Complete an assessment and save your roadmap to see it here.
          </p>
          <Link
            href="/intake"
            className="mt-6 inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Start Assessment
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {activePlans.length > 0 && (
            <PlanSection
              title="Active"
              plans={activePlans}
              onDelete={deletePlan}
              onStatusChange={updateStatus}
              deletingId={deletingId}
            />
          )}
          {completedPlans.length > 0 && (
            <PlanSection
              title="Completed"
              plans={completedPlans}
              onDelete={deletePlan}
              onStatusChange={updateStatus}
              deletingId={deletingId}
            />
          )}
          {archivedPlans.length > 0 && (
            <PlanSection
              title="Archived"
              plans={archivedPlans}
              onDelete={deletePlan}
              onStatusChange={updateStatus}
              deletingId={deletingId}
            />
          )}
        </div>
      )}
    </main>
  );
}

function PlanSection({
  title,
  plans,
  onDelete,
  onStatusChange,
  deletingId,
}: {
  title: string;
  plans: Plan[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Plan["status"]) => void;
  deletingId: string | null;
}) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title} ({plans.length})
      </h2>
      <div className="space-y-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            isDeleting={deletingId === plan.id}
          />
        ))}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  onDelete,
  onStatusChange,
  isDeleting,
}: {
  plan: Plan;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Plan["status"]) => void;
  isDeleting: boolean;
}) {
  const statusColors = {
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <Link
            href={`/plans/${plan.id}`}
            className="truncate text-lg font-semibold hover:underline"
          >
            {plan.name}
          </Link>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[plan.status]}`}
          >
            {plan.status}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          <span>{plan.target_role}</span>
          <span>{plan.total_courses} courses</span>
          <span>{plan.total_weeks} weeks</span>
          <span>Created {new Date(plan.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <select
          value={plan.status}
          onChange={(e) => onStatusChange(plan.id, e.target.value as Plan["status"])}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
        <button
          onClick={() => onDelete(plan.id)}
          disabled={isDeleting}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-950"
        >
          {isDeleting ? "..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
