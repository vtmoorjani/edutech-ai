import { z } from "zod";

export const SkillLevel = z.enum(["none", "low", "medium", "high"]);
export type SkillLevelT = z.infer<typeof SkillLevel>;

export const LearningFormat = z.enum(["self_paced", "cohort", "live", "hybrid"]);
export const Outcome = z.enum(["certificate", "portfolio", "skills", "job_ready"]);

export const ProfileInput = z.object({
  current_role: z.string().min(1).max(200),
  target_role: z.string().min(1).max(200),
  years_experience: z.number().int().min(0).max(60),
  current_skills: z.array(z.string().min(1).max(120)).max(60),
  resume_text: z.string().max(20_000).optional(),
  weekly_hours: z.number().int().min(1).max(60),
  budget_usd: z.number().int().min(0).max(50_000),
  timeline_weeks: z.number().int().min(1).max(104),
  preferred_formats: z.array(LearningFormat).min(1),
  desired_outcomes: z.array(Outcome).min(1),
  intent: z.string().max(500).optional(),
});
export type ProfileInputT = z.infer<typeof ProfileInput>;

export const SkillGap = z.object({
  skill_id: z.string(),
  skill_name: z.string(),
  category: z.string(),
  current_level: SkillLevel,
  target_level: SkillLevel,
  gap_size: z.enum(["none", "small", "medium", "large"]),
  rationale: z.string().min(1).max(600),
});

export const SkillGapResult = z.object({
  summary: z.string().max(1500),
  transferable_strengths: z.array(z.string().max(200)).max(10),
  gaps: z.array(SkillGap).min(1).max(20),
  adjacent_skills_to_prioritize: z.array(z.string().max(120)).max(10),
});
export type SkillGapResultT = z.infer<typeof SkillGapResult>;

export const Recommendation = z.object({
  course_id: z.string(),
  rank: z.number().int().min(1),
  match_score: z.number().min(0).max(100),
  why_recommended: z.string().max(800),
  why_now: z.string().max(400),
  gaps_addressed: z.array(z.string()).max(20),
  gaps_not_covered: z.array(z.string()).max(20),
  tradeoffs: z.string().max(400),
  ideal_learner: z.string().max(300),
  next_course_suggestion_id: z.string().optional(),
});

export const RecommendationResult = z.object({
  recommendations: z.array(Recommendation).min(1).max(10),
});
export type RecommendationResultT = z.infer<typeof RecommendationResult>;

export const RoadmapPhase = z.object({
  phase: z.number().int().min(1),
  name: z.string().max(120),
  focus: z.string().max(300),
  weeks: z.number().int().min(1).max(52),
  course_ids: z.array(z.string()),
  objective: z.string().max(400),
  output_artifact: z.string().max(300),
});

export const RoadmapResult = z.object({
  total_weeks: z.number().int().min(1).max(104),
  phases: z.array(RoadmapPhase).min(1).max(8),
  portfolio_project: z.string().max(600).optional(),
  linkedin_update_suggestion: z.string().max(600).optional(),
});
export type RoadmapResultT = z.infer<typeof RoadmapResult>;
