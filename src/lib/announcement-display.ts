import type { Announcement } from "./types";

/**
 * 화면에 보여줄 요약을 고른다. 관리자가 정리한 summary가 있으면 그걸,
 * 없으면(수집만 되고 검수 전) 수집기가 조립한 autoSummary를 쓴다.
 * 설계서 4-2: "화면은 summary ?? auto_summary".
 */
export function displaySummary(a: Pick<Announcement, "summary" | "autoSummary">): string[] {
  return a.summary ?? a.autoSummary ?? [];
}
