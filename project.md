# 청약순위계산기 — 프로젝트 진행 기록

> 이 문서는 이 프로젝트에서 무엇을, 왜, 어떤 순서로 했는지 기록한다.
> 코드 구조 자체(어떤 파일에 뭐가 있는지)는 [README.md](README.md)를 본다.
> 이 파일은 세션마다 새로 만드는 게 아니라, **작업할 때마다 이어서 갱신**한다.

---

## 지금 상태 요약 (한눈에)

- **UI**: 목업 단계를 지나 Supabase 기반 실서비스 배관이 연결됨.
- **인증·권한**: 구글·카카오·이메일 로그인(12번) + 관리자 권한 분리(16번) 완료. `/admin/*`은 `admins` 테이블에 등록된 계정만 접근 가능하고, 관리자 지정은 `npm run grant-admin -- 이메일`로만 한다.
- **(구버전 설명)** 구글·카카오·이메일 로그인 구현 완료(12번 단계). 프로필·관심공고가 로그인 사용자는 DB(RLS로 본인 것만), 비로그인은 localStorage에 저장된다. `/me`·`/onboarding`·`/admin/*`은 proxy 단계에서 차단. **단, Supabase 대시보드에서 Google/Kakao provider를 켜야 소셜 버튼이 실제로 동작한다**(아직 안 켬).
- **데이터**: 마이홈포털 공공데이터 API에서 가져온 **실제 공고 129건, 유닛 400건**이 DB에 있고, **전부 `published + pending` 상태로 일반 사용자 화면에 바로 노출됨** (자격요건은 비어 있어 "확인 필요"로 표시).
- **자동수집 스케줄은 지금 비활성 상태다** — 마이홈포털 API가 GitHub Actions의 해외 러너 IP를 403으로 차단해서, 하루 3회 크론이 실제로는 못 돈다. 당분간 `npm run ingest:myhome`을 필요할 때 로컬(한국 IP)에서 직접 실행한다. 자세한 배경은 8-1절.
- **PDF→LLM 조건 추출 초기 구축 완료**(9·14번 단계) — 전체 129건 중 **126건(98%) 추출 완료**(확신도 high 122 / medium 4 / low 0). 유닛 176개에서 자격요건 577개·순위 221개·가점규칙 196개, 그리고 스키마로 표현 못 하는 "기타 조건" 177개를 뽑았다. 남은 3건은 공고 페이지에 PDF 첨부 자체가 없는 케이스. **아직 아무도 검수하지 않아 전부 초안 상태다** — `/admin/ai-drafts`에서 승인해야 실제 판정에 쓰인다.
- **기타 조건(스키마로 표현 못 하는 자격 조건)이 사용자 화면까지 연결됨**(15번) — 관리자가 초안을 승인하면 공고 상세의 "직접 확인이 필요한 조건" 카드로 보인다.
- **"어떤 유닛에 넣을지" 추천 기능을 설계 중**(11번 단계) — 자격 여부뿐 아니라 통근시간·당첨 가능성까지 반영한 추천 점수 + 한줄평. `Profile.commuteFrom`/`commuteTo` 타입만 먼저 추가된 상태, 실제 추천 로직은 인증 붙는 시점에 이어서.
- **지도**: 자리(placeholder)만 있고 실제 지도는 아직 안 붙음.
- **다음으로 할 일 후보**: 배치 추출 완료 확인 후 관리자 검수, 통근 추천 기능 계속 개발, 경쟁률 데이터 조사, 관리자 큐 필터 탭 UI(지금은 집계 숫자만), 청약홈(민간 APT) 연동, 카카오맵 SDK, 이메일/카카오 인증, (여유 생기면) Vercel Pro로 국내 리전 자동화.

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

### 8. 공고 자동수집 재설계 — "관리자가 열어야 보인다"는 병목 제거

사용자가 [청약순위계산기_공고자동수집_설계서.md](청약순위계산기_공고자동수집_설계서.md)를 제공 → 그 설계를 그대로 반영해 6번 단계에서 만든 수집기를 재설계.

**진단(설계서 그대로 채택)**: 문제는 수집이 아니라 정책이었음. 조건 없는 공고도 UI는 이미 "확인 필요"로 그릴 수 있는데, 수집 단계에서 `draft`로 넣어버려 그 상태를 못 쓰고 있었음. → **소스가 주는 사실은 기계가, 해석(조건·요약·순위)은 사람이. 둘은 같은 행의 다른 칸에 산다.**

**결정한 것** (설계서 12장 "결정이 필요한 항목" 5개, 전부 설계서 제안대로 채택):
1. 자동 공개 정책: 전체 자동공개(신뢰 기관 화이트리스트 방식 아님)
2. 마감 후 노출 기간: 30일
3. 유형 세분화: 영구임대·50년임대·통합공공임대를 국민임대로 뭉개지 않고 별도 `HousingType`으로 분리
4. pending 공고 알림: 기본값 꺼짐(옵션으로만)
5. 매입임대 유닛 병합: 면적·보증금·월세·주소 해시로 그룹핑

**작업 전 확인**: 설계서 0번이 "Supabase 작업물이 어디에도 없다(다른 저장소 `chan-hee1102/cheongyak` 참고)"고 전제했으나, 실제로는 이 세션(`Geun-Young/cheongyak-main`)에서 한 작업이 로컬에 그대로 있었고 단지 커밋을 안 한 상태였음 — 확인 후 그 전제는 무시하고 먼저 전체 커밋+push(`b246889`)한 뒤 이어서 진행.

