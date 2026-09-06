"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "./ui";

/** "조건 정리되면 알려주세요" 버튼. 설계서 3장 — pending 공고에 대한 사용자 행동 유도 겸 관리자 우선순위 신호 */
export function RequestReviewButton({ announcementId }: { announcementId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  if (state === "done") {
    return (
      <Button variant="secondary" disabled>
        <Check size={16} /> 요청했어요, 정리되면 알려드릴게요
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      disabled={state === "loading"}
      onClick={async () => {
        setState("loading");
        try {
          await fetch(`/api/announcements/${announcementId}/request-review`, { method: "POST" });
          setState("done");
        } catch {
          setState("idle");
        }
      }}
    >
      <Bell size={16} /> 조건 정리되면 알려주세요
    </Button>
  );
}
