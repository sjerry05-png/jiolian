-- 揪練 JioFit — RPC 第 1 部分：個人資料、小團、課程、結算
-- 每個函式都以呼叫者身分（auth.uid()）檢查權限與商業規則，前端只能透過這些函式改資料。

create or replace function fit_internal.require_uid()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '請先登入';
  end if;
  return v_uid;
end;
$$;

create or replace function fit_internal.require_role(p_role text)
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_role text;
begin
  select role into v_role from public.fit_profiles where id = v_uid;
  if v_role is null then
    raise exception '請先完成個人資料';
  end if;
  if v_role <> p_role then
    raise exception '%', case p_role when 'coach' then '只有教練可以這樣做' else '只有學員可以這樣做' end;
  end if;
  return v_uid;
end;
$$;

create or replace function fit_internal.require_coach_of(p_group_id uuid)
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
begin
  if not exists (select 1 from public.fit_groups g where g.id = p_group_id and g.coach_id = v_uid) then
    raise exception '只有這個小團的教練可以這樣做';
  end if;
  return v_uid;
end;
$$;

-- 依目前人數重新計算一堂已結算課程的每人價格與應收金額
create or replace function fit_internal.apply_settlement(p_session_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_ladder integer[];
  v_price integer;
begin
  select price_ladder into v_ladder from public.fit_sessions where id = p_session_id;
  v_price := fit_internal.price_for(v_ladder, fit_internal.headcount(p_session_id));
  update public.fit_bookings b
  set price_per_person = case when b.status in ('attended', 'no_show', 'late_cancel') then v_price end,
      amount_due = case when b.status in ('attended', 'no_show', 'late_cancel') then v_price * (1 + b.guests) end
  where b.session_id = p_session_id;
end;
$$;

-- ───────────────────────── 個人資料 ─────────────────────────

create or replace function public.fit_setup_profile(p_display_name text, p_role text)
returns public.fit_profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_existing public.fit_profiles;
  v_result public.fit_profiles;
begin
  if p_role is null or p_role not in ('coach', 'student') then
    raise exception '身分只能是教練或學員';
  end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 30 then
    raise exception '名字請填 1～30 個字';
  end if;

  select * into v_existing from public.fit_profiles where id = v_uid;
  if found and v_existing.role <> p_role then
    if v_existing.role = 'coach' and exists (select 1 from public.fit_groups where coach_id = v_uid) then
      raise exception '你已經開了小團，不能改成學員身分';
    end if;
    if v_existing.role = 'student'
       and exists (select 1 from public.fit_group_members where user_id = v_uid and left_at is null) then
      raise exception '你已經加入小團，不能改成教練身分';
    end if;
  end if;

  insert into public.fit_profiles (id, display_name, role)
  values (v_uid, btrim(p_display_name), p_role)
  on conflict (id) do update
    set display_name = excluded.display_name, role = excluded.role
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.fit_update_profile(p_display_name text, p_phone text default null, p_bio text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
begin
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 30 then
    raise exception '名字請填 1～30 個字';
  end if;
  update public.fit_profiles
  set display_name = btrim(p_display_name),
      phone = nullif(btrim(p_phone), ''),
      bio = nullif(btrim(p_bio), '')
  where id = v_uid;
  if not found then
    raise exception '請先完成個人資料';
  end if;
end;
$$;

-- ───────────────────────── 小團 ─────────────────────────

create or replace function public.fit_create_group(
  p_name text,
  p_price_ladder integer[],
  p_description text default null,
  p_location_type text default 'home',
  p_location text default null,
  p_lock_hours integer default 12,
  p_duration_min integer default 60
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_role('coach');
  v_id uuid;
  v_code text;
begin
  if not fit_internal.ladder_is_valid(p_price_ladder) then
    raise exception '價目表需要 1～12 格，每格 1～100000 元，而且人越多每人價格不能越高';
  end if;
  if (select count(*) from public.fit_groups where coach_id = v_uid and archived_at is null) >= 50 then
    raise exception '一位教練最多同時開 50 個小團';
  end if;

  loop
    v_code := fit_internal.new_invite_code();
    exit when not exists (select 1 from public.fit_groups where invite_code = v_code);
  end loop;

  insert into public.fit_groups (
    coach_id, name, description, default_location_type, default_location,
    price_ladder, lock_hours, default_duration_min, invite_code
  ) values (
    v_uid, btrim(p_name), nullif(btrim(p_description), ''), coalesce(p_location_type, 'home'),
    nullif(btrim(p_location), ''), p_price_ladder, coalesce(p_lock_hours, 12), coalesce(p_duration_min, 60), v_code
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 改小團設定。價目表變更會套用到「還沒鎖定」的未來課程（已鎖定的維持原價，保障學員）。
create or replace function public.fit_update_group(
  p_group_id uuid,
  p_name text,
  p_price_ladder integer[],
  p_description text default null,
  p_location_type text default 'home',
  p_location text default null,
  p_lock_hours integer default 12,
  p_duration_min integer default 60
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  perform fit_internal.require_coach_of(p_group_id);
  if not fit_internal.ladder_is_valid(p_price_ladder) then
    raise exception '價目表需要 1～12 格，每格 1～100000 元，而且人越多每人價格不能越高';
  end if;

  update public.fit_groups
  set name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      default_location_type = coalesce(p_location_type, 'home'),
      default_location = nullif(btrim(p_location), ''),
      price_ladder = p_price_ladder,
      lock_hours = coalesce(p_lock_hours, 12),
      default_duration_min = coalesce(p_duration_min, 60)
  where id = p_group_id;

  update public.fit_sessions s
  set price_ladder = p_price_ladder
  where s.group_id = p_group_id
    and s.status = 'scheduled'
    and s.lock_at > now()
    and fit_internal.headcount(s.id) <= cardinality(p_price_ladder)
    and s.price_ladder is distinct from p_price_ladder;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.fit_regenerate_invite(p_group_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform fit_internal.require_coach_of(p_group_id);
  loop
    v_code := fit_internal.new_invite_code();
    exit when not exists (select 1 from public.fit_groups where invite_code = v_code);
  end loop;
  update public.fit_groups set invite_code = v_code where id = p_group_id;
  return v_code;
end;
$$;

create or replace function public.fit_set_group_archived(p_group_id uuid, p_archived boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform fit_internal.require_coach_of(p_group_id);
  update public.fit_groups
  set archived_at = case when p_archived then coalesce(archived_at, now()) end
  where id = p_group_id;
end;
$$;

-- 邀請連結預覽（未登入也能看，只回傳公開資訊）
create or replace function public.fit_group_preview(p_code text)
returns table (
  group_id uuid,
  name text,
  description text,
  coach_name text,
  member_count integer,
  price_ladder integer[],
  default_location_type text,
  default_location text,
  is_archived boolean,
  is_member boolean
)
language sql stable security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    g.description,
    c.display_name,
    (select count(*)::integer from public.fit_group_members m where m.group_id = g.id and m.left_at is null),
    g.price_ladder,
    g.default_location_type,
    g.default_location,
    g.archived_at is not null,
    exists (
      select 1 from public.fit_group_members m
      where m.group_id = g.id and m.user_id = auth.uid() and m.left_at is null
    )
  from public.fit_groups g
  join public.fit_profiles c on c.id = g.coach_id
  where g.invite_code = upper(btrim(p_code))
$$;

create or replace function public.fit_join_group(p_code text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_role('student');
  v_group public.fit_groups;
begin
  select * into v_group from public.fit_groups where invite_code = upper(btrim(p_code));
  if not found then
    raise exception '邀請碼不正確，請跟教練要新的連結';
  end if;
  if v_group.archived_at is not null then
    raise exception '這個小團已經停止招生';
  end if;
  if exists (
    select 1 from public.fit_group_members
    where group_id = v_group.id and user_id = v_uid and left_at is null
  ) then
    return v_group.id;
  end if;
  if (select count(*) from public.fit_group_members where group_id = v_group.id and left_at is null) >= 20 then
    raise exception '這個小團已滿 20 人';
  end if;

  insert into public.fit_group_members (group_id, user_id)
  values (v_group.id, v_uid)
  on conflict (group_id, user_id) do update
    set left_at = null, joined_at = now();
  return v_group.id;
end;
$$;

-- 退出小團（學員自己）或移除成員（教練）。
-- 還沒鎖定的報名自動取消；已鎖定的課仍然照算。
create or replace function public.fit_leave_group(p_group_id uuid, p_user_id uuid default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_target uuid := coalesce(p_user_id, v_uid);
begin
  if v_target <> v_uid then
    perform fit_internal.require_coach_of(p_group_id);
  end if;

  update public.fit_group_members
  set left_at = now()
  where group_id = p_group_id and user_id = v_target and left_at is null;
  if not found then
    raise exception '這位不是小團的現任成員';
  end if;

  update public.fit_bookings b
  set status = 'declined', guests = 0
  from public.fit_sessions s
  where s.id = b.session_id
    and s.group_id = p_group_id
    and s.status = 'scheduled'
    and s.lock_at > now()
    and b.user_id = v_target
    and b.status = 'going';
end;
$$;

-- ───────────────────────── 課程 ─────────────────────────

-- 排課，可一次排每週同一時間共 N 週
create or replace function public.fit_create_sessions(
  p_group_id uuid,
  p_starts_at timestamptz,
  p_duration_min integer default null,
  p_location_type text default null,
  p_location text default null,
  p_title text default null,
  p_repeat_weeks integer default 1,
  p_enroll_all boolean default false
)
returns uuid[]
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group public.fit_groups;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_start timestamptz;
begin
  perform fit_internal.require_coach_of(p_group_id);
  select * into v_group from public.fit_groups where id = p_group_id;
  if v_group.archived_at is not null then
    raise exception '這個小團已封存，不能再排課';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception '上課時間要在現在之後';
  end if;
  if p_repeat_weeks is null or p_repeat_weeks not between 1 and 12 then
    raise exception '重複週數請填 1～12';
  end if;

  for i in 0..(p_repeat_weeks - 1) loop
    v_start := p_starts_at + make_interval(weeks => i);
    insert into public.fit_sessions (
      group_id, title, starts_at, duration_min, location_type, location, price_ladder, lock_at
    ) values (
      p_group_id,
      nullif(btrim(p_title), ''),
      v_start,
      coalesce(p_duration_min, v_group.default_duration_min),
      coalesce(p_location_type, v_group.default_location_type),
      coalesce(nullif(btrim(p_location), ''), v_group.default_location),
      v_group.price_ladder,
      v_start - make_interval(hours => v_group.lock_hours)
    )
    returning id into v_id;
    v_ids := v_ids || v_id;

    if p_enroll_all then
      insert into public.fit_bookings (session_id, user_id, status)
      select v_id, m.user_id, 'going'
      from public.fit_group_members m
      where m.group_id = p_group_id and m.left_at is null
      order by m.joined_at
      limit cardinality(v_group.price_ladder);
    end if;
  end loop;
  return v_ids;
end;
$$;

create or replace function public.fit_update_session(
  p_session_id uuid,
  p_starts_at timestamptz,
  p_duration_min integer,
  p_location_type text,
  p_location text default null,
  p_title text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_s public.fit_sessions;
begin
  select * into v_s from public.fit_sessions where id = p_session_id for update;
  if not found then
    raise exception '找不到這堂課';
  end if;
  perform fit_internal.require_coach_of(v_s.group_id);
  if v_s.status <> 'scheduled' then
    raise exception '這堂課已經結束或取消，不能再修改';
  end if;
  if p_starts_at is distinct from v_s.starts_at and (p_starts_at is null or p_starts_at <= now()) then
    raise exception '上課時間要在現在之後';
  end if;

  update public.fit_sessions
  set starts_at = p_starts_at,
      lock_at = p_starts_at - (v_s.starts_at - v_s.lock_at),
      duration_min = p_duration_min,
      location_type = p_location_type,
      location = nullif(btrim(p_location), ''),
      title = nullif(btrim(p_title), '')
  where id = p_session_id;
end;
$$;

create or replace function public.fit_set_session_note(p_session_id uuid, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.fit_sessions where id = p_session_id;
  if v_group_id is null then
    raise exception '找不到這堂課';
  end if;
  perform fit_internal.require_coach_of(v_group_id);
  update public.fit_sessions set coach_note = nullif(btrim(p_note), '') where id = p_session_id;
end;
$$;

create or replace function public.fit_cancel_session(p_session_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_s public.fit_sessions;
begin
  select * into v_s from public.fit_sessions where id = p_session_id for update;
  if not found then
    raise exception '找不到這堂課';
  end if;
  perform fit_internal.require_coach_of(v_s.group_id);
  if v_s.status <> 'scheduled' then
    raise exception '只有還沒上的課可以取消';
  end if;
  update public.fit_sessions set status = 'cancelled', cancelled_at = now() where id = p_session_id;
end;
$$;

-- 學員報名／取消。
-- 規則：取消期限（lock_at）前取消不算錢；過了期限取消變成 late_cancel，照人頭計費，
-- 這樣別人的價格不會因為有人臨時退出而變貴。過了期限仍可以新報名或加人（大家只會更便宜）。
create or replace function public.fit_rsvp(p_session_id uuid, p_going boolean, p_guests integer default 0)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_s public.fit_sessions;
  v_b public.fit_bookings;
  v_has_booking boolean;
  v_locked boolean;
  v_others integer;
  v_cap integer;
  v_status text;
  v_headcount integer;
begin
  -- 鎖住這堂課，避免兩個人同時報名時超過人數上限
  select * into v_s from public.fit_sessions where id = p_session_id for update;
  if not found then
    raise exception '找不到這堂課';
  end if;
  if not fit_internal.is_member_of(v_s.group_id) then
    raise exception '你不是這個小團的成員';
  end if;
  if v_s.status <> 'scheduled' then
    raise exception '這堂課已經結束或取消了';
  end if;
  if now() >= v_s.starts_at then
    raise exception '課程已經開始，不能再更改報名';
  end if;
  if p_guests is null or p_guests not between 0 and 5 then
    raise exception '同行家人最多 5 位';
  end if;

  v_locked := now() >= v_s.lock_at;
  select * into v_b from public.fit_bookings where session_id = p_session_id and user_id = v_uid;
  v_has_booking := found;

  if p_going then
    v_cap := cardinality(v_s.price_ladder);
    select coalesce(sum(1 + b.guests), 0) into v_others
    from public.fit_bookings b
    where b.session_id = p_session_id
      and b.user_id <> v_uid
      and b.status in ('going', 'late_cancel', 'attended', 'no_show');
    if v_others + 1 + p_guests > v_cap then
      raise exception '這堂課最多 % 人，目前其他人已經 % 人', v_cap, v_others;
    end if;
    if v_locked and v_has_booking and v_b.status in ('going', 'late_cancel') and p_guests < v_b.guests then
      raise exception '已過取消期限，同行人數只能增加不能減少';
    end if;
    insert into public.fit_bookings (session_id, user_id, status, guests)
    values (p_session_id, v_uid, 'going', p_guests)
    on conflict (session_id, user_id) do update set status = 'going', guests = excluded.guests;
    v_status := 'going';
  else
    if v_has_booking and v_b.status = 'going' and v_locked then
      update public.fit_bookings set status = 'late_cancel'
      where session_id = p_session_id and user_id = v_uid;
      v_status := 'late_cancel';
    elsif v_has_booking and v_b.status = 'late_cancel' then
      v_status := 'late_cancel';
    else
      insert into public.fit_bookings (session_id, user_id, status, guests)
      values (p_session_id, v_uid, 'declined', 0)
      on conflict (session_id, user_id) do update set status = 'declined', guests = 0;
      v_status := 'declined';
    end if;
  end if;

  v_headcount := fit_internal.headcount(p_session_id);
  return json_build_object(
    'status', v_status,
    'locked', v_locked,
    'headcount', v_headcount,
    'price_per_person', fit_internal.price_for(v_s.price_ladder, v_headcount)
  );
end;
$$;

-- 教練點名／代為報名。已結算的課改點名會自動重算金額（但已有收款紀錄就不能改）。
create or replace function public.fit_coach_set_attendance(
  p_session_id uuid,
  p_user_id uuid,
  p_status text,
  p_guests integer default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_s public.fit_sessions;
  v_guests integer;
  v_others integer;
begin
  select * into v_s from public.fit_sessions where id = p_session_id for update;
  if not found then
    raise exception '找不到這堂課';
  end if;
  perform fit_internal.require_coach_of(v_s.group_id);
  if v_s.status = 'cancelled' then
    raise exception '這堂課已取消';
  end if;
  if p_status is null or p_status not in ('going', 'declined', 'late_cancel', 'attended', 'no_show') then
    raise exception '出席狀態不正確';
  end if;
  if v_s.status = 'completed' and p_status = 'going' then
    raise exception '已結算的課請選「出席」或「缺席」';
  end if;
  if v_s.status = 'completed'
     and exists (select 1 from public.fit_bookings where session_id = p_session_id and paid_at is not null) then
    raise exception '這堂課已經有收款紀錄，請先把收款改回「未收」再改點名';
  end if;
  if not exists (
       select 1 from public.fit_group_members
       where group_id = v_s.group_id and user_id = p_user_id and left_at is null)
     and not exists (select 1 from public.fit_bookings where session_id = p_session_id and user_id = p_user_id) then
    raise exception '這位不是小團成員';
  end if;

  select coalesce(p_guests, (select guests from public.fit_bookings where session_id = p_session_id and user_id = p_user_id), 0)
  into v_guests;
  if v_guests not between 0 and 5 then
    raise exception '同行家人最多 5 位';
  end if;
  if p_status = 'declined' then
    v_guests := 0;
  else
    select coalesce(sum(1 + b.guests), 0) into v_others
    from public.fit_bookings b
    where b.session_id = p_session_id and b.user_id <> p_user_id
      and b.status in ('going', 'late_cancel', 'attended', 'no_show');
    if v_others + 1 + v_guests > cardinality(v_s.price_ladder) then
      raise exception '超過這堂課的人數上限 % 人', cardinality(v_s.price_ladder);
    end if;
  end if;

  insert into public.fit_bookings (session_id, user_id, status, guests)
  values (p_session_id, p_user_id, p_status, v_guests)
  on conflict (session_id, user_id) do update set status = excluded.status, guests = excluded.guests;

  if v_s.status = 'completed' then
    perform fit_internal.apply_settlement(p_session_id);
  end if;
end;
$$;

-- 下課結算：還標記「要來」的視為出席，依實際人數算出每人價格與應收金額
create or replace function public.fit_settle_session(p_session_id uuid)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_s public.fit_sessions;
  v_headcount integer;
  v_price integer;
  v_total integer;
begin
  select * into v_s from public.fit_sessions where id = p_session_id for update;
  if not found then
    raise exception '找不到這堂課';
  end if;
  perform fit_internal.require_coach_of(v_s.group_id);
  if v_s.status <> 'scheduled' then
    raise exception '這堂課已經結算或取消了';
  end if;
  if now() < v_s.starts_at then
    raise exception '課程開始後才能結算';
  end if;

  update public.fit_bookings set status = 'attended'
  where session_id = p_session_id and status = 'going';

  update public.fit_sessions set status = 'completed', settled_at = now() where id = p_session_id;
  perform fit_internal.apply_settlement(p_session_id);

  v_headcount := fit_internal.headcount(p_session_id);
  v_price := fit_internal.price_for(v_s.price_ladder, v_headcount);
  select coalesce(sum(amount_due), 0)::integer into v_total from public.fit_bookings where session_id = p_session_id;
  return json_build_object('headcount', v_headcount, 'price_per_person', v_price, 'total', v_total);
end;
$$;

-- 記錄收款。p_method 為 null = 改回未收；waived = 免收
create or replace function public.fit_set_payment(p_session_id uuid, p_user_id uuid, p_method text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_s public.fit_sessions;
begin
  select * into v_s from public.fit_sessions where id = p_session_id;
  if not found then
    raise exception '找不到這堂課';
  end if;
  perform fit_internal.require_coach_of(v_s.group_id);
  if v_s.status <> 'completed' then
    raise exception '結算後才能記錄收款';
  end if;
  if p_method is not null and p_method not in ('cash', 'transfer', 'linepay', 'other', 'waived') then
    raise exception '收款方式不正確';
  end if;

  update public.fit_bookings
  set paid_method = p_method,
      paid_at = case when p_method is null then null else now() end
  where session_id = p_session_id and user_id = p_user_id and amount_due is not null;
  if not found then
    raise exception '這位這堂課不用付費';
  end if;
end;
$$;
