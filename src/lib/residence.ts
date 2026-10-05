import type { Condition, OtherRequirement, Region } from "./types";
import { REGIONS } from "./regions";

/**
 * 공고문의 거주 조건을 우리 프로필이 아는 단위(시·도, Region)로 맞춘다(project.md 29번).
 *
 * 왜 필요한가: Gemini가 뽑은 거주 조건 값이 우리 Region과 달라서 **신청할 수 있는 사람이 전원 탈락**하고 있었다.
 * 2026-10-05 기준 판정되는 접수 중 공고 111건 중 36건(32%)에 이런 조건이 있었다.
 *   "대한민국"·"국내"·"전국"   → 사는 곳이 "대한민국"인가로 비교해 누구도 통과 못 함
 *   "인천광역시"·"경상남도"     → 우리 표기는 "인천"·"경남"
 *   "군산"·"익산시"·"정선군"    → 우리 프로필은 사는 곳을 시·도까지만 받는다
 *
 * 자격 조건(eligibility)은 시·도로 넓혀 판정하고, 시·군 요건은 "직접 확인할 조건"으로 따로 보여 준다 —
 * 확인 못 하는 걸 탈락으로 처리하면 기회를 놓치게 하는 쪽으로 틀리기 때문이다.
 * 순위 조건(tier)은 시·도로 넓히면 1순위를 과하게 주게 되므로 시·군 단위는 그대로 둔다(보수적).
 */

const NATIONWIDE = /^(대한민국|국내|전국|한국|전국\s*\(.*\))$/;

/** 시·도 정식 이름·옛 이름 → Region */
const PROVINCES: Record<string, Region> = {
  서울특별시: "서울", 서울시: "서울",
  부산광역시: "부산", 부산시: "부산",
  대구광역시: "대구", 대구시: "대구",
  인천광역시: "인천", 인천시: "인천",
  광주광역시: "광주",
  대전광역시: "대전", 대전시: "대전",
  울산광역시: "울산", 울산시: "울산",
  세종특별자치시: "세종", 세종시: "세종",
  경기도: "경기",
  강원도: "강원", 강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북", 전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주", 제주도: "제주",
};

/**
 * 시·군(끝의 "시"·"군"을 뗀 이름) → 시·도. 같은 이름이 두 곳에 있는 고성(강원·경남)과
 * 광주시(경기, 광주광역시와 헷갈림)는 넣지 않는다 — 앞에 시·도가 붙어 있을 때만 알 수 있다.
 * 구(區)는 여러 광역시에 같은 이름이 있어(중구·동구·서구…) 넣지 않는다.
 */
const CITIES: Record<string, Region> = Object.fromEntries(
  (
    [
      ["경기", "수원 성남 의정부 안양 부천 광명 평택 동두천 안산 고양 과천 구리 남양주 오산 시흥 군포 의왕 하남 용인 파주 이천 안성 김포 화성 양주 포천 여주 연천 가평 양평"],
      ["강원", "춘천 원주 강릉 동해 태백 속초 삼척 홍천 횡성 영월 평창 정선 철원 화천 양구 인제 양양"],
      ["충북", "청주 충주 제천 보은 옥천 영동 증평 진천 괴산 음성 단양"],
      ["충남", "천안 공주 보령 아산 서산 논산 계룡 당진 금산 부여 서천 청양 홍성 예산 태안"],
      ["전북", "전주 군산 익산 정읍 남원 김제 완주 진안 무주 장수 임실 순창 고창 부안"],
      ["전남", "목포 여수 순천 나주 광양 담양 곡성 구례 고흥 보성 화순 장흥 강진 해남 영암 무안 함평 영광 장성 완도 진도 신안"],
      ["경북", "포항 경주 김천 안동 구미 영주 영천 상주 문경 경산 의성 청송 영양 영덕 청도 고령 성주 칠곡 예천 봉화 울진 울릉"],
      ["경남", "창원 진주 통영 사천 김해 밀양 거제 양산 의령 함안 창녕 남해 하동 산청 함양 거창 합천"],
      ["제주", "서귀포"],
      ["대구", "군위 달성"],
      ["인천", "강화 옹진"],
      ["부산", "기장"],
      ["울산", "울주"],
    ] as [Region, string][]
  ).flatMap(([region, names]) => names.split(" ").map((n) => [n, region])),
);

export type ResolvedResidence = "nationwide" | { regions: Region[]; precise: boolean } | null;

