import type { DateRange, SaleInfo, SaleUnitInfo } from "./types";
import { formatManwon } from "./format";

/** 청약홈 분양 공고를 화면에 보여 줄 때 쓰는 문장들(project.md 32번) */

/** "10.12(월)" */
export function shortDay(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}.${d}(${"일월화수목금토"[new Date(y, m - 1, d).getDay()]})`;
}

const span = (r?: DateRange) => (!r ? "" : r[0] === r[1] ? shortDay(r[0]) : `${shortDay(r[0])}~${shortDay(r[1])}`);

/** 청약 일정 표의 줄들. 해당지역·기타지역 날짜가 같으면 한 줄로 */
export function saleScheduleRows(s: SaleInfo): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const sc = s.schedule;
  if (sc.special) rows.push({ label: "특별공급", value: span(sc.special) });
  const ranks: [string, DateRange | undefined, DateRange | undefined][] = [
    ["1순위", sc.rank1Local, sc.rank1Other],
    ["2순위", sc.rank2Local, sc.rank2Other],
  ];
  for (const [label, local, other] of ranks) {
    if (!local && !other) continue;
    if (local && other && span(local) !== span(other)) {
      rows.push({ label: `${label} 해당지역`, value: span(local) });
      rows.push({ label: `${label} 기타지역`, value: span(other) });
    } else rows.push({ label, value: span(local ?? other) });
  }
  if (sc.winners) rows.push({ label: "당첨자 발표", value: shortDay(sc.winners) });
  if (sc.contract) rows.push({ label: "계약", value: span(sc.contract) });
  return rows;
}

/** "특별공급 10.12(월) → 1순위 10.13(화) → 2순위 10.14(수) 순서로 접수해요." 단계가 하나뿐이면 없음 */
export function saleOrderLine(s: SaleInfo): string | undefined {
  const sc = s.schedule;
  const steps = [
    sc.special && `특별공급 ${shortDay(sc.special[0])}`,
    sc.rank1Local && `1순위 ${shortDay(sc.rank1Local[0])}`,
    sc.rank2Local && `2순위 ${shortDay(sc.rank2Local[0])}`,
  ].filter(Boolean);
  return steps.length > 1 ? `${steps.join(" → ")} 순서로 접수해요.` : undefined;
}

/** "투기과열지구 · 분양가상한제" / "규제지역 아님" */
export function regulationText(s: SaleInfo): string {
  const r = s.regulation;
  const parts = [r.speculative && "투기과열지구", r.adjusted && "조정대상지역", r.priceCap && "분양가상한제"].filter(Boolean);
  return parts.length ? parts.join(" · ") : "규제지역 아님";
}

const SPECIAL_LABEL: Record<string, string> = {
  newlywed: "신혼부부",
  firstHome: "생애최초",
  multiChild: "다자녀",
  elderlyParent: "노부모",
  newborn: "신생아",
  youth: "청년",
  institution: "기관추천",
  relocation: "이전기관",
  other: "기타",
};

/** 주택형 카드의 줄들 */
export function saleUnitRows(u: SaleUnitInfo): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (u.priceTop) rows.push({ label: "분양가(최고)", value: formatManwon(u.priceTop) });
  rows.push({ label: "공급", value: `일반 ${u.general}세대 · 특별공급 ${u.special}세대` });
  const detail = Object.entries(u.specialBreakdown).map(([k, v]) => `${SPECIAL_LABEL[k] ?? k} ${v}`);
  if (detail.length) rows.push({ label: "특별공급 내역", value: detail.join(" · ") });
  return rows;
}
