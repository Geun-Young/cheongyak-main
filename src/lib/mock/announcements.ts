import type { Announcement, Condition, Field, Operator, FactValue, ScoreRule, Tier } from "../types";
import { CAPITAL_AREA } from "../regions";
import { addDays, isoDate, startOfToday } from "../format";

/*
 * 목업 공고 데이터.
 * 날짜는 오늘 기준 상대값이라 언제 열어도 "마감 2일 전" 같은 상태가 살아 있다.
 * 연동 단계에서 마이홈포털·LH·청약홈 API + 관리자 CMS 데이터로 교체된다.
 */

const today = startOfToday();
const d = (n: number) => isoDate(addDays(today, n));

let seq = 0;
function c(field: Field, operator: Operator, value: FactValue | FactValue[], label: string, help?: string): Condition {
  seq += 1;
  return { id: `c${seq}`, field, operator, value, label, help };
}

const noHouse = () =>
  c("housingStatus", "eq", "none", "무주택 세대구성원", "세대원 전원이 주택을 소유하지 않아야 해요.");
const income = (pct: number) =>
  c("incomePct", "lte", pct, `소득 ${pct}% 이하`, `가구원수별 도시근로자 월평균소득의 ${pct}% 이하여야 해요.`);
const assets = (manwon: number) =>
  c("totalAssets", "lte", manwon, `총자산 ${(manwon / 10000).toFixed(2).replace(/\.?0+$/, "")}억 원 이하`);
const car = (manwon: number) =>
  c("carValue", "lte", manwon, `자동차가액 ${manwon.toLocaleString("ko-KR")}만 원 이하`);
const noCar = () => c("carValue", "eq", 0, "자동차 미소유");
const ageMin = (n: number) => c("age", "gte", n, `만 ${n}세 이상`);
const ageMax = (n: number) => c("age", "lte", n, `만 ${n}세 이하`);
const single = () => c("maritalStatus", "eq", "single", "미혼");
const married = () =>
  c("maritalStatus", "in", ["married", "engaged"], "혼인 중 또는 예비 신혼부부", "혼인신고 예정이면 예비 신혼부부로 신청할 수 있어요.");
const marriedWithin = (months: number) =>
  c("marriageMonths", "lte", months, `혼인 ${months / 12}년 이내`);
const region = (r: string) => c("residenceRegion", "eq", r, `${r} 거주`, "주민등록등본 기준 거주지예요.");
const regionIn = (rs: string[], label: string) => c("residenceRegion", "in", rs, label);
const hasAccount = () => c("hasSubscription", "eq", true, "청약통장 가입");
const accountMonths = (n: number) => c("subscriptionMonths", "gte", n, `청약통장 가입 ${n}개월 이상`);
const payCount = (n: number) => c("paymentCount", "gte", n, `청약통장 ${n}회 이상 납입`);

const tier = (rank: 1 | 2 | 3, label: string, conditions: Condition[]): Tier => ({ rank, label, conditions });

const nationalRentalScore: ScoreRule[] = [
  {
    id: "residence",
    label: "해당 지역 거주 기간",
    field: "residenceMonths",
    bands: [
      { gte: 60, points: 3, note: "5년 이상" },
      { gte: 36, points: 2, note: "3년 이상 5년 미만" },
      { gte: 12, points: 1, note: "1년 이상 3년 미만" },
      { points: 0, note: "1년 미만" },
    ],
  },
  {
    id: "household",
    label: "부양가족 수",
    field: "householdSize",
    bands: [
      { gte: 4, points: 3, note: "3명 이상" },
      { gte: 3, points: 2, note: "2명" },
      { gte: 2, points: 1, note: "1명" },
      { points: 0, note: "부양가족 없음" },
    ],
  },
  {
    id: "payments",
    label: "청약저축 납입 횟수",
    field: "paymentCount",
    bands: [
      { gte: 60, points: 3, note: "60회 이상" },
      { gte: 48, points: 2, note: "48회 이상 60회 미만" },
      { gte: 36, points: 1, note: "36회 이상 48회 미만" },
      { points: 0, note: "36회 미만" },
    ],
  },
  {
    id: "children",
    label: "미성년 자녀 수",
    field: "numChildren",
    bands: [
      { gte: 3, points: 3, note: "3명 이상" },
      { gte: 2, points: 2, note: "2명" },
      { gte: 1, points: 1, note: "1명" },
      { points: 0, note: "자녀 없음" },
    ],
  },
];

