/**
 * announcements.notice_pdf_url이 없는(=아직 PDF를 못 찾은) 공고에 대해:
 *   1) 상세 페이지에서 PDF를 찾아 다운로드
 *   2) Gemini로 자격요건 초안 추출
 *   3) ai_draft(jsonb) + ai_draft_status/confidence/notes에 저장
 * 만든 결과는 절대 supply_units.eligibility 등 실제 판정 칸에 반영하지 않는다 —
 * 관리자가 /admin/announcements/[id]/review 화면에서 검수 후 수동으로 반영한다.
 *
 * 실행: npm run extract:conditions [-- --limit=10] [-- --id=myhome-21160]
 */
import { createClient } from "@supabase/supabase-js";
import { fetchNoticePdf } from "../src/lib/ingest/myhome-pdf";
import { extractDraftFromPdf } from "../src/lib/ingest/gemini-extract";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY 환경변수가 필요해요.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const idArg = args.find((a) => a.startsWith("--id="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const onlyId = idArg ? idArg.split("=")[1] : undefined;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Row {
  id: string;
  title: string;
  original_url: string;
}

async function fetchTargets(): Promise<Row[]> {
  let query = supabase
    .from("announcements")
    .select("id, title, original_url")
    .in("ai_draft_status", ["none", "failed"])
    .order("apply_end", { ascending: true });

  if (onlyId) query = supabase.from("announcements").select("id, title, original_url").eq("id", onlyId);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function processOne(row: Row): Promise<"extracted" | "no_pdf" | "failed"> {
  const pdf = await fetchNoticePdf(row.original_url);
  if (!pdf) {
    await supabase
      .from("announcements")
      .update({ ai_draft_status: "failed", ai_draft_error: "공고 상세 페이지에서 첨부 PDF를 찾지 못했어요." })
      .eq("id", row.id);
    return "no_pdf";
  }

  try {
    const draft = await extractDraftFromPdf(GEMINI_API_KEY!, pdf.bytes);
    await supabase
      .from("announcements")
      .update({
        notice_pdf_url: row.original_url, // 원문 상세 URL을 기록(다운로드 자체는 매번 재수행)
        ai_draft: draft,
        ai_draft_status: "extracted",
        ai_draft_confidence: draft.confidence,
        ai_draft_notes: draft.notes,
        ai_draft_extracted_at: new Date().toISOString(),
        ai_draft_error: null,
      })
      .eq("id", row.id);
    return "extracted";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("announcements")
      .update({ ai_draft_status: "failed", ai_draft_error: message.slice(0, 500) })
      .eq("id", row.id);
    return "failed";
  }
}

async function main() {
  const targets = await fetchTargets();
  console.log(`대상 ${targets.length}건`);

  const counts = { extracted: 0, no_pdf: 0, failed: 0 };
  for (const [i, row] of targets.entries()) {
    process.stdout.write(`[${i + 1}/${targets.length}] ${row.title.slice(0, 30)}... `);
    try {
      const result = await processOne(row);
      counts[result]++;
      console.log(result);
    } catch (e) {
      counts.failed++;
      console.log("failed (unexpected):", e instanceof Error ? e.message : e);
    }
    await sleep(1500); // Gemini/마이홈포털 양쪽에 부담을 덜 준다
  }

  console.log("완료:", counts);
}

main().catch((e) => {
  console.error("스크립트 실패:", e.message ?? e);
  process.exit(1);
});
