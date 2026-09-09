-- 관리자 권한.
--
-- 왜 user_profiles에 role 컬럼을 두지 않았나:
-- user_profiles는 사용자가 자기 행을 update할 수 있어야 한다(프로필 저장). 거기에 role을
-- 두면 정책을 아무리 정교하게 짜도 "자기 자신을 관리자로 승격"시킬 여지가 남는다.
-- 별도 테이블로 두고 일반 사용자에게는 어떤 권한도 주지 않으면(select조차) 그 경로가
-- 구조적으로 막힌다. 관리자 추가는 service_role(서버) 또는 SQL 에디터로만 가능하다.
--
-- 관리자 지정 방법(최초 1명):
--   insert into public.admins (user_id, note)
--   select id, '최초 관리자' from auth.users where email = 'you@example.com';

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- 정책을 하나도 만들지 않는다 = anon/authenticated는 select도 못 한다.
-- service_role은 RLS를 우회하므로 서버(proxy·관리자 API)에서만 확인할 수 있다.
-- grant도 주지 않는다.

-- service_role에는 명시적으로 권한을 준다.
-- service_role은 RLS를 우회하지만 테이블 GRANT까지 우회하지는 않는다
-- (권한이 없으면 42501 permission denied). anon/authenticated에는 여전히 아무 권한도 주지 않아,
-- 사용자가 관리자 목록을 읽거나 자기를 추가하는 경로는 그대로 막혀 있다.
grant select, insert, update, delete on public.admins to service_role;
