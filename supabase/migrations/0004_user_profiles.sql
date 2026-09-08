-- 회원 프로필 저장. Supabase Auth(auth.users)와 1:1로 붙는다.
--
-- 설계 메모
-- - Profile(src/lib/types.ts)은 필드가 많고 중첩 객체(notifications, commuteFrom/To)도 있는데,
--   아직 계속 진화 중이다(통근 필드도 방금 추가됐다). 컬럼을 하나씩 매핑하면 타입이 바뀔 때마다
--   마이그레이션을 해야 하는데, 이 데이터는 검색·집계 대상이 아니라 "본인이 통째로 읽고 쓰는
--   덩어리"라서 profile jsonb 한 컬럼에 넣는다.
-- - 다만 알림 발송 대상을 서버가 쿼리로 골라야 하므로(예: "마감 알림 켠 사람 전부"),
--   그 판단에 쓰이는 값만 별도 컬럼으로 빼서 인덱스를 걸 수 있게 한다.
-- - RLS로 본인 행만 접근 가능하게 잠근다. service_role(서버 배치)은 RLS를 우회하므로
--   알림 발송 같은 서버 작업은 그대로 가능하다.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- src/lib/types.ts의 Profile을 그대로 직렬화한다
  profile jsonb not null default '{}',
  -- 알림 발송 대상 쿼리용(profile jsonb 안에도 같은 값이 들어있지만, 서버가 인덱스로
  -- 빠르게 고를 수 있도록 중복 저장한다. 쓰기는 항상 애플리케이션이 함께 갱신한다)
  notify_deadline boolean not null default true,
  notify_new_match boolean not null default true,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_notify_deadline_idx
  on public.user_profiles (notify_deadline) where notify_deadline;
create index if not exists user_profiles_notify_new_match_idx
  on public.user_profiles (notify_new_match) where notify_new_match;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- 관심 공고(즐겨찾기). 지금까지 localStorage에 있던 걸 로그인 사용자는 DB로 옮긴다.
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id text not null references public.announcements(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

create index if not exists favorites_user_id_idx on public.favorites (user_id);

alter table public.user_profiles enable row level security;
alter table public.favorites enable row level security;

-- 본인 행만 읽고 쓸 수 있다. auth.uid()는 로그인한 사용자의 id를 돌려준다.
create policy "users read own profile"
  on public.user_profiles for select using (auth.uid() = user_id);
create policy "users insert own profile"
  on public.user_profiles for insert with check (auth.uid() = user_id);
create policy "users update own profile"
  on public.user_profiles for update using (auth.uid() = user_id);

create policy "users read own favorites"
  on public.favorites for select using (auth.uid() = user_id);
create policy "users insert own favorites"
  on public.favorites for insert with check (auth.uid() = user_id);
create policy "users delete own favorites"
  on public.favorites for delete using (auth.uid() = user_id);

grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
