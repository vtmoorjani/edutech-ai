"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "skillpath:ai_disclosure_dismissed";

export function AiDisclosureBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) !== "1") setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="AI disclosure"
      className="border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-2 text-xs">
        <p>
          <strong className="font-semibold">AI-generated.</strong>{" "}
          Skill gaps, course recommendations, and roadmaps are produced by an
          AI model. Verify course details on the provider's site before
          purchasing.
        </p>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setShow(false);
          }}
          className="shrink-0 rounded px-2 py-1 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/60"
          aria-label="Dismiss AI disclosure"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
