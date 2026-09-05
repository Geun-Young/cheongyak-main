"use client";

import { useMemo, useState } from "react";
import { Home, MapPin } from "lucide-react";
import type { Announcement, EligibilityStatus, MatchResult } from "@/lib/types";
import { HOUSING_TYPES, REGIONS } from "@/lib/regions";
import { daysLeft } from "@/lib/format";
import { AnnouncementRow } from "./AnnouncementRow";
import { Empty, Select, cx } from "./ui";

export type ListTab = "all" | EligibilityStatus | "urgent";
type SortKey = "deadline" | "newest";

const TABS: { key: ListTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "eligible", label: "신청 가능" },
  { key: "ineligible", label: "조건 미달" },
  { key: "needs_review", label: "확인 필요" },
  { key: "closed", label: "마감" },
];

export function isUrgent(a: Announcement, r?: MatchResult): boolean {
  const left = daysLeft(a.applyEnd);
  return r?.status === "eligible" && left >= 0 && left <= 3;
}

export function AnnouncementList({
  items,
  results,
  tab,
  onTabChange,
  initialRegion = "",
  initialType = "",
  emptyAction,
}: {
  items: Announcement[];
  results?: Map<string, MatchResult>;
  tab: ListTab;
  onTabChange: (t: ListTab) => void;
  initialRegion?: string;
  initialType?: string;
  emptyAction?: React.ReactNode;
}) {
  const [region, setRegion] = useState(initialRegion);
  const [type, setType] = useState(initialType);
  const [sort, setSort] = useState<SortKey>("deadline");

  const counts = useMemo(() => {
    const c: Record<ListTab, number> = { all: 0, eligible: 0, ineligible: 0, needs_review: 0, closed: 0, urgent: 0 };
    for (const a of items) {
      const r = results?.get(a.id);
      c.all += 1;
      if (r) c[r.status] += 1;
      if (isUrgent(a, r)) c.urgent += 1;
    }
    return c;
  }, [items, results]);

  const visible = useMemo(() => {
    const list = items.filter((a) => {
      const r = results?.get(a.id);
      if (tab === "urgent" && !isUrgent(a, r)) return false;
      if (tab !== "all" && tab !== "urgent" && (r?.status ?? "needs_review") !== tab) return false;
      if (region && a.region !== region && a.region !== "전국") return false;
      if (type && a.housingType !== type) return false;
      return true;
    });
    list.sort((x, y) => {
      if (sort === "newest") return y.announcedAt.localeCompare(x.announcedAt);
      const lx = daysLeft(x.applyEnd);
      const ly = daysLeft(y.applyEnd);
      const ax = lx < 0 ? Number.MAX_SAFE_INTEGER : lx;
      const ay = ly < 0 ? Number.MAX_SAFE_INTEGER : ly;
      return ax - ay;
    });
    return list;
  }, [items, results, tab, region, type, sort]);

  const showTabs = Boolean(results);

  return (
    <section className="rounded-xl border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-3 border-b border-line p-3 md:flex-row md:items-center md:justify-between md:px-4">
        {showTabs ? (
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="판정 상태">
            {TABS.concat(counts.urgent > 0 ? [{ key: "urgent", label: "마감 임박" }] : []).map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(t.key)}
                  className={cx(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors",
                    active ? "bg-brand text-white" : "text-ink-2 hover:bg-brand-soft hover:text-brand",
                  )}
                >
                  {t.label}
                  <span className={cx("rounded-sm px-1.5 text-xs tnum", active ? "bg-white/20" : "bg-ground text-ink-3")}>
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-1 text-sm font-semibold text-ink-2">
            전체 공고 <span className="tnum">{counts.all}</span>건
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 md:flex md:w-auto">
          <label className="relative">
            <MapPin size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-3 md:left-2.5" />
            <Select value={region} onChange={(e) => setRegion(e.target.value)} className="h-10 pl-7 text-[13px] md:w-32 md:pl-8 md:text-sm" aria-label="지역">
              <option value="">전체 지역</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </label>
          <label className="relative">
            <Home size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-3 md:left-2.5" />
            <Select value={type} onChange={(e) => setType(e.target.value)} className="h-10 pl-7 text-[13px] md:w-40 md:pl-8 md:text-sm" aria-label="주택 유형">
              <option value="">전체 유형</option>
              {HOUSING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </label>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 text-[13px] md:w-32 md:text-sm" aria-label="정렬">
            <option value="deadline">마감 임박순</option>
            <option value="newest">최신순</option>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty
          title="조건에 맞는 공고가 없어요"
          body="지역이나 주택유형 필터를 넓혀 보세요. 새 공고가 올라오면 알림으로 알려드려요."
          action={emptyAction}
        />
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((a) => (
            <li key={a.id}>
              <AnnouncementRow a={a} result={results?.get(a.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
