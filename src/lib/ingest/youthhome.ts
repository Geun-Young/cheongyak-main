/**
 * 서울시 청년안심주택 누리집(soco.seoul.go.kr/youth) 모집공고 연동(project.md 34번).
 *
 * 청년안심주택(옛 역세권청년주택)은 마이홈포털·청약홈 어디에도 안 실리고 이 누리집 게시판에만 올라온다.
 * 공개 API는 없지만 목록 화면이 부르는 JSON 주소가 있다:
 *   POST https://soco.seoul.go.kr/youth/pgm/home/yohome/bbsListJson.json
 *   body: bbsId=BMSR00015&pageIndex=N   (한 페이지 10건, 최신순)
 * 항목마다 제목(nttSj), 공고일(optn1), 청약 시작일(optn4), 사업주체(optn3), 공공/민간(optn2: 1=공공·SH, 2=민간),
 * 최초/추가 모집(optn5), 본문 HTML(content)이 온다. 접수 마감일은 칸이 없어서 본문의 "청약신청 : ~" 줄에서 읽는다.
 * 공고문 PDF는 상세 페이지(view.do)의 fileDown.do 링크로 받는다(fetchYouthNoticePdf).
 *
 * 공고 하나 = 단지 하나(민간임대 추가모집은 보통 1~수 세대) — 유닛도 하나로 두고, 계층·주택형 차이는
 * AI 추출이 "신청 경로"(variants)로 나눈다. 공공임대(SH)는 공고 하나에 여러 단지가 묶여 있다.
 */
import type { HousingType } from "@/lib/types";
import { KrAccessError, directThenRelay } from "./kr-fetch";
import { simpleHash, type IngestedAnnouncement, type IngestedUnit } from "./myhome";
import { contentText, field, kstToday, monthDay, parseApplyPeriod, parseGu, parseUnits } from "./notice-text";

export const SOURCE = "youthhome" as const;

const ORIGIN = "https://soco.seoul.go.kr";
const LIST_URL = `${ORIGIN}/youth/pgm/home/yohome/bbsListJson.json`;
const BBS_ID = "BMSR00015";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const HOUSING_TYPE: HousingType = "청년안심주택";

/** 이 기간 안에 공고된 글만 가져온다. 접수 기간이 짧아(대개 1~5일) 이보다 오래된 글은 이미 끝났다 */
const LOOKBACK_DAYS = 45;
/** 안전장치 — 목록이 이상하게 와도 끝없이 넘기지 않는다 */
const MAX_PAGES = 15;

interface YouthItem {
  boardId: number;
  nttSj: string;
  /** 공고일 YYYY-MM-DD */
  optn1: string | null;
  /** 1=공공임대(SH), 2=민간임대 */
  optn2: string | null;
  /** 사업주체 */
  optn3: string | null;
  /** 청약 시작일 YYYY-MM-DD */
  optn4: string | null;
  /** 1=최초, 2=추가 모집 */
  optn5: string | null;
  content: string | null;
  atchFileId: string | null;
  modDate: number | null;
}

interface YouthListResponse {
  resultList: YouthItem[];
  pagingInfo: { pageIndex: number; totPage: number; totRow: number };
}

/** "[민간임대] 개봉역 세이지움 개봉 추가모집공고" → "개봉역 세이지움 개봉" */
function complexFromTitle(title: string): string {
  return title
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/\s*(?:입주자\s*)?(?:최초|추가)?\s*모집\s*공고(?:문)?\s*$/, "")
    .trim();
}

export function detailUrl(boardId: number | string): string {
  return `${ORIGIN}/youth/bbs/${BBS_ID}/view.do?boardId=${boardId}&menuNo=400008`;
}


