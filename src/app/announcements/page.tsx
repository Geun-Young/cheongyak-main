import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnouncementsView } from "@/components/AnnouncementsView";
import { getAnnouncements } from "@/lib/data/announcements";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "공고 찾기" };

export default async function AnnouncementsPage() {
  const items = await getAnnouncements();
  return (
    <Suspense fallback={<Container className="py-10 text-ink-3">공고를 불러오는 중이에요.</Container>}>
      <AnnouncementsView items={items} />
    </Suspense>
  );
}
