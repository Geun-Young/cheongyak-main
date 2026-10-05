/**
 * 청약홈 민영 아파트 공고에 판정 규칙을 적는다(project.md 33번).
 *
 * 임대 공고는 PDF → AI 초안 → 자동 승인으로 조건을 얻지만, 민영 분양은 규칙의 틀이 같고 공고마다 다른 값
 * (규제지역·면적·특별공급 물량)이 청약홈 API에 있어서 src/lib/rules/sale-rules.ts로 바로 만든다.
 * 매번 다시 계산해서 달라진 유닛만 쓴다 — 원천이 바뀌어 수집기가 recheck로 내린 공고도 여기서 다시 ready가 된다.
 * 공공분양·신혼희망타운(국민주택)은 규칙이 달라 아직 만들지 않는다("확인 필요" 유지).
 *
 * 실행: npm run rules:applyhome            (기본: 바로 반영. --dry-run이면 보여 주기만)
 */
import "./lib/load-env";
import { createClient } from "@supabase/supabase-js";
import { buildPrivateSaleVariants } from "../src/lib/rules/sale-rules";
import type { Region, SaleInfo, SaleUnitInfo } from "../src/lib/types";

const DRY = process.argv.includes("--dry-run");

/** jsonb는 저장할 때 키 순서를 바꾸므로, 키를 정렬해서 비교해야 "안 바뀜"을 알아본다 */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const since = new Date(Date.now() + 9 * 3_600_000 - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: anns, error } = await supabase
    .from("announcements")
    .select("id, title, region, sale, review_status")
    .eq("source", "applyhome")
    .gte("apply_end", since);
  if (error) throw error;

  let ready = 0;
  let unitsWritten = 0;
  const skipped: string[] = [];
  for (const a of anns ?? []) {
    const sale = a.sale as SaleInfo | null;
    if (!sale || sale.kind !== "민영") {
      skipped.push(`${a.title} — 국민주택(공공분양·신혼희망타운)은 아직 규칙 없음`);
      continue;
    }
    const { data: units, error: uErr } = await supabase
      .from("supply_units")
      .select("id, sale, variants, eligibility")
      .eq("announcement_id", a.id)
      .eq("active", true);
    if (uErr) throw uErr;

    const built = (units ?? []).map((u) => ({ u, variants: u.sale ? buildPrivateSaleVariants(a.region as Region | null, sale, u.sale as SaleUnitInfo) : null }));
    if (!built.length || built.some((b) => !b.variants)) {
      skipped.push(`${a.title} — 지역 또는 주택형 정보가 없어 규칙을 못 만듦`);
      continue;
    }

    for (const { u, variants } of built) {
      if (stable(u.variants) === stable(variants) && (u.eligibility ?? []).length === 0) continue;
      unitsWritten += 1;
      if (!DRY) {
        const { error: wErr } = await supabase
          .from("supply_units")
          .update({ eligibility: [], tiers: [], score_rules: [], other_requirements: [], variants })
          .eq("id", u.id);
        if (wErr) throw wErr;
      }
    }
    if (a.review_status !== "ready") {
      ready += 1;
      if (!DRY) {
        const { error: rErr } = await supabase.from("announcements").update({ review_status: "ready" }).eq("id", a.id);
        if (rErr) throw rErr;
      }
    }
  }

  console.log(DRY ? "=== 미리보기 ===" : "=== 반영 완료 ===");
  console.log(`청약홈 공고 ${anns?.length ?? 0}건 · 판정 가능으로 바꾼 공고 ${ready}건 · 규칙을 쓴 주택형 ${unitsWritten}개`);
  if (skipped.length) {
    console.log("\n규칙을 만들지 않은 공고:");
    skipped.forEach((s) => console.log("  " + s));
  }
}

main().catch((e) => {
  console.error("실패:", e.message ?? e);
  process.exit(1);
});
