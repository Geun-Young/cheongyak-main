/**
 * 공고 수집 실행기 — 출처(마이홈포털·청약홈)마다 같은 순서로 돈다. 설계서 5장:
 *   1) 동시 실행 방지  2) 소스 호출  3) 안전장치  4) upsert(소스 칸만)  5) 자동 마감  6) ingest_runs 기록
 * 출처별 차이(어떤 API를 어떻게 부르는지)는 fetch 함수 하나로만 넘긴다.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { IngestedAnnouncement } from "../../src/lib/ingest/myhome";
import { applyIngestedAnnouncements, autoCloseExpiredAnnouncements } from "./ingest-upsert";

/** 직전 성공 대비 이만큼 줄면 API 장애로 의심한다. 원래 건수가 적은 출처는 자연 변동이 커서 따지지 않는다 */
const DROP_RATIO = 0.5;
const DROP_MIN_BASE = 20;

async function ensureNoConcurrentRun(supabase: SupabaseClient, source: string): Promise<boolean> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ingest_runs")
    .select("id")
    .eq("source", source)
    .eq("status", "running")
    .gte("started_at", tenMinAgo)
    .limit(1);
  if (error) throw error;
  return !data?.length;
}

async function lastSuccessfulFetched(supabase: SupabaseClient, source: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("ingest_runs")
    .select("fetched")
    .eq("source", source)
    .eq("status", "ok")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.fetched ?? null;
}

export async function runIngest(opts: {
  source: string;
  label: string;
  fetch: () => Promise<IngestedAnnouncement[]>;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  if (!(await ensureNoConcurrentRun(supabase, opts.source))) {
    console.log("이미 진행 중인 run이 있어요. 종료합니다.");
    return;
  }

  const { data: run, error: runErr } = await supabase
    .from("ingest_runs")
    .insert({ source: opts.source, status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  try {
    console.log(`${opts.label}에서 공고를 가져오는 중...`);
    const announcements = await opts.fetch();
    console.log(`${announcements.length}건을 가져왔어요.`);

    // 0건은 반영하지 않는다 — 장애로 빈 응답이 오면 그 출처의 공고가 전부 "사라진 것"이 되어 단지가 숨겨진다
    if (announcements.length === 0) throw new Error("0건을 받았어요. 장애로 보고 반영하지 않아요.");

    const last = await lastSuccessfulFetched(supabase, opts.source);
    const suspicious = last !== null && last >= DROP_MIN_BASE && announcements.length < last * DROP_RATIO;
    if (suspicious) {
      console.warn(`직전 run(${last}건) 대비 50% 미만(${announcements.length}건)이에요. API 장애 가능성 — 마감 처리를 건너뛰어요.`);
    }

    const counts = await applyIngestedAnnouncements(supabase, opts.source, announcements);
    console.log("반영 결과:", counts);

    let closed = 0;
    if (!suspicious) {
      closed = await autoCloseExpiredAnnouncements(supabase);
      console.log(`자동 마감 처리: ${closed}건`);
    }

    await supabase
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: suspicious ? "partial" : "ok",
        fetched: announcements.length,
        inserted: counts.inserted,
        updated: counts.updated,
        unchanged: counts.unchanged,
        closed,
        deactivated_units: counts.deactivatedUnits,
        errors: suspicious ? { warning: "fetched count dropped more than 50% vs last successful run" } : null,
      })
      .eq("id", run.id);
    console.log(suspicious ? `${opts.label} 수집 완료 (partial)` : `${opts.label} 수집 완료`);
  } catch (e) {
    await supabase
      .from("ingest_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        errors: { message: e instanceof Error ? e.message : String(e) },
      })
      .eq("id", run.id);
    throw e;
  }
}