function toIngested(item: YouthItem): IngestedAnnouncement | null {
  const title = item.nttSj.trim();
  const announcedAt = item.optn1 ?? null;
  if (!announcedAt) return null;
  const text = contentText(item.content);
  const isPublic = item.optn2 === "1";
  const kind = isPublic ? "공공임대" : "민간임대";

  const period = parseApplyPeriod(text, Number(announcedAt.slice(0, 4)));
  const applyStart = period?.[0] ?? item.optn4 ?? announcedAt;
  // 마감일을 못 읽으면 시작일로 둔다 — 길게 잡아 끝난 공고를 "접수 중"으로 보이게 하는 것보다 낫다
  const applyEnd = period?.[1] ?? applyStart;

  const address = field(text, /주택\s*위치|소재지/);
  const gu = parseGu(address);
  const complex = (isPublic ? null : field(text, /단지명/)) ?? complexFromTitle(title);
  const { units, waitlist } = parseUnits(text);
  const agencyName = isPublic ? "SH 서울주택도시공사" : (item.optn3?.trim() || "사업주체 미상");
  const additional = item.optn5 === "2";

  const unit: IngestedUnit = {
    id: `${SOURCE}-${item.boardId}-u1`,
    name: `${complex} (${kind})`,
    housingType: HOUSING_TYPE,
    // 청년안심주택은 계층·순위 안에서 추첨한다(민간임대 추가모집은 선착순·추첨)
    rankingMethod: isPublic ? "순위+가점" : "추첨제",
    unitsCount: units,
    address: address ?? undefined,
    rentNote: undefined,
    moveIn: undefined,
    summary: undefined,
    eligibility: [],
    tiers: [],
    scoreRules: [],
    active: true,
    sourceHash: simpleHash([complex, address, units, kind].join("|")),
  };

  const md = monthDay;
  const autoSummary = [
    `${isPublic ? "SH가" : `${agencyName}이(가)`} 서울 ${gu ?? ""} ${complex}에 공급하는 청년안심주택(${kind})${units ? ` ${units.toLocaleString("ko-KR")}세대` : ""}예요.`.replace(/\s+/g, " "),
    applyStart === applyEnd ? `접수는 ${md(applyStart)} 하루예요.` : `접수는 ${md(applyStart)}부터 ${md(applyEnd)}까지예요.`,
    waitlist
      ? "지금 빈집이 아니라, 빈집이 생기면 들어갈 예비자(대기자)를 뽑는 모집이에요."
      : additional
        ? "이미 입주가 시작된 단지의 빈집을 다시 모집하는 추가모집이에요."
        : "처음 입주자를 모집하는 최초모집이에요.",
    "만 19~39세 무주택 청년·신혼부부가 대상이에요. 계층별 소득·자산 기준은 원문 공고문에서 확인하세요.",
  ];

  return {
    id: `${SOURCE}-${item.boardId}`,
    title,
    agency: { code: isPublic ? "SH" : "PRIVATE", name: agencyName },
    housingType: HOUSING_TYPE,
    region: "서울",
    district: gu ? `서울특별시 ${gu}` : "서울특별시",
    units,
    summary: null,
    announcedAt,
    applyStart,
    applyEnd,
    originalUrl: detailUrl(item.boardId),
    originalUrlKind: "notice",
    rankingMethod: unit.rankingMethod,
    reviewStatus: "pending",
    status: "published",
    supplyUnits: [unit],
    source: SOURCE,
    sourceId: String(item.boardId),
    requestCount: 0,
    autoSummary,
    // 본문·첨부가 바뀌면(정정공고) 다시 확인하도록 해시에 넣는다
    sourceHash: simpleHash([title, applyStart, applyEnd, unit.sourceHash, item.atchFileId ?? "", text].join("|")),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(pageIndex: number, maxRetries = 3): Promise<YouthListResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await directThenRelay(LIST_URL, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ bbsId: BBS_ID, pageIndex: String(pageIndex) }).toString(),
      });
      if (!res.ok) throw new Error(`청년안심주택 목록 응답 오류: ${res.status}`);
      const data = (await res.json()) as YouthListResponse;
      if (!Array.isArray(data.resultList)) throw new Error("청년안심주택 목록 형식이 바뀌었어요(resultList 없음).");
      return data;
    } catch (e) {
      if (e instanceof KrAccessError) throw e;
      lastError = e;
      if (attempt < maxRetries) await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

/** 최근 LOOKBACK_DAYS일 안에 공고된 모집공고를 가져온다(최신순 목록을 그 날짜 전까지 넘긴다) */
export async function fetchYouthAnnouncements(): Promise<IngestedAnnouncement[]> {
  const cutoff = new Date(Date.parse(`${kstToday()}T00:00:00Z`) - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const items: YouthItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchPage(page);
    items.push(...data.resultList);
    const oldest = data.resultList.at(-1)?.optn1 ?? "";
    if (data.resultList.length === 0 || page >= data.pagingInfo.totPage || (oldest && oldest < cutoff)) break;
    await sleep(500);
  }
  return items
    .filter((it) => (it.optn1 ?? "") >= cutoff)
    .map(toIngested)
    .filter((a): a is IngestedAnnouncement => a !== null);
}

export interface YouthNoticePdf {
  bytes: Buffer;
  filename: string;
}

/**
 * 상세 페이지에서 첨부 PDF를 찾아 받는다. 첨부가 여럿이면 이름에 "공고문"이 든 PDF를 고른다.
 * 첨부가 없거나 PDF가 아니면 null(호출부가 "PDF 없음"으로 기록). 사이트에 못 닿으면 KrAccessError.
 */
export async function fetchYouthNoticePdf(pageUrl: string): Promise<YouthNoticePdf | null> {
  const res = await directThenRelay(pageUrl, { headers: { "User-Agent": UA } });
  if (res.status === 403) throw new KrAccessError("청년안심주택 누리집이 접속을 막았어요(403).");
  if (!res.ok) return null;
  const html = await res.text();

  const links = [...html.matchAll(/href="(\/coHouse\/cmmn\/file\/fileDown\.do\?[^"]+)"[^>]*>([^<]+)</g)].map((m) => ({
    path: m[1].replace(/&amp;/g, "&"),
    name: m[2].trim(),
  }));
  const pdfs = links.filter((l) => /\.pdf$/i.test(l.name));
  const pick = pdfs.find((l) => l.name.includes("공고문")) ?? pdfs[0];
  if (!pick) return null;

  const fileRes = await directThenRelay(`${ORIGIN}${pick.path}`, { headers: { "User-Agent": UA } });
  if (!fileRes.ok) return null;
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  // content-type이 octet-stream으로 오기도 해서 파일 머리(%PDF)로 확인한다
  if (bytes.subarray(0, 4).toString("latin1") !== "%PDF") return null;
  return { bytes, filename: pick.name };
}
