import type {
  Announcement,
  AnnouncementMatchSummary,
  Condition,
  EligibilityStatus,
  FactValue,
  Facts,
  MatchResult,
  ScoreBand,
  ScoreLine,
  SupplyUnit,
} from "./types";
import { daysLeft, startOfToday } from "./format";

export function checkCondition(c: Condition, facts: Facts): boolean {
  const v = facts[c.field];
  switch (c.operator) {
    case "eq":
      return v === c.value;
    case "neq":
      return v !== c.value;
    case "lte":
      return typeof v === "number" && v <= (c.value as number);
    case "gte":
      return typeof v === "number" && v >= (c.value as number);
    case "in":
      return Array.isArray(c.value) && c.value.includes(v);
    default:
      return false;
  }
}

function bandMatches(b: ScoreBand, v: FactValue): boolean {
  if (b.eq !== undefined) return v === b.eq;
  if (typeof v !== "number") return false;
  if (b.gte !== undefined && v < b.gte) return false;
  if (b.lte !== undefined && v > b.lte) return false;
  return true;
}

/** 공고의 게시상태·마감·검수여부는 공고 기준, 자격·순위·가점은 유닛 기준으로 판정한다 */
export function matchUnit(
  a: Announcement,
  unit: SupplyUnit,
  facts: Facts,
  today = startOfToday(),
): MatchResult {
  const base = {
    announcementId: a.id,
    unitId: unit.id,
    unmet: [] as Condition[],
    points: 0,
    maxPoints: 0,
    breakdown: [] as ScoreLine[],
  };

  if (a.status === "closed" || daysLeft(a.applyEnd, today) < 0) {
    return { ...base, status: "closed" };
  }
  if (a.reviewStatus === "pending" || unit.eligibility.length === 0) {
    return { ...base, status: "needs_review" };
  }

  const unmet = unit.eligibility.filter((c) => !checkCondition(c, facts));
  if (unmet.length > 0) {
    return { ...base, status: "ineligible", unmet };
  }

  const tier = unit.tiers.find((t) => t.conditions.every((c) => checkCondition(c, facts)));

  const breakdown: ScoreLine[] = unit.scoreRules.map((rule) => {
    const v = facts[rule.field];
    const band = rule.bands.find((b) => bandMatches(b, v));
    const maxPoints = Math.max(...rule.bands.map((b) => b.points), 0);
    return {
      label: rule.label,
      points: band?.points ?? 0,
      maxPoints,
      note: band?.note ?? "해당 없음",
    };
  });

  const points = breakdown.reduce((s, l) => s + l.points, 0);
  const maxPoints = breakdown.reduce((s, l) => s + l.maxPoints, 0);

  return { ...base, status: "eligible", tier, points, maxPoints, breakdown };
}

const STATUS_RANK: Record<EligibilityStatus, number> = {
  eligible: 0,
  needs_review: 1,
  ineligible: 2,
  closed: 3,
};

/** 여러 유닛 판정 결과 중 사용자에게 가장 먼저 보여줄 대표 결과를 고른다 */
function pickBest(results: MatchResult[]): MatchResult {
  return results.reduce((best, r) => {
    if (STATUS_RANK[r.status] !== STATUS_RANK[best.status]) {
      return STATUS_RANK[r.status] < STATUS_RANK[best.status] ? r : best;
    }
    if (r.status === "eligible") {
      const rTier = r.tier?.rank ?? 99;
      const bTier = best.tier?.rank ?? 99;
      if (rTier !== bTier) return rTier < bTier ? r : best;
      return r.points > best.points ? r : best;
    }
    if (r.status === "ineligible") {
      return r.unmet.length < best.unmet.length ? r : best;
    }
    return best;
  });
}

export function matchAnnouncement(
  a: Announcement,
  facts: Facts,
  today = startOfToday(),
): AnnouncementMatchSummary {
  const unitResults = a.supplyUnits.map((u) => matchUnit(a, u, facts, today));
  return { announcementId: a.id, unitResults, best: pickBest(unitResults) };
}

export function matchAll(
  list: Announcement[],
  facts: Facts,
  today = startOfToday(),
): Map<string, AnnouncementMatchSummary> {
  const out = new Map<string, AnnouncementMatchSummary>();
  for (const a of list) out.set(a.id, matchAnnouncement(a, facts, today));
  return out;
}

export function countByStatus(
  summaries: Iterable<AnnouncementMatchSummary>,
): Record<EligibilityStatus, number> {
  const counts: Record<EligibilityStatus, number> = {
    eligible: 0,
    ineligible: 0,
    needs_review: 0,
    closed: 0,
  };
  for (const s of summaries) counts[s.best.status] += 1;
  return counts;
}

/** 목록 행의 "N개 타입 중 M개 신청가능" 배지용 */
export function countEligibleUnits(summary: AnnouncementMatchSummary): { eligible: number; total: number } {
  return {
    eligible: summary.unitResults.filter((r) => r.status === "eligible").length,
    total: summary.unitResults.length,
  };
}

export const STATUS_META: Record<
  EligibilityStatus,
  { label: string; short: string; tone: "ok" | "warn" | "info" | "muted" }
> = {
  eligible: { label: "신청 가능", short: "가능", tone: "ok" },
  ineligible: { label: "조건 미달", short: "미달", tone: "warn" },
  needs_review: { label: "확인 필요", short: "확인", tone: "info" },
  closed: { label: "접수 마감", short: "마감", tone: "muted" },
};
