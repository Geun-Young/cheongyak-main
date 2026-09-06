# 청약순위계산기 — 프로젝트 진행 기록

> 이 문서는 이 프로젝트에서 무엇을, 왜, 어떤 순서로 했는지 기록한다.
> 코드 구조 자체(어떤 파일에 뭐가 있는지)는 [README.md](README.md)를 본다.
> 이 파일은 세션마다 새로 만드는 게 아니라, **작업할 때마다 이어서 갱신**한다.

---

## 지금 상태 요약 (한눈에)

- **UI**: 목업 단계를 지나 Supabase 기반 실서비스 배관이 연결됨.
- **인증**: 아직 없음. `/admin/*`는 로그인 게이트 없이 열려 있음(TODO로 표시해둠).
- **데이터**: 마이홈포털 공공데이터 API에서 가져온 **실제 공고 129건, 유닛 400건**이 DB에 있음. 전부 자격요건이 비어 있어 `draft`/`확인 필요` 상태 — 일반 사용자 화면(RLS가 `published`만 공개)에는 아직 하나도 안 보임.
- **지도**: 자리(placeholder)만 있고 실제 지도는 아직 안 붙음.
- **다음으로 할 일 후보**: 관리자 조건 검수 UX, 청약홈(민간 APT) 연동, 카카오맵 SDK, 이메일/카카오 인증.

---

## 진행 순서 (실제로 있었던 일)

### 0. 시작 지점
Next.js 16 + React 19 + Tailwind v4로 만든 **UI 껍데기(목업)**. 공고 14건이 `src/lib/mock/announcements.ts`에 하드코딩되어 있고, 프로필/즐겨찾기는 `localStorage`, 판정은 클라이언트에서 즉시 계산. 매칭 엔진(`src/lib/matching.ts`)은 이미 이 시점부터 조건을 선언적 객체(`Condition{field, operator, value}`)로 표현하는 구조라 — 이후 확장이 여기에 기대게 된다.

### 1. 브랜딩 — 로고 · 컬러
- 헤더 로고를 사용자가 준 이미지(`logo3.png`)로 교체. `public/`에 두고 `next/image`로 로드.
- 포인트 컬러를 보라(`#5a3fe0`)에서 베이지·브라운 계열로 전면 교체. 최종적으로 `--color-brand: #543C00`으로 확정.
- 컬러가 Tailwind `@theme` 토큰(`src/app/globals.css`) 하나로 관리되는 구조라, 이 작업은 코드 한 곳만 바꿔서 전체 반영됨.
- **깨달은 것**: 이 저장소가 시작 시점에 git 저장소가 아니었음 → `git init` + GitHub PAT로 최초 push 진행. (PAT는 일회성으로만 사용, 이후 폐기 권장 안내함.)

### 2. 앞으로의 로드맵 정리
공고 데이터를 어떻게 실서비스로 키울지 8단계 로드맵을 세움(README의 "연동 시 바꿀 것" 표를 구체화):
1. 공고→유닛 계층 구조로 스키마 확장
2. PDF→LLM 조건 추출 파이프라인
3. Supabase 구축
4. 인증(이메일+카카오)
5. 매칭 엔진 서버 이전 + 유닛별 추천
6. 실데이터 수집 자동화
7. 알림
8. 소득기준표 실값, ISR, 법률 검토

사용자가 "건물 위치를 지도로 보여주고 싶다"고 요청 → 카카오맵 API를 채택하고 로드맵에 반영(위치 필드는 공고가 아니라 **유닛** 레벨에 둬야 한다고 판단 — 같은 공고 안에도 동/건물이 다를 수 있어서).

### 3. 공고 → 공급유닛(SupplyUnit) 계층 구조로 리팩터링
**왜**: 실제 공고 하나에 여러 평형/타입(예: 36㎡, 46㎡)이 있고 조건이 다를 수 있는데, 기존 스키마는 "공고 하나 = 조건 세트 하나"로 평평했음. 이 상태로는 "이 사람에게 어떤 타입을 추천할지" 개인화가 불가능.

