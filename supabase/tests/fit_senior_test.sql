-- 揪練中高齡功能測試：本機 Postgres（先跑 local_auth_stub.sql 與全部 migrations）
-- psql -v ON_ERROR_STOP=1 -f fit_senior_test.sql
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
  ('00000000-0000-0000-0000-0000000000a1', 'grandma@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'daughter@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'outsider@test');

\set C '00000000-0000-0000-0000-0000000000c1'
\set A '00000000-0000-0000-0000-0000000000a1'
\set B '00000000-0000-0000-0000-0000000000b1'
\set O '00000000-0000-0000-0000-0000000000e1'
\set NO7 '{f,f,f,f,f,f,f}'
\set YES1 '{f,f,f,f,t,f,f}'

-- ── 準備：教練開團，奶奶與女兒加入，外人不在團裡 ──
select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_setup_profile('王教練', 'coach');
select fit_create_group('林家長青團', '{1500,975,750}') as gid \gset
select invite_code as code from fit_groups where id = :'gid' \gset
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_setup_profile('林奶奶', 'student');
select fit_join_group(:'code');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_setup_profile('林小妹', 'student');
select fit_join_group(:'code');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'O')::text, true);
set local role authenticated;
select fit_setup_profile('路人', 'student');
reset role;

-- ── 長輩模式與基本資料 ──
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_set_large_text(true);
select fit_test.ok((select large_text from fit_profiles where id = :'A'), '奶奶開啟長輩模式');
select fit_test.ok(fit_test.err($$select fit_set_body_info(null, 1800, 'female')$$) like '出生年請填%', '出生年不合理會擋');
select fit_test.ok(fit_test.err($$select fit_set_body_info(null, 1950, 'x')$$) = '性別請選男或女', '性別只能男或女');
select fit_set_body_info(null, 1952, 'female');
select fit_test.ok((select birth_year = 1952 and sex = 'female' from fit_body_info where user_id = :'A'), '奶奶填自己的出生年與性別');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_set_body_info(:'A', 1951, 'female');
select fit_test.ok((select birth_year = 1951 and updated_by = :'C'::uuid from fit_body_info where user_id = :'A'), '教練可以幫學員改基本資料');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_body_info where user_id = :'A') = 0, '家人看不到奶奶的年齡性別');
select fit_test.ok(fit_test.err(format('select fit_set_body_info(%L, 1950, %L)', :'A', 'female')) = '只能幫自己的學員記錄', '家人不能改奶奶的基本資料');
reset role;

-- ── 體能小考 ──
select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_save_assessment(%L, null, null, p_chair_stand => 10)', :'A')) = '請先完成運動前安全檢查', '沒做安全檢查不能存');
select fit_test.ok(fit_test.err(format('select fit_save_assessment(%L, null, %L, p_chair_stand => 10)', :'A', :'YES1')) like '安全檢查有回答「是」%', '安全檢查有「是」、沒醫師同意不能存');
select fit_test.ok(fit_test.err(format('select fit_save_assessment(%L, null, %L)', :'A', :'NO7')) = '請至少填一項測驗結果', '至少要有一項結果');
select fit_test.ok(fit_test.err(format('select fit_save_assessment(%L, null, %L, p_chair_stand => 99)', :'A', :'NO7')) like '%check constraint%', '超出範圍的次數會擋');
select fit_test.ok(fit_test.err(format('select fit_save_assessment(%L, current_date + 3, %L, p_chair_stand => 10)', :'A', :'NO7')) like '日期請選%', '不能填未來日期');
select fit_test.ok(fit_test.err(format('select fit_save_assessment(%L, null, %L, p_chair_stand => 10, p_bp_sys => 130)', :'A', :'NO7')) like '血壓請%', '血壓要兩個都填');
select fit_save_assessment(:'A', (now() at time zone 'Asia/Taipei')::date - 35, :'NO7', p_chair_stand => 9, p_grip => 16.4, p_up_and_go => 7.456, p_bp_sys => 132, p_bp_dia => 84) as as1 \gset
select fit_test.ok((select up_and_go = 7.46 and recorded_by = :'C'::uuid from fit_assessments where id = :'as1'), '教練幫奶奶記錄第一次小考（秒數取兩位）');
select fit_save_assessment(:'A', null, :'YES1', p_doctor_ok => true, p_chair_stand => 12, p_grip => 18) as as2 \gset
select fit_test.ok((select count(*) from fit_assessments where user_id = :'A') = 2, '有醫師同意就能存第二次');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_assessments) = 2, '奶奶看得到自己的小考');
select fit_save_assessment(null, null, :'NO7', p_single_leg => 8) as as3 \gset
select fit_test.ok((select recorded_by = :'A'::uuid from fit_assessments where id = :'as3'), '學員可以自己在家測');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_assessments where user_id = :'A') = 0, '家人看不到奶奶的小考');
select fit_test.ok(fit_test.err(format('select fit_hide_assessment(%L)', :'as3')) = '只能幫自己的學員記錄', '家人不能隱藏奶奶的小考');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'O')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err(format('select fit_save_assessment(%L, null, %L, p_chair_stand => 10)', :'A', :'NO7')) = '只能幫自己的學員記錄', '外人不能幫奶奶記錄');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_hide_assessment(:'as3');
select fit_test.ok((select count(*) from fit_assessments where user_id = :'A') = 2, '教練可以隱藏記錯的小考');
select fit_test.ok(fit_test.err(format('select fit_hide_assessment(%L)', :'as3')) = '找不到這次小考', '已隱藏的不能再隱藏');
reset role;

