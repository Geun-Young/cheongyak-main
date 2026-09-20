/**
 * "이 사람에게 어느 집이 가장 가능성 있는가"를 점수로 매긴다.
 *
 * 판정(matching.ts)과 역할이 다르다. 판정은 **자격이 되는가**(예/아니오)를 보고,
 * 추천은 자격이 되는 것들 **사이의 순서**를 정한다 — 붙을 가능성이 얼마나 되는지,
 * 조건 대비 무리하지 않는 선택인지.
 *
 * ## 설계 근거 (실제 데이터 111개 유닛을 세어 보고 정했다)
 *
 * 순위(tiers)가 있는 유닛은 16%, 가점(scoreRules)은 12%뿐이다. 그래서 순위·가점에만
 * 기대면 84%가 점수를 못 받아 순서가 안 매겨진다. 대신 **어느 공고에나 있는 신호**를
 * 주축으로 삼고, 순위·가점은 있을 때 가산하는 방식으로 짰다:
 *
 *   - 경쟁 강도(세대수·인기지역): 모든 공고에 있다 → 주축
 *   - 조건 여유(자격 커트라인 대비 내 위치): 대부분 있다 → 주축
 *   - 순위·가점: 있으면 가산 → 보조
 *
 * ## "3순위면 외곽" 규칙
 *
 * 순위가 낮거나 조건이 빠듯한 사람은 인기 지역에서 경쟁에 밀린다. 그래서
 * `competitionPenalty`가 **사용자의 처지에 따라 달라진다** — 여유 있는 사람에게는
 * 인기 지역을 깎지 않고, 빠듯한 사람에게만 크게 깎아 외곽을 위로 올린다.
 * 외곽을 "좋은 집"이라고 우기는 게 아니라, **붙을 가능성 순으로 정렬**하는 것이다.
 */
import type {
  Announcement,
  Facts,
  MatchResult,
  Region,
  SupplyUnit,
} from "./types";
import { daysLeft } from "./format";

/** 수도권·광역시는 경쟁이 세다. 외곽 추천 로직의 기준이 된다 */
const HIGH_DEMAND_REGIONS = new Set<Region>(["서울", "경기", "인천"]);
const MID_DEMAND_REGIONS = new Set<Region>(["부산", "대구", "대전", "광주", "울산", "세종"]);

export type Competitiveness = "comfortable" | "tight" | "stretch";

export interface RecommendationScore {
  announcementId: string;
  unitId: string;
  /** 0~100. 높을수록 "이 사람이 붙을 가능성이 높다" */
  score: number;
  /** 한 줄 요약. 사용자에게 그대로 보여준다 */
  headline: string;
  /** 점수를 만든 근거들. 왜 추천했는지 펼쳐 보여줄 때 쓴다 */
  reasons: string[];
  /** 사용자의 조건이 이 유닛에서 얼마나 여유로운지 */
  competitiveness: Competitiveness;
}

/** 지역 경쟁 강도. 0(한산) ~ 1(치열) */
function regionDemand(region: Region | "전국" | null): number {
  if (!region || region === "전국") return 0.5;
  if (HIGH_DEMAND_REGIONS.has(region)) return 1;
  if (MID_DEMAND_REGIONS.has(region)) return 0.6;
  return 0.25;
}

/**
 * 세대수가 많을수록 붙을 확률이 높다. 실제 분포가 1~770세대(중앙값 38)로 편차가 커서
 * 로그로 눌러 준다 — 770세대가 38세대보다 20배 좋은 게 아니라 "꽤 더 좋은" 정도다.
 */
function supplyScale(unitsCount: number): number {
  if (unitsCount <= 0) return 0.3;
  return Math.min(1, Math.log10(unitsCount + 1) / Math.log10(300));
}

interface Headroom {
  /** 0(빠듯) ~ 1(여유). known이 false면 추정치일 뿐이다 */
  value: number;
  /** 상한 조건이 실제로 있어서 계산된 값인지. 유닛의 53%는 상한 조건이 아예 없다 */
  known: boolean;
}

