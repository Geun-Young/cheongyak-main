"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useProfile } from "@/lib/profile";
import { NOTIFICATIONS } from "@/lib/mock/notifications";
import { ButtonLink, cx } from "./ui";

const NAV = [
  { href: "/dashboard", label: "홈" },
  { href: "/announcements", label: "공고 찾기" },
  { href: "/me", label: "마이페이지" },
  { href: "/notifications", label: "알림" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="청약순위계산기 홈">
      <span className="grid size-9 place-items-center overflow-hidden rounded-md">
        <Image src="/logo3.png" alt="" width={36} height={36} className="size-9 object-contain" priority />
      </span>
      <span className="text-[19px] font-bold tracking-tight text-ink">청약순위계산기</span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const { profile, isLoggedIn } = useProfile();
  const unread = isLoggedIn ? NOTIFICATIONS.filter((n) => !n.read).length : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Logo />

        <nav className="hidden md:flex items-stretch gap-1 self-stretch" aria-label="주요 메뉴">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex items-center px-3.5 text-[15px] font-semibold transition-colors",
                  active ? "text-brand" : "text-ink-2 hover:text-ink",
                )}
              >
                {item.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {isLoggedIn && profile ? (
            <>
              <Link
                href="/notifications"
                className="relative grid size-10 place-items-center rounded-md text-ink-2 hover:bg-brand-soft hover:text-brand"
                aria-label={unread > 0 ? `알림 ${unread}개` : "알림"}
              >
                <Bell size={20} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white tnum">
                    {unread}
                  </span>
                )}
              </Link>
              <Link href="/me" className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-brand-soft">
                <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                  {profile.name ? profile.name.slice(0, 1) : "나"}
                </span>
                <span className="hidden text-[15px] font-semibold text-ink sm:inline">
                  {profile.name ? `${profile.name}님` : "내 정보"}
                </span>
              </Link>
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                로그인
              </ButtonLink>
              <ButtonLink href="/signup" size="sm">
                시작하기
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
