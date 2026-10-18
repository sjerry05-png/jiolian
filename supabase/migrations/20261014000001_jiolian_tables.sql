-- 揪練 JioFit — 資料表、內部輔助函式、資料列權限
-- 與「TCB Bloom Together」共用同一個 Supabase 專案，所有物件一律以 fit_ 開頭，
-- 內部函式放在 fit_internal schema（不對外開放 API，只給權限規則與 RPC 使用）。

create schema if not exists fit_internal;
revoke all on schema fit_internal from public;
grant usage on schema fit_internal to authenticated;

-- ───────────────────────── 內部輔助函式（不碰資料表） ─────────────────────────

-- 台灣時間的「今天」
create or replace function fit_internal.today()
returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Taipei')::date $$;

-- 價目表：第 n 格 = n 人上課時「每人」的價格。必須 1~12 格、每格 1~100000 元、人越多不能越貴。
create or replace function fit_internal.ladder_is_valid(p_ladder integer[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select p_ladder is not null
     and array_ndims(p_ladder) = 1
     and cardinality(p_ladder) between 1 and 12
     and not exists (
       select 1
       from unnest(p_ladder) with ordinality as t(price, i)
       where t.price is null
          or t.price < 1
          or t.price > 100000
          or (t.i > 1 and t.price > p_ladder[t.i - 1])
     )
$$;

-- n 人時每人價格（0 人時顯示 1 人價；超過格數用最後一格）
create or replace function fit_internal.price_for(p_ladder integer[], p_headcount integer)
returns integer
language sql immutable
set search_path = ''
as $$
  select p_ladder[least(greatest(coalesce(p_headcount, 1), 1), cardinality(p_ladder))]
$$;

-- 8 碼邀請碼（去掉容易看錯的 0/O、1/I/L）
create or replace function fit_internal.new_invite_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function fit_internal.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────── 資料表 ─────────────────────────

-- 使用者在揪練裡的身分（合送 App 的使用者不會有這筆資料）
create table public.fit_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  role text not null check (role in ('coach', 'student')),
  phone text check (phone is null or char_length(phone) <= 20),
  bio text check (bio is null or char_length(bio) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 小團（一個家庭、一群朋友）
create table public.fit_groups (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.fit_profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  description text check (description is null or char_length(description) <= 300),
  default_location_type text not null default 'home'
    check (default_location_type in ('home', 'gym', 'outdoor', 'online')),
  default_location text check (default_location is null or char_length(default_location) <= 100),
  default_duration_min integer not null default 60 check (default_duration_min between 15 and 240),
  price_ladder integer[] not null check (fit_internal.ladder_is_valid(price_ladder)),
  lock_hours integer not null default 12 check (lock_hours between 0 and 72),
  invite_code text not null unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fit_groups_coach_idx on public.fit_groups (coach_id);

create table public.fit_group_members (
  group_id uuid not null references public.fit_groups (id) on delete cascade,
  user_id uuid not null references public.fit_profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);
create index fit_group_members_user_idx on public.fit_group_members (user_id);

-- 一堂課。price_ladder 在排課時從小團複製一份，之後改小團價目不會影響已鎖定的課。
create table public.fit_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.fit_groups (id) on delete cascade,
  title text check (title is null or char_length(title) <= 40),
  starts_at timestamptz not null,
  duration_min integer not null check (duration_min between 15 and 240),
  location_type text not null check (location_type in ('home', 'gym', 'outdoor', 'online')),
  location text check (location is null or char_length(location) <= 100),
  price_ladder integer[] not null check (fit_internal.ladder_is_valid(price_ladder)),
  lock_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  coach_note text check (coach_note is null or char_length(coach_note) <= 500),
  settled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fit_sessions_lock_before_start check (lock_at <= starts_at)
);
create index fit_sessions_group_start_idx on public.fit_sessions (group_id, starts_at);

-- 報名。going=要來；declined=不來（鎖定前取消）；late_cancel=鎖定後取消（照算錢）；
-- attended / no_show 由教練點名。guests = 同行家人（沒有帳號的小孩等），由報名者付費。
create table public.fit_bookings (
  session_id uuid not null references public.fit_sessions (id) on delete cascade,
  user_id uuid not null references public.fit_profiles (id) on delete cascade,
  status text not null check (status in ('going', 'declined', 'late_cancel', 'attended', 'no_show')),
  guests integer not null default 0 check (guests between 0 and 5),
  price_per_person integer check (price_per_person is null or price_per_person >= 0),
  amount_due integer check (amount_due is null or amount_due >= 0),
  paid_at timestamptz,
  paid_method text check (paid_method is null or paid_method in ('cash', 'transfer', 'linepay', 'other', 'waived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id),
  constraint fit_bookings_paid_consistent check ((paid_at is null) = (paid_method is null))
);
create index fit_bookings_user_idx on public.fit_bookings (user_id);

-- 每週作業。member_id 為空 = 全團都要做；有值 = 只給這位學員。
create table public.fit_habits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.fit_groups (id) on delete cascade,
  member_id uuid references public.fit_profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 40),
  detail text check (detail is null or char_length(detail) <= 300),
  days_per_week integer not null check (days_per_week between 1 and 7),
  starts_on date not null default fit_internal.today(),
  ends_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fit_habits_dates check (ends_on is null or ends_on >= starts_on)
);
create index fit_habits_group_idx on public.fit_habits (group_id);

-- 打卡。group_id 冗餘存一份，讓權限判斷與統計不用再 join。
create table public.fit_checkins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.fit_habits (id) on delete cascade,
  group_id uuid not null references public.fit_groups (id) on delete cascade,
  user_id uuid not null references public.fit_profiles (id) on delete cascade,
  day date not null,
  feeling smallint check (feeling between 1 and 5),
  note text check (note is null or char_length(note) <= 200),
  coach_reaction text check (coach_reaction is null or coach_reaction in ('👍', '🔥', '💪', '👏')),
  coach_comment text check (coach_comment is null or char_length(coach_comment) <= 200),
  created_at timestamptz not null default now(),
  unique (habit_id, user_id, day)
);
create index fit_checkins_group_day_idx on public.fit_checkins (group_id, day);
create index fit_checkins_user_day_idx on public.fit_checkins (user_id, day);

-- 身體數據（只有本人與他的教練看得到）
create table public.fit_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.fit_profiles (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 1) check (weight_kg between 20 and 300),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 200),
  note text check (note is null or char_length(note) <= 200),
  recorded_by uuid not null references public.fit_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint fit_metrics_has_value check (weight_kg is not null or body_fat_pct is not null or waist_cm is not null)
);
create index fit_metrics_user_idx on public.fit_metrics (user_id, measured_on);

