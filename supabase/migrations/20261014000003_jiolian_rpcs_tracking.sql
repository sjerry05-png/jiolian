-- 揪練 JioFit — RPC 第 2 部分：作業、打卡、身體數據、訊息、追蹤統計、函式權限
-- ───────────────────────── 作業與打卡 ─────────────────────────

create or replace function public.fit_create_habit(
  p_group_id uuid,
  p_title text,
  p_days_per_week integer,
  p_detail text default null,
  p_member_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform fit_internal.require_coach_of(p_group_id);
  if p_member_id is not null and not exists (
    select 1 from public.fit_group_members
    where group_id = p_group_id and user_id = p_member_id and left_at is null
  ) then
    raise exception '這位不是小團成員';
  end if;
  insert into public.fit_habits (group_id, member_id, title, detail, days_per_week)
  values (p_group_id, p_member_id, btrim(p_title), nullif(btrim(p_detail), ''), p_days_per_week)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fit_update_habit(
  p_habit_id uuid,
  p_title text,
  p_days_per_week integer,
  p_detail text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.fit_habits where id = p_habit_id;
  if v_group_id is null then
    raise exception '找不到這項作業';
  end if;
  perform fit_internal.require_coach_of(v_group_id);
  update public.fit_habits
  set title = btrim(p_title), days_per_week = p_days_per_week, detail = nullif(btrim(p_detail), '')
  where id = p_habit_id;
end;
$$;

create or replace function public.fit_archive_habit(p_habit_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.fit_habits where id = p_habit_id;
  if v_group_id is null then
    raise exception '找不到這項作業';
  end if;
  perform fit_internal.require_coach_of(v_group_id);
  update public.fit_habits set archived_at = coalesce(archived_at, now()) where id = p_habit_id;
end;
$$;

-- 打卡：只能打今天或昨天（忘記打可以補一天，不能補更早，避免月底一次補齊）
create or replace function public.fit_checkin(
  p_habit_id uuid,
  p_day date default null,
  p_feeling smallint default null,
  p_note text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_today date := fit_internal.today();
  v_day date := coalesce(p_day, fit_internal.today());
  v_h public.fit_habits;
  v_id uuid;
begin
  if v_day not in (v_today, v_today - 1) then
    raise exception '只能打今天或補昨天的卡';
  end if;
  select * into v_h from public.fit_habits where id = p_habit_id;
  if not found then
    raise exception '找不到這項作業';
  end if;
  if not fit_internal.is_member_of(v_h.group_id) then
    raise exception '你不是這個小團的成員';
  end if;
  if v_h.member_id is not null and v_h.member_id <> v_uid then
    raise exception '這項作業不是給你的';
  end if;
  if v_h.archived_at is not null or v_day < v_h.starts_on or (v_h.ends_on is not null and v_day > v_h.ends_on) then
    raise exception '這項作業目前沒有在進行';
  end if;
  if p_feeling is not null and p_feeling not between 1 and 5 then
    raise exception '心情請選 1～5';
  end if;

  insert into public.fit_checkins as c (habit_id, group_id, user_id, day, feeling, note)
  values (p_habit_id, v_h.group_id, v_uid, v_day, p_feeling, nullif(btrim(p_note), ''))
  on conflict (habit_id, user_id, day) do update
    set feeling = coalesce(excluded.feeling, c.feeling),
        note = coalesce(excluded.note, c.note)
  returning id into v_id;
  return v_id;
end;
$$;


create or replace function public.fit_react_checkin(p_checkin_id uuid, p_reaction text, p_comment text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.fit_checkins where id = p_checkin_id;
  if v_group_id is null then
    raise exception '找不到這筆打卡';
  end if;
  perform fit_internal.require_coach_of(v_group_id);
  if p_reaction is not null and p_reaction not in ('👍', '🔥', '💪', '👏') then
    raise exception '不支援這個表情';
  end if;
  update public.fit_checkins
  set coach_reaction = p_reaction, coach_comment = nullif(btrim(p_comment), '')
  where id = p_checkin_id;
end;
$$;

-- ───────────────────────── 身體數據 ─────────────────────────

create or replace function public.fit_add_metric(
  p_user_id uuid default null,
  p_measured_on date default null,
  p_weight_kg numeric default null,
  p_body_fat_pct numeric default null,
  p_waist_cm numeric default null,
  p_note text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_target uuid := coalesce(p_user_id, fit_internal.require_uid());
  v_day date := coalesce(p_measured_on, fit_internal.today());
  v_id uuid;
begin
  if not exists (select 1 from public.fit_profiles where id = v_uid) then
    raise exception '請先完成個人資料';
  end if;
  if v_target <> v_uid and not fit_internal.coaches_user(v_target) then
    raise exception '只能幫自己的學員記錄';
  end if;
  if v_day > fit_internal.today() or v_day < fit_internal.today() - 365 then
    raise exception '日期請選一年內、不晚於今天';
  end if;
  if p_weight_kg is null and p_body_fat_pct is null and p_waist_cm is null then
    raise exception '請至少填一項數據';
  end if;
  insert into public.fit_metrics (user_id, measured_on, weight_kg, body_fat_pct, waist_cm, note, recorded_by)
  values (v_target, v_day, p_weight_kg, p_body_fat_pct, p_waist_cm, nullif(btrim(p_note), ''), v_uid)
  returning id into v_id;
  return v_id;
end;
$$;


-- ───────────────────────── 訊息 ─────────────────────────

-- 教練 → 學員：督促、加油、留言；學員 → 教練：留言；同團家人之間：加油
create or replace function public.fit_send_message(
  p_recipient_id uuid,
  p_body text,
  p_kind text default 'chat',
  p_group_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_group_id uuid;
  v_id uuid;
begin
  if p_kind is null or p_kind not in ('nudge', 'cheer', 'chat') then
    raise exception '訊息類型不正確';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 300 then
    raise exception '訊息請填 1～300 個字';
  end if;
  if p_recipient_id = v_uid then
    raise exception '不能傳訊息給自己';
  end if;

  -- 我是教練、對方是學員
  select g.id into v_group_id
  from public.fit_groups g
  join public.fit_group_members m on m.group_id = g.id and m.user_id = p_recipient_id and m.left_at is null
  where g.coach_id = v_uid and (p_group_id is null or g.id = p_group_id)
  limit 1;

  if v_group_id is null then
    if p_kind = 'nudge' then
      raise exception '只有教練可以傳督促';
    end if;
    -- 我是學員、對方是教練（留言或加油都可以）
    select g.id into v_group_id
    from public.fit_groups g
    join public.fit_group_members m on m.group_id = g.id and m.user_id = v_uid and m.left_at is null
    where g.coach_id = p_recipient_id and (p_group_id is null or g.id = p_group_id)
    limit 1;
  end if;

  if v_group_id is null then
    if p_kind <> 'cheer' then
      raise exception '同團成員之間只能互相加油';
    end if;
    select me.group_id into v_group_id
    from public.fit_group_members me
    join public.fit_group_members other
      on other.group_id = me.group_id and other.user_id = p_recipient_id and other.left_at is null
    where me.user_id = v_uid and me.left_at is null and (p_group_id is null or me.group_id = p_group_id)
    limit 1;
  end if;

  if v_group_id is null then
    raise exception '你們不在同一個小團';
  end if;

  if (select count(*) from public.fit_messages where sender_id = v_uid and created_at > now() - interval '1 hour') >= 60 then
    raise exception '訊息傳太快了，請稍後再試';
  end if;

  insert into public.fit_messages (group_id, sender_id, recipient_id, kind, body)
  values (v_group_id, v_uid, p_recipient_id, p_kind, btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fit_mark_read(p_sender_id uuid default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_count integer;
begin
  update public.fit_messages
  set read_at = now()
  where recipient_id = v_uid and read_at is null and (p_sender_id is null or sender_id = p_sender_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ───────────────────────── 追蹤統計 ─────────────────────────

-- 小團成員本週進度與紅黃綠燈
--   week_target：本週應打卡次數（每項作業每週幾次的加總）
--   week_done：本週已完成（每項作業最多算到它的每週次數，不能用一項灌另一項）
--   status：none=沒有作業；red=3 天以上沒打卡；yellow=進度落後或 2 天沒打卡；green=正常
create or replace function public.fit_group_progress(p_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  joined_at timestamptz,
  week_target integer,
  week_done integer,
  last_checkin_day date,
  days_since integer,
  streak integer,
  attended_30d integer,
  counted_30d integer,
  unpaid_amount integer,
  status text
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := fit_internal.today();
  v_monday date := date_trunc('week', fit_internal.today())::date;
  v_is_coach boolean;
begin
  if not (fit_internal.is_coach_of(p_group_id) or fit_internal.is_member_of(p_group_id)) then
    raise exception '你不在這個小團';
  end if;
  v_is_coach := fit_internal.is_coach_of(p_group_id);

  return query
  with members as (
    select m.user_id, p.display_name, m.joined_at
    from public.fit_group_members m
    join public.fit_profiles p on p.id = m.user_id
    where m.group_id = p_group_id and m.left_at is null
  ),
  habits as (
    select h.id, h.member_id, h.days_per_week
    from public.fit_habits h
    where h.group_id = p_group_id
      and h.archived_at is null
      and h.starts_on <= v_today
      and (h.ends_on is null or h.ends_on >= v_monday)
  ),
  targets as (
    select mb.user_id, coalesce(sum(h.days_per_week), 0)::integer as week_target
    from members mb
    left join habits h on h.member_id is null or h.member_id = mb.user_id
    group by mb.user_id
  ),
  done_per_habit as (
    select c.user_id, c.habit_id, count(*)::integer as n
    from public.fit_checkins c
    where c.group_id = p_group_id and c.day between v_monday and v_today
    group by c.user_id, c.habit_id
  ),
  done as (
    select d.user_id, sum(least(d.n, h.days_per_week))::integer as week_done
    from done_per_habit d
    join habits h on h.id = d.habit_id
    group by d.user_id
  ),
  last_day as (
    select c.user_id, max(c.day) as last_day
    from public.fit_checkins c
    where c.group_id = p_group_id
    group by c.user_id
  ),
  islands as (
    select x.user_id, max(x.day) as island_end, count(*)::integer as len
    from (
      select distinct c.user_id, c.day,
             c.day - (dense_rank() over (partition by c.user_id order by c.day))::integer as grp
      from public.fit_checkins c
      where c.group_id = p_group_id and c.day <= v_today
    ) x
    group by x.user_id, x.grp
  ),
  streaks as (
    select i.user_id, max(i.len) as streak
    from islands i
    where i.island_end >= v_today - 1
    group by i.user_id
  ),
  attendance as (
    select b.user_id,
           count(*) filter (where b.status = 'attended')::integer as attended,
           count(*) filter (where b.status in ('attended', 'no_show', 'late_cancel'))::integer as counted
    from public.fit_bookings b
    join public.fit_sessions s on s.id = b.session_id
    where s.group_id = p_group_id and s.status = 'completed' and s.starts_at >= now() - interval '30 days'
    group by b.user_id
  ),
  unpaid as (
    select b.user_id, sum(b.amount_due)::integer as amount
    from public.fit_bookings b
    join public.fit_sessions s on s.id = b.session_id
    where s.group_id = p_group_id and b.amount_due > 0 and b.paid_at is null
    group by b.user_id
  )
  select
    mb.user_id,
    mb.display_name,
    mb.joined_at,
    t.week_target,
    coalesce(d.week_done, 0),
    ld.last_day,
    (v_today - coalesce(ld.last_day, (mb.joined_at at time zone 'Asia/Taipei')::date))::integer,
    coalesce(st.streak, 0),
    coalesce(a.attended, 0),
    coalesce(a.counted, 0),
    case when v_is_coach or mb.user_id = auth.uid() then coalesce(u.amount, 0) end,
    case
      when t.week_target = 0 then 'none'
      when (v_today - coalesce(ld.last_day, (mb.joined_at at time zone 'Asia/Taipei')::date)) >= 3 then 'red'
      when (v_today - coalesce(ld.last_day, (mb.joined_at at time zone 'Asia/Taipei')::date)) = 2
        or coalesce(d.week_done, 0) < floor(t.week_target * (v_today - greatest(v_monday, (mb.joined_at at time zone 'Asia/Taipei')::date) + 1) / 7.0) then 'yellow'
      else 'green'
    end
  from members mb
  join targets t on t.user_id = mb.user_id
  left join done d on d.user_id = mb.user_id
  left join last_day ld on ld.user_id = mb.user_id
  left join streaks st on st.user_id = mb.user_id
  left join attendance a on a.user_id = mb.user_id
  left join unpaid u on u.user_id = mb.user_id
  order by
    case
      when t.week_target = 0 then 3
      when (v_today - coalesce(ld.last_day, (mb.joined_at at time zone 'Asia/Taipei')::date)) >= 3 then 0
      when (v_today - coalesce(ld.last_day, (mb.joined_at at time zone 'Asia/Taipei')::date)) = 2
        or coalesce(d.week_done, 0) < floor(t.week_target * (v_today - greatest(v_monday, (mb.joined_at at time zone 'Asia/Taipei')::date) + 1) / 7.0) then 1
      else 2
    end,
    mb.display_name;
end;
$$;

-- 學員今天要做的作業（跨所有小團）
create or replace function public.fit_my_today()
returns table (
  habit_id uuid,
  group_id uuid,
  group_name text,
  title text,
  detail text,
  days_per_week integer,
  is_personal boolean,
  done_today boolean,
  done_yesterday boolean,
  week_done integer,
  today_feeling smallint,
  coach_reaction text,
  coach_comment text
)
language sql stable security definer
set search_path = ''
as $$
  select
    h.id,
    h.group_id,
    g.name,
    h.title,
    h.detail,
    h.days_per_week,
    h.member_id is not null,
    exists (select 1 from public.fit_checkins c where c.habit_id = h.id and c.user_id = auth.uid() and c.day = fit_internal.today()),
    exists (select 1 from public.fit_checkins c where c.habit_id = h.id and c.user_id = auth.uid() and c.day = fit_internal.today() - 1),
    (select count(*)::integer from public.fit_checkins c
      where c.habit_id = h.id and c.user_id = auth.uid()
        and c.day between date_trunc('week', fit_internal.today())::date and fit_internal.today()),
    (select c.feeling from public.fit_checkins c where c.habit_id = h.id and c.user_id = auth.uid() and c.day = fit_internal.today()),
    (select c.coach_reaction from public.fit_checkins c where c.habit_id = h.id and c.user_id = auth.uid()
      and c.coach_reaction is not null order by c.day desc limit 1),
    (select c.coach_comment from public.fit_checkins c where c.habit_id = h.id and c.user_id = auth.uid()
      and c.coach_comment is not null order by c.day desc limit 1)
  from public.fit_habits h
  join public.fit_groups g on g.id = h.group_id
  join public.fit_group_members m on m.group_id = h.group_id and m.user_id = auth.uid() and m.left_at is null
  where h.archived_at is null
    and h.starts_on <= fit_internal.today()
    and (h.ends_on is null or h.ends_on >= fit_internal.today())
    and (h.member_id is null or h.member_id = auth.uid())
  order by g.name, h.created_at
$$;

-- 學員自己的總覽：連續打卡天數、本週進度、未讀訊息、待付金額
create or replace function public.fit_my_summary()
returns json
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_today date := fit_internal.today();
  v_monday date := date_trunc('week', fit_internal.today())::date;
  v_streak integer;
  v_target integer;
  v_done integer;
begin
  select coalesce(max(len), 0) into v_streak
  from (
    select max(x.day) as island_end, count(*)::integer as len
    from (
      select distinct c.day, c.day - (dense_rank() over (order by c.day))::integer as grp
      from public.fit_checkins c
      where c.user_id = v_uid and c.day <= v_today
    ) x
    group by x.grp
  ) i
  where i.island_end >= v_today - 1;

  select coalesce(sum(h.days_per_week), 0)::integer into v_target
  from public.fit_habits h
  join public.fit_group_members m on m.group_id = h.group_id and m.user_id = v_uid and m.left_at is null
  where h.archived_at is null and h.starts_on <= v_today and (h.ends_on is null or h.ends_on >= v_monday)
    and (h.member_id is null or h.member_id = v_uid);

  select coalesce(sum(least(n, dpw)), 0)::integer into v_done
  from (
    select count(*) as n, h.days_per_week as dpw
    from public.fit_checkins c
    join public.fit_habits h on h.id = c.habit_id
    join public.fit_group_members m on m.group_id = h.group_id and m.user_id = v_uid and m.left_at is null
    where c.user_id = v_uid and c.day between v_monday and v_today and h.archived_at is null
    group by h.id, h.days_per_week
  ) t;

  return json_build_object(
    'streak', v_streak,
    'week_target', v_target,
    'week_done', v_done,
    'unread', (select count(*) from public.fit_messages where recipient_id = v_uid and read_at is null),
    'unpaid', (select coalesce(sum(amount_due), 0) from public.fit_bookings where user_id = v_uid and amount_due > 0 and paid_at is null)
  );
end;
$$;

-- 教練收入統計（台灣日期區間）。與「全部改成一對一」相比，每小時多賺多少。
create or replace function public.fit_coach_stats(p_from date, p_to date)
returns json
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_role('coach');
  v_result json;
begin
  with sessions as (
    select s.id, s.duration_min, s.price_ladder, fit_internal.headcount(s.id) as headcount
    from public.fit_sessions s
    join public.fit_groups g on g.id = s.group_id
    where g.coach_id = v_uid
      and s.status = 'completed'
      and (s.starts_at at time zone 'Asia/Taipei')::date between p_from and p_to
  ),
  money as (
    select
      coalesce(sum(b.amount_due) filter (where b.paid_method is distinct from 'waived'), 0) as billed,
      coalesce(sum(b.amount_due) filter (where b.paid_at is not null and b.paid_method <> 'waived'), 0) as collected,
      coalesce(sum(b.amount_due) filter (where b.paid_at is null), 0) as outstanding
    from public.fit_bookings b
    where b.session_id in (select id from sessions)
  )
  select json_build_object(
    'sessions', (select count(*) from sessions),
    'hours', (select coalesce(sum(duration_min), 0) / 60.0 from sessions),
    'people', (select coalesce(sum(headcount), 0) from sessions),
    'avg_headcount', (select round(avg(headcount)::numeric, 1) from sessions),
    'billed', (select billed from money),
    'collected', (select collected from money),
    'outstanding', (select outstanding from money),
    'solo_equivalent', (select coalesce(sum(price_ladder[1]), 0) from sessions)
  ) into v_result;
  return v_result;
end;
$$;

-- ───────────────────────── 函式權限 ─────────────────────────

revoke all on function
  fit_internal.require_uid(),
  fit_internal.require_role(text),
  fit_internal.require_coach_of(uuid),
  fit_internal.apply_settlement(uuid)
from public;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'fit\_%'
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end;
$$;

-- 邀請預覽頁未登入也要能看
grant execute on function public.fit_group_preview(text) to anon;
