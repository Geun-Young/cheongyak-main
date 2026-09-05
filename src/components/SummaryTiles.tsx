import { AlertTriangle, CalendarClock, CheckCircle2, HelpCircle } from "lucide-react";
import type { EligibilityStatus } from "@/lib/types";
import { cx } from "./ui";

export type SummaryKey = EligibilityStatus | "urgent";

const TILES: { key: SummaryKey; label: string; caption: string; Icon: typeof CheckCircle2; iconCls: string; numCls: string }[] = [
  { key: "eligible", label: "신청 가능", caption: "자격 요건 충족", Icon: CheckCircle2, iconCls: "bg-ok-soft text-ok", numCls: "text-ok" },
  { key: "ineligible", label: "조건 미달", caption: "일부 요건 미달", Icon: AlertTriangle, iconCls: "bg-warn-soft text-warn", numCls: "text-warn" },
  { key: "needs_review", label: "확인 필요", caption: "조건 정리 중", Icon: HelpCircle, iconCls: "bg-info-soft text-info", numCls: "text-info" },
  { key: "urgent", label: "마감 임박", caption: "3일 이내 마감", Icon: CalendarClock, iconCls: "bg-danger-soft text-danger", numCls: "text-danger" },
];

export function SummaryTiles({
  counts,
  active,
  onSelect,
}: {
  counts: Record<SummaryKey, number>;
  active?: SummaryKey;
  onSelect?: (key: SummaryKey) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map(({ key, label, caption, Icon, iconCls, numCls }) => {
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(key)}
            aria-pressed={selected}
            className={cx(
              "flex items-center gap-3 rounded-xl border bg-surface p-4 text-left shadow-card transition-colors",
              selected ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-line-strong",
            )}
          >
            <span className={cx("grid size-11 shrink-0 place-items-center rounded-lg", iconCls)}>
              <Icon size={22} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink-3">{label}</span>
              <span className={cx("block text-2xl font-extrabold leading-tight tnum", numCls)}>
                {counts[key]}
                <span className="ml-0.5 text-sm font-semibold text-ink-2">건</span>
              </span>
              <span className="hidden whitespace-nowrap text-[12px] text-ink-3 sm:block lg:hidden xl:block">{caption}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
