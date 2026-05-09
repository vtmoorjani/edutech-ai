import type { Course, Role, Skill } from "@/lib/data";
import type { ProfileInputT, SkillGapResultT } from "@/lib/schemas";

export function skillGapSystem(
  role: Role,
  roleId: string,
  skills: Skill[],
): { text: string; cache: boolean }[] {
  const taxonomy = skills
    .map(
      (s) =>
        `- [${s.id}] ${s.name} (${s.category}): ${s.description ?? ""}`,
    )
    .join("\n");

  const requirements = role.required_skills
    .map(
      (rs) =>
        `- ${rs.skill_id} → required_level=${rs.required_level} weight=${rs.weight}`,
    )
    .join("\n");

  const stable = `You are SkillPath AI's skill-gap analyst.

Your job: given a learner's profile, return a structured analysis of where they stand against a target role's required skills, using ONLY the skill IDs in the taxonomy below. Never invent new skills.

You must:
- Map the user's free-text current_skills (and resume_text, if present) to skill IDs in the taxonomy via fuzzy semantic matching.
- For every skill listed in the role requirements, return a gap entry — even if the gap is "none".
- Be specific in rationales: reference what the learner has, what they lack, and why the gap matters for the target role.
- transferable_strengths: short list of the learner's existing strengths (free-text, not skill IDs) that transfer to the target role.
- adjacent_skills_to_prioritize: 3–5 skill IDs (from the taxonomy) that would unlock outsized leverage given the learner's background.

Skill taxonomy:
${taxonomy}

Target role: ${roleId} (${role.display_name})
${role.description}

Required skills for this role:
${requirements}`;

  return [{ text: stable, cache: true }];
}

export function skillGapUserPrompt(profile: ProfileInputT): string {
  return `Learner profile:
- Current role: ${profile.current_role}
- Years of experience: ${profile.years_experience}
- Target role: ${profile.target_role}
- Current skills (free text): ${profile.current_skills.join(", ") || "(none provided)"}
- Weekly hours available: ${profile.weekly_hours}
- Budget: $${profile.budget_usd}
- Timeline: ${profile.timeline_weeks} weeks
- Preferred formats: ${profile.preferred_formats.join(", ")}
- Desired outcomes: ${profile.desired_outcomes.join(", ")}
- Intent: ${profile.intent ?? "(not specified)"}
${profile.resume_text ? `\nResume / LinkedIn profile text:\n${profile.resume_text}\n` : ""}
Analyze and return the structured skill gap.`;
}

export function recommendSystem(
  candidates: Course[],
  skills: Skill[],
): { text: string; cache: boolean }[] {
  const skillNames = Object.fromEntries(skills.map((s) => [s.id, s.name]));
  const catalog = candidates
    .map((c) => {
      const skillList = c.skill_ids
        .map((sid) => `${sid} (${skillNames[sid] ?? sid})`)
        .join(", ");
      return `[${c.id}]
  title: ${c.title}
  platform: ${c.platform} | provider: ${c.provider ?? "—"}
  url: ${c.url}
  duration: ${c.duration_hours}h | price: $${c.price_usd} | level: ${c.level} | format: ${c.format}
  rating: ${c.rating ?? "n/a"} (${c.review_count ?? 0} reviews)
  outcomes: ${c.outcome_type.join(", ") || "—"}
  skills: ${skillList}
  summary: ${c.summary ?? ""}`;
    })
    .join("\n\n");

  const stable = `You are SkillPath AI's recommendation explainer.

You will receive (1) a learner profile, (2) their skill gap analysis, and (3) a SHORTLIST of candidate courses pre-filtered for budget/time fit and skill-gap coverage.

Your job: rank the shortlist and produce a structured explanation for each recommendation. Constraints:

- Use ONLY course IDs that appear in the candidate shortlist below. Do not invent courses.
- Return at most 6 recommendations.
- Match score (0–100) should reflect: gap coverage × role relevance × format/outcome fit × credibility. Be honest — a poor fit gets a low score.
- For each recommendation, fill out:
  • why_recommended — 2–3 sentences grounded in the candidate's actual metadata
  • why_now — 1–2 sentences explaining sequencing relative to the learner's gap
  • gaps_addressed / gaps_not_covered — skill IDs (or short names) from the gap analysis
  • tradeoffs — the honest "what this course is NOT good for"
  • ideal_learner — one sentence describing who this course best fits
  • next_course_suggestion_id — optional follow-up course ID (must also be in the shortlist)
- Prefer a mix of platforms and formats unless one is clearly dominant.
- Be skeptical of courses with stale or thin metadata.

Candidate course shortlist (these are the ONLY courses you may recommend):

${catalog}`;

  return [{ text: stable, cache: true }];
}

