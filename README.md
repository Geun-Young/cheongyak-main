# 청약순위계산기

공공주택(국민임대·행복주택·매입임대·청년안심주택 등) 공고를 한곳에 모으고, 사용자가 입력한 조건으로
신청 가능 여부와 예상 순위·가점을 계산해 보여주는 웹서비스의 **UI 껍데기(목업 데이터)** 입니다.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드 확인
npm run lint
```

## 지금 되는 것

- 비회원: 랜딩의 빠른 필터(지역·출생연도·소득구간·혼인·주택) → 공고 목록에 판정 표시. 서버 저장 없음(세션 스토리지).
- 회원(목업): 로그인 버튼 → 체험 계정 「김청약」. 가입 → 6단계 온보딩(항목마다 "어디서 확인하나요?" 안내).
- 대시보드: 신청 가능/조건 미달/확인 필요/마감 임박 집계, 탭·지역·유형·정렬 필터, 마감 임박순 목록.
- 공고 상세: 사람 말 요약, 일정·임대 조건, 자격 요건 체크(내 값 병기), 순위 사다리, 가점 내역, 관심 공고 저장.
- 소득 구간 계산기: 월 건강보험료(직장 3.595%) 또는 세전 월 소득 → 도시근로자 월평균소득 대비 구간. 금액은 저장하지 않음.
- 마이페이지·알림 목록·관리자 공고 목록·공고 등록/편집(조건 빌더 + 체험 계정 즉시 판정 미리보기).

프로필·관심 공고는 브라우저 localStorage에 저장됩니다(`cheongyak.profile.v1`, `cheongyak.favorites.v1`).

## 구조

```
src/
  app/                    라우트 (App Router)
    page.tsx              랜딩 + 빠른 필터
    dashboard/            홈 대시보드
    announcements/        공고 찾기, [id] 상세
    login/ signup/ onboarding/ me/ notifications/
    tools/income/         소득 구간 계산기
    admin/announcements/  관리자 목록, new(등록·편집, ?id= 로 편집)
    privacy/ terms/       초안 문서
  components/             UI 프리미티브(ui.tsx), 헤더/탭바, 목록 행, 판정 패널, 조건 빌더, 온보딩 플로우 …
  lib/
    types.ts              도메인 타입 (Announcement, Condition, Tier, ScoreRule, Profile, MatchResult)
    matching.ts           매칭 엔진: 자격요건 → 순위(tier) → 가점(scoreRules)
    income.ts             소득 기준표(자리표시 값)와 건보료 역산
    profile-data.ts       체험 계정, 빈 프로필, URL 쿼리 → 임시 프로필, 사실(facts) 파생 (서버에서도 import 가능)
    profile.ts            useProfile·useFavorites 훅 (클라이언트 전용, profile-data를 재export)
    fields.ts             조건 빌더·판정 패널이 공유하는 필드 정의
    mock/announcements.ts 목업 공고 14건 (날짜는 오늘 기준 상대값)
    mock/notifications.ts 목업 알림
```

디자인 토큰은 `src/app/globals.css`의 `@theme`에 있습니다(Tailwind v4). 폰트는 Pretendard Variable(로컬 패키지).
랜딩 히어로 배경은 `public/hero-living.webp`(1536×1024, 57KB)이며 `next/image` 정적 import로 넣었습니다.

## 연동 시 바꿀 것

| 영역 | 지금 | 연동 후 |
|---|---|---|
| 공고 데이터 | `lib/mock/announcements.ts` | 공공데이터포털 API(마이홈포털 모집공고, LH 분양임대공고문, 청약홈 분양정보)를 크론으로 수집 → Supabase `announcements` + 관리자 CMS에서 조건 구조화 |
| 조건 구조화 | 관리자가 조건 빌더로 수동 입력 | 공고문 PDF → LLM 추출 → 관리자 검수 (등록 페이지의 「PDF에서 조건 추출」 자리) |
| 인증 | localStorage 목업 | Supabase Auth + 카카오 OAuth. `/admin/*`는 관리자 게이트 뒤로 |
| 프로필 | localStorage | Supabase `user_profiles` + RLS(본인만 조회·수정). 소득은 구간만 저장 |
| 판정 | 클라이언트에서 즉시 계산 | 같은 엔진을 서버에서 돌려 `user_matches` 캐시 → 알림 트리거 |
| 알림 | 목업 목록 | 웹 푸시(마감 3일 전·1일 전, 새 공고) → 카카오 알림톡 확장 |
| 소득 기준표 | `INCOME_100_BY_HOUSEHOLD` 2025년 자리표시 값 | 매년 통계청 발표치로 교체, 공고별 적용연도 반영. **값 검증 필요** |
| 렌더링 | 루트 레이아웃에서 `connection()`으로 전부 요청 시 렌더 | 실제 데이터 후 페이지별 캐시/ISR |

## 주의

- 판정은 참고용입니다. 최종 자격은 공급기관 심사가 우선이라는 고지가 상세·푸터에 들어 있습니다.
- 기관 로고 대신 텍스트 모노그램을 씁니다(상표 사용 회피).
- 개인정보처리방침·이용약관은 초안이며 오픈 전 법률 검토가 필요합니다.
