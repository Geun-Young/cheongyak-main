"use client";

import { useMemo, useState } from "react";
import type { Announcement } from "@/lib/types";
import { DEMO_PROFILE, deriveFacts, useProfile } from "@/lib/profile";
import { useSpecialGroups } from "@/lib/special-groups-store";
import { countByStatus, matchAll } from "@/lib/matching";
import { relativeTime } from "@/lib/format";
import { filterByDesiredRegions, recommendAcross } from "@/lib/recommend";
import { AnnouncementList, isUrgent, type ListTab } from "./AnnouncementList";
import { RecommendPanel } from "./RecommendPanel";
import { SummaryTiles, type SummaryKey } from "./SummaryTiles";
import { ButtonLink, Container } from "./ui";

export function DashboardView({ items, lastSyncedAt }: { items: Announcement[]; lastSyncedAt: string | null }) {
  const { profile, isLoggedIn } = useProfile();
  const p = profile ?? DEMO_PROFILE;
  const [groups] = useSpecialGroups();
  const [tab, setTab] = useState<ListTab>("all");
  // 사용자가 고른 지역만 볼지, 전체를 볼지. 기본은 고른 지역이다.
  const [showAllRegions, setShowAllRegions] = useState(false);

  const { results, counts } = useMemo(() => {
    const facts = deriveFacts(p, undefined, groups);
    const results = matchAll(items, facts);
    const base = countByStatus(results.values());
    const urgent = items.filter((a) => isUrgent(a, results.get(a.id))).length;
    return { results, counts: { ...base, urgent } as Record<SummaryKey, number> };
  }, [p, items, groups]);

  /**
   * 추천은 "고른 지역 안에서, 공고마다 어느 집이 나에게 맞는지"를 보여준다.
   * 판정(results)과 달리 자격이 되는 집만 들어가고, 마감 임박 순으로 정렬된다.
   */
  const { recommendations, regionFiltered } = useMemo(() => {
    const facts = deriveFacts(p, undefined, groups);
    const scoped = filterByDesiredRegions(items, p.desiredRegions, showAllRegions);
    return {
      recommendations: recommendAcross(scoped, results, facts, p).slice(0, 6),
      regionFiltered: !showAllRegions && (p.desiredRegions?.length ?? 0) > 0,
    };
  }, [p, items, results, showAllRegions, groups]);

  const needsOnboarding = isLoggedIn && !p.onboardingDone;

  return (
    <Container className="py-6 md:py-10">
      {!isLoggedIn && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand-tint px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-2">
            체험 계정 <strong className="text-ink">김청약</strong>(32세·서울·1인 가구·소득 100% 이하)의 화면이에요.
          </p>
          <div className="flex gap-2">
            <ButtonLink href="/login" size="sm" variant="secondary">로그인</ButtonLink>
            <ButtonLink href="/signup" size="sm">내 정보로 보기</ButtonLink>
          </div>
        </div>
      )}
      {needsOnboarding && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-2">아직 정보 입력이 끝나지 않았어요. 입력을 마치면 판정이 정확해져요.</p>
          <ButtonLink href="/onboarding" size="sm">이어서 입력하기</ButtonLink>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-center">
        <div>
          <h1 className="text-[22px] font-bold text-ink md:text-[26px]">지금 신청 가능한 공고</h1>
          <p className="rise-once mt-1 text-[56px] font-extrabold leading-none tracking-tight text-brand tnum md:text-[64px]">
            {counts.eligible}
            <span className="ml-1 text-2xl font-bold text-ink">건</span>
          </p>
          <p className="mt-3 max-w-md text-ink-2">
            {p.name || "회원"}님 조건으로 {items.length}건을 확인했어요. 마감이 가까운 순서로 보여드려요.
          </p>
        </div>
        <SummaryTiles
          counts={counts}
          active={tab === "all" ? undefined : (tab as SummaryKey)}
          onSelect={(k) => setTab(tab === k ? "all" : k)}
        />
      </section>

      {lastSyncedAt && (
        <p className="mt-4 text-[13px] text-ink-3">마지막 갱신 {relativeTime(lastSyncedAt)}</p>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-bold text-ink">
              {p.name || "회원"}님께 추천하는 집
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-2">
              {regionFiltered
                ? `관심 지역(${(p.desiredRegions ?? []).join("·")}) 안에서 골랐어요.`
                : "전체 지역에서 골랐어요."}
            </p>
          </div>
          {(p.desiredRegions?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setShowAllRegions((v) => !v)}
              className="h-9 shrink-0 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand"
            >
              {showAllRegions ? "관심 지역만 보기" : "전체 지역 보기"}
            </button>
          )}
        </div>
        <RecommendPanel
          recommendations={recommendations}
          regionFiltered={regionFiltered}
          onShowAll={() => setShowAllRegions(true)}
        />
      </section>

      <div className="mt-8">
        <AnnouncementList
          items={items}
          results={results}
          tab={tab}
          onTabChange={setTab}
          emptyAction={<ButtonLink href="/announcements" variant="secondary">전체 공고 보기</ButtonLink>}
        />
      </div>
    </Container>
  );
}
