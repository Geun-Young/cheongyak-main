/**
 * "이 공고의 여러 집 중에 나한테 맞는 곳은 어디인가"를 점수로 매긴다.
 *
 * 역할 구분:
 *   - matching.ts  : 자격이 되는가 (예/아니오)
 *   - 지역 필터     : 내가 살고 싶은 지역인가 (사용자가 desiredRegions로 고른다)
 *   - 이 파일       : **같은 공고 안의 여러 집 중 어디가 나에게 좋은가** (순서)
 *
 * 공고 하나에 집이 여러 개인 경우가 실제로 많다 — 경북 부도매입 공고는 집이 13개,
 * 군산 국민임대는 7개이고 **각각 주소가 다르다**. 사용자가 실제로 고민하는 건
 * "이 공고에 넣을까 말까"보다 "이 공고의 어느 단지에 넣을까"다.
 *
 * ## 점수 구성
 *
 * | 신호 | 배점 | 비고 |
 * |---|---|---|
 * | 교통 편의(지금 집·직장 대비) | 0~35 | 좌표가 있어야 계산. 없으면 중립 |
 * | 당첨 가능성(세대수·조건 여유·순위) | 0~45 | 어느 집에나 있는 신호 |
 * | 처지에 따른 외곽 보정 | ±20 | **같은 공고 안에서** 도심↔외곽을 조정 |
 *
 * ## "3순위면 외곽" 규칙
 *
 * 순위가 낮거나 조건이 빠듯한 사람은 경쟁이 몰리는 도심 단지에서 밀린다.
 * 그래서 **같은 공고 안에서** 교통이 조금 나쁘더라도 외곽 단지를 위로 올린다.
 * 반대로 여유 있는 사람에게는 교통 좋은 도심 단지를 그대로 추천한다.
 * 지역을 가로질러 비교하지 않는다 — 지역은 사용자가 이미 골랐다.
 */
import type {
  Announcement,
  Facts,
  MatchResult,
  Profile,
  Region,
  SupplyUnit,
} from "./types";

export type Competitiveness = "comfortable" | "tight" | "stretch";

/** 교통 편의 점수. 좌표가 없으면 계산할 수 없어 known: false가 된다 */
export interface TransitScore {
  /** 0(나쁨) ~ 1(좋음). known이 false면 중립 추정치다 */
  value: number;
  known: boolean;
  /** 사용자에게 보여줄 설명. 계산이 안 됐으면 null */
  label: string | null;
}

export interface UnitRecommendation {
  unitId: string;
  unit: SupplyUnit;
  /** 0~100. 같은 공고 안에서만 비교하는 상대 점수다 */
  score: number;
  headline: string;
  reasons: string[];
  competitiveness: Competitiveness;
  /** 이 집이 해당 시군구 기준 외곽인지. "3순위면 외곽" 설명에 쓴다 */
  isOutskirt: boolean;
  transit: TransitScore;
}

/** 공고 하나에 대한 추천 결과. 집이 하나뿐이면 ranked 길이도 1이다 */
export interface AnnouncementRecommendation {
  announcementId: string;
  announcement: Announcement;
  /** 점수 높은 순. 자격이 되는 집만 들어간다 */
  ranked: UnitRecommendation[];
  /** 가장 추천하는 집 */
  top: UnitRecommendation;
}

/**
 * 읍·면·리에 있으면 그 시군구 안에서 외곽으로 본다.
 * 실제 주소 188개 중 50개가 읍·면이라 이 구분이 유효하다.
 * 좌표가 생기면 시군구 중심으로부터의 거리로 대체할 수 있다.
 */
function detectOutskirt(address: string | undefined): boolean {
  if (!address) return false;
  return /(읍|면)(\s|$)/.test(address) || /\s\S+리\s/.test(address);
}

/**
 * 세대수가 많을수록 붙을 확률이 높다. 실제 분포가 1~770세대라 로그로 눌러 준다.
 * 0세대(미상)는 판단 근거가 없으므로 중립.
 */
