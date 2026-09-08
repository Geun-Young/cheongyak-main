"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Announcement } from "@/lib/types";
import type { AiDraftDetail } from "@/lib/data/ai-drafts";
import { Button, ButtonLink, Card, Chip, Select, cx } from "./ui";

const CONFIDENCE_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" }> = {
  high: { label: "확신 높음", tone: "ok" },
  medium: { label: "확신 보통", tone: "warn" },
  low: { label: "확신 낮음", tone: "danger" },
};

function DraftUnitCard({
  announcementId,
  draftUnit,
  draftIndex,
  supplyUnits,
}: {
  announcementId: string;
  draftUnit: AiDraftDetail["aiDraft"] extends null ? never : NonNullable<AiDraftDetail["aiDraft"]>["unitsFound"][number];
  draftIndex: number;
  supplyUnits: { id: string; name: string }[];
}) {
  const [targetUnitId, setTargetUnitId] = useState(supplyUnits[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  return (
    <Card>
      <h3 className="text-base font-bold text-ink">{draftUnit.name}</h3>

      {draftUnit.eligibility.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] font-semibold text-ink-3">자격 요건</p>
          <ul className="mt-1.5 space-y-1">
            {draftUnit.eligibility.map((c, i) => (
              <li key={i} className="text-[14px] text-ink">
                · {c.label}
                {c.help && <span className="block pl-3 text-[12px] text-ink-3">{c.help}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {draftUnit.tiers.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] font-semibold text-ink-3">순위</p>
          <ul className="mt-1.5 space-y-1">
            {draftUnit.tiers.map((t, i) => (
              <li key={i} className="text-[14px] text-ink">
                {t.rank}순위 — {t.label}
                <ul className="pl-3 text-[13px] text-ink-3">
                  {t.conditions.map((c, j) => (
                    <li key={j}>· {c.label}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {draftUnit.scoreRules.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] font-semibold text-ink-3">가점표</p>
          <div className="mt-1.5 space-y-2">
            {draftUnit.scoreRules.map((r, i) => (
              <div key={i}>
                <p className="text-[14px] font-semibold text-ink">{r.label}</p>
                <table className="mt-1 w-full text-[13px]">
                  <tbody className="divide-y divide-line">
                    {r.bands.map((b, j) => (
                      <tr key={j}>
                        <td className="py-1 pr-2 text-ink-2">{b.note}</td>
                        <td className="py-1 text-right font-semibold tnum">{b.points}점</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Select
          value={targetUnitId}
          onChange={(e) => setTargetUnitId(e.target.value)}
          className="h-10 w-auto text-sm"
          aria-label="반영할 유닛"
        >
          {supplyUnits.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </Select>
        <Button
          size="sm"
          disabled={!targetUnitId || state === "loading"}
          onClick={async () => {
            setState("loading");
            try {
              const res = await fetch(`/api/admin/ai-drafts/${announcementId}/approve-unit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ supplyUnitId: targetUnitId, draftUnitIndex: draftIndex }),
              });
              setState(res.ok ? "done" : "error");
            } catch {
              setState("error");
            }
          }}
        >
          이 유닛에 반영
        </Button>
        {state === "done" && <span className="text-sm font-semibold text-ok">반영됐어요</span>}
        {state === "error" && <span className="text-sm font-semibold text-danger">반영 실패, 다시 시도하세요</span>}
      </div>
    </Card>
  );
}

function MarkReadyButton({ announcementId, initialReady }: { announcementId: string; initialReady: boolean }) {
  const [ready, setReady] = useState(initialReady);
  const [loading, setLoading] = useState(false);

  if (ready) {
    return <Chip tone="ok">판정 가능(ready)으로 전환됨</Chip>;
  }

  return (
    <Button
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/admin/announcements/${announcementId}/mark-ready`, { method: "POST" });
          if (res.ok) setReady(true);
        } finally {
          setLoading(false);
        }
      }}
    >
      유닛 조건 확인 완료 → 판정 가능으로 전환
    </Button>
  );
}

export function AiDraftReview({ detail, announcement }: { detail: AiDraftDetail; announcement: Announcement }) {
  const confidence = detail.aiDraftConfidence ? CONFIDENCE_LABEL[detail.aiDraftConfidence] : null;

  if (detail.aiDraftStatus === "failed") {
    return (
      <Card>
        <Chip tone="danger">추출 실패</Chip>
        <p className="mt-2 text-ink-2">{detail.aiDraftError ?? "알 수 없는 오류"}</p>
      </Card>
    );
  }

  if (!detail.aiDraft) {
    return (
      <Card>
        <p className="text-ink-2">아직 초안이 없어요.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className={cx(confidence?.tone === "danger" && "border-danger/30")}>
        <div className="flex flex-wrap items-center gap-3">
          {confidence && <Chip tone={confidence.tone}>{confidence.label}</Chip>}
          <ButtonLink href={announcement.originalUrl} external variant="secondary" size="sm">
            원문 공고 상세 <ExternalLink size={14} />
          </ButtonLink>
        </div>
        {detail.aiDraftNotes && (
          <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-[14px] text-ink-2">
            <strong className="text-ink">Gemini 메모: </strong>
            {detail.aiDraftNotes}
          </p>
        )}
        <p className="mt-3 text-[13px] text-ink-3">
          실제 유닛 {detail.supplyUnitIds.length}개, 초안 유닛 {detail.aiDraft.unitsFound.length}개 —
          이름이 정확히 일치하지 않을 수 있으니 아래에서 직접 대상을 선택해서 반영하세요.
        </p>
      </Card>

      {detail.aiDraft.unitsFound.map((u, i) => (
        <DraftUnitCard
          key={i}
          announcementId={detail.id}
          draftUnit={u}
          draftIndex={i}
          supplyUnits={detail.supplyUnitIds}
        />
      ))}

      <Card className="bg-surface-2">
        <p className="text-[14px] text-ink-2">
          위 유닛들에 조건을 다 확인·반영했으면, 이 공고를 사용자에게 「판정 가능」으로 표시하세요.
        </p>
        <div className="mt-3">
          <MarkReadyButton announcementId={announcement.id} initialReady={announcement.reviewStatus === "ready"} />
        </div>
      </Card>
    </div>
  );
}
