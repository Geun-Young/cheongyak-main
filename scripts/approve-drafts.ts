/**
 * 검증을 통과한 AI 초안을 supply_units에 자동 반영한다.
 *
 * 왜 자동인가: 126건을 사람이 다 볼 필요가 없다는 게 실제 데이터로 확인됐다 —
 * 842개 조건 중 스키마를 어긴 건 0개였고, 문제는 전부 "값이 문자열"이라는 기계적인
 * 것이라 normalize-draft.ts가 고칠 수 있다. 사람은 고칠 수 없는 것만 보면 된다.
 *
 * 안전장치 두 가지:
 *  1) normalizeDraft + autoApprovable을 통과하지 못하면 건드리지 않는다.
 *  2) 초안 유닛과 DB 유닛의 짝이 분명할 때만 반영한다(아래 decideMapping 참고).
 *     개수가 다르면서 유닛마다 조건도 다르면 엉뚱한 유닛에 붙을 수 있으므로 건너뛴다.
 *
 * 실행:
 *   npm run approve:drafts              무엇이 반영될지만 보여준다(기본: dry-run)
 *   npm run approve:drafts -- --apply   실제로 반영한다
 *   npm run approve:drafts -- --apply --limit=10
 */
import "./lib/load-env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDraft, autoApprovable } from "../src/lib/ingest/normalize-draft";
import type { DraftUnit, ExtractionDraft } from "../src/lib/ingest/gemini-extract";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요.");
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

interface DbUnit {
  id: string;
  announcement_id: string;
  name: string;
}

/** 조건 구성이 같은 유닛인지 비교하는 지문. 이름이 달라도 내용이 같으면 같은 취급 */
function conditionSignature(u: DraftUnit): string {
  const cond = (c: { field: string; operator: string; value: unknown }) =>
    `${c.field}|${c.operator}|${JSON.stringify(c.value)}`;
  return JSON.stringify({
    e: (u.eligibility ?? []).map(cond).sort(),
    t: (u.tiers ?? [])
      .map((t) => `${t.rank}:${(t.conditions ?? []).map(cond).sort().join(",")}`)
      .sort(),
    s: (u.scoreRules ?? []).map((r) => r.field).sort(),
  });
}

type Mapping =
  | { kind: "all"; draftUnit: DraftUnit; reason: string }
  | { kind: "pairwise"; pairs: { dbUnit: DbUnit; draftUnit: DraftUnit }[]; reason: string }
  | { kind: "skip"; reason: string };

/**
 * 초안 유닛을 DB 유닛에 어떻게 붙일지 정한다.
 *
 * 실제 데이터 분포(126건)를 보고 정한 규칙이다:
 *  - 초안 유닛 1개(85건): 공고 전체에 공통으로 적용되는 조건이다 → DB 유닛 전부에 적용.
 *  - 여러 개인데 조건이 전부 같음(27건): 어느 유닛에 붙이든 결과가 같다 → 전부에 적용.
 *  - 개수가 같음: 순서대로 짝짓는다. 초안은 공고문 표 순서를 따르므로 대체로 맞는다.
 *  - 그 외(개수도 다르고 조건도 다름, 14건): 잘못 붙으면 자격요건이 틀려진다 → 사람에게.
 */
function decideMapping(draftUnits: DraftUnit[], dbUnits: DbUnit[]): Mapping {
  if (draftUnits.length === 0) return { kind: "skip", reason: "초안 유닛 없음" };
  if (dbUnits.length === 0) return { kind: "skip", reason: "DB에 유닛 없음" };

  if (draftUnits.length === 1) {
    return { kind: "all", draftUnit: draftUnits[0], reason: "초안 유닛 1개 → 전체 적용" };
  }

  const sigs = new Set(draftUnits.map(conditionSignature));
  if (sigs.size === 1) {
    return { kind: "all", draftUnit: draftUnits[0], reason: "모든 초안 유닛의 조건이 동일 → 전체 적용" };
  }

  if (draftUnits.length === dbUnits.length) {
    return {
      kind: "pairwise",
      pairs: dbUnits.map((dbUnit, i) => ({ dbUnit, draftUnit: draftUnits[i] })),
      reason: `유닛 수 일치(${dbUnits.length}) → 순서대로 매칭`,
    };
  }

  return {
    kind: "skip",
    reason: `초안 ${draftUnits.length}개 vs DB ${dbUnits.length}개이고 조건도 서로 다름 → 사람이 확인 필요`,
  };
}