**구현**:
- **타입 확장**(`types.ts`): `HousingType`에 영구임대/50년임대/통합공공임대 추가, `AgencyCode`에 `UNKNOWN` 추가, `Announcement.status`에 `hidden` 추가, `reviewStatus`에 `recheck` 추가, `region`을 `Region | "전국" | null`로(매핑 실패 시 "전국"으로 뭉개지 않음), `summary`를 `string[] | null` + `autoSummary?: string[]`로 분리(관리자 요약 vs 수집기 자동요약), `source`/`sourceId`/`requestCount` 추가, `SupplyUnit.active` 추가.
- **마이그레이션 0002**(`supabase/migrations/0002_ingest_ownership.sql`): status/review_status/agency_code CHECK 제약 확장, summary nullable화 + auto_summary 컬럼, housing_type_src(소스 원문 보존), region nullable화, source/source_id/source_hash/first_seen_at/last_seen_at/source_updated_at, admin_note/reviewed_at/reviewed_by, request_count, supply_units.active + source_hash, `ingest_runs` 테이블 신설. RLS를 `published`에서 `published, closed` 공개로 확장. 실행 후 GRANT + `notify pgrst,'reload schema'` 필요했음(0001 때와 동일 패턴).
- **수집기 전면 재작성**(`lib/ingest/myhome.ts`): 해시 기반 변경 감지(FNV-1a 계열 `simpleHash`, 외부 패키지 없이 구현), houseSn 기반/필드그룹 기반 유닛 생성 분기, 결정적 자동요약 생성(`buildAutoSummary`, LLM 없이 소스 필드로 3~4문장 조립), 지역 매핑 실패 시 null(전국으로 뭉개지 않음), 기관 매핑 실패 시 UNKNOWN, API 요청 재시도(최대 5회, 지수 백오프) — 공공데이터포털 API가 세션 중 실제로 여러 번 504/타임아웃을 냈어서 견고성이 필요했음.
- **소스/관리자 칸 분리 upsert**(`scripts/lib/ingest-upsert.ts` 신규): `applyIngestedAnnouncements()`가 신규는 insert(published+pending 초기값), 기존은 "소스 소유 칸만" 명시적으로 update — status/review_status/summary/eligibility 등 관리자 칸은 컬럼 목록에 아예 없어서 구조적으로 못 건드림. 해시가 같으면 last_seen_at만, 다르면 소스 칸 갱신 + `ready`였으면 `recheck`로 자동 전환. 사라진 유닛은 삭제 대신 `active=false`. `autoCloseExpiredAnnouncements()`는 KST 자정 기준으로 마감 처리(서버 UTC 기준으로 하면 9시간 일찍 마감되는 문제 방지).
- **안전장치**: `scripts/ingest-myhome.ts`가 직전 성공 run의 `fetched` 대비 이번 응답이 50% 미만이면 자동 마감 단계를 건너뛰고 `partial`로 종료 — API 장애로 빈 응답이 왔을 때 멀쩡한 공고들이 우르르 마감 처리되는 걸 막음. `ingest_runs`에 매 실행 기록.
- **데이터 조회 레이어 갱신**(`lib/data/announcements.ts`): `getAnnouncements()`가 이제 `published`+`closed`를 함께 가져오되 마감 30일 지난 건 쿼리에서 제외, 비활성(`active=false`) 유닛은 일반 조회에서 필터링(관리자 조회는 포함). 관리자 목록 정렬을 `request_count desc → apply_end asc`로(설계서 7장 큐 정렬 기준). `getLastSuccessfulIngestAt()` 신규(대시보드 "마지막 갱신" 표시용).
- **사용자 UI**: `MatchPanel`의 `needs_review` 문구를 "접수기간·임대료는 확인됐어요 + 원문 확인 버튼"으로 개선, `recheck` 상태면 "변경됨" 배지 + 안내문 추가. "조건 정리되면 알려주세요" 버튼(`RequestReviewButton` 신규, `/api/announcements/[id]/request-review` 신규 — 지금은 인증 없이 누구나 호출 가능한 임시 구현, TODO로 명시) 추가. 대시보드에 "마지막 갱신 N분 전" 표시 추가.
- **관리자 UI**: 목록에 재확인/매핑실패/요청수 집계와 컬럼 추가, `hidden` 상태 표시 지원. (필터 탭·다중 유닛 조건 복사 등 설계서 7장의 나머지는 아직 — 지금은 지표 가시성만 개선한 상태.)
- **스케줄러**: `.github/workflows/ingest.yml` 신규 — KST 08:10/13:10/18:10 하루 3회 + 수동 실행(`workflow_dispatch`), `concurrency: ingest`로 겹침 방지. **저장소 Secrets(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_GO_KR_API_KEY`) 등록은 아직 안 됨 — 등록 전까지는 크론이 등록만 되어 있고 실제로 돌지 않는다.**

**실행 검증**: 기존 mock 129건(구 로직, status=draft)을 삭제하고 새 로직으로 재수집 → **129건 전부 신규 insert, status=published**로 들어감. anon key로 조회 시 이전엔 0건이었던 게 이제 **129건 전체가 보임**을 직접 확인 — 이게 이번 재설계의 핵심 목표("관리자 개입 없이 목록 갱신")가 실제로 달성됐다는 증거. 재수집(idempotency, unchanged 카운트) 검증은 이 세션 중 공공데이터포털 API가 여러 차례 불안정(504/커넥션 타임아웃)해서 완료하지 못함 — 다음 세션에서 재검증 필요.

### 8-1. GitHub Actions 크론이 마이홈포털 API에 403 — 자동화 중단, 로컬 실행으로 전환

GitHub Secrets(`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`DATA_GO_KR_API_KEY`) 등록 후 `workflow_dispatch`로 실제 실행해서 검증하는 과정에서 발견.

**1차 실패**: `@supabase/supabase-js`가 의존하는 `@supabase/realtime-js`가 Node 22+의 네이티브 WebSocket을 요구하는데, 워크플로가 Node 20을 쓰고 있어서 클라이언트 생성 자체에서 크래시(`Error: Node.js detected but native WebSocket not found`). → `node-version: 22`로 수정, `package.json`에 `engines.node: ">=22.0.0"` 명시. 커밋 `0ea35df`.

**2차 실패**: Node 22로 고친 뒤 재실행하니 이번엔 `마이홈포털 API 응답 오류: 403`. 같은 코드, 같은 키로 로컬(한국 IP)에서는 (그 시점의 API 불안정과 별개로) 정상 동작했던 반면 GitHub Actions(해외 러너 IP)에서는 API 서버까지 도달은 했지만 거부당함(403은 "응답"이 온 것 — 연결 실패와 다름). 국토교통부 계열 공공데이터포털 API가 해외 IP를 차단하는 건 흔히 보고되는 제약이라, 이 패턴과 일치한다고 판단.

**국내 IP로 자동화하는 대안 검토**:
- GitHub Actions: 러너 리전 선택 불가 → 불가능.
- Vercel: 서버리스 함수 리전을 `icn1`(서울)로 지정하면 가능하지만, **Hobby(무료) 플랜은 리전이 미국 고정이라 Pro(유료) 플랜이 있어야** 함. Cron도 Hobby는 하루 1회 제한(설계서 6-2에 이미 언급됨).

**결정**: 지금은 유료 인프라 없이 간다 — GitHub Actions의 `schedule` 크론을 주석 처리(비활성화)하고 `workflow_dispatch`(수동 실행)만 남김. 대신 `npm run ingest:myhome` 스크립트를 추가해 로컬(또는 향후 한국 리전 서버)에서 필요할 때 직접 수집하는 걸 당분간의 기본 운영 방식으로 함. `tsx`를 정식 devDependency로 승격(그동안 `npx tsx`로 온디맨드 설치해서 썼음).

