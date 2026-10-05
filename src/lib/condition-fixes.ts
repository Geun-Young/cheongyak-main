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

/* ───────────────────────── 나이 — "직접 확인 조건"에만 있는 신청자 나이를 판정에 쓰기 ───────────────────────── */

/**
 * 신청자 본인의 나이가 아닌 문장(자녀·부모·배우자 나이), 부정·예외 문장은 건드리지 않는다.
 * "미성년자(19세 미만) 신청 불가(예외 적용 가능)"를 "19세 미만이어야 함"으로 읽으면 정반대가 된다.
 */
const NOT_APPLICANT_AGE = /자녀|아동|영유아|직계존속|부모|부양|배우자|세대원|예외|불가|제외|제한/;
/** 나이 말고 다른 길이 함께 적혀 있는가 — "청년이거나 사회초년생", "만 65세 이상 고령자, 장애인, …" */
const ALTERNATIVE = /또는|이거나|거나|혹은|중\s*하나|,/;

export interface ApplicantAge {
  min?: number;
  max?: number;
  /** 나이 말고 다른 자격으로도 될 수 있으면 true(경로를 둘로 나눈다), 아니면 나이가 곧 요건 */
  alternative: boolean;
}

const plausible = (n: number) => n >= 15 && n <= 100;

/** "만 19세 이상 만 39세 이하 청년이거나 …" → { min: 19, max: 39, alternative: true }. 못 읽으면 null */
export function parseApplicantAge(label: string): ApplicantAge | null {
  if (NOT_APPLICANT_AGE.test(label)) return null;
  const range = label.match(/(?:만\s*)?(\d{2})\s*세?\s*(?:이상)?\s*(?:~|∼|-|부터)?\s*(?:만\s*)?(\d{2})\s*세\s*(이하|미만|까지)?/);
  if (range && Number(range[1]) < Number(range[2]) && plausible(Number(range[1])) && plausible(Number(range[2]))) {
    const max = range[3] === "미만" ? Number(range[2]) - 1 : Number(range[2]);
    return { min: Number(range[1]), max, alternative: ALTERNATIVE.test(label.replace(range[0], "")) };
  }
  const lower = label.match(/(?:만\s*)?(\d{2})\s*세\s*이상/);
  if (lower && plausible(Number(lower[1]))) {
    return { min: Number(lower[1]), alternative: ALTERNATIVE.test(label.replace(lower[0], "")) };
  }
  const upper = label.match(/(?:만\s*)?(\d{2})\s*세\s*(이하|미만)/);
  if (upper && plausible(Number(upper[1]))) {
    const max = upper[2] === "미만" ? Number(upper[1]) - 1 : Number(upper[1]);
    return { max, alternative: ALTERNATIVE.test(label.replace(upper[0], "")) };
  }
  return null;
}

export interface NamedRuleSet extends RuleSet {
  name: string;
  special?: boolean;
}

const joinName = (base: string, suffix: string) => (base ? `${base} · ${suffix}` : suffix);

/**
 * 나이가 "직접 확인할 조건"에만 있는 경로를 판정에 쓰이게 바꾼다(project.md 30번).
 *
 * 공고문이 나이를 "만 19~39세 청년 **또는** 사회초년생"처럼 대안과 묶어 적으면, 조건을 "그리고"로만 다루는 판정 엔진에
 * 넣을 수 없어 AI가 직접 확인 조건으로만 넘겼다 — 그래서 46세도 "청년 계층으로 신청 가능"이 됐다.
 *  - 대안이 있으면 경로를 둘로 나눈다: "… · 만 19~39세"(나이로 판정) + "… · 나이 기준 외 자격"(special → 확인 필요).
 *    주거약자용("만 65세 이상 고령자, 장애인, …")도 같은 방식이라 65세 이상은 이제 신청 가능으로 나온다.
 *  - 대안이 없으면 나이를 그대로 자격 조건에 넣는다("성년자(만 19세 이상)일 것").
 * 이미 나이 조건이 있거나, 나이 문장이 둘 이상이라 애매하거나, 이미 나눈 "나이 기준 외" 경로는 그대로 둔다(다시 돌려도 안전).
 * 초안 단계가 아니라 유닛에 적을 때 나눈다 — 초안에서 나누면 유닛 수가 바뀌어 단지와 순서대로 짝짓는 규칙이 엉뚱하게 걸린다.
 */
