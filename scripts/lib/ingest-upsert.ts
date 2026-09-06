/**
 * 자동수집이 "소스 소유 칸"만 upsert하도록 강제하는 헬퍼.
 * 설계서 4장: 관리자가 채운 칸(status/review_status/summary/eligibility 등은 예외 규칙 있음)을
 * 재수집이 절대 덮어쓰지 않아야 한다 — "조심해서 코딩"이 아니라 "컬럼 목록이 달라서 못 건드린다"로
 * 만드는 게 이 파일의 목적이다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestedAnnouncement, IngestedUnit } from "../../src/lib/ingest/myhome";

export interface RunCounts {
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  closed: number;
  deactivatedUnits: number;
}

function emptyCounts(fetched: number): RunCounts {
  return { fetched, inserted: 0, updated: 0, unchanged: 0, closed: 0, deactivatedUnits: 0 };
}

/** 신규 공고 insert용 행. 수집기가 소유하는 칸 전부 + 관리자 칸의 초기값(published+pending) */
function toInsertRow(a: IngestedAnnouncement) {
  return {
    id: a.id,
    source: a.source,
    source_id: a.sourceId,
    title: a.title,
    agency_code: a.agency.code,
    agency_name: a.agency.name,
    housing_type: a.housingType,
    housing_type_src: a.housingType,
    region: a.region,
    district: a.district,
    units: a.units,
    auto_summary: a.autoSummary ?? null,
    announced_at: a.announcedAt,
    apply_start: a.applyStart,
    apply_end: a.applyEnd,
    original_url: a.originalUrl,
    original_url_kind: a.originalUrlKind ?? null,
    ranking_method: a.rankingMethod,
    source_hash: a.sourceHash,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    source_updated_at: new Date().toISOString(),
    // 관리자 칸의 초기값. 이후 재수집에서는 이 두 컬럼을 건드리지 않는다(recheck 전환 제외).
    status: a.status,
    review_status: a.reviewStatus,
  };
}

/** 기존 공고 갱신용 행. "소스 소유 칸"만 명시 — status/review_status/summary는 여기 없다 */
function toSourceUpdateRow(a: IngestedAnnouncement) {
  return {
    title: a.title,
    agency_code: a.agency.code,
    agency_name: a.agency.name,
    housing_type_src: a.housingType,
    region: a.region,
    district: a.district,
    units: a.units,
    auto_summary: a.autoSummary ?? null,
    announced_at: a.announcedAt,
    apply_start: a.applyStart,
    apply_end: a.applyEnd,
    original_url: a.originalUrl,
    original_url_kind: a.originalUrlKind ?? null,
    source_hash: a.sourceHash,
    last_seen_at: new Date().toISOString(),
    source_updated_at: new Date().toISOString(),
  };
}

function toUnitInsertRow(announcementId: string, u: IngestedUnit) {
  return {
    id: u.id,
    announcement_id: announcementId,
    name: u.name,
    housing_type: u.housingType,
    ranking_method: u.rankingMethod,
    units_count: u.unitsCount,
    address: u.address ?? null,
    rent_note: u.rentNote ?? null,
    source_hash: u.sourceHash,
    last_seen_at: new Date().toISOString(),
    active: true,
    // 관리자 칸(eligibility/tiers/score_rules)은 신규 유닛이라 빈 값으로 시작한다.
    eligibility: [],
    tiers: [],
    score_rules: [],
  };
}

function toUnitSourceUpdateRow(u: IngestedUnit) {
  return {
    name: u.name,
    units_count: u.unitsCount,
    address: u.address ?? null,
    rent_note: u.rentNote ?? null,
    source_hash: u.sourceHash,
    last_seen_at: new Date().toISOString(),
    active: true,
  };
}

/**
 * 한 소스(예: 마이홈포털)에서 가져온 공고 목록을 안전하게 반영한다.
 * - 새 id: insert (published+pending)
 * - 기존 id, 해시 같음: last_seen_at만 갱신
 * - 기존 id, 해시 다름: 소스 칸만 갱신, ready였으면 recheck로 전환
 * - 이번 수집에 없는 유닛: active=false로 숨김(삭제하지 않음)
 */
