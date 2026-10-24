-- 揪練 JioFit — 中高齡功能
--   1. 長輩模式（大字）：fit_profiles.large_text
--   2. 基本資料（出生年、性別）：算「同齡排名」用，只有本人與教練看得到
--   3. 體能小考：國民體適能（65 歲以上）同款項目＋握力＋開眼單足立，測前要做安全檢查
--   4. 生活目標：自己挑 3～5 件吃力的事，每月 0～10 分重打一次；做到了會出現在家族動態
--   5. 每週身體感受：疼痛 0～10、睡眠與精神 1～5
-- 正式資料庫分 6 段套用（jiolian_senior_1_tables … jiolian_senior_6_hide_assessment），結果與本檔相同。
-- 記錯的小考用「隱藏」（deleted_at）而不是真的刪除：Supabase 連接器對含 DELETE 的語法要另外確認，而且隱藏可以救回。

alter table public.fit_profiles add column if not exists large_text boolean not null default false;

-- ───────────────────────── 資料表 ─────────────────────────

-- 不放在 fit_profiles：家人讀得到 fit_profiles，年齡與性別只給本人和教練看
create table public.fit_body_info (
  user_id uuid primary key references public.fit_profiles (id) on delete cascade,
  birth_year integer check (birth_year between 1900 and 2100),
  sex text check (sex in ('male', 'female')),
  updated_by uuid references public.fit_profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 一次體能小考。每項都可以不測（例如沒有握力計），但至少要有一項。
--   chair_stand   30 秒椅子坐立（次）        arm_curl    30 秒手臂屈舉（次，男 8 磅、女 5 磅）
--   step_2min     2 分鐘原地抬膝（次）       sit_reach   椅子坐姿體前彎（公分，碰不到腳尖為負）
--   back_scratch  抓背（公分，碰不到為負）    up_and_go   2.44 公尺起身繞物（秒，越短越好）
--   grip          握力（公斤，慣用手兩次取最好） single_leg  開眼單足立（秒，最多 120）
-- screen_answers：運動前安全檢查 7 題（參考 PAR-Q），任一題「是」要 doctor_ok 才能存
create table public.fit_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.fit_profiles (id) on delete cascade,
  measured_on date not null,
  chair_stand smallint check (chair_stand between 0 and 60),
  arm_curl smallint check (arm_curl between 0 and 60),
  step_2min smallint check (step_2min between 0 and 250),
  sit_reach numeric(4, 1) check (sit_reach between -50 and 50),
  back_scratch numeric(4, 1) check (back_scratch between -60 and 40),
  up_and_go numeric(4, 2) check (up_and_go between 2 and 60),
  grip numeric(4, 1) check (grip between 1 and 90),
  single_leg numeric(4, 1) check (single_leg between 0 and 120),
  bp_sys smallint check (bp_sys between 60 and 260),
  bp_dia smallint check (bp_dia between 30 and 160),
  hr_rest smallint check (hr_rest between 30 and 200),
  screen_answers boolean[] not null check (cardinality(screen_answers) = 7 and array_position(screen_answers, null) is null),
  doctor_ok boolean not null default false,
  note text check (note is null or char_length(note) <= 300),
  recorded_by uuid references public.fit_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.fit_profiles (id) on delete set null,
  constraint fit_assessments_has_value
    check (num_nonnulls(chair_stand, arm_curl, step_2min, sit_reach, back_scratch, up_and_go, grip, single_leg) > 0),
  constraint fit_assessments_screen_ok check (doctor_ok or not (true = any (screen_answers)))
);
create index fit_assessments_user_idx on public.fit_assessments (user_id, measured_on);

create table public.fit_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.fit_profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 40),
  share_with_group boolean not null default true,
  created_by uuid references public.fit_profiles (id) on delete set null,
  achieved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index fit_goals_user_idx on public.fit_goals (user_id);

-- 生活目標的分數：0 = 做不到、10 = 很輕鬆。同一天重打以最後一次為準。
create table public.fit_goal_ratings (
  goal_id uuid not null references public.fit_goals (id) on delete cascade,
  user_id uuid not null references public.fit_profiles (id) on delete cascade,
  rated_on date not null,
  score smallint not null check (score between 0 and 10),
  rated_by uuid references public.fit_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (goal_id, rated_on)
);
create index fit_goal_ratings_user_idx on public.fit_goal_ratings (user_id, rated_on);