function supplyScale(unitsCount: number): number {
  if (unitsCount <= 0) return 0.4;
  return Math.min(1, Math.log10(unitsCount + 1) / Math.log10(300));
}

interface Headroom {
  value: number;
  known: boolean;
}

/**
 * 사용자 조건이 자격 커트라인에서 얼마나 떨어져 있는지.
 * 상한 조건이 없는 유닛이 절반이 넘어서, 근거가 없을 때는 known: false로 표시한다 —
 * 이 구분을 안 하면 "근거 없음"이 "여유롭다"로 둔갑한다.
 */
function conditionHeadroom(unit: SupplyUnit, facts: Facts): Headroom {
  const ratios: number[] = [];
  for (const c of unit.eligibility) {
    if (c.operator !== "lte") continue;
    const limit = typeof c.value === "number" ? c.value : Number(c.value);
    const mine = facts[c.field];
    if (!Number.isFinite(limit) || limit <= 0 || typeof mine !== "number") continue;
    ratios.push(Math.min(1, mine / limit));
  }
  if (ratios.length === 0) return { value: 0.5, known: false };
  return { value: 1 - Math.max(...ratios), known: true };
}

/** 근거가 확인된 경우에만 "여유롭다"고 단정한다. 모르면 보수적으로 tight */
function classify(headroom: Headroom, tierRank: number | undefined): Competitiveness {
  if (tierRank !== undefined && tierRank >= 3) return "stretch";
  if (!headroom.known) return tierRank === 1 ? "comfortable" : "tight";
  if (tierRank === 1 && headroom.value >= 0.3) return "comfortable";
  if (headroom.value >= 0.45) return "comfortable";
  if (headroom.value >= 0.2) return "tight";
  return "stretch";
}

const EARTH_KM = 111;

/** 좌표 두 점 사이의 대략적인 거리(km). 정확한 경로가 아니라 순서를 매기는 용도다 */
function roughDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (a.lat - b.lat) * EARTH_KM;
  // 위도가 올라갈수록 경도 1도의 실제 거리가 줄어든다
  const dLng = (a.lng - b.lng) * EARTH_KM * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * 지금 사는 곳·직장 대비 이 집의 교통 편의.
 *
 * 지금은 좌표가 있을 때만 직선거리로 근사한다. 유닛 좌표가 아직 하나도 없어서
 * 대부분 known: false가 나오고, 그때는 점수에서 중립으로 처리된다.
 * TODO(교통): 카카오 길찾기 API를 붙이면 환승 횟수·소요시간으로 대체한다.
 */
function transitScore(unit: SupplyUnit, profile: Profile | null): TransitScore {
  const unknown: TransitScore = { value: 0.5, known: false, label: null };
  if (!profile || unit.lat === undefined || unit.lng === undefined) return unknown;

  const anchors: { name: string; lat: number; lng: number }[] = [];
  const from = profile.commuteFrom;
  const to = profile.commuteTo;
  if (from?.kind === "address" && from.lat !== undefined && from.lng !== undefined) {
    anchors.push({ name: "지금 사는 곳", lat: from.lat, lng: from.lng });
  }
  if (to?.kind === "address" && to.lat !== undefined && to.lng !== undefined) {
    anchors.push({ name: "직장·학교", lat: to.lat, lng: to.lng });
  }
  if (anchors.length === 0) return unknown;

  const here = { lat: unit.lat, lng: unit.lng };
  const nearest = anchors
    .map((p) => ({ name: p.name, km: roughDistanceKm(here, p) }))
    .sort((x, y) => x.km - y.km)[0];

  // 5km 이내면 만점, 40km를 넘으면 0점으로 본다.
  const value = Math.max(0, Math.min(1, (40 - nearest.km) / 35));
  return {
    value,
    known: true,
    label: `${nearest.name}에서 약 ${Math.round(nearest.km)}km`,
  };
}

