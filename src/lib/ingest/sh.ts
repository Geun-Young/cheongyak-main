/**
 * SH(서울주택도시공사) 인터넷청약 "주택임대" 게시판 모집공고 연동(project.md 35번).
 *
 * SH 임대(장기전세·행복주택·국민임대·매입임대·전세임대 등)는 마이홈포털 API에 거의 안 실린다(34번에서 확인 — DB에 SH 0건).
 * 공개 API가 없어서 게시판 화면을 읽는다. GET으로 열린다:
 *   목록: {BOARD}/list.do?multi_itm_seq=2&srchTp=0&srchWord=모집&page=N   (10건씩 최신순)
 *   상세: {BOARD}/view.do?seq=<seq>&multi_itm_seq=2   — 본문은 td.cont, 첨부 목록은 `initParam.downList = [...]` JSON
 *   첨부: /app/com/file/innoFD.do?brdId=&seq=&fileTp=&fileSeq=   (PDF 바이너리)
 *
 * 이 게시판엔 모집공고 말고도 당첨자 발표·서류 안내·계약 안내·채용 공고가 섞여 있다. "모집"으로 검색한 뒤 제목으로 거른다:
 *  - 후속 안내(발표·안내·결과·명단·계약·서류…)와 채용(희망돌보미 등)은 뺀다.
 *  - 청년안심주택은 청년안심주택 누리집(youthhome.ts)에서 이미 가져오므로 뺀다(중복 방지).
 *  - 주택 유형을 제목으로 정할 수 없는 공고(사회주택·협동조합주택·재개발임대 등 대상이 특수한 것)는 뺀다 — 엉뚱한 유형으로
 *    보여주느니 안 보여준다. 빠진 제목은 수집 로그에 남긴다.
 */
import type { HousingType } from "@/lib/types";
import { KrAccessError, directThenRelay } from "./kr-fetch";
import { simpleHash, type IngestedAnnouncement, type IngestedUnit } from "./myhome";
import { contentText, field, kstToday, monthDay, parseApplyPeriod, parseGu, parseUnits } from "./notice-text";

export const SOURCE = "sh" as const;

const ORIGIN = "https://www.i-sh.co.kr";
const BOARD = `${ORIGIN}/app/lay2/program/S48T1581C563/www/brd/m_247`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/** SH 공고는 접수가 공고 뒤 1~3주에 열리는 경우가 많아 청년안심주택보다 조금 길게 본다 */
const LOOKBACK_DAYS = 45;
const MAX_PAGES = 12;

/** 모집공고가 아니라 그 공고의 후속 안내인 글 */
const FOLLOW_UP = /발표|안내|결과|명단|연장|게시|계약|서류|채용|돌보미|정정|취소|변경|마감|공개|추첨|설명회|방문|일정/;

/** 제목 → 주택 유형. 위에서부터 먼저 맞는 것. 못 정하면 null(수집하지 않음) */
const TYPE_RULES: [RegExp, HousingType | null][] = [
  [/청년안심주택|역세권\s*청년/, null], // 청년안심주택 누리집에서 가져온다
  [/장기전세|미리내집/, "장기전세"],
  [/행복주택/, "행복주택"],
  [/통합공공임대/, "통합공공임대"],
  [/국민임대/, "국민임대"],
  [/영구임대/, "영구임대"],
  [/전세임대/, "전세임대"],
  [/매입임대|도전숙|희망하우징|공공기숙사|신혼부부.{0,12}주택|신생아.{0,8}주택|다자녀.{0,8}주택|청년.{0,8}매입/, "매입임대"],
];

export function housingTypeFromTitle(title: string): HousingType | null {
  for (const [re, type] of TYPE_RULES) if (re.test(title)) return type;
  return null;
}

/**
 * SH가 집만 대고 협동조합 등 운영기관이 직접 모집하는 공고("운영기관 : 마을과집 협동조합").
 * 본문에 접수 기간이 없고 신청처도 운영기관이라 우리가 일정·판정을 줄 수 없다.
 */
const OPERATOR_RUN = /운영기관|사회주택|협동조합/;

/** 수집 대상인 모집공고인가 */
export function isRecruitTitle(title: string): boolean {
  return /모집/.test(title) && !FOLLOW_UP.test(title);
}

export function detailUrl(seq: string): string {
  return `${BOARD}/view.do?seq=${seq}&multi_itm_seq=2`;
}

