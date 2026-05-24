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

export type FilterResult = {
  courses: ScoredCourse[];
  constraint_notes: string[];
};

export function filterAndScore(
  profile: ProfileInputT,
  gap: SkillGapResultT,
  topN = 20,
): FilterResult {
  const totalHoursAvailable = profile.weekly_hours * profile.timeline_weeks;
  const formatPrefs = new Set(profile.preferred_formats);
  const constraint_notes: string[] = [];

  // Skill → gap weight (only count skills that actually have a gap)
  const gapWeights: Record<string, number> = {};
  for (const g of gap.gaps) {
    if (g.gap_size === "none") continue;
    gapWeights[g.skill_id] = LEVEL_WEIGHT[g.gap_size];
  }
  const totalGapWeight = Object.values(gapWeights).reduce((a, b) => a + b, 0);

  if (totalGapWeight === 0) {
    constraint_notes.push(
      "Your skills already meet the requirements for this role. Consider advanced courses to differentiate yourself.",
    );
    return { courses: [], constraint_notes };
  }

  let droppedByBudget = 0;
  let droppedByTime = 0;
  const scored: ScoredCourse[] = [];

  for (const course of COURSES) {
    const fitsBudget = course.price_usd <= profile.budget_usd;
    const fitsTime = course.duration_hours <= totalHoursAvailable;
    const fitsFormat = [...formatPrefs].some((p) =>
      FORMAT_FIT[p]?.has(course.format),
    );

    if (!fitsBudget) { droppedByBudget++; continue; }
    if (!fitsTime) { droppedByTime++; continue; }

    const covered = course.skill_ids.filter((sid) => gapWeights[sid] != null);
    if (covered.length === 0) continue;

    const coverageWeight = covered.reduce(
      (sum, sid) => sum + (gapWeights[sid] ?? 0),
      0,
    );
    let score = (coverageWeight / totalGapWeight) * 100;

    // Soft modifiers
    if (!fitsFormat) score *= 0.85;
    if (course.rating != null) score += (course.rating - 4) * 2;
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

  if (scored.length === 0 && droppedByBudget > 0) {
    const cheapest = COURSES
      .filter((c) => c.duration_hours <= totalHoursAvailable)
      .sort((a, b) => a.price_usd - b.price_usd)[0];
    const suggestion = cheapest
      ? `Increasing your budget to $${cheapest.price_usd} would unlock more options.`
      : "";
    constraint_notes.push(
      `Limited options at your current budget ($${profile.budget_usd}). ${droppedByBudget} courses were filtered out. ${suggestion}`,
    );
  }

  if (scored.length === 0 && droppedByTime > 0) {
    constraint_notes.push(
      `Your available time (${totalHoursAvailable} hours total) is limited. ${droppedByTime} courses were filtered out. Consider extending your timeline or increasing weekly hours.`,
    );
  }

  // Deduplicate: if two courses share >80% skill overlap at the same level, keep the higher-scored one
  scored.sort((a, b) => b.score - a.score);
  const deduped: ScoredCourse[] = [];
  for (const candidate of scored) {
    const isDuplicate = deduped.some((kept) => {
      const overlapCount = candidate.reasons.coveredSkillIds.filter((sid) =>
        kept.reasons.coveredSkillIds.includes(sid),
      ).length;
      const overlapRatio =
        overlapCount /
        Math.max(candidate.reasons.coveredSkillIds.length, 1);
      return overlapRatio > 0.8 && candidate.course.level === kept.course.level;
    });
    if (!isDuplicate) deduped.push(candidate);
  }

  return { courses: deduped.slice(0, topN), constraint_notes };
}
