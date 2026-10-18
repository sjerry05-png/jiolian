-- 揪練商業規則測試：本機 Postgres（含 local_auth_stub.sql）執行。
-- psql -v ON_ERROR_STOP=1 -f fit_rules_test.sql
\set ON_ERROR_STOP 1
\set QUIET 1

create schema if not exists fit_test;
grant usage on schema fit_test to anon, authenticated;

create or replace function fit_test.ok(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_label;
  end if;
  raise notice 'ok - %', p_label;
end $$;

-- 執行一段 SQL，回傳錯誤訊息（沒錯誤回傳 null）
create or replace function fit_test.err(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;
grant execute on all functions in schema fit_test to anon, authenticated;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'coach@test'),
  ('00000000-0000-0000-0000-0000000000a1', 'dad@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'mom@test'),
  ('00000000-0000-0000-0000-0000000000d1', 'aunt@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'outsider@test');

\set C '00000000-0000-0000-0000-0000000000c1'
\set A '00000000-0000-0000-0000-0000000000a1'
\set B '00000000-0000-0000-0000-0000000000b1'
\set D '00000000-0000-0000-0000-0000000000d1'
\set O '00000000-0000-0000-0000-0000000000e1'

-- ── 教練建立小團 ──
select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err($$select fit_create_group('x', '{1000}')$$) = '請先完成個人資料', '沒有個人資料不能開團');
select (fit_setup_profile('王教練', 'coach')).role = 'coach' as r \gset
select fit_test.ok(:'r'::boolean, '建立教練身分');
select fit_test.ok(fit_test.err($$select fit_create_group('x', '{500,600}')$$) like '價目表%', '人越多不能越貴');
select fit_test.ok(fit_test.err($$select fit_create_group('x', '{}')$$) like '價目表%', '價目表不能是空的');
select fit_create_group('林家小團', '{1500,975,750,630,555,495}', '每週六早上在家練', 'home', '林家客廳') as gid \gset
select invite_code as code from fit_groups where id = :'gid' \gset
select fit_test.ok(length(:'code') = 8, '產生 8 碼邀請碼');
reset role;

-- ── 學員加入 ──
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_join_group(%L)', :'code')) = '請先完成個人資料', '沒有個人資料不能加入');
select fit_setup_profile('林爸', 'student');
select fit_test.ok(fit_join_group(lower(' ' || :'code' || ' ')) = :'gid'::uuid, '邀請碼不分大小寫、可有空白');
select fit_test.ok((select count(*) from fit_groups) = 1, '成員看得到小團');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_setup_profile('林媽', 'student');
select fit_join_group(:'code');
select fit_test.ok((select count(*) from fit_profiles) = 3, '同團看得到教練與其他成員（3 人）');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'D')::text, true);
set local role authenticated;
select fit_setup_profile('阿姨', 'student');
select fit_join_group(:'code');
reset role;
-- 阿姨 5 天前就加入了，但一直沒打卡
update fit_group_members set joined_at = now() - interval '5 days' where user_id = :'D';

select set_config('request.jwt.claims', json_build_object('sub', :'O')::text, true);
set local role authenticated;
select fit_setup_profile('路人', 'student');
select fit_test.ok((select count(*) from fit_groups) = 0, '外人看不到小團');
select fit_test.ok((select count(*) from fit_profiles) = 1, '外人只看得到自己');
select fit_test.ok((select member_count from fit_group_preview(:'code')) = 3, '外人可以用邀請碼預覽（3 位成員）');
select fit_test.ok(fit_test.err($$select fit_join_group('ZZZZZZZZ')$$) like '邀請碼不正確%', '錯誤邀請碼');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_join_group(%L)', :'code')) = '只有學員可以這樣做', '教練不能加入學員班');
select fit_test.ok(fit_test.err($$select fit_setup_profile('王教練', 'student')$$) like '你已經開了小團%', '開了團的教練不能改當學員');

