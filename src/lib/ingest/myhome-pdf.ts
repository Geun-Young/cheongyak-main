/**
 * 마이홈포털 공고 상세 페이지에서 첨부된 공고문 PDF를 찾아 다운로드한다.
 *
 * 마이홈포털 API(공고 목록 API)는 PDF 링크를 주지 않는다 — 상세 페이지 HTML을 파싱해서
 * 첨부파일 다운로드 파라미터(atchFileId, fileSn)를 찾아야 한다. 실제 확인한 메커니즘:
 *   1) GET {originalUrl} -> HTML 안에 `fnDownFile('<atchFileId>', '<fileSn>')` 형태의 링크
 *   2) POST https://www.myhome.go.kr/hws/com/fms/cvplFileDownload.do
 *      body: atchFileId=<atchFileId>&fileSn=<fileSn> -> PDF 바이너리
 */

const DOWNLOAD_URL = "https://www.myhome.go.kr/hws/com/fms/cvplFileDownload.do";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export interface NoticePdf {
  bytes: Buffer;
  filename: string;
}

/** 상세 페이지 HTML에서 fnDownFile('atchFileId', 'fileSn') 첫 번째 매치를 찾는다 */
function findFileParams(html: string): { atchFileId: string; fileSn: string } | null {
  const m = html.match(/fnDownFile\('([^']+)'\s*,\s*'([^']+)'\)/);
  if (!m) return null;
  return { atchFileId: m[1], fileSn: m[2] };
}

/**
 * 공고 상세 URL(originalUrl)에서 첨부된 PDF를 찾아 다운로드한다.
 * 첨부파일이 없거나 파싱 실패 시 null을 반환한다(에러를 던지지 않음 — 호출부가 "PDF 없음"으로
 * 처리하도록).
 */
export async function fetchNoticePdf(detailUrl: string): Promise<NoticePdf | null> {
  const detailRes = await fetch(detailUrl, { headers: { "User-Agent": UA } });
  if (!detailRes.ok) return null;
  const html = await detailRes.text();

  const params = findFileParams(html);
  if (!params) return null;

  const body = new URLSearchParams({ atchFileId: params.atchFileId, fileSn: params.fileSn });
  const fileRes = await fetch(DOWNLOAD_URL, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!fileRes.ok) return null;

  const contentType = fileRes.headers.get("content-type") ?? "";
  if (!contentType.includes("pdf")) return null;

  const arrayBuffer = await fileRes.arrayBuffer();
  const disposition = fileRes.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);

  return {
    bytes: Buffer.from(arrayBuffer),
    filename: filenameMatch ? filenameMatch[1] : "notice.pdf",
  };
}
