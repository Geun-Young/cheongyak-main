export type AgencyCode = "LH" | "SH" | "GH" | "IH" | "BMC" | "PRIVATE";

export type HousingType =
  | "국민임대"
  | "행복주택"
  | "매입임대"
  | "전세임대"
  | "장기전세"
  | "청년안심주택"
  | "신혼희망타운"
  | "공공분양"
  | "공공지원민간임대";

export type Region =
  | "서울" | "부산" | "대구" | "인천" | "광주" | "대전" | "울산" | "세종"
  | "경기" | "강원" | "충북" | "충남" | "전북" | "전남" | "경북" | "경남" | "제주";

export type RankingMethod = "순위+가점" | "가점제" | "추첨제" | "저축액순";

/** 매칭 엔진이 비교하는 사용자 사실(fact) 키 */
export type Field =
  | "age"
  | "incomePct"
  | "housingStatus"
  | "noHousingMonths"
  | "residenceRegion"
  | "residenceMonths"
  | "maritalStatus"
  | "marriageMonths"
  | "numChildren"
  | "householdSize"
  | "hasSubscription"
  | "subscriptionMonths"
  | "paymentCount"
  | "totalDeposit"
  | "totalAssets"
  | "carValue";

export type Operator = "eq" | "neq" | "lte" | "gte" | "in";
export type FactValue = number | string | boolean;
export type Facts = Record<Field, FactValue>;

export interface Condition {
  id: string;
  field: Field;
  operator: Operator;
  value: FactValue | FactValue[];
  /** 사용자에게 보이는 문장. 예) "무주택 세대구성원" */
  label: string;
  /** 미달 시 덧붙이는 설명 */
  help?: string;
}

export interface Tier {
  rank: 1 | 2 | 3;
  label: string;
  conditions: Condition[];
}

export interface ScoreBand {
  gte?: number;
  lte?: number;
  eq?: FactValue;
  points: number;
  note: string;
}

export interface ScoreRule {
  id: string;
  label: string;
  field: Field;
  bands: ScoreBand[];
}

export interface Announcement {
  id: string;
  title: string;
  agency: { code: AgencyCode; name: string };
  housingType: HousingType;
  region: Region | "전국";
  district: string;
  units: number;
  /** 관리자가 사람 말로 정리한 요약 3~5줄 */
  summary: string[];
  announcedAt: string;
  applyStart: string;
  applyEnd: string;
  moveIn?: string;
  rentNote?: string;
  originalUrl: string;
  /**
   * originalUrl이 무엇을 가리키는지.
   * notice = 공고문 원문(연동 후 API의 공고상세URL), list = 기관 공고 목록, home = 기관 홈.
   * 생략하면 notice.
   */
  originalUrlKind?: "notice" | "list" | "home";
  rankingMethod: RankingMethod;
  /** pending이면 조건이 아직 정리되지 않아 "확인 필요" */
  reviewStatus: "ready" | "pending";
  status: "draft" | "published" | "closed";
  eligibility: Condition[];
  tiers: Tier[];
  scoreRules: ScoreRule[];
}

export type EligibilityStatus = "eligible" | "ineligible" | "needs_review" | "closed";

export interface ScoreLine {
  label: string;
  points: number;
  maxPoints: number;
  note: string;
}

export interface MatchResult {
  announcementId: string;
  status: EligibilityStatus;
  unmet: Condition[];
  tier?: Tier;
  points: number;
  maxPoints: number;
  breakdown: ScoreLine[];
}

export type IncomeBracket = 50 | 70 | 100 | 120 | 150 | 999;
export type IncomeConfidence = "certain" | "estimate" | "unknown";

export interface Profile {
  name: string;
  birthDate: string;
  residenceRegion: Region;
  residenceSince: string;
  desiredRegions: Region[];
  maritalStatus: "single" | "married" | "engaged";
  marriageDate?: string;
  householdSize: number;
  numChildren: number;
  housingStatus: "none" | "owner";
  noHousingSince?: string;
  incomeBracket: IncomeBracket;
  incomeConfidence: IncomeConfidence;
  /** 만원 단위 */
  totalAssets: number;
  /** 만원 단위 */
  carValue: number;
  hasSubscription: boolean;
  subscriptionType?: "주택청약종합저축" | "청약저축" | "청약예금" | "청약부금";
  subscriptionStart?: string;
  paymentCount: number;
  /** 만원 단위 */
  totalDeposit: number;
  notifications: {
    deadline: boolean;
    newMatch: boolean;
    channel: "push" | "kakao";
  };
  onboardingDone: boolean;
}

export interface Notification {
  id: string;
  type: "deadline" | "new_match";
  announcementId: string;
  message: string;
  sentAt: string;
  read: boolean;
}
