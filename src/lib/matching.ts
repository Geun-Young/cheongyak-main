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
import { hasMentionedGroup, mentionsSpecialGroup } from "./special-groups";

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

/** 유닛이나 신청 경로(variant) — 둘 다 같은 모양의 자격·순위·가점을 가진다 */
type Rules = Pick<SupplyUnit, "eligibility" | "tiers" | "scoreRules">;

/**
 * 순위 라벨에 대상 계층이 적혀 있으면("일반공급 1순위(생계·의료수급자, 유공자 등)") 그 신분을 체크한 사람만 그 순위다.
 * 이 요건은 조건이 아니라 라벨에만 있어서, 전에는 아무에게나 1순위를 줬다(project.md 31번).
 * 체크하지 않았거나 체크 항목이 없는 계층(북한이탈주민 등)이면 다음 순위로 넘어간다.
 */
function tierGroupOk(label: string, facts: Facts): boolean {
  return !mentionsSpecialGroup(label) || hasMentionedGroup(label, facts.groups);
}

/** 자격 → 순위 → 가점. 자격이 하나라도 안 맞으면 순위·가점은 셈하지 않는다 */
function evaluateRules(rules: Rules, facts: Facts): Pick<MatchResult, "unmet" | "tier" | "points" | "maxPoints" | "breakdown"> {
  const unmet = rules.eligibility.filter((c) => !checkCondition(c, facts));
  if (unmet.length > 0) return { unmet, points: 0, maxPoints: 0, breakdown: [] };

  const tier = rules.tiers.find((t) => t.conditions.every((c) => checkCondition(c, facts)) && tierGroupOk(t.label, facts));
  const breakdown: ScoreLine[] = rules.scoreRules.map((rule) => {
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
  return { unmet, tier, points, maxPoints, breakdown };
}

/**
 * 우리가 묻지 않는 신분이 자격의 핵심인 경로(주거약자용·장애인·수급자·대학생 계층 등).
 * 이 경로들은 나머지 조건이 느슨해서(예: 수급자 계층은 무주택만 보면 누구나 통과) 그대로 판정하면
 * 거의 모든 사람이 "신청 가능"이 된다. 이 경로로만 통과하면 needs_review로 둔다.
 * 고령자는 나이 조건(만 65세)이 들어 있어 스스로 걸러지므로 여기 넣지 않는다.
 * "청년/대학생"처럼 일반 계층과 함께 적힌 경로는 일반 경로로 본다.
 */
export function isSpecialGroupVariant(name: string): boolean {
  if (/주거약자|장애|수급|보호종료|유공자/.test(name)) return true;
  return /대학생/.test(name) && !/청년|일반/.test(name);
}

/** 신청 경로마다 판정한다. 결과는 unit.variants와 같은 순서 */
export function matchUnitVariants(
  a: Announcement,
  unit: SupplyUnit,
  facts: Facts,
  today = startOfToday(),
): MatchResult[] {
  return (unit.variants ?? []).map((v, index): MatchResult => {
    const base = { announcementId: a.id, unitId: unit.id };
    const special = v.special ?? isSpecialGroupVariant(v.name);
    const variant = { index, name: v.name, special };
    if (a.status === "closed" || daysLeft(a.applyEnd, today) < 0) {
      return { ...base, status: "closed", unmet: [], points: 0, maxPoints: 0, breakdown: [], variant };
    }
    const e = evaluateRules(v, facts);
    // 조건이 하나도 없는 경로는 근거가 없으니 통과로 치지 않는다(단일 유닛의 "조건 없음"과 같은 취급).
    // 특수 계층 경로는 그 신분(수급자·장애인 등)을 체크했으면 신청 가능, 아니면 확인 필요
    const status: EligibilityStatus =
      e.unmet.length > 0
        ? "ineligible"
        : v.eligibility.length === 0 || (special && !hasMentionedGroup(v.name, facts.groups))
          ? "needs_review"
          : "eligible";
    return { ...base, ...e, status, variant };
  });
}

/** 공고의 게시상태·마감·검수여부는 공고 기준, 자격·순위·가점은 유닛(또는 유닛의 신청 경로) 기준으로 판정한다 */
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
  if (a.reviewStatus === "pending") {
    return { ...base, status: "needs_review" };
  }
  // 신청 경로가 있으면 경로 중 가장 좋은 결과가 이 단지의 결과다(하나라도 되면 신청할 수 있다)
  if (unit.variants?.length) {
    return pickBest(matchUnitVariants(a, unit, facts, today));
  }
  if (unit.eligibility.length === 0) {
    return { ...base, status: "needs_review" };
  }

  const e = evaluateRules(unit, facts);
  return { ...base, ...e, status: e.unmet.length > 0 ? "ineligible" : "eligible" };
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
