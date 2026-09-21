/**
 * 단지별 인기도(네이버 블로그·카페 글 수)를 모아 unit_popularity에 저장한다.
 *
 * 왜 배치인가: 검색 API는 하루 호출 한도가 있고 응답도 느리다. 화면을 그릴 때마다 부르면
 * 사용자가 기다리고 한도도 금방 없어진다. 주 1회쯤 돌려서 채워 두고 읽기만 한다.
 *
 * **집이 2개 이상인 공고만** 대상으로 한다. 집이 하나뿐이면 비교할 상대가 없어서
 * 인기도를 재도 추천 순서가 바뀌지 않는다 — 호출을 아낀다.
 *
 * 실행:
 *   npm run fetch:popularity              무엇을 조회할지만 보여준다(기본: dry-run)
 *   npm run fetch:popularity -- --apply   실제로 조회하고 저장한다
 *   npm run fetch:popularity -- --apply --stale=7   7일 이상 지난 것만 갱신
 */
import "./lib/load-env";
import { createClient } from "@supabase/supabase-js";
import {
  buildQuery,
  fetchPopularity,
  normalizePopularity,
  NaverCredentialsMissingError,
  type PopularityResult,
} from "../src/lib/ingest/naver-popularity";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요.");
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const STALE_DAYS = Number(args.find((a) => a.startsWith("--stale="))?.split("=")[1] ?? "0");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** 네이버 쪽에 부담을 주지 않도록 호출 사이에 잠깐 쉰다 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface UnitRow {
  id: string;
  announcement_id: string;
  name: string;
  address: string | null;
}

async function main() {
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 접수 중인 공고만 본다. 마감된 공고의 인기도를 갱신해 봐야 아무도 안 본다.
  const { data: anns, error: aErr } = await supabase
    .from("announcements")
    .select("id, title")
    .eq("status", "published")
    .gte("apply_end", todayKst);
  if (aErr) throw aErr;

  const annIds = new Set((anns ?? []).map((a) => a.id));
  const titleById = new Map((anns ?? []).map((a) => [a.id, a.title as string]));

  const { data: unitRows, error: uErr } = await supabase
    .from("supply_units")
    .select("id, announcement_id, name, address");
  if (uErr) throw uErr;

  const byAnnouncement = new Map<string, UnitRow[]>();
  for (const u of (unitRows ?? []) as UnitRow[]) {
    if (!annIds.has(u.announcement_id)) continue;
    const list = byAnnouncement.get(u.announcement_id) ?? [];
    list.push(u);
    byAnnouncement.set(u.announcement_id, list);
  }

  // 집이 하나뿐인 공고는 비교 상대가 없어서 인기도가 순서를 바꾸지 못한다.
  const targets = [...byAnnouncement.entries()].filter(([, list]) => list.length > 1);

  // 이미 최근에 조회한 건 건너뛴다(--stale=N을 주면 N일 지난 것만 다시 본다).
  let skipFresh = new Set<string>();
  if (STALE_DAYS > 0) {
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();
    const { data: fresh, error: fErr } = await supabase
      .from("unit_popularity")
      .select("unit_id")
      .gte("fetched_at", cutoff);
    if (fErr) throw fErr;
    skipFresh = new Set((fresh ?? []).map((r) => r.unit_id as string));
  }

  const pending = targets.flatMap(([, list]) => list).filter((u) => !skipFresh.has(u.id));
  const calls = pending.length * 2; // 블로그 + 카페

  console.log(APPLY ? "=== 인기도 수집 ===" : "=== 미리보기(실제 조회 안 함) ===");
  console.log(`집이 2개 이상인 공고 ${targets.length}건 · 대상 단지 ${pending.length}개`);
  console.log(`예상 API 호출: ${calls}회 (단지당 블로그+카페 2회)`);
  if (skipFresh.size > 0) console.log(`최근 조회분 ${skipFresh.size}개는 건너뜀`);

  if (!APPLY) {
    console.log("\n조회할 검색어 (앞 10개):");
    for (const u of pending.slice(0, 10)) {
      console.log(`  "${buildQuery(u.name, u.address ?? undefined)}"`);
    }
    console.log("\n실제로 수집하려면: npm run fetch:popularity -- --apply");
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const [announcementId, list] of targets) {
    const todo = list.filter((u) => !skipFresh.has(u.id));
    if (todo.length === 0) continue;

    console.log(`\n[${String(titleById.get(announcementId)).slice(0, 34)}] 단지 ${todo.length}개`);

    const results: { unit: UnitRow; result: PopularityResult }[] = [];
    for (const u of todo) {
      try {
        const r = await fetchPopularity(u.name, u.address ?? undefined);
        results.push({ unit: u, result: r });
        console.log(`   ${String(r.totalCount).padStart(6)}건  "${r.query}"`);
        await sleep(120);
      } catch (e) {
        if (e instanceof NaverCredentialsMissingError) throw e;
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`   실패: ${u.name} — ${msg.slice(0, 80)}`);
      }
    }

    if (results.length === 0) continue;

    // 같은 공고 안에서만 정규화한다 — 지역 규모 차이를 지우기 위해서다.
    const relatives = normalizePopularity(results.map((r) => r.result.totalCount));

    const rows = results.map((r, i) => ({
      unit_id: r.unit.id,
      query: r.result.query,
      // 블로그·카페를 나눠서 저장해 둔다. 지금 쓰는 건 합계뿐이지만, 나중에 "카페 글이 많다
      // = 실수요자 관심"처럼 다르게 해석하고 싶어질 때 다시 수집하지 않아도 된다.
      blog_count: r.result.blogCount,
      cafe_count: r.result.cafeCount,
      total_count: r.result.totalCount,
      relative_score: relatives[i],
      fetched_at: new Date().toISOString(),
      note: r.result.note ?? null,
    }));

    const { error } = await supabase.from("unit_popularity").upsert(rows, { onConflict: "unit_id" });
    if (error) throw error;
    ok += rows.length;
  }

  console.log(`\n저장 완료: ${ok}개 단지${failed > 0 ? ` · 실패 ${failed}개` : ""}`);
}

main().catch((e) => {
  console.error("실패:", e.message ?? e);
  process.exit(1);
});
