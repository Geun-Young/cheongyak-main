/**
 * 청약홈(한국부동산원) APT 분양정보 수집기 — project.md 32번.
 * https://www.data.go.kr/data/15098547/openapi.do (Swagger: infuser.odcloud.kr/api/stages/37000/api-docs)
 *
 * "분양정보 상세" = 공고, "주택형별 상세" = 유닛으로 우리 스키마와 그대로 대응한다.
 * 마이홈포털과 달리 규제지역·순위별 접수일·주택형별 특별공급 세대수·분양가가 정리된 필드로 와서
 * PDF를 읽지 않고도 민영 판정(2단계)을 할 수 있다 — 그 재료를 sale 칸에 그대로 담는다.
 *
 * 지금은 APT 분양(민영·국민·신혼희망타운)만 가져온다. 무순위·잔여세대, 오피스텔, 공공지원민간임대,
 * 임의공급은 같은 API의 다른 오퍼레이션이라 나중에 같은 방식으로 붙일 수 있다.
 */
import type { AgencyCode, DateRange, HousingType, Region, SaleInfo, SaleUnitInfo } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { formatManwon } from "@/lib/format";
import { krFetch } from "./kr-fetch";
import { simpleHash, type IngestedAnnouncement, type IngestedUnit } from "./myhome";

export const SOURCE = "applyhome" as const;
const BASE_URL = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
/** 공고일이 이 날짜 수 안쪽인 것만 본다. 분양은 공고 뒤 2주 안팎에 접수하므로 넉넉하다 */
const LOOKBACK_DAYS = 60;

interface AptDetail {
  HOUSE_MANAGE_NO: string;
  PBLANC_NO: string;
  HOUSE_NM: string;
  HOUSE_SECD: string; // 01 APT, 09 민간사전청약, 10 신혼희망타운
  HOUSE_SECD_NM?: string;
  HOUSE_DTL_SECD?: string; // 01 민영, 03 국민
  HOUSE_DTL_SECD_NM?: string;
  SUBSCRPT_AREA_CODE_NM?: string;
  HSSPLY_ADRES?: string;
  TOT_SUPLY_HSHLDCO?: number;
  RCRIT_PBLANC_DE: string;
  RCEPT_BGNDE?: string;
  RCEPT_ENDDE?: string;
  SPSPLY_RCEPT_BGNDE?: string;
  SPSPLY_RCEPT_ENDDE?: string;
  GNRL_RNK1_CRSPAREA_RCPTDE?: string;
  GNRL_RNK1_CRSPAREA_ENDDE?: string;
  GNRL_RNK1_ETC_AREA_RCPTDE?: string;
  GNRL_RNK1_ETC_AREA_ENDDE?: string;
  GNRL_RNK2_CRSPAREA_RCPTDE?: string;
  GNRL_RNK2_CRSPAREA_ENDDE?: string;
  GNRL_RNK2_ETC_AREA_RCPTDE?: string;
  GNRL_RNK2_ETC_AREA_ENDDE?: string;
  PRZWNER_PRESNATN_DE?: string;
  CNTRCT_CNCLS_BGNDE?: string;
  CNTRCT_CNCLS_ENDDE?: string;
  CNSTRCT_ENTRPS_NM?: string;
  BSNS_MBY_NM?: string;
  MVN_PREARNGE_YM?: string;
  SPECLT_RDN_EARTH_AT?: string;
  MDAT_TRGET_AREA_SECD?: string;
  PARCPRC_ULS_AT?: string;
  PBLANC_URL?: string;
}

interface AptModel {
  MODEL_NO: string;
  HOUSE_TY: string; // "084.9800A"
  SUPLY_AR?: string;
  SUPLY_HSHLDCO?: number;
  SPSPLY_HSHLDCO?: number;
  MNYCH_HSHLDCO?: number;
  NWWDS_HSHLDCO?: number;
  LFE_FRST_HSHLDCO?: number;
  OLD_PARNTS_SUPORT_HSHLDCO?: number;
  INSTT_RECOMEND_HSHLDCO?: number;
  ETC_HSHLDCO?: number;
  TRANSR_INSTT_ENFSN_HSHLDCO?: number;
  YGMN_HSHLDCO?: number;
  NWBB_HSHLDCO?: number;
  LTTOT_TOP_AMOUNT?: string | number;
}