---

### 9. PDF → Gemini 조건 추출 파이프라인 — 엔드투엔드 구축 및 검증

사용자가 "공고마다 PDF 안에 가구별 자격조건·가점표가 있는데 이걸 읽어야 한다"고 요청. API로는 안 되고(마이홈포털 API는 목록/요약만 주고 세부 자격요건은 원래 없음), PDF를 직접 읽어야 한다고 판단 → 방식으로 "LLM 자동 초안 추출 + 관리자 검수"를 선택, 모델은 Gemini로 결정.

**착수 전 실증(코드 작성 전에 손으로 먼저 확인)**:
- 실제 공고 하나(`myhome-21160`)의 상세 페이지(`originalUrl`) HTML을 직접 받아 분석 → 첨부 PDF가 `fnDownFile(atchFileId, fileSn)`이라는 JS 함수로 다운로드되는 구조임을 발견. 실제로 `POST https://www.myhome.go.kr/hws/com/fms/cvplFileDownload.do` (body: atchFileId, fileSn)로 786KB짜리 진짜 PDF를 받는 데 성공.
- 그 PDF를 Gemini(`gemini-3.6-flash`, `@google/genai` SDK, `responseSchema`로 구조화 출력 강제)에 바로 업로드해서 우리 `Condition`/`Tier`/`ScoreRule` 스키마 그대로 추출 성공. 결과 품질 확인: 자격요건·순위·가점표가 정확히 매핑됐고, 스키마로 표현 못 하는 항목(수급자 여부 등 복합조건)은 스스로 `notes`에 한계를 명시함 — 검수 유도가 의도대로 동작.
- 참고: 처음 시도한 모델명 `gemini-2.5-flash`는 "신규 사용자에게 더 이상 제공 안 됨, `gemini-3.6-flash` 쓰라"는 404 에러로 안내받아 교체.

**설계 원칙(마이그레이션 0002의 "소스/관리자 칸 분리"와 동일한 이유)**: AI가 만든 초안은 `supply_units.eligibility` 등 실제 판정 칸을 **절대 자동으로 덮어쓰지 않는다**. 검수 없이 잘못된 조건이 판정에 쓰이면 사용자에게 잘못된 정보를 주게 되기 때문. 대신 공고 단위로 `announcements.ai_draft`(jsonb)에 초안 전체를 저장하고, 관리자가 검수 화면에서 "이 유닛에 반영" 버튼을 눌러야 실제 `supply_units` 행에 옮겨진다.

**구현**:
- **마이그레이션 0003**(`supabase/migrations/0003_ai_extraction.sql`): `announcements`에 `notice_pdf_url`, `ai_draft`(jsonb), `ai_draft_status`(none/pending/extracted/approved/failed), `ai_draft_confidence`(high/medium/low), `ai_draft_notes`, `ai_draft_extracted_at`, `ai_draft_error` 추가.
- **PDF 확보**(`lib/ingest/myhome-pdf.ts`): 상세 페이지 HTML에서 `fnDownFile(...)` 정규식 매칭으로 `atchFileId`/`fileSn` 추출 → POST로 다운로드. 첨부 없으면 null 반환(에러 아님).
- **추출 로직**(`lib/ingest/gemini-extract.ts`): 시스템 프롬프트에 우리 `Field` enum 16개의 의미를 전부 명시(금액은 만원 단위, 기간은 개월 단위로 변환하라는 규칙 포함), `responseSchema`로 JSON 구조 강제. 503(과부하)/429는 재시도(최대 3회).
- **배치 스크립트**(`scripts/extract-conditions.ts`, `npm run extract:conditions`): `ai_draft_status`가 `none`/`failed`인 공고를 순회하며 PDF 다운로드 → Gemini 추출 → DB 저장. `--limit=N`, `--id=<id>` 옵션 지원. 요청 간 1.5초 텀(API 부담 완화).
- **관리자 검수 데이터 레이어**(`lib/data/ai-drafts.ts`, `server-only`): 초안 큐 조회, 상세 조회(실제 supply_units 목록과 함께), 초안 유닛 → 실제 유닛 승인 반영(`approveDraftToUnit`), 공고를 판정 가능(`review_status: ready`)으로 전환(`markAnnouncementReady`) — 이 둘은 별개 스위치다(조건 반영과 "이제 판정해도 된다" 선언은 다른 결정).
- **API 라우트**: `/api/admin/ai-drafts/[id]/approve-unit`(초안 유닛→실제 유닛 반영), `/api/admin/announcements/[id]/mark-ready`(판정 가능 전환).
- **관리자 UI**: `/admin/ai-drafts`(큐 목록, 확신도·상태 배지), `/admin/ai-drafts/[id]`(초안 상세 — 유닛별 자격요건/순위/가점표 표시, 반영할 실제 유닛을 드롭다운으로 선택 후 "이 유닛에 반영" 버튼, 마지막에 "판정 가능으로 전환" 버튼).

**실행 검증(엔드투엔드, 진짜 데이터로)**:
1. `npm run extract:conditions -- --limit=3` → 3건 전부 `extracted` 성공(제주 행복주택 confidence=high, 목포 영구임대 confidence=high, 기숙사형 청년주택 confidence=medium — 대학 거리·성적 등 우리 스키마 밖 항목이 있어서 스스로 낮춤).
2. `/admin/ai-drafts`, `/admin/ai-drafts/[id]` 페이지가 실제로 초안 내용(자격요건 5개, 순위 2개, 가점표 3개 등)을 정확히 렌더링하는 것을 curl로 확인.
3. `POST /api/admin/ai-drafts/myhome-21028/approve-unit` 실제 호출 → DB의 `supply_units` 행에 `eligibility`(5개)/`tiers`(2개)/`score_rules`(3개)가 정확히 반영됨을 직접 조회로 확인.
4. `POST /api/admin/announcements/myhome-21028/mark-ready` 호출 → `review_status`가 `pending`→`ready`로 바뀜을 확인.
5. **가장 중요한 검증**: 이렇게 반영된 실제 데이터로 `matchUnit()`을 직접 호출 — 가상의 지원자(목포시 거주·30세·무주택 등)를 넣었더니 `status: eligible`, `1순위`, `가점 67/85점`, 항목별 breakdown까지 정확히 계산됨. PDF의 텍스트가 실제 판정 결과로 이어지는 전체 경로가 살아있음을 확인.

---

### 10. 나머지 126건 배치 추출 — Gemini 무료 티어 rate limit에 걸림, 수정 후 재실행

