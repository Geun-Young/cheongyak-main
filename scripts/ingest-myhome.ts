/**
 * 마이홈포털 공공주택 모집공고를 가져와 Supabase에 반영한다.
 * 설계서(청약순위계산기_공고자동수집_설계서.md) 5장의 실행 순서를 그대로 따른다:
 *   1) 동시 실행 방지  2) 소스 호출  3) 정규화(ingest 모듈이 함)
 *   4) 안전장치(50% 미만 응답이면 마감 단계 생략)  5) upsert(소스 칸만)
 *   6) 자동 마감  7) (오래된 마감 정리는 조회 쿼리에서 처리, 여기선 skip)
 *   8) ingest_runs 기록
 *
 * 실행: DATA_GO_KR_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ingest-myhome.ts
 */
import { createClient } from "@supabase/supabase-js";
import { fetchMyHomeAnnouncements, SOURCE } from "../src/lib/ingest/myhome";
import { applyIngestedAnnouncements, autoCloseExpiredAnnouncements } from "./lib/ingest-upsert";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATA_GO_KR_API_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATA_GO_KR_API_KEY 환경변수가 필요해요.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** 같은 run이 겹치지 않도록: 10분 이내 시작된 running 상태 run이 있으면 종료한다 */
async function ensureNoConcurrentRun(): Promise<void> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ingest_runs")
    .select("id, started_at")
    .eq("source", SOURCE)
    .eq("status", "running")
    .gte("started_at", tenMinAgo)
    .limit(1);
  if (error) throw error;
  if (data && data.length > 0) {
    console.log("이미 진행 중인 run이 있어요. 종료합니다.");
    process.exit(0);
  }
}

async function getLastSuccessfulFetchedCount(): Promise<number | null> {
  const { data, error } = await supabase
    .from("ingest_runs")
    .select("fetched")
    .eq("source", SOURCE)
    .eq("status", "ok")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.fetched ?? null;
}

async function main() {
  await ensureNoConcurrentRun();

  const { data: run, error: runErr } = await supabase
    .from("ingest_runs")
    .insert({ source: SOURCE, status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;
  const runId = run.id;

  try {
    console.log("마이홈포털 API에서 공고를 가져오는 중...");
    const announcements = await fetchMyHomeAnnouncements(DATA_GO_KR_API_KEY!);
    console.log(`${announcements.length}건을 가져왔어요.`);

    const lastFetched = await getLastSuccessfulFetchedCount();
    const isSuspiciousDrop = lastFetched !== null && announcements.length < lastFetched * 0.5;
    if (isSuspiciousDrop) {
      console.warn(
        `직전 run(${lastFetched}건) 대비 50% 미만(${announcements.length}건)이에요. API 장애 가능성 — 마감 처리를 건너뛰어요.`,
      );
    }

    const counts = await applyIngestedAnnouncements(supabase, SOURCE, announcements);
    console.log("반영 결과:", counts);

    let closed = 0;
    if (!isSuspiciousDrop) {
      closed = await autoCloseExpiredAnnouncements(supabase);
      console.log(`자동 마감 처리: ${closed}건`);
    }

    await supabase
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: isSuspiciousDrop ? "partial" : "ok",
        fetched: announcements.length,
        inserted: counts.inserted,
        updated: counts.updated,
        unchanged: counts.unchanged,
        closed,
        deactivated_units: counts.deactivatedUnits,
        errors: isSuspiciousDrop ? { warning: "fetched count dropped more than 50% vs last successful run" } : null,
      })
      .eq("id", runId);

    console.log(isSuspiciousDrop ? "마이홈포털 수집 완료 (partial)" : "마이홈포털 수집 완료");
  } catch (e) {
    await supabase
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        errors: { message: e instanceof Error ? e.message : String(e) },
      })
      .eq("id", runId);
    throw e;
  }
}

main().catch((e) => {
  console.error("수집 실패:", e.message ?? e);
  process.exit(1);
});
