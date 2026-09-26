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

/** 세종은 광역시가 아니라 "그 외 지역"이다 */
export function depositClass(region: Region): DepositClass {
  if (region === "서울" || region === "부산") return "seoulBusan";
  if (region === "대구" || region === "인천" || region === "광주" || region === "대전" || region === "울산") return "metro";
  return "other";
}
