"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Search, User } from "lucide-react";
import { cx } from "./ui";

const TABS = [
  { href: "/dashboard", label: "홈", Icon: Home },
  { href: "/announcements", label: "공고", Icon: Search },
  { href: "/notifications", label: "알림", Icon: Bell },
  { href: "/me", label: "마이", Icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      aria-label="하단 메뉴"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                  active ? "text-brand" : "text-ink-3",
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
