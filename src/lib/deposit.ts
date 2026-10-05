import type { Region } from "./types";

/**
 * 민영주택 1순위 청약 예치금 — 주택공급에 관한 규칙 [별표 2]. 만원 단위.
 * 공고 지역이 아니라 **신청자의 주민등록 거주지** 기준이다.
 * 값은 청약핏(chan-hee1102/myhome) rules/standards.ts의 DEPOSIT 표와 같다.
 */

export type DepositArea = "85" | "102" | "135" | "all";
export type DepositClass = "seoulBusan" | "metro" | "other";

export const DEPOSIT_AREAS: { key: DepositArea; label: string }[] = [
  { key: "85", label: "85㎡ 이하" },
  { key: "102", label: "102㎡ 이하" },
  { key: "135", label: "135㎡ 이하" },
  { key: "all", label: "모든 면적" },
];

export const DEPOSIT_CLASSES: { key: DepositClass; label: string }[] = [
  { key: "seoulBusan", label: "서울·부산" },
  { key: "metro", label: "그 밖의 광역시" },
  { key: "other", label: "그 외 지역" },
];

export const DEPOSIT_TABLE: Record<DepositClass, Record<DepositArea, number>> = {
  seoulBusan: { "85": 300, "102": 600, "135": 1000, all: 1500 },
  metro: { "85": 250, "102": 400, "135": 700, all: 1000 },
  other: { "85": 200, "102": 300, "135": 400, all: 500 },
};

export const DEPOSIT_CLASS_REGIONS: Record<DepositClass, Region[]> = {
  seoulBusan: ["서울", "부산"],
  metro: ["대구", "인천", "광주", "대전", "울산"],
  other: ["세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"],
};

/** 전용면적 → 예치금 구간 */
export function depositArea(areaM2: number | null): DepositArea {
  const a = areaM2 ?? 85;
  return a <= 85 ? "85" : a <= 102 ? "102" : a <= 135 ? "135" : "all";
}

/** 거주지 구분·전용면적 → 1순위 예치금(만원) */
export function depositFor(cls: DepositClass, areaM2: number | null): number {
  return DEPOSIT_TABLE[cls][depositArea(areaM2)];
}

/** 세종은 광역시가 아니라 "그 외 지역"이다 */
export function depositClass(region: Region): DepositClass {
  if (region === "서울" || region === "부산") return "seoulBusan";
  if (region === "대구" || region === "인천" || region === "광주" || region === "대전" || region === "울산") return "metro";
  return "other";
}
