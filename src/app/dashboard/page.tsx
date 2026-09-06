import type { Metadata } from "next";
import { DashboardView } from "@/components/DashboardView";
import { getAnnouncements, getLastSuccessfulIngestAt } from "@/lib/data/announcements";

export const metadata: Metadata = { title: "홈" };

export default async function DashboardPage() {
  const [items, lastSyncedAt] = await Promise.all([getAnnouncements(), getLastSuccessfulIngestAt()]);
  return <DashboardView items={items} lastSyncedAt={lastSyncedAt} />;
}
