-- 유닛별 "기타 조건" 저장.
--
-- 배경: 공고문에는 우리 Field 16개로 표현할 수 없지만 신청 자격을 실제로 좌우하는 조건이
-- 많다(산업단지 재직자, 대학생 계층 자동차 미소유, 수급자 증명 등). 실제로 추출해보니
-- 유닛의 44%에 이런 조건이 있었다. 자동 판정에는 못 쓰지만 사용자가 원문을 확인할 때
-- 놓치면 안 되는 정보라, 버리지 않고 여기에 저장해 화면에 함께 보여준다.
--
-- 구조: [{ label, kind: eligibility|tier|score|other, detail? }]
-- (src/lib/types.ts의 OtherRequirement)

alter table public.supply_units
  add column if not exists other_requirements jsonb not null default '[]';
