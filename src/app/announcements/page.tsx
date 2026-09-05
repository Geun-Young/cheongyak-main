import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnouncementsView } from "@/components/AnnouncementsView";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "공고 찾기" };

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<Container className="py-10 text-ink-3">공고를 불러오는 중이에요.</Container>}>
      <AnnouncementsView />
    </Suspense>
  );
}
