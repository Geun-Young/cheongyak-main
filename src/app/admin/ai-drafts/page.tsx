import type { Metadata } from "next";
import Link from "next/link";
import { getAiDraftQueue } from "@/lib/data/ai-drafts";
import { Card, Chip, Container, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "AI 조건 추출 검수" };

const CONFIDENCE_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" }> = {
  high: { label: "확신 높음", tone: "ok" },
  medium: { label: "확신 보통", tone: "warn" },
  low: { label: "확신 낮음", tone: "danger" },
};

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "info" | "danger" }> = {
  extracted: { label: "검수 대기", tone: "info" },
  approved: { label: "반영 완료", tone: "ok" },
  failed: { label: "추출 실패", tone: "danger" },
};

export default async function AiDraftsQueuePage() {
  const queue = await getAiDraftQueue();
  const pending = queue.filter((q) => q.aiDraftStatus === "extracted").length;

  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title="AI 조건 추출 검수"
        lead={`총 ${queue.length}건 · 검수 대기 ${pending}건. PDF에서 Gemini가 뽑은 초안을 확인하고 실제 유닛에 반영하세요.`}
      />

      <p className="mt-4 text-[13px] text-ink-3">
        새 공고에 초안을 추가하려면 터미널에서 <code className="rounded bg-surface-2 px-1.5 py-0.5">npm run extract:conditions</code> 를 실행하세요.
      </p>

      <div className="mt-6 space-y-3">
        {queue.length === 0 && (
          <Card>
            <p className="text-ink-2">아직 추출된 초안이 없어요.</p>
          </Card>
        )}
        {queue.map((q) => {
          const status = STATUS_LABEL[q.aiDraftStatus] ?? STATUS_LABEL.extracted;
          const confidence = q.aiDraftConfidence ? CONFIDENCE_LABEL[q.aiDraftConfidence] : null;
          return (
            <Card key={q.id} padded={false}>
              <Link href={`/admin/ai-drafts/${q.id}`} className="block p-4 hover:bg-surface-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" tone={status.tone}>{status.label}</Chip>
                  {confidence && <Chip size="sm" tone={confidence.tone}>{confidence.label}</Chip>}
                  <h3 className="font-semibold text-ink">{q.title}</h3>
                </div>
                {q.aiDraftNotes && (
                  <p className="mt-2 text-[13px] text-ink-3 line-clamp-2">{q.aiDraftNotes}</p>
                )}
                {q.aiDraftError && (
                  <p className="mt-2 text-[13px] text-danger">오류: {q.aiDraftError}</p>
                )}
              </Link>
            </Card>
          );
        })}
      </div>
    </Container>
  );
}
