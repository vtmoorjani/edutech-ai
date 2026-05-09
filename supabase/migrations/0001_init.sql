-- SkillPath AI — initial schema
-- Auth provided by Supabase auth.users; per-user rows reference auth.uid() via RLS.

create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────────────────────
-- Reference data (seeded from /data/*.json — no RLS, public-readable)
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists skills (
  id            text primary key,
  name          text not null,
  category      text not null,
  description   text,
  related_skill_ids text[] not null default '{}'
);

create table if not exists role_skills (
  target_role     text not null,
  skill_id        text not null references skills(id) on delete cascade,
  required_level  text not null check (required_level in ('low','medium','high')),
  weight          int  not null default 1,
  primary key (target_role, skill_id)
);

create table if not exists courses (
  id              text primary key,
  title           text not null,
  platform        text not null,
  provider        text,
  url             text not null,
  duration_hours  int  not null,
  price_usd       int  not null,
  level           text not null check (level in ('beginner','intermediate','advanced','mixed')),
  format          text not null check (format in ('self_paced','cohort','live','hybrid')),
  rating          numeric(3,2),
  review_count    int,
  outcome_type    text[] not null default '{}',
  skill_ids       text[] not null default '{}',
  summary         text,
  last_verified_at timestamptz not null default now()
);

create index if not exists courses_skill_ids_idx on courses using gin (skill_ids);
create index if not exists role_skills_role_idx on role_skills (target_role);

-- ──────────────────────────────────────────────────────────────────────────────
-- Per-user data (RLS enabled — owner-only access)
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  current_role      text,
  target_role       text,
  years_experience  int,
  current_skills    jsonb not null default '[]'::jsonb,
  weekly_hours      int,
  budget_usd        int,
  timeline_weeks    int,
  preferred_formats text[] not null default '{}',
  desired_outcomes  text[] not null default '{}',
  intent            text,
  updated_at        timestamptz not null default now()
);

create table if not exists skill_gaps (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  target_role text not null,
  result      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists skill_gaps_user_idx on skill_gaps (user_id, created_at desc);

create table if not exists recommendations (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  gap_id       uuid not null references skill_gaps(id) on delete cascade,
  course_id    text not null references courses(id),
  rank         int  not null,
  match_score  numeric(5,2) not null,
  result       jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists recommendations_user_idx on recommendations (user_id, created_at desc);

create table if not exists roadmaps (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  target_role  text not null,
  result       jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists roadmaps_user_idx on roadmaps (user_id, created_at desc);

create table if not exists feedback (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid references recommendations(id) on delete set null,
  thumbs            int  not null check (thumbs in (-1, 1)),
  reason            text,
  created_at        timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────────────────

alter table profiles        enable row level security;
alter table skill_gaps      enable row level security;
alter table recommendations enable row level security;
alter table roadmaps        enable row level security;
alter table feedback        enable row level security;

create policy "owner read"   on profiles        for select using (auth.uid() = user_id);
create policy "owner write"  on profiles        for insert with check (auth.uid() = user_id);
create policy "owner update" on profiles        for update using (auth.uid() = user_id);

create policy "owner read"   on skill_gaps      for select using (auth.uid() = user_id);
create policy "owner write"  on skill_gaps      for insert with check (auth.uid() = user_id);

create policy "owner read"   on recommendations for select using (auth.uid() = user_id);
create policy "owner write"  on recommendations for insert with check (auth.uid() = user_id);

create policy "owner read"   on roadmaps        for select using (auth.uid() = user_id);
create policy "owner write"  on roadmaps        for insert with check (auth.uid() = user_id);

create policy "owner read"   on feedback        for select using (auth.uid() = user_id);
create policy "owner write"  on feedback        for insert with check (auth.uid() = user_id);

-- Reference tables: read-only for everyone (writes via service-role seed script).
alter table skills      enable row level security;
alter table role_skills enable row level security;
alter table courses     enable row level security;

create policy "public read" on skills      for select using (true);
create policy "public read" on role_skills for select using (true);
create policy "public read" on courses     for select using (true);
