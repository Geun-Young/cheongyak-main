import { redirect } from "next/navigation";

/**
 * 알림 기능은 지금 범위가 아니다(project.md 38번) — 서비스는 "로그인하면 여러 공고를 한 번에 보고 내 순위를 아는 웹".
 * 예전 링크로 들어오면 홈(대시보드)으로 보낸다.
 */
export default function NotificationsPage() {
  redirect("/dashboard");
}
