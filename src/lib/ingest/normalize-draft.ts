/**
 * Gemini 초안을 "판정에 바로 쓸 수 있는 형태"로 정규화하고 검증한다.
 *
 * 왜 필요한가: Gemini 응답 스키마(gemini-extract.ts)는 Condition.value를 **문자열로만**
 * 받는다. JSON 스키마에서 숫자·문자열·불리언·배열이 섞인 필드를 표현하기 어려워서 내린
 * 결정인데, 그대로 두면 판정이 틀린다:
 *
 *   numChildren eq "0"     → 0 === "0" 이 false라 자녀 없는 사람이 잘못 탈락
 *   householdSize in "3,4" → 배열이어야 하는데 문자열이라 항상 탈락
 *   carValue lte "4,542"   → Number("4,542")가 NaN이라 항상 탈락
 *
 * 실제 126건을 검사했을 때 842개 조건 중 469개(56%)가 문자열 숫자였고, 그중 7개가
 * 확실한 오판이었다. 나머지는 JS의 느슨한 비교 덕에 우연히 동작하고 있었을 뿐이라,
 * 쉼표 하나만 끼어도 바로 깨지는 상태였다.
 *
 * 그래서 **받은 직후 한 번 정규화**하고, 정규화로도 못 고치는 것만 사람에게 올린다.
 * 이 파일이 자동 승인의 관문이다 — validate가 통과시킨 초안만 자동으로 반영된다.
 */
import type { Condition, Field, FactValue, Operator, Tier } from "@/lib/types";
import { fixRuleSet } from "@/lib/condition-fixes";
import type { DraftUnit, ExtractionDraft } from "./gemini-extract";

/** 값이 숫자여야 하는 필드. 나머지는 문자열/불리언이다 */
const NUMERIC_FIELDS = new Set<Field>([
  "age", "incomePct", "noHousingMonths", "residenceMonths", "marriageMonths",
  "numChildren", "householdSize", "subscriptionMonths", "paymentCount",
  "totalDeposit", "totalAssets", "carValue",
]);

/** 값이 불리언이어야 하는 필드 */
const BOOLEAN_FIELDS = new Set<Field>(["hasSubscription"]);

const VALID_FIELDS = new Set<Field>([
  ...NUMERIC_FIELDS, ...BOOLEAN_FIELDS,
  "housingStatus", "residenceRegion", "maritalStatus",
]);

const VALID_OPERATORS = new Set<Operator>(["eq", "neq", "lte", "gte", "in"]);

/**
 * "4,542만원" → 4542. 공고문 표기를 숫자로 되돌린다.
 * 쉼표·공백·원화 단위를 걷어내고 남은 숫자만 취한다. 못 읽으면 null(=검증에서 걸린다).
 */
function toNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/만원|원|개월|년|월|세|회|%|이하|이상/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (["true", "y", "yes", "있음", "1"].includes(v)) return true;
  if (["false", "n", "no", "없음", "0"].includes(v)) return false;
  return null;
}

/**
 * 조건 하나를 정규화한다. 고칠 수 없으면 null을 돌려주고, 호출한 쪽이 그 조건을
 * 버리는 대신 **검증 실패로 올린다** — 조용히 버리면 자격요건이 느슨해져서 위험하다.
 */
function normalizeCondition(c: Condition): Condition | null {
  if (!VALID_FIELDS.has(c.field) || !VALID_OPERATORS.has(c.operator)) return null;

  // in 연산자는 값이 배열이어야 한다. Gemini는 "3,4"처럼 콤마 문자열로 준다.
  if (c.operator === "in") {
    const parts = Array.isArray(c.value)
      ? c.value.map(String)
      : String(c.value).split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    if (NUMERIC_FIELDS.has(c.field)) {
      const nums = parts.map(toNumber);
      if (nums.some((n) => n === null)) return null;
      return { ...c, value: nums as number[] };
    }
    return { ...c, value: parts };
  }

  // in이 아닌데 배열이면 스키마 위반이다.
  if (Array.isArray(c.value)) return null;

  if (NUMERIC_FIELDS.has(c.field)) {
    if (typeof c.value === "number") return c;
    const n = toNumber(String(c.value));
    return n === null ? null : { ...c, value: n };
  }

  if (BOOLEAN_FIELDS.has(c.field)) {
    if (typeof c.value === "boolean") return c;
    const b = toBoolean(String(c.value));
    return b === null ? null : { ...c, value: b };
  }

  // 문자열 필드(housingStatus 등). lte/gte는 문자열에 의미가 없다.
  if (c.operator === "lte" || c.operator === "gte") return null;
  return { ...c, value: String(c.value) as FactValue };
}

