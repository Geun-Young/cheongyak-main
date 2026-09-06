/**
 * 마이홈포털 "공공주택 모집공고 조회 서비스" 연동.
 * https://www.data.go.kr/data/15108420/openapi.do
 * 엔드포인트: apis.data.go.kr/1613000/HWSPR02/{rsdtRcritNtcList|ltRsdtRcritNtcList}
 *
 * 이 API는 공고 목록만 준다 — 자격요건(소득·무주택기간 등)은 포함하지 않는다.
 * 그래서 여기서 만든 공고는 항상 reviewStatus: "pending"으로 들어가고,
 * 관리자가 조건빌더에서 자격요건을 채워야 "확인 필요" 상태를 벗어난다.
 *
 * 같은 pblancId(공고번호) 안에 houseSn(단지 일련번호)이 여러 개면 한 공고 안의
 * 서로 다른 공급유닛(SupplyUnit)이다 — 우리 스키마의 공고→유닛 계층과 그대로 대응된다.
 */
import type { Announcement, AgencyCode, HousingType, Region, SupplyUnit } from "@/lib/types";

const BASE_URL = "https://apis.data.go.kr/1613000/HWSPR02";

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

/** "경기도" -> "경기", "전남광주통합특별시" 같은 특이 케이스는 REGIONS에 없으면 원문 유지 */
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

function toRegion(brtcNm: string): Region | "전국" {
  return BRTC_TO_REGION[brtcNm] ?? "전국";
}

/** 공급기관명 텍스트에서 코드를 추정한다. 알 수 없으면 PRIVATE으로 보수적으로 처리 */
function toAgencyCode(suplyInsttNm: string): AgencyCode {
  if (suplyInsttNm.includes("LH")) return "LH";
  if (suplyInsttNm.includes("SH")) return "SH";
  if (suplyInsttNm.includes("GH") || suplyInsttNm.includes("경기주택")) return "GH";
  if (suplyInsttNm.includes("iH") || suplyInsttNm.includes("인천도시")) return "IH";
  if (suplyInsttNm.includes("부산도시")) return "BMC";
  return "PRIVATE";
}

/**
 * 공급유형 텍스트 -> HousingType. API의 공급유형 코드표(영구임대·50년임대·10년임대·6년임대·
 * 5년임대·통합공공임대 등)가 우리 enum보다 세분화되어 있어 가장 가까운 값으로 근사 매핑한다.
 * 원문 표기는 유닛 이름에 그대로 남겨 정보 손실을 보완한다.
 */
const SUPLY_TY_TO_HOUSING_TYPE: Record<string, HousingType> = {
  영구임대: "국민임대",
  국민임대: "국민임대",
  "50년임대": "국민임대",
  매입임대: "매입임대",
  "10년임대": "매입임대",
  "6년임대": "매입임대",
  "5년임대": "매입임대",
  장기전세: "장기전세",
  전세임대: "전세임대",
  행복주택: "행복주택",
  공공지원민간임대: "공공지원민간임대",
  통합공공임대: "국민임대",
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

const SOURCE_PREFIX = "myhome";

function toUnit(item: MyHomeItem, indexInGroup: number): SupplyUnit {
  // houseSn만으로는 유닛을 구분 못 하는 공고가 있다(예: 매입임대 다가구주택은
  // houseSn이 전부 0이고 이름·주소도 비어 있음 — 물건별로 비식별화된 것으로 보인다).
  // 그런 경우를 대비해 그룹 내 순번을 id에 함께 넣어 충돌을 막는다.
  return {
    id: `${SOURCE_PREFIX}-${item.pblancId}-u${item.houseSn}-${indexInGroup}`,
    name: item.hsmpNm || `${item.houseTyNm} (${item.suplyTyNm}) ${indexInGroup + 1}호`,
    housingType: toHousingType(item.suplyTyNm),
    rankingMethod: "순위+가점",
    unitsCount: Number(item.sumSuplyCo) || Number(item.totHshldCo) || 0,
    address: item.fullAdres || undefined,
    rentNote: buildRentNote(item),
    moveIn: undefined,
    summary: [`원본 공급유형: ${item.suplyTyNm}`],
    // 목록 API는 자격요건을 주지 않는다 — 관리자가 조건빌더로 채워야 한다.
    eligibility: [],
    tiers: [],
    scoreRules: [],
  };
}

/** 같은 pblancId를 가진 항목들을 하나의 Announcement로 묶는다 */
function groupToAnnouncements(items: MyHomeItem[]): Announcement[] {
  const byPblanc = new Map<string, MyHomeItem[]>();
  for (const item of items) {
    const list = byPblanc.get(item.pblancId) ?? [];
    list.push(item);
    byPblanc.set(item.pblancId, list);
  }

  const out: Announcement[] = [];
  for (const [pblancId, group] of byPblanc) {
    const first = group[0];
    const supplyUnits = group.map((item, i) => toUnit(item, i));
    out.push({
      id: `${SOURCE_PREFIX}-${pblancId}`,
      title: first.pblancNm,
      agency: { code: toAgencyCode(first.suplyInsttNm), name: first.suplyInsttNm },
      housingType: supplyUnits[0].housingType,
      region: toRegion(first.brtcNm),
      district: `${first.brtcNm} ${first.signguNm}`.trim(),
      units: supplyUnits.reduce((s, u) => s + u.unitsCount, 0),
      summary: [
        `마이홈포털에서 자동으로 가져온 공고예요. 자격요건은 아직 정리되지 않았어요.`,
        `원문: ${first.pcUrl}`,
      ],
      announcedAt: toIsoDate(first.rcritPblancDe),
      applyStart: toIsoDate(first.beginDe),
      applyEnd: toIsoDate(first.endDe),
      originalUrl: first.pcUrl || first.url,
      originalUrlKind: "notice",
      rankingMethod: "순위+가점",
      // 자격요건이 없으니 관리자 검수 전까지는 "확인 필요"로 표시된다.
      reviewStatus: "pending",
      status: "draft",
      supplyUnits,
    });
  }
  return out;
}

async function fetchList(
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

/**
 * 공공임대(rsdtRcritNtcList) + 공공분양(ltRsdtRcritNtcList) 모집공고를 가져와
 * Announcement[]로 변환한다. 페이지당 최대 100건씩, 필요한 페이지 수만큼 순회한다.
 */
export async function fetchMyHomeAnnouncements(apiKey: string): Promise<Announcement[]> {
  const numOfRows = 100;
  const results: Announcement[] = [];

  for (const operation of ["rsdtRcritNtcList", "ltRsdtRcritNtcList"] as const) {
    const first = await fetchList(operation, apiKey, 1, numOfRows);
    const allItems = [...first.items];
    const totalPages = Math.ceil(first.totalCount / numOfRows);

    for (let page = 2; page <= totalPages; page++) {
      const next = await fetchList(operation, apiKey, page, numOfRows);
      allItems.push(...next.items);
    }

    results.push(...groupToAnnouncements(allItems));
  }

  return results;
}
