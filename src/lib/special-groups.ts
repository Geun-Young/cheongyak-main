import type { SpecialGroup } from "./types";

/**
 * 수급자·장애인·유공자 같은 "대상 계층" 체크(project.md 31번).
 *
 * 영구임대 "1순위(생계·의료수급자, 유공자 등)", 행복주택 "주거급여수급자 계층"처럼 이런 신분으로 순위·자격이 갈리는데,
 * 프로필에 없어서 아무에게나 1순위를 주거나(조건이 라벨에만 있음) 늘 "확인 필요"로 남겼다.
 *
 * 민감한 정보라 **서버로 보내지 않는다** — 로그인했어도 이 기기(localStorage)에만 둔다(special-groups-store.ts). 판정은 브라우저에서 하므로 이걸로 충분하다.
 * 이 파일은 서버 컴포넌트에서도 쓰는 판정 엔진이 import하므로 React 훅을 두지 않는다.
 * (서버가 판정해 알림을 보내게 되면 그때는 이 항목을 쓰지 못한다 — 알림은 보수적으로 나간다)
 * null = 아직 답하지 않음, [] = "해당 없음"을 고름.
 */

export const SPECIAL_GROUPS: { key: SpecialGroup; label: string; hint?: string }[] = [
  { key: "livelihood", label: "생계·의료급여 수급자", hint: "생계·의료급여를 받으면 보통 주거급여도 받아요" },
  { key: "housingBenefit", label: "주거급여 수급자" },
  { key: "disabled", label: "등록 장애인" },
  { key: "veteran", label: "국가유공자·보훈대상자" },
  { key: "singleParent", label: "한부모가족" },
];

/** 순위·경로 이름에 적힌 대상 계층 → 우리 체크 항목. 주거급여를 먼저 본다("주거급여수급자"도 "수급"을 포함한다) */
export function groupsMentioned(text: string): SpecialGroup[] {
  const out = new Set<SpecialGroup>();
  // "구직급여 수급자"(실업급여)는 대상 계층이 아니다
  const t = text.replace(/구직급여\s*수급(자|권자)?/g, "");
  if (/주거급여/.test(t)) out.add("housingBenefit");
  // 생계·의료급여, 기초생활수급자, 그냥 "수급자"(주거급여만 적힌 경우는 위에서 처리)
  if (/생계|의료\s*(급여|수급)|기초\s*(생활|수급)/.test(t) || (/수급/.test(t) && !/주거급여/.test(t))) out.add("livelihood");
  if (/장애/.test(t)) out.add("disabled");
  if (/유공자|보훈/.test(t)) out.add("veteran");
  if (/한부모/.test(t)) out.add("singleParent");
  // 주거약자 = 고령자(나이 조건으로 따로 거른다)·장애인·유공자
  if (/주거약자/.test(t)) {
    out.add("disabled");
    out.add("veteran");
  }
  return [...out];
}

/**
 * 우리가 체크로 받지 않는 대상 계층까지 포함해, 이 문장이 "특정 신분"을 요구하는가.
 * 북한이탈주민처럼 체크 항목이 없는 계층만 적힌 순위는 아무도 확인할 수 없으니 주지 않는다(보수적).
 */
export function mentionsSpecialGroup(text: string): boolean {
  const t = text.replace(/구직급여\s*수급(자|권자)?/g, "");
  return /수급|차상위|유공자|보훈|장애|한부모|북한이탈|새터민|아동복지시설|보호종료|위안부|특수임무|참전|고엽제|주거약자/.test(t);
}

/** 이 순위·경로가 요구하는 신분을 사용자가 체크했는가 */
export function hasMentionedGroup(text: string, groups: SpecialGroup[] | null | undefined): boolean {
  if (!groups?.length) return false;
  return groupsMentioned(text).some((g) => groups.includes(g));
}
