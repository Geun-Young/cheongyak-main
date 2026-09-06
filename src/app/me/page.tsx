import type { Metadata } from "next";
import { MyPageView } from "@/components/MyPageView";
import { getAnnouncements } from "@/lib/data/announcements";

export const metadata: Metadata = { title: "마이페이지" };

export default async function MyPage() {
  const items = await getAnnouncements();
  return <MyPageView items={items} />;
}
