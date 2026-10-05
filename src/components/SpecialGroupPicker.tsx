"use client";

import { Lock } from "lucide-react";
import { SPECIAL_GROUPS } from "@/lib/special-groups";
import { useSpecialGroups } from "@/lib/special-groups-store";
import { cx } from "./ui";

/**
 * 수급자·장애인 등 대상 계층 체크(선택). 정보 입력(세대 구성)과 공고 상세(순위·경로가 이걸로 갈릴 때) 두 곳에서 쓴다 —
 * 같은 기기 저장소를 쓰므로 어디서 체크해도 같다. 서버로 보내지 않는다(special-groups.ts).
 */
export function SpecialGroupPicker({ title = "해당하는 게 있으면 체크해 주세요 (선택)" }: { title?: string }) {
  const [groups, setGroups] = useSpecialGroups();
  const selected = groups ?? [];
  const toggle = (key: (typeof SPECIAL_GROUPS)[number]["key"]) =>
    setGroups(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink-2">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {SPECIAL_GROUPS.map((g) => {
          const on = selected.includes(g.key);
          return (
            <label
              key={g.key}
              title={g.hint}
              className={cx(
                "flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
                on ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-ink-2 hover:border-brand",
              )}
            >
              <input type="checkbox" checked={on} onChange={() => toggle(g.key)} className="size-4 accent-brand" />
              {g.label}
            </label>
          );
        })}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-ink-3">
        <Lock size={13} className="mt-px shrink-0" />
        이 항목은 서버로 보내지 않아요. 이 기기에만 저장해 공고를 거르는 데만 써요.
      </p>
    </fieldset>
  );
}
