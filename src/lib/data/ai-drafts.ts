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
  /** 공고 원문 링크. 추출에 실패한 건은 관리자가 여기로 직접 들어가 확인해야 한다 */
  originalUrl: string;
  /** 접수 마감일(YYYY-MM-DD). 검수 우선순위를 정하는 실질적인 기준이다 */
  applyEnd: string;
  /** 오늘(KST) 기준 남은 일수. 음수면 이미 마감된 공고(=지금 검수해도 아무도 못 본다) */
  daysLeft: number;
  /** 시도(region)를 못 정한 공고. 조건 판정은 되지만 지역 필터·추천에서 빠진다 */
  regionMissing: boolean;
  /** 공급기관 코드를 못 정한 공고(지자체 개발공사 등). 기관 배지가 안 나온다 */
  agencyUnknown: boolean;
  /** "시도 시군구" 원문. 관리자가 지역을 채울 때 근거로 본다 */
  district: string;
}

export interface AiDraftDetail extends AiDraftSummary {
  aiDraft: ExtractionDraft | null;
  supplyUnitIds: { id: string; name: string }[];
}

/**
 * 초안이 추출된(검수 대기 중인) 공고 목록. 큐 화면에서 쓴다.
 *
 * **마감 임박 순**으로 준다. 검수는 결국 "사용자가 신청할 수 있게" 하는 일이라,
 * 마감이 가까운 것부터 처리해야 실제로 쓸모가 생긴다. 추출 시각순은 의미가 없었다.
 * 확신도로 정렬하지 않는 이유: 실제 데이터가 접수중 63건 전부 high라 정렬이 안 된다.
 * 이미 마감된 건(daysLeft < 0)은 검수해도 아무도 못 보므로 화면에서 뒤로 미룬다.
 */
export async function getAiDraftQueue(): Promise<AiDraftSummary[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, original_url, apply_end, region, district, agency_code, ai_draft_status, ai_draft_confidence, ai_draft_notes, ai_draft_error, ai_draft_extracted_at, notice_pdf_url")
    .in("ai_draft_status", ["extracted", "failed", "approved"])
    .order("apply_end", { ascending: true });
  if (error) throw error;

  // KST 자정 기준으로 남은 일수를 센다(서버가 UTC여도 날짜가 하루 밀리지 않게).
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayMs = new Date(todayKst).getTime();

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    aiDraftStatus: r.ai_draft_status,
    aiDraftConfidence: r.ai_draft_confidence,
    aiDraftNotes: r.ai_draft_notes,
    aiDraftError: r.ai_draft_error,
    aiDraftExtractedAt: r.ai_draft_extracted_at,
    noticePdfUrl: r.notice_pdf_url,
    originalUrl: r.original_url,
    applyEnd: r.apply_end,
    daysLeft: Math.round((new Date(r.apply_end).getTime() - todayMs) / 86400000),
    regionMissing: !r.region,
    agencyUnknown: r.agency_code === "UNKNOWN",
    district: r.district ?? "",
  }));
}

/** 초안 상세 + 이 공고의 실제 supply_units 목록(반영 대상 선택용) */
export async function getAiDraftDetail(announcementId: string): Promise<AiDraftDetail | null> {
  const supabase = createAdminClient();
  const { data: a, error } = await supabase
    .from("announcements")
    .select("id, title, original_url, apply_end, region, district, agency_code, ai_draft, ai_draft_status, ai_draft_confidence, ai_draft_notes, ai_draft_error, ai_draft_extracted_at, notice_pdf_url")
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
    originalUrl: a.original_url,
    applyEnd: a.apply_end,
    daysLeft: Math.round(
      (new Date(a.apply_end).getTime() -
        new Date(new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)).getTime()) /
        86400000,
    ),
    regionMissing: !a.region,
    agencyUnknown: a.agency_code === "UNKNOWN",
    district: a.district ?? "",
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
      // 자동 판정엔 못 쓰지만 사용자가 알아야 하는 조건들. 승인 시 함께 옮긴다.
      other_requirements: draftUnit.otherRequirements ?? [],
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
