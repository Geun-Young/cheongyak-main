import { ExternalLink, HelpCircle } from "lucide-react";

/**
 * 온보딩의 핵심 장치. 모든 입력 항목 옆에 "이 정보 어디서 확인하나요?"를 붙인다.
 * 네이티브 details라 JS 없이도 열리고 키보드로도 동작한다.
 */
export function FieldHelp({
  question = "이 정보 어디서 확인하나요?",
  steps,
  links = [],
  note,
}: {
  question?: string;
  steps: string[];
  links?: { label: string; href: string }[];
  note?: string;
}) {
  return (
    <details className="group rounded-md border border-line bg-surface-2 text-sm open:bg-brand-tint open:border-brand/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-semibold text-brand marker:hidden [&::-webkit-details-marker]:hidden">
        <HelpCircle size={16} strokeWidth={2.4} />
        {question}
      </summary>
      <div className="px-3 pb-3 pt-1 text-ink-2">
        <ol className="list-decimal space-y-1 pl-5 leading-relaxed">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {links.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-sm border border-line-strong bg-surface px-2.5 text-[13px] font-semibold text-ink hover:border-brand hover:text-brand"
              >
                {l.label}
                <ExternalLink size={13} />
              </a>
            ))}
          </div>
        )}
        {note && <p className="mt-2.5 text-[13px] text-ink-3">{note}</p>}
      </div>
    </details>
  );
}
