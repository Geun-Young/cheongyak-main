/**
 * 게시판형 공고 본문("■ 공급호수 : 4세대 ■ 접수기간 : ...")을 읽는 공용 함수.
 * 청년안심주택 누리집(youthhome.ts)과 SH 인터넷청약(sh.ts)이 같은 표기 관습을 쓴다(project.md 34·35번).
 */

/** 본문 HTML → 한 줄 텍스트("■단지명 : ..." 같은 줄을 ■로 나눠 읽는다) */
export function contentText(html: string | null): string {
  return (html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&middot;/g, "·")
    .replace(/\s+/g, " ")
    .trim();
}

/** "■단지명 : 성북펠릭스" → "성북펠릭스". 라벨 뒤 콜론부터 다음 ■ 전까지 */
export function field(text: string, label: RegExp): string | null {
  const m = text.match(new RegExp(`■\\s*(?:${label.source})[^:：■]*[:：]\\s*([^■]*)`));
  return m ? m[1].trim() || null : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 신청 기간이 적힌 줄의 라벨들. 청년안심주택은 "청약신청", SH는 "접수기간"·"청약접수"·"신청기간"을 쓴다 */
// "■ 접수일 ○ 인터넷접수 : 2026. 10. 13.(화) ~ ..."처럼 라벨과 콜론 사이에 다른 말이 끼기도 한다(field가 건너뛴다)
const APPLY_LABEL = /청약\s*(?:신청|접수)|(?:인터넷\s*)?접수\s*(?:기간|일정|일시|일)|신청\s*(?:기간|접수|일정)/;

/**
 * 본문의 신청 기간을 [시작, 끝]으로 읽는다. 실제 표기들:
 *   "‘26. 11. 06. (금) 09:00 ~ 11. 10. (화) 23:00"     (끝 날짜에 연도 없음)
 *   "‘26. 11. 02. (월) 10:00 ~ 18:00"                  (하루짜리 — 시간만 있음)
 *   "2026. 08. 11. (화) 10:00 ~ 2026. 08. 13. (목) 17:00" (SH)
 *   "2026.11.02.(월) ~ 11.12.(목) 18시까지"             (SH 매입임대)
 * 연도는 ‘26처럼 따옴표가 붙거나 네 자리일 때만 연도로 본다 — "11. 10."의 11을 연도로 착각하지 않게.
 */
export function parseApplyPeriod(text: string, fallbackYear: number): [string, string] | null {
  const line = field(text, APPLY_LABEL);
  if (!line) return null;
  const re = /(?:(?:[‘'’](\d{2})|(\d{4}))\s*\.\s*)?(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?(?=\s*[(（~]|\s|$)/g;
  const dates: { y: number; m: number; d: number }[] = [];
  let year = fallbackYear;
  for (const m of line.matchAll(re)) {
    if (m[1]) year = 2000 + Number(m[1]);
    else if (m[2]) year = Number(m[2]);
    const month = Number(m[3]);
    const day = Number(m[4]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    dates.push({ y: year, m: month, d: day });
  }
  if (dates.length === 0) return null;
  const first = dates[0];
  const last = dates[dates.length - 1];
  // 12월에 시작해 1월에 끝나는데 끝 날짜에 연도가 없으면 해를 넘긴다
  const endYear = last.y === first.y && (last.m < first.m || (last.m === first.m && last.d < first.d)) ? last.y + 1 : last.y;
  return [`${first.y}-${pad(first.m)}-${pad(first.d)}`, `${endYear}-${pad(last.m)}-${pad(last.d)}`];
}

/**
 * 이번에 모집하는 세대수. 실제 표기들:
 *   "총 605세대 중 금회 추가모집 공공지원민간임대 1세대 (특별공급 1세대)" → 1
 *   "총 299세대 중 공공지원민간임대 217세대 중 금회 추가모집 3세대"     → 3   (마지막 "중" 뒤)
 *   "총 724세대 중 금회 추가모집 공공지원민간임대 예비자 모집"          → 0, waitlist (빈집 대기자만 뽑음)
 *   "581 세대 ( 신규공급 349 세대 , 재공급 232 세대 )"                 → 581 (SH)
 * 단지 전체 세대수("총 N세대")를 이번 공급량으로 보여주면 경쟁이 실제보다 훨씬 약해 보인다.
 */
export function parseUnits(text: string): { units: number; waitlist: boolean } {
  const line = field(text, /공급\s*(?:호수|세대수?|규모)|모집\s*(?:호수|세대수?)/);
  if (!line) return { units: 0, waitlist: false };
  const parts = line.split(/\s*중\s/);
  const rest = parts[parts.length - 1];
  const n = rest.match(/([\d,]+)\s*(?:세대|호|가구|실|명)/);
  if (n) return { units: Number(n[1].replace(/,/g, "")), waitlist: false };
  return { units: 0, waitlist: /예비/.test(rest) };
}

/** "서울특별시 구로구 개봉동 503(1호선 ...)" → "구로구" */
export function parseGu(text: string | null): string | null {
  return text?.match(/([가-힣]{1,4}구)(?=[\s,·)(]|$)/)?.[1] ?? null;
}

export function kstToday(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** "2026-11-06" → "11월 6일" */
export const monthDay = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
