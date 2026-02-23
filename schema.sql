create extension if not exists pgcrypto;
-- let's make the enums 
do $$ begin 
create type user_role as enum ('student', 'tutor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin 
create type skill_level as enum('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
create type session_status as enum('scheduled', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- users 
create table if not exists users(
    user_id uuid primary key default gen_random_uuid(),
    username text not null unique,
    password_hash text not null,
    role user_role not null, 
    created_at timestamptz not null default now(),
    vacation_mode boolean not null default false
);

-- logiin history 
create table if not exists login_history(
    login_id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(user_id) on delete cascade,
    login_time timestamptz not null default now(),
    logout_time timestamptz null
);
-- index to speed up queries on login history for specific users
create index if not exists idx_login_history_user_id on login_history(user_id);

-- skills
create table if not exists skills(
    skill_id uuid primary key default gen_random_uuid(),
    skill_name text not null unique); 

-- sessions 
create table if not exists sessions(
    session_id uuid primary key default gen_random_uuid(),
    student_id uuid not null references users(user_id) on delete cascade,
    tutor_id uuid references users(user_id) on delete set null,
    skill_id uuid references skills(skill_id) on delete set null,
    scheduled_at timestamptz not null,
    duration_minutes int not null,
    status session_status not null default 'scheduled',
    created_at timestamptz not null default now(),
    -- tutor_id being null when session is scheduled is not a problem, we can assign a tutor later
    check (tutor_id is null or tutor_id <> student_id)
);

-- making indexes to speed up queries on sessions table, especially when filtering by student_id, tutor_id, or skill_id
create index if not exists idx_sessions_student_id on sessions(student_id);
create index if not exists idx_sessions_tutor_id on sessions(tutor_id);
create index if not exists idx_sessions_skill_id on sessions(skill_id);
