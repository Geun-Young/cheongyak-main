"use client";

import { useMemo, useState } from "react";
import type { Announcement } from "@/lib/types";
import { DEMO_PROFILE, deriveFacts, useProfile } from "@/lib/profile";
import { countByStatus, matchAll } from "@/lib/matching";
import { AnnouncementList, isUrgent, type ListTab } from "./AnnouncementList";
import { SummaryTiles, type SummaryKey } from "./SummaryTiles";
import { ButtonLink, Container } from "./ui";

export function DashboardView({ items }: { items: Announcement[] }) {
  const { profile, isLoggedIn } = useProfile();
  const p = profile ?? DEMO_PROFILE;
  const [tab, setTab] = useState<ListTab>("all");

  const { results, counts } = useMemo(() => {
    const facts = deriveFacts(p);
    const results = matchAll(items, facts);
    const base = countByStatus(results.values());
    const urgent = items.filter((a) => isUrgent(a, results.get(a.id))).length;
    return { results, counts: { ...base, urgent } as Record<SummaryKey, number> };
  }, [p, items]);

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

      <div className="mt-6">
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
