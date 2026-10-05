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

/** 수급자·장애인 등 대상 계층. 민감 정보라 프로필(서버)이 아니라 기기에만 둔다(special-groups.ts) */
export type SpecialGroup = "livelihood" | "housingBenefit" | "disabled" | "veteran" | "singleParent";

/**
 * 판정에 쓰는 사용자 사실. groups는 조건(Field)이 아니라 순위·신청 경로 이름에 적힌 대상 계층과 맞춰 본다.
 * null/없음 = 아직 답하지 않음.
 */
export type Facts = Record<Field, FactValue> & { groups?: SpecialGroup[] | null };

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
 * 우리 Field 16개로는 표현할 수 없지만 신청 자격에 실제로 영향을 주는 조건.
 * 예: "해당 산업단지 재직자", "대학생 계층은 자동차 미소유", "수급자 증명서 제출".
 * 자동 판정에는 못 쓰지만 버리면 사용자가 놓치게 되므로, 화면에 "추가 조건"으로 함께 보여준다.
 * kind는 이 조건이 원래 어디에 속하는지다(자격/순위/가점/안내).
 */
export interface OtherRequirement {
  label: string;
  kind: "eligibility" | "tier" | "score" | "other";
  detail?: string;
}

/**
 * 단지(유닛) 안의 "신청 경로" 하나 — 주택형·계층별로 자격이 다를 때.
 * 공고문은 "50㎡ 미만/이상", "일반/주거약자용", "청년/대학생 계층"처럼 경로별로 조건을 주고,
 * 신청자는 그중 하나를 골라 넣는다. 그래서 단지 판정은 "경로 중 하나라도 되면"이다(matching.ts).
 */
export interface UnitVariant {
  /** 공고문의 주택형·계층 이름. 예) "전용면적 50㎡ 이상 주택", "21A (청년 계층)" */
  name: string;
  /**
   * 우리가 묻지 않는 신분이 핵심인 경로인지. 정해 두지 않으면 이름으로 짐작한다(matching.ts isSpecialGroupVariant).
   * 나이로 나눈 경로("주거약자용 · 만 65세 이상")처럼 이름만으로는 틀리게 짐작할 때 명시한다.
   */
  special?: boolean;
  eligibility: Condition[];
  tiers: Tier[];
  scoreRules: ScoreRule[];
  otherRequirements?: OtherRequirement[];
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
  /** 자동 판정에 쓸 수 없는 조건들. 화면에서 "추가 조건"으로 안내한다 */
  otherRequirements?: OtherRequirement[];
  /**
   * 신청 경로(주택형·계층)별 자격. 있으면 위 eligibility/tiers/scoreRules 대신 경로마다 판정한다.
   * 공고문은 주택형별로, 수집 API는 단지별로 나눠서 둘이 1:1로 안 엮일 때 쓴다(project.md 29번).
   */
  variants?: UnitVariant[];
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
  /**
   * 전용면적 표기. 예) "39㎡", "26~46㎡".
   * 공고문에서 뽑으므로 공고 단위다 — 유닛(단지)마다 평형이 다를 수 있어 유닛에 못 붙인다.
   */
  areaLabel?: string;
  /**
   * ㎡당 임대료 계산에 쓸 수 있는 단일 전용면적. 여러 평형이 섞인 공고는 undefined.
   * 이게 없으면 임대료를 면적으로 못 나눠서 "싼 집"과 "작은 집"을 구분할 수 없다.
   */
  areaM2?: number;
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
  /**
   * 유닛에 신청 경로(variants)가 있을 때, 이 결과를 낸 경로.
   * special = 우리가 묻지 않는 신분(주거약자·장애인·수급자·대학생 등)이 핵심인 경로 —
   * 이 경로로만 통과하면 "신청 가능"이라 단정하지 않고 needs_review로 둔다.
   */
  variant?: { index: number; name: string; special: boolean };
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

/**
 * 통근/통학 추천 점수 계산에 쓰는 기준 위치.
 * 정확도를 사용자가 고른다 — "station"은 가까운 역 이름만(프라이버시 부담 적고 도보시간은
 * 역 기준 도보 5~10분으로 근사), "address"는 전체 주소(도보 구간까지 정확히 계산).
 * 둘 다 선택 안 하면(undefined) 통근 점수는 그냥 계산에서 빠진다.
 */
export type CommuteAnchor =
  | { kind: "station"; stationName: string }
  | { kind: "address"; address: string; lat?: number; lng?: number };

export interface Profile {
  name: string;
  birthDate: string;
  residenceRegion: Region;
  residenceSince: string;
  desiredRegions: Region[];
  /**
   * 회사/학교 위치. 통근·통학 추천 점수(공고 위치가 지금 사는 곳보다 얼마나 가까워지는지)에
   * 쓴다. 현재 거주지 좌표는 아직 없어서(residenceRegion은 시도 단위라 너무 넓음) 이것도
   * 함께 받는다 — commuteFrom이 없으면 residenceRegion 중심 좌표로 대략 계산한다.
   */
  commuteFrom?: CommuteAnchor;
  commuteTo?: CommuteAnchor;
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
