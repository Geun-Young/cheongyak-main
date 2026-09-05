import { REGIONS } from "./regions";
import type { Facts, IncomeBracket, Profile, Region } from "./types";
import { monthsBetween, yearsBetween, startOfToday } from "./format";

/*
 * 프로필 관련 "순수" 데이터와 계산. React 훅이 없어서 서버 컴포넌트에서도 import할 수 있다.
 * 훅(useProfile, useFavorites)은 profile.ts에 있다.
 */

/** 체험용 계정. 로그인 버튼을 누르면 이 프로필로 들어온다. */
export const DEMO_PROFILE: Profile = {
  name: "김청약",
  birthDate: "1994-03-15",
  residenceRegion: "서울",
  residenceSince: "2019-05-01",
  desiredRegions: ["서울", "경기"],
  maritalStatus: "single",
  householdSize: 1,
  numChildren: 0,
  housingStatus: "none",
  noHousingSince: "2015-01-01",
  incomeBracket: 100,
  incomeConfidence: "certain",
  totalAssets: 8_500,
  carValue: 0,
  hasSubscription: true,
  subscriptionType: "주택청약종합저축",
  subscriptionStart: "2020-02-10",
  paymentCount: 78,
  totalDeposit: 780,
  notifications: { deadline: true, newMatch: true, channel: "push" },
  onboardingDone: true,
};

/** 회원가입 직후, 온보딩 전 상태 */
export const EMPTY_PROFILE: Profile = {
  name: "",
  birthDate: "",
  residenceRegion: "서울",
  residenceSince: "",
  desiredRegions: [],
  maritalStatus: "single",
  householdSize: 1,
  numChildren: 0,
  housingStatus: "none",
  incomeBracket: 100,
  incomeConfidence: "unknown",
  totalAssets: 0,
  carValue: 0,
  hasSubscription: false,
  paymentCount: 0,
  totalDeposit: 0,
  notifications: { deadline: true, newMatch: true, channel: "push" },
  onboardingDone: false,
};

/** 비회원 빠른 필터(URL 쿼리)로 임시 프로필을 만든다. 서버에 저장되지 않는다. */
export function profileFromQuery(q: URLSearchParams): Profile | null {
  const region = q.get("region");
  const birthYear = q.get("birthYear");
  const income = q.get("income");
  const marital = q.get("marital");
  const housing = q.get("housing");
  if (!region && !birthYear && !income && !marital && !housing) return null;

  const validRegion = REGIONS.includes(region as Region) ? (region as Region) : "서울";
  const bracket = Number(income);
  const validBracket: IncomeBracket = ([50, 70, 100, 120, 150, 999] as number[]).includes(bracket)
    ? (bracket as IncomeBracket)
    : 100;
  const year = Number(birthYear);
  const today = startOfToday();
  const validYear = year >= 1930 && year <= today.getFullYear() ? year : 1994;

  return {
    ...EMPTY_PROFILE,
    name: "방문자",
    birthDate: `${validYear}-07-01`,
    residenceRegion: validRegion,
    residenceSince: `${today.getFullYear() - 3}-01-01`,
    desiredRegions: [validRegion],
    maritalStatus: marital === "married" ? "married" : marital === "engaged" ? "engaged" : "single",
    marriageDate: marital === "married" ? `${today.getFullYear() - 2}-05-01` : undefined,
    householdSize: marital === "married" ? 2 : 1,
    housingStatus: housing === "owner" ? "owner" : "none",
    noHousingSince: housing === "owner" ? undefined : "2015-01-01",
    incomeBracket: validBracket,
    incomeConfidence: "estimate",
    hasSubscription: true,
    subscriptionStart: `${today.getFullYear() - 3}-01-01`,
    paymentCount: 36,
    totalDeposit: 360,
  };
}

export function deriveFacts(p: Profile, today = startOfToday()): Facts {
  return {
    age: p.birthDate ? yearsBetween(p.birthDate, today) : 0,
    incomePct: p.incomeBracket,
    housingStatus: p.housingStatus,
    noHousingMonths:
      p.housingStatus === "none" && p.noHousingSince ? monthsBetween(p.noHousingSince, today) : 0,
    residenceRegion: p.residenceRegion,
    residenceMonths: p.residenceSince ? monthsBetween(p.residenceSince, today) : 0,
    maritalStatus: p.maritalStatus,
    marriageMonths: p.marriageDate ? monthsBetween(p.marriageDate, today) : 0,
    numChildren: p.numChildren,
    householdSize: p.householdSize,
    hasSubscription: p.hasSubscription,
    subscriptionMonths:
      p.hasSubscription && p.subscriptionStart ? monthsBetween(p.subscriptionStart, today) : 0,
    paymentCount: p.hasSubscription ? p.paymentCount : 0,
    totalDeposit: p.hasSubscription ? p.totalDeposit : 0,
    totalAssets: p.totalAssets,
    carValue: p.carValue,
  };
}
