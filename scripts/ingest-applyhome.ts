/**
 * 청약홈 APT 분양정보를 가져와 Supabase에 반영한다(project.md 32번).
 * 흐름은 마이홈포털과 같다(scripts/lib/run-ingest.ts).
 *
 * 실행: npm run ingest:applyhome   (해외에서 돌릴 때는 KR_RELAY=supabase)
 */
import "./lib/load-env";
import { fetchApplyhomeAnnouncements, SOURCE } from "../src/lib/ingest/applyhome";
import { runIngest } from "./lib/run-ingest";

const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY;
if (!DATA_GO_KR_API_KEY) {
  console.error("DATA_GO_KR_API_KEY 환경변수가 필요해요.");
  process.exit(1);
}

runIngest({ source: SOURCE, label: "청약홈", fetch: () => fetchApplyhomeAnnouncements(DATA_GO_KR_API_KEY) }).catch((e) => {
  console.error("수집 실패:", e.message ?? e);
  process.exit(1);
});
