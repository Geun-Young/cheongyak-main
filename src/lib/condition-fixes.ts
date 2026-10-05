import type { Condition, OtherRequirement, Tier } from "./types";
import { mergeCaveats, normalizeResidenceList } from "./residence";

/**
 * AI가 뽑은 조건 중 "모두를 탈락시키는" 잘못된 표현을 바로잡는다(project.md 29번).
 * 초안 정리(normalize-draft.ts)와 이미 저장된 유닛 보정(scripts/fix-conditions.ts)이 같은 규칙을 쓴다.
 *
 *  1) 거주 지역 — residence.ts ("대한민국"·"인천광역시"·"군산" → 시·도)
 *  2) 항상 참인 조건은 뺀다 — "주택 소유 여부 무관" = housingStatus in [none, owner] 같은 것.
 *     참/거짓을 문자열로 담은 것(hasSubscription in ["true","false"])은 누구도 통과 못 하는 버그였다.
 *  3) "청약통장 가입 불필요·무관"이 hasSubscription eq false(= 통장이 없어야 함)로 저장된 자격 조건은 뺀다.
 *     라벨에 "무관"이 있어도 다른 칸은 건드리지 않는다 — "혼인가구(혼인기간 무관)"는 진짜 조건이다.
 *  4) "1·2순위에 해당하지 않는 자" 같은 나머지 순위는 조건 없는 마지막 순위로 둔다.
 *     통장 없음(eq false)으로 저장돼서, 통장은 있지만 1·2순위가 안 되는 사람이 순위를 못 받고 있었다.
 *  5) 총자산 기준이 1,000만 원 미만인데 라벨에 "억"이 있으면 단위 오류다 — 라벨에서 다시 읽는다
 *     ("총자산가액 3억 4,500만원 이하"가 345로 저장된 사례).
 *
 * 모두 "근거가 분명할 때만" 고친다. 애매하면 그대로 둔다.
 */

const ALL_VALUES: Partial<Record<Condition["field"], string[]>> = {
  housingStatus: ["none", "owner"],
  hasSubscription: ["true", "false"],
  maritalStatus: ["single", "married", "engaged"],
};

const NOT_REQUIRED = /불필요|불문|무관|관계\s*없|상관\s*없/;
const CATCH_ALL_TIER = /해당(되|하)지\s*(아니|않)|그\s*(외|밖)의?\s*(자|사람|신청자)?$/;

function toBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "y", "yes", "있음", "1"].includes(s)) return true;
  if (["false", "n", "no", "없음", "0"].includes(s)) return false;
  return null;
}

/** "3억 4,500만원" → 34500(만원). 못 읽으면 null */
export function parseManwonFromLabel(label: string): number | null {
  const m = label.match(/(\d+)\s*억(?:\s*([\d,]+)\s*만)?/);
  if (!m) return null;
  return Number(m[1]) * 10_000 + (m[2] ? Number(m[2].replace(/,/g, "")) : 0);
}

/** 조건 하나. null = 뺀다(항상 참 또는 요건 아님). changed = 바뀌었는지 */
function fixCondition(c: Condition, mode: "eligibility" | "tier"): { condition: Condition | null; changed: boolean } {
  // 참/거짓 칸의 문자열 값을 불리언으로
  if (c.field === "hasSubscription") {
    const vals = Array.isArray(c.value) ? c.value : [c.value];
    const bools = vals.map(toBool);
    if (bools.every((b) => b !== null)) {
      const set = [...new Set(bools as boolean[])];
      if (set.length === 2) return { condition: null, changed: true }; // 있음·없음 둘 다 허용 = 항상 참
      const b = set[0];
      if (mode === "eligibility" && !b && c.operator !== "neq" && NOT_REQUIRED.test(c.label)) {
        return { condition: null, changed: true }; // "가입 불필요"를 "없어야 함"으로 담은 것
      }
      const next: Condition = c.operator === "in" ? { ...c, operator: "eq", value: b } : { ...c, value: b };
      const changed = next.operator !== c.operator || next.value !== c.value;
      return { condition: changed ? next : c, changed };
    }
  }

  // 모든 값을 허용하는 in = 항상 참
  const all = ALL_VALUES[c.field];
  if (all && c.operator === "in" && Array.isArray(c.value) && all.every((v) => (c.value as unknown[]).map(String).includes(v))) {
    return { condition: null, changed: true };
  }

  // 총자산 단위 오류
  if (c.field === "totalAssets" && typeof c.value === "number" && c.value > 0 && c.value < 1000) {
    const fromLabel = parseManwonFromLabel(c.label);
    if (fromLabel && fromLabel >= 1000) return { condition: { ...c, value: fromLabel }, changed: true };
  }
  return { condition: c, changed: false };
}

function fixList(list: Condition[], mode: "eligibility" | "tier"): { conditions: Condition[]; changed: number } {
  let changed = 0;
  const conditions: Condition[] = [];
  for (const c of list) {
    const f = fixCondition(c, mode);
    if (f.changed) changed += 1;
    if (f.condition) conditions.push(f.condition);
  }
  return { conditions, changed };
}

export interface RuleSet {
  eligibility: Condition[];
  tiers: Tier[];
  otherRequirements?: OtherRequirement[];
}

/** 유닛이나 신청 경로 하나의 자격·순위를 고친다. 원본은 바꾸지 않는다 */
export function fixRuleSet<T extends RuleSet>(r: T): { rules: T; changed: number } {
  let changed = 0;

  const e1 = fixList(r.eligibility ?? [], "eligibility");
  const e2 = normalizeResidenceList(e1.conditions, "eligibility");
  changed += e1.changed + e2.changed;

  const tiers = (r.tiers ?? []).map((t) => {
    // 나머지 순위("1·2순위에 해당하지 않는 자")는 조건 없이 — 앞 순위에 안 걸린 사람이 모두 여기 온다
    if (t.rank > 1 && CATCH_ALL_TIER.test(t.label.trim()) && (t.conditions ?? []).length > 0) {
      changed += 1;
      return { ...t, conditions: [] };
    }
    const t1 = fixList(t.conditions ?? [], "tier");
    const t2 = normalizeResidenceList(t1.conditions, "tier");
    changed += t1.changed + t2.changed;
    return { ...t, conditions: t2.conditions };
  });

  return {
    rules: { ...r, eligibility: e2.conditions, tiers, otherRequirements: mergeCaveats(r.otherRequirements, e2.caveats) },
    changed,
  };
}
