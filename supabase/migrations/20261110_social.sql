-- 跃迹 YUEJI — leaderboard + likes + comments
-- Run this once in Supabase SQL Editor on an existing project.

alter table public.profiles
  add column if not exists leaderboard_opt_in boolean not null default true;

create table if not exists public.leaderboard_likes (
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user, week_start),
  check (from_user <> to_user)
);

create table if not exists public.leaderboard_comments (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  author_nickname text not null default '',
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);

create index if not exists idx_lb_likes_to_week on public.leaderboard_likes(to_user, week_start);
create index if not exists idx_lb_comments_to_week on public.leaderboard_comments(to_user, week_start, created_at);

alter table public.leaderboard_likes enable row level security;
alter table public.leaderboard_comments enable row level security;

drop policy if exists "lb_likes_select" on public.leaderboard_likes;
drop policy if exists "lb_likes_insert" on public.leaderboard_likes;
drop policy if exists "lb_likes_delete" on public.leaderboard_likes;
create policy "lb_likes_select" on public.leaderboard_likes
  for select using (auth.role() = 'authenticated');
create policy "lb_likes_insert" on public.leaderboard_likes
  for insert with check (auth.uid() = from_user and from_user <> to_user);
create policy "lb_likes_delete" on public.leaderboard_likes
  for delete using (auth.uid() = from_user);

drop policy if exists "lb_comments_select" on public.leaderboard_comments;
drop policy if exists "lb_comments_insert" on public.leaderboard_comments;
drop policy if exists "lb_comments_delete" on public.leaderboard_comments;
create policy "lb_comments_select" on public.leaderboard_comments
  for select using (auth.role() = 'authenticated');
create policy "lb_comments_insert" on public.leaderboard_comments
  for insert with check (auth.uid() = from_user);
create policy "lb_comments_delete" on public.leaderboard_comments
  for delete using (auth.uid() = from_user);

grant select, insert, delete on public.leaderboard_likes to authenticated;
grant select, insert, delete on public.leaderboard_comments to authenticated;

create or replace function public.get_leaderboard(p_start date, p_end date)
returns table (
  user_id uuid,
  nickname text,
  minutes bigint,
  sessions bigint,
  load bigint,
  calories bigint,
  likes bigint,
  comments bigint,
  liked_by_me boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.nickname,
    coalesce(sum(a.duration), 0)::bigint as minutes,
    count(a.id)::bigint as sessions,
    coalesce(sum(a.duration * coalesce((a.data->>'rpe')::numeric, 7)), 0)::bigint as load,
    coalesce(sum((a.data->>'calories')::numeric), 0)::bigint as calories,
    (select count(*) from public.leaderboard_likes l
      where l.to_user = p.user_id and l.week_start = p_start)::bigint as likes,
    (select count(*) from public.leaderboard_comments c
      where c.to_user = p.user_id and c.week_start = p_start)::bigint as comments,
    exists(select 1 from public.leaderboard_likes l
      where l.to_user = p.user_id and l.week_start = p_start and l.from_user = auth.uid()) as liked_by_me
  from public.profiles p
  left join public.activities a
    on a.user_id = p.user_id
   and a.deleted_at is null
   and a.date between p_start and p_end
  where p.leaderboard_opt_in is true
  group by p.user_id, p.nickname
  having count(a.id) > 0
  order by minutes desc, load desc, p.nickname asc
  limit 50;
$$;

revoke all on function public.get_leaderboard(date, date) from public;
grant execute on function public.get_leaderboard(date, date) to authenticated;
