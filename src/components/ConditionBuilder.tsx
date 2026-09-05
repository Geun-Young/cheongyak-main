"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Announcement, Condition, FactValue, Field, Operator } from "@/lib/types";
import { FIELD_DEFS, OPERATOR_LABEL, operatorsFor } from "@/lib/fields";
import { DEMO_PROFILE, deriveFacts } from "@/lib/profile";
import { matchAnnouncement } from "@/lib/matching";
import { StatusBadge } from "./StatusBadge";
import { Button, Input, Select, cx } from "./ui";

export interface BuilderRow {
  id: string;
  field: Field;
  operator: Operator;
  value: string;
  kind: "eligibility" | "score";
  points: number;
}

const FIELDS = Object.keys(FIELD_DEFS) as Field[];

function newRow(): BuilderRow {
  return { id: Math.random().toString(36).slice(2, 8), field: "incomePct", operator: "lte", value: "100", kind: "eligibility", points: 0 };
}

function parseValue(field: Field, operator: Operator, raw: string): FactValue | FactValue[] {
  const def = FIELD_DEFS[field];
  const one = (s: string): FactValue => {
    const t = s.trim();
    if (def.kind === "boolean") return t === "true";
    if (def.kind === "enum" || def.kind === "region") return t;
    return Number(t);
  };
  if (operator === "in") return raw.split(",").map(one);
  return one(raw);
}

export function toConditions(rows: BuilderRow[]): Condition[] {
  return rows
    .filter((r) => r.kind === "eligibility")
    .map((r) => {
      const def = FIELD_DEFS[r.field];
      const valueLabel =
        def.options?.find((o) => String(o.value) === r.value)?.label ?? r.value;
      return {
        id: r.id,
        field: r.field,
        operator: r.operator,
        value: parseValue(r.field, r.operator, r.value),
        label: `${def.label} ${valueLabel}${def.unit ?? ""} ${OPERATOR_LABEL[r.operator]}`,
      };
    });
}

export function ConditionBuilder({
  rows,
  onChange,
}: {
  rows: BuilderRow[];
  onChange: (rows: BuilderRow[]) => void;
}) {
  const [showPreview, setShowPreview] = useState(true);

  const update = (id: string, patch: Partial<BuilderRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const preview = useMemo(() => {
    const draft: Announcement = {
      id: "draft",
      title: "미리보기",
      agency: { code: "LH", name: "LH" },
      housingType: "국민임대",
      region: "서울",
      district: "",
      units: 0,
      summary: [],
      announcedAt: "2026-01-01",
      applyStart: "2026-01-01",
      applyEnd: "2099-12-31",
      originalUrl: "",
      rankingMethod: "순위+가점",
      reviewStatus: "ready",
      status: "published",
      eligibility: toConditions(rows),
      tiers: [],
      scoreRules: [],
    };
    return matchAnnouncement(draft, deriveFacts(DEMO_PROFILE));
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1.4fr_1fr_1.2fr_1fr_72px_40px] gap-2 px-1 text-[12px] font-semibold text-ink-3 md:grid">
        <span>항목</span>
        <span>비교</span>
        <span>기준값</span>
        <span>구분</span>
        <span>가점</span>
        <span />
      </div>

      {rows.length === 0 && (
        <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">
          아직 조건이 없어요. 조건이 하나도 없으면 사용자에게 「확인 필요」로 표시돼요.
        </p>
      )}

      {rows.map((r) => {
        const def = FIELD_DEFS[r.field];
        const ops = operatorsFor(def.kind);
        return (
          <div key={r.id} className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface-2 p-2 md:grid-cols-[1.4fr_1fr_1.2fr_1fr_72px_40px] md:items-center md:border-0 md:bg-transparent md:p-0">
            <Select
              value={r.field}
              onChange={(e) => {
                const field = e.target.value as Field;
                const nextOps = operatorsFor(FIELD_DEFS[field].kind);
                update(r.id, { field, operator: nextOps[0], value: "" });
              }}
              className="h-10 text-sm"
              aria-label="항목"
            >
              {FIELDS.map((f) => (
                <option key={f} value={f}>{FIELD_DEFS[f].label}</option>
              ))}
            </Select>

            <Select value={r.operator} onChange={(e) => update(r.id, { operator: e.target.value as Operator })} className="h-10 text-sm" aria-label="비교">
              {ops.map((o) => (
                <option key={o} value={o}>{OPERATOR_LABEL[o]}</option>
              ))}
            </Select>

            {def.options && r.operator !== "in" ? (
              <Select value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} className="h-10 text-sm" aria-label="기준값">
                <option value="">선택</option>
                {def.options.map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                ))}
              </Select>
            ) : (
              <Input
                value={r.value}
                onChange={(e) => update(r.id, { value: e.target.value })}
                placeholder={r.operator === "in" ? "서울,경기,인천" : def.kind === "months" ? "개월 수" : def.kind === "manwon" ? "만원" : "값"}
                className="h-10 text-sm"
                aria-label="기준값"
              />
            )}

            <div className="flex rounded-md border border-line-strong bg-surface p-0.5">
              {(["eligibility", "score"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => update(r.id, { kind: k })}
                  className={cx(
                    "h-8 flex-1 rounded-sm text-[13px] font-semibold",
                    r.kind === k ? "bg-brand text-white" : "text-ink-2",
                  )}
                >
                  {k === "eligibility" ? "자격요건" : "가점"}
                </button>
              ))}
            </div>

            <Input
              type="number"
              min={0}
              value={r.points}
              disabled={r.kind !== "score"}
              onChange={(e) => update(r.id, { points: Number(e.target.value) })}
              className="h-10 text-sm tnum"
              aria-label="가점"
            />

            <button
              type="button"
              onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
              className="grid h-10 place-items-center rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger"
              aria-label="조건 삭제"
            >
              <Trash2 size={17} />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button variant="secondary" size="sm" onClick={() => onChange([...rows, newRow()])}>
          <Plus size={16} strokeWidth={2.6} />
          조건 추가
        </Button>
        <button type="button" onClick={() => setShowPreview((v) => !v)} className="text-sm font-semibold text-brand">
          {showPreview ? "미리보기 접기" : "체험 계정으로 미리보기"}
        </button>
      </div>

      {showPreview && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-brand-tint px-4 py-3 text-sm">
          <span className="font-semibold text-ink-2">체험 계정 「김청약」 판정</span>
          <StatusBadge status={preview.status} size="sm" />
          {preview.status === "ineligible" && (
            <span className="text-ink-2">미달: {preview.unmet.map((c) => c.label).join(", ")}</span>
          )}
          {preview.status === "needs_review" && <span className="text-ink-3">자격요건이 없어서 확인 필요로 표시돼요</span>}
        </div>
      )}
    </div>
  );
}
