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

/**
 * 마감까지 남은 일수를 배지로. 검수 순서를 정하는 유일한 실질 기준이라 가장 눈에 띄게 둔다.
 * (확신도는 접수중 공고가 전부 high라 정렬·구분에 쓸 수 없었다)
 */
function deadlineChip(daysLeft: number): { label: string; tone: "danger" | "warn" | "muted" | "info" } {
  if (daysLeft < 0) return { label: `마감 ${-daysLeft}일 지남`, tone: "muted" };
  if (daysLeft === 0) return { label: "오늘 마감", tone: "danger" };
  if (daysLeft <= 3) return { label: `D-${daysLeft}`, tone: "danger" };
  if (daysLeft <= 7) return { label: `D-${daysLeft}`, tone: "warn" };
  return { label: `D-${daysLeft}`, tone: "info" };
}

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
  const failed = queue.filter((q) => q.aiDraftStatus === "failed" && q.daysLeft >= 0);
  const rest = queue.filter((q) => q.aiDraftStatus !== "failed");

  // 마감된 공고는 검수해도 사용자가 볼 수 없다. 큐에서 내리고 레거시로 접어둔다 —
  // 지우지는 않는다(과거 공고는 경쟁률·추천 근거로 쓸 자산이고, 내용 확인도 가능해야 한다).
  const live = rest.filter((q) => q.daysLeft >= 0);
  const legacy = rest.filter((q) => q.daysLeft < 0);

  // 지역·기관이 비어 있으면 조건 판정은 되더라도 지역 필터·추천에서 빠진다.
  // 조건은 살리되(자동 승인 유지) 여기에 따로 모아 관리자가 채워 넣게 한다.
  const needsMapping = live.filter((q) => q.regionMissing || q.agencyUnknown);
  const pending = live.filter((q) => q.aiDraftStatus === "extracted").length;
  const approved = live.filter((q) => q.aiDraftStatus === "approved").length;
  const urgent = live.filter((q) => q.aiDraftStatus === "extracted" && q.daysLeft <= 7).length;

  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title="AI 조건 추출 검수"
        lead={`접수 중인 공고 기준 · 검수 대기 ${pending}건${urgent > 0 ? ` (7일 내 마감 ${urgent}건)` : ""} · 반영 완료 ${approved}건${failed.length > 0 ? ` · 추출 실패 ${failed.length}건` : ""}`}
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

      {needsMapping.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-ink">지역·기관 확인 필요 {needsMapping.length}건</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            자격요건은 정상이라 판정에는 쓰이지만, 지역이나 기관이 비어 있어 <strong>지역 필터와 추천에서 빠져요.</strong>{" "}
            공고 원문을 보고 채워 주세요.
          </p>
          <div className="mt-3 space-y-2">
            {needsMapping.map((q) => (
              <Card key={`map-${q.id}`} className="border-warn/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {q.regionMissing && <Chip size="sm" tone="warn">지역 없음</Chip>}
                      {q.agencyUnknown && <Chip size="sm" tone="warn">기관 미분류</Chip>}
                      <h3 className="font-semibold text-ink">{q.title}</h3>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-3">{q.district || "주소 정보 없음"}</p>
                  </div>
                  <Link
                    href={`/admin/announcements/new?id=${q.id}`}
                    className="inline-flex h-9 shrink-0 items-center rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-deep"
                  >
                    채워 넣기
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-bold text-ink">접수 중 {live.length}건</h2>
        <p className="mb-3 text-[13px] text-ink-2">마감이 가까운 순서예요. 위에서부터 처리하면 돼요.</p>
        <div className="space-y-3">
          {live.length === 0 && (
            <Card>
              <p className="text-ink-2">접수 중인 공고 중 검수할 초안이 없어요.</p>
            </Card>
          )}
          {live.map((q) => {
            const status = STATUS_LABEL[q.aiDraftStatus] ?? STATUS_LABEL.extracted;
            const confidence = q.aiDraftConfidence ? CONFIDENCE_LABEL[q.aiDraftConfidence] : null;
            const dday = deadlineChip(q.daysLeft);
            return (
              <Card key={q.id} padded={false}>
                <Link href={`/admin/ai-drafts/${q.id}`} className="block p-4 hover:bg-surface-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" tone={dday.tone}>{dday.label}</Chip>
                    <Chip size="sm" tone={status.tone}>{status.label}</Chip>
                    {confidence && <Chip size="sm" tone={confidence.tone}>{confidence.label}</Chip>}
                    <h3 className="font-semibold text-ink">{q.title}</h3>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-3">접수 마감 {q.applyEnd}</p>
                  {q.aiDraftNotes && <p className="mt-2 text-[13px] text-ink-3 line-clamp-2">{q.aiDraftNotes}</p>}
                </Link>
              </Card>
            );
          })}
        </div>
      </section>

      {legacy.length > 0 && (
        <section className="mt-10">
          <details>
            <summary className="cursor-pointer text-[15px] font-bold text-ink-2 hover:text-ink">
              마감된 공고 {legacy.length}건 (레거시 · 사용자에게 보이지 않음)
            </summary>
            <p className="mt-2 text-[13px] text-ink-3">
              접수가 끝나 사용자 목록에서는 빠진 공고예요. 지우지 않고 보관합니다 — 내용 확인은 가능해요.
            </p>
            <div className="mt-3 space-y-2">
              {legacy.map((q) => (
                <Card key={q.id} padded={false} className="opacity-70">
                  <Link href={`/admin/ai-drafts/${q.id}`} className="block p-3 hover:bg-surface-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" tone="muted">{deadlineChip(q.daysLeft).label}</Chip>
                      <h3 className="text-[14px] font-semibold text-ink-2">{q.title}</h3>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          </details>
        </section>
      )}
    </Container>
  );
}
