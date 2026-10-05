-- 단지(유닛) 안의 "신청 경로" — 주택형·계층별로 자격이 다를 때(project.md 29번).
--
-- 공고문은 "50㎡ 미만/이상", "일반/주거약자용", "청년/대학생 계층"처럼 경로별로 조건을 주고,
-- 신청자는 그중 하나를 골라 넣는다. 그런데 supply_units는 단지 축(수집 API가 주는 단위)이라
-- 경로와 1:1로 엮이지 않는다. 그래서 단지 하나에 경로 여러 개를 붙이고, 판정은
-- "경로 중 하나라도 되면"으로 한다.
--
-- 각 원소: { name, eligibility: Condition[], tiers: Tier[], scoreRules: ScoreRule[], otherRequirements? }
-- null이면 경로 없이 유닛 자체의 eligibility/tiers/score_rules로 판정한다(기존 방식).

alter table public.supply_units
  add column if not exists variants jsonb;

comment on column public.supply_units.variants is
  '신청 경로(주택형·계층)별 자격. 있으면 유닛의 eligibility 대신 경로마다 판정해 가장 좋은 결과를 쓴다';

notify pgrst, 'reload schema';
