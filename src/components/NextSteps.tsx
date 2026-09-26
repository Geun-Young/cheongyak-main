import { ExternalLink } from "lucide-react";
import type { Announcement } from "@/lib/types";
import { daysLeft, daysUntilStart } from "@/lib/format";
import { HOWTO_CAVEAT, howTo, weekendNote } from "@/lib/howto";
import { Card } from "./ui";

/**
 * 「지금 할 일」 — 판정을 본 다음 어디서, 무엇을 챙겨 신청하면 되는지.
 * 청약핏(chan-hee1102/myhome)의 NextSteps를 옮겼다. 판정은 유닛별·클라이언트에서 하지만
 * 접수처와 준비물은 공고 단위라 서버에서 그린다. 마감된 공고에는 그리지 않는다.
 */
export function NextSteps({ a }: { a: Announcement }) {
  const left = daysLeft(a.applyEnd);
  if (a.status === "closed" || left < 0) return null;

  const untilStart = daysUntilStart(a.applyStart);
  const how = howTo(a);
  const warns = [
    weekendNote(a, how),
    untilStart <= 0 && left === 0 ? "오늘이 마지막 날이에요. 마감 시각은 접수처마다 달라서 공고문에서 꼭 확인하세요." : undefined,
  ].filter((w): w is string => !!w);

  const when =
    untilStart > 0
      ? `${untilStart === 1 ? "내일" : `${untilStart}일 뒤`} ${how.where} 접수가 시작돼요`
      : left === 0
        ? `오늘 ${how.where} 접수가 마감돼요`
        : `${left === 1 ? "내일까지" : `${left}일 안에`} ${how.where}에서 신청하세요`;

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: when,
      body: (
        <>
          {how.method}
          {warns.map((w) => (
            <span key={w} className="mt-1.5 block font-semibold text-danger">
              {w}
            </span>
          ))}
          <a
            href={how.url ?? a.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-[15px] font-semibold text-ink hover:bg-surface-2"
          >
            {how.url ? `${how.where} 열기` : "공고문에서 접수처 확인"}
            <ExternalLink size={15} />
          </a>
        </>
      ),
    },
    {
      title: "챙길 것",
      body: (
        <>
          {how.bring.map((b) => (
            <span key={b} className="block">
              {b}
            </span>
          ))}
          {how.certHelp && <span className="block">{how.certHelp}</span>}
          <span className="mt-1 block text-ink-3">{HOWTO_CAVEAT}</span>
        </>
      ),
    },
  ];

  return (
    <Card>
      <h2 className="text-lg font-bold text-ink">지금 할 일</h2>
      <ol className="mt-2 divide-y divide-line">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 py-4 last:pb-0">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand tnum">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