export function expandAgeAlternatives<T extends NamedRuleSet>(r: T): T[] {
  if (r.special === true) return [r];
  if (r.eligibility.some((c) => c.field === "age")) return [r];
  const hits = (r.otherRequirements ?? [])
    .filter((o) => o.kind === "eligibility")
    .map((o) => ({ o, age: parseApplicantAge(o.label) }))
    .filter((x): x is { o: OtherRequirement; age: ApplicantAge } => x.age !== null);
  if (hits.length !== 1) return [r];

  const { o, age } = hits[0];
  const ageConditions: Condition[] = [];
  if (age.min !== undefined) {
    ageConditions.push({ id: `age-min-${age.min}`, field: "age", operator: "gte", value: age.min, label: `만 ${age.min}세 이상` });
  }
  if (age.max !== undefined) {
    ageConditions.push({ id: `age-max-${age.max}`, field: "age", operator: "lte", value: age.max, label: `만 ${age.max}세 이하` });
  }
  const range =
    age.min !== undefined && age.max !== undefined
      ? `만 ${age.min}~${age.max}세`
      : age.min !== undefined
        ? `만 ${age.min}세 이상`
        : `만 ${age.max}세 이하`;
  const withAge = {
    ...r,
    eligibility: [...r.eligibility, ...ageConditions],
    otherRequirements: (r.otherRequirements ?? []).filter((x) => x !== o),
  };
  if (!age.alternative) return [withAge];
  return [
    { ...withAge, name: joinName(r.name, range), special: false },
    { ...r, name: joinName(r.name, "나이 기준 외 자격"), special: true },
  ];
}

/* ───────────────────────── 혼인 — 신혼 전용 공고인데 혼인 조건이 빠진 경우 ───────────────────────── */

/** 미혼도 될 수 있는 계층이 함께 적혀 있으면(청년·대학생·일반인 …) 혼인으로 좁히지 않는다 */
const NON_MARITAL_GROUP = /청년|대학생|일반인|고령자|산업단지|근로자|수급|일반\s*공급|주거약자|사회초년생/;
/** 자격 문장이 아니라 서류·절차 안내("예비신혼부부 혼인 증빙 제출", "기계약자 신청 불가") */
const PROCEDURAL = /기계약자|증빙|제출|증명서|중복|불가|입주일/;
/** 혼인하지 않아도 되는 길 — 한부모, 신생아 가구, 유자녀 가구(자녀가 있어야 한다) */
const CHILD_PATH = /한부모|신생아|유자녀|자녀/;

export interface MarriageGroups {
  /** "혼인기간 7년 이내" → 84 */
  months?: number;
  /** 예비신혼부부도 되는가 */
  engaged: boolean;
  /** 한부모·신생아·유자녀 가구처럼 혼인 외의 길이 있는가 */
  childPath: boolean;
}

/**
 * 대상을 정하는 문장인가 — "~중 하나", "혼인기간 N년 이내", "~계층". "예비신혼부부 신청 가능"처럼
 * 다른 사람에 더해 허용하는 문장은 대상을 좁히지 않는다(제주 든든전세에서 미혼을 잘못 탈락시킨 뒤 넣었다).
 */
const RESTRICTS_GROUP = /중\s*하나|혼인\s*(?:기간)?\s*\d+\s*년\s*이내|계층/;
const PERMISSION = /신청\s*가능|신청할\s*수\s*있|도\s*신청/;

