export type AgencyCode = "LH" | "SH" | "GH" | "IH" | "BMC" | "PRIVATE" | "UNKNOWN";

export type HousingType =
  | "국민임대"
  | "영구임대"
  | "50년임대"
  | "통합공공임대"
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

/**
 * 공고 하나에 딸린 공급유닛 하나(예: "전용 36㎡ A타입").
 * 자격요건·순위·가점표·위치는 유닛마다 다를 수 있어 여기에 둔다.
 */
export interface SupplyUnit {
  id: string;
  /** 사용자에게 보이는 유닛 이름. 예) "전용 36㎡ A타입" */
  name: string;
  housingType: HousingType;
  rankingMethod: RankingMethod;
  /** 이 유닛의 세대수 */
  unitsCount: number;
  /** 도로명주소. 미확정이면 생략(지도 자리에 "위치 확인 중" 표시) */
  address?: string;
  lat?: number;
  lng?: number;
  rentNote?: string;
  moveIn?: string;
  /** 이 유닛 고유의 보충 설명. 유닛이 하나뿐이면 대개 비워둔다 */
  summary?: string[];
  eligibility: Condition[];
  tiers: Tier[];
  scoreRules: ScoreRule[];
  /** 수집기가 소스에서 더 이상 이 유닛을 못 찾으면 false. 삭제하지 않고 숨기기만 한다 */
  active?: boolean;
}

/**
 * 공고 하나에 대한 상태값 두 가지.
 *
 * status(공개 여부, 원칙적으로 수집기가 결정):
 *   published = 사용자에게 보임 / closed = 접수 마감(마감 탭에만) /
 *   hidden = 관리자가 숨김(중복·오류) / draft = 관리자가 손으로 만드는 중
 * reviewStatus(판정 가능 여부, 원칙적으로 관리자가 결정):
 *   pending = 자격요건 없음("확인 필요") / ready = 판정 동작 /
 *   recheck = ready였는데 소스 값이 바뀌어 재확인 필요
 *
 * 두 축이 독립이라 "공개는 됐지만 아직 판정은 안 되는" published+pending 조합이 정상 상태다.
 * 자세한 배경은 청약순위계산기_공고자동수집_설계서.md 3장.
 */
export type AnnouncementStatus = "draft" | "published" | "closed" | "hidden";
export type ReviewStatus = "ready" | "pending" | "recheck";

export interface Announcement {
  id: string;
  title: string;
  agency: { code: AgencyCode; name: string };
  /** 대표 주택유형(목록 필터·칩 표시용). 유닛마다 다르면 상세 페이지에서 유닛 값이 우선한다 */
  housingType: HousingType;
  /** 지역 매핑에 실패하면 null(관리자 큐로). "전국"으로 뭉개면 모두에게 잘못 노출되므로 쓰지 않는다 */
  region: Region | "전국" | null;
  district: string;
  /** 세대수 총합(= supplyUnits의 unitsCount 합). 목록 카드 표시용으로 필드명을 유지한다 */
  units: number;
  /** 관리자가 정리한 요약. null이면 화면에서 autoSummary로 대체 표시한다 */
  summary: string[] | null;
  /** 수집기가 소스 필드로 조립한 자동 요약. summary가 채워지면 화면에선 무시된다 */
  autoSummary?: string[];
  announcedAt: string;
  applyStart: string;
  applyEnd: string;
  originalUrl: string;
  /**
   * originalUrl이 무엇을 가리키는지.
   * notice = 공고문 원문(연동 후 API의 공고상세URL), list = 기관 공고 목록, home = 기관 홈.
   * 생략하면 notice.
   */
  originalUrlKind?: "notice" | "list" | "home";
  /** 대표 순위 산정 방식(목록 칩 표시용) */
  rankingMethod: RankingMethod;
  status: AnnouncementStatus;
  reviewStatus: ReviewStatus;
  /** 이 공고에 속한 공급유닛들. 최소 1개 이상이어야 한다 */
  supplyUnits: SupplyUnit[];

  // --- 자동수집 메타(설계서 4장) ---
  /** 데이터 출처. "manual"은 관리자가 직접 만든 공고 */
  source?: "myhome" | "applyhome" | "manual";
  sourceId?: string;
  /** "조건 정리되면 알려주세요" 버튼을 누른 회원 수. 관리자 큐 정렬 기준 */
  requestCount?: number;
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
  unitId: string;
  status: EligibilityStatus;
  unmet: Condition[];
  tier?: Tier;
  points: number;
  maxPoints: number;
  breakdown: ScoreLine[];
}

/** 공고 하나에 속한 유닛들을 전부 판정한 결과 묶음 */
export interface AnnouncementMatchSummary {
  announcementId: string;
  /** supplyUnits와 같은 순서·길이 */
  unitResults: MatchResult[];
  /** 사용자에게 가장 먼저 보여줄 대표 결과(eligible 우선 → 조건에 더 가까운 유닛 순) */
  best: MatchResult;
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
