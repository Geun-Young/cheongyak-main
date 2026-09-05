"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ANNOUNCEMENTS } from "@/lib/mock/announcements";
import { deriveFacts, profileFromQuery, useProfile } from "@/lib/profile";
import { saveGuestProfile, useGuestProfile } from "@/lib/guest";
import { matchAll } from "@/lib/matching";
import { bracketLabel } from "@/lib/income";
import { AnnouncementList, type ListTab } from "./AnnouncementList";
import { QuickFilter } from "./QuickFilter";
import { ButtonLink, Card, Container, PageTitle } from "./ui";

export function AnnouncementsView() {
  const params = useSearchParams();
  const { profile } = useProfile();
  const storedGuest = useGuestProfile();
  const [tab, setTab] = useState<ListTab>("all");

  const queryString = params.toString();
  const fromQuery = useMemo(() => profileFromQuery(new URLSearchParams(queryString)), [queryString]);

  useEffect(() => {
    if (fromQuery) saveGuestProfile(fromQuery);
  }, [fromQuery]);

  const p = profile ?? fromQuery ?? storedGuest;
  const results = useMemo(() => (p ? matchAll(ANNOUNCEMENTS, deriveFacts(p)) : undefined), [p]);
  const isGuest = !profile && Boolean(p);

  const region = params.get("region") ?? "";

  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title="공고 찾기"
        lead={
          p
            ? isGuest
              ? `임시 조건(${p.residenceRegion} · ${new Date().getFullYear() - Number(p.birthDate.slice(0, 4))}세 · 소득 ${bracketLabel(p.incomeBracket)}) 기준으로 판정했어요.`
              : `${p.name}님 정보 기준으로 판정했어요.`
            : "지역·주택유형으로 둘러보거나, 조건을 입력해 신청 가능 여부를 확인하세요."
        }
        action={
          isGuest ? (
            <div className="flex gap-2">
              <ButtonLink href="/#quick" variant="secondary" size="sm">조건 바꾸기</ButtonLink>
              <ButtonLink href="/signup" size="sm">이 조건 저장하기</ButtonLink>
            </div>
          ) : undefined
        }
      />

      {isGuest && (
        <div className="mt-4 rounded-xl border border-brand/30 bg-brand-tint px-4 py-3 text-sm text-ink-2">
          이 조건은 저장되지 않아요. 가입하면 다음부터 자동으로 판정된 목록을 보여드리고, 마감 전에 알림을 보내드려요.
        </div>
      )}

      {!p && (
        <Card className="mt-5">
          <p className="text-lg font-bold text-ink">조건을 입력하면 공고마다 판정이 붙어요</p>
          <p className="mt-1 mb-4 text-sm text-ink-3">가입 없이 지역·나이·소득 구간만으로 계산해요.</p>
          <QuickFilter />
        </Card>
      )}

      <div className="mt-5">
        <AnnouncementList
          items={ANNOUNCEMENTS}
          results={results}
          tab={tab}
          onTabChange={setTab}
          initialRegion={region}
        />
      </div>
    </Container>
  );
}
