-- 단지별 인기도(네이버 블로그·카페 글 수) 캐시.
--
-- 왜 별도 테이블인가: 검색 API는 하루 호출 한도가 있고 응답도 느리다. 화면을 그릴 때마다
-- 부르면 사용자가 기다리고 한도도 금방 소진된다. 배치로 채워 두고 읽기만 한다.
--
-- 왜 supply_units의 컬럼이 아닌가: 수집기가 유닛을 upsert할 때 인기도까지 덮어쓰면
-- 애써 모은 값이 날아간다. 갱신 주기도 다르다(유닛은 공고 수집 때, 인기도는 주 1회면 충분).

create table if not exists public.unit_popularity (
  unit_id text primary key references public.supply_units(id) on delete cascade,

  -- 실제로 검색에 쓴 질의어. 결과가 이상할 때 원인을 추적하려면 이게 있어야 한다.
  query text not null,

  blog_count integer not null default 0,
  cafe_count integer not null default 0,

  -- blog + cafe. 정렬·비교에 쓰기 편하도록 미리 더해 둔다.
  total_count integer not null default 0,

  -- 같은 공고 안의 다른 집들과 비교한 상대값(0~1). 절대 글 수는 지역 규모에 좌우되므로
  -- (서울 단지가 지방 단지보다 무조건 글이 많다) 공고 안에서 정규화해야 의미가 생긴다.
  relative_score real,

  fetched_at timestamptz not null default now(),

  -- 검색이 실패했거나 결과가 0건인 이유를 남긴다. 재시도 판단에 쓴다.
  note text
);

create index if not exists unit_popularity_fetched_at_idx
  on public.unit_popularity (fetched_at);

alter table public.unit_popularity enable row level security;

-- 인기도는 공개 정보다. 공고가 공개된 유닛의 것만 읽을 수 있게 한다
-- (supply_units의 정책과 같은 기준을 따른다).
create policy "popularity of published announcements is publicly readable"
  on public.unit_popularity for select
  using (
    exists (
      select 1
      from public.supply_units u
      join public.announcements a on a.id = u.announcement_id
      where u.id = unit_popularity.unit_id
        and a.status = 'published'
    )
  );

-- 쓰기는 배치 스크립트(service_role)만 한다.
-- service_role은 RLS를 우회하지만 테이블 GRANT는 따로 필요하다(0002·0006에서 겪은 문제).
grant select, insert, update, delete on public.unit_popularity to service_role;

notify pgrst, 'reload schema';
