/**
 * SH 인터넷청약 "주택임대" 게시판 모집공고를 가져와 Supabase에 반영한다(project.md 35번).
 * 흐름은 다른 출처와 같다(scripts/lib/run-ingest.ts). 유형을 못 정해 뺀 제목은 로그에 남긴다.
 *
 * 실행: npm run ingest:sh
 */
import "./lib/load-env";
import { fetchShAnnouncements, SOURCE } from "../src/lib/ingest/sh";
import { runIngest } from "./lib/run-ingest";

runIngest({
  source: SOURCE,
  label: "SH 인터넷청약",
  fetch: async () => {
    const { announcements, skipped } = await fetchShAnnouncements();
    if (skipped.length > 0) console.log(`유형을 정할 수 없거나 운영기관이 모집해서 뺀 공고 ${skipped.length}건:\n  ${skipped.join("\n  ")}`);
    return announcements;
  },
}).catch((e) => {
  console.error("수집 실패:", e.message ?? e);
  process.exit(1);
});
