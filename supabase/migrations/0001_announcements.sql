-- 청약순위계산기: 공고(announcements) + 공급유닛(supply_units) 테이블
--
-- 설계 메모
-- - id는 uuid 대신 사람이 읽기 좋은 문자열(slug)을 쓴다. 지금 mock 데이터의
--   id("lh-gangdong-national-2026-2")를 그대로 옮길 수 있고, 관리자 화면/로그에서
--   알아보기 쉽다.
-- - eligibility/tiers/score_rules는 정규화된 테이블 대신 jsonb 컬럼으로 둔다.
--   src/lib/types.ts의 Condition[]/Tier[]/ScoreRule[] 구조를 그대로 직렬화해서 넣으면
--   되므로, 관리자 조건빌더 UI가 유닛별 편집을 완전히 지원하기 전까지 리팩터링
--   범위를 줄여준다. 조건빌더가 성숙하면 후속 마이그레이션에서 정규화를 검토한다.
-- - address/lat/lng는 유닛마다 다를 수 있어 supply_units에 둔다(지도 표시용).

create table if not exists public.announcements (
  id text primary key,
  title text not null,
  agency_code text not null check (agency_code in ('LH', 'SH', 'GH', 'IH', 'BMC', 'PRIVATE')),
  agency_name text not null,
  housing_type text not null,
  region text not null,
  district text not null,
  units integer not null default 0,
  summary text[] not null default '{}',
  announced_at date not null,
  apply_start date not null,
  apply_end date not null,
  original_url text not null,
  original_url_kind text check (original_url_kind in ('notice', 'list', 'home')),
  ranking_method text not null check (ranking_method in ('순위+가점', '가점제', '추첨제', '저축액순')),
  review_status text not null default 'pending' check (review_status in ('ready', 'pending')),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supply_units (
  id text primary key,
  announcement_id text not null references public.announcements(id) on delete cascade,
  name text not null,
  housing_type text not null,
  ranking_method text not null check (ranking_method in ('순위+가점', '가점제', '추첨제', '저축액순')),
  units_count integer not null default 0,
  address text,
  lat double precision,
  lng double precision,
  rent_note text,
  move_in text,
  summary text[],
  -- Condition[] / Tier[] / ScoreRule[] (src/lib/types.ts)를 그대로 직렬화한다
  eligibility jsonb not null default '[]',
  tiers jsonb not null default '[]',
  score_rules jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supply_units_announcement_id_idx on public.supply_units (announcement_id);
create index if not exists announcements_status_idx on public.announcements (status);
create index if not exists announcements_apply_end_idx on public.announcements (apply_end);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

drop trigger if exists supply_units_set_updated_at on public.supply_units;
create trigger supply_units_set_updated_at
  before update on public.supply_units
  for each row execute function public.set_updated_at();

-- RLS: 누구나 게시된(published) 공고는 읽을 수 있다. 쓰기는 서버(service_role)만 가능하다.
-- 관리자 인증이 붙으면 "role = 'admin'" 조건의 정책을 추가할 예정이다.
alter table public.announcements enable row level security;
alter table public.supply_units enable row level security;

create policy "published announcements are publicly readable"
  on public.announcements for select
  using (status = 'published');

create policy "supply units of published announcements are publicly readable"
  on public.supply_units for select
  using (
    exists (
      select 1 from public.announcements a
      where a.id = supply_units.announcement_id
        and a.status = 'published'
    )
  );

-- anon/authenticated는 select만 가능하다. 실제 행 필터링은 위 RLS 정책이 담당하고,
-- 이 grant는 "그 정책이 허용하는 한도 내에서 읽기 권한이 있다"는 기본 전제를 세팅한다.
-- insert/update/delete는 관리자 기능이 붙기 전까지 service_role(서버)만 가능하다.
grant select on public.announcements to anon, authenticated;
grant select on public.supply_units to anon, authenticated;
