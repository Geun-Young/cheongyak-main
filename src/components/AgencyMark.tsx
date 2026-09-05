import type { AgencyCode } from "@/lib/types";
import { AGENCY_STYLE } from "@/lib/mock/announcements";
import { cx } from "./ui";

/** 기관 로고 대신 쓰는 모노그램 타일. 상표 사용 이슈를 피하고 어떤 크기에서도 읽힌다. */
export function AgencyMark({ code, size = "md", className }: { code: AgencyCode; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = AGENCY_STYLE[code];
  const dim = size === "sm" ? "size-9 text-[12px]" : size === "lg" ? "size-16 text-[20px]" : "size-12 text-[15px]";
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-lg font-extrabold tracking-tight", dim, className)}
      style={{ background: s.bg, color: s.fg }}
      aria-hidden
    >
      {s.mark}
    </span>
  );
}
