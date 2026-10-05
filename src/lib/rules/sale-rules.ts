import type { Condition, OtherRequirement, Region, SaleInfo, SaleUnitInfo, Tier, UnitVariant } from "@/lib/types";
import { DEPOSIT_CLASSES, DEPOSIT_CLASS_REGIONS, depositFor } from "@/lib/deposit";

/**
 * 민영 아파트(청약홈) 판정 규칙 — project.md 33번.
 *
 * 임대 공고는 공고문 PDF에서 조건을 뽑지만, 민영 분양은 주택공급에 관한 규칙이 정한 틀이 같고
 * 공고마다 다른 값(규제지역·주택형 면적·특별공급 물량)은 청약홈 API가 정리해서 준다.
 * 그래서 PDF 없이 규칙으로 조건을 만든다. 근거와 숫자는 청약핏(chan-hee1102/myhome) rules/templates.ts·place.ts와 같다.
 *
 * 주택형(유닛) 하나 = 신청 경로 여럿: 일반공급 + 물량이 있는 특별공급. "하나라도 되면 신청 가능"(29번 구조).
 * 예치금은 신청자가 사는 시·도에 따라 기준이 달라서, 1순위를 거주지 구분(서울·부산 / 광역시 / 그 외)별 순위로 나눠 둔다.
 */

/** 민영·공공분양은 대체로 해당 시·도와 이 권역 안 거주자만 신청한다(공고마다 다를 수 있음) */
export const SALE_BLOCS: { name: string; regions: Region[] }[] = [
  { name: "수도권", regions: ["서울", "인천", "경기"] },
  { name: "충청권", regions: ["대전", "세종", "충남", "충북"] },
  { name: "부울경", regions: ["부산", "울산", "경남"] },
  { name: "대구·경북", regions: ["대구", "경북"] },
  { name: "호남권", regions: ["광주", "전남", "전북"] },
  { name: "강원", regions: ["강원"] },
  { name: "제주", regions: ["제주"] },
];

export function blocOf(region: Region) {
  return SALE_BLOCS.find((b) => b.regions.includes(region))!;
}

const CAPITAL: Region[] = ["서울", "인천", "경기"];

/** 1순위 청약통장 가입 기간(개월): 규제지역 24, 수도권 12, 그 밖 6 */
export function rank1Months(sale: SaleInfo, region: Region): number {
  if (sale.regulation.speculative || sale.regulation.adjusted) return 24;
  return CAPITAL.includes(region) ? 12 : 6;
}

/** 1순위끼리 경쟁할 때 가점·추첨 비율 [주택공급에 관한 규칙 제28조] */
export function gajeomRatio(sale: SaleInfo, areaM2: number | null): string {
  const area = areaM2 ?? 85;
  if (sale.regulation.speculative) return area <= 60 ? "가점 40% · 추첨 60%" : area <= 85 ? "가점 70% · 추첨 30%" : "가점 80% · 추첨 20%";
  if (sale.regulation.adjusted) return area <= 60 ? "가점 40% · 추첨 60%" : area <= 85 ? "가점 70% · 추첨 30%" : "가점 50% · 추첨 50%";
  return area <= 85 ? "가점 40% 이하(나머지 추첨)" : "추첨 100%";
}

let seq = 0;
const cond = (c: Omit<Condition, "id">): Condition => ({ id: `sale-${seq++}`, ...c });

/** 공고 조건 id는 다시 만들어도 같아야(변경 감지) 하므로 유닛마다 0부터 센다 */
function resetIds() {
  seq = 0;
}

const manwon = (n: number) => `${n.toLocaleString("ko-KR")}만 원`;

function regulatedCaveats(sale: SaleInfo): OtherRequirement[] {
  if (!sale.regulation.speculative && !sale.regulation.adjusted) return [];
  const where = sale.regulation.speculative ? "투기과열지구" : "조정대상지역";
  return [
    { kind: "tier", label: "세대주여야 1순위", detail: `${where}라 세대원은 1순위로 신청할 수 없어요.` },
    { kind: "tier", label: "최근 5년 안에 세대원 모두 당첨 사실 없음", detail: `${where} 1순위 요건이에요.` },
    { kind: "tier", label: "집이 2채 이상인 세대는 1순위 불가", detail: "1채면 1순위로 신청할 수 있어요." },
  ];
}

