/**
 * 이미 승인된 유닛의 조건에서 "모두를 탈락시키는" 표현을 바로잡는다 — 보정(project.md 29번).
 *
 * 앞으로 들어오는 초안은 normalize-draft.ts가 같은 규칙(src/lib/condition-fixes.ts)으로 고치지만,
 * 그 전에 승인된 유닛에는 "대한민국"·"인천광역시"·"군산" 같은 거주 값, "통장 가입 불필요"를
 * "통장 없어야 함"으로 담은 조건 등이 그대로 남아 신청할 수 있는 사람을 탈락시키고 있었다.
 * 다시 돌려도 안전하다(이미 맞는 조건은 건드리지 않는다). 규칙을 고치면 다시 돌린다.
 *
 * 실행:
 *   npm run fix:conditions            무엇이 바뀔지만 보여준다(기본: dry-run)
 *   npm run fix:conditions -- --apply 실제로 반영한다
 */
import "./lib/load-env";
import { createClient } from "@supabase/supabase-js";
import { expandAlternatives, fixRuleSet } from "../src/lib/condition-fixes";
import type { Condition, OtherRequirement, ScoreRule, Tier, UnitVariant } from "../src/lib/types";

const APPLY = process.argv.includes("--apply");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

interface Rules {
  eligibility: Condition[];
  tiers: Tier[];
  otherRequirements?: OtherRequirement[];
}

/** 자격·순위 조건을 고친다. 자격이 통째로 비게 되면(근거가 사라져 "확인 필요"가 됨) 알린다 */
function fixRules<T extends Rules>(r: T): { rules: T; changed: number; emptied: boolean } {
  const f = fixRuleSet(r);
  return {
    rules: f.rules,
    changed: f.changed,
    emptied: (r.eligibility ?? []).length > 0 && f.rules.eligibility.length === 0,
  };
}

async function main() {
  const { data, error } = await supabase
    .from("supply_units")
    .select("id, announcement_id, eligibility, tiers, score_rules, other_requirements, variants");
  if (error) throw error;

  let unitsChanged = 0;
  let conditionsChanged = 0;
  let emptied = 0;
  let ageSplits = 0;
  for (const u of data ?? []) {
    const before = JSON.stringify([u.eligibility, u.tiers, u.score_rules, u.other_requirements, u.variants]);

    const base = fixRules({
      eligibility: (u.eligibility ?? []) as Condition[],
      tiers: (u.tiers ?? []) as Tier[],
      otherRequirements: (u.other_requirements ?? undefined) as OtherRequirement[] | undefined,
    });
    let changed = base.changed;
    if (base.emptied) emptied += 1;

    // 나이가 직접 확인 조건에만 있으면 판정에 쓰이게 — "또는"이면 경로를 둘로 나눈다(condition-fixes.ts)
    let variants: UnitVariant[] | null = null;
    if (u.variants) {
      const fixed = (u.variants as UnitVariant[]).map((v) => {
        const f = fixRules(v);
        changed += f.changed;
        if (f.emptied) emptied += 1;
        return f.rules;
      });
      variants = fixed.flatMap((v) => expandAlternatives(v));
      ageSplits += variants.length - fixed.length;
    }
    let unit = { ...base.rules, scoreRules: (u.score_rules ?? []) as ScoreRule[] };
    if (!variants) {
      const parts = expandAlternatives({ name: "", ...unit });
      if (parts.length > 1) {
        // 유닛 자체를 "나이 경로 + 나이 기준 외 경로"로 바꾼다. 판정은 경로로 하므로 유닛 칸은 비운다
        variants = parts;
        unit = { eligibility: [], tiers: [], otherRequirements: [], scoreRules: [] };
        ageSplits += 1;
      } else {
        unit = { ...parts[0] };
        delete (unit as { name?: string }).name;
      }
    }

    const next = {
      eligibility: unit.eligibility,
      tiers: unit.tiers,
      score_rules: unit.scoreRules,
      other_requirements: unit.otherRequirements ?? [],
      variants,
    };
    const after = JSON.stringify([next.eligibility, next.tiers, next.score_rules, next.other_requirements, next.variants]);
    if (after === before) continue;

    unitsChanged += 1;
    conditionsChanged += changed;
    if (APPLY) {
      const { error: uErr } = await supabase.from("supply_units").update(next).eq("id", u.id);
      if (uErr) throw uErr;
    }
  }

  console.log(APPLY ? "=== 반영 완료 ===" : "=== 미리보기(실제 반영 안 함) ===");
  console.log(`유닛 ${data?.length ?? 0}개 중 바뀐 유닛 ${unitsChanged}개, 고친 조건 ${conditionsChanged}개, 나이·혼인으로 나눈 경로 ${ageSplits}개`);
  console.log(`자격 조건이 통째로 비게 된 유닛·경로: ${emptied}개 (이들은 "확인 필요"로 바뀐다)`);
  if (!APPLY) console.log("\n실제로 반영하려면: npm run fix:conditions -- --apply");
}

main().catch((e) => {
  console.error("실패:", e.message ?? e);
  process.exit(1);
});
