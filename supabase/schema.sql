-- 跃迹 YUEJI — Supabase schema
-- 在 Supabase SQL Editor 中执行一次。
-- 认证方式：Email/Password（前端把手机号映射为内部 email），不需要短信。

create extension if not exists pgcrypto;

-- 用户档案：注册后先不写入，首次引导完成时 upsert。
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique,
  nickname text not null default '',
  sex text,
  age_band text,
  height numeric,
  weight numeric,
  goal text,
  freq integer,
  level text,
  updated_at timestamptz not null default now()
);

-- 运动记录：data 保留与前端一致的活动 JSON（含 stream / strength）。
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null,
  source text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_activities_user_date
  on public.activities(user_id, date desc);

-- 体重日志。
create table if not exists public.weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  kg numeric not null check (kg >= 25 and kg <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- 更新时间触发器。
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_activities_touch on public.activities;
create trigger trg_activities_touch before update on public.activities
  for each row execute function public.touch_updated_at();

-- RLS：每个用户只能操作自己的数据。
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.weights enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

drop policy if exists "activities_select_own" on public.activities;
drop policy if exists "activities_insert_own" on public.activities;
drop policy if exists "activities_update_own" on public.activities;
drop policy if exists "activities_delete_own" on public.activities;
create policy "activities_select_own" on public.activities
  for select using (auth.uid() = user_id);
create policy "activities_insert_own" on public.activities
  for insert with check (auth.uid() = user_id);
create policy "activities_update_own" on public.activities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activities_delete_own" on public.activities
  for delete using (auth.uid() = user_id);

drop policy if exists "weights_select_own" on public.weights;
drop policy if exists "weights_insert_own" on public.weights;
drop policy if exists "weights_update_own" on public.weights;
drop policy if exists "weights_delete_own" on public.weights;
create policy "weights_select_own" on public.weights
  for select using (auth.uid() = user_id);
create policy "weights_insert_own" on public.weights
  for insert with check (auth.uid() = user_id);
create policy "weights_update_own" on public.weights
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weights_delete_own" on public.weights
  for delete using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.weights to authenticated;
