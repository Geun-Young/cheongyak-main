-- PDF -> LLM(Gemini) 자격요건 초안 추출 파이프라인을 위한 컬럼/테이블.
--
-- 설계 메모
-- - AI가 만든 초안은 announcements.eligibility/tiers/score_rules(= supply_units의 해당 컬럼)를
--   절대 직접 덮어쓰지 않는다. 마이그레이션 0002의 "소스 칸/관리자 칸 분리" 원칙과 같은 이유 —
--   검수 없이 잘못된 조건이 실제 판정에 쓰이면 사용자에게 잘못된 정보를 주게 된다.
-- - 초안은 공고 단위로 저장한다. Gemini가 한 번의 추출로 "이 공고 안의 여러 주택형"을
--   통째로 제안하기 때문에(supply_units 개별 행보다) 공고 레벨 JSON 컬럼이 자연스럽다.
--   관리자가 초안을 승인하면, 그 내용을 골라서 supply_units.eligibility/tiers/score_rules에
--   반영하는 건 관리자 UI의 별도 액션(수동 "승인" 버튼)이 담당한다 — 자동 반영 없음.

alter table public.announcements add column if not exists notice_pdf_url text;
alter table public.announcements add column if not exists ai_draft jsonb;
alter table public.announcements add column if not exists ai_draft_status text
  check (ai_draft_status in ('none', 'pending', 'extracted', 'approved', 'failed'));
alter table public.announcements add column if not exists ai_draft_confidence text
  check (ai_draft_confidence in ('high', 'medium', 'low'));
alter table public.announcements add column if not exists ai_draft_notes text;
alter table public.announcements add column if not exists ai_draft_extracted_at timestamptz;
alter table public.announcements add column if not exists ai_draft_error text;

update public.announcements set ai_draft_status = 'none' where ai_draft_status is null;
alter table public.announcements alter column ai_draft_status set default 'none';

create index if not exists announcements_ai_draft_status_idx on public.announcements (ai_draft_status);

-- service_role만 쓰고 읽는 칸이라 기존 RLS 정책(공개 select는 published/closed만) 그대로 충분하다.
-- 다만 이 칸들은 관리자 전용 화면에서만 노출해야 하므로, 일반 사용자 조회 경로(getAnnouncements)는
-- 이 컬럼들을 select에 포함하지 않도록 애플리케이션 레벨에서 주의한다.
