-- Personal Job Assistance - Supabase schema (run in SQL editor)
-- Free tier: 500MB DB

-- Profiles extends auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text,
  skills text[],
  experience_years int,
  location_pref text,
  remote_pref text,
  resume_text text,
  resume_updated_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Saved jobs
create table if not exists saved_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  job_hash text not null,
  job_data jsonb not null,
  created_at timestamp with time zone default now(),
  unique(user_id, job_hash)
);

-- ATS cache (per user per job)
create table if not exists ats_cache (
  user_id uuid references profiles(id) on delete cascade,
  job_hash text not null,
  job_description_hash text,
  resume_hash text,
  score jsonb not null,
  created_at timestamp with time zone default now(),
  primary key (user_id, job_hash)
);

-- Applied tracker (manual)
create table if not exists applied_jobs (
  user_id uuid references profiles(id) on delete cascade,
  job_hash text not null,
  applied_at timestamp with time zone default now(),
  primary key (user_id, job_hash)
);

-- Enable RLS
alter table profiles enable row level security;
alter table saved_jobs enable row level security;
alter table ats_cache enable row level security;
alter table applied_jobs enable row level security;

-- Policies: user can only access own rows
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Users manage own saved_jobs" on saved_jobs for all using (auth.uid() = user_id);
create policy "Users manage own ats_cache" on ats_cache for all using (auth.uid() = user_id);
create policy "Users manage own applied" on applied_jobs for all using (auth.uid() = user_id);
