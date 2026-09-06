-- 공고 자동수집을 위한 소스/관리자 소유 칸 분리, 상태 확장, 수집 실행 로그.
-- 배경: 청약순위계산기_공고자동수집_설계서.md
--
-- 핵심 변경
-- 1. status에 'hidden' 추가, review_status에 'recheck' 추가.
-- 2. summary를 "관리자 소유"로 남기고(nullable), 수집기 전용 auto_summary를 새로 둔다.
--    화면은 coalesce(summary, auto_summary)로 표시한다.
-- 3. housing_type도 동일 패턴: 관리자가 고친 값(housing_type)과 소스 원문(housing_type_src)을
--    분리해 재수집이 관리자 교정을 덮어쓰지 못하게 한다.
-- 4. region이 매핑 실패 시 null을 허용하도록 not null 제약을 완화한다("전국"으로 뭉개지 않는다).
-- 5. source/source_id/source_hash/first_seen_at/last_seen_at/source_updated_at로 변경 감지.
-- 6. request_count: "조건 정리되면 알려주세요" 카운터, 관리자 큐 정렬 기준.
-- 7. supply_units.active: 소스에서 사라진 유닛은 삭제 대신 숨김.
-- 8. ingest_runs: 수집 실행 이력(성공/부분실패/실패, 건수 집계).

-- 1) status/review_status/agency_code 제약 재정의
alter table public.announcements drop constraint if exists announcements_status_check;
alter table public.announcements add constraint announcements_status_check
  check (status in ('draft', 'published', 'closed', 'hidden'));

alter table public.announcements drop constraint if exists announcements_agency_code_check;
alter table public.announcements add constraint announcements_agency_code_check
  check (agency_code in ('LH', 'SH', 'GH', 'IH', 'BMC', 'PRIVATE', 'UNKNOWN'));

alter table public.announcements drop constraint if exists announcements_review_status_check;
alter table public.announcements add constraint announcements_review_status_check
  check (review_status in ('ready', 'pending', 'recheck'));

-- 2) summary를 nullable로, auto_summary 신설
alter table public.announcements alter column summary drop not null;
alter table public.announcements alter column summary drop default;
alter table public.announcements add column if not exists auto_summary text[];

-- 3) housing_type 소스 원문 보존
alter table public.announcements add column if not exists housing_type_src text;

-- 4) region 매핑 실패 허용
alter table public.announcements alter column region drop not null;

-- 5) 소스 추적 컬럼
alter table public.announcements add column if not exists source text;
alter table public.announcements add column if not exists source_id text;
alter table public.announcements add column if not exists source_hash text;
alter table public.announcements add column if not exists first_seen_at timestamptz;
alter table public.announcements add column if not exists last_seen_at timestamptz;
alter table public.announcements add column if not exists source_updated_at timestamptz;

-- 6) 관리자 검수 메타 + 요청 카운터
alter table public.announcements add column if not exists admin_note text;
alter table public.announcements add column if not exists reviewed_at timestamptz;
alter table public.announcements add column if not exists reviewed_by text;
alter table public.announcements add column if not exists request_count integer not null default 0;

-- 7) supply_units: active 플래그 + 소스 해시/추적
alter table public.supply_units add column if not exists active boolean not null default true;
alter table public.supply_units add column if not exists source_hash text;
alter table public.supply_units add column if not exists last_seen_at timestamptz;

create index if not exists announcements_source_idx on public.announcements (source, source_id);
create index if not exists announcements_review_status_idx on public.announcements (review_status);
create index if not exists announcements_request_count_idx on public.announcements (request_count desc);
create index if not exists supply_units_active_idx on public.supply_units (active);

-- 8) 수집 실행 로그
create table if not exists public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  fetched integer,
  inserted integer,
  updated integer,
  unchanged integer,
  closed integer,
  deactivated_units integer,
  errors jsonb
);

create index if not exists ingest_runs_source_started_idx on public.ingest_runs (source, started_at desc);

alter table public.ingest_runs enable row level security;
-- 실행 로그는 관리자만 본다(서버가 service_role로 읽는다). anon/authenticated에는 권한을 주지 않는다.

-- RLS 정책 재정의: closed도 published와 함께 공개(마감 탭에서 보여야 하므로).
-- hidden/draft는 계속 숨긴다.
drop policy if exists "published announcements are publicly readable" on public.announcements;
create policy "published or closed announcements are publicly readable"
  on public.announcements for select
  using (status in ('published', 'closed'));

drop policy if exists "supply units of published announcements are publicly readable" on public.supply_units;
create policy "supply units of visible announcements are publicly readable"
  on public.supply_units for select
  using (
    exists (
      select 1 from public.announcements a
      where a.id = supply_units.announcement_id
        and a.status in ('published', 'closed')
    )
  );
