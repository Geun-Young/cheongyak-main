import type {
  Announcement,
  Condition,
  EligibilityStatus,
  FactValue,
  Facts,
  MatchResult,
  ScoreBand,
  ScoreLine,
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

export function matchAnnouncement(
  a: Announcement,
  facts: Facts,
  today = startOfToday(),
): MatchResult {
  const base = { announcementId: a.id, unmet: [] as Condition[], points: 0, maxPoints: 0, breakdown: [] as ScoreLine[] };

  if (a.status === "closed" || daysLeft(a.applyEnd, today) < 0) {
    return { ...base, status: "closed" };
  }
  if (a.reviewStatus === "pending" || a.eligibility.length === 0) {
    return { ...base, status: "needs_review" };
  }

  const unmet = a.eligibility.filter((c) => !checkCondition(c, facts));
  if (unmet.length > 0) {
    return { ...base, status: "ineligible", unmet };
  }

  const tier = a.tiers.find((t) => t.conditions.every((c) => checkCondition(c, facts)));

  const breakdown: ScoreLine[] = a.scoreRules.map((rule) => {
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

export function matchAll(
  list: Announcement[],
  facts: Facts,
  today = startOfToday(),
): Map<string, MatchResult> {
  const out = new Map<string, MatchResult>();
  for (const a of list) out.set(a.id, matchAnnouncement(a, facts, today));
  return out;
}

export function countByStatus(results: Iterable<MatchResult>): Record<EligibilityStatus, number> {
  const counts: Record<EligibilityStatus, number> = {
    eligible: 0,
    ineligible: 0,
    needs_review: 0,
    closed: 0,
  };
  for (const r of results) counts[r.status] += 1;
  return counts;
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
