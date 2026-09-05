const MS_DAY = 86_400_000;

export function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}

export function formatDate(s: string): string {
  return s.replaceAll("-", ".");
}

export function formatRange(a: string, b: string): string {
  return `${formatDate(a)} ~ ${formatDate(b)}`;
}

/** 마감일까지 남은 일수. 마감 당일 0, 지났으면 음수 */
export function daysLeft(end: string, today = startOfToday()): number {
  return Math.round((toDate(end).getTime() - today.getTime()) / MS_DAY);
}

export function daysUntilStart(start: string, today = startOfToday()): number {
  return Math.round((toDate(start).getTime() - today.getTime()) / MS_DAY);
}

export function monthsBetween(from: string, to = startOfToday()): number {
  const f = toDate(from);
  let months = (to.getFullYear() - f.getFullYear()) * 12 + (to.getMonth() - f.getMonth());
  if (to.getDate() < f.getDate()) months -= 1;
  return Math.max(0, months);
}

export function yearsBetween(from: string, to = startOfToday()): number {
  return Math.floor(monthsBetween(from, to) / 12);
}

/** 만원 단위 숫자를 "3억 3,700만 원" 형식으로 */
export function formatManwon(manwon: number): string {
  if (manwon === 0) return "0원";
  const eok = Math.floor(manwon / 10_000);
  const rest = manwon % 10_000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (rest > 0) parts.push(`${rest.toLocaleString("ko-KR")}만`);
  return `${parts.join(" ")} 원`;
}

export function formatWon(won: number): string {
  return `${Math.round(won).toLocaleString("ko-KR")}원`;
}

export function formatMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월`;
  if (m === 0) return `${y}년`;
  return `${y}년 ${m}개월`;
}

export function relativeTime(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return formatDate(iso.slice(0, 10));
}