interface ListRow {
  seq: string;
  title: string;
  dept: string;
  /** 등록일 YYYY-MM-DD */
  date: string;
}

interface DownFile {
  brdId: string;
  seq: string;
  fileSeq: string;
  fileTp: string;
  oriFileNm: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getText(url: string, maxRetries = 3): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await directThenRelay(url, { headers: { "User-Agent": UA } });
      if (res.status === 403) throw new KrAccessError("SH 인터넷청약이 접속을 막았어요(403).");
      if (!res.ok) throw new Error(`SH 응답 오류: ${res.status}`);
      return await res.text();
    } catch (e) {
      if (e instanceof KrAccessError) throw e;
      lastError = e;
      if (attempt < maxRetries) await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

function parseList(html: string): ListRow[] {
  const tbody = html.split("<tbody")[1]?.split("</tbody>")[0] ?? "";
  return tbody
    .split("<tr")
    .slice(1)
    .map((tr) => {
      const seq = tr.match(/getDetailView\('(\d+)'\)/)?.[1];
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => contentText(m[1]));
      // 칸: 번호 | 제목 | 담당부서 | 등록일 | 조회수
      const date = cells.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c));
      return seq && cells[1] && date ? { seq, title: cells[1], dept: cells[2] ?? "", date } : null;
    })
    .filter((r): r is ListRow => r !== null);
}

/** 상세 HTML → 본문 텍스트 + 첨부 목록 */
function parseDetail(html: string): { text: string; files: DownFile[] } {
  const start = html.indexOf('class="cont"');
  const end = html.indexOf("다음, 이전글", start);
  const body = start >= 0 ? html.slice(html.indexOf(">", start) + 1, end > start ? end : undefined) : "";
  let files: DownFile[] = [];
  const m = html.match(/initParam\.downList\s*=\s*(\[[\s\S]*?\]);/);
  if (m) {
    try {
      files = JSON.parse(m[1]) as DownFile[];
    } catch {
      files = [];
    }
  }
  return { text: contentText(body), files };
}

function toIngested(row: ListRow, text: string, files: DownFile[], housingType: HousingType): IngestedAnnouncement {
  const title = row.title.trim();
  const announcedText = field(text, /모집\s*공고일|공고일/);
  const announcedMatch = announcedText?.match(/(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/);
  const announcedAt = announcedMatch
    ? `${announcedMatch[1]}-${announcedMatch[2].padStart(2, "0")}-${announcedMatch[3].padStart(2, "0")}`
    : row.date;

  const period = parseApplyPeriod(text, Number(announcedAt.slice(0, 4)));
  // 기간을 못 읽으면 등록일 하루로 둔다 — 끝난 공고를 오래 "접수 중"으로 두는 것보다 안전하다. 원문 링크는 남는다
  const applyStart = period?.[0] ?? row.date;
  const applyEnd = period?.[1] ?? applyStart;

  const { units, waitlist } = parseUnits(text);
  const address = field(text, /주택\s*위치|소재지|위치/);
  const gu = parseGu(address) ?? parseGu(title);
  const pdfName = files.find((f) => /\.pdf$/i.test(f.oriFileNm))?.oriFileNm ?? "";

  const name = title
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/\s*\(\s*\d{4}[\d.\s]*(?:공고)?\s*\)\s*/g, " ")
    .replace(/\s*(?:입주자|입주대기자|예비입주자)?\s*모집\s*공고(?:문)?\s*$/, "")
    .trim();

  const unit: IngestedUnit = {
    id: `${SOURCE}-${row.seq}-u1`,
    name: name || title,
    housingType,
    rankingMethod: "순위+가점",
    unitsCount: units,
    address: address ?? undefined,
    rentNote: undefined,
    moveIn: undefined,
    summary: undefined,
    eligibility: [],
    tiers: [],
    scoreRules: [],
    active: true,
    sourceHash: simpleHash([name, address, units, housingType].join("|")),
  };

  const where = gu ? `서울 ${gu}` : "서울";
  const autoSummary = [
    `SH(서울주택도시공사)가 ${where}에 공급하는 ${housingType}${units ? ` ${units.toLocaleString("ko-KR")}세대` : ""}예요.`,
    applyStart === applyEnd ? `접수는 ${monthDay(applyStart)}이에요.` : `접수는 ${monthDay(applyStart)}부터 ${monthDay(applyEnd)}까지예요.`,
    ...(period ? [] : ["접수 기간을 본문에서 읽지 못했어요. 원문 공고에서 꼭 확인하세요."]),
    ...(waitlist || /예비|대기자/.test(title) ? ["지금 빈집이 아니라, 빈집이 생기면 들어갈 예비입주자(대기자)를 뽑는 모집이에요."] : []),
    ...(/잔여/.test(title) ? ["앞선 모집에서 남은 세대를 다시 모집하는 공고예요."] : []),
    "자격 조건(소득·자산·무주택 등)은 원문 공고문에서 확인하세요.",
  ];

  return {
    id: `${SOURCE}-${row.seq}`,
    title,
    agency: { code: "SH", name: "SH 서울주택도시공사" },
    housingType,
    region: "서울",
    district: gu ? `서울특별시 ${gu}` : "서울특별시",
    units,
    summary: null,
    announcedAt,
    applyStart,
    applyEnd,
    originalUrl: detailUrl(row.seq),
    originalUrlKind: "notice",
    rankingMethod: "순위+가점",
    reviewStatus: "pending",
    status: "published",
    supplyUnits: [unit],
    source: SOURCE,
    sourceId: row.seq,
    requestCount: 0,
    autoSummary,
    sourceHash: simpleHash([title, applyStart, applyEnd, unit.sourceHash, pdfName, text].join("|")),
  };
}