/** 특별공급 공통 예치금 안내(신청자 거주지 기준이라 조건으로 못 넣는다) */
function depositCaveat(areaM2: number | null): OtherRequirement {
  const parts = DEPOSIT_CLASSES.map((c) => `${c.label} ${manwon(depositFor(c.key, areaM2))}`);
  return { kind: "eligibility", label: "지역별 예치금 이상", detail: `사는 곳 기준이에요. ${parts.join(", ")}.` };
}

/**
 * 민영 아파트 주택형 하나의 신청 경로들. 공고 지역을 모르면 만들지 않는다(null → "확인 필요" 유지).
 */
export function buildPrivateSaleVariants(region: Region | null, sale: SaleInfo, unit: SaleUnitInfo): UnitVariant[] | null {
  if (!region || sale.kind !== "민영") return null;
  resetIds();
  const bloc = blocOf(region);
  const months = rank1Months(sale, region);
  const area = unit.areaM2;
  const regulated = sale.regulation.speculative || sale.regulation.adjusted;

  const inBloc = cond({
    field: "residenceRegion",
    operator: "in",
    value: bloc.regions,
    label: `${bloc.name} 거주${bloc.regions.length > 1 ? `(${bloc.regions.join("·")})` : ""}`,
  });
  const account = cond({ field: "hasSubscription", operator: "eq", value: true, label: "청약통장 가입" });
  const homeless = cond({ field: "housingStatus", operator: "eq", value: "none", label: "세대 전원 무주택" });
  const months6 = cond({ field: "subscriptionMonths", operator: "gte", value: 6, label: "청약통장 가입 6개월 이상" });

  // 1순위: 거주지 구분(예치금 기준)별로 하나씩 — 권역 안에 있는 구분만
  const rank1: Tier[] = DEPOSIT_CLASSES.flatMap((c) => {
    const regions = DEPOSIT_CLASS_REGIONS[c.key].filter((r) => bloc.regions.includes(r));
    if (!regions.length) return [];
    const need = depositFor(c.key, area);
    return [
      {
        rank: 1 as const,
        // 1순위 줄이 거주지 구분마다 하나씩이라, 어느 줄이 내 기준인지 라벨에 적는다
        label: `1순위 · ${c.label} 거주 (가입 ${months}개월 · 예치금 ${manwon(need)} 이상${regulated ? " · 세대주 · 5년 안에 당첨 없음" : ""})`,
        conditions: [
          cond({ field: "residenceRegion", operator: "in", value: regions, label: `${c.label} 거주` }),
          cond({ field: "subscriptionMonths", operator: "gte", value: months, label: `청약통장 가입 ${months}개월 이상` }),
          cond({ field: "totalDeposit", operator: "gte", value: need, label: `예치금 ${manwon(need)} 이상` }),
        ],
      },
    ];
  });

  const variants: UnitVariant[] = [
    {
      name: "일반공급",
      eligibility: [inBloc, account],
      tiers: [...rank1, { rank: 2, label: "2순위 (1순위 요건을 못 채운 통장 가입자)", conditions: [] }],
      scoreRules: [],
      otherRequirements: [
        // 가점·추첨 비율은 공고 상세의 가점 카드가 보여 준다(MatchPanel)
        ...regulatedCaveats(sale),
        { kind: "other", label: "해당 지역 거주자를 먼저 뽑아요", detail: "공고 지역(시·군) 거주자가 우선이고, 남으면 같은 권역 거주자 순이에요." },
      ],
    },
  ];

  const b = unit.specialBreakdown;
  if ((b.newlywed ?? 0) > 0) {
    variants.push({
      name: "특별공급 · 신혼부부",
      eligibility: [
        inBloc,
        account,
        months6,
        homeless,
        // 민영 신혼부부 특공은 예비신혼부부를 받지 않는다(청약핏 templates engagedOk: false)
        cond({ field: "maritalStatus", operator: "eq", value: "married", label: "혼인 중" }),
        cond({ field: "marriageMonths", operator: "lte", value: 84, label: "혼인 7년 이내" }),
      ],
      tiers: [
        { rank: 1, label: "1순위 (자녀 있음)", conditions: [cond({ field: "numChildren", operator: "gte", value: 1, label: "미성년 자녀 있음" })] },
        { rank: 2, label: "2순위 (자녀 없음)", conditions: [] },
      ],
      scoreRules: [],
      otherRequirements: [
        depositCaveat(area),
        { kind: "other", label: "소득 140%(맞벌이 160%) 이하가 먼저", detail: "물량 50%는 100%(맞벌이 120%) 이하, 20%는 140%(맞벌이 160%) 이하에서 순위대로, 30%는 추첨이에요. 소득을 넘어도 부동산 3억 3,100만 원 이하면 추첨분에 넣을 수 있어요." },
      ],
    });
  }
  if ((b.multiChild ?? 0) > 0) {
    variants.push({
      name: "특별공급 · 다자녀",
      eligibility: [inBloc, account, months6, homeless, cond({ field: "numChildren", operator: "gte", value: 2, label: "미성년 자녀 2명 이상" })],
      tiers: [],
      scoreRules: [],
      otherRequirements: [depositCaveat(area), { kind: "other", label: "100점 배점표로 뽑아요", detail: "소득 기준은 없어요. 지역별 배정 비율은 공고문에서 확인하세요." }],
    });
  }
  // 우리가 모르는 사실(평생 무주택·소득세 납부, 2년 안 출산, 노부모 3년 부양)이 핵심이라 확인 필요로 둔다
  if ((b.firstHome ?? 0) > 0) {
    variants.push({
      name: "특별공급 · 생애최초",
      special: true,
      eligibility: [inBloc, account, homeless, cond({ field: "subscriptionMonths", operator: "gte", value: months, label: `청약통장 가입 ${months}개월 이상` })],
      tiers: [],
      scoreRules: [],
      otherRequirements: [
        { kind: "eligibility", label: "세대원 모두 평생 집을 가진 적 없음" },
        { kind: "eligibility", label: "5년 이상 소득세 납부" },
        { kind: "eligibility", label: "혼인 중이거나 자녀가 있음", detail: "1인 가구는 전용 60㎡ 이하 추첨분만 신청할 수 있어요." },
        depositCaveat(area),
        { kind: "other", label: "모두 추첨", detail: "50%는 소득 130% 이하, 20%는 160% 이하에서 먼저 뽑아요." },
      ],
    });
  }
  if ((b.newborn ?? 0) > 0) {
    variants.push({
      name: "특별공급 · 신생아",
      special: true,
      eligibility: [inBloc, account, homeless, cond({ field: "numChildren", operator: "gte", value: 1, label: "자녀 있음" })],
      tiers: [],
      scoreRules: [],
      otherRequirements: [
        { kind: "eligibility", label: "입주자모집공고일 기준 2년 안에 출산(입양)", detail: "결혼 여부와 상관없어요." },
        depositCaveat(area),
        { kind: "other", label: "추첨", detail: "50%는 소득 130% 이하, 20%는 160% 이하에서 먼저 뽑아요." },
      ],
    });
  }
  if ((b.elderlyParent ?? 0) > 0) {
    variants.push({
      name: "특별공급 · 노부모부양",
      special: true,
      eligibility: [inBloc, account, homeless, cond({ field: "subscriptionMonths", operator: "gte", value: months, label: `청약통장 가입 ${months}개월 이상` })],
      tiers: [],
      scoreRules: [],
      otherRequirements: [
        { kind: "eligibility", label: "만 65세 이상 직계존속을 3년 이상 부양", detail: "같은 주민등록표에 3년 이상 올라 있어야 해요." },
        { kind: "eligibility", label: "세대주" },
        depositCaveat(area),
        { kind: "other", label: "일반공급과 같은 가점으로 뽑아요" },
      ],
    });
  }
  return variants;
}
