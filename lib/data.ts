import skillTaxonomy from "@/data/skill-taxonomy.json";
import roleSkillMap from "@/data/role-skill-map.json";
import coursesSeed from "@/data/courses.seed.json";

export type Skill = {
  id: string;
  name: string;
  category: string;
  description?: string;
  related_skill_ids: string[];
};

export type RoleSkill = {
  skill_id: string;
  required_level: "low" | "medium" | "high";
  weight: number;
};

export type Role = {
  display_name: string;
  description: string;
  required_skills: RoleSkill[];
};

export type Course = {
  id: string;
  title: string;
  platform: string;
  provider?: string;
  url: string;
  duration_hours: number;
  price_usd: number;
  level: "beginner" | "intermediate" | "advanced" | "mixed";
  format: "self_paced" | "cohort" | "live" | "hybrid";
  rating?: number;
  review_count?: number;
  outcome_type: string[];
  skill_ids: string[];
  summary?: string;
};

export const SKILLS: Skill[] = (skillTaxonomy as { skills: Skill[] }).skills;
export const ROLES: Record<string, Role> = (
  roleSkillMap as { roles: Record<string, Role> }
).roles;
export const COURSES: Course[] = (coursesSeed as { courses: Course[] }).courses;

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
);

export const COURSE_BY_ID: Record<string, Course> = Object.fromEntries(
  COURSES.map((c) => [c.id, c]),
);

export function getRole(roleId: string): Role {
  const r = ROLES[roleId];
  if (!r) throw new Error(`Unknown role: ${roleId}`);
  return r;
}
