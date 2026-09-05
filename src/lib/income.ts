import type { IncomeBracket, IncomeConfidence } from "./types";

/**
 * 전년도 도시근로자 가구원수별 가구당 월평균소득(100%) — 원 단위.
 * 2025년 적용 기준(2024년 소득)으로 넣어둔 자리표시 값이다.
 * TODO(연동): 매년 3~4월 통계청 발표치로 교체하고 공고별 적용연도를 따를 것.
 */
export const INCOME_TABLE_YEAR = 2025;
export const INCOME_100_BY_HOUSEHOLD: Record<number, number> = {
  1: 3_482_964,
  2: 5_415_712,
  3: 7_198_649,
  4: 8_248_467,
  5: 8_775_071,
  6: 9_563_282,
  7: 10_351_493,
  8: 11_139_704,
};

/** 2026년 건강보험료율 7.19%, 직장가입자 본인부담 3.595% */
export const EMPLOYEE_PREMIUM_RATE = 0.03595;

export const BRACKETS: IncomeBracket[] = [50, 70, 100, 120, 150, 999];

export function bracketLabel(b: IncomeBracket): string {
  return b === 999 ? "150% 초과" : `${b}% 이하`;
}

export function baseIncome(householdSize: number): number {
  const size = Math.min(8, Math.max(1, householdSize));
  return INCOME_100_BY_HOUSEHOLD[size];
}

export function bracketFromPct(pct: number): IncomeBracket {
  for (const b of BRACKETS) {
    if (b === 999) return 999;
    if (pct <= b) return b;
  }
  return 999;
}

export interface IncomeEstimate {
  monthlyIncome: number;
  pct: number;
  bracket: IncomeBracket;
  confidence: IncomeConfidence;
  reason: string;
}

/** 월 소득(세전, 원)으로 구간 계산 */
export function estimateFromIncome(monthlyIncome: number, householdSize: number): IncomeEstimate {
  const base = baseIncome(householdSize);
  const pct = (monthlyIncome / base) * 100;
  return {
    monthlyIncome,
    pct,
    bracket: bracketFromPct(pct),
    confidence: "estimate",
    reason: "직접 입력한 소득이라 기관 심사 자료와 다를 수 있어요.",
  };
}

/** 건강보험료 본인부담금(원)으로 보수월액을 역산해 구간 계산 */
export function estimateFromPremium(
  premium: number,
  householdSize: number,
  insured: "employee" | "regional",
): IncomeEstimate {
  const monthlyIncome = premium / EMPLOYEE_PREMIUM_RATE;
  const base = baseIncome(householdSize);
  const pct = (monthlyIncome / base) * 100;
  const bracket = bracketFromPct(pct);
  if (insured === "employee") {
    return {
      monthlyIncome,
      pct,
      bracket,
      confidence: "certain",
      reason: "직장가입자는 보험료가 보수월액에 비례해서 거의 정확해요.",
    };
  }
  return {
    monthlyIncome,
    pct,
    bracket,
    confidence: "estimate",
    reason: "지역가입자 보험료엔 재산이 섞여 있어 실제 소득보다 높게 나올 수 있어요.",
  };
}
