import type { AgencyCode, Announcement, HousingType } from "./types";
import { addDays, toDate } from "./format";

/**
 * 「어디서, 어떻게 신청하나요」 — 공고 상세의 '지금 할 일' 카드에 쓴다.
 * 청약핏(chan-hee1102/myhome)의 lib/howto.ts를 우리 타입(AgencyCode·HousingType)에 맞게 옮겼다.
 *
 * 확실한 것만 적는다. 기관 누리집은 첫 화면(루트)만 건다 — 세부 경로는 자주 바뀐다.
 * 지방 공사(IH·BMC·UNKNOWN)는 접수처가 공고마다 달라 적지 않고 공고문 원문으로 보낸다.
 */

export interface HowTo {
  /** 접수처 이름. 예) "LH청약플러스", "주민센터" */
  where: string;
  /** 접수처 공식 누리집(루트). 모르거나 방문 접수면 없음 */
  url?: string;
  /** 접수 방법 한 줄 */
  method: string;
  /** 신청할 때 챙길 것 */
  bring: string[];
  /** 인증서가 필요한데 없는 사람을 위한 한 줄 */
  certHelp?: string;
  /** 방문 접수인가 — 주말 마감 경고에 쓴다 */
  visit?: boolean;
}

const PORTAL: Partial<Record<AgencyCode, { where: string; url: string }>> = {
  LH: { where: "LH청약플러스", url: "https://apply.lh.or.kr" },
  SH: { where: "SH 인터넷청약", url: "https://www.i-sh.co.kr" },
  GH: { where: "GH 경기주택도시공사", url: "https://www.gh.or.kr" },
};

const CERT = "공동인증서 또는 금융인증서";
const LATER = "당첨 뒤 제출: 주민등록등본, 가족관계증명서 등";
const CERT_HELP = "인증서가 없으면 거래하는 은행 앱에서 금융인증서를 먼저 발급받으세요.";
const SALE: HousingType[] = ["공공분양", "신혼희망타운"];

export const HOWTO_CAVEAT = "서류와 제출 시기는 공고마다 달라요. 공고문의 제출 서류 항목을 꼭 확인하세요.";

export function howTo(a: Pick<Announcement, "agency" | "housingType">): HowTo {
  if (a.housingType === "영구임대") {
    return {
      where: "주민센터",
      method: "보통 주민등록지 읍·면·동 주민센터에 직접 가서 신청해요. 인터넷 접수를 함께 받는 공고도 있으니 공고문에서 확인하세요.",
      bring: ["신분증", "주민센터에서 안내하는 서류"],
      visit: true,
    };
  }
  if (a.housingType === "청년안심주택") {
    return {
      where: "청년안심주택 누리집",
      url: "https://soco.seoul.go.kr",
      method: "누리집 모집공고를 보고 인터넷으로 신청해요. 공공임대분과 민간임대분은 접수 방법이 다를 수 있어요.",
      bring: [CERT, LATER],
      certHelp: CERT_HELP,
    };
  }
  const portal = PORTAL[a.agency.code];
  if (!portal) {
    return {
      where: a.agency.name,
      method: "공고문에 적힌 접수처와 방법으로 신청해요. 인터넷 접수인지 방문 접수인지 먼저 확인하세요.",
      bring: [`인터넷 접수라면 ${CERT}`, LATER],
      certHelp: CERT_HELP,
    };
  }
  const sale = SALE.includes(a.housingType);
  return {
    ...portal,
    method: `인터넷으로 신청해요.${sale ? " 특별공급과 일반공급 접수일이 달라요." : ""}`,
    bring: sale ? [CERT, "청약통장(가입 은행 확인)", LATER] : [CERT, LATER],
    certHelp: CERT_HELP,
  };
}

/** "10.2 (금)" */
function md(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()} (${"일월화수목금토"[d.getDay()]})`;
}

/**
 * 방문 접수인데 마감일이 토·일이면 경고 한 줄. 인터넷 접수거나 평일 마감이면 undefined.
 * 공휴일은 표가 없어 따지지 않는다 — 금요일이 공휴일이면 그 전 평일이어야 한다.
 */
export function weekendNote(a: Pick<Announcement, "applyStart" | "applyEnd">, how: HowTo): string | undefined {
  if (!how.visit) return undefined;
  const end = toDate(a.applyEnd);
  const dow = end.getDay();
  if (dow !== 0 && dow !== 6) return undefined;
  const fri = addDays(end, dow === 6 ? -1 : -2);
  if (fri < toDate(a.applyStart)) {
    return "접수 기간이 주말뿐이라 방문 접수가 어려워요. 방문할 수 있는 날을 공고문에서 확인하세요.";
  }
  return `마감일이 ${dow === 6 ? "토요일" : "일요일"}이라 ${how.where}가 쉬어요. 방문 접수라면 ${md(fri)}까지 가세요.`;
}