interface OdcloudPage<T> {
  matchCount?: number;
  currentCount?: number;
  data?: T[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getPage<T>(operation: string, apiKey: string, cond: Record<string, string>, page: number): Promise<OdcloudPage<T>> {
  const u = new URL(`${BASE_URL}/${operation}`);
  u.searchParams.set("page", String(page));
  u.searchParams.set("perPage", "500");
  u.searchParams.set("returnType", "JSON");
  u.searchParams.set("serviceKey", apiKey);
  for (const [k, v] of Object.entries(cond)) u.searchParams.set(k, v);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await krFetch(u.toString());
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`청약홈 API 응답 오류: ${res.status} ${body.slice(0, 120)}`);
      }
      return (await res.json()) as OdcloudPage<T>;
    } catch (e) {
      lastError = e;
      if (attempt < 4) await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

/** 조건에 맞는 행 전부(페이지를 넘겨 가며) */
async function getAll<T>(operation: string, apiKey: string, cond: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 20; page++) {
    const p = await getPage<T>(operation, apiKey, cond, page);
    out.push(...(p.data ?? []));
    if (!p.data?.length || out.length >= (p.matchCount ?? 0)) break;
  }
  return out;
}

const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const kstDaysAgo = (n: number) => new Date(Date.now() + 9 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10);

const range = (start?: string, end?: string): DateRange | undefined => (start ? [start, end || start] : undefined);
const yes = (v?: string) => v === "Y";

function toRegion(name?: string): Region | null {
  if (name && (REGIONS as string[]).includes(name)) return name as Region;
  return null;
}

/** 사업주체(시행사)로 기관을 정한다. 공공기관이 아니면 민간 */
function toAgency(d: AptDetail): { code: AgencyCode; name: string } {
  const n = d.BSNS_MBY_NM ?? "";
  if (/LH|한국토지주택/.test(n)) return { code: "LH", name: "LH 한국토지주택공사" };
  if (/SH|서울주택도시/.test(n)) return { code: "SH", name: "SH 서울주택도시공사" };
  if (/GH|경기주택도시/.test(n)) return { code: "GH", name: "GH 경기주택도시공사" };
  if (/iH|인천도시공사/.test(n)) return { code: "IH", name: "iH 인천도시공사" };
  if (/부산도시공사/.test(n)) return { code: "BMC", name: "부산도시공사" };
  // 민영은 시행사가 대개 신탁사("○○자산신탁")라 사용자가 알아보는 시공사(브랜드)를 이름으로 쓴다. 시행사는 sale.developer에 남는다
  if (d.HOUSE_DTL_SECD === "03") return { code: "UNKNOWN", name: n || "사업주체 미상" };
  return { code: "PRIVATE", name: d.CNSTRCT_ENTRPS_NM || n || "사업주체 미상" };
}

function toHousingType(d: AptDetail): HousingType {
  if (d.HOUSE_SECD === "10") return "신혼희망타운";
  return d.HOUSE_DTL_SECD === "03" ? "공공분양" : "민영분양";
}

/** "충청남도 천안시 서북구 부대동 …" → "천안시 서북구" */
function toDistrict(address?: string): string {
  const t = (address ?? "").split(/\s+/).filter(Boolean);
  if (t.length < 2) return "";
  return /시$/.test(t[1]) && t[2] && /구$/.test(t[2]) ? `${t[1]} ${t[2]}` : t[1];
}

