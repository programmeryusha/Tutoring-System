-- PantherTutor Database Schema (Sprint 3)
-- Run this in Supabase SQL Editor

-- ============================================
-- DROP EXISTING TABLES (clean slate)
-- ============================================
drop table if exists ratings cascade;
drop table if exists sessions cascade;
drop table if exists matches cascade;
drop table if exists user_skills cascade;
drop table if exists skills cascade;
drop table if exists profiles cascade;

-- ============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  bio text,
  avatar_url text,
  university text default 'Georgia State University',
  year text,
  major text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- SKILLS TABLE
-- ============================================
create table skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table skills enable row level security;

create policy "Skills are viewable by everyone"
  on skills for select using (true);

-- Seed common skills
insert into skills (name, category) values
  ('Calculus', 'Mathematics'),
  ('Linear Algebra', 'Mathematics'),
  ('Statistics', 'Mathematics'),
  ('Discrete Math', 'Mathematics'),
  ('Python', 'Computer Science'),
  ('Java', 'Computer Science'),
  ('JavaScript', 'Computer Science'),
  ('C++', 'Computer Science'),
  ('Data Structures', 'Computer Science'),
  ('Algorithms', 'Computer Science'),
  ('Web Development', 'Computer Science'),
  ('Database Systems', 'Computer Science'),
  ('Machine Learning', 'Computer Science'),
  ('Physics I', 'Science'),
  ('Physics II', 'Science'),
  ('Chemistry', 'Science'),
  ('Biology', 'Science'),
  ('English Composition', 'Humanities'),
  ('Technical Writing', 'Humanities'),
  ('Public Speaking', 'Humanities'),
  ('Economics', 'Business'),
  ('Accounting', 'Business'),
  ('Marketing', 'Business'),
  ('Finance', 'Business'),
  ('Spanish', 'Languages'),
  ('French', 'Languages');

-- ============================================
-- USER_SKILLS TABLE (strengths & weaknesses)
-- ============================================
create table user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  is_strength boolean not null default true,
  skill_level text check (skill_level in ('beginner', 'intermediate', 'advanced')) default 'intermediate',
  created_at timestamptz default now(),
  unique(user_id, skill_id)
);

-- Enable RLS
alter table user_skills enable row level security;

create policy "User skills are viewable by everyone"
  on user_skills for select using (true);

create policy "Users can manage their own skills"
  on user_skills for insert with check (auth.uid() = user_id);

create policy "Users can update their own skills"
  on user_skills for update using (auth.uid() = user_id);

create policy "Users can delete their own skills"
  on user_skills for delete using (auth.uid() = user_id);

-- ============================================
-- MATCHES TABLE (AI matching results)
-- ============================================
create table matches (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references profiles(id) on delete cascade,
  user2_id uuid not null references profiles(id) on delete cascade,
  match_score float not null default 0,
  matched_skills text[] default '{}',
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamptz default now(),
  check (user1_id <> user2_id)
);

-- Enable RLS
alter table matches enable row level security;

create policy "Users can view their own matches"
  on matches for select using (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "Users can create matches"
  on matches for insert with check (auth.uid() = user1_id);

create policy "Users can update their matches"
  on matches for update using (auth.uid() = user1_id or auth.uid() = user2_id);

-- ============================================
-- SESSIONS TABLE (tutoring sessions)
-- ============================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  skill_id uuid references skills(id) on delete set null,
  subject text not null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60,
  status text check (status in ('scheduled', 'completed', 'cancelled')) default 'scheduled',
  notes text,
  meeting_link text,
  created_at timestamptz default now(),
  check (tutor_id <> student_id)
);

-- Enable RLS
alter table sessions enable row level security;

create policy "Users can view their own sessions"
  on sessions for select using (auth.uid() = tutor_id or auth.uid() = student_id);

create policy "Users can create sessions"
  on sessions for insert with check (auth.uid() = student_id or auth.uid() = tutor_id);

create policy "Users can update their own sessions"
  on sessions for update using (auth.uid() = tutor_id or auth.uid() = student_id);

-- ============================================
-- RATINGS TABLE
-- ============================================
create table ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  rater_id uuid not null references profiles(id) on delete cascade,
  rated_id uuid not null references profiles(id) on delete cascade,
  score int not null check (score >= 1 and score <= 5),
  review text,
  created_at timestamptz default now(),
  unique(session_id, rater_id)
);

-- Enable RLS
alter table ratings enable row level security;

create policy "Ratings are viewable by everyone"
  on ratings for select using (true);

create policy "Users can create ratings for their sessions"
  on ratings for insert with check (auth.uid() = rater_id);

-- ============================================
-- INDEXES for performance
-- ============================================
create index if not exists idx_user_skills_user on user_skills(user_id);
create index if not exists idx_user_skills_skill on user_skills(skill_id);
create index if not exists idx_matches_user1 on matches(user1_id);
create index if not exists idx_matches_user2 on matches(user2_id);
create index if not exists idx_sessions_tutor on sessions(tutor_id);
create index if not exists idx_sessions_student on sessions(student_id);
create index if not exists idx_ratings_rated on ratings(rated_id);
