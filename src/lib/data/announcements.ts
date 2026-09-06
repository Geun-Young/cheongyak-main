import type { Announcement, Condition, ScoreRule, SupplyUnit, Tier } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase의 announcements/supply_units 테이블 행을 도메인 타입(Announcement)으로 변환한다.
 * eligibility/tiers/score_rules는 jsonb 컬럼이라 DB에서 이미 Condition[]/Tier[]/ScoreRule[]
 * 형태로 온다(scripts/seed-announcements.ts가 그 형태로 넣었다) — 그대로 캐스팅한다.
 */

interface AnnouncementRow {
  id: string;
  title: string;
  agency_code: Announcement["agency"]["code"];
  agency_name: string;
  housing_type: Announcement["housingType"];
  region: Announcement["region"];
  district: string;
  units: number;
  summary: string[];
  announced_at: string;
  apply_start: string;
  apply_end: string;
  original_url: string;
  original_url_kind: Announcement["originalUrlKind"] | null;
  ranking_method: Announcement["rankingMethod"];
  review_status: Announcement["reviewStatus"];
  status: Announcement["status"];
}

interface SupplyUnitRow {
  id: string;
  announcement_id: string;
  name: string;
  housing_type: SupplyUnit["housingType"];
  ranking_method: SupplyUnit["rankingMethod"];
  units_count: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rent_note: string | null;
  move_in: string | null;
  summary: string[] | null;
  eligibility: Condition[];
  tiers: Tier[];
  score_rules: ScoreRule[];
}

function toUnit(row: SupplyUnitRow): SupplyUnit {
  return {
    id: row.id,
    name: row.name,
    housingType: row.housing_type,
    rankingMethod: row.ranking_method,
    unitsCount: row.units_count,
    address: row.address ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    rentNote: row.rent_note ?? undefined,
    moveIn: row.move_in ?? undefined,
    summary: row.summary ?? undefined,
    eligibility: row.eligibility,
    tiers: row.tiers,
    scoreRules: row.score_rules,
  };
}

function toAnnouncement(row: AnnouncementRow, unitRows: SupplyUnitRow[]): Announcement {
  return {
    id: row.id,
    title: row.title,
    agency: { code: row.agency_code, name: row.agency_name },
    housingType: row.housing_type,
    region: row.region,
    district: row.district,
    units: row.units,
    summary: row.summary,
    announcedAt: row.announced_at,
    applyStart: row.apply_start,
    applyEnd: row.apply_end,
    originalUrl: row.original_url,
    originalUrlKind: row.original_url_kind ?? undefined,
    rankingMethod: row.ranking_method,
    reviewStatus: row.review_status,
    status: row.status,
    supplyUnits: unitRows.map(toUnit),
  };
}

function groupUnitsByAnnouncement(unitRows: SupplyUnitRow[]): Map<string, SupplyUnitRow[]> {
  const map = new Map<string, SupplyUnitRow[]>();
  for (const u of unitRows) {
    const list = map.get(u.announcement_id) ?? [];
    list.push(u);
    map.set(u.announcement_id, list);
  }
  return map;
}

/** 게시된 공고 전체를 유닛까지 조인해서 가져온다(RLS가 published만 걸러준다). 목록/대시보드/랜딩에서 쓴다 */
export async function getAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();

  const [{ data: announcementRows, error: aErr }, { data: unitRows, error: uErr }] = await Promise.all([
    supabase.from("announcements").select("*").order("apply_end", { ascending: true }),
    supabase.from("supply_units").select("*"),
  ]);

  if (aErr) throw aErr;
  if (uErr) throw uErr;

  const unitsByAnnouncement = groupUnitsByAnnouncement(unitRows ?? []);
  return (announcementRows ?? []).map((a) => toAnnouncement(a, unitsByAnnouncement.get(a.id) ?? []));
}

/** 공고 상세 하나를 유닛까지 가져온다. 없으면(비공개/삭제/오타) undefined */
export async function getAnnouncementById(id: string): Promise<Announcement | undefined> {
  const supabase = await createClient();

  const { data: announcementRow, error: aErr } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!announcementRow) return undefined;

  const { data: unitRows, error: uErr } = await supabase
    .from("supply_units")
    .select("*")
    .eq("announcement_id", id);
  if (uErr) throw uErr;

  return toAnnouncement(announcementRow, unitRows ?? []);
}

/**
 * 관리자용: draft·closed를 포함한 전체 공고를 가져온다. service_role로 RLS를 우회한다.
 * TODO(인증): /admin/*에 로그인 게이트가 붙으면 일반 서버 클라이언트 + admin RLS 정책으로 교체한다.
 */
export async function getAnnouncementsForAdmin(): Promise<Announcement[]> {
  const supabase = createAdminClient();

  const [{ data: announcementRows, error: aErr }, { data: unitRows, error: uErr }] = await Promise.all([
    supabase.from("announcements").select("*").order("apply_end", { ascending: true }),
    supabase.from("supply_units").select("*"),
  ]);

  if (aErr) throw aErr;
  if (uErr) throw uErr;

  const unitsByAnnouncement = groupUnitsByAnnouncement(unitRows ?? []);
  return (announcementRows ?? []).map((a) => toAnnouncement(a, unitsByAnnouncement.get(a.id) ?? []));
}

/** 관리자 편집 화면용: draft·closed도 조회 가능한 단건 조회 */
export async function getAnnouncementByIdForAdmin(id: string): Promise<Announcement | undefined> {
  const supabase = createAdminClient();

  const { data: announcementRow, error: aErr } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!announcementRow) return undefined;

  const { data: unitRows, error: uErr } = await supabase
    .from("supply_units")
    .select("*")
    .eq("announcement_id", id);
  if (uErr) throw uErr;

  return toAnnouncement(announcementRow, unitRows ?? []);
}
