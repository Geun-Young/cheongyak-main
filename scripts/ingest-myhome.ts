/**
 * 마이홈포털 공공주택 모집공고를 실제로 가져와 Supabase에 upsert한다.
 * 조건(eligibility)이 없는 draft/pending 상태로 들어가므로, 관리자가 조건빌더에서
 * 검수·게시해야 사용자에게 노출된다(RLS가 status='published'만 공개하기 때문).
 *
 * 실행: DATA_GO_KR_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ingest-myhome.ts
 */
import { createClient } from "@supabase/supabase-js";
import { fetchMyHomeAnnouncements } from "../src/lib/ingest/myhome";
import { toAnnouncementRow, toUnitRow } from "./lib/supabase-rows";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATA_GO_KR_API_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATA_GO_KR_API_KEY 환경변수가 필요해요.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("마이홈포털 API에서 공고를 가져오는 중...");
  const announcements = await fetchMyHomeAnnouncements(DATA_GO_KR_API_KEY!);
  console.log(`${announcements.length}건을 가져왔어요.`);

  const announcementRows = announcements.map(toAnnouncementRow);
  const unitRows = announcements.flatMap((a) => a.supplyUnits.map((u) => toUnitRow(a.id, u)));

  // upsert는 500건씩 나눠서 보낸다(요청 크기 제한 방지)
  const chunk = <T,>(arr: T[], size: number) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  for (const batch of chunk(announcementRows, 500)) {
    const { error } = await supabase.from("announcements").upsert(batch, { onConflict: "id" });
    if (error) throw error;
  }
  console.log(`announcements upsert 완료 (${announcementRows.length}건)`);

  for (const batch of chunk(unitRows, 500)) {
    const { error } = await supabase.from("supply_units").upsert(batch, { onConflict: "id" });
    if (error) throw error;
  }
  console.log(`supply_units upsert 완료 (${unitRows.length}건)`);
}

main()
  .then(() => {
    console.log("마이홈포털 수집 완료");
    process.exit(0);
  })
  .catch((e) => {
    console.error("수집 실패:", e.message ?? e);
    process.exit(1);
  });