export interface NormalizeIssue {
  unitName: string;
  where: "eligibility" | "tier" | "scoreRule";
  detail: string;
}

export interface NormalizeResult {
  draft: ExtractionDraft;
  /** 정규화로 고칠 수 없었던 항목들. 하나라도 있으면 자동 승인하지 않는다 */
  issues: NormalizeIssue[];
  /** 문자열 → 숫자/불리언/배열로 실제로 고친 조건 수 */
  fixedCount: number;
}

/**
 * 초안 전체를 정규화한다. 원본을 바꾸지 않고 새 객체를 돌려준다.
 * issues가 비어 있으면 "판정에 바로 써도 안전하다"는 뜻이다.
 */
export function normalizeDraft(draft: ExtractionDraft): NormalizeResult {
  const issues: NormalizeIssue[] = [];
  let fixedCount = 0;

  const units: DraftUnit[] = (draft.unitsFound ?? []).map((u) => {
    const unitName = u.name || "(이름 없음)";

    const normalizeList = (list: Condition[], where: NormalizeIssue["where"], ctx: string) =>
      list.reduce<Condition[]>((acc, c) => {
        const fixed = normalizeCondition(c);
        if (!fixed) {
          issues.push({
            unitName,
            where,
            detail: `${ctx}${c.field} ${c.operator} ${JSON.stringify(c.value)} — "${c.label}"`,
          });
          return acc;
        }
        if (JSON.stringify(fixed.value) !== JSON.stringify(c.value)) fixedCount += 1;
        acc.push(fixed);
        return acc;
      }, []);

    // 형식을 맞춘 뒤, "모두를 탈락시키는" 표현을 바로잡는다 — 거주 지역("대한민국"·"군산"),
    // "통장 가입 불필요"를 "없어야 함"으로 담은 것 등(condition-fixes.ts)
    const fixed = fixRuleSet({
      eligibility: normalizeList((u.eligibility ?? []) as Condition[], "eligibility", ""),
      tiers: (u.tiers ?? []).map((t) => ({
        ...t,
        rank: t.rank as Tier["rank"],
        conditions: normalizeList((t.conditions ?? []) as Condition[], "tier", `${t.rank}순위: `),
      })),
      otherRequirements: u.otherRequirements,
    });
    fixedCount += fixed.changed;
    const { eligibility, tiers, otherRequirements } = fixed.rules;

    // scoreRules의 bands는 스키마가 이미 NUMBER라 문자열이 섞일 일이 없다.
    // 다만 field는 확인한다 — 여기가 틀리면 가점이 통째로 잘못 붙는다.
    const scoreRules = (u.scoreRules ?? []).filter((r) => {
      const ok = VALID_FIELDS.has(r.field as Field);
      if (!ok) {
        issues.push({ unitName, where: "scoreRule", detail: `알 수 없는 가점 항목: ${r.field} — "${r.label}"` });
      }
      return ok;
    });

    return { ...u, eligibility, tiers, scoreRules, otherRequirements } as DraftUnit;
  });

  return { draft: { ...draft, unitsFound: units }, issues, fixedCount };
}

/**
 * 정규화된 초안이 자동 승인 기준을 만족하는지. 실패 사유를 사람 말로 돌려준다.
 *
 * 기준은 "판정이 틀릴 수 있는가"에만 둔다. 조건 개수가 적다거나 확신도가 낮다는 건
 * 막지 않는다 — 조건이 적은 공고도 실제로 있고(자격완화 모집), 확신도는 실제 데이터가
 * 전부 high라 변별력이 없었다.
 */
export function autoApprovable(result: NormalizeResult): { ok: boolean; reason?: string } {
  if (result.issues.length > 0) {
    return { ok: false, reason: `해석할 수 없는 조건 ${result.issues.length}개` };
  }
  if (result.draft.unitsFound.length === 0) {
    return { ok: false, reason: "추출된 공급유닛이 없음" };
  }
  const empty = result.draft.unitsFound.filter(
    (u) => (u.eligibility?.length ?? 0) === 0 && (u.tiers?.length ?? 0) === 0,
  );
  if (empty.length === result.draft.unitsFound.length) {
    return { ok: false, reason: "모든 유닛에 자격요건·순위가 비어 있음" };
  }
  return { ok: true };
}
