/**
 * 공고문에서 읽어낸 유닛 이름에서 전용면적(㎡)을 뽑는다.
 *
 * ## 왜 필요한가
 *
 * 같은 공고 안의 집들을 임대료로 비교하려면 면적이 있어야 한다. 면적 없이 월세만 보면
 * **"싼 집"이 아니라 "작은 집"을 고르게 된다** — 26㎡ 5만원과 59㎡ 11만원 중 뒤가 더
 * 저렴한데도 앞을 추천하게 된다.
 *
 * ## 이름이 두 축으로 나뉘어 있다
 *
 * DB의 supply_units.name은 100% 단지명이고("경주안강장미마을"), AI 초안의 유닛 이름은
 * 79%가 면적이다("전용 39㎡"). 둘은 서로 다른 축이라 1:1로 못 엮는다. 그래서 면적은
 * 초안에서 뽑아 **공고 수준의 부가 정보**로 붙인다.
 *
 * ## 주의: 한 이름에 여러 면적이 들어 있다
 *
 * "전용 26㎡, 29㎡, 33㎡, 37㎡, 46㎡"처럼 나열된 경우가 실제로 있다. 첫 숫자만 집으면
 * 26㎡로 단정해 ㎡당 임대료가 크게 틀린다. 그래서 **모두 뽑아서 범위로** 다룬다.
 */

export interface AreaInfo {
  /** 뽑아낸 면적들(㎡). 오름차순 */
  values: number[];
  /** 대표값. 여러 개면 중앙값을 쓴다 — 평균은 극단값에 끌려간다 */
  representative: number;
  /**
   * 이 값을 계산에 써도 되는지.
   * "50㎡ 이상"처럼 경계만 말하거나 값이 여럿이면 false — 범위가 넓어 ㎡당 단가가 부정확하다.
   */
  precise: boolean;
  /** 사용자에게 보여줄 표기. 예) "39㎡", "26~46㎡", "50㎡ 이상" */
  label: string;
}

/** 공공임대 전용면적의 현실적인 범위. 벗어나면 잘못 읽은 것으로 본다 */
const MIN_M2 = 10;
const MAX_M2 = 200;

/**
 * 이름 문자열에서 면적을 뽑는다. 못 찾으면 null.
 *
 * 숫자를 전부 모으되 상식 범위를 벗어난 값은 버린다 — "84타입 3단지" 같은 문자열에서
 * 엉뚱한 숫자가 딸려 오는 걸 막는다.
 */
export function parseArea(name: string): AreaInfo | null {
  if (!name) return null;

  const matches = [...name.matchAll(/(\d+(?:\.\d+)?)\s*(?:㎡|m2|m²)/gi)];
  if (matches.length === 0) return null;

  const values = matches
    .map((m) => Number(m[1]))
    .filter((v) => Number.isFinite(v) && v >= MIN_M2 && v <= MAX_M2)
    .sort((a, b) => a - b);

  if (values.length === 0) return null;

  // "이상/이하/미만/초과"가 붙으면 경계값일 뿐 실제 면적이 아니다.
  const isBoundary = /(미만|이상|이하|초과)/.test(name);
  const unique = [...new Set(values)];

  const representative =
    unique.length === 1 ? unique[0] : unique[Math.floor(unique.length / 2)];

  let label: string;
  if (isBoundary && unique.length === 1) {
    const suffix = /미만/.test(name) ? "미만" : /이상/.test(name) ? "이상" : /초과/.test(name) ? "초과" : "이하";
    label = `${unique[0]}㎡ ${suffix}`;
  } else if (unique.length === 1) {
    label = `${unique[0]}㎡`;
  } else {
    label = `${unique[0]}~${unique[unique.length - 1]}㎡`;
  }

  return {
    values: unique,
    representative,
    // 값이 하나이고 경계 표현이 아닐 때만 계산에 쓴다.
    precise: unique.length === 1 && !isBoundary,
    label,
  };
}

