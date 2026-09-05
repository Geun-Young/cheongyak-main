import type { FactValue, Field, Operator } from "./types";
import { REGIONS } from "./regions";
import { formatManwon, formatMonths } from "./format";
import { bracketLabel } from "./income";
import type { IncomeBracket } from "./types";

export type FieldKind = "number" | "months" | "manwon" | "enum" | "boolean" | "region" | "income";

export interface FieldDef {
  label: string;
  kind: FieldKind;
  unit?: string;
  options?: { value: FactValue; label: string }[];
}

export const FIELD_DEFS: Record<Field, FieldDef> = {
  age: { label: "나이(만)", kind: "number", unit: "세" },
  incomePct: {
    label: "소득 구간",
    kind: "income",
    options: [50, 70, 100, 120, 150, 999].map((b) => ({
      value: b,
      label: bracketLabel(b as IncomeBracket),
    })),
  },
  housingStatus: {
    label: "주택 소유",
    kind: "enum",
    options: [
      { value: "none", label: "무주택" },
      { value: "owner", label: "유주택" },
    ],
  },
  noHousingMonths: { label: "무주택 기간", kind: "months" },
  residenceRegion: { label: "거주 지역", kind: "region", options: REGIONS.map((r) => ({ value: r, label: r })) },
  residenceMonths: { label: "현 지역 거주 기간", kind: "months" },
  maritalStatus: {
    label: "혼인 상태",
    kind: "enum",
    options: [
      { value: "single", label: "미혼" },
      { value: "married", label: "기혼" },
      { value: "engaged", label: "예비 신혼부부" },
    ],
  },
  marriageMonths: { label: "혼인 기간", kind: "months" },
  numChildren: { label: "미성년 자녀 수", kind: "number", unit: "명" },
  householdSize: { label: "가구원 수", kind: "number", unit: "명" },
  hasSubscription: {
    label: "청약통장 가입",
    kind: "boolean",
    options: [
      { value: true, label: "가입" },
      { value: false, label: "미가입" },
    ],
  },
  subscriptionMonths: { label: "청약통장 가입 기간", kind: "months" },
  paymentCount: { label: "청약통장 납입 횟수", kind: "number", unit: "회" },
  totalDeposit: { label: "청약통장 납입 총액", kind: "manwon" },
  totalAssets: { label: "총자산", kind: "manwon" },
  carValue: { label: "자동차가액", kind: "manwon" },
};

export const OPERATOR_LABEL: Record<Operator, string> = {
  eq: "같음",
  neq: "다름",
  lte: "이하",
  gte: "이상",
  in: "중 하나",
};

export function operatorsFor(kind: FieldKind): Operator[] {
  switch (kind) {
    case "number":
    case "months":
    case "manwon":
    case "income":
      return ["lte", "gte", "eq"];
    case "region":
      return ["eq", "in", "neq"];
    case "enum":
      return ["eq", "in", "neq"];
    case "boolean":
      return ["eq"];
  }
}

/** 사용자의 실제 값을 사람이 읽는 문장으로 */
export function describeFact(field: Field, value: FactValue): string {
  const def = FIELD_DEFS[field];
  switch (def.kind) {
    case "number":
      return `${value}${def.unit ?? ""}`;
    case "months":
      return typeof value === "number" ? formatMonths(value) : String(value);
    case "manwon":
      return typeof value === "number" ? formatManwon(value) : String(value);
    case "income":
      return bracketLabel(value as IncomeBracket);
    case "region":
      return String(value);
    case "enum":
    case "boolean":
      return def.options?.find((o) => o.value === value)?.label ?? String(value);
  }
}
