import type { Profile } from "./types";
import { formatMonths, isoDate, monthsBetween, startOfToday, toDate } from "./format";

/**
 * 민영주택 청약가점 84점 — 주택공급에 관한 규칙 [별표 1] 가점제 적용기준.
 *   무주택기간 32 + 부양가족 수 35 + 청약통장 가입기간 17
 *
 * 점수표와 "만 30세·혼인신고일부터 센다" 규칙은 청약핏(chan-hee1102/myhome)의 rules/gajeom.ts를 옮겨 왔다.
 * 다른 점: 그쪽은 출생·혼인을 연도로만 받아 1년 오차가 생기는데, 우리 Profile은 날짜를 가지고 있어서
 * 개월 단위로 센다.
 *
 * 공공임대·공공분양은 이 가점을 쓰지 않는다(순위·배점표·납입 횟수로 뽑는다). 민영 아파트 일반공급 전용이다.
 */

export const GAJEOM_MAX = { homeless: 32, dependents: 35, account: 17, total: 84 } as const;

/** 무주택기간(년) → 점수. 1년 미만 2점, 이후 1년마다 2점, 15년 이상 32점 */
export function homelessPoints(years: number): number {
  if (years < 1) return 2;
  return Math.min(32, 2 + Math.floor(years) * 2);
}

/** 부양가족 수 → 점수. 0명 5점, 1명당 5점, 6명 이상 35점 */
export function dependentPoints(count: number): number {
  return Math.min(35, 5 + Math.max(0, Math.floor(count)) * 5);
}

/** 청약통장 가입기간(개월) → 점수. 6개월 미만 1점, 6개월~1년 2점, 이후 1년마다 1점, 15년 이상 17점. 통장이 없으면 0점 */
export function accountPoints(months: number | null): number {
  if (months == null || months < 0) return 0;
  if (months < 6) return 1;
  if (months < 12) return 2;
  return Math.min(17, 2 + Math.floor(months / 12));
}

/** 배우자 통장 가입기간 점수의 절반(최대 3점). 2024-03-25 시행. 본인 점수와 합쳐도 17점을 넘지 않는다 */
export function spouseAccountBonus(months: number | null): number {
  if (months == null || months < 0) return 0;
  return Math.min(3, Math.floor(accountPoints(months) / 2));
}

export interface GajeomInput {
  /** false면 무주택 0점 — 집이 있거나, 만 30세 전 미혼이라 아직 세기 시작하지 않은 경우 */
  homeless: boolean;
  /** 규칙(만 30세·혼인신고일·무주택이 된 날)을 이미 적용한 무주택 기간(년) */
  homelessYears: number;
  dependents: number;
  /** null = 통장 없음 */
  accountMonths: number | null;
  spouseAccountMonths?: number | null;
}

export type GajeomKey = "homeless" | "dependents" | "account";

export interface GajeomLine {
  key: GajeomKey;
  label: string;
  points: number;
  max: number;
  note: string;
}

function accountText(months: number | null): string {
  if (months == null) return "통장 없음";
  if (months < 6) return "6개월 미만";
  if (months < 12) return "6개월~1년";
  return `${Math.floor(months / 12)}년${months >= 180 ? " 이상" : ""}`;
}

export function computeGajeom(input: GajeomInput): { total: number; lines: GajeomLine[] } {
  const h = input.homeless ? homelessPoints(input.homelessYears) : 0;
  const d = dependentPoints(input.dependents);
  const own = accountPoints(input.accountMonths);
  const bonus = spouseAccountBonus(input.spouseAccountMonths ?? null);
  const a = Math.min(17, own + bonus);
  const lines: GajeomLine[] = [
    {
      key: "homeless",
      label: "무주택 기간",
      points: h,
      max: GAJEOM_MAX.homeless,
      note: !input.homeless
        ? "0점 (집이 있거나 만 30세 전 미혼)"
        : input.homelessYears < 1
          ? "1년 미만"
          : `${Math.floor(input.homelessYears)}년${input.homelessYears >= 15 ? " 이상" : ""}`,
    },
    {
      key: "dependents",
      label: "부양가족",
      points: d,
      max: GAJEOM_MAX.dependents,
      note: `${Math.min(6, input.dependents)}명${input.dependents >= 6 ? " 이상" : ""}`,
    },
    {
      key: "account",
      label: "청약통장 가입 기간",
      points: a,
      max: GAJEOM_MAX.account,
      note: accountText(input.accountMonths) + (bonus ? ` + 배우자 통장 ${bonus}점${own + bonus > 17 ? "(17점까지)" : ""}` : ""),
    },
  ];
  return { total: h + d + a, lines };
}

/* ───────────────────────── 프로필 → 계산기 초기값 ───────────────────────── */

export interface GajeomPrefill {
  /** 프로필로 알 수 없는 칸은 비워 둔다(계산기의 현재 값을 그대로 둔다) */
  input: Partial<GajeomInput>;
  /** 항목별로 어떻게 셌는지 한 줄씩 */
  notes: Partial<Record<GajeomKey, string>>;
}