export interface RentInfo {
  /** 보증금(원) */
  deposit: number | null;
  /** 월 임대료(원) */
  monthly: number | null;
  /** 입주금(원). 전세임대·매입임대는 월세 없이 이것만 있는 경우가 많다 */
  entry: number | null;
}

/**
 * rent_note 원문에서 금액을 뽑는다.
 * 예) "보증금 4,076,000원 / 월 72,820원 / 입주금 203,800원"
 */
export function parseRent(note: string | null | undefined): RentInfo {
  const empty: RentInfo = { deposit: null, monthly: null, entry: null };
  if (!note) return empty;

  const num = (re: RegExp): number | null => {
    const m = note.match(re);
    if (!m) return null;
    const v = Number(m[1].replace(/,/g, ""));
    return Number.isFinite(v) ? v : null;
  };

  return {
    deposit: num(/보증금\s*([\d,]+)\s*원/),
    monthly: num(/월\s*([\d,]+)\s*원/),
    entry: num(/입주금\s*([\d,]+)\s*원/),
  };
}

/**
 * ㎡당 월 임대료(원). 면적이나 월세를 모르면 null.
 *
 * 보증금을 월세로 환산해 더할 수도 있지만(전월세전환율) 공공임대는 보증금·월세 비율을
 * 신청자가 조정할 수 있는 경우가 많아, 지금은 월세만 본다. 같은 공고 안에서 비교하는
 * 용도라 기준만 일관되면 순서는 유효하다.
 */
export function rentPerM2(rent: RentInfo, area: AreaInfo | null): number | null {
  if (!area || !area.precise || area.representative <= 0) return null;
  if (rent.monthly === null || rent.monthly <= 0) return null;
  return rent.monthly / area.representative;
}

/**
 * 공고 하나에서 "모든 집에 공통으로 적용할 수 있는 면적"을 고른다.
 *
 * 면적은 초안의 유닛 이름에서 나오고(평형 축), 임대료는 DB 유닛에 있다(단지 축).
 * 두 축이 1:1로 안 엮이므로, **면적이 한 종류일 때만** 공통 면적으로 인정한다.
 *
 * 면적이 여러 종류면 어느 단지가 어느 평형인지 알 수 없다. 이때 아무 값이나 쓰면
 * ㎡당 단가가 단지마다 엉뚱하게 계산돼, 비싼 집을 싸다고 추천하는 일이 생긴다.
 * 모르면 null을 주고 임대료 비교를 아예 건너뛰는 편이 안전하다.
 */
export function commonArea(draftUnitNames: string[]): AreaInfo | null {
  const parsed = draftUnitNames
    .map((n) => parseArea(n))
    .filter((a): a is AreaInfo => a !== null && a.precise);

  if (parsed.length === 0) return null;

  const distinct = new Set(parsed.map((a) => a.representative));
  if (distinct.size !== 1) return null;

  return parsed[0];
}

/**
 * 공고 컬럼 area_label·area_m2(마이그레이션 0008)에 넣을 값. 초안 유닛 이름들로 만든다.
 * label은 보여주기용(여러 평형이면 "26~46㎡", 경계 표현이면 "85㎡ 이하"),
 * m2는 commonArea가 인정할 때만 — 여러 평형이 섞이면 null이라 ㎡당 계산에서 빠진다.
 */
export function announcementArea(draftUnitNames: string[]): { label: string | null; m2: number | null } {
  const parsed = draftUnitNames.map(parseArea).filter((a): a is AreaInfo => a !== null);
  if (parsed.length === 0) return { label: null, m2: null };
  const values = [...new Set(parsed.flatMap((a) => a.values))].sort((a, b) => a - b);
  const label =
    parsed.length === 1
      ? parsed[0].label
      : values.length === 1
        ? `${values[0]}㎡`
        : `${values[0]}~${values[values.length - 1]}㎡`;
  return { label, m2: commonArea(draftUnitNames)?.representative ?? null };
}
