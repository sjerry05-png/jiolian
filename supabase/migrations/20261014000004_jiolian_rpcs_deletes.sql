-- 揪練 JioFit — RPC 第 3 部分：含刪除動作的函式（取消打卡、刪除身體數據）
-- 獨立成一個檔案，因為 Supabase 連接器對含 DELETE 的語法會要求另外確認。

create or replace function public.fit_undo_checkin(p_habit_id uuid, p_day date default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
  v_today date := fit_internal.today();
  v_day date := coalesce(p_day, fit_internal.today());
begin
  if v_day not in (v_today, v_today - 1) then
    raise exception '只能取消今天或昨天的打卡';
  end if;
  delete from public.fit_checkins where habit_id = p_habit_id and user_id = v_uid and day = v_day;
end;
$$;

create or replace function public.fit_delete_metric(p_metric_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := fit_internal.require_uid();
begin
  delete from public.fit_metrics
  where id = p_metric_id and (user_id = v_uid or recorded_by = v_uid);
  if not found then
    raise exception '找不到這筆紀錄或沒有權限刪除';
  end if;
end;
$$;

revoke all on function public.fit_undo_checkin(uuid, date), public.fit_delete_metric(uuid) from public, anon;
grant execute on function public.fit_undo_checkin(uuid, date), public.fit_delete_metric(uuid) to authenticated;