-- ── 排課（每週一次，連排 2 週） ──
select fit_test.ok(fit_test.err(format('select fit_create_sessions(%L, now() - interval ''1 hour'')', :'gid')) = '上課時間要在現在之後', '不能排過去的課');
select (fit_create_sessions(:'gid', now() + interval '3 days', p_repeat_weeks => 2))[1] as s1 \gset
select id as s2 from fit_sessions where group_id = :'gid' and id <> :'s1' \gset
select fit_test.ok((select lock_at = starts_at - interval '12 hours' and location = '林家客廳' from fit_sessions where id = :'s1'), '取消期限 = 上課前 12 小時，地點帶入預設');
reset role;

-- ── 報名與動態價格 ──
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok((fit_rsvp(:'s1', true, 1) ->> 'price_per_person')::int = 975, '林爸帶 1 位家人 → 2 人，每人 975');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((fit_rsvp(:'s1', true) ->> 'headcount')::int = 3, '林媽報名 → 3 人');
select fit_test.ok((select price_now = 750 and price_if_one_more = 630 and not is_locked from fit_session_overview where id = :'s1'), '總覽顯示每人 750，再 1 人降到 630');
select fit_test.ok((fit_rsvp(:'s1', false) ->> 'status') = 'declined', '期限前取消 → 不算錢');
select fit_test.ok((select headcount from fit_session_overview where id = :'s1') = 2, '取消後回到 2 人');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok((fit_rsvp(:'s1', true, 5) ->> 'headcount')::int = 6, '林爸帶 5 位 → 6 人（額滿）');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_rsvp(%L, true)', :'s1')) like '這堂課最多 6 人%', '額滿不能再報');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_rsvp(:'s1', true, 1);
select fit_test.ok(fit_test.err($$insert into fit_bookings (session_id, user_id, status) values (gen_random_uuid(), auth.uid(), 'going')$$) like 'permission denied%', '不能直接寫資料表，只能走 RPC');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'O')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_rsvp(%L, true)', :'s1')) in ('你不是這個小團的成員', '找不到這堂課'), '外人不能報名');
select fit_test.ok((select count(*) from fit_session_overview) = 0, '外人看不到課程');
reset role;

-- ── 過了取消期限 ──
update fit_sessions set lock_at = now() - interval '1 minute' where id = :'s1';

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((fit_rsvp(:'s1', true) ->> 'headcount')::int = 3, '鎖定後仍可加入（大家更便宜）');
select fit_test.ok((fit_rsvp(:'s1', false) ->> 'status') = 'late_cancel', '鎖定後取消 → late_cancel');
select fit_test.ok((select headcount from fit_session_overview where id = :'s1') = 3, '臨時取消仍算人頭，別人價格不變');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_rsvp(%L, true, 0)', :'s1')) = '已過取消期限，同行人數只能增加不能減少', '鎖定後不能減少同行人數');
select fit_test.ok((fit_rsvp(:'s1', true, 2) ->> 'price_per_person')::int = 630, '鎖定後加人 → 4 人，每人 630');
reset role;

