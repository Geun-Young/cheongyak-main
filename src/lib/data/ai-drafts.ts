/**
 * PDF -> Gemini 자격요건 초안(ai_draft) 조회/승인. 전부 관리자 전용(service_role)이다.
 * 승인은 "초안 내용을 사람이 확인한 뒤 supply_units에 명시적으로 반영"하는 행위이지,
 * 자동 반영이 아니다 — scripts/extract-conditions.ts와 마이그레이션 0003 설명 참고.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Condition, ScoreBand, ScoreRule, Tier, Field } from "@/lib/types";
import type { DraftUnit, ExtractionDraft } from "@/lib/ingest/gemini-extract";

export interface AiDraftSummary {
  id: string;
  title: string;
  aiDraftStatus: "none" | "pending" | "extracted" | "approved" | "failed";
  aiDraftConfidence: "high" | "medium" | "low" | null;
  aiDraftNotes: string | null;
  aiDraftError: string | null;
  aiDraftExtractedAt: string | null;
  noticePdfUrl: string | null;
}

export interface AiDraftDetail extends AiDraftSummary {
  aiDraft: ExtractionDraft | null;
  supplyUnitIds: { id: string; name: string }[];
}

/** 초안이 추출된(검수 대기 중인) 공고 목록. 큐 화면에서 쓴다 */
export async function getAiDraftQueue(): Promise<AiDraftSummary[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, ai_draft_status, ai_draft_confidence, ai_draft_notes, ai_draft_error, ai_draft_extracted_at, notice_pdf_url")
    .in("ai_draft_status", ["extracted", "failed", "approved"])
    .order("ai_draft_extracted_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    aiDraftStatus: r.ai_draft_status,
    aiDraftConfidence: r.ai_draft_confidence,
    aiDraftNotes: r.ai_draft_notes,
    aiDraftError: r.ai_draft_error,
    aiDraftExtractedAt: r.ai_draft_extracted_at,
    noticePdfUrl: r.notice_pdf_url,
  }));
}

/** 초안 상세 + 이 공고의 실제 supply_units 목록(반영 대상 선택용) */
export async function getAiDraftDetail(announcementId: string): Promise<AiDraftDetail | null> {
  const supabase = createAdminClient();
  const { data: a, error } = await supabase
    .from("announcements")
    .select("id, title, ai_draft, ai_draft_status, ai_draft_confidence, ai_draft_notes, ai_draft_error, ai_draft_extracted_at, notice_pdf_url")
    .eq("id", announcementId)
    .maybeSingle();
  if (error) throw error;
  if (!a) return null;

  const { data: units, error: uErr } = await supabase
    .from("supply_units")
    .select("id, name")
    .eq("announcement_id", announcementId);
  if (uErr) throw uErr;

  return {
    id: a.id,
    title: a.title,
    aiDraftStatus: a.ai_draft_status,
    aiDraftConfidence: a.ai_draft_confidence,
    aiDraftNotes: a.ai_draft_notes,
    aiDraftError: a.ai_draft_error,
    aiDraftExtractedAt: a.ai_draft_extracted_at,
    noticePdfUrl: a.notice_pdf_url,
    aiDraft: a.ai_draft,
    supplyUnitIds: units ?? [],
  };
}

function draftConditionsToConditions(idPrefix: string, drafts: DraftUnit["eligibility"]): Condition[] {
  return drafts.map((d, i) => ({ ...d, id: `${idPrefix}-c${i}` }));
}

function draftTiersToTiers(idPrefix: string, drafts: DraftUnit["tiers"]): Tier[] {
  return drafts.map((t) => ({
    rank: (t.rank as 1 | 2 | 3) ?? 1,
    label: t.label,
    conditions: draftConditionsToConditions(`${idPrefix}-t${t.rank}`, t.conditions),
  }));
}

function draftScoreRulesToScoreRules(idPrefix: string, drafts: DraftUnit["scoreRules"]): ScoreRule[] {
  return drafts.map((r, i) => ({
    id: `${idPrefix}-s${i}`,
    label: r.label,
    field: r.field as Field,
    bands: r.bands as ScoreBand[],
  }));
}

/**
 * 초안의 한 유닛(draftUnit)을 실제 supply_units 한 행에 반영한다.
 * eligibility/tiers/scoreRules를 통째로 덮어쓴다 — 관리자가 검수 화면에서 내용을 보고
 * 명시적으로 호출하는 액션이라 여기서는 별도 병합 로직 없이 단순 대입한다.
 */
export async function approveDraftToUnit(
  announcementId: string,
  supplyUnitId: string,
  draftUnit: DraftUnit,
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("supply_units")
    .update({
      eligibility: draftConditionsToConditions(supplyUnitId, draftUnit.eligibility),
      tiers: draftTiersToTiers(supplyUnitId, draftUnit.tiers),
      score_rules: draftScoreRulesToScoreRules(supplyUnitId, draftUnit.scoreRules),
    })
    .eq("id", supplyUnitId)
    .eq("announcement_id", announcementId);
  if (error) throw error;
}

/** 공고 전체를 "검수 완료"로 표시한다(ai_draft_status만 바꾼다 — 판정 가능 여부는 아래 함수가 담당) */
export async function markDraftApproved(announcementId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("announcements")
    .update({ ai_draft_status: "approved" })
    .eq("id", announcementId);
  if (error) throw error;
}

/**
 * 공고를 "판정 가능"(review_status: ready)으로 전환한다. 조건을 유닛에 반영하는 것과는
 * 별개 액션이다 — 관리자가 여러 유닛의 조건을 다 확인한 뒤 마지막으로 누르는 스위치.
 */
export async function markAnnouncementReady(announcementId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("announcements")
    .update({ review_status: "ready" })
    .eq("id", announcementId);
  if (error) throw error;
}