/** "신혼부부(혼인기간 7년 이내 …), 예비신혼부부, 한부모가족 중 하나" → { months: 84, engaged, childPath }. 해당 없으면 null */
export function parseMarriageGroups(text: string): MarriageGroups | null {
  if (!/신혼부부/.test(text) || NON_MARITAL_GROUP.test(text) || PROCEDURAL.test(text)) return null;
  if (!RESTRICTS_GROUP.test(text) || PERMISSION.test(text)) return null;
  const m = text.match(/혼인\s*(?:기간)?\s*(\d+)\s*년\s*이내/);
  return { months: m ? Number(m[1]) * 12 : undefined, engaged: /예비\s*신혼/.test(text), childPath: CHILD_PATH.test(text) };
}

/** 혼인 상태 조건이 미혼을 허용하는가(조건이 없어도 허용으로 본다) */
function allowsSingle(r: RuleSet): boolean {
  const marital = r.eligibility.filter((c) => c.field === "maritalStatus");
  if (marital.length === 0) return true;
  return marital.some((c) => c.operator === "neq" || (Array.isArray(c.value) ? c.value : [c.value]).includes("single"));
}

/**
 * 신혼 전용 경로인데 혼인 조건이 빠져 미혼도 통과하던 것을 바로잡는다(project.md 30번).
 * "신혼부부, 예비신혼부부, 한부모가족 중 하나"처럼 한부모(미혼일 수 있음)가 섞여 있어 AI가 혼인 상태를 비우거나
 * 미혼까지 허용했다 — 그래서 신혼희망타운·신혼·신생아 매입임대에서 미혼 30세가 "신청 가능"이었다.
 *  - "… · 신혼부부·예비신혼부부": 기혼(·예비) + 적혀 있으면 혼인 기간 상한
 *  - "… · 한부모·자녀 가구 등"(혼인 외의 길이 적혀 있을 때만): 자녀 1명 이상 + special(확인 필요) —
 *    아이가 6세 이하인지, 한부모인지는 우리가 모른다
 * 근거 문장은 직접 확인 조건 중 하나, 없으면 경로 이름("44A (신혼부부·한부모가족 계층)").
 */
export function expandMarriageAlternatives<T extends NamedRuleSet>(r: T): T[] {
  if (r.special === true || !allowsSingle(r)) return [r];
  const labels = (r.otherRequirements ?? []).filter((o) => o.kind === "eligibility").map((o) => o.label);
  const hits = labels.map(parseMarriageGroups).filter((g): g is MarriageGroups => g !== null);
  const groups = hits.length === 1 ? hits[0] : hits.length === 0 ? parseMarriageGroups(r.name) : null;
  if (!groups) return [r];

  const statuses = groups.engaged ? ["married", "engaged"] : ["married"];
  const marriage: Condition[] = [
    { id: "marital-newlywed", field: "maritalStatus", operator: "in", value: statuses, label: groups.engaged ? "혼인 중 또는 예비신혼부부" : "혼인 중" },
    ...(groups.months
      ? [{ id: `marriage-months-${groups.months}`, field: "marriageMonths" as const, operator: "lte" as const, value: groups.months, label: `혼인 ${groups.months / 12}년 이내` }]
      : []),
  ];
  // 미혼을 허용하던 혼인 조건은 갈아 끼운다
  const rest = r.eligibility.filter((c) => c.field !== "maritalStatus");
  const newlywed = { ...r, eligibility: [...rest, ...marriage] };
  if (!groups.childPath) return [newlywed];
  return [
    { ...newlywed, name: joinName(r.name, groups.engaged ? "신혼부부·예비신혼부부" : "신혼부부"), special: false },
    {
      ...r,
      name: joinName(r.name, "한부모·자녀 가구 등"),
      special: true,
      eligibility: [...rest, { id: "children-1", field: "numChildren", operator: "gte", value: 1, label: "자녀 1명 이상" }],
    },
  ];
}

/** 나이·혼인이 직접 확인 조건에만 있는 경로를 판정에 쓰이게 나눈다. 유닛에 적을 때 이것 하나만 부르면 된다 */
export function expandAlternatives<T extends NamedRuleSet>(r: T): T[] {
  return expandAgeAlternatives(r).flatMap((x) => expandMarriageAlternatives(x));
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