-- ── 結算與收款 ──
select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_settle_session(%L)', :'s1')) = '課程開始後才能結算', '上課前不能結算');
reset role;
update fit_sessions set starts_at = now() - interval '1 hour', lock_at = now() - interval '13 hours' where id = :'s1';

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_settle_session(%L)', :'s1')) = '只有這個小團的教練可以這樣做', '學員不能結算');
select fit_test.ok(fit_test.err(format('select fit_rsvp(%L, false)', :'s1')) = '課程已經開始，不能再更改報名', '開課後不能改報名');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_settle_session(:'s1') as settle \gset
select fit_test.ok((:'settle'::json ->> 'price_per_person')::int = 630 and (:'settle'::json ->> 'total')::int = 2520, '結算：4 人每人 630，共 2520');
select fit_test.ok((select status = 'attended' and amount_due = 1890 from fit_bookings where session_id = :'s1' and user_id = :'A'), '林爸＋2 位家人應付 1890');
select fit_test.ok((select status = 'late_cancel' and amount_due = 630 from fit_bookings where session_id = :'s1' and user_id = :'B'), '林媽臨時取消應付 630');
select fit_set_payment(:'s1', :'A', 'linepay');
select fit_test.ok(fit_test.err(format('select fit_coach_set_attendance(%L, %L, ''declined'')', :'s1', :'B')) like '這堂課已經有收款紀錄%', '有收款紀錄就不能改點名');
select fit_set_payment(:'s1', :'A', null);
select fit_coach_set_attendance(:'s1', :'B', 'declined');
select fit_test.ok((select amount_due from fit_bookings where session_id = :'s1' and user_id = :'A') = 2250, '改成林媽不算 → 3 人每人 750，林爸應付 2250');
select fit_coach_set_attendance(:'s1', :'B', 'late_cancel');
select fit_test.ok((select amount_due from fit_bookings where session_id = :'s1' and user_id = :'A') = 1890, '改回臨時取消 → 重新算回 1890');
select fit_set_payment(:'s1', :'A', 'cash');
select fit_set_payment(:'s1', :'B', 'waived');
select fit_test.ok(fit_test.err(format('select fit_set_payment(%L, %L, ''cash'')', :'s1', :'D')) = '這位這堂課不用付費', '沒報名的人不能記收款');
select fit_coach_stats((now() at time zone 'Asia/Taipei')::date - 1, (now() at time zone 'Asia/Taipei')::date) as stats \gset
select fit_test.ok((:'stats'::json ->> 'billed')::int = 1890 and (:'stats'::json ->> 'collected')::int = 1890
                   and (:'stats'::json ->> 'solo_equivalent')::int = 1500, '收入統計：應收 1890（免收不算）、一對一只有 1500');

-- ── 價目表調整只影響未鎖定的課 ──
select fit_update_group(:'gid', '林家小團', '{1600,1000,800}', null, 'home', '林家客廳', 12, 60) as n_updated \gset
select fit_test.ok(:'n_updated'::int = 1, '改價只套用到 1 堂未鎖定的課');
select fit_test.ok((select price_ladder = '{1500,975,750,630,555,495}' from fit_sessions where id = :'s1'), '已結算的課維持原價');
reset role;

-- ── 作業與打卡 ──
select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_create_habit(:'gid', '深蹲 3 組 x 15 下', 4) as h_squat \gset
select fit_create_habit(:'gid', '飯後走路 20 分鐘', 7, null, :'A') as h_walk \gset
reset role;
select fit_test.ok((select starts_on = (now() at time zone 'Asia/Taipei')::date from fit_habits where id = :'h_squat'), '作業從今天（台灣時間）開始');
-- 假裝作業是上週就開始的，才能測補昨天的卡
update fit_habits set starts_on = starts_on - 7 where group_id = :'gid';

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_my_today()) = 2, '林爸今天有 2 項作業');
select fit_checkin(:'h_squat', p_feeling => 4::smallint, p_note => '腿好痠');
select fit_checkin(:'h_walk');
select fit_checkin(:'h_squat', (now() at time zone 'Asia/Taipei')::date - 1);
select fit_test.ok(fit_test.err(format('select fit_checkin(%L, %L::date)', :'h_squat', ((now() at time zone 'Asia/Taipei')::date - 2)::text)) = '只能打今天或補昨天的卡', '不能補兩天前的卡');
select fit_test.ok((fit_my_summary() ->> 'streak')::int = 2, '林爸連續 2 天');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_habits) = 1, '林媽只看得到全團作業');
select fit_test.ok(fit_test.err(format('select fit_checkin(%L)', :'h_walk')) is not null, '林媽不能打林爸的個人作業');
select fit_checkin(:'h_squat');
select fit_test.ok((select count(*) from fit_checkins where user_id = :'A') = 2, '家人看得到彼此全團作業的打卡（看不到個人作業）');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'O')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_checkins) = 0, '外人看不到打卡');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_checkins) = 4, '教練看得到全部打卡');
select fit_react_checkin((select id from fit_checkins where user_id = :'A' and habit_id = :'h_squat' order by day desc limit 1), '🔥', '很棒！');
select fit_test.ok((select status from fit_group_progress(:'gid') where user_id = :'D') = 'red', '阿姨 5 天沒打卡 → 紅燈');
select fit_test.ok((select status from fit_group_progress(:'gid') where user_id = :'A') = 'green', '林爸進度正常 → 綠燈');
select fit_test.ok((select streak = 2 and week_target = 11 from fit_group_progress(:'gid') where user_id = :'A'), '林爸連續 2 天、本週目標 11 次');
select fit_test.ok((select attended_30d = 1 and counted_30d = 1 from fit_group_progress(:'gid') where user_id = :'A'), '林爸近 30 天出席 1/1');
select fit_test.ok((select user_id from fit_group_progress(:'gid') limit 1) = :'D'::uuid, '紅燈排最前面');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok((select coach_reaction from fit_my_today() where habit_id = :'h_squat') = '🔥', '學員看得到教練的回應');
select fit_test.ok((select unpaid_amount from fit_group_progress(:'gid') where user_id = :'B') is null, '學員看不到別人的欠款');
reset role;