**과정**:
- Plan 서브에이전트에게 상세 구현 계획을 먼저 세우게 함(파일별 변경 범위, 순서, 리스크, 결정 필요 항목 9개를 미리 정리).
- 계획대로 채택: `summary`는 공고+유닛 둘 다 유지, `housingType`/`rankingMethod`는 공고에 대표값+유닛에 실값, `units` 필드명 유지(유닛 합산값), 유닛 id는 `{공고id}-u{n}`, 즐겨찾기는 당분간 공고 단위 유지.
- `types.ts`에 `SupplyUnit`, `AnnouncementMatchSummary` 신설. `Announcement`에서 `eligibility/tiers/scoreRules/moveIn/rentNote`를 제거하고 `supplyUnits: SupplyUnit[]`로 이동.
- `matching.ts`: `matchUnit()`(유닛 단위 판정) 신설, `matchAnnouncement()`는 모든 유닛을 판정한 뒤 대표 결과(`best`)를 고르는 `AnnouncementMatchSummary` 반환으로 변경. 대표 결과 선정 규칙: eligible 우선 → tier 낮은 순 → 가점 높은 순.
- mock 데이터 14건 전부 `supplyUnits` 구조로 마이그레이션. 그중 강동 국민임대(36㎡/46㎡ 2유닛), 부산 명지 국민임대(39/46/51㎡ 3유닛)는 실제로 조건이 다른 다중 유닛 샘플로 만듦.
- UI: `SupplyUnitPicker`(신규, 유닛 탭+판정+일정+위치를 묶음), `UnitLocationCard`(신규, 지도 placeholder), `MatchPanel`은 유닛을 받도록 변경, `AnnouncementRow`는 "N개 타입 중 M개 신청가능" 배지 추가.
- 관리자 조건빌더는 이번 범위에서는 "첫 번째 유닛만 편집"으로 최소 대응 — 다중 유닛 편집 UI는 후속 과제로 명시.

**검증**: `tsc --noEmit`, `eslint`, `next build` 전부 통과. dev 서버로 강동 상세페이지 유닛 탭 전환, 대시보드/관리자의 유닛 배지·합산 세대수를 실제 HTML로 확인.

### 4. Supabase 연동 — 배관 공사
**API 연동**을 "무엇부터 할지" 묻는 질문에 카카오(지도+로그인)와 Supabase 둘 다 필요하다고 답 나옴 → Supabase부터 시작(가입만 하면 바로 키가 나와서 더 빠름).

- Supabase 프로젝트 생성 (Region: Seoul, "Automatically expose new tables" 끔 — RLS 없이 노출되는 사고 방지).
- `@supabase/supabase-js`, `@supabase/ssr` 설치. `.env.local`에 URL/anon key.
- **중요한 발견**: 이 프로젝트가 Next.js 16이라 `middleware.ts`가 deprecated되고 **`proxy.ts`**로 이름이 바뀜(AGENTS.md가 경고한 브레이킹 체인지 중 하나). 공식 Supabase 가이드는 아직 `middleware.ts` 기준이라, 문서(`node_modules/next/dist/docs`)를 직접 확인해서 `src/proxy.ts` + `export function proxy(...)`로 작성.
- 클라이언트 3분리: `lib/supabase/client.ts`(브라우저), `lib/supabase/server.ts`(서버 컴포넌트, `cookies()`가 async라는 점 반영), `lib/supabase/proxy.ts`(세션 갱신, `getUser()`로 매번 검증 — `getSession()`은 위조 가능해서 안 씀).

### 5. Supabase 스키마 구축
- `announcements`(공고 레벨) + `supply_units`(유닛 레벨, `eligibility`/`tiers`/`score_rules`는 **jsonb 컬럼**으로 — 정규화 테이블은 조건빌더 UI가 유닛별 편집을 완전히 지원하기 전까지 범위 밖으로 미룸) 테이블 설계.
- id는 uuid 대신 mock처럼 사람이 읽기 좋은 문자열(slug) 유지하기로 결정.
- RLS: `status='published'`인 공고/유닛만 공개 읽기. `anon`/`authenticated`는 SELECT만, 쓰기는 `service_role`만.
- **적용 과정에서 발생한 이슈**: 테이블 생성 직후 `service_role`로도 `permission denied` 발생 → `public` 스키마에 명시적 GRANT + `notify pgrst, 'reload schema'`(PostgREST 캐시 리로드) 필요했음. 이 GRANT까지 마이그레이션 SQL(`supabase/migrations/0001_announcements.sql`)에 반영해둠.
- DB 직접 연결(DDL 실행)에는 서비스 role 키가 아니라 **DB 비밀번호 + Postgres connection string**이 필요하다는 걸 확인 → 사용자가 비밀번호 제공 → `pg` 패키지를 `--no-save`로 임시 설치해 마이그레이션 실행 후 즉시 제거.
- mock 14건을 `scripts/seed-announcements.ts`로 실제 Supabase에 시딩해서 배관이 도는지 1차 검증(이후 6번 단계에서 진짜 데이터로 교체됨).

**보안 처리 기록**: 이 과정에서 노출된 비밀값(Supabase service_role 키, DB 비밀번호)은 전부 셸 환경변수로만 사용하고 파일에 남기지 않았음. DB 비밀번호는 대화 중 노출되어 **재발급을 권장**해뒀음(사용자가 실제로 재발급했는지는 미확인 — 확인 필요).