function buildHeadline(
  rec: {
    competitiveness: Competitiveness;
    isOutskirt: boolean;
    transit: TransitScore;
    tierRank: number | undefined;
    scale: number;
    score: number;
  },
  isOnlyUnit: boolean,
): string {
  const { competitiveness, isOutskirt, transit, tierRank, scale, score } = rec;

  if (isOutskirt && competitiveness !== "comfortable" && score >= 55) {
    return "멀긴 해도 가능성이 높은 집!";
  }
  if (tierRank === 1 && score >= 70) return "1순위로 넣을 수 있는 집!";
  if (transit.known && transit.value >= 0.7 && competitiveness === "comfortable") {
    return "가깝고 조건도 여유로운 집!";
  }
  if (transit.known && transit.value >= 0.7) return "출퇴근이 편한 집";
  if (competitiveness === "comfortable") return "조건이 넉넉해서 해볼 만한 집";
  if (scale >= 0.7) return "많이 뽑아서 기회가 있는 집";
  if (competitiveness === "stretch") return "조건이 빠듯해요. 지원은 가능해요";
  return isOnlyUnit ? "넣어볼 만한 집" : "가능성은 반반, 넣어볼 만해요";
}

/**
 * 집 하나의 점수. `match`는 같은 유닛의 판정 결과여야 한다.
 * 자격이 안 되면 추천 대상이 아니므로 null.
 */
export function scoreUnit(
  unit: SupplyUnit,
  match: MatchResult,
  facts: Facts,
  profile: Profile | null,
): Omit<UnitRecommendation, "unit" | "headline"> & { scale: number; tierRank: number | undefined } | null {
  if (match.status !== "eligible") return null;

  const scale = supplyScale(unit.unitsCount);
  const headroom = conditionHeadroom(unit, facts);
  const tierRank = match.tier?.rank;
  const competitiveness = classify(headroom, tierRank);
  const isOutskirt = detectOutskirt(unit.address);
  const transit = transitScore(unit, profile);

  const reasons: string[] = [];

  /**
   * 점수는 "쓸 수 있는 신호"에만 배점하고 마지막에 100점 만점으로 환산한다.
   * 교통을 모를 때(좌표 없음) 그 35점을 중립으로 절반만 주면 모든 집이 40점대로
   * 눌려서, 잘 맞는 집조차 낮아 보인다. 아예 배점에서 빼는 게 정직하다.
   */
  let score = 0;
  let maxScore = 0;

  // 1) 교통 편의 — 좌표가 있을 때만 배점에 포함한다.
  if (transit.known) {
    score += transit.value * 35;
    maxScore += 35;
    if (transit.value >= 0.7 && transit.label) reasons.push(`${transit.label}로 가까워요`);
    else if (transit.value <= 0.3 && transit.label) reasons.push(`${transit.label}로 조금 멀어요`);
  }

  // 2) 당첨 가능성 — 세대수·조건 여유·순위.
  score += scale * 20;
  maxScore += 20;
  if (scale >= 0.7) reasons.push(`${unit.unitsCount}세대를 뽑아 기회가 넓어요`);

  score += headroom.value * 15;
  maxScore += 15;
  if (headroom.known && headroom.value >= 0.45) reasons.push("소득·자산 기준에 여유가 있어요");
  else if (headroom.known && headroom.value < 0.2) {
    reasons.push("소득·자산이 기준에 가까워 경쟁에서 밀릴 수 있어요");
  }

  // 순위는 있을 때만 배점한다(전체 유닛의 16%에만 있다).
  if (tierRank !== undefined) {
    maxScore += 10;
    if (tierRank === 1) {
      score += 10;
      reasons.push("1순위 조건을 충족해요");
    } else if (tierRank === 2) {
      score += 5;
      reasons.push("2순위예요");
    } else {
      reasons.push(`${tierRank}순위라 경쟁이 있으면 밀릴 수 있어요`);
    }
  }

  if (match.maxPoints > 0) {
    const ratio = match.points / match.maxPoints;
    score += ratio * 10;
    maxScore += 10;
    if (ratio >= 0.7) reasons.push(`가점 ${match.points}점으로 유리해요`);
  }

  /**
   * 3) 처지에 따른 외곽 보정 — "3순위면 외곽" 규칙.
   * 조건이 빠듯하거나 순위가 낮으면 도심 단지에서 밀리므로, 같은 공고 안에서
   * 외곽 단지를 끌어올리고 도심 단지를 내린다. 여유 있는 사람에겐 반대로 한다.
   */
  // 100점 만점으로 환산한 뒤 보정을 얹는다 — 보정은 환산값 기준의 가감점이다.
  let finalScore = maxScore > 0 ? (score / maxScore) * 100 : 50;

  if (competitiveness === "stretch") {
    finalScore += isOutskirt ? 12 : -8;
    if (isOutskirt) reasons.push("경쟁이 덜한 외곽이라 가능성이 올라가요");
  } else if (competitiveness === "tight") {
    finalScore += isOutskirt ? 6 : -3;
    if (isOutskirt) reasons.push("상대적으로 경쟁이 덜한 위치예요");
  } else if (isOutskirt) {
    // 여유 있는 사람에게 외곽은 장점이 아니다(교통이 불리한 만큼만 반영).
    finalScore -= 2;
  }

  return {
    unitId: unit.id,
    score: Math.max(0, Math.min(100, Math.round(finalScore))),
    reasons,
    competitiveness,
    isOutskirt,
    transit,
    scale,
    tierRank,
  };
}