const youthScore: ScoreRule[] = [
  {
    id: "residence",
    label: "해당 지역 거주 기간",
    field: "residenceMonths",
    bands: [
      { gte: 36, points: 3, note: "3년 이상" },
      { gte: 12, points: 2, note: "1년 이상 3년 미만" },
      { points: 1, note: "1년 미만" },
    ],
  },
  {
    id: "payments",
    label: "청약통장 납입 횟수",
    field: "paymentCount",
    bands: [
      { gte: 24, points: 3, note: "24회 이상" },
      { gte: 12, points: 2, note: "12회 이상 24회 미만" },
      { gte: 6, points: 1, note: "6회 이상 12회 미만" },
      { points: 0, note: "6회 미만" },
    ],
  },
];

const saleScore: ScoreRule[] = [
  {
    id: "noHousing",
    label: "무주택 기간",
    field: "noHousingMonths",
    bands: [
      { gte: 180, points: 32, note: "15년 이상" },
      { gte: 120, points: 22, note: "10년 이상 15년 미만" },
      { gte: 60, points: 12, note: "5년 이상 10년 미만" },
      { gte: 12, points: 4, note: "1년 이상 5년 미만" },
      { points: 2, note: "1년 미만" },
    ],
  },
  {
    id: "household",
    label: "부양가족 수",
    field: "householdSize",
    bands: [
      { gte: 5, points: 25, note: "4명 이상" },
      { gte: 4, points: 20, note: "3명" },
      { gte: 3, points: 15, note: "2명" },
      { gte: 2, points: 10, note: "1명" },
      { points: 5, note: "부양가족 없음" },
    ],
  },
  {
    id: "accountMonths",
    label: "청약통장 가입 기간",
    field: "subscriptionMonths",
    bands: [
      { gte: 180, points: 17, note: "15년 이상" },
      { gte: 120, points: 12, note: "10년 이상 15년 미만" },
      { gte: 60, points: 7, note: "5년 이상 10년 미만" },
      { gte: 24, points: 3, note: "2년 이상 5년 미만" },
      { points: 1, note: "2년 미만" },
    ],
  },
];

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "lh-gangdong-national-2026-2",
    title: "서울강동 국민임대주택 예비입주자 모집",
    agency: { code: "LH", name: "LH 한국토지주택공사" },
    housingType: "국민임대",
    region: "서울",
    district: "서울 강동구",
    units: 320,
    summary: [
      "강동구 고덕·강일 지구 국민임대 4개 단지의 예비입주자를 뽑아요. 순번대로 빈집이 나면 연락이 와요.",
      "소득 70% 이하가 기본이고, 1인 가구는 90%까지 봐줘요. 자산 3억 3,700만 원, 차량 3,803만 원 이하여야 해요.",
      "전용 36㎡·46㎡ 두 타입이고, 46㎡는 청약통장 6회 이상 납입이 필요해요.",
      "해당 지역(서울) 거주자가 1순위이고, 그 안에서 거주 기간·부양가족·납입 횟수로 가점을 매겨요.",
    ],
    announcedAt: d(-12),
    applyStart: d(-4),
    applyEnd: d(2),
    moveIn: "예비입주자 순번에 따라 수시",
    rentNote: "보증금 2,800만 ~ 4,100만 원 / 월 18만 ~ 27만 원",
    originalUrl: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026",
    originalUrlKind: "list",
    rankingMethod: "순위+가점",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), income(100), assets(33_700), car(3_803)],
    tiers: [
      tier(1, "서울 거주", [region("서울")]),
      tier(2, "수도권 거주", [regionIn(CAPITAL_AREA, "수도권 거주")]),
      tier(3, "그 외 지역", []),
    ],
    scoreRules: nationalRentalScore,
  },
  {
    id: "sh-purchase-2026-3",
    title: "서울시 매입임대주택 입주자 모집 (2026년 3차)",
    agency: { code: "SH", name: "SH 서울주택도시공사" },
    housingType: "매입임대",
    region: "서울",
    district: "서울 전역 (18개 자치구)",
    units: 150,
    summary: [
      "서울시가 사들인 다세대·오피스텔 150호를 시세 30~50% 수준으로 임대해요.",
      "소득 50% 이하가 1순위, 70% 이하가 2순위예요. 그 위 구간은 신청할 수 없어요.",
      "공고일 기준 서울에 1년 이상 살고 있어야 해요.",
      "자치구별로 물량이 달라서 원하는 구를 하나만 골라 신청해요.",
    ],
    announcedAt: d(-9),
    applyStart: d(-1),
    applyEnd: d(5),
    moveIn: "2027년 1분기",
    rentNote: "보증금 1,000만 ~ 3,500만 원 / 월 12만 ~ 30만 원",
    originalUrl: "https://www.i-sh.co.kr/app/lay2/program/S48T1581C563/www/brd/m_247/list.do?multi_itm_seq=2",
    originalUrlKind: "list",
    rankingMethod: "순위+가점",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), income(70), assets(33_700), car(3_803), region("서울")],
    tiers: [
      tier(1, "소득 50% 이하", [income(50)]),
      tier(2, "소득 70% 이하", [income(70)]),
    ],
    scoreRules: nationalRentalScore.slice(0, 3),
  },
  {
    id: "sh-youth-yeoksam",
    title: "청년안심주택 공공임대 입주자 모집 (역삼동)",
    agency: { code: "SH", name: "SH 서울주택도시공사" },
    housingType: "청년안심주택",
    region: "서울",
    district: "서울 강남구 역삼동",
    units: 80,
    summary: [
      "역삼역 도보 5분 신축 오피스텔형 80호. 청년 60호, 신혼부부 20호로 나눠 뽑아요.",
      "청년은 만 19~39세 미혼 무주택자, 소득 100% 이하(1인 가구), 자산 2억 5,400만 원 이하, 차량이 없어야 해요.",
      "서울 거주자가 1순위이고 같은 순위 안에서는 추첨이에요.",
      "임대료는 주변 시세의 30~50% 수준, 최장 6년 살 수 있어요.",
    ],
    announcedAt: d(-14),
    applyStart: d(-6),
    applyEnd: d(1),
    moveIn: "2027년 4월",
    rentNote: "보증금 4,500만 원 / 월 26만 원 (청년형 기준)",
    originalUrl: "https://soco.seoul.go.kr/youth/bbs/BMSR00015/list.do?menuNo=400008",
    originalUrlKind: "list",
    rankingMethod: "추첨제",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), ageMin(19), ageMax(39), single(), income(100), assets(25_400), noCar()],
    tiers: [
      tier(1, "서울 거주", [region("서울")]),
      tier(2, "수도권 거주", [regionIn(CAPITAL_AREA, "수도권 거주")]),
      tier(3, "그 외 지역", []),
    ],
    scoreRules: [],
  },
  {
    id: "lh-hanam-gamil-happy",
    title: "하남감일 신혼희망타운 행복주택 입주자 모집",
    agency: { code: "LH", name: "LH 한국토지주택공사" },
    housingType: "신혼희망타운",
    region: "경기",
    district: "경기 하남시 감일지구",
    units: 200,
    summary: [
      "감일지구 A-4블록 신혼희망타운 중 행복주택(임대) 200호예요.",
      "공고문이 아직 정리 중이에요. 조건이 확정되면 바로 판정을 알려드릴게요.",
    ],
    announcedAt: d(-2),
    applyStart: d(3),
    applyEnd: d(7),
    moveIn: "2027년 하반기",
    originalUrl: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026",
    originalUrlKind: "list",
    rankingMethod: "가점제",
    reviewStatus: "pending",
    status: "published",
    eligibility: [],
    tiers: [],
    scoreRules: [],
  },
  {
    id: "gh-purchase-gyeonggi-2026-4",
    title: "경기도 매입임대주택 예비입주자 모집 (4차)",
    agency: { code: "GH", name: "GH 경기주택도시공사" },
    housingType: "매입임대",
    region: "경기",
    district: "경기 전역 (수원·성남·고양 외 12개 시)",
    units: 180,
    summary: [
      "경기도 15개 시의 매입임대 180호 예비입주자를 뽑아요.",
      "공고일 기준 경기도에 거주해야 하고, 소득 70% 이하여야 해요.",
      "청약통장은 필요 없어요. 거주 기간과 부양가족 수로 가점을 매겨요.",
    ],
    announcedAt: d(-6),
    applyStart: d(0),
    applyEnd: d(10),
    moveIn: "2027년 상반기",
    rentNote: "보증금 800만 ~ 2,500만 원 / 월 9만 ~ 22만 원",
    originalUrl: "https://apply.gh.or.kr/sb/sr/sr7150/selectPbancRentHouseList.do",
    originalUrlKind: "list",
    rankingMethod: "순위+가점",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), income(70), assets(33_700), car(3_803), region("경기")],
    tiers: [tier(1, "소득 50% 이하", [income(50)]), tier(2, "소득 70% 이하", [income(70)])],
    scoreRules: nationalRentalScore.slice(0, 2),
  },
  {
    id: "lh-oryu-happy-youth",
    title: "서울 오류동 행복주택 청년 계층 입주자 모집",
    agency: { code: "LH", name: "LH 한국토지주택공사" },
    housingType: "행복주택",
    region: "서울",
    district: "서울 구로구 오류동",
    units: 120,
    summary: [
      "오류동역 역세권 행복주택 청년 계층 120호예요. 전용 26㎡·36㎡.",
      "만 19~39세, 미혼, 무주택, 소득 100% 이하(1인 120%), 자산 2억 5,400만 원 이하, 차량 3,803만 원 이하.",
      "청약통장에 가입만 되어 있으면 돼요. 납입 횟수는 가점에만 반영돼요.",
      "구로구 거주·재직자가 1순위, 서울 거주자가 2순위예요.",
    ],
    announcedAt: d(-10),
    applyStart: d(-3),
    applyEnd: d(15),
    moveIn: "2027년 2월",
    rentNote: "보증금 3,200만 원 / 월 19만 원 (26㎡)",
    originalUrl: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026",
    originalUrlKind: "list",
    rankingMethod: "순위+가점",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), ageMin(19), ageMax(39), single(), income(120), assets(25_400), car(3_803), hasAccount()],
    tiers: [
      tier(1, "서울 거주", [region("서울")]),
      tier(2, "수도권 거주", [regionIn(CAPITAL_AREA, "수도권 거주")]),
      tier(3, "그 외 지역", []),
    ],
    scoreRules: youthScore,
  },
  {
    id: "lh-jeonse-youth-2026-3",
    title: "2026년 3차 청년 전세임대주택 입주자 모집",
    agency: { code: "LH", name: "LH 한국토지주택공사" },
    housingType: "전세임대",
    region: "전국",
    district: "전국 (수도권 한도 1억 2,000만 원)",
    units: 3000,
    summary: [
      "내가 고른 집의 전세보증금을 LH가 집주인에게 지원하고, 나는 낮은 이자만 내는 방식이에요.",
      "만 19~39세 무주택 청년이면 신청할 수 있어요. 순위는 수급자·한부모(1순위), 본인+부모 소득 50% 이하(2순위), 본인 소득 100% 이하(3순위)로 갈려요.",
      "3순위도 물량이 있어요. 순위 안에서는 추첨이에요.",
    ],
    announcedAt: d(-8),
    applyStart: d(-2),
    applyEnd: d(20),
    moveIn: "당첨 후 6개월 내 집 계약",
    rentNote: "보증금 100만 ~ 200만 원 / 월 이자 10만 ~ 25만 원 내외",
    originalUrl: "https://jeonse.lh.or.kr",
    originalUrlKind: "home",
    rankingMethod: "추첨제",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), ageMin(19), ageMax(39), income(100)],
    tiers: [tier(2, "소득 50% 이하", [income(50)]), tier(3, "소득 100% 이하", [income(100)])],
    scoreRules: [],
  },
  {
    id: "bmc-myeongji-national",
    title: "부산 명지 국민임대주택 입주자 모집",
    agency: { code: "BMC", name: "부산도시공사" },
    housingType: "국민임대",
    region: "부산",
    district: "부산 강서구 명지동",
    units: 240,
    summary: [
      "명지국제신도시 국민임대 240호. 전용 39㎡·46㎡·51㎡.",
      "부산 거주자만 신청할 수 있고, 소득 70% 이하, 자산 3억 3,700만 원 이하예요.",
      "51㎡는 청약통장 12회 이상 납입이 필요해요.",
    ],
    announcedAt: d(-5),
    applyStart: d(1),
    applyEnd: d(12),
    moveIn: "2027년 6월",
    rentNote: "보증금 1,900만 ~ 3,300만 원 / 월 14만 ~ 24만 원",
    originalUrl: "https://www.bmc.busan.kr",
    originalUrlKind: "home",
    rankingMethod: "순위+가점",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), income(70), assets(33_700), car(3_803), region("부산")],
    tiers: [tier(1, "부산 거주", [region("부산")])],
    scoreRules: nationalRentalScore,
  },
  {
    id: "ih-purchase-newlywed",
    title: "인천 신혼부부 매입임대주택 입주자 모집",
    agency: { code: "IH", name: "iH 인천도시공사" },
    housingType: "매입임대",
    region: "인천",
    district: "인천 남동구·연수구·부평구",
    units: 96,
    summary: [
      "신혼부부 전용 매입임대 96호. 혼인 7년 이내 또는 예비 신혼부부가 대상이에요.",
      "인천 거주자 우선이고, 소득 70% 이하(맞벌이 90%)예요.",
      "자녀가 있으면 가점이 붙어요.",
    ],
    announcedAt: d(-4),
    applyStart: d(2),
    applyEnd: d(14),
    moveIn: "2027년 3월",
    rentNote: "보증금 2,000만 ~ 4,000만 원 / 월 15만 ~ 28만 원",
    originalUrl: "https://www.ih.co.kr/main/sale_lease/board/house_notice.jsp",
    originalUrlKind: "list",
    rankingMethod: "순위+가점",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), married(), marriedWithin(84), income(70), assets(33_700), car(3_803), region("인천")],
    tiers: [tier(1, "자녀 있음", [c("numChildren", "gte", 1, "미성년 자녀 1명 이상")]), tier(2, "자녀 없음", [])],
    scoreRules: nationalRentalScore.slice(0, 2).concat(nationalRentalScore.slice(3)),
  },
  {
    id: "lh-goyang-changneung-sale",
    title: "고양창릉 A-2블록 공공분양 입주자 모집",
    agency: { code: "LH", name: "LH 한국토지주택공사" },
    housingType: "공공분양",
    region: "경기",
    district: "경기 고양시 창릉지구",
    units: 610,
    summary: [
      "3기 신도시 창릉지구 공공분양 610세대. 전용 59㎡·74㎡·84㎡.",
      "일반공급은 청약통장 24개월·24회 이상, 무주택 세대구성원, 소득 130% 이하, 부동산 2억 1,550만 원 이하예요.",
      "수도권 거주자만 신청할 수 있고, 고양시 2년 이상 거주자에게 30%를 먼저 배정해요.",
      "일반공급은 저축총액 순이 아니라 가점제로 뽑아요(무주택 기간·부양가족·통장 가입 기간).",
    ],
    announcedAt: d(-7),
    applyStart: d(4),
    applyEnd: d(25),
    moveIn: "2029년 상반기",
    rentNote: "분양가 4억 6,000만 ~ 6억 8,000만 원",
    originalUrl: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1027",
    originalUrlKind: "list",
    rankingMethod: "가점제",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), income(150), accountMonths(24), payCount(24), regionIn(CAPITAL_AREA, "수도권 거주")],
    tiers: [tier(1, "청약통장 24개월·24회 이상", [accountMonths(24), payCount(24)]), tier(2, "그 외", [])],
    scoreRules: saleScore,
  },
  {
    id: "mapo-youth-private",
    title: "청년안심주택 민간임대 임차인 모집 (마포 공덕)",
    agency: { code: "PRIVATE", name: "민간사업자 (서울시 인가)" },
    housingType: "공공지원민간임대",
    region: "서울",
    district: "서울 마포구 공덕동",
    units: 210,
    summary: [
      "공덕역 초역세권 청년안심주택 민간임대 210호예요.",
      "민간임대분은 소득·자산 기준이 공공임대와 달라요. 공고문 확인 중이에요.",
    ],
    announcedAt: d(-1),
    applyStart: d(5),
    applyEnd: d(18),
    moveIn: "2027년 5월",
    originalUrl: "https://soco.seoul.go.kr/youth/bbs/BMSR00015/list.do?menuNo=400008",
    originalUrlKind: "list",
    rankingMethod: "추첨제",
    reviewStatus: "pending",
    status: "published",
    eligibility: [],
    tiers: [],
    scoreRules: [],
  },
  {
    id: "lh-gwacheon-happy-newlywed",
    title: "과천지식정보타운 행복주택 신혼부부 계층 모집",
    agency: { code: "LH", name: "LH 한국토지주택공사" },
    housingType: "행복주택",
    region: "경기",
    district: "경기 과천시 갈현동",
    units: 150,
    summary: [
      "과천지식정보타운 S-3블록 행복주택 신혼부부 계층 150호예요.",
      "혼인 7년 이내 또는 예비 신혼부부, 무주택, 소득 100% 이하(맞벌이 120%)예요.",
      "과천·안양·성남 등 인접 지역 거주·재직자가 1순위예요.",
    ],
    announcedAt: d(-3),
    applyStart: d(6),
    applyEnd: d(30),
    moveIn: "2027년 9월",
    rentNote: "보증금 6,800만 원 / 월 32만 원 (44㎡)",
    originalUrl: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026",
    originalUrlKind: "list",
    rankingMethod: "순위+가점",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), married(), marriedWithin(84), income(120), assets(33_700), car(3_803), hasAccount()],
    tiers: [tier(1, "경기 거주", [region("경기")]), tier(2, "수도권 거주", [regionIn(CAPITAL_AREA, "수도권 거주")])],
    scoreRules: youthScore,
  },
  {
    id: "sh-longterm-jeonse-43",
    title: "장기전세주택 입주자 모집 (43차)",
    agency: { code: "SH", name: "SH 서울주택도시공사" },
    housingType: "장기전세",
    region: "서울",
    district: "서울 송파·강서·은평 등 7개 구",
    units: 410,
    summary: [
      "전세 형태로 최장 20년 살 수 있는 장기전세 410호예요. 월세가 없어요.",
      "전용 60㎡ 이하는 소득 100% 이하, 60㎡ 초과는 120% 이하예요. 부동산 2억 1,550만 원, 차량 3,803만 원 이하.",
      "서울 거주 무주택 세대구성원이어야 하고, 청약통장 24회 이상 납입이 필요해요.",
      "서울 거주 기간·무주택 기간·부양가족·납입 횟수로 가점을 매겨요.",
    ],
    announcedAt: d(-11),
    applyStart: d(-2),
    applyEnd: d(9),
    moveIn: "2027년 1월 ~ 2028년 상반기 (단지별 상이)",
    rentNote: "전세보증금 2억 1,000만 ~ 4억 9,000만 원",
    originalUrl: "https://www.i-sh.co.kr/app/lay2/program/S48T1581C563/www/brd/m_247/list.do?multi_itm_seq=2",
    originalUrlKind: "list",
    rankingMethod: "가점제",
    reviewStatus: "ready",
    status: "published",
    eligibility: [noHouse(), income(120), assets(21_550), car(3_803), region("서울"), payCount(24)],
    tiers: [tier(1, "서울 거주 무주택", [region("서울")])],
    scoreRules: nationalRentalScore,
  },
  {
    id: "lh-gimpo-national-closed",
    title: "김포한강 국민임대주택 예비입주자 모집",
    agency: { code: "LH", name: "LH 한국토지주택공사" },
    housingType: "국민임대",
    region: "경기",
    district: "경기 김포시 한강신도시",
    units: 280,
    summary: ["김포한강 국민임대 3개 단지 예비입주자 모집이에요. 접수가 끝났어요."],
    announcedAt: d(-40),
    applyStart: d(-30),
    applyEnd: d(-21),
    originalUrl: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026",
    originalUrlKind: "list",
    rankingMethod: "순위+가점",
    reviewStatus: "ready",
    status: "closed",
    eligibility: [noHouse(), income(70), assets(33_700), car(3_803)],
    tiers: [tier(1, "경기 거주", [region("경기")])],
    scoreRules: nationalRentalScore,
  },
];

export function getAnnouncement(id: string): Announcement | undefined {
  return ANNOUNCEMENTS.find((a) => a.id === id);
}

export function publishedAnnouncements(): Announcement[] {
  return ANNOUNCEMENTS.filter((a) => a.status !== "draft");
}

export const AGENCY_STYLE: Record<
  Announcement["agency"]["code"],
  { mark: string; bg: string; fg: string }
> = {
  LH: { mark: "LH", bg: "#e4f0fb", fg: "#1c5fa8" },
  SH: { mark: "SH", bg: "#e3f4ea", fg: "#1f7a4d" },
  GH: { mark: "GH", bg: "#e9f1fe", fg: "#2b4fa8" },
  IH: { mark: "iH", bg: "#fdeee6", fg: "#b8521d" },
  BMC: { mark: "BMC", bg: "#e8f3f7", fg: "#1f6d8a" },
  PRIVATE: { mark: "민간", bg: "#f1efe9", fg: "#6b6553" },
};