-- 訊息：nudge=教練督促；cheer=加油（家人互相或教練）；chat=一般留言
create table public.fit_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.fit_groups (id) on delete cascade,
  sender_id uuid not null references public.fit_profiles (id) on delete cascade,
  recipient_id uuid not null references public.fit_profiles (id) on delete cascade,
  kind text not null check (kind in ('nudge', 'cheer', 'chat')),
  body text not null check (char_length(btrim(body)) between 1 and 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fit_messages_not_self check (sender_id <> recipient_id)
);
create index fit_messages_recipient_idx on public.fit_messages (recipient_id, created_at desc);
create index fit_messages_sender_idx on public.fit_messages (sender_id, created_at desc);

create trigger fit_profiles_touch before update on public.fit_profiles
  for each row execute function fit_internal.touch_updated_at();
create trigger fit_groups_touch before update on public.fit_groups
  for each row execute function fit_internal.touch_updated_at();
create trigger fit_sessions_touch before update on public.fit_sessions
  for each row execute function fit_internal.touch_updated_at();
create trigger fit_bookings_touch before update on public.fit_bookings
  for each row execute function fit_internal.touch_updated_at();
create trigger fit_habits_touch before update on public.fit_habits
  for each row execute function fit_internal.touch_updated_at();

-- ───────────────────────── 權限判斷（security definer，避免規則互相遞迴） ─────────────────────────

-- 我能看到的小團：我是教練，或我是現任成員
create or replace function fit_internal.my_group_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select g.id from public.fit_groups g where g.coach_id = auth.uid()
  union
  select m.group_id from public.fit_group_members m where m.user_id = auth.uid() and m.left_at is null
$$;

create or replace function fit_internal.is_coach_of(p_group_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.fit_groups g where g.id = p_group_id and g.coach_id = auth.uid())
$$;

create or replace function fit_internal.is_member_of(p_group_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fit_group_members m
    where m.group_id = p_group_id and m.user_id = auth.uid() and m.left_at is null
  )
$$;

-- 我是不是這位學員（任一小團）的教練
create or replace function fit_internal.coaches_user(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fit_group_members m
    join public.fit_groups g on g.id = m.group_id
    where m.user_id = p_user_id and m.left_at is null and g.coach_id = auth.uid()
  )
$$;

