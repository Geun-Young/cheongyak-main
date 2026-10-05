/**
 * 마이홈포털 공공주택 모집공고를 가져와 Supabase에 반영한다.
 * 설계서(청약순위계산기_공고자동수집_설계서.md) 5장의 실행 순서를 따른다 — 흐름은 scripts/lib/run-ingest.ts에 있고
 * (청약홈과 같이 쓴다), 여기는 마이홈포털을 부르는 부분만 넘긴다.
 *
 * 실행: npm run ingest:myhome   (해외에서 돌릴 때는 KR_RELAY=supabase)
 */
import "./lib/load-env";
import { fetchMyHomeAnnouncements, SOURCE } from "../src/lib/ingest/myhome";
import { runIngest } from "./lib/run-ingest";

const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY;
if (!DATA_GO_KR_API_KEY) {
  console.error("DATA_GO_KR_API_KEY 환경변수가 필요해요.");
  process.exit(1);
}

runIngest({ source: SOURCE, label: "마이홈포털", fetch: () => fetchMyHomeAnnouncements(DATA_GO_KR_API_KEY) }).catch((e) => {
  console.error("수집 실패:", e.message ?? e);
  process.exit(1);
});