export async function applyIngestedAnnouncements(
  supabase: SupabaseClient,
  source: string,
  announcements: IngestedAnnouncement[],
): Promise<RunCounts> {
  const counts = emptyCounts(announcements.length);

  const { data: existingRows, error: existingErr } = await supabase
    .from("announcements")
    .select("id, source_hash, review_status")
    .eq("source", source);
  if (existingErr) throw existingErr;

  const existingById = new Map((existingRows ?? []).map((r) => [r.id, r]));

  const toInsert: ReturnType<typeof toInsertRow>[] = [];
  const toUpdate: { id: string; row: ReturnType<typeof toSourceUpdateRow>; toRecheck: boolean }[] = [];
  const seenSourceIds = new Set<string>();

  for (const a of announcements) {
    seenSourceIds.add(a.id);
    const existing = existingById.get(a.id);
    if (!existing) {
      toInsert.push(toInsertRow(a));
      continue;
    }
    if (existing.source_hash === a.sourceHash) {
      counts.unchanged++;
      // 변화 없어도 last_seen_at은 갱신한다(안전장치가 참조).
      toUpdate.push({ id: a.id, row: toSourceUpdateRow(a), toRecheck: false });
      continue;
    }
    toUpdate.push({ id: a.id, row: toSourceUpdateRow(a), toRecheck: existing.review_status === "ready" });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("announcements").insert(toInsert);
    if (error) throw error;
    counts.inserted = toInsert.length;

    const unitRows = announcements
      .filter((a) => toInsert.some((r) => r.id === a.id))
      .flatMap((a) => a.supplyUnits.map((u) => toUnitInsertRow(a.id, u)));
    if (unitRows.length > 0) {
      const { error: uErr } = await supabase.from("supply_units").insert(unitRows);
      if (uErr) throw uErr;
    }
  }

  for (const { id, row, toRecheck } of toUpdate) {
    const { error } = await supabase.from("announcements").update(row).eq("id", id);
    if (error) throw error;
    if (toRecheck) {
      const { error: rErr } = await supabase.from("announcements").update({ review_status: "recheck" }).eq("id", id);
      if (rErr) throw rErr;
      counts.updated++;
    }

    const a = announcements.find((x) => x.id === id)!;
    for (const u of a.supplyUnits) {
      const { data: existingUnit } = await supabase
        .from("supply_units")
        .select("id, source_hash")
        .eq("id", u.id)
        .maybeSingle();
      if (!existingUnit) {
        const { error: insErr } = await supabase.from("supply_units").insert(toUnitInsertRow(id, u));
        if (insErr) throw insErr;
      } else if (existingUnit.source_hash !== u.sourceHash) {
        const { error: updErr } = await supabase.from("supply_units").update(toUnitSourceUpdateRow(u)).eq("id", u.id);
        if (updErr) throw updErr;
      } else {
        await supabase.from("supply_units").update({ last_seen_at: new Date().toISOString() }).eq("id", u.id);
      }
    }
  }

  // 이번 수집에서 사라진 공고의 유닛은 비활성화한다(공고 자체는 건드리지 않음 — 관리자가 hidden 처리)
  const disappearedIds = [...existingById.keys()].filter((id) => !seenSourceIds.has(id));
  if (disappearedIds.length > 0) {
    const { data: deactivated, error } = await supabase
      .from("supply_units")
      .update({ active: false })
      .in("announcement_id", disappearedIds)
      .eq("active", true)
      .select("id");
    if (error) throw error;
    counts.deactivatedUnits = deactivated?.length ?? 0;
  }

  return counts;
}

/**
 * 접수 마감일이 지난 published 공고를 closed로 전환한다. KST 자정 기준(설계서 5-4) —
 * 서버가 UTC로 돌면 9시간 일찍 마감 처리되는 걸 막기 위해 KST 날짜로 비교한다.
 */
export async function autoCloseExpiredAnnouncements(supabase: SupabaseClient): Promise<number> {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKst = kstNow.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("announcements")
    .update({ status: "closed" })
    .eq("status", "published")
    .lt("apply_end", todayKst)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