`npm run extract:conditions`(전체, `--limit` 없이)를 백그라운드로 돌렸더니 초반 4건 성공 후 실패율이 급증 — DB의 `ai_draft_error`를 직접 조회해서 원인 확인: **Gemini 무료 티어가 `gemini-3.6-flash` 기준 분당 20회 요청 한도**라, 요청 간 1.5초 대기로는 이 한도를 계속 넘겨 `429 RESOURCE_EXHAUSTED`가 반복됨. 429 응답 메시지에 `"Please retry in 9.78s"`처럼 서버가 정확한 대기시간을 알려주는데, 기존 재시도 로직은 이걸 무시하고 `3초 × 시도횟수`로 짧게 재시도해서 계속 다시 걸림.

**수정**(`lib/ingest/gemini-extract.ts`, `scripts/extract-conditions.ts`):
- 429 메시지에서 `retry in Ns` 패턴을 정규식으로 파싱해 그 시간만큼 정확히 대기(+1초 여유), 못 찾으면 기존처럼 지수 백오프.
- 재시도 최대 횟수 3→5회로 늘림.
- 배치 스크립트의 요청 간 대기를 1.5초→4초로(분당 20회 한도에 여유 있게 맞춤).

실패했던 건들은 스크립트가 자동으로 재시도 대상(`ai_draft_status in (none, failed)`)에 포함하므로 별도 초기화 없이 재실행. 백그라운드로 재실행 중 — 완료되면 몇 건이 최종 성공/실패(주로 `no_pdf`: 상세 페이지에 첨부가 없는 케이스)인지 이 절에 결과를 추가한다.

---

### 11. "어떤 유닛에 넣을지" 추천 기능 — 설계 착수

사용자가 새 아이디어 제시: 지금은 "신청 가능한지"만 알려주는데, 한 공고 안에 여러 유닛(평형)이 있을 때 "어디에 넣는 게 더 유리한지"까지 추천하고 싶다. 세 축을 합산하는 추천 점수 + 자동 생성 한줄평(예: "멀긴 해도 가능성이 높은 집!", "지금보다 출퇴근시간 아끼는 집!") 아이디어.

**추천 점수의 세 축**:
1. **자격 축** — 기존 `matchUnit()` 그대로(신청 가능 여부, 순위, 가점)
2. **교통 축**(신규) — 지금 거주지→직장/학교 통근시간 대비, 이 유닛 위치→직장/학교 통근시간이 짧아지면 가산
3. **당첨 가능성 축**(신규) — 지역 인기도(경쟁률) 대비 내 순위/가점이 낮으면 감점(인기 지역에 낮은 순위로 넣어봐야 확률이 낮다는 걸 반영)

**결정한 것**:
1. 통근시간 계산: **카카오맵/네이버지도 길찾기 API**로 실제 대중교통 소요시간 계산(직선거리 근사 대신) — 지도 연동(카카오맵) 계획과 같은 API 키로 처리 가능.
2. 경쟁률 점수: **실제 과거 경쟁률 데이터를 확보한 뒤 진행** — 청약홈/LH/마이홈포털에 과거 당첨자 발표·경쟁률 통계가 공개돼 있는지 별도 조사가 선행 작업으로 필요(아직 미착수).
3. 위치 입력 정확도: 사용자가 **간편(가까운 지하철역 이름만, 프라이버시 부담 적음)** 또는 **정밀(전체 주소, 도보 구간까지 정확)** 중 선택하게 함. 회사/학교뿐 아니라 현재 거주지도 같은 방식으로 받음(지금 `residenceRegion`은 시도 단위라 통근 계산엔 너무 넓음).
4. 구현 순서: 회원 인증(로드맵 4번)이 아직 없어서, **지금은 `Profile` 타입에 필드만 추가**해두고 온보딩 UI·API 연동·실제 추천 로직은 인증이 붙는 시점에 이어서 하기로 함.

**지금까지 한 것**: `src/lib/types.ts`에 `CommuteAnchor`(station | address 유니온) 타입과 `Profile.commuteFrom`/`commuteTo` optional 필드 추가. 둘 다 optional이라 기존 `DEMO_PROFILE`/`EMPTY_PROFILE` 등은 수정 없이 그대로 컴파일됨(확인함).

**아직 안 한 것**: 온보딩 UI(간편/정밀 선택 + 입력 폼), 카카오맵 길찾기 API 연동 코드, 경쟁률 데이터 조사, 추천 점수 계산 로직, 한줄평 생성 로직(규칙 기반 또는 LLM), UI에 추천 결과 노출.

---

### 12. 회원 인증 — 구글·카카오·이메일 3종 구현

로드맵 4번(인증)을 착수. 처음엔 "이메일+카카오"로 시작했다가, 카카오 설정 부담 때문에 이메일만으로 좁혔고, 최종적으로 사용자 요청에 따라 **구글·카카오·이메일 3종**으로 확정했다. 구글은 카카오보다 설정이 간단하고, 소셜 로그인은 그쪽에서 본인 확인이 끝나 있어 **이메일 인증 절차가 아예 없다**는 점이 장점(이메일 가입만 확인 메일이 필요).

**마이그레이션 0004**(`supabase/migrations/0004_user_profiles.sql`):
- `user_profiles`: `auth.users`와 1:1. **Profile 전체를 `profile jsonb` 한 컬럼에 통째로** 저장한다 — Profile 타입이 계속 진화 중이라(통근 필드도 방금 추가됐다) 컬럼을 하나씩 매핑하면 매번 마이그레이션해야 하는데, 이 데이터는 검색·집계 대상이 아니라 "본인이 통째로 읽고 쓰는 덩어리"이기 때문. 다만 알림 발송 대상을 서버가 쿼리로 골라야 해서 `notify_deadline`/`notify_new_match`/`onboarding_done`만 별도 컬럼으로 중복 저장하고 인덱스를 걸었다.
- `favorites`: 관심 공고. 지금까지 localStorage에 있던 걸 로그인 사용자는 DB로 옮긴다.
- **RLS로 본인 행만 접근** 가능하게 잠금(`auth.uid() = user_id`).

