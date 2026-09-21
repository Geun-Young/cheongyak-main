/**
 * 네이버 블로그·카페 글 수로 단지의 "인기도"를 잰다.
 *
 * ## 왜 필요한가
 *
 * 공고 하나에 집이 여러 개일 때(경북 부도매입 공고는 13개) 어느 집을 추천할지 정해야 한다.
 * 읍·면이냐 동이냐로 나누는 방식은 너무 거칠었다 — 같은 읍 안에서도 단지마다 선호가 다르고,
 * 13개 중 12개가 전부 "외곽"으로 묶여 순서가 안 매겨졌다.
 *
 * 사람들이 많이 이야기하는 단지는 실제로 지원자도 몰린다. 블로그·카페 글 수는 그 대리지표다.
 * 완벽하지 않지만(오래된 단지가 유리하고, 동명이인 단지가 섞인다) **같은 공고 안에서
 * 상대 비교**하는 용도로는 충분하다.
 *
 * ## 점수 방향
 *
 * 인기도 자체는 좋고 나쁨이 없다. 쓰는 쪽(recommend.ts)에서 사용자 처지에 따라
 * 반대로 해석한다 — 여유 있으면 인기 단지를 올리고, 빠듯하면 내린다.
 *
 * ## 한계 (알고 쓰자)
 *
 * - 글 수는 단지 규모·연식에 비례하는 경향이 있다. 신축 소규모 단지는 과소평가된다.
 * - 단지명이 흔하면(예: "드림빌") 무관한 글이 섞인다. 지역명을 붙여 줄여 보지만 완전하지 않다.
 * - 그래서 절대값을 쓰지 않고 **공고 안 상대 순위**로만 쓴다.
 */

/**
 * NAVER API HUB(네이버 클라우드 플랫폼) 엔드포인트.
 *
 * 구 개발자센터(openapi.naver.com)는 **2026-07-31부로 신규 신청이 막혔고** 2027-06-30에
 * 완전히 종료된다. 지금 새로 키를 받으려면 NCP 경로밖에 없어서 처음부터 이쪽으로 짰다.
 * 인증 헤더도 바뀌었다: X-Naver-Client-Id/Secret → X-NCP-APIGW-API-KEY-ID/KEY.
 */
const HUB_BASE = "https://naverapihub.apigw.ntruss.com";
const BLOG_ENDPOINT = `${HUB_BASE}/search/v1/blog`;
const CAFE_ENDPOINT = `${HUB_BASE}/search/v1/cafearticle`;

export class NaverCredentialsMissingError extends Error {
  constructor() {
    super(
      "네이버 API HUB 키가 없어요. NCP 콘솔에서 발급받아 .env.local에 " +
        "NAVER_API_KEY_ID / NAVER_API_KEY를 넣어주세요.",
    );
    this.name = "NaverCredentialsMissingError";
  }
}

export interface PopularityResult {
  query: string;
  blogCount: number;
  cafeCount: number;
  totalCount: number;
  note?: string;
}

/**
 * 검색어를 만든다. 단지명만으로는 동명 단지가 섞이므로 지역을 앞에 붙인다.
 *
 * 주소에서 "시/군/구"까지만 쓴다 — 읍·면·동까지 넣으면 너무 좁아서 글이 0건이 되기 쉽다.
 * 단지명에 이미 지역이 들어 있으면(예: "경주안강장미마을") 중복을 피한다.
 */
export function buildQuery(unitName: string, address: string | undefined): string {
  const name = unitName.trim();
  if (!address) return name;

  // "전북특별자치도 군산시 경촌1길 56" → "군산시"
  const cityMatch = address.match(/([가-힣]+(?:시|군|구))(?:\s|$)/);
  const city = cityMatch?.[1];
  if (!city) return name;

  // 단지명이 이미 그 지역을 포함하면 붙이지 않는다("경주안강장미마을"에 "경주시"를 또 붙이지 않게).
  // 광역시는 "대구광역시" → "대구"까지 줄여서 본다("대구혁신10"에 "대구광역시"를 붙이지 않게).
  const cityCore = city.replace(/(특별자치시|특별자치도|광역시|특별시|시|군|구)$/, "");
  if (cityCore && name.includes(cityCore)) return name;

  return `${city} ${name}`;
}