-- 每週身體感受（週一為一週的開始）
create table public.fit_wellbeing (
  user_id uuid not null references public.fit_profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  pain smallint not null check (pain between 0 and 10),
  pain_area text check (pain_area is null or char_length(pain_area) <= 20),
  sleep smallint not null check (sleep between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

-- ───────────────────────── 資料列權限：只開放讀，寫入走 RPC ─────────────────────────

alter table public.fit_body_info enable row level security;
alter table public.fit_assessments enable row level security;
alter table public.fit_goals enable row level security;
alter table public.fit_goal_ratings enable row level security;
alter table public.fit_wellbeing enable row level security;

revoke all on public.fit_body_info, public.fit_assessments, public.fit_goals, public.fit_goal_ratings, public.fit_wellbeing
from anon, authenticated;
grant select on public.fit_body_info, public.fit_assessments, public.fit_goals, public.fit_goal_ratings, public.fit_wellbeing
to authenticated;

create policy fit_body_info_read on public.fit_body_info
  for select to authenticated
  using (user_id = (select auth.uid()) or fit_internal.coaches_user(user_id));

create policy fit_assessments_read on public.fit_assessments
  for select to authenticated
  using (deleted_at is null and (user_id = (select auth.uid()) or fit_internal.coaches_user(user_id)));

-- 家人只看得到「已達成、願意分享」的生活目標（家族動態用），分數只有本人與教練看得到
create policy fit_goals_read on public.fit_goals
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or fit_internal.coaches_user(user_id)
    or (share_with_group and achieved_at is not null and archived_at is null and fit_internal.shares_group(user_id))
  );

create policy fit_goal_ratings_read on public.fit_goal_ratings
  for select to authenticated
  using (user_id = (select auth.uid()) or fit_internal.coaches_user(user_id));

create policy fit_wellbeing_read on public.fit_wellbeing
  for select to authenticated
  using (user_id = (select auth.uid()) or fit_internal.coaches_user(user_id));

-- ───────────────────────── 內部輔助 ─────────────────────────

-- 本人或他的教練才能記錄（體能小考、生活目標、基本資料）
create or replace function fit_internal.require_self_or_coach(p_user_id uuid)
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
begin
  if not exists (select 1 from public.fit_profiles where id = v_uid) then
    raise exception '請先完成個人資料';
  end if;
  if p_user_id is null or not exists (select 1 from public.fit_profiles where id = p_user_id) then
    raise exception '找不到這位學員';
  end if;
  if p_user_id <> v_uid and not fit_internal.coaches_user(p_user_id) then
    raise exception '只能幫自己的學員記錄';
  end if;
  return v_uid;
end;
$$;
revoke all on function fit_internal.require_self_or_coach(uuid) from public;

-- ───────────────────────── RPC ─────────────────────────

create or replace function public.fit_set_large_text(p_on boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
begin
  update public.fit_profiles set large_text = coalesce(p_on, false) where id = v_uid;
  if not found then
    raise exception '請先完成個人資料';
  end if;
end;
$$;

create or replace function public.fit_set_body_info(p_user_id uuid, p_birth_year integer, p_sex text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_uid uuid := fit_internal.require_self_or_coach(coalesce(p_user_id, auth.uid()));
  v_year integer := extract(year from fit_internal.today())::integer;
begin
  if p_birth_year is not null and p_birth_year not between v_year - 110 and v_year - 10 then
    raise exception '出生年請填 % 到 % 之間', v_year - 110, v_year - 10;
  end if;
  if p_sex is not null and p_sex not in ('male', 'female') then
    raise exception '性別請選男或女';
  end if;
  insert into public.fit_body_info (user_id, birth_year, sex, updated_by)
  values (v_target, p_birth_year, p_sex, v_uid)
  on conflict (user_id) do update
    set birth_year = excluded.birth_year, sex = excluded.sex, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create or replace function public.fit_save_assessment(
  p_user_id uuid,
  p_measured_on date,
  p_screen_answers boolean[],
  p_doctor_ok boolean default false,
  p_chair_stand integer default null,
  p_arm_curl integer default null,
  p_step_2min integer default null,
  p_sit_reach numeric default null,
  p_back_scratch numeric default null,
  p_up_and_go numeric default null,
  p_grip numeric default null,
  p_single_leg numeric default null,
  p_bp_sys integer default null,
  p_bp_dia integer default null,
  p_hr_rest integer default null,
  p_note text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_uid uuid := fit_internal.require_self_or_coach(coalesce(p_user_id, auth.uid()));
  v_day date := coalesce(p_measured_on, fit_internal.today());
  v_id uuid;
begin
  if v_day > fit_internal.today() or v_day < fit_internal.today() - 365 then
    raise exception '日期請選一年內、不晚於今天';
  end if;
  if p_screen_answers is null or cardinality(p_screen_answers) <> 7 or array_position(p_screen_answers, null) is not null then
    raise exception '請先完成運動前安全檢查';
  end if;
  if true = any (p_screen_answers) and not coalesce(p_doctor_ok, false) then
    raise exception '安全檢查有回答「是」，要先取得醫師同意才能測';
  end if;
  if num_nonnulls(p_chair_stand, p_arm_curl, p_step_2min, p_sit_reach, p_back_scratch, p_up_and_go, p_grip, p_single_leg) = 0 then
    raise exception '請至少填一項測驗結果';
  end if;
  if (p_bp_sys is null) <> (p_bp_dia is null) then
    raise exception '血壓請收縮壓、舒張壓都填';
  end if;

  insert into public.fit_assessments (
    user_id, measured_on, chair_stand, arm_curl, step_2min, sit_reach, back_scratch, up_and_go, grip, single_leg,
    bp_sys, bp_dia, hr_rest, screen_answers, doctor_ok, note, recorded_by
  )
  values (
    v_target, v_day, p_chair_stand, p_arm_curl, p_step_2min, round(p_sit_reach, 1), round(p_back_scratch, 1),
    round(p_up_and_go, 2), round(p_grip, 1), round(p_single_leg, 1),
    p_bp_sys, p_bp_dia, p_hr_rest, p_screen_answers, coalesce(p_doctor_ok, false), nullif(btrim(p_note), ''), v_uid
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 記錯的小考：隱藏起來（本人或教練）。資料還在，需要時可以用 SQL 把 deleted_at 清掉救回。
create or replace function public.fit_hide_assessment(p_assessment_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_uid uuid;
begin
  select user_id into v_user from public.fit_assessments where id = p_assessment_id and deleted_at is null;
  if v_user is null then
    raise exception '找不到這次小考';
  end if;
  v_uid := fit_internal.require_self_or_coach(v_user);
  update public.fit_assessments set deleted_at = now(), deleted_by = v_uid where id = p_assessment_id;
end;
$$;

create or replace function public.fit_add_goal(p_user_id uuid, p_title text, p_score integer, p_share boolean default true)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_uid uuid := fit_internal.require_self_or_coach(coalesce(p_user_id, auth.uid()));
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 40 then
    raise exception '目標請寫 1～40 個字';
  end if;
  if p_score is null or p_score not between 0 and 10 then
    raise exception '分數請選 0～10';
  end if;
  if (select count(*) from public.fit_goals
      where user_id = v_target and archived_at is null and achieved_at is null) >= 5 then
    raise exception '生活目標最多 5 個，先完成或收起一個';
  end if;
  insert into public.fit_goals (user_id, title, share_with_group, created_by)
  values (v_target, btrim(p_title), coalesce(p_share, true), v_uid)
  returning id into v_id;
  insert into public.fit_goal_ratings (goal_id, user_id, rated_on, score, rated_by)
  values (v_id, v_target, fit_internal.today(), p_score, v_uid);
  return v_id;
end;
$$;

create or replace function public.fit_rate_goal(p_goal_id uuid, p_score integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_goal public.fit_goals;
  v_uid uuid;
begin
  select * into v_goal from public.fit_goals where id = p_goal_id;
  if not found then
    raise exception '找不到這個目標';
  end if;
  v_uid := fit_internal.require_self_or_coach(v_goal.user_id);
  if v_goal.archived_at is not null then
    raise exception '這個目標已經收起來了';
  end if;
  if p_score is null or p_score not between 0 and 10 then
    raise exception '分數請選 0～10';
  end if;
  insert into public.fit_goal_ratings as r (goal_id, user_id, rated_on, score, rated_by)
  values (p_goal_id, v_goal.user_id, fit_internal.today(), p_score, v_uid)
  on conflict (goal_id, rated_on) do update
    set score = excluded.score, rated_by = excluded.rated_by, created_at = now();
end;
$$;

-- 做到了！（家族動態會出現；可以取消）
create or replace function public.fit_set_goal_achieved(p_goal_id uuid, p_achieved boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_goal public.fit_goals;
begin
  select * into v_goal from public.fit_goals where id = p_goal_id;
  if not found then
    raise exception '找不到這個目標';
  end if;
  perform fit_internal.require_self_or_coach(v_goal.user_id);
  if v_goal.archived_at is not null then
    raise exception '這個目標已經收起來了';
  end if;
  update public.fit_goals
  set achieved_at = case when coalesce(p_achieved, false) then coalesce(achieved_at, now()) end
  where id = p_goal_id;
end;
$$;

create or replace function public.fit_update_goal(p_goal_id uuid, p_title text, p_share boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.fit_goals where id = p_goal_id;
  if v_user is null then
    raise exception '找不到這個目標';
  end if;
  perform fit_internal.require_self_or_coach(v_user);
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 40 then
    raise exception '目標請寫 1～40 個字';
  end if;
  update public.fit_goals set title = btrim(p_title), share_with_group = coalesce(p_share, true) where id = p_goal_id;
end;
$$;

create or replace function public.fit_archive_goal(p_goal_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.fit_goals where id = p_goal_id;
  if v_user is null then
    raise exception '找不到這個目標';
  end if;
  perform fit_internal.require_self_or_coach(v_user);
  update public.fit_goals set archived_at = coalesce(archived_at, now()) where id = p_goal_id;
end;
$$;

-- 每週身體感受：只有本人能填，同一週重填會覆蓋
create or replace function public.fit_save_wellbeing(
  p_pain integer,
  p_sleep integer,
  p_energy integer,
  p_pain_area text default null,
  p_note text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
begin
  if not exists (select 1 from public.fit_profiles where id = v_uid) then
    raise exception '請先完成個人資料';
  end if;
  if p_pain is null or p_pain not between 0 and 10 then
    raise exception '疼痛請選 0～10';
  end if;
  if p_sleep is null or p_sleep not between 1 and 5 or p_energy is null or p_energy not between 1 and 5 then
    raise exception '睡眠和精神請各選一個';
  end if;
  insert into public.fit_wellbeing (user_id, week_start, pain, pain_area, sleep, energy, note)
  values (
    v_uid, date_trunc('week', fit_internal.today())::date, p_pain,
    case when p_pain = 0 then null else nullif(btrim(p_pain_area), '') end,
    p_sleep, p_energy, nullif(btrim(p_note), '')
  )
  on conflict (user_id, week_start) do update
    set pain = excluded.pain, pain_area = excluded.pain_area, sleep = excluded.sleep,
        energy = excluded.energy, note = excluded.note, updated_at = now();
end;
$$;

-- 教練看板：這週或上週回報「很痛、痛變多、睡不好、沒精神」的學員
create or replace function public.fit_coach_body_alerts()
returns table (
  user_id uuid,
  display_name text,
  week_start date,
  pain smallint,
  prev_pain smallint,
  pain_area text,
  sleep smallint,
  energy smallint
)
language sql stable security definer
set search_path = ''
as $$
  with my_students as (
    select distinct m.user_id
    from public.fit_group_members m
    join public.fit_groups g on g.id = m.group_id
    where g.coach_id = auth.uid() and m.left_at is null and g.archived_at is null
  ),
  latest as (
    select distinct on (w.user_id) w.*
    from public.fit_wellbeing w
    join my_students s on s.user_id = w.user_id
    where w.week_start >= date_trunc('week', fit_internal.today())::date - 7
    order by w.user_id, w.week_start desc
  ),
  with_prev as (
    select l.*,
      (select w2.pain from public.fit_wellbeing w2
        where w2.user_id = l.user_id and w2.week_start < l.week_start
        order by w2.week_start desc limit 1) as prev_pain
    from latest l
  )
  select x.user_id, p.display_name, x.week_start, x.pain, x.prev_pain, x.pain_area, x.sleep, x.energy
  from with_prev x
  join public.fit_profiles p on p.id = x.user_id
  where x.pain >= 6 or (x.prev_pain is not null and x.pain - x.prev_pain >= 2) or x.sleep <= 2 or x.energy <= 2
  order by x.pain desc, p.display_name
$$;

-- ───────────────────────── 函式權限（逐一列出，不要用迴圈，避免誤開 fit_signup_gate） ─────────────────────────

revoke all on function
  public.fit_set_large_text(boolean),
  public.fit_set_body_info(uuid, integer, text),
  public.fit_save_assessment(uuid, date, boolean[], boolean, integer, integer, integer, numeric, numeric, numeric, numeric, numeric, integer, integer, integer, text),
  public.fit_hide_assessment(uuid),
  public.fit_add_goal(uuid, text, integer, boolean),
  public.fit_rate_goal(uuid, integer),
  public.fit_set_goal_achieved(uuid, boolean),
  public.fit_update_goal(uuid, text, boolean),
  public.fit_archive_goal(uuid),
  public.fit_save_wellbeing(integer, integer, integer, text, text),
  public.fit_coach_body_alerts()
from public, anon;

grant execute on function
  public.fit_set_large_text(boolean),
  public.fit_set_body_info(uuid, integer, text),
  public.fit_save_assessment(uuid, date, boolean[], boolean, integer, integer, integer, numeric, numeric, numeric, numeric, numeric, integer, integer, integer, text),
  public.fit_hide_assessment(uuid),
  public.fit_add_goal(uuid, text, integer, boolean),
  public.fit_rate_goal(uuid, integer),
  public.fit_set_goal_achieved(uuid, boolean),
  public.fit_update_goal(uuid, text, boolean),
  public.fit_archive_goal(uuid),
  public.fit_save_wellbeing(integer, integer, integer, text, text),
  public.fit_coach_body_alerts()
to authenticated;
