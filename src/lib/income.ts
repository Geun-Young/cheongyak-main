import type { IncomeBracket, IncomeConfidence } from "./types";

/**
 * 전년도 도시근로자 가구원수별 가구당 월평균소득(100%) — 원 단위.
 * 2026년 적용 기준(2026-01-01 공고분부터). 청약핏(chan-hee1102/myhome) standards.ts의 값을 가져왔고,
 * 1~6인은 SH 인터넷청약 「2026년 도시근로자 월평균소득 기준」 70%·150% 표로 역산해 일치를 확인했다.
 * 7인 이상은 공식 표가 「6인 + 1인당 가산액」 방식이라 가산액(INCOME_EXTRA_PER_PERSON)으로 계산한 값이다.
 * TODO: 매년 초 새 표로 교체. 공고마다 적용 연도가 다를 수 있다(연초 공고는 전년도 표를 쓰기도 한다).
 */
export const INCOME_TABLE_YEAR = 2026;
export const INCOME_EXTRA_PER_PERSON = 579_278;
export const INCOME_100_BY_HOUSEHOLD: Record<number, number> = {
  1: 3_813_363,
  2: 5_866_270,
  3: 8_168_429,
  4: 8_802_202,
  5: 9_326_985,
  6: 9_906_263,
  7: 9_906_263 + INCOME_EXTRA_PER_PERSON,
  8: 9_906_263 + INCOME_EXTRA_PER_PERSON * 2,
};

/** 2026년 건강보험료율 7.19%, 직장가입자 본인부담 3.595% */
export const EMPLOYEE_PREMIUM_RATE = 0.03595;

export const BRACKETS: IncomeBracket[] = [50, 70, 100, 120, 150, 999];

export function bracketLabel(b: IncomeBracket): string {
  return b === 999 ? "150% 초과" : `${b}% 이하`;
}

export function baseIncome(householdSize: number): number {
  const size = Math.max(1, Math.round(householdSize));
  if (size <= 8) return INCOME_100_BY_HOUSEHOLD[size];
  return INCOME_100_BY_HOUSEHOLD[8] + INCOME_EXTRA_PER_PERSON * (size - 8);
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
