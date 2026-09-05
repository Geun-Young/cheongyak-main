"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useFavorites, useProfile, deriveFacts } from "@/lib/profile";
import { ANNOUNCEMENTS } from "@/lib/mock/announcements";
import { matchAnnouncement } from "@/lib/matching";
import { bracketLabel } from "@/lib/income";
import { formatManwon } from "@/lib/format";
import { AnnouncementRow } from "@/components/AnnouncementRow";
import { Button, ButtonLink, Card, Chip, Container, Empty, PageTitle, SegmentedControl, Toggle } from "@/components/ui";

export default function MyPage() {
  const router = useRouter();
  const { profile, patch, logout } = useProfile();
  const fav = useFavorites();

  if (!profile) {
    return (
      <Container className="py-10">
        <Card>
          <Empty
            title="로그인이 필요해요"
            body="로그인하면 저장된 조건과 관심 공고를 볼 수 있어요."
            action={
              <div className="flex gap-2">
                <ButtonLink href="/login">로그인</ButtonLink>
                <ButtonLink href="/signup" variant="secondary">가입하기</ButtonLink>
              </div>
            }
          />
        </Card>
      </Container>
    );
  }

  const p = profile;
  const facts = deriveFacts(p);
  const favorites = ANNOUNCEMENTS.filter((a) => fav.has(a.id));

  const rows: { step: string; label: string; value: string }[] = [
    { step: "basic", label: "기본 정보", value: `${p.name || "이름 미입력"} · ${p.birthDate || "생년월일 미입력"} · ${p.residenceRegion} 거주` },
    { step: "household", label: "세대 구성", value: `${p.maritalStatus === "single" ? "미혼" : p.maritalStatus === "married" ? "기혼" : "예비 신혼부부"} · ${p.householdSize}인 가구 · 자녀 ${p.numChildren}명` },
    { step: "housing", label: "주택 소유", value: p.housingStatus === "none" ? "무주택" : "유주택" },
    { step: "income", label: "소득 구간", value: bracketLabel(p.incomeBracket) },
    { step: "assets", label: "자산", value: `총자산 ${formatManwon(p.totalAssets)} · 자동차 ${formatManwon(p.carValue)}` },
    { step: "account", label: "청약통장", value: p.hasSubscription ? `${p.subscriptionType ?? "주택청약종합저축"} · ${p.paymentCount}회 납입` : "없음" },
  ];

  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title="마이페이지"
        lead={p.onboardingDone ? "정보를 바꾸면 모든 공고의 판정이 바로 다시 계산돼요." : "정보 입력이 아직 끝나지 않았어요."}
        action={!p.onboardingDone ? <ButtonLink href="/onboarding">이어서 입력하기</ButtonLink> : undefined}
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card padded={false}>
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-bold text-ink">내 정보</h2>
              <Chip size="sm" tone={p.incomeConfidence === "certain" ? "ok" : "warn"}>
                소득 {p.incomeConfidence === "certain" ? "확실" : "추정"}
              </Chip>
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {rows.map((r) => (
                <li key={r.step}>
                  <Link href={`/onboarding?step=${r.step}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2">
                    <span className="w-20 shrink-0 text-sm font-semibold text-ink-3">{r.label}</span>
                    <span className="flex-1 text-[15px] text-ink">{r.value}</span>
                    <ChevronRight size={18} className="text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card padded={false}>
            <div className="px-5 py-4">
              <h2 className="text-lg font-bold text-ink">관심 공고</h2>
              <p className="text-sm text-ink-3">공고 상세에서 하트를 누르면 여기에 모여요.</p>
            </div>
            {favorites.length === 0 ? (
              <div className="border-t border-line">
                <Empty title="아직 저장한 공고가 없어요" action={<ButtonLink href="/announcements" variant="secondary">공고 찾기</ButtonLink>} />
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {favorites.map((a) => (
                  <li key={a.id}>
                    <AnnouncementRow a={a} result={matchAnnouncement(a, facts)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-bold text-ink">알림 설정</h2>
            <div className="mt-1 divide-y divide-line">
              <Toggle
                label="마감 알림"
                description="신청 가능한 공고가 마감 3일 전·1일 전이면 보내요."
                checked={p.notifications.deadline}
                onChange={(v) => patch({ notifications: { ...p.notifications, deadline: v } })}
              />
              <Toggle
                label="새 공고 알림"
                description="내 조건에 맞는 공고가 올라오면 바로 보내요."
                checked={p.notifications.newMatch}
                onChange={(v) => patch({ notifications: { ...p.notifications, newMatch: v } })}
              />
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-sm font-semibold text-ink-2">받는 방법</p>
              <SegmentedControl
                name="알림 채널"
                value={p.notifications.channel}
                onChange={(v) => patch({ notifications: { ...p.notifications, channel: v } })}
                options={[
                  { value: "push", label: "웹 푸시" },
                  { value: "kakao", label: "카카오 알림톡" },
                ]}
              />
              {p.notifications.channel === "kakao" && (
                <p className="mt-2 text-[13px] text-warn">카카오 알림톡은 준비 중이에요. 그전까지는 웹 푸시로 보내드려요.</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-ink">계정</h2>
            <p className="mt-1 text-sm text-ink-3">로그아웃하면 이 브라우저에 저장된 조건이 지워져요.</p>
            <Button
              variant="danger"
              className="mt-3 w-full"
              onClick={() => {
                logout();
                router.push("/");
              }}
            >
              로그아웃
            </Button>
          </Card>
        </div>
      </div>
    </Container>
  );
}