/**
 * 사용자 조건이 자격 커트라인에서 얼마나 떨어져 있는지 본다.
 * 소득·자산이 상한에 가까울수록(=빠듯할수록) 실제 경쟁에서 밀릴 확률이 높다.
 *
 * 상한 조건이 없는 유닛이 절반이 넘는다(111개 중 59개). 이때 중립값을 돌려주되
 * **known: false로 표시**한다 — 이 구분을 안 하면 "근거가 없어서 중립"이 "여유롭다"로
 * 둔갑해서, 소득 100%·자산 2.3억인 사람에게도 "조건이 넉넉해요"라고 말하게 된다.
 */
function conditionHeadroom(unit: SupplyUnit, facts: Facts): Headroom {
  const ratios: number[] = [];

  for (const c of unit.eligibility) {
    if (c.operator !== "lte") continue;
    const limit = typeof c.value === "number" ? c.value : Number(c.value);
    const mine = facts[c.field];
    if (!Number.isFinite(limit) || limit <= 0 || typeof mine !== "number") continue;
    // 0에 가까울수록 여유롭다. 1을 넘으면 애초에 자격이 안 되므로 여기 오지 않는다.
    ratios.push(Math.min(1, mine / limit));
  }

  if (ratios.length === 0) return { value: 0.5, known: false };
  // 가장 빠듯한 항목이 당락을 가른다 — 평균이 아니라 최악값을 본다.
  const worst = Math.max(...ratios);
  return { value: 1 - worst, known: true };
}

/**
 * 근거가 확인된 경우에만 "여유롭다"고 단정한다. 모르면 tight(중간)에 둔다 —
 * 사용자에게 과하게 낙관적인 신호를 주는 것보다 보수적인 쪽이 안전하다.
 */
function classify(headroom: Headroom, tierRank: number | undefined): Competitiveness {
  if (tierRank !== undefined && tierRank >= 3) return "stretch";
  if (!headroom.known) return tierRank === 1 ? "comfortable" : "tight";
  if (tierRank === 1 && headroom.value >= 0.3) return "comfortable";
  if (headroom.value >= 0.45) return "comfortable";
  if (headroom.value >= 0.2) return "tight";
  return "stretch";
}

/**
 * 한 줄 요약. 점수만 보여주면 왜 위에 있는지 모르니, 가장 두드러진 이유 하나를 말한다.
 * 사용자가 실제로 쓰는 말투에 가깝게 쓴다("멀긴 해도 가능성이 높은 집!" 같은).
 */
function buildHeadline(
  score: number,
  competitiveness: Competitiveness,
  demand: number,
  scale: number,
  tierRank: number | undefined,
  daysToDeadline: number,
): string {
  if (daysToDeadline >= 0 && daysToDeadline <= 3) {
    return score >= 60 ? "가능성 높은데 곧 마감! 서두르세요" : "마감이 코앞이에요";
  }
  if (tierRank === 1 && score >= 70) return "1순위로 넣을 수 있는 집!";
  if (competitiveness === "comfortable" && demand <= 0.3) {
    return "조건도 여유롭고 경쟁도 덜한 집!";
  }
  if (competitiveness === "comfortable") return "조건이 넉넉해서 해볼 만한 집";
  if (demand <= 0.3 && score >= 55) return "멀긴 해도 가능성이 높은 집!";
  if (scale >= 0.7) return "많이 뽑아서 기회가 있는 집";
  if (competitiveness === "stretch") return "조건이 빠듯해요. 지원은 가능해요";
  return "가능성은 반반, 넣어볼 만해요";
}

/**
 * 유닛 하나의 추천 점수. `match`는 같은 유닛의 판정 결과여야 한다.
 * 자격이 안 되는 유닛은 추천 대상이 아니므로 null을 돌려준다.
 */
