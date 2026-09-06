"use client";

import { useMemo, useState } from "react";
import { CircleDashed } from "lucide-react";
import type { Announcement, EligibilityStatus, SupplyUnit } from "@/lib/types";
import { deriveFacts, useProfile } from "@/lib/profile";
import { useGuestProfile } from "@/lib/guest";
import { matchUnit } from "@/lib/matching";
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
  const p = profile ?? guest;
  const facts = useMemo(() => (p ? deriveFacts(p) : undefined), [p]);

  const unit: SupplyUnit = a.supplyUnits.find((u) => u.id === selectedId) ?? a.supplyUnits[0];
  const showTabs = a.supplyUnits.length > 1;

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
                    <span className="block">{u.name}</span>
                    <span className={cx("block text-[12px] font-normal tnum", active ? "text-white/80" : "text-ink-3")}>
                      {u.unitsCount.toLocaleString("ko-KR")}세대
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

      <MatchPanel a={a} unit={unit} />

      <Card>
        <h3 className="text-base font-bold text-ink">일정과 임대 조건</h3>
        <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b border-line pb-2.5">
            <dt className="text-ink-3">입주 예정</dt>
            <dd className="font-semibold text-right">{unit.moveIn ?? "공고문 참고"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-2.5 sm:col-span-2">
            <dt className="shrink-0 text-ink-3">임대 조건</dt>
            <dd className="font-semibold text-right">{unit.rentNote ?? "공고문 참고"}</dd>
          </div>
        </dl>
      </Card>

      <UnitLocationCard unit={unit} />
    </div>
  );
}
