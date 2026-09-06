/** Announcement/SupplyUnit 도메인 타입 -> Supabase 테이블 행. 시드 스크립트들이 공용으로 쓴다 */
import type { Announcement, SupplyUnit } from "../../src/lib/types";

export function toAnnouncementRow(a: Announcement) {
  return {
    id: a.id,
    title: a.title,
    agency_code: a.agency.code,
    agency_name: a.agency.name,
    housing_type: a.housingType,
    region: a.region,
    district: a.district,
    units: a.units,
    summary: a.summary,
    announced_at: a.announcedAt,
    apply_start: a.applyStart,
    apply_end: a.applyEnd,
    original_url: a.originalUrl,
    original_url_kind: a.originalUrlKind ?? null,
    ranking_method: a.rankingMethod,
    review_status: a.reviewStatus,
    status: a.status,
  };
}

export function toUnitRow(announcementId: string, u: SupplyUnit) {
  return {
    id: u.id,
    announcement_id: announcementId,
    name: u.name,
    housing_type: u.housingType,
    ranking_method: u.rankingMethod,
    units_count: u.unitsCount,
    address: u.address ?? null,
    lat: u.lat ?? null,
    lng: u.lng ?? null,
    rent_note: u.rentNote ?? null,
    move_in: u.moveIn ?? null,
    summary: u.summary ?? null,
    eligibility: u.eligibility,
    tiers: u.tiers,
    score_rules: u.scoreRules,
  };
}