async function searchCount(
  endpoint: string,
  query: string,
  keyId: string,
  key: string,
): Promise<number> {
  const url = `${endpoint}?query=${encodeURIComponent(query)}&display=1`;
  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": keyId,
      "X-NCP-APIGW-API-KEY": key,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`네이버 검색 실패 (${res.status}): ${body.slice(0, 200)}`);
  }

  /**
   * 이관 후 응답 구조가 "대체로 유지"라고만 안내돼 있어서, total의 위치를 단정하지 않는다.
   * 최상위에 없으면 한 겹 감싼 형태(예: { result: { total } })도 살펴본다.
   * 그래도 못 찾으면 0이 아니라 에러를 낸다 — 0으로 조용히 넘어가면 모든 단지가 0건이 되어
   * "인기도 차이 없음"으로 보이고, 원인을 찾기 어려워진다.
   */
  const json = (await res.json()) as Record<string, unknown>;
  const total = findTotal(json);
  if (total === null) {
    throw new Error(`응답에서 total을 못 찾았어요: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return total;
}

/** 최상위 또는 한 겹 안쪽에서 total 숫자를 찾는다 */
function findTotal(json: Record<string, unknown>): number | null {
  if (typeof json.total === "number") return json.total;
  for (const v of Object.values(json)) {
    if (v && typeof v === "object" && typeof (v as { total?: unknown }).total === "number") {
      return (v as { total: number }).total;
    }
  }
  return null;
}

/**
 * 단지 하나의 인기도를 조회한다. 블로그·카페를 각각 부르므로 호출 2회를 쓴다.
 * 네트워크 오류는 그대로 던진다 — 호출한 쪽에서 재시도·기록을 정한다.
 */
export async function fetchPopularity(
  unitName: string,
  address: string | undefined,
): Promise<PopularityResult> {
  const keyId = process.env.NAVER_API_KEY_ID;
  const key = process.env.NAVER_API_KEY;
  if (!keyId || !key) throw new NaverCredentialsMissingError();

  const query = buildQuery(unitName, address);

  const [blogCount, cafeCount] = await Promise.all([
    searchCount(BLOG_ENDPOINT, query, keyId, key),
    searchCount(CAFE_ENDPOINT, query, keyId, key),
  ]);

  const totalCount = blogCount + cafeCount;
  return {
    query,
    blogCount,
    cafeCount,
    totalCount,
    note: totalCount === 0 ? "검색 결과 없음(신축이거나 이름이 달라 안 잡힐 수 있어요)" : undefined,
  };
}

/**
 * 같은 공고 안의 집들끼리 인기도를 0~1로 정규화한다.
 *
 * 절대 글 수를 그대로 쓰면 지역 규모에 좌우된다(서울 단지는 무조건 많다). 여기서 비교하는
 * 건 **같은 공고 안의 집들**이므로, 그 집합 안에서의 상대 위치만 의미가 있다.
 *
 * 로그를 씌우는 이유: 글 수는 편차가 극단적이다(0건 vs 5000건). 선형으로 두면 1등 하나가
 * 나머지를 전부 0으로 눌러 버려 순서가 사라진다.
 */
export function normalizePopularity(counts: number[]): number[] {
  if (counts.length === 0) return [];
  const logs = counts.map((c) => Math.log10(c + 1));
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  // 전부 같으면(예: 모두 0건) 구분할 근거가 없으므로 중립값을 준다.
  if (max - min < 0.0001) return counts.map(() => 0.5);
  return logs.map((v) => (v - min) / (max - min));
}