### 6. mock 배열 → Supabase 실조회로 전면 교체
"화면이 진짜 Supabase에서 읽어오는가"를 실제로 만드는 단계. 클라이언트 컴포넌트는 "서버 컴포넌트에서 fetch → props로 전달" 전략 채택(SEO, 구조 단순성 이유).

- `lib/data/announcements.ts` 신설: DB 행 ↔ 도메인 타입(`Announcement`) 변환 계층. `getAnnouncements()`/`getAnnouncementById()`(anon, RLS로 published만), `getAnnouncementsForAdmin()`/`getAnnouncementByIdForAdmin()`(service_role, draft/closed 포함 — `/admin/*`에 아직 로그인 게이트가 없어서 **임시 조치**로 명시).
- `lib/supabase/admin.ts` 신설: `service_role` 전용 클라이언트. `server-only` 패키지로 클라이언트 번들에 실수로 섞이는 걸 빌드 타임에 차단.
- `lib/agency.ts` 신설: `AGENCY_STYLE`(기관 로고 색상)을 "mock" 딱지가 붙은 파일에서 분리.
- 랜딩/상세 페이지: 원래 서버 컴포넌트였던 걸 Supabase 호출로 교체.
- `DashboardView`/`AnnouncementsView`: `items: Announcement[]` prop을 받도록 바꾸고, 각 라우트의 `page.tsx`가 서버에서 데이터를 읽어 내려줌.
- `me/page.tsx`: 원래 전체가 클라이언트 컴포넌트였던 걸 `MyPageView`(컴포넌트, `src/components/`)로 옮기고, 새 서버 `page.tsx`가 데이터를 읽어 넘기는 구조로 분리.
- 관리자 편집 페이지(`admin/announcements/new`): `?id=` 쿼리 기반 클라이언트 컴포넌트라 서버 사전 로드가 까다로워서, **API 라우트**(`src/app/api/admin/announcements/[id]/route.ts`)를 신설해 클라이언트에서 fetch하는 방식으로 해결. `RouteContext<'/api/...'>` 타입은 Next.js 빌드 시 자동 생성되므로 `tsc --noEmit` 단독 실행 시엔 에러가 나지만 `next build`에서는 정상 — 이 프로젝트에서 타입체크는 **빌드 이후에** 실행해야 정확함.

**검증**: RLS가 실제로 동작하는지 직접 확인 — 일반 페이지(대시보드 등)는 `closed` 공고 1건을 정확히 숨기고, 관리자 페이지/API는 service_role로 전체를 다 보여줌을 curl로 확인.

### 7. 실제 공공데이터 API 조사 및 연동
사용자가 "마이홈포털/LH/청약홈 API 연동하고 싶다"고 요청.

**조사 과정**:
- WebSearch로 data.go.kr에 등록된 API 3종 확인: 마이홈포털 공공주택 모집공고 조회, 청약홈 분양정보 조회, LH 청약센터 공지사항 조회.
- 상세 필드 스펙은 로그인 후 다운로드하는 문서(엑셀/워드) 안에 있어 WebFetch로는 못 봄 → 사용자가 실제로 활용신청 후 정확한 엔드포인트를 알려줌.
- **청약홈**: Swagger 문서(`infuser.odcloud.kr`)를 통째로 확보, 실제 호출 성공("천안 아이파크 시티 4단지" 등 확인). "분양정보 상세조회"=공고, "주택형별 상세조회"=유닛으로 정확히 우리 스키마와 대응됨을 확인. **연동 코드는 아직 작성 안 함.**
- **LH 공지사항**: 실제 호출 성공("양주옥정" 등 확인). 다만 이건 게시판 글 목록일 뿐 구조화된 조건이 없어 연동 우선순위 낮춤(**미연동**). LH가 공급하는 실제 물건 데이터는 마이홈포털 쪽에 이미 포함되어 있음.
- **마이홈포털**: 엔드포인트(`apis.data.go.kr/1613000/HWSPR02/{rsdtRcritNtcList|ltRsdtRcritNtcList}`)를 사용자가 정확히 확인해줌 → 실제 호출 성공, **가장 먼저 완전 연동**.