**구현**:
- `lib/auth.ts`: `useAuth()`(세션 훅, `loading` 상태를 따로 둬서 첫 렌더에 "로그인하세요"가 번쩍이지 않게), `signUpWithEmail`/`signInWithEmail`/`signInWithOAuth`. Supabase의 영문 에러를 한국어로 옮기는 `toKoreanMessage` 포함.
- `app/auth/callback/route.ts`: OAuth·이메일 링크가 돌아오는 지점. 코드를 세션으로 교환한 뒤, **프로필이 없으면 온보딩으로, 있으면 대시보드로** 나눠 보낸다.
- `lib/profile-remote.ts` + `lib/profile.ts` 재작성: **`useProfile()`의 인터페이스는 그대로 두고**(기존 컴포넌트를 안 건드림) 저장 위치만 로그인 여부에 따라 DB/localStorage로 자동 분기. 게스트로 입력해둔 프로필이 있으면 로그인 시 서버로 자동 이관해서 같은 걸 두 번 입력시키지 않는다.
- `lib/supabase/proxy.ts`: `/me`·`/onboarding`·`/notifications`·`/admin`을 **서버(proxy) 단계에서 차단**하고 `?next=`로 원래 목적지를 보존. 화면 안에서만 막으면 내용이 잠깐 보였다 사라지는 깜빡임이 생기고 서버 컴포넌트가 이미 데이터를 읽은 뒤라 낭비다.
- UI: `SocialLoginButtons`(구글·카카오 공용), `GoogleIcon` 신설. 로그인·가입 화면 재작성(가입은 약관 동의 후에만 버튼이 활성화). 마이페이지 로그아웃이 실제 세션을 끊도록 수정. 헤더가 `isLoggedIn && profile` → `isLoggedIn`으로 바뀌어, 온보딩 전 사용자도 로그인 상태로 보인다.
- 온보딩: 구글·카카오로 처음 온 사람은 그쪽에서 받은 이름을 미리 채운다. 이 과정에서 기존 `useEffect`+`useRef`로 서버 값을 state에 복사하던 패턴을 **파생 값(`base` + `edits`)으로 교체** — 값이 늦게 도착했을 때 덮어쓰기·깜빡임 문제가 없어지고 린트 경고도 해소.

**검증(실제 Supabase 계정으로)**: 사용자 생성 → 로그인 → 본인 프로필 저장 OK → **남의 `user_id`로 프로필을 쓰려는 시도를 RLS가 실제로 차단**하는 것 확인 → 저장한 값 읽기 OK → 테스트 계정 삭제. 인증 게이트도 curl로 확인: `/me`·`/admin/*`는 307로 `/login?next=...`에 보내고, `/dashboard`는 200(게스트 유지).

**남은 설정(코드 밖)**: Supabase 대시보드 Authentication > Providers에서 Google/Kakao를 켜야 소셜 버튼이 실제로 동작한다. 꺼져 있으면 "이 로그인 방식은 아직 준비 중이에요"로 안내된다. 이메일 가입은 지금 "Confirm email"이 켜져 있어 확인 메일이 필요한데, 무료 플랜 기본 발송량이 시간당 2~3통이라 실서비스 전에 메일 발송 업체(Resend 등) 연결이 필요하다.

---

### 13. Gemini 쿼터 소진 — 재시도가 쿼터를 더 태우는 악순환 수정

10번에서 고친 뒤에도 배치 실패율이 여전히 높아(117건 중 대부분 429) DB의 `ai_draft_error`를 다시 분석: 무료 티어 한도(`generate_content_free_tier_requests`, limit 20)에 걸린 뒤 **재시도가 다시 쿼터를 소모하면서 남은 건들까지 연쇄적으로 실패**시키고 있었다. 결국 쿼터가 완전히 바닥나 단순한 `hi` 요청조차 429가 나는 상태가 됐다.

**수정**:
- `GeminiQuotaExhaustedError` 전용 에러 타입 신설. 429는 서버가 알려준 시간만큼 **딱 한 번만**(90초 이내일 때) 기다려보고, 그래도 막히면 즉시 이 에러로 포기한다.
- 배치 스크립트는 이 에러를 만나면 그 공고를 `failed`로 기록하지 않고(쿼터 문제는 그 PDF의 잘못이 아니므로 "PDF에 문제 있음"이라는 잘못된 흔적을 남기면 안 된다) **즉시 전체 실행을 중단**하고 "한도 회복 후 다시 실행하면 이어서 처리된다"고 안내한다.
- 쿼터 때문에 `failed`로 잘못 기록된 113건을 `none`으로 되돌렸다(진짜 실패인 4건은 그대로 유지 — `ai_draft_error`에 429가 있는 것만 골라서 되돌림).

**현재 상태**: extracted 12건 / failed 4건(진짜 실패) / none 113건. 쿼터가 회복되면 `npm run extract:conditions`를 다시 실행하면 된다.

---

### 13-1. 한도의 정체는 "분당"이 아니라 "하루" — 모델 순회로 3배 확보