const ym = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
const span = (months: number) => (months < 12 ? "1년 미만" : formatMonths(months));

/**
 * 무주택 기간 — 만 30세 생일과 혼인신고일(만 30세 전 혼인) 중 빠른 날부터,
 * 무주택이 된 날(noHousingSince) 이후로만 센다. 만 30세 전 미혼이거나 집이 있으면 0점.
 */
function homelessFromProfile(p: Profile, today: Date): { input: Partial<GajeomInput>; note: string } {
  if (p.housingStatus === "owner") {
    return { input: { homeless: false, homelessYears: 0 }, note: "세대에 집이 있으면 무주택 기간은 0점이에요." };
  }
  if (!p.birthDate) return { input: {}, note: "생년월일을 입력하면 무주택 기간을 계산해요." };

  const birth = toDate(p.birthDate);
  const turn30 = new Date(birth.getFullYear() + 30, birth.getMonth(), birth.getDate());
  const married = p.maritalStatus === "married";
  const marriage = married && p.marriageDate ? toDate(p.marriageDate) : undefined;
  const fromMarriage = marriage !== undefined && marriage < turn30;
  // 혼인 중인데 신고일을 모르면 만 30세 기준(더 짧은 쪽)으로 센다
  const unknownMarriage = married && !marriage ? " 만 30세 전에 혼인신고했다면 그날부터라 더 길어요." : "";

  const start = fromMarriage ? marriage : turn30;
  if (start > today) {
    if (married) {
      // 만 30세 전인데 혼인 중 — 혼인신고일부터 세야 하지만 날짜를 모른다. 최소값(1년 미만)으로 둔다
      return {
        input: { homeless: true, homelessYears: 0 },
        note: "만 30세 전에 결혼했다면 혼인신고일부터 세요. 혼인신고일을 입력하면 정확해져요.",
      };
    }
    return {
      input: { homeless: false, homelessYears: 0 },
      note: `만 30세가 되는 ${ym(turn30)}부터 세요. 지금은 0점이에요.`,
    };
  }

  const since = p.noHousingSince ? toDate(p.noHousingSince) : undefined;
  const from = since && since > start ? since : start;
  const months = monthsBetween(isoDate(from), today);
  const head = fromMarriage ? `혼인신고일(${ym(marriage)})부터` : `만 30세(${ym(turn30)})부터`;
  // 무주택이 된 날이 더 늦으면 그날이 기준이라, 혼인신고일을 몰라도 결과가 같다
  if (from === since) {
    return {
      input: { homeless: true, homelessYears: months / 12 },
      note: `${head} 세는데, 무주택이 된 ${ym(since)} 이후만 인정돼서 ${span(months)}이에요.`,
    };
  }
  return { input: { homeless: true, homelessYears: months / 12 }, note: `${head} ${span(months)}이에요.${unknownMarriage}` };
}

/**
 * 부양가족 — 배우자와 자녀는 프로필로 센다. 직계존속(부모·조부모)은 "3년 넘게 같은 등본"이어야 해서
 * 프로필만으로는 알 수 없다 — 세대원이 더 있으면 직접 더하라고 안내만 한다.
 */
function dependentsFromProfile(p: Profile): { count: number; note: string } {
  const spouse = p.maritalStatus === "married" ? 1 : 0;
  const count = spouse + p.numChildren;
  const parts = [spouse ? "배우자" : "", p.numChildren ? `자녀 ${p.numChildren}명` : ""].filter(Boolean);
  const extra = p.householdSize - 1 - count;
  const head = count === 0 ? "배우자·자녀가 없어서 0명이에요." : `${parts.join(" · ")}, 모두 ${count}명이에요.`;
  const tail =
    extra > 0
      ? ` 세대원이 ${extra}명 더 있어요. 3년 넘게 같은 등본에 올라 있는 부모님·조부모님이면 1명씩 더하세요.`
      : "";
  return { count, note: head + tail };
}

function accountFromProfile(p: Profile, today: Date): { input: Partial<GajeomInput>; note: string } {
  if (!p.hasSubscription) return { input: { accountMonths: null }, note: "청약통장이 없으면 0점이에요." };
  if (!p.subscriptionStart) return { input: {}, note: "통장 가입일을 입력하면 계산해요." };
  const months = monthsBetween(p.subscriptionStart, today);
  const warn =
    p.subscriptionType === "청약저축" ? " 다만 청약저축은 국민주택(공공) 전용이라 민영주택에는 쓸 수 없어요." : "";
  return {
    input: { accountMonths: months },
    note: `${ym(toDate(p.subscriptionStart))}에 가입해서 ${span(months)}이에요.${warn}`,
  };
}

export function gajeomFromProfile(p: Profile, today = startOfToday()): GajeomPrefill {
  const h = homelessFromProfile(p, today);
  const d = dependentsFromProfile(p);
  const a = accountFromProfile(p, today);
  return {
    input: { ...h.input, dependents: d.count, ...a.input },
    notes: { homeless: h.note, dependents: d.note, account: a.note },
  };
}
