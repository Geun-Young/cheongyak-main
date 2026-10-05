"use client";

import { useMemo, useState } from "react";
import { CircleDashed } from "lucide-react";
import type { Announcement, EligibilityStatus, SupplyUnit } from "@/lib/types";
import { deriveFacts, useProfile } from "@/lib/profile";
import { useGuestProfile } from "@/lib/guest";
import { useSpecialGroups } from "@/lib/special-groups-store";
import { matchAnnouncement, matchUnit } from "@/lib/matching";
import { recommendUnits } from "@/lib/recommend";
import { saleUnitRows } from "@/lib/sale-display";
import { MatchPanel } from "./MatchPanel";
import { UnitLocationCard } from "./UnitLocationCard";
import { Card, cx } from "./ui";

const DOT_TONE: Record<EligibilityStatus, string> = {
  eligible: "bg-ok",
  ineligible: "bg-warn",
  needs_review: "bg-info",
  closed: "bg-ink-3",
};

/**
 * 공고 상세의 유닛 선택 + 그 유닛에 딸린 판정/일정/위치를 묶어서 보여준다.
 * 유닛이 하나뿐이면 탭 UI 없이 바로 그 유닛으로 렌더한다.
 */
export function SupplyUnitPicker({ a }: { a: Announcement }) {
  const [selectedId, setSelectedId] = useState(a.supplyUnits[0].id);
  const { profile } = useProfile();
  const guest = useGuestProfile();
  const [groups] = useSpecialGroups();
  const p = profile ?? guest;
  const facts = useMemo(() => (p ? deriveFacts(p, undefined, groups) : undefined), [p, groups]);

  const unit: SupplyUnit = a.supplyUnits.find((u) => u.id === selectedId) ?? a.supplyUnits[0];
  const showTabs = a.supplyUnits.length > 1;

  /**
   * 집이 여러 개일 때 "어디에 넣어야 하나"를 알려준다. 탭만 나열하면 사용자는
   * 13개 중 무엇을 눌러야 할지 모른다 — 추천 순서와 한줄평을 함께 보여준다.
   */
  const recommendation = useMemo(() => {
    if (!facts || !showTabs) return null;
    return recommendUnits(a, matchAnnouncement(a, facts).unitResults, facts, p ?? null);
  }, [a, facts, p, showTabs]);

  const recByUnit = useMemo(() => {
    const m = new Map<string, { rank: number; score: number; headline: string }>();
    recommendation?.ranked.forEach((r, i) => {
      m.set(r.unitId, { rank: i, score: r.score, headline: r.headline });
    });
    return m;
  }, [recommendation]);

  const selectedRec = recByUnit.get(unit.id);

  return (
    <div className="space-y-5">
      {showTabs && (
        <Card padded={false}>
          <div className="flex flex-wrap gap-2 p-3" role="tablist" aria-label="공급유닛">
            {a.supplyUnits.map((u) => {
              const active = u.id === unit.id;
              const status = facts ? matchUnit(a, u, facts).status : undefined;
              return (
                <button
                  key={u.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(u.id)}
                  className={cx(
                    "flex items-center gap-2 rounded-md px-3.5 py-2.5 text-left text-sm font-semibold transition-colors",
                    active ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-brand-soft hover:text-brand",
                  )}
                >
                  {status && (
                    <span
                      className={cx("size-2 shrink-0 rounded-full", active ? "bg-white" : DOT_TONE[status])}
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block">
                      {u.name}
                      {recByUnit.get(u.id)?.rank === 0 && (
                        <span
                          className={cx(
                            "ml-1.5 rounded px-1 py-0.5 text-[11px] font-bold",
                            active ? "bg-white/25 text-white" : "bg-brand text-white",
                          )}
                        >
                          추천
                        </span>
                      )}
                    </span>
                    <span className={cx("block text-[12px] font-normal tnum", active ? "text-white/80" : "text-ink-3")}>
                      {u.unitsCount.toLocaleString("ko-KR")}세대
                      {recByUnit.has(u.id) && ` · ${recByUnit.get(u.id)!.score}점`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {unit.summary && unit.summary.length > 0 && (
        <Card className="bg-surface-2">
          <ul className="space-y-1.5">
            {unit.summary.map((s) => (
              <li key={s} className="flex gap-2 text-sm text-ink-2">
                <CircleDashed size={15} className="mt-0.5 shrink-0 text-ink-3" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {selectedRec && recommendation && (
        <Card className="border-brand/30 bg-brand-tint">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-ink">
              {selectedRec.rank === 0
                ? "이 공고에서 가장 추천하는 집이에요"
                : `추천 ${selectedRec.rank + 1}위 (전체 ${recommendation.ranked.length}개 중)`}
            </h3>
            <span className="tnum text-[13px] font-bold text-brand">{selectedRec.score}점</span>
          </div>
          <p className="mt-1 text-[15px] font-semibold text-brand-deep">{selectedRec.headline}</p>
          {(() => {
            const full = recommendation.ranked.find((r) => r.unitId === unit.id);
            if (!full || full.reasons.length === 0) return null;
            return (
              <ul className="mt-2 space-y-0.5">
                {full.reasons.map((r) => (
                  <li key={r} className="text-[13px] leading-relaxed text-ink-2">
                    · {r}
                  </li>
                ))}
              </ul>
            );
          })()}
          <p className="mt-2 text-[12px] text-ink-3">
            같은 공고 안의 집끼리만 비교한 점수예요. 다른 공고와는 비교하지 마세요.
          </p>
        </Card>
      )}

      <MatchPanel a={a} unit={unit} />

      <Card>
        <h3 className="text-base font-bold text-ink">{unit.sale ? "분양 조건" : "일정과 임대 조건"}</h3>
        <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b border-line pb-2.5">
            <dt className="text-ink-3">입주 예정</dt>
            <dd className="font-semibold text-right">{unit.moveIn ?? "공고문 참고"}</dd>
          </div>
          {unit.sale ? (
            saleUnitRows(unit.sale).map((r) => (
              <div key={r.label} className="flex justify-between gap-4 border-b border-line pb-2.5 sm:col-span-2">
                <dt className="shrink-0 text-ink-3">{r.label}</dt>
                <dd className="font-semibold text-right tnum">{r.value}</dd>
              </div>
            ))
          ) : (
            <div className="flex justify-between gap-4 border-b border-line pb-2.5 sm:col-span-2">
              <dt className="shrink-0 text-ink-3">임대 조건</dt>
              <dd className="font-semibold text-right">{unit.rentNote ?? "공고문 참고"}</dd>
            </div>
          )}
        </dl>
      </Card>

      <UnitLocationCard unit={unit} />
    </div>
  );
}