/** 거주 조건 값 하나를 Region으로. precise=false면 시·군 단위라 시·도까지만 맞춘 것. 모르면 null */
export function resolveResidence(raw: string): ResolvedResidence {
  const v = raw.trim().replace(/\s+/g, " ");
  if (NATIONWIDE.test(v)) return "nationwide";
  if ((REGIONS as string[]).includes(v)) return { regions: [v as Region], precise: true };

  const [head, ...rest] = v.split(" ");
  const tail = rest.join(" ");
  // 2026년 광주·전남 통합(project.md 20번): 구는 광주, 시·군은 전남
  if (head === "전남광주통합특별시") {
    if (!tail) return { regions: ["광주", "전남"], precise: true };
    return { regions: [/구$/.test(tail) ? "광주" : "전남"], precise: false };
  }
  const province = PROVINCES[head] ?? ((REGIONS as string[]).includes(head) ? (head as Region) : undefined);
  if (province) return { regions: [province], precise: tail === "" };

  if (rest.length === 0) {
    const city = CITIES[v.replace(/(시|군)$/, "")];
    if (city) return { regions: [city], precise: false };
  }
  return null;
}

export interface ResidenceFix {
  /** null이면 조건을 뺀다(전국이라 누구나 통과, 또는 확인할 수 없어 caveat로 옮김) */
  condition: Condition | null;
  /** 사용자가 직접 확인해야 하는 거주 요건 — 유닛의 otherRequirements에 더한다 */
  caveat?: OtherRequirement;
  changed: boolean;
}

const CITY_CAVEAT = "사는 곳을 시·도까지만 받고 있어서 시·군은 자동으로 확인하지 못했어요.";

/** 거주 조건 하나를 Region 기준으로 고친다. residenceRegion이 아니거나 이미 맞으면 그대로 */
export function normalizeResidenceCondition(c: Condition, mode: "eligibility" | "tier"): ResidenceFix {
  if (c.field !== "residenceRegion") return { condition: c, changed: false };
  const values = (Array.isArray(c.value) ? c.value : [c.value]).map(String);
  if (values.every((v) => (REGIONS as string[]).includes(v))) return { condition: c, changed: false };

  const resolved = values.map(resolveResidence);
  const caveat: OtherRequirement = { kind: "eligibility", label: c.label, detail: CITY_CAVEAT };

  // neq는 드물고 뜻이 애매하다 — 자격이면 확인할 조건으로 옮기고, 순위면 그대로 둔다
  if (c.operator === "neq") {
    return mode === "eligibility" ? { condition: null, caveat, changed: true } : { condition: c, changed: false };
  }
  // 전국이 하나라도 섞여 있으면 누구나 통과한다 — 조건을 뺀다(순위 조건에서도 항상 참인 조건이라 빼도 같다)
  if (resolved.includes("nationwide")) return { condition: null, changed: true };
  // 읽을 수 없는 값(구 이름, 동명 시·군 등)
  if (resolved.some((r) => r === null)) {
    return mode === "eligibility" ? { condition: null, caveat, changed: true } : { condition: c, changed: false };
  }

  const list = resolved as { regions: Region[]; precise: boolean }[];
  const regions = [...new Set(list.flatMap((r) => r.regions))];
  const cityLevel = list.some((r) => !r.precise);
  // 순위 조건의 시·군 요건을 시·도로 넓히면 1순위를 과하게 준다 — 그대로 둔다
  if (cityLevel && mode === "tier") return { condition: c, changed: false };

  const condition: Condition = {
    ...c,
    operator: regions.length === 1 ? "eq" : "in",
    value: regions.length === 1 ? regions[0] : regions,
    label: cityLevel ? `${c.label} (시·도까지만 확인)` : c.label,
  };
  return { condition, caveat: cityLevel ? caveat : undefined, changed: true };
}

/**
 * 조건 묶음(자격 또는 순위 하나)에 적용한다. 바뀐 조건 수와 직접 확인할 거주 요건을 함께 돌려준다.
 */
export function normalizeResidenceList(
  list: Condition[],
  mode: "eligibility" | "tier",
): { conditions: Condition[]; caveats: OtherRequirement[]; changed: number } {
  const conditions: Condition[] = [];
  const caveats: OtherRequirement[] = [];
  let changed = 0;
  for (const c of list) {
    const fix = normalizeResidenceCondition(c, mode);
    if (fix.changed) changed += 1;
    if (fix.condition) conditions.push(fix.condition);
    if (fix.caveat) caveats.push(fix.caveat);
  }
  return { conditions, caveats, changed };
}

/** otherRequirements에 거주 요건을 더한다(같은 문구는 한 번만) */
export function mergeCaveats(
  existing: OtherRequirement[] | undefined,
  caveats: OtherRequirement[],
): OtherRequirement[] | undefined {
  if (caveats.length === 0) return existing;
  const out = [...(existing ?? [])];
  for (const c of caveats) if (!out.some((o) => o.label === c.label)) out.push(c);
  return out;
}
