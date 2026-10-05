-- 청약홈(분양) 공고의 구조화 정보(project.md 32번).
--
-- 마이홈포털(임대)과 달리 청약홈 API는 규제지역·순위별 접수일·주택형별 특별공급 세대수·분양가를
-- 정리된 필드로 준다. 민영 판정(1순위 요건·예치금·가점제 비율·특별공급)에 그대로 쓰므로 PDF 추출 없이 저장한다.
-- 소스 소유 칸이라 재수집이 덮어쓴다(scripts/lib/ingest-upsert.ts). 임대 공고는 null.

alter table public.announcements
  add column if not exists sale jsonb;

alter table public.supply_units
  add column if not exists sale jsonb;

comment on column public.announcements.sale is '청약홈 분양 공고: { kind, regulation, schedule, developer, builder }';
comment on column public.supply_units.sale is '청약홈 주택형: { areaM2, general, special, specialBreakdown, priceTop }';

notify pgrst, 'reload schema';
