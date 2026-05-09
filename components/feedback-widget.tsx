"use client";

import { useState } from "react";
import { track, FUNNEL } from "@/lib/analytics";

type State =
  | { kind: "idle" }
  | { kind: "selected"; thumbs: 1 | -1 }
  | { kind: "submitting" }
  | { kind: "saved" }
  | { kind: "auth_required" }
  | { kind: "error"; message: string };

export function FeedbackWidget({ courseId }: { courseId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [reason, setReason] = useState("");

  async function submit(thumbs: 1 | -1, reasonText?: string) {
    setState({ kind: "submitting" });
    track(FUNNEL.FEEDBACK_SUBMITTED, { course_id: courseId, thumbs });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          thumbs,
          reason: reasonText?.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        setState({ kind: "auth_required" });
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setState({
          kind: "error",
          message: json.error || "Couldn't send feedback",
        });
        return;
      }
      setState({ kind: "saved" });
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  if (state.kind === "saved") {
    return (
      <div className="text-xs text-emerald-700 dark:text-emerald-400">
        Thanks for the feedback ✓
      </div>
    );
  }

  if (state.kind === "auth_required") {
    return (
      <div className="text-xs text-zinc-500">
        Sign in (via Save my plan) to submit feedback.
      </div>
    );
  }

  if (state.kind === "selected" || state.kind === "submitting") {
    const isPositive = state.kind === "selected" && state.thumbs === 1;
    return (
      <div className="space-y-2">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder={
            isPositive
              ? "What made this a good fit? (optional)"
              : "What's off about this rec? (optional)"
          }
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            disabled={state.kind === "submitting"}
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={state.kind === "submitting"}
            onClick={() => {
              const t = state.kind === "selected" ? state.thumbs : 1;
              void submit(t, reason);
            }}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {state.kind === "submitting" ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">Was this helpful?</span>
      <button
        type="button"
        onClick={() => setState({ kind: "selected", thumbs: 1 })}
        aria-label="Helpful recommendation"
        className="rounded-md px-2 py-1 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => setState({ kind: "selected", thumbs: -1 })}
        aria-label="Not helpful recommendation"
        className="rounded-md px-2 py-1 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        👎
      </button>
      {state.kind === "error" && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {state.message}
        </span>
      )}
    </div>
  );
}