export function recommendUserPrompt(
  profile: ProfileInputT,
  gap: SkillGapResultT,
): string {
  const gaps = gap.gaps
    .filter((g) => g.gap_size !== "none")
    .map((g) => `- ${g.skill_id} (${g.skill_name}): ${g.gap_size} gap — ${g.rationale}`)
    .join("\n");

  return `Learner profile:
- Current role: ${profile.current_role} (${profile.years_experience}y experience)
- Target role: ${profile.target_role}
- Weekly hours: ${profile.weekly_hours} | Budget: $${profile.budget_usd} | Timeline: ${profile.timeline_weeks} weeks
- Preferred formats: ${profile.preferred_formats.join(", ")}
- Desired outcomes: ${profile.desired_outcomes.join(", ")}
- Intent: ${profile.intent ?? "(not specified)"}

Skill gaps to address:
${gaps}

Adjacent skills the learner should prioritize: ${gap.adjacent_skills_to_prioritize.join(", ")}

Rank the shortlist above and return structured recommendations.`;
}

export function roadmapSystem(
  selectedCourses: Course[],
  skills: Skill[],
): { text: string; cache: boolean }[] {
  const skillNames = Object.fromEntries(skills.map((s) => [s.id, s.name]));
  const selected = selectedCourses
    .map(
      (c) =>
        `[${c.id}]
  title: ${c.title}
  platform: ${c.platform}
  duration: ${c.duration_hours}h | level: ${c.level} | format: ${c.format}
  skills: ${c.skill_ids.map((sid) => skillNames[sid] ?? sid).join(", ")}
  summary: ${c.summary ?? ""}`,
    )
    .join("\n\n");

  const stable = `You are SkillPath AI's roadmap planner.

You will receive (1) a learner profile, (2) their skill gap analysis, and (3) a list of courses the learner has selected. Your job is to sequence these courses into a phased learning roadmap.

Constraints:
- Use ONLY course IDs from the selected list below. Do not invent courses.
- The total weeks across all phases must fit within the learner's timeline_weeks (or be slightly under, never over).
- Each phase covers ONE focus area (e.g. "GenAI foundations", "RAG & evaluation"). Group courses that build on the same skill cluster.
- Sequence from prerequisite → applied → portfolio. Foundational/conceptual courses first, hands-on/agentic courses next, portfolio + career-packaging last.
- Each phase has 1–3 courses typically. Don't overload a phase.
- For each phase, write:
  • name — a short, motivating phase name
  • focus — one-sentence summary of what this phase builds
  • weeks — duration in weeks (account for the learner's weekly_hours × weeks ≥ total course hours in the phase, with buffer)
  • objective — what the learner will be able to DO after this phase
  • output_artifact — a concrete deliverable (e.g. "build a RAG demo with eval suite", "publish an AI PM teardown", "ship LinkedIn case study")
- portfolio_project — a single capstone artifact suggestion that synthesizes the whole roadmap, scoped to the learner's intent.
- linkedin_update_suggestion — a concrete bullet-point suggestion for the learner's LinkedIn after completing the roadmap.

Selected courses:

${selected}`;

  return [{ text: stable, cache: false }];
}

export function roadmapUserPrompt(
  profile: ProfileInputT,
  gap: SkillGapResultT,
): string {
  const topGaps = gap.gaps
    .filter((g) => g.gap_size === "large" || g.gap_size === "medium")
    .map((g) => `${g.skill_name} (${g.gap_size})`)
    .join(", ");

  return `Learner profile:
- Current role: ${profile.current_role} (${profile.years_experience}y experience)
- Target role: ${profile.target_role}
- Weekly hours: ${profile.weekly_hours} | Timeline: ${profile.timeline_weeks} weeks
- Desired outcomes: ${profile.desired_outcomes.join(", ")}
- Intent: ${profile.intent ?? "(not specified)"}

Top gaps to close: ${topGaps || "(none flagged)"}

Sequence the selected courses into a phased roadmap that fits within ${profile.timeline_weeks} weeks at ${profile.weekly_hours}h/week.`;
}