-- 我和這個人有沒有共同的小團（含自己）
create or replace function fit_internal.shares_group(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
      or exists (
        select 1
        from public.fit_groups g
        where g.id in (select fit_internal.my_group_ids())
          and (
            g.coach_id = p_user_id
            or exists (
              select 1 from public.fit_group_members m
              where m.group_id = g.id and m.user_id = p_user_id and m.left_at is null
            )
          )
      )
$$;

-- 我看得到的人：自己、我所在小團的教練與成員
create or replace function fit_internal.visible_user_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select auth.uid()
  union
  select g.coach_id from public.fit_groups g where g.id in (select fit_internal.my_group_ids())
  union
  select m.user_id from public.fit_group_members m
  where m.group_id in (select fit_internal.my_group_ids()) and m.left_at is null
$$;

-- 一堂課目前算錢的人數（含同行家人）
create or replace function fit_internal.headcount(p_session_id uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(1 + b.guests), 0)::integer
  from public.fit_bookings b
  where b.session_id = p_session_id
    and b.status in ('going', 'late_cancel', 'attended', 'no_show')
$$;

revoke all on all functions in schema fit_internal from public;
grant execute on function
  fit_internal.today(),
  fit_internal.ladder_is_valid(integer[]),
  fit_internal.price_for(integer[], integer),
  fit_internal.my_group_ids(),
  fit_internal.is_coach_of(uuid),
  fit_internal.is_member_of(uuid),
  fit_internal.coaches_user(uuid),
  fit_internal.shares_group(uuid),
  fit_internal.visible_user_ids(),
  fit_internal.headcount(uuid)
to authenticated;

-- ───────────────────────── 資料列權限：只開放「讀」，寫入一律走 RPC ─────────────────────────

alter table public.fit_profiles enable row level security;
alter table public.fit_groups enable row level security;
alter table public.fit_group_members enable row level security;
alter table public.fit_sessions enable row level security;
alter table public.fit_bookings enable row level security;
alter table public.fit_habits enable row level security;
alter table public.fit_checkins enable row level security;
alter table public.fit_metrics enable row level security;
alter table public.fit_messages enable row level security;

revoke all on
  public.fit_profiles, public.fit_groups, public.fit_group_members, public.fit_sessions,
  public.fit_bookings, public.fit_habits, public.fit_checkins, public.fit_metrics, public.fit_messages
from anon, authenticated;

grant select on
  public.fit_profiles, public.fit_groups, public.fit_group_members, public.fit_sessions,
  public.fit_bookings, public.fit_habits, public.fit_checkins, public.fit_metrics, public.fit_messages
to authenticated;

create policy fit_profiles_read on public.fit_profiles
  for select to authenticated
  using (id in (select fit_internal.visible_user_ids()));

create policy fit_groups_read on public.fit_groups
  for select to authenticated
  using (id in (select fit_internal.my_group_ids()));

create policy fit_group_members_read on public.fit_group_members
  for select to authenticated
  using (group_id in (select fit_internal.my_group_ids()) or user_id = (select auth.uid()));

create policy fit_sessions_read on public.fit_sessions
  for select to authenticated
  using (group_id in (select fit_internal.my_group_ids()));

create policy fit_bookings_read on public.fit_bookings
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or session_id in (
      select s.id from public.fit_sessions s
      where s.group_id in (select fit_internal.my_group_ids())
    )
  );

-- 指定給某位學員的作業，只有他本人與教練看得到
create policy fit_habits_read on public.fit_habits
  for select to authenticated
  using (
    group_id in (select fit_internal.my_group_ids())
    and (member_id is null or member_id = (select auth.uid()) or fit_internal.is_coach_of(group_id))
  );

-- 家人互相看得到「全團作業」的打卡（互相盯）；個人作業的打卡只有本人與教練看得到
create policy fit_checkins_read on public.fit_checkins
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or fit_internal.is_coach_of(group_id)
    or (
      fit_internal.is_member_of(group_id)
      and exists (select 1 from public.fit_habits h where h.id = habit_id and h.member_id is null)
    )
  );

create policy fit_metrics_read on public.fit_metrics
  for select to authenticated
  using (user_id = (select auth.uid()) or fit_internal.coaches_user(user_id));

create policy fit_messages_read on public.fit_messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- ───────────────────────── 課程總覽（含即時人數與價格） ─────────────────────────

create view public.fit_session_overview
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
  now() >= s.lock_at as is_locked
from public.fit_sessions s
join public.fit_groups g on g.id = s.group_id;

revoke all on public.fit_session_overview from anon, authenticated;
grant select on public.fit_session_overview to authenticated;
