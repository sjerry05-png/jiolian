-- 揪練註冊閘門：註冊走 Edge Function（jiolian-signup）建立已驗證帳號，不影響同專案其他 App 的 Email 驗證設定。
-- 這裡只負責限流：全站每小時 60 個、同一個 IP 每小時 8 個。
create table if not exists fit_internal.signup_log (
  id bigint generated always as identity primary key,
  ip text,
  created_at timestamptz not null default now()
);
alter table fit_internal.signup_log enable row level security;
create index if not exists signup_log_created_at_idx on fit_internal.signup_log (created_at);
create index if not exists signup_log_ip_idx on fit_internal.signup_log (ip, created_at);

create or replace function public.fit_signup_gate(p_ip text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ip text := nullif(left(trim(coalesce(p_ip, '')), 64), '');
  v_total integer;
  v_from_ip integer;
begin
  select count(*) into v_total from fit_internal.signup_log where created_at > now() - interval '1 hour';
  if v_total >= 60 then
    return false;
  end if;
  if v_ip is not null then
    select count(*) into v_from_ip from fit_internal.signup_log
    where ip = v_ip and created_at > now() - interval '1 hour';
    if v_from_ip >= 8 then
      return false;
    end if;
  end if;
  insert into fit_internal.signup_log (ip) values (v_ip);
  return true;
end;
$$;

revoke all on function public.fit_signup_gate(text) from public, anon, authenticated;
grant execute on function public.fit_signup_gate(text) to service_role;
