/**
 * 서울시 청년안심주택 누리집 모집공고를 가져와 Supabase에 반영한다(project.md 34번).
 * 흐름은 마이홈포털·청약홈과 같다(scripts/lib/run-ingest.ts).
 *
 * 실행: npm run ingest:youthhome   (해외에서 돌릴 때는 KR_RELAY=supabase)
 */
import "./lib/load-env";
import { fetchYouthAnnouncements, SOURCE } from "../src/lib/ingest/youthhome";
import { runIngest } from "./lib/run-ingest";

runIngest({ source: SOURCE, label: "청년안심주택", fetch: fetchYouthAnnouncements }).catch((e) => {
  console.error("수집 실패:", e.message ?? e);
  process.exit(1);
});