export interface ShFetchReport {
  announcements: IngestedAnnouncement[];
  /** 모집공고로 보이지만 유형을 못 정해 뺀 제목 — 로그로 남겨 규칙을 늘릴지 판단한다 */
  skipped: string[];
}

/** 최근 LOOKBACK_DAYS일 안에 올라온 SH 임대 모집공고를 가져온다 */
export async function fetchShAnnouncements(): Promise<ShFetchReport> {
  const cutoff = new Date(Date.parse(`${kstToday()}T00:00:00Z`) - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const rows: ListRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await getText(`${BOARD}/list.do?multi_itm_seq=2&srchTp=0&srchWord=${encodeURIComponent("모집")}&page=${page}`);
    const pageRows = parseList(html);
    if (pageRows.length === 0) {
      if (page === 1) throw new Error("SH 게시판 목록을 읽지 못했어요(형식이 바뀌었을 수 있어요).");
      break;
    }
    rows.push(...pageRows);
    if (pageRows[pageRows.length - 1].date < cutoff) break;
    await sleep(500);
  }

  const announcements: IngestedAnnouncement[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.date < cutoff || seen.has(row.seq) || !isRecruitTitle(row.title)) continue;
    seen.add(row.seq);
    const type = OPERATOR_RUN.test(row.title) ? null : housingTypeFromTitle(row.title);
    if (!type) {
      if (!/청년안심주택|역세권\s*청년/.test(row.title)) skipped.push(row.title);
      continue;
    }
    const { text, files } = parseDetail(await getText(detailUrl(row.seq)));
    announcements.push(toIngested(row, text, files, type));
    await sleep(400);
  }
  return { announcements, skipped };
}

/**
 * 상세 페이지의 첨부 목록에서 공고문 PDF를 받는다(이름에 "공고문"이 든 PDF 우선).
 * 첨부가 없거나 PDF가 아니면 null(호출부가 "PDF 없음"으로 기록).
 */
export async function fetchShNoticePdf(pageUrl: string): Promise<{ bytes: Buffer; filename: string } | null> {
  const { files } = parseDetail(await getText(pageUrl));
  const pdfs = files.filter((f) => /\.pdf$/i.test(f.oriFileNm));
  const pick = pdfs.find((f) => f.oriFileNm.includes("공고")) ?? pdfs[0];
  if (!pick) return null;
  const url = `${ORIGIN}/app/com/file/innoFD.do?brdId=${pick.brdId}&seq=${pick.seq}&fileTp=${pick.fileTp}&fileSeq=${pick.fileSeq}`;
  const res = await directThenRelay(url, { headers: { "User-Agent": UA } });
  if (res.status === 403) throw new KrAccessError("SH 인터넷청약이 접속을 막았어요(403).");
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.subarray(0, 4).toString("latin1") !== "%PDF") return null;
  return { bytes, filename: pick.oriFileNm };
}
