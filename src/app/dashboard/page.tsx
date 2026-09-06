import type { Metadata } from "next";
import { DashboardView } from "@/components/DashboardView";
import { getAnnouncements } from "@/lib/data/announcements";

export const metadata: Metadata = { title: "홈" };

export default async function DashboardPage() {
  const items = await getAnnouncements();
  return <DashboardView items={items} />;
}