export function scoreUnit(
  a: Announcement,
  unit: SupplyUnit,
  match: MatchResult,
  facts: Facts,
): RecommendationScore | null {
  if (match.status !== "eligible") return null;

  const demand = regionDemand(a.region);
  const scale = supplyScale(unit.unitsCount);
  const headroom = conditionHeadroom(unit, facts);
  const tierRank = match.tier?.rank;
  const competitiveness = classify(headroom, tierRank);

  const reasons: string[] = [];

  // 1) 공급 규모 — 어느 공고에나 있는 신호라 주축으로 쓴다.
  let score = 30 + scale * 25;
  if (scale >= 0.7) reasons.push(`${unit.unitsCount}세대를 뽑아 기회가 넓어요`);

  // 2) 조건 여유 — 빠듯할수록 실제 경쟁에서 밀린다.
  // 근거가 없으면(상한 조건이 없는 유닛) 점수만 중립으로 주고 이유는 말하지 않는다.
  score += headroom.value * 20;
  if (headroom.known && headroom.value >= 0.45) reasons.push("소득·자산 기준에 여유가 있어요");
  else if (headroom.known && headroom.value < 0.2) {
    reasons.push("소득·자산이 기준에 가까워 경쟁에서 밀릴 수 있어요");
  }

  // 3) 순위 — 있을 때만 가산한다(전체의 16%).
  if (tierRank === 1) {
    score += 15;
    reasons.push("1순위 조건을 충족해요");
  } else if (tierRank === 2) {
    score += 7;
    reasons.push("2순위예요");
  } else if (tierRank !== undefined && tierRank >= 3) {
    reasons.push(`${tierRank}순위라 경쟁이 있으면 밀릴 수 있어요`);
  }

  // 4) 가점 — 있을 때만(12%). 만점 대비 비율로 본다.
  if (match.maxPoints > 0) {
    const ratio = match.points / match.maxPoints;
    score += ratio * 10;
    if (ratio >= 0.7) reasons.push(`가점 ${match.points}점으로 유리해요`);
  }

  /**
   * 5) 경쟁 지역 감점 — 여기가 "3순위면 외곽" 규칙이다.
   * 여유 있는 사람은 인기 지역에서도 해볼 만하니 덜 깎고, 빠듯한 사람은 크게 깎아
   * 외곽이 위로 올라오게 한다. 지역 자체를 나쁘게 보는 게 아니라 당첨 가능성 기준이다.
   */
  const penaltyWeight = competitiveness === "comfortable" ? 8 : competitiveness === "tight" ? 16 : 24;
  score -= demand * penaltyWeight;
  if (demand >= 0.6 && competitiveness !== "comfortable") {
    reasons.push("인기 지역이라 경쟁이 치열해요");
  } else if (demand <= 0.3 && competitiveness !== "comfortable") {
    reasons.push("경쟁이 덜한 지역이라 가능성이 올라가요");
  }

  const days = daysLeft(a.applyEnd);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    announcementId: a.id,
    unitId: unit.id,
    score,
    headline: buildHeadline(score, competitiveness, demand, scale, tierRank, days),
    reasons,
    competitiveness,
  };
}

export interface Recommendation extends RecommendationScore {
  announcement: Announcement;
  unit: SupplyUnit;
}

/**
 * 공고 목록 전체에서 추천을 뽑아 점수순으로 돌려준다.
 * 같은 공고의 여러 유닛 중에서는 가장 점수가 높은 것 하나만 남긴다 — 한 공고가
 * 목록을 도배하면 선택지가 좁아 보인다.
 */
export function recommend(
  items: Announcement[],
  matches: Map<string, { unitResults: MatchResult[] }>,
  facts: Facts,
  limit = 10,
): Recommendation[] {
  const out: Recommendation[] = [];

  for (const a of items) {
    const summary = matches.get(a.id);
    if (!summary) continue;

    let bestForAnnouncement: Recommendation | null = null;
    for (const unit of a.supplyUnits) {
      const match = summary.unitResults.find((r) => r.unitId === unit.id);
      if (!match) continue;
      const scored = scoreUnit(a, unit, match, facts);
      if (!scored) continue;
      if (!bestForAnnouncement || scored.score > bestForAnnouncement.score) {
        bestForAnnouncement = { ...scored, announcement: a, unit };
      }
    }
    if (bestForAnnouncement) out.push(bestForAnnouncement);
  }

  return out
    .sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      // 점수가 같으면 마감이 가까운 쪽을 먼저 — 지금 행동할 수 있는 것이 더 쓸모 있다.
      return daysLeft(x.announcement.applyEnd) - daysLeft(y.announcement.applyEnd);
    })
    .slice(0, limit);
}