/**
 * 공고 하나 안에서 집들을 점수순으로 정렬한다.
 * 자격이 되는 집이 하나도 없으면 null.
 */
export function recommendUnits(
  a: Announcement,
  unitResults: MatchResult[],
  facts: Facts,
  profile: Profile | null,
): AnnouncementRecommendation | null {
  const scored: UnitRecommendation[] = [];

  for (const unit of a.supplyUnits) {
    const match = unitResults.find((r) => r.unitId === unit.id);
    if (!match) continue;
    const s = scoreUnit(unit, match, facts, profile);
    if (!s) continue;
    const { scale, tierRank, ...rest } = s;
    scored.push({
      ...rest,
      unit,
      headline: buildHeadline(
        {
          competitiveness: rest.competitiveness,
          isOutskirt: rest.isOutskirt,
          transit: rest.transit,
          tierRank,
          scale,
          score: rest.score,
        },
        a.supplyUnits.length === 1,
      ),
    });
  }

  if (scored.length === 0) return null;
  scored.sort((x, y) => y.score - x.score);
  return { announcementId: a.id, announcement: a, ranked: scored, top: scored[0] };
}

/**
 * 사용자가 고른 지역의 공고만 남긴다.
 *
 * 고른 지역이 없으면(온보딩을 건너뛰었거나 "전체 보기") 전부 돌려준다 —
 * 빈 화면을 보여주느니 전부 보여주는 편이 낫다.
 * 지역을 못 정한 공고(region === null)는 사용자가 고른 지역에 속하는지 알 수 없으므로
 * 필터에서 제외한다. 관리자 화면에서 채우면 자연히 들어온다.
 */
export function filterByDesiredRegions(
  items: Announcement[],
  desiredRegions: Region[] | undefined,
  showAll = false,
): Announcement[] {
  if (showAll || !desiredRegions || desiredRegions.length === 0) return items;
  const wanted = new Set<Region>(desiredRegions);
  return items.filter((a) => a.region !== null && a.region !== "전국" && wanted.has(a.region));
}

/**
 * 여러 공고에 대해 각각 "이 공고에서 어느 집" 추천을 만든다.
 * 공고 사이의 순서는 마감 임박 순 — 지역은 이미 사용자가 골랐으므로
 * 지역끼리 우열을 매기지 않는다.
 */
export function recommendAcross(
  items: Announcement[],
  matches: Map<string, { unitResults: MatchResult[] }>,
  facts: Facts,
  profile: Profile | null,
): AnnouncementRecommendation[] {
  const out: AnnouncementRecommendation[] = [];
  for (const a of items) {
    const summary = matches.get(a.id);
    if (!summary) continue;
    const rec = recommendUnits(a, summary.unitResults, facts, profile);
    if (rec) out.push(rec);
  }
  return out.sort((x, y) => x.announcement.applyEnd.localeCompare(y.announcement.applyEnd));
}
