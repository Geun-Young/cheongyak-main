-- 공고의 전용면적 표기(예: "39㎡", "26~46㎡").
--
-- 왜 공고 단위인가: 면적은 AI 초안의 유닛 이름(평형 축)에서 나오고, 임대료는
-- supply_units(단지 축)에 있다. 둘은 1:1로 안 엮여서 유닛마다 면적을 특정할 수 없다.
-- 그래서 "이 공고의 면적은 이렇다"까지만 말하고, 계산에 쓸 수 있는지는 따로 표시한다.
--
-- 왜 ai_draft에서 매번 파싱하지 않는가: ai_draft는 관리자 전용(service_role)이라
-- 사용자 화면에서 못 읽는다. 초안을 통째로 공개하면 미검수 내용까지 노출된다.

alter table public.announcements
  add column if not exists area_label text,
  -- 면적이 한 종류로 특정돼 ㎡당 단가를 계산해도 되는지.
  -- 여러 평형이 섞인 공고는 false — 이때 면적으로 나누면 엉뚱한 단가가 나온다.
  add column if not exists area_m2 real;

comment on column public.announcements.area_label is '사용자에게 보여줄 전용면적 표기. 예: "39㎡", "26~46㎡"';
comment on column public.announcements.area_m2 is '계산에 쓸 수 있는 단일 전용면적(㎡). 여러 평형이 섞이면 null';

notify pgrst, 'reload schema';