-- ── 生活目標 ──
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_add_goal(null, '不扶扶手爬到 3 樓', 3) as g1 \gset
select fit_test.ok((select count(*) from fit_goal_ratings where goal_id = :'g1' and score = 3) = 1, '新增目標時記下起始分數');
select fit_add_goal(null, '從地上自己站起來', 2, false) as g2 \gset
select fit_add_goal(null, '提 5 公斤的菜走回家', 4);
select fit_add_goal(null, '陪孫子逛公園 30 分鐘', 5);
select fit_add_goal(null, '自己穿襪子不用坐', 6);
select fit_test.ok(fit_test.err($$select fit_add_goal(null, '第六個', 1)$$) like '生活目標最多 5 個%', '進行中的目標最多 5 個');
select fit_test.ok(fit_test.err($$select fit_add_goal(null, '  ', 1)$$) like '目標請寫%', '目標不能空白');
select fit_test.ok(fit_test.err(format('select fit_rate_goal(%L, 11)', :'g1')) = '分數請選 0～10', '分數 0～10');
select fit_rate_goal(:'g1', 5);
select fit_rate_goal(:'g1', 6);
select fit_test.ok((select count(*) = 1 and max(score) = 6 from fit_goal_ratings where goal_id = :'g1'), '同一天重打只留最後一次');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_goals where user_id = :'A') = 0, '還沒做到的目標家人看不到');
select fit_test.ok(fit_test.err(format('select fit_set_goal_achieved(%L, true)', :'g1')) = '只能幫自己的學員記錄', '家人不能幫奶奶按「做到了」');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_goals where user_id = :'A') = 5, '教練看得到奶奶全部目標');
select fit_rate_goal(:'g1', 8);
select fit_test.ok((select rated_by = :'C'::uuid from fit_goal_ratings where goal_id = :'g1'), '教練可以幫忙打分數');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_set_goal_achieved(:'g1', true);
select fit_set_goal_achieved(:'g2', true);
select fit_test.ok(fit_add_goal(null, '做到一個就能再加一個', 1) is not null, '做到之後可以再加新目標');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_goals where user_id = :'A') = 1, '家人只看得到「做到了、願意分享」的目標');
select fit_test.ok((select title from fit_goals where user_id = :'A') = '不扶扶手爬到 3 樓', '分享的是爬樓梯那個');
select fit_test.ok((select count(*) from fit_goal_ratings where user_id = :'A') = 0, '家人看不到分數');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'O')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_goals) = 0, '外人看不到別人的目標');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_archive_goal(:'g1');
select fit_test.ok(fit_test.err(format('select fit_rate_goal(%L, 9)', :'g1')) = '這個目標已經收起來了', '收起來的目標不能再打分數');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_goals where user_id = :'A') = 0, '收起來後家人就看不到');
reset role;

-- ── 每週身體感受 ──
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
set local role authenticated;
select fit_test.ok(fit_test.err($$select fit_save_wellbeing(11, 3, 3)$$) = '疼痛請選 0～10', '疼痛 0～10');
select fit_test.ok(fit_test.err($$select fit_save_wellbeing(3, 0, 3)$$) = '睡眠和精神請各選一個', '睡眠精神 1～5');
select fit_save_wellbeing(3, 4, 4, '膝蓋');
select fit_save_wellbeing(7, 2, 3, '膝蓋', '爬山後膝蓋腫');
select fit_test.ok((select count(*) = 1 and max(pain) = 7 from fit_wellbeing where user_id = :'A'), '同一週重填會覆蓋');
reset role;
-- 上週疼痛 3 分
insert into fit_wellbeing (user_id, week_start, pain, sleep, energy)
values (:'A', date_trunc('week', (now() at time zone 'Asia/Taipei')::date)::date - 7, 3, 4, 4);

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_wellbeing where user_id = :'A') = 0, '家人看不到奶奶的身體感受');
select fit_save_wellbeing(0, 4, 4, '不該存');
select fit_test.ok((select pain_area is null from fit_wellbeing where user_id = :'B'), '不痛就不記部位');
select fit_test.ok((select count(*) from fit_coach_body_alerts()) = 0, '學員呼叫教練提醒是空的');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'C')::text, true);
set local role authenticated;
select fit_test.ok((select count(*) from fit_wellbeing where user_id = :'A') = 2, '教練看得到奶奶的身體感受');
select fit_test.ok((select pain = 7 and prev_pain = 3 and pain_area = '膝蓋' from fit_coach_body_alerts() where user_id = :'A'), '教練看板提醒：奶奶疼痛從 3 升到 7');
select fit_test.ok((select count(*) from fit_coach_body_alerts() where user_id = :'B') = 0, '女兒沒事不會出現在提醒');
reset role;

-- ── 未登入 ──
set local role anon;
select fit_test.ok(fit_test.err($$select fit_save_wellbeing(1, 3, 3)$$) like 'permission denied%', '未登入不能填');
select fit_test.ok(fit_test.err($$select count(*) from fit_assessments$$) like 'permission denied%', '未登入讀不到小考');
reset role;

rollback;
\echo '✅ 中高齡功能測試全部通過'
