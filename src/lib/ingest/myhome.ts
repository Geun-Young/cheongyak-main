/**
 * 마이홈포털 "공공주택 모집공고 조회 서비스" 연동.
 * https://www.data.go.kr/data/15108420/openapi.do
 * 엔드포인트: apis.data.go.kr/1613000/HWSPR02/{rsdtRcritNtcList|ltRsdtRcritNtcList}
 *
 * 설계: 청약순위계산기_공고자동수집_설계서.md
 * - 이 API는 자격요건을 안 준다. 대신 "공개 여부"와 "판정 가능 여부"를 분리해서,
 *   수집된 공고는 published+pending으로 즉시 노출하고 조건만 "확인 필요"로 비워둔다.
 * - 같은 pblancId(공고번호) 안에 houseSn(단지 일련번호)이 여러 개면 그게 곧 SupplyUnit.
 * - 매입임대(다가구주택)는 houseSn이 전부 0이고 이름·주소가 비어 있어, 면적·보증금·월세·주소
 *   해시로 같은 물건을 묶는다(그룹핑 규칙은 설계서 5-2, 결정 항목 5번 채택).
 * - 재수집 시 관리자가 이미 정리한 칸(status/reviewStatus/summary/eligibility 등)은
 *   절대 덮어쓰지 않는다 — 이 모듈은 "소스 소유 칸"에 해당하는 값만 만들어 반환하고,
 *   실제 upsert 시 어떤 컬럼을 덮어쓸지는 scripts/ingest-myhome.ts가 명시적으로 정한다.
 */
import type { Announcement, AgencyCode, HousingType, Region, SupplyUnit } from "@/lib/types";

const BASE_URL = "https://apis.data.go.kr/1613000/HWSPR02";
export const SOURCE = "myhome" as const;

interface MyHomeItem {
  pblancId: string;
  houseSn: number;
  sttusNm: string;
  pblancNm: string;
  suplyInsttNm: string;
  houseTyNm: string;
  suplyTyNm: string;
  rcritPblancDe: string;
  przwnerPresnatnDe?: string;
  suplyHoCo?: string;
  refrnc?: string;
  url: string;
  pcUrl: string;
  mobileUrl: string;
  hsmpNm: string;
  brtcNm: string;
  signguNm: string;
  fullAdres: string;
  totHshldCo?: number;
  sumSuplyCo?: number;
  rentGtn?: number;
  enty?: number;
  prtpay?: number;
  surlus?: number;
  mtRntchrg?: number;
  beginDe: string;
  endDe: string;
}

interface MyHomeResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: { totalCount: string; numOfRows: string; pageNo: string; item?: MyHomeItem[] };
  };
}

