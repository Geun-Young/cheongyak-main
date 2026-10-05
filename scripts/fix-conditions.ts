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
import { fixRuleSet } from "../src/lib/condition-fixes";
import type { Condition, OtherRequirement, Tier, UnitVariant } from "../src/lib/types";

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
    .select("id, announcement_id, eligibility, tiers, other_requirements, variants");
  if (error) throw error;

  let unitsChanged = 0;
  let conditionsChanged = 0;
  let emptied = 0;
  for (const u of data ?? []) {
    const base = fixRules({
      eligibility: (u.eligibility ?? []) as Condition[],
      tiers: (u.tiers ?? []) as Tier[],
      otherRequirements: (u.other_requirements ?? undefined) as OtherRequirement[] | undefined,
    });
    let changed = base.changed;
    if (base.emptied) emptied += 1;
    const variants = ((u.variants ?? []) as UnitVariant[]).map((v) => {
      const f = fixRules(v);
      changed += f.changed;
      if (f.emptied) emptied += 1;
      return f.rules;
    });
    if (changed === 0) continue;

    unitsChanged += 1;
    conditionsChanged += changed;
    if (APPLY) {
      const { error: uErr } = await supabase
        .from("supply_units")
        .update({
          eligibility: base.rules.eligibility,
          tiers: base.rules.tiers,
          other_requirements: base.rules.otherRequirements ?? [],
          variants: u.variants ? variants : null,
        })
        .eq("id", u.id);
      if (uErr) throw uErr;
    }
  }

  console.log(APPLY ? "=== 반영 완료 ===" : "=== 미리보기(실제 반영 안 함) ===");
  console.log(`유닛 ${data?.length ?? 0}개 중 바뀐 유닛 ${unitsChanged}개, 고친 조건 ${conditionsChanged}개`);
  console.log(`자격 조건이 통째로 비게 된 유닛·경로: ${emptied}개 (이들은 "확인 필요"로 바뀐다)`);
  if (!APPLY) console.log("\n실제로 반영하려면: npm run fix:conditions -- --apply");
}

main().catch((e) => {
  console.error("실패:", e.message ?? e);
  process.exit(1);
});
