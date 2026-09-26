"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { UpdateStatus } from "@/lib/data/update-runner";
import { relativeTime } from "@/lib/format";
import { Button, Card, Chip, cx } from "./ui";

const RUN_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "info" | "danger" }> = {
  running: { label: "진행 중", tone: "info" },
  ok: { label: "성공", tone: "ok" },
  partial: { label: "일부만", tone: "warn" },
  failed: { label: "실패", tone: "danger" },
};

const MODE_LABEL = {
  github: "GitHub Actions에서 실행해요",
  local: "이 PC에서 실행해요",
  unavailable: "이 서버에서는 실행할 수 없어요",
} as const;

/** 실행 직후에는 GitHub에 새 실행이 뜨기까지 몇 초 걸려서, 이 시간 동안은 멈춰 있어도 계속 확인한다 */
const WATCH_AFTER_TRIGGER_MS = 60_000;

/**
 * 관리자 공고 목록 위의 "공고 업데이트" 패널. 자동 갱신(매일 두 번)을 기다리지 않고 지금 바로 돌린다.
 * 돌고 있는 동안은 5초마다 상태를 다시 읽는다.
 */
export function AdminUpdatePanel() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [justTriggered, setJustTriggered] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/update", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? `상태를 못 읽었어요(${res.status})`);
      setStatus(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // 첫 상태는 화면이 뜬 뒤 한 번 읽는다(외부 API 구독과 같은 성격이라 effect에서 한다)
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const watching = !!status?.running || justTriggered;
  useEffect(() => {
    if (!watching) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [watching, load]);

  useEffect(() => {
    if (!justTriggered) return;
    const id = setTimeout(() => setJustTriggered(false), WATCH_AFTER_TRIGGER_MS);
    return () => clearTimeout(id);
  }, [justTriggered]);

  const trigger = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/update", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setMessage({ ok: !!body.ok, text: body.message ?? body.error ?? "알 수 없는 응답이에요." });
      if (body.ok) setJustTriggered(true);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const last = status?.runs[0];
  const d = status?.drafts;

  return (
    <Card className="mt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">공고 업데이트</h2>
          <p className="mt-1 text-sm text-ink-2">
            매일 오전·오후 두 번 자동으로 수집 → 조건 추출 → 자동 승인을 돌려요. 기다리지 않고 지금 돌릴 수도 있어요.
          </p>
          {status && <p className="mt-1 text-[13px] text-ink-3">{MODE_LABEL[status.mode]}</p>}
        </div>
        <Button onClick={trigger} disabled={busy || !status || status.running || status.mode === "unavailable"} className="shrink-0">
          <RefreshCw size={16} className={cx(status?.running && "animate-spin")} />
          {status?.running ? "업데이트 중…" : "지금 업데이트"}
        </Button>
      </div>

      {message && (
        <p className={cx("mt-3 rounded-md px-3 py-2 text-sm", message.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>
          {message.text}
        </p>
      )}
      {error && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {status && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[13px] font-semibold text-ink-3">마지막 수집</p>
            {last ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] text-ink">
                <Chip size="sm" tone={RUN_STATUS[last.status]?.tone ?? "info"}>
                  {RUN_STATUS[last.status]?.label ?? last.status}
                </Chip>
                <span>{relativeTime(last.started_at)}</span>
                {last.status !== "running" && last.status !== "failed" && (
                  <span className="text-ink-2 tnum">
                    새 공고 {last.inserted ?? 0}건 · 바뀐 공고 {last.updated ?? 0}건 · 마감 {last.closed ?? 0}건
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-[15px] text-ink-3">기록이 없어요</p>
            )}
            {status.lastWorkflow && (
              <a
                href={status.lastWorkflow.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
              >
                GitHub 실행 기록 ({status.lastWorkflow.conclusion ?? status.lastWorkflow.status}) <ExternalLink size={13} />
              </a>
            )}
          </div>
          {d && (
            <div>
              <p className="text-[13px] font-semibold text-ink-3">접수 중인 공고의 조건 정리</p>
              <dl className="mt-1 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "자동 반영", value: d.approved, cls: "text-ok" },
                  { label: "추출 대기", value: d.waiting, cls: "text-info" },
                  { label: "사람 확인", value: d.needsReview, cls: "text-warn" },
                  { label: "PDF 없음 등", value: d.failed, cls: "text-ink-3" },
                ].map((x) => (
                  <div key={x.label} className="rounded-md bg-surface-2 px-1 py-2">
                    <dd className={cx("text-lg font-extrabold tnum", x.cls)}>{x.value}</dd>
                    <dt className="text-[12px] text-ink-3">{x.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}

      {status?.logTail && (
        <details className="mt-4 rounded-md border border-line bg-surface-2 text-sm" open={status.running}>
          <summary className="cursor-pointer px-3 py-2 font-semibold text-ink-2">최근 실행 로그</summary>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all px-3 pb-3 text-[12px] leading-relaxed text-ink-2">
            {status.logTail}
          </pre>
        </details>
      )}
    </Card>
  );
}