/** "20260904" -> "2026-09-04" */
function toIsoDate(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

const BRTC_TO_REGION: Record<string, Region> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  강원도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라북도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

/** 매핑 실패 시 "전국"으로 뭉개지 않는다 — 모두에게 잘못 노출되는 것보다 null로 큐에 남기는 게 낫다(설계서 5-2) */
function toRegion(brtcNm: string): Region | null {
  return BRTC_TO_REGION[brtcNm] ?? null;
}

/** 공급기관명 텍스트에서 코드를 추정한다. 매핑 실패 시 UNKNOWN으로 두고 관리자 큐로 보낸다(PRIVATE으로 단정하지 않는다) */
function toAgencyCode(suplyInsttNm: string): AgencyCode {
  if (suplyInsttNm.includes("LH")) return "LH";
  if (suplyInsttNm.includes("SH")) return "SH";
  if (suplyInsttNm.includes("GH") || suplyInsttNm.includes("경기주택")) return "GH";
  if (suplyInsttNm.includes("iH") || suplyInsttNm.includes("인천도시")) return "IH";
  if (suplyInsttNm.includes("부산도시")) return "BMC";
  return "UNKNOWN";
}

/**
 * 공급유형 텍스트 -> HousingType. 영구임대·50년임대·통합공공임대는 국민임대로 뭉개지 않고
 * 별도 유형으로 세분화한다(설계서 결정 항목 3번 채택) — 사용자에게 실제와 다른 유형을
 * 보여주면 신뢰가 깨진다는 게 이유.
 */
const SUPLY_TY_TO_HOUSING_TYPE: Record<string, HousingType> = {
  영구임대: "영구임대",
  국민임대: "국민임대",
  "50년임대": "50년임대",
  매입임대: "매입임대",
  "10년임대": "매입임대",
  "6년임대": "매입임대",
  "5년임대": "매입임대",
  장기전세: "장기전세",
  전세임대: "전세임대",
  행복주택: "행복주택",
  공공지원민간임대: "공공지원민간임대",
  통합공공임대: "통합공공임대",
};

function toHousingType(suplyTyNm: string): HousingType {
  return SUPLY_TY_TO_HOUSING_TYPE[suplyTyNm] ?? "국민임대";
}

function buildRentNote(item: MyHomeItem): string | undefined {
  const parts: string[] = [];
  if (item.rentGtn) parts.push(`보증금 ${item.rentGtn.toLocaleString("ko-KR")}원`);
  if (item.mtRntchrg) parts.push(`월 ${item.mtRntchrg.toLocaleString("ko-KR")}원`);
  if (item.enty) parts.push(`입주금 ${item.enty.toLocaleString("ko-KR")}원`);
  return parts.length > 0 ? parts.join(" / ") : undefined;
}

/** 유닛 하나가 소스에서 실제로 바뀌었는지 판단하는 해시. 이름 없는 필드 조합이라 순서 고정 */
function hashUnitFields(item: MyHomeItem): string {
  const raw = [
    item.hsmpNm,
    item.fullAdres,
    item.sumSuplyCo,
    item.totHshldCo,
    item.rentGtn,
    item.mtRntchrg,
    item.enty,
    item.suplyTyNm,
  ].join("|");
  return simpleHash(raw);
}

/** 암호학적 강도가 필요 없는 변경 감지용 해시(FNV-1a 계열) — 외부 패키지 없이 충분하다 */
function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export interface IngestedUnit extends SupplyUnit {
  sourceHash: string;
}

export interface IngestedAnnouncement extends Omit<Announcement, "supplyUnits"> {
  supplyUnits: IngestedUnit[];
  sourceHash: string;
}

/**
 * houseSn이 유닛을 구분해 주는 일반 케이스.
 */
function toUnitByHouseSn(item: MyHomeItem, indexInGroup: number, pblancId: string): IngestedUnit {
  return {
    id: `${SOURCE}-${pblancId}-hs${item.houseSn}`,
    name: item.hsmpNm || `${item.houseTyNm} (${item.suplyTyNm}) ${indexInGroup + 1}호`,
    housingType: toHousingType(item.suplyTyNm),
    rankingMethod: "순위+가점",
    unitsCount: Number(item.sumSuplyCo) || Number(item.totHshldCo) || 0,
    address: item.fullAdres || undefined,
    rentNote: buildRentNote(item),
    moveIn: undefined,
    summary: undefined,
    eligibility: [],
    tiers: [],
    scoreRules: [],
    active: true,
    sourceHash: hashUnitFields(item),
  };
}

/**
 * houseSn이 전부 0이라 유닛을 구분 못 하는 케이스(매입임대 다가구주택 등).
 * 면적·보증금·월세·주소가 같은 항목끼리 하나의 유닛으로 묶고 세대수를 합산한다
 * (설계서 5-2, 결정 항목 5번). 그룹 키가 곧 유닛 id의 일부가 되어, 재수집 때 배열
 * 순서가 바뀌어도 같은 물건이면 같은 id를 유지한다.
 */
function toUnitsByFieldGroup(items: MyHomeItem[], pblancId: string): IngestedUnit[] {
  const groups = new Map<string, MyHomeItem[]>();
  for (const item of items) {
    const key = simpleHash(
      [item.fullAdres, item.rentGtn, item.mtRntchrg, item.enty, item.houseTyNm, item.suplyTyNm].join("|"),
    );
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([groupKey, group]) => {
    const first = group[0];
    const totalHouseholds = group.reduce(
      (s, it) => s + (Number(it.sumSuplyCo) || Number(it.totHshldCo) || 0),
      0,
    );
    return {
      id: `${SOURCE}-${pblancId}-grp${groupKey}`,
      name: first.hsmpNm || `${first.houseTyNm} (${first.suplyTyNm})`,
      housingType: toHousingType(first.suplyTyNm),
      rankingMethod: "순위+가점",
      unitsCount: totalHouseholds,
      address: first.fullAdres || undefined,
      rentNote: buildRentNote(first),
      moveIn: undefined,
      summary: group.length > 1 ? [`같은 조건의 물건 ${group.length}건을 하나로 묶었어요.`] : undefined,
      eligibility: [],
      tiers: [],
      scoreRules: [],
      active: true,
      sourceHash: simpleHash(group.map(hashUnitFields).sort().join(",")),
    };
  });
}

/** 결정적 자동 요약(LLM 없이, 소스 필드로 3~4문장 조립). 설계서 5-3 */
function buildAutoSummary(a: {
  agencyName: string;
  region: string | null;
  district: string;
  housingType: HousingType;
  totalUnits: number;
  applyStart: string;
  applyEnd: string;
  units: IngestedUnit[];
}): string[] {
  const lines: string[] = [];

  const regionPart = a.region ? `${a.region} ${a.district}` : a.district || "지역 확인 중";
  lines.push(`${a.agencyName}이(가) ${regionPart}에 공급하는 ${a.housingType} ${a.totalUnits.toLocaleString("ko-KR")}세대예요.`);

  const start = a.applyStart.slice(5).replace("-", "월 ") + "일";
  const end = a.applyEnd.slice(5).replace("-", "월 ") + "일";
  lines.push(`접수는 ${start}부터 ${end}까지예요.`);

  if (a.units.length > 1) {
    const names = a.units.map((u) => u.name).filter(Boolean).slice(0, 3);
    if (names.length > 0) {
      lines.push(`${a.units.length}개 타입이에요: ${names.join(", ")}${a.units.length > 3 ? " 외" : ""}.`);
    }
  }

  lines.push("자격 조건은 아직 정리 중이에요. 원문 공고문에서 소득·자산 기준을 확인하세요.");

  return lines;
}

function toIngestedAnnouncement(pblancId: string, group: MyHomeItem[]): IngestedAnnouncement {
  const first = group[0];
  const allHouseSnZero = group.every((it) => it.houseSn === 0);
  const supplyUnits = allHouseSnZero
    ? toUnitsByFieldGroup(group, pblancId)
    : group.map((item, i) => toUnitByHouseSn(item, i, pblancId));

  const totalUnits = supplyUnits.reduce((s, u) => s + u.unitsCount, 0);
  const region = toRegion(first.brtcNm);
  const housingType = supplyUnits[0]?.housingType ?? toHousingType(first.suplyTyNm);

  const announcementFields = {
    id: `${SOURCE}-${pblancId}`,
    title: first.pblancNm.trim(),
    agency: { code: toAgencyCode(first.suplyInsttNm), name: first.suplyInsttNm },
    housingType,
    region,
    district: `${first.brtcNm} ${first.signguNm}`.trim(),
    units: totalUnits,
    summary: null,
    announcedAt: toIsoDate(first.rcritPblancDe),
    applyStart: toIsoDate(first.beginDe),
    applyEnd: toIsoDate(first.endDe),
    originalUrl: first.pcUrl || first.url,
    originalUrlKind: "notice" as const,
    rankingMethod: "순위+가점" as const,
    reviewStatus: "pending" as const,
    status: "published" as const,
    supplyUnits,
    source: SOURCE,
    sourceId: pblancId,
    requestCount: 0,
  };

  return {
    ...announcementFields,
    autoSummary: buildAutoSummary({
      agencyName: announcementFields.agency.name,
      region,
      district: announcementFields.district,
      housingType,
      totalUnits,
      applyStart: announcementFields.applyStart,
      applyEnd: announcementFields.applyEnd,
      units: supplyUnits,
    }),
    sourceHash: simpleHash(supplyUnits.map((u) => u.sourceHash).sort().join(",")),
  };
}

/** 같은 pblancId를 가진 항목들을 하나의 Announcement로 묶는다 */
function groupToAnnouncements(items: MyHomeItem[]): IngestedAnnouncement[] {
  const byPblanc = new Map<string, MyHomeItem[]>();
  for (const item of items) {
    const list = byPblanc.get(item.pblancId) ?? [];
    list.push(item);
    byPblanc.set(item.pblancId, list);
  }

  return [...byPblanc.entries()].map(([pblancId, group]) => toIngestedAnnouncement(pblancId, group));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 공공데이터포털 API가 간헐적으로 504/타임아웃을 내는 걸 감안해 최대 3회 재시도한다(지수 백오프) */
async function fetchListOnce(
  operation: "rsdtRcritNtcList" | "ltRsdtRcritNtcList",
  apiKey: string,
  pageNo: number,
  numOfRows: number,
): Promise<{ items: MyHomeItem[]; totalCount: number }> {
  const url = `${BASE_URL}/${operation}?serviceKey=${encodeURIComponent(apiKey)}&pageNo=${pageNo}&numOfRows=${numOfRows}&_type=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`마이홈포털 API 응답 오류: ${res.status}`);
  const data: MyHomeResponse = await res.json();
  if (data.response.header.resultCode !== "00") {
    throw new Error(`마이홈포털 API 오류: ${data.response.header.resultMsg}`);
  }
  return {
    items: data.response.body.item ?? [],
    totalCount: Number(data.response.body.totalCount) || 0,
  };
}

async function fetchList(
  operation: "rsdtRcritNtcList" | "ltRsdtRcritNtcList",
  apiKey: string,
  pageNo: number,
  numOfRows: number,
  maxRetries = 5,
): Promise<{ items: MyHomeItem[]; totalCount: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchListOnce(operation, apiKey, pageNo, numOfRows);
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

/**
 * 공공임대(rsdtRcritNtcList) + 공공분양(ltRsdtRcritNtcList) 모집공고를 가져와
 * IngestedAnnouncement[]로 변환한다. 페이지당 최대 100건씩, 필요한 페이지 수만큼 순회한다.
 */
export async function fetchMyHomeAnnouncements(apiKey: string): Promise<IngestedAnnouncement[]> {
  const numOfRows = 50;
  const results: IngestedAnnouncement[] = [];

  for (const operation of ["rsdtRcritNtcList", "ltRsdtRcritNtcList"] as const) {
    const first = await fetchList(operation, apiKey, 1, numOfRows);
    const allItems = [...first.items];
    const totalPages = Math.ceil(first.totalCount / numOfRows);

    for (let page = 2; page <= totalPages; page++) {
      await sleep(800);
      const next = await fetchList(operation, apiKey, page, numOfRows);
      allItems.push(...next.items);
    }

    results.push(...groupToAnnouncements(allItems));
  }

  return results;
}
