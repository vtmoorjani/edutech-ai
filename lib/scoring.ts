import { COURSES, type Course } from "@/lib/data";
import type { ProfileInputT, SkillGapResultT } from "@/lib/schemas";

const LEVEL_WEIGHT: Record<"none" | "small" | "medium" | "large", number> = {
  none: 0,
  small: 1,
  medium: 2,
  large: 3,
};

const FORMAT_FIT: Record<string, Set<string>> = {
  self_paced: new Set(["self_paced", "hybrid"]),
  cohort: new Set(["cohort", "hybrid", "live"]),
  live: new Set(["live", "cohort", "hybrid"]),
  hybrid: new Set(["hybrid", "self_paced", "cohort", "live"]),
};

export type ScoredCourse = {
  course: Course;
  score: number;
  reasons: {
    coverage: number;
    coveredSkillIds: string[];
    fitsBudget: boolean;
    fitsTime: boolean;
    fitsFormat: boolean;
  };
};

export function filterAndScore(
  profile: ProfileInputT,
  gap: SkillGapResultT,
  topN = 20,
): ScoredCourse[] {
  const totalHoursAvailable = profile.weekly_hours * profile.timeline_weeks;
  const formatPrefs = new Set(profile.preferred_formats);

  // Skill → gap weight (only count skills that actually have a gap)
  const gapWeights: Record<string, number> = {};
  for (const g of gap.gaps) {
    if (g.gap_size === "none") continue;
    gapWeights[g.skill_id] = LEVEL_WEIGHT[g.gap_size];
  }
  const totalGapWeight = Object.values(gapWeights).reduce((a, b) => a + b, 0);
  if (totalGapWeight === 0) return [];

  const scored: ScoredCourse[] = [];

  for (const course of COURSES) {
    const fitsBudget = course.price_usd <= profile.budget_usd;
    const fitsTime = course.duration_hours <= totalHoursAvailable;
    const fitsFormat = [...formatPrefs].some((p) =>
      FORMAT_FIT[p]?.has(course.format),
    );

    if (!fitsBudget || !fitsTime) continue; // hard filters
    // Format is a soft signal — keep it but penalize below.

    const covered = course.skill_ids.filter((sid) => gapWeights[sid] != null);
    if (covered.length === 0) continue;

    const coverageWeight = covered.reduce(
      (sum, sid) => sum + (gapWeights[sid] ?? 0),
      0,
    );
    let score = (coverageWeight / totalGapWeight) * 100;

    // Soft modifiers
    if (!fitsFormat) score *= 0.85;
    if (course.rating != null) score += (course.rating - 4) * 2; // small lift for high-rated
    // Slight penalty for very short or very long courses relative to timeline
    const idealHours = totalHoursAvailable * 0.4;
    const drift = Math.abs(course.duration_hours - idealHours) / idealHours;
    if (drift > 1.5) score *= 0.95;

    scored.push({
      course,
      score,
      reasons: {
        coverage: coverageWeight / totalGapWeight,
        coveredSkillIds: covered,
        fitsBudget,
        fitsTime,
        fitsFormat,
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
