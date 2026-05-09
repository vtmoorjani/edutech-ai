// Thin wrapper around posthog-js so the rest of the app doesn't import it directly.
// No-ops gracefully when NEXT_PUBLIC_POSTHOG_KEY is unset (local dev).

import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
    autocapture: false,
  });
  initialized = true;
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!initialized || typeof window === "undefined") return;
  try {
    posthog.capture(event, props);
  } catch {
    // Telemetry failures must never break the user flow.
  }
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!initialized || typeof window === "undefined") return;
  try {
    posthog.identify(userId, traits);
  } catch {}
}

export const FUNNEL = {
  ASSESSMENT_STARTED: "assessment_started",
  ASSESSMENT_COMPLETED: "assessment_completed",
  RECS_VIEWED: "recs_viewed",
  COURSE_CLICKED: "course_clicked",
  ROADMAP_BUILT: "roadmap_built",
  ROADMAP_SAVED: "roadmap_saved",
  PDF_EXPORTED: "pdf_exported",
  LINKEDIN_COPIED: "linkedin_copied",
  FEEDBACK_SUBMITTED: "feedback_submitted",
} as const;
