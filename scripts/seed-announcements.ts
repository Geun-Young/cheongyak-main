/**
 * mock/announcements.ts의 ANNOUNCEMENTS를 Supabase announcements/supply_units 테이블에 넣는다.
 * service_role 키가 필요하다(RLS 우회, 서버 전용). 절대 클라이언트에서 실행하지 않는다.
 *
 * 실행: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-announcements.ts
 */
import { createClient } from "@supabase/supabase-js";
import { ANNOUNCEMENTS } from "../src/lib/mock/announcements";
import { toAnnouncementRow, toUnitRow } from "./lib/supabase-rows";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const announcementRows = ANNOUNCEMENTS.map(toAnnouncementRow);
  const unitRows = ANNOUNCEMENTS.flatMap((a) => a.supplyUnits.map((u) => toUnitRow(a.id, u)));

  console.log(`공고 ${announcementRows.length}건, 유닛 ${unitRows.length}건을 넣어요.`);

  const { error: aErr } = await supabase.from("announcements").upsert(announcementRows, { onConflict: "id" });
  if (aErr) throw aErr;
  console.log("announcements upsert 완료");

  const { error: uErr } = await supabase.from("supply_units").upsert(unitRows, { onConflict: "id" });
  if (uErr) throw uErr;
  console.log("supply_units upsert 완료");
}

main()
  .then(() => {
    console.log("시딩 완료");
    process.exit(0);
  })
  .catch((e) => {
    console.error("시딩 실패:", e.message ?? e);
    process.exit(1);
  });