/** approveDraftToUnit과 같은 일을 하되, 스크립트에서 쓰려고 service_role 클라이언트를 직접 받는다 */
async function writeUnit(sb: SupabaseClient, announcementId: string, unitId: string, draftUnit: DraftUnit) {
  const prefix = unitId;
  const withIds = (list: DraftUnit["eligibility"], p: string) =>
    list.map((d, i) => ({ ...d, id: `${p}-c${i}` }));

  const { error } = await sb
    .from("supply_units")
    .update({
      eligibility: withIds(draftUnit.eligibility ?? [], prefix),
      tiers: (draftUnit.tiers ?? []).map((t) => ({
        rank: t.rank ?? 1,
        label: t.label,
        conditions: withIds(t.conditions ?? [], `${prefix}-t${t.rank}`),
      })),
      score_rules: (draftUnit.scoreRules ?? []).map((r, i) => ({
        id: `${prefix}-s${i}`,
        label: r.label,
        field: r.field,
        bands: r.bands,
      })),
      other_requirements: draftUnit.otherRequirements ?? [],
    })
    .eq("id", unitId)
    .eq("announcement_id", announcementId);
  if (error) throw error;
}

async function main() {
  const { data: rows, error } = await supabase
    .from("announcements")
    .select("id, title, apply_end, ai_draft")
    .eq("ai_draft_status", "extracted")
    .order("apply_end", { ascending: true });
  if (error) throw error;

  const { data: unitRows, error: uErr } = await supabase
    .from("supply_units")
    .select("id, announcement_id, name");
  if (uErr) throw uErr;

  const unitsByAnnouncement = new Map<string, DbUnit[]>();
  for (const u of (unitRows ?? []) as DbUnit[]) {
    const list = unitsByAnnouncement.get(u.announcement_id) ?? [];
    list.push(u);
    unitsByAnnouncement.set(u.announcement_id, list);
  }

  const targets = LIMIT > 0 ? (rows ?? []).slice(0, LIMIT) : (rows ?? []);
  let approved = 0;
  let skipped = 0;
  let unitsWritten = 0;
  let fixedTotal = 0;
  const skipReasons: string[] = [];

  for (const row of targets) {
    const result = normalizeDraft(row.ai_draft as ExtractionDraft);
    fixedTotal += result.fixedCount;

    const verdict = autoApprovable(result);
    if (!verdict.ok) {
      skipped += 1;
      skipReasons.push(`  ${row.apply_end} ${String(row.title).slice(0, 34)} — ${verdict.reason}`);
      continue;
    }

    const dbUnits = unitsByAnnouncement.get(row.id) ?? [];
    const mapping = decideMapping(result.draft.unitsFound, dbUnits);
    if (mapping.kind === "skip") {
      skipped += 1;
      skipReasons.push(`  ${row.apply_end} ${String(row.title).slice(0, 34)} — ${mapping.reason}`);
      continue;
    }

    if (APPLY) {
      if (mapping.kind === "all") {
        for (const u of dbUnits) await writeUnit(supabase, row.id, u.id, mapping.draftUnit);
      } else {
        for (const { dbUnit, draftUnit } of mapping.pairs) {
          await writeUnit(supabase, row.id, dbUnit.id, draftUnit);
        }
      }
      // 조건이 유닛에 실제로 들어갔으니 판정 가능 상태로 올린다.
      const { error: aErr } = await supabase
        .from("announcements")
        .update({ ai_draft_status: "approved", review_status: "ready" })
        .eq("id", row.id);
      if (aErr) throw aErr;
    }

    approved += 1;
    unitsWritten += mapping.kind === "all" ? dbUnits.length : mapping.pairs.length;
  }

  console.log(APPLY ? "=== 반영 완료 ===" : "=== 미리보기(실제 반영 안 함) ===");
  console.log(`대상 ${targets.length}건`);
  console.log(`  자동 승인: ${approved}건 (유닛 ${unitsWritten}개)`);
  console.log(`  사람이 확인: ${skipped}건`);
  console.log(`  정규화로 고친 조건: ${fixedTotal}개`);
  if (skipReasons.length > 0) {
    console.log("\n사람이 확인해야 하는 공고:");
    skipReasons.forEach((r) => console.log(r));
  }
  if (!APPLY) {
    console.log("\n실제로 반영하려면: npm run approve:drafts -- --apply");
  }
}

main().catch((e) => {
  console.error("실패:", e.message ?? e);
  process.exit(1);
});