"하루 12건밖에 안 되냐"는 지적을 받고 에러의 `quotaId`를 정확히 읽어보니 **`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, quotaValue 20** — 즉 분당이 아니라 **모델당 하루 20건**이었다. 10번·13번에서 "분당 20회"로 판단하고 대기 시간을 늘렸던 건 잘못된 진단이었다(그래서 아무리 기다려도 안 풀렸다).

**해결**: `PerModel`이라는 데 착안해 다른 모델들의 쿼터를 실제로 확인해보니 별도로 계산되고 있었다(`gemini-3.6-flash`는 소진, `gemini-flash-latest`·`gemini-flash-lite-latest`는 사용 가능). 그래서 한 모델이 소진되면 **다음 모델로 자동 전환**하도록 `MODEL_FALLBACKS` 순회를 넣었다 — 하루 20건 → 약 60건.

**품질 검증**: 대체 모델이 품질을 떨어뜨리면 의미가 없으므로, 가장 복잡한 공고(목포 영구임대 — 자격 5·순위 2·가점규칙 3개, 구간 5/4/4)로 `flash-lite`와 기존 모델 결과를 비교했다. 자격요건 항목·연산자·수치(24500, 4542), 가점 구간 수까지 **전부 동일**. 대체해도 안전하다고 판단.

**부수 정리**: 하루 한도라 "잠깐 기다렸다 재시도"는 무의미하므로 `parseRetryDelayMs`와 관련 대기 로직 제거. 배치 요청 간격도 4초 → 1.5초(Gemini 한도가 분당이 아니므로 길게 쉴 이유가 없고, 마이홈포털 PDF 다운로드 부담만 고려하면 된다).

**앞으로의 운영 비용 확인**: 초기 구축(129건)이 부담이지 정상 운영은 무료로 충분하다. DB의 `announced_at`을 집계해보니 **하루 평균 2.8건**(중앙값 2건, 관측된 최대 20건)이라, 하루 한도 60건 대비 20배 이상 여유가 있다.

---

### 14. "스키마 밖 조건"을 버리지 않게 + 초기 구축분 126건 추출 완료

**계기**: 테스트로 2건을 뽑아 보니(든든전세주택, 청주산단 행복주택) 품질은 좋았는데, 청주산단 건의 `notes`에 "계층별(산단근로자/대학생/청년/고령자) 요건이 상이하고 대학생은 자동차 미소유"라는 중요한 내용이 **한 문장으로 뭉뚱그려져** 있었다. 사용자가 "우리 스키마에 없지만 조건에 필요한 내용은 기타로 빼서 볼 수 있게 하자"고 지적.

**구현**: Gemini 응답 스키마에 유닛별 `otherRequirements` 추가.
- 각 항목은 `label`(한 문장) + `kind`(eligibility/tier/score/other — 원래 어디 속하는 조건인지) + `detail`(원문 표현).
- 프롬프트 규칙 8·9로 "표현 못 하는 조건은 버리지 말고 여기 담되, 성격을 kind로 표시하라"고 명시.
- 관리자 검수 화면에 "자동 판정에 못 쓰는 조건 N개" 주황색 블록으로 노출.

**효과 검증**: 청주산단 건을 재추출하니 notes 한 줄이던 정보가 4개 항목으로 구조화됐다 — "산단 근무자(청주·대전·세종·천안 등 지역 목록 포함)", "대학생 계층 자동차 미소유(단지 내 차량 등록 불가)", "1순위 판단 기준(취업 5년/혼인 7년/한부모)". 유닛 분리도 계층별로 더 정확해졌다(산단근로자·청년·대학생 / 고령자·주거약자).

**전체 배치 결과**: 새 프롬프트로 108건을 돌려 104건 성공. 503(Gemini 일시 장애) 3건은 재시도로 회복. **최종 126/129건(98%)**.
- 확신도: high 122 / medium 4 / low 0
- 유닛 176개, 자격요건 577 / 순위 221 / 가점규칙 196
- **기타 조건 177개가 유닛 78개(44%)에서 발견됐다** — 이 기능을 안 넣었으면 그만큼이 통째로 유실될 뻔했다.
- 남은 3건은 공고 상세 페이지에 PDF 첨부가 없는 케이스(재시도해도 안 됨).

**예상과 달랐던 점**: 13-1번에서 "하루 60건, 이틀 걸린다"고 봤는데 108건이 한 번에 끝났다. 모델 순회가 예상보다 잘 먹혔고, 실제 하루 한도가 모델·시점에 따라 더 넉넉했던 것으로 보인다.

---

### 15. 기타 조건을 사용자 화면까지 + 실패 목록을 관리자가 처리할 수 있게

14번에서 만든 `otherRequirements`는 관리자 검수 화면에만 보였는데, 유닛의 44%에 있는 정보라 **신청하려는 사용자한테도 필요하다**고 판단해 끝까지 연결했다.

**기타 조건 → 사용자 화면**:
- 마이그레이션 0005: `supply_units.other_requirements jsonb` 추가.
- `OtherRequirement` 타입을 `types.ts`에 정식 추가(초안 전용 타입이 아니라 도메인 타입으로 승격). `SupplyUnit.otherRequirements`는 optional — 예전에 승인된 유닛에는 없을 수 있다.
- 승인(`approveDraftToUnit`) 시 eligibility/tiers/scoreRules와 함께 `other_requirements`도 옮긴다.
- `MatchPanel`에 "직접 확인이 필요한 조건" 카드 추가(자격 요건 체크 카드 바로 아래). "입력하신 정보로는 자동 확인할 수 없으니 공고문에서 꼭 확인하세요"라고 안내한다. 마감된 공고에는 안 띄운다.

**추출 실패 목록**: 사용자가 "실패한 건은 제목·링크를 보고 직접 수동 추가하겠다"고 요청.
- `getAiDraftQueue`가 `original_url`도 함께 반환하도록 확장(실패 건은 `notice_pdf_url`이 비어 있어 원문 링크가 필요하다).
- `/admin/ai-drafts` 상단에 "불러오기 실패 N건" 섹션을 분리. 각 항목에 제목·공고 id·**실패 사유를 사람 말로** 번역해서 보여준다("공고 페이지에 PDF 첨부가 없어요. 원문을 보고 직접 입력해야 해요" / "Gemini 일시 장애예요, 다시 추출하면 대개 성공해요" / "하루 한도를 다 썼어요"). 재시도로 해결되는 건지 손으로 넣어야 하는 건지 바로 구분된다.
- 각 항목에 "원문 열기"(새 탭) + "직접 입력"(관리자 편집 화면) 버튼.

**검증**: 실제로 승인 API를 호출해 `other_requirements`가 `supply_units`에 저장되고("소득 및 총자산 기준 적용 배제", "선착순 동호지정 현장 접수" + 각 detail), 공고 상세 페이지까지 데이터가 전달되는 것을 확인. 실패 목록 화면도 제목·사유·원문 링크가 정상 렌더링됨을 확인(테스트로 승인한 유닛과 계정은 원복·삭제).

---

### 16. 관리자 권한 분리 — 아무나 관리자 화면에 들어가던 문제 해결

로그인만 하면 누구나 `/admin/*`에 들어가 공고를 수정할 수 있던 상태를 막았다. 사용자가 "회원가입하고 내 계정을 관리자로 지정하자"고 제안한 방식대로 구현.

**설계 판단 — 왜 `user_profiles.role`이 아니라 별도 테이블인가**: `user_profiles`는 사용자가 자기 행을 update할 수 있어야 한다(프로필 저장). 거기에 role을 두면 RLS 정책을 아무리 정교하게 짜도 "자기를 관리자로 승격"시킬 여지가 남는다. 별도 `admins` 테이블로 두고 일반 사용자에게 select조차 주지 않으면 그 경로가 **구조적으로** 막힌다.

**구현**:
- 마이그레이션 0006: `admins` 테이블(user_id PK). RLS 켜고 **정책을 하나도 만들지 않아** anon/authenticated는 접근 불가. `service_role`에만 grant.
- `lib/data/admins.ts`의 `isAdmin()` — service_role로만 조회.
- `proxy.ts`: `/admin/*`은 로그인 + 관리자 확인. 관리자가 아니면 홈으로 리다이렉트. **이 조회는 `/admin/*` 요청에만** 하므로 일반 페이지 성능에 영향 없다.
- `lib/data/require-admin.ts`: 관리자 API 라우트용 가드. **proxy에만 의존하지 않는 이유** — `/api/admin/*`은 `/admin` 경로 규칙에 안 걸려서 실제로 무방비였다(발견해서 수정). 게이트를 한 곳에만 두면 경로 규칙이 바뀔 때 조용히 뚫리므로 각 라우트가 스스로를 지키게 했다.
- `npm run grant-admin -- you@example.com` (해제는 `--revoke`): 화면에 "관리자 되기" 버튼을 두면 누구나 누를 수 있으므로 일부러 CLI로만 가능하게 했다.

**막혔던 지점**: `service_role`은 RLS는 우회하지만 **테이블 GRANT까지 우회하지는 않는다**. 정책도 grant도 안 주니 서버에서도 `42501 permission denied`가 났다. `service_role`에만 명시적으로 grant해서 해결(anon/authenticated는 여전히 권한 없음).

**검증**: 테스트 계정으로 전 과정 확인 — 비로그인은 `/login?next=`로, 로그인했지만 관리자가 아니면 홈으로 리다이렉트(API는 403 "권한이 없어요"). `grant-admin` 실행 후 관리자 화면(검수 대기 126건)과 API 모두 200. `--revoke` 후 다시 차단되는 것까지 확인.

## 아직 안 한 것 / 다음 단계 후보

- **자동수집 재개 방법 찾기**: GitHub Actions Secrets는 등록 완료했지만 마이홈포털 API가 해외 러너 IP를 403으로 차단해서 `schedule` 크론을 비활성화한 상태(8-1절). 당분간 `npm run ingest:myhome`을 필요할 때 직접 실행. 재개 후보: Vercel Pro(서울 리전) 또는 집/사무실 PC·홈서버에서 도는 로컬 크론(cron/작업 스케줄러).
- **재수집 idempotency 실증 검증**: `applyIngestedAnnouncements()`의 "해시 같으면 unchanged, 다르면 recheck 전환" 로직은 코드 리뷰 수준으로는 맞지만, 실제로 같은 데이터를 두 번 수집했을 때 unchanged로 잡히는지는 API 불안정으로 이번 세션에서 확인 못 함.
- **관리자 큐 UI 완성**: 설계서 7장의 필터 탭(pending/recheck/매핑실패/중복의심/완료), 행 단위 액션(숨기기·유형 고치기·조건 템플릿 적용), 다중 유닛 조건 복사("첫 유닛 조건을 나머지에 복사")는 아직 — 지금은 집계 숫자와 컬럼 표시만 있음. 마이홈 데이터 58건이 다중 유닛이라 이게 없으면 검수 속도가 느림.
- **관리자 검수(가장 시급)**: 126건이 추출됐지만 **아직 하나도 승인되지 않아 실제 판정에는 전혀 반영되지 않았다**. `/admin/ai-drafts`에서 초안을 확인하고 유닛에 반영 → `review_status: ready` 전환해야 사용자가 순위·가점을 볼 수 있다. 126건을 사람이 다 보려면 시간이 걸리니, 확신도·요청수(`request_count`) 기준으로 우선순위를 잡거나 관리자 큐 UI를 먼저 개선하는 게 나을 수 있다.
- **실패 3건 수동 입력**: `/admin/ai-drafts` 상단 "불러오기 실패" 섹션에서 원문을 열어 조건을 직접 입력하면 된다(15번에서 화면은 준비됨).
- **영구 실패 건의 재시도 제외**: 지금 배치는 `failed` 상태도 매번 다시 시도한다. "PDF를 찾지 못했어요"처럼 재시도해도 계속 실패하는 건(현재 4건)이 매일 쿼터를 갉아먹는다 — 정상 운영(하루 2.8건) 대비 무시 못 할 비중이므로, 실패 횟수를 세서 N회 이상이면 대상에서 빼거나 별도 상태로 분리해야 한다.
- **AI 추출 품질을 여러 건으로 더 확인**: 표가 복잡하거나 이미지로만 된 PDF(스캔본 등)에서는 품질이 떨어질 수 있어 더 넓은 샘플로 확인 필요.
- **소셜 로그인 provider 켜기**: Supabase 대시보드 Authentication > Providers에서 Google/Kakao를 활성화해야 버튼이 실제로 동작한다. 각각 Google Cloud Console / 카카오 디벨로퍼스에서 OAuth 앱 등록 후 Client ID·Secret 입력 필요(둘 다 무료). Redirect URI는 `https://xzdmkehdljmomczjizjo.supabase.co/auth/v1/callback`.
- **이메일 발송 업체 연결**: 이메일 가입은 확인 메일이 필요한데 Supabase 무료 플랜 기본 발송량이 시간당 2~3통이라 실서비스 불가. Resend 등 연결 필요(또는 소셜 로그인만 노출하고 이메일 가입은 나중에).
- **통근 추천 기능 이어서 개발**(11번 단계): 인증이 끝났으니 이제 진행 가능. 온보딩 UI(간편/정밀 위치 입력), 카카오맵 길찾기 연동, 경쟁률 데이터 조사, 추천 점수·한줄평 로직이 남음.
- **청약홈(민간 APT) 연동**: 스펙 확보·1건 실호출까지 끝났고 어댑터 코드만 남음(PDF 추출 파이프라인은 마이홈포털 전용으로 짜여 있어 청약홈 연동 시 상세페이지 구조를 다시 조사해야 함).
- **"조건 정리되면 알려주세요" 버튼 인증**: 지금은 로그인 여부·중복 클릭 방지 없이 누구나 호출 가능(`request_count`만 증가) — 이제 인증이 있으니 사용자당 1회로 제한 가능.
- **카카오맵 SDK 실연동**: `UnitLocationCard`에 자리만 파놓음. 실제 지도 렌더링, 주소→좌표 지오코딩 없음.
- **DB 비밀번호 재발급 확인**: 마이그레이션 과정에서 대화에 여러 번 노출된 Supabase DB 비밀번호를 아직 재발급 안 함(사용자가 "재발급 안 하고 기존 걸로 진행" 선택).
- **실데이터 소득기준표**: 여전히 2025년 자리표시 값(`INCOME_100_BY_HOUSEHOLD`).
- **Vercel 배포 후**: `/api/cron/ingest` 라우트 + Vercel Cron(Pro 플랜, 서울 리전)으로 전환(설계서 6-2) — GitHub Actions는 IP 문제로 이 API엔 못 쓴다는 게 확인됨(8-1절).

---

## 알아두면 유용한 것들 (이 프로젝트 고유의 함정)

- **`middleware.ts`가 아니라 `proxy.ts`**. Next.js 16의 브레이킹 체인지. 외부 라이브러리(Supabase 등) 가이드를 그대로 복붙하면 조용히 안 먹힌다.
- **`tsc --noEmit` 단독 실행은 `RouteContext` 타입 에러를 낸다** (Next.js가 빌드 시 자동 생성하는 타입이라서). 이 프로젝트에서 타입 검증은 `next build`까지 해야 정확하다 — 새 API 라우트를 추가한 직후엔 특히 먼저 `next build`부터 돌려야 한다.
- **`cookies()`가 async**다(Next.js 15+). Supabase 서버 클라이언트도 이를 반영해 `await cookies()`로 작성돼 있음.
- **RLS는 `status in ('published','closed')`만 공개**한다(0002부터, 이전엔 published만) — 새 데이터를 넣었는데 화면에 안 보이면 버그가 아니라 `status`/`review_status`부터 확인. `getAnnouncements()`는 여기에 더해 마감 30일 지난 건을 애플리케이션 레벨에서 추가로 거른다.
- **관리자 페이지는 지금 `service_role`로 우회 중**이라 인증 없이도 `/admin/*`이 열림 — 배포 전 반드시 인증 게이트 필요.
- **마이홈포털 공공데이터 API는 세션 중 여러 번 504/커넥션 타임아웃을 냈다** — 우리 코드 문제가 아니라 그쪽 서버의 간헐적 불안정. `lib/ingest/myhome.ts`가 재시도(5회, 지수 백오프)로 대응하지만, 그래도 실패하면 며칠 안에 재시도하면 된다.
- **마이홈포털 API는 해외 IP를 차단한다** — GitHub Actions에서 돌리면 403. 이 API를 서버에서 자동 호출하려면 반드시 한국 리전(로컬 PC, 국내 서버, 또는 Vercel Pro의 `icn1` 리전)에서 실행해야 한다.
- **`@supabase/supabase-js`는 Node 22+가 필요하다** — 내부 `realtime-js`가 네이티브 WebSocket을 요구해서 Node 20 이하에서는 클라이언트 생성 자체가 크래시한다. CI 설정 시 `node-version`을 꼭 22 이상으로.
- **자동수집이 관리자 작업을 덮어쓰면 안 된다는 원칙**: `scripts/lib/ingest-upsert.ts`가 신규(insert)와 기존(update) 행을 분리하고, update는 "소스 소유 칸"만 명시적으로 나열한 컬럼 목록으로 한다 — status/review_status/summary/eligibility 등은 그 목록에 아예 없어서 코드 구조상 못 건드린다. 새 소스 필드를 추가할 때 이 upsert 헬퍼도 같이 갱신해야 한다.
- **마이홈포털 API의 매입임대(다가구주택) 데이터는 개별 유닛 식별자가 없다** — 면적·보증금·월세·주소 해시로 그룹핑해서 유닛을 만든다(`toUnitsByFieldGroup`).
- **KST 기준 날짜 비교**: 자동 마감(`autoCloseExpiredAnnouncements`)은 서버가 어느 시간대에서 돌든 KST 자정 기준으로 비교하도록 `Date.now() + 9시간` 오프셋을 쓴다. 서버 UTC 기준으로 그냥 비교하면 9시간 일찍 마감된다.
- **Windows 환경 팁**: `taskkill //PID <pid> //F`로 종료(POSIX `kill`이 안 먹는 프로세스가 있음), `netstat -ano | grep PORT`로 실제 PID 확인. Bash 도구에서 `command &`로 백그라운드 실행한 것은 세션이 끊기면 같이 죽을 수 있다 — 진짜 오래 걸리는 작업은 `run_in_background: true` 옵션을 쓰고 셸 안에서 `&`를 겹쳐 쓰지 않는다.
- **Gemini 모델명은 `gemini-2.5-flash`가 아니라 `gemini-3.6-flash`다**(2026-09 기준) — 구 모델명으로 부르면 "신규 사용자에게 더 이상 제공 안 됨" 404가 난다. `@google/genai` SDK의 503(과부하)은 흔하니 재시도 로직 필수.
- **AI 초안은 절대 자동으로 실제 판정 칸에 안 들어간다**: `ai_draft`(공고 레벨 jsonb)에만 저장되고, `supply_units.eligibility` 등으로 옮기려면 관리자가 검수 화면(`/admin/ai-drafts/[id]`)에서 유닛을 골라 명시적으로 "반영" 버튼을 눌러야 한다. 조건을 유닛에 반영하는 것과 공고를 `review_status: ready`로 전환하는 것도 서로 다른 별개 액션이다.
- **마이홈포털 PDF 다운로드는 API가 아니라 상세 페이지 HTML 파싱이 필요하다**: `fnDownFile(atchFileId, fileSn)` 패턴을 정규식으로 찾은 뒤 `POST /hws/com/fms/cvplFileDownload.do`로 받는다(`lib/ingest/myhome-pdf.ts`). 목록 API에는 PDF 링크가 아예 없다.
- **Gemini 무료 한도는 "분당"이 아니라 모델당 하루 20건이다**(quotaId `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). 429가 나면 **기다려도 안 풀리므로** 재시도로 버티면 안 된다 — 남은 작업까지 연쇄 실패시키고 쿼터만 태운다. 대신 **모델을 바꾸면 별도 쿼터**를 쓸 수 있어서 `MODEL_FALLBACKS`를 순회한다(하루 약 60건). 후보를 다 소진하면 `GeminiQuotaExhaustedError`로 배치를 멈추고 다음 날 이어서 한다. 쿼터 실패는 `failed`로 기록하지 않는다(그 PDF의 잘못이 아니라 잘못된 흔적이 남는다).
- **429 에러는 `quotaId`를 봐야 정확하다**: 메시지의 "retry in Ns"만 보면 분당 한도처럼 오해하기 쉽다. `"quotaId":"...PerDay..."` / `"quotaValue":"20"` 필드를 확인해야 실제 단위를 알 수 있다.
- **Supabase는 `example.com` 같은 도메인의 이메일을 거부한다** — 테스트 계정을 만들 땐 `gmail.com` 등 실제 존재하는 도메인 형식을 쓰고, `admin.createUser({ email_confirm: true })`로 확인 절차를 건너뛴다.
- **`useProfile()`은 로그인 여부에 따라 저장 위치가 갈린다**(DB ↔ localStorage). 인터페이스는 같아서 컴포넌트는 차이를 몰라도 되지만, **`loading` 상태를 확인하지 않으면** 로그인한 사용자에게도 첫 렌더에 "로그인이 필요해요"가 번쩍 보인다.
- **effect에서 서버 값을 state로 복사하지 말 것**: 이 프로젝트의 린트(`react-hooks/set-state-in-effect`)가 막는다. 값이 늦게 도착했을 때 사용자 입력을 덮어쓰는 버그도 생긴다. 대신 "서버 값 + 사용자가 바꾼 것(`edits`)"을 렌더 시점에 합치는 파생 값으로 만든다(`OnboardingFlow`, `useProfile` 참고).
