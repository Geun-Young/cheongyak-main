import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAiDraftDetail } from "@/lib/data/ai-drafts";
import { getAnnouncementByIdForAdmin } from "@/lib/data/announcements";
import { Container, PageTitle } from "@/components/ui";
import { AiDraftReview } from "@/components/AiDraftReview";

export async function generateMetadata(props: PageProps<"/admin/ai-drafts/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const detail = await getAiDraftDetail(id);
  return { title: detail ? `검수: ${detail.title}` : "초안을 찾을 수 없어요" };
}

export default async function AiDraftDetailPage(props: PageProps<"/admin/ai-drafts/[id]">) {
  const { id } = await props.params;
  const [detail, announcement] = await Promise.all([getAiDraftDetail(id), getAnnouncementByIdForAdmin(id)]);
  if (!detail || !announcement) notFound();

  return (
    <Container className="py-6 md:py-10">
      <PageTitle title="AI 초안 검수" lead={detail.title} />
      <div className="mt-6">
        <AiDraftReview detail={detail} announcement={announcement} />
      </div>
    </Container>
  );
}
