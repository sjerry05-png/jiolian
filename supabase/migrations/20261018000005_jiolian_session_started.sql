-- 課程總覽加上 has_started：用資料庫時間判斷課程是否已開始，跟報名、結算規則用同一個時鐘。
create or replace view public.fit_session_overview
with (security_invoker = true)
as
select
  s.id,
  s.group_id,
  g.name as group_name,
  g.coach_id,
  s.title,
  s.starts_at,
  s.duration_min,
  s.location_type,
  s.location,
  s.price_ladder,
  s.lock_at,
  s.status,
  s.coach_note,
  s.settled_at,
  cardinality(s.price_ladder) as capacity,
  fit_internal.headcount(s.id) as headcount,
  fit_internal.price_for(s.price_ladder, fit_internal.headcount(s.id)) as price_now,
  case
    when fit_internal.headcount(s.id) < cardinality(s.price_ladder)
      then fit_internal.price_for(s.price_ladder, fit_internal.headcount(s.id) + 1)
  end as price_if_one_more,
  now() >= s.lock_at as is_locked,
  now() >= s.starts_at as has_started
from public.fit_sessions s
join public.fit_groups g on g.id = s.group_id;

revoke all on public.fit_session_overview from anon, authenticated;
grant select on public.fit_session_overview to authenticated;