/** "084.9800A" → { area: 84.98, label: "84.98㎡ A" } */
function parseHouseType(ty: string): { area: number | null; label: string } {
  const m = ty.match(/^0*(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return { area: null, label: ty };
  const area = Math.round(Number(m[1]) * 100) / 100;
  const suffix = m[2].trim();
  return { area, label: `${area}㎡${suffix ? ` ${suffix}` : ""}` };
}

/** "10.12 (월)" 같은 짧은 날짜 */
function md(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const w = "일월화수목금토"[new Date(y, m - 1, d).getDay()];
  return `${m}.${d}(${w})`;
}

function toSale(d: AptDetail): SaleInfo {
  return {
    kind: d.HOUSE_DTL_SECD === "03" || d.HOUSE_SECD === "10" ? "국민" : "민영",
    regulation: { speculative: yes(d.SPECLT_RDN_EARTH_AT), adjusted: yes(d.MDAT_TRGET_AREA_SECD), priceCap: yes(d.PARCPRC_ULS_AT) },
    schedule: {
      special: range(d.SPSPLY_RCEPT_BGNDE, d.SPSPLY_RCEPT_ENDDE),
      rank1Local: range(d.GNRL_RNK1_CRSPAREA_RCPTDE, d.GNRL_RNK1_CRSPAREA_ENDDE),
      rank1Other: range(d.GNRL_RNK1_ETC_AREA_RCPTDE, d.GNRL_RNK1_ETC_AREA_ENDDE),
      rank2Local: range(d.GNRL_RNK2_CRSPAREA_RCPTDE, d.GNRL_RNK2_CRSPAREA_ENDDE),
      rank2Other: range(d.GNRL_RNK2_ETC_AREA_RCPTDE, d.GNRL_RNK2_ETC_AREA_ENDDE),
      winners: d.PRZWNER_PRESNATN_DE || undefined,
      contract: range(d.CNTRCT_CNCLS_BGNDE, d.CNTRCT_CNCLS_ENDDE),
    },
    developer: d.BSNS_MBY_NM || undefined,
    builder: d.CNSTRCT_ENTRPS_NM || undefined,
  };
}

const n = (v?: number | string) => Number(v) || 0;

function toSaleUnit(m: AptModel): SaleUnitInfo {
  const price = Number(String(m.LTTOT_TOP_AMOUNT ?? "").replace(/,/g, ""));
  return {
    areaM2: parseHouseType(m.HOUSE_TY).area,
    general: n(m.SUPLY_HSHLDCO),
    special: n(m.SPSPLY_HSHLDCO),
    specialBreakdown: Object.fromEntries(
      (
        [
          ["newlywed", m.NWWDS_HSHLDCO],
          ["firstHome", m.LFE_FRST_HSHLDCO],
          ["multiChild", m.MNYCH_HSHLDCO],
          ["elderlyParent", m.OLD_PARNTS_SUPORT_HSHLDCO],
          ["newborn", m.NWBB_HSHLDCO],
          ["youth", m.YGMN_HSHLDCO],
          ["institution", m.INSTT_RECOMEND_HSHLDCO],
          ["relocation", m.TRANSR_INSTT_ENFSN_HSHLDCO],
          ["other", m.ETC_HSHLDCO],
        ] as const
      ).filter(([, v]) => n(v) > 0).map(([k, v]) => [k, n(v)]),
    ),
    priceTop: Number.isFinite(price) && price > 0 ? price : null,
  };
}

const SPECIAL_LABEL: Record<keyof SaleUnitInfo["specialBreakdown"], string> = {
  newlywed: "신혼부부",
  firstHome: "생애최초",
  multiChild: "다자녀",
  elderlyParent: "노부모",
  newborn: "신생아",
  youth: "청년",
  institution: "기관추천",
  relocation: "이전기관",
  other: "기타",
};

/** 주택형 한 줄: "분양가 최고 5억 7,020만 원 · 일반 16세대 · 특별공급 21세대(신혼부부 5 · 생애최초 3 …)" */
function unitNote(s: SaleUnitInfo): string {
  const parts: string[] = [];
  if (s.priceTop) parts.push(`분양가 최고 ${formatManwon(s.priceTop)}`);
  parts.push(`일반 ${s.general}세대`);
  if (s.special > 0) {
    const detail = Object.entries(s.specialBreakdown)
      .map(([k, v]) => `${SPECIAL_LABEL[k as keyof typeof SPECIAL_LABEL]} ${v}`)
      .join(" · ");
    parts.push(`특별공급 ${s.special}세대${detail ? `(${detail})` : ""}`);
  }
  return parts.join(" · ");
}

/** 수집기가 소스 필드로 조립하는 자동 요약(LLM 없음) */
function buildAutoSummary(d: AptDetail, sale: SaleInfo, units: SaleUnitInfo[], kindLabel: string, region: Region | null): string[] {
  const out: string[] = [];
  const general = units.reduce((s, u) => s + u.general, 0);
  const special = units.reduce((s, u) => s + u.special, 0);
  out.push(`${kindLabel} ${n(d.TOT_SUPLY_HSHLDCO) || general + special}세대를 분양해요(특별공급 ${special} · 일반공급 ${general}).`);
  const s = sale.schedule;
  const steps = [
    s.special && `특별공급 ${md(s.special[0])}`,
    s.rank1Local && `1순위 ${md(s.rank1Local[0])}`,
    s.rank2Local && `2순위 ${md(s.rank2Local[0])}`,
  ].filter(Boolean);
  if (steps.length) out.push(`${steps.join(" → ")} 순서로 접수해요${s.winners ? `. 당첨자 발표는 ${md(s.winners)}이에요` : ""}.`);
  const prices = units.map((u) => u.priceTop).filter((p): p is number => p !== null).sort((a, b) => a - b);
  if (prices.length) {
    out.push(
      prices[0] === prices[prices.length - 1]
        ? `분양가는 최고 ${formatManwon(prices[0])}이에요.`
        : `분양가는 주택형별 최고 ${formatManwon(prices[0])}~${formatManwon(prices[prices.length - 1])}이에요.`,
    );
  }
  const r = sale.regulation;
  if (r.speculative || r.adjusted) {
    out.push(`${r.speculative ? "투기과열지구" : "조정대상지역"}라 1순위 요건(가입 2년, 세대주, 5년 내 당첨 없음 등)이 더 엄격해요.`);
  } else if (sale.kind === "민영" && region) {
    // 국민주택(공공분양·신혼희망타운)은 납입 횟수까지 보는 등 규칙이 달라 여기서 말하지 않는다
    const capital = region === "서울" || region === "경기" || region === "인천";
    out.push(`규제지역이 아니에요. 1순위는 청약통장 가입 ${capital ? "1년" : "6개월"}과 지역별 예치금을 채우면 돼요.`);
  }
  if (d.MVN_PREARNGE_YM && /^\d{6}$/.test(d.MVN_PREARNGE_YM)) {
    out.push(`입주 예정은 ${d.MVN_PREARNGE_YM.slice(0, 4)}년 ${Number(d.MVN_PREARNGE_YM.slice(4))}월이에요.`);
  }
  return out;
}

function toAnnouncement(d: AptDetail, models: AptModel[]): IngestedAnnouncement {
  const id = `${SOURCE}-${d.PBLANC_NO}`;
  const housingType = toHousingType(d);
  const sale = toSale(d);
  const saleUnits = models.map(toSaleUnit);
  const moveIn = d.MVN_PREARNGE_YM && /^\d{6}$/.test(d.MVN_PREARNGE_YM) ? `${d.MVN_PREARNGE_YM.slice(0, 4)}년 ${Number(d.MVN_PREARNGE_YM.slice(4))}월` : undefined;
  const rankingMethod = sale.kind === "국민" && housingType === "공공분양" ? "저축액순" : "순위+가점";
  const kindLabel = housingType === "민영분양" ? "민영 아파트" : housingType;

  const supplyUnits: IngestedUnit[] = models.map((m, i) => {
    const s = saleUnits[i];
    return {
      id: `${id}-m${m.MODEL_NO}`,
      name: `전용 ${parseHouseType(m.HOUSE_TY).label}`,
      housingType,
      rankingMethod,
      unitsCount: s.general + s.special,
      address: d.HSSPLY_ADRES || undefined,
      rentNote: unitNote(s),
      moveIn,
      eligibility: [],
      tiers: [],
      scoreRules: [],
      active: true,
      sale: s,
      sourceHash: simpleHash(JSON.stringify(m)),
    };
  });

  const applyStart = d.SPSPLY_RCEPT_BGNDE || d.RCEPT_BGNDE || d.GNRL_RNK1_CRSPAREA_RCPTDE || d.RCRIT_PBLANC_DE;
  const applyEnd = d.RCEPT_ENDDE || d.GNRL_RNK2_ETC_AREA_ENDDE || d.GNRL_RNK2_CRSPAREA_ENDDE || applyStart;

  return {
    id,
    title: d.HOUSE_NM,
    agency: toAgency(d),
    housingType,
    region: toRegion(d.SUBSCRPT_AREA_CODE_NM),
    district: toDistrict(d.HSSPLY_ADRES),
    units: n(d.TOT_SUPLY_HSHLDCO) || supplyUnits.reduce((s, u) => s + u.unitsCount, 0),
    summary: null,
    autoSummary: buildAutoSummary(d, sale, saleUnits, kindLabel, toRegion(d.SUBSCRPT_AREA_CODE_NM)),
    announcedAt: d.RCRIT_PBLANC_DE,
    applyStart,
    applyEnd,
    originalUrl: d.PBLANC_URL || "https://www.applyhome.co.kr",
    originalUrlKind: d.PBLANC_URL ? "notice" : "home",
    rankingMethod,
    // 1단계: 조건은 아직 없다(판정은 "확인 필요"). 2단계에서 청약 규칙으로 채운다
    status: "published",
    reviewStatus: "pending",
    supplyUnits,
    source: SOURCE,
    sourceId: d.PBLANC_NO,
    sale,
    sourceHash: simpleHash(JSON.stringify({ d, models })),
  };
}

/**
 * 접수가 끝나지 않은 APT 분양 공고를 가져온다(공고일 60일 안쪽 → 접수 종료일이 오늘 이후).
 * 주택형은 공고마다 한 번씩 더 부른다(하루 몇 건이라 호출량이 작다).
 */
export async function fetchApplyhomeAnnouncements(apiKey: string): Promise<IngestedAnnouncement[]> {
  const today = kstToday();
  const details = await getAll<AptDetail>("getAPTLttotPblancDetail", apiKey, {
    "cond[RCRIT_PBLANC_DE::GTE]": kstDaysAgo(LOOKBACK_DAYS),
  });
  const open = details.filter((d) => (d.RCEPT_ENDDE || d.GNRL_RNK2_CRSPAREA_ENDDE || "") >= today);

  const out: IngestedAnnouncement[] = [];
  for (const d of open) {
    const models = await getAll<AptModel>("getAPTLttotPblancMdl", apiKey, {
      "cond[HOUSE_MANAGE_NO::EQ]": d.HOUSE_MANAGE_NO,
      "cond[PBLANC_NO::EQ]": d.PBLANC_NO,
    });
    out.push(toAnnouncement(d, models));
    await sleep(300);
  }
  return out;
}