**마이홈포털 연동 구현** (`src/lib/ingest/myhome.ts`):
- 필드 매핑표 작성: `pblancId`→공고id, `pblancNm`→title, `suplyInsttNm`→기관, `suplyTyNm`→housingType(근사 매핑: 영구임대/50년임대/통합공공임대는 전부 "국민임대"로, 10/6/5년임대는 "매입임대"로 뭉뚱그림), `brtcNm`→region(전체 시도 매핑표 작성), `beginDe/endDe`→접수기간, `rentGtn/enty/mtRntchrg`→rentNote 조합 문자열.
- **핵심 발견**: 같은 `pblancId`(공고번호) 안에 여러 `houseSn`(단지 일련번호)이 있으면 그게 곧 우리의 SupplyUnit — 스키마가 실제 API 구조와 정확히 맞아떨어짐.
- **버그 발견 및 수정**: 매입임대(다가구주택) 유형은 API가 `houseSn`을 전부 0으로 주고 단지명·주소도 비워서(비식별화된 것으로 추정) 유닛 id가 충돌함 → 그룹 내 순번(index)을 id에 포함시켜 해결.
- 이 API는 자격요건을 안 주므로, 가져온 공고는 전부 `status: "draft"`, `reviewStatus: "pending"`으로 강제 — RLS 덕분에 검수 전에는 사용자에게 노출 안 됨.
- `scripts/ingest-myhome.ts`로 실제 실행: mock 14건 삭제 후 **실제 공고 129건, 유닛 400건**을 Supabase에 upsert. 500건 단위 배치 처리.
- 시드 스크립트 공용 로직(`toAnnouncementRow`/`toUnitRow`)을 `scripts/lib/supabase-rows.ts`로 뽑아 mock 시더와 실데이터 시더가 공유하도록 리팩터링.

**검증**: anon key로 조회 시 0건(전부 draft라 RLS가 숨김 — 의도한 동작), service_role 관리자 목록에서는 129건 전체 노출을 curl로 확인.

---

## 아직 안 한 것 / 다음 단계 후보

- **관리자 조건 검수 UX**: 지금 129건은 전부 자격요건이 비어 있음. 관리자가 하나씩 열어 조건빌더로 채우고 게시해야 실제로 판정이 동작함. 지금 조건빌더는 유닛 1개만 편집 가능 — 다중 유닛(마이홈포털 데이터의 58건이 다중 유닛) 편집 UI가 없어서 이 부분부터 막힐 수 있음.
- **청약홈(민간 APT) 연동**: 스펙 확보·1건 실호출까지 끝났고 어댑터 코드만 남음.
- **PDF→LLM 조건 추출**: 사람이 조건을 일일이 입력하는 대신, 공고문 PDF나 원문 링크에서 자동 추출하는 파이프라인. 아직 손 안 댐.
- **카카오맵 SDK 실연동**: `UnitLocationCard`에 자리만 파놓음. 실제 지도 렌더링, 주소→좌표 지오코딩 없음.
- **인증(이메일/카카오)**: `/admin/*`에 로그인 게이트가 없어 지금은 `service_role`로 우회 중 — 보안상 임시 조치. 카카오 디벨로퍼스 앱 등록도 아직 안 함(지도 키와 로그인 키를 같은 계정에서 함께 받을 수 있음).
- **DB 비밀번호 재발급 확인**: 마이그레이션 과정에서 대화에 노출된 Supabase DB 비밀번호를 재발급했는지 미확인.
- **실데이터 소득기준표**: 여전히 2025년 자리표시 값(`INCOME_100_BY_HOUSEHOLD`).

---

## 알아두면 유용한 것들 (이 프로젝트 고유의 함정)

- **`middleware.ts`가 아니라 `proxy.ts`**. Next.js 16의 브레이킹 체인지. 외부 라이브러리(Supabase 등) 가이드를 그대로 복붙하면 조용히 안 먹힌다.
- **`tsc --noEmit` 단독 실행은 `RouteContext` 타입 에러를 낸다** (Next.js가 빌드 시 자동 생성하는 타입이라서). 이 프로젝트에서 타입 검증은 `next build`까지 해야 정확하다.
- **`cookies()`가 async**다(Next.js 15+). Supabase 서버 클라이언트도 이를 반영해 `await cookies()`로 작성돼 있음.
- **RLS가 `status='published'`만 공개**한다 — 새 데이터를 넣었는데 화면에 안 보이면 버그가 아니라 `status`/`review_status`부터 확인.
- **관리자 페이지는 지금 `service_role`로 우회 중**이라 인증 없이도 `/admin/*`이 열림 — 배포 전 반드시 인증 게이트 필요.
- **마이홈포털 API의 매입임대(다가구주택) 데이터는 개별 유닛 식별자가 없다** — id는 배열 순번으로 임시 구분 중.
- **Windows 환경 팁**: `taskkill //PID <pid> //F`로 종료(POSIX `kill`이 안 먹는 프로세스가 있음), `netstat -ano | grep PORT`로 실제 PID 확인.
