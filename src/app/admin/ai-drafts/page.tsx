import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
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

/** 원인을 사람 말로. 관리자가 "다시 돌리면 되는지 / 손으로 넣어야 하는지" 바로 알 수 있게 */
function failureReason(error: string | null): { label: string; retryable: boolean } {
  const e = error ?? "";
  if (e.includes("PDF를 찾지 못")) {
    return { label: "공고 페이지에 PDF 첨부가 없어요. 원문을 보고 직접 입력해야 해요.", retryable: false };
  }
  if (e.includes("503") || e.includes("UNAVAILABLE")) {
    return { label: "Gemini 일시 장애예요. 다시 추출하면 대개 성공해요.", retryable: true };
  }
  if (e.includes("429") || e.includes("RESOURCE_EXHAUSTED")) {
    return { label: "Gemini 하루 한도를 다 썼어요. 내일 다시 추출하면 돼요.", retryable: true };
  }
  return { label: e.slice(0, 120) || "알 수 없는 오류", retryable: true };
}

export default async function AiDraftsQueuePage() {
  const queue = await getAiDraftQueue();
  const failed = queue.filter((q) => q.aiDraftStatus === "failed");
  const rest = queue.filter((q) => q.aiDraftStatus !== "failed");
  const pending = rest.filter((q) => q.aiDraftStatus === "extracted").length;
  const approved = rest.filter((q) => q.aiDraftStatus === "approved").length;

  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title="AI 조건 추출 검수"
        lead={`검수 대기 ${pending}건 · 반영 완료 ${approved}건${failed.length > 0 ? ` · 추출 실패 ${failed.length}건` : ""}`}
      />

      <p className="mt-4 text-[13px] text-ink-3">
        새 공고에 초안을 추가하려면 터미널에서{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5">npm run extract:conditions</code> 를 실행하세요.
      </p>

      {failed.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-ink">불러오기 실패 {failed.length}건</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            자동 추출이 안 된 공고예요. 원문을 열어 확인하고 조건을 직접 입력해 주세요.
          </p>
          <div className="mt-3 space-y-2">
            {failed.map((q) => {
              const reason = failureReason(q.aiDraftError);
              return (
                <Card key={q.id} className="border-danger/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink">{q.title}</h3>
                      <p className="mt-1 text-[13px] text-ink-2">{reason.label}</p>
                      <p className="mt-1 text-[12px] text-ink-3">{q.id}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <a
                        href={q.originalUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2"
                      >
                        원문 열기 <ExternalLink size={14} />
                      </a>
                      <Link
                        href={`/admin/announcements/new?id=${q.id}`}
                        className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-deep"
                      >
                        직접 입력
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        {failed.length > 0 && <h2 className="mb-3 text-lg font-bold text-ink">검수 대기 · 완료</h2>}
        <div className="space-y-3">
          {rest.length === 0 && (
            <Card>
              <p className="text-ink-2">아직 추출된 초안이 없어요.</p>
            </Card>
          )}
          {rest.map((q) => {
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
                  {q.aiDraftNotes && <p className="mt-2 text-[13px] text-ink-3 line-clamp-2">{q.aiDraftNotes}</p>}
                </Link>
              </Card>
            );
          })}
        </div>
      </section>
    </Container>
  );
}
