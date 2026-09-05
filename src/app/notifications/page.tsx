"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { NOTIFICATIONS } from "@/lib/mock/notifications";
import { useProfile } from "@/lib/profile";
import { relativeTime } from "@/lib/format";
import { Button, ButtonLink, Card, Chip, Container, Empty, PageTitle, cx } from "@/components/ui";

export default function NotificationsPage() {
  const { profile } = useProfile();
  const [items, setItems] = useState(NOTIFICATIONS);
  const unread = items.filter((n) => !n.read).length;

  if (!profile) {
    return (
      <Container className="py-10">
        <Card>
          <Empty
            title="알림은 로그인 후에 받을 수 있어요"
            body="신청 가능한 공고가 마감 3일 전·1일 전이면 알려드려요."
            action={<ButtonLink href="/login">로그인</ButtonLink>}
          />
        </Card>
      </Container>
    );
  }

  return (
    <Container className="max-w-3xl py-6 md:py-10">
      <PageTitle
        title="알림"
        lead={unread > 0 ? `읽지 않은 알림이 ${unread}개 있어요.` : "새 알림이 없어요."}
        action={
          unread > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setItems(items.map((n) => ({ ...n, read: true })))}>
              모두 읽음으로 표시
            </Button>
          ) : undefined
        }
      />

      <Card padded={false} className="mt-6">
        {items.length === 0 ? (
          <Empty title="아직 알림이 없어요" body="조건에 맞는 공고가 생기면 여기에 쌓여요." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/announcements/${n.announcementId}`}
                  onClick={() => setItems(items.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}
                  className={cx("flex items-start gap-3 px-4 py-4 hover:bg-surface-2 md:px-5", !n.read && "bg-brand-tint/60")}
                >
                  <span className={cx("mt-1 grid size-9 shrink-0 place-items-center rounded-lg", n.type === "deadline" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand")}>
                    <Bell size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Chip size="sm" tone={n.type === "deadline" ? "danger" : "brand"}>
                        {n.type === "deadline" ? "마감 임박" : "새 공고"}
                      </Chip>
                      <span className="text-[12px] text-ink-3">{relativeTime(n.sentAt)}</span>
                      {!n.read && <span className="size-1.5 rounded-full bg-brand" aria-label="읽지 않음" />}
                    </span>
                    <span className={cx("mt-1 block text-[15px] leading-relaxed", n.read ? "text-ink-2" : "font-semibold text-ink")}>
                      {n.message}
                    </span>
                  </span>
                  <ChevronRight size={18} className="mt-2 shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 px-1 text-[13px] text-ink-3">
        알림에는 이름과 공고명만 들어가요. 소득 구간 같은 개인 정보는 절대 넣지 않아요. 수신 설정은 마이페이지에서 바꿔요.
      </p>
    </Container>
  );
}