-- ── 訊息 ──
select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_send_message(:'D', '阿姨～這週還沒看到妳打卡喔！', 'nudge');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_send_message(%L, ''快去練'', ''nudge'')', :'B')) = '只有教練可以傳督促', '學員不能督促');
select fit_test.ok(fit_test.err(format('select fit_send_message(%L, ''hi'', ''chat'')', :'B')) = '同團成員之間只能互相加油', '家人之間只能加油');
select fit_send_message(:'B', '老婆加油！', 'cheer');
select fit_send_message(:'C', '教練，週六可以改 10 點嗎？', 'chat');
select fit_test.ok((select count(*) from fit_messages) = 2, '林爸看不到教練傳給阿姨的督促');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'O')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_send_message(%L, ''加油'', ''cheer'')', :'A')) = '你們不在同一個小團', '外人不能傳訊息');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'D')::text, true);
set local role authenticated;
select fit_test.ok((fit_my_summary() ->> 'unread')::int = 1, '阿姨有 1 則未讀督促');
select fit_test.ok(fit_mark_read() = 1, '標記已讀');
reset role;

-- ── 身體數據 ──
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_add_metric(p_weight_kg => 82.5, p_waist_cm => 95);
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_add_metric(:'A', p_body_fat_pct => 27.5);
select fit_test.ok((select count(*) from fit_metrics where user_id = :'A') = 2, '教練看得到學員數據，也能幫忙記');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_metrics) = 0, '家人看不到別人的身體數據');
select fit_test.ok(fit_test.err(format('select fit_add_metric(%L, p_weight_kg => 60)', :'A')) = '只能幫自己的學員記錄', '學員不能幫別人記');

-- ── 退出小團 ──
select fit_rsvp(:'s2', true);
select fit_leave_group(:'gid');
select fit_test.ok((select count(*) from fit_groups) = 0, '退出後看不到小團');
reset role;
select fit_test.ok((select status from fit_bookings where session_id = :'s2' and user_id = :'B') = 'declined', '退出後未鎖定的報名自動取消');

-- ── 未登入 ──
set local role anon;
select fit_test.ok((select count(*) from fit_group_preview(:'code')) = 1, '未登入可以預覽邀請');
select fit_test.ok(fit_test.err('select count(*) from fit_groups') like 'permission denied%', '未登入不能讀資料表');
select fit_test.ok(fit_test.err(format('select fit_rsvp(%L, true)', :'s2')) like 'permission denied%', '未登入不能報名');
reset role;

rollback;
\echo '✅ 揪練規則測試全部通過'
