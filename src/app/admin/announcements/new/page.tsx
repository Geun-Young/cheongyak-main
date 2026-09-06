"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Save, Send } from "lucide-react";
import type { Announcement, HousingType, RankingMethod } from "@/lib/types";
import { displaySummary } from "@/lib/announcement-display";
import { HOUSING_TYPES, REGIONS } from "@/lib/regions";
import { ConditionBuilder, type BuilderRow } from "@/components/ConditionBuilder";
import { Button, Card, Chip, Container, Field, Input, PageTitle, Select, Textarea } from "@/components/ui";

const RANKING_HINT: Record<RankingMethod, string> = {
  "순위+가점": "국민임대·매입임대 기본형. 순위(거주지·소득)로 먼저 가르고 같은 순위 안에서 가점 합산.",
  가점제: "공공분양 일반공급·장기전세. 무주택 기간·부양가족·통장 가입 기간 배점표.",
  추첨제: "행복주택 청년·청년안심주택·전세임대. 순위 안에서 무작위.",
  저축액순: "공공분양 일부 유형. 청약저축 납입 인정 총액이 큰 순서.",
};

interface FormState {
  title: string;
  agency: string;
  housingType: HousingType;
  region: string;
  district: string;
  units: string;
  applyStart: string;
  applyEnd: string;
  moveIn: string;
  rentNote: string;
  originalUrl: string;
  summary: string;
  ranking: RankingMethod;
}

function initialForm(a?: Announcement): FormState {
  return {
    title: a?.title ?? "",
    agency: a?.agency.code ?? "LH",
    housingType: a?.housingType ?? "국민임대",
    region: a?.region ?? "서울",
    district: a?.district ?? "",
    units: a ? String(a.units) : "",
    applyStart: a?.applyStart ?? "",
    applyEnd: a?.applyEnd ?? "",
    moveIn: a?.supplyUnits[0]?.moveIn ?? "",
    rentNote: a?.supplyUnits[0]?.rentNote ?? "",
    originalUrl: a?.originalUrl ?? "",
    summary: a ? displaySummary(a).join("\n") : "",
    ranking: a?.rankingMethod ?? "순위+가점",
  };
}

/** 편집 모드에서는 첫 번째 공급유닛의 조건을 불러온다. 여러 유닛 편집 UI는 후속 작업으로 남겨둔다 */
function initialRows(a?: Announcement): BuilderRow[] {
  const eligibility = a?.supplyUnits[0]?.eligibility ?? [];
  return eligibility.map((c) => ({
    id: c.id,
    field: c.field,
    operator: c.operator,
    value: Array.isArray(c.value) ? c.value.join(",") : String(c.value),
    kind: "eligibility" as const,
    points: 0,
  }));
}

function AnnouncementForm({ editing }: { editing?: Announcement }) {
  const [form, setForm] = useState<FormState>(() => initialForm(editing));
  const [rows, setRows] = useState<BuilderRow[]>(() => initialRows(editing));
  const [saved, setSaved] = useState<string | null>(null);

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  const submit = (status: "draft" | "published") => {
    const eligibilityCount = rows.filter((r) => r.kind === "eligibility").length;
    setSaved(
      status === "draft"
        ? "임시저장했어요. 사용자에게는 아직 보이지 않아요."
        : eligibilityCount === 0
          ? "게시했어요. 자격요건이 없어서 사용자에게는 「확인 필요」로 보여요."
          : `게시했어요. 자격요건 ${eligibilityCount}개로 바로 판정돼요.`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title={editing ? "공고 편집" : "새 공고 등록"}
        lead="공고문을 읽지 않아도 되도록, 사람 말로 요약하고 조건을 구조화해요."
        action={
          <Button variant="secondary" disabled title="공고문 PDF를 올리면 조건 초안을 자동으로 채우는 기능. 연동 예정">
            <FileText size={17} /> PDF에서 조건 추출
            <Chip size="sm" tone="info" className="ml-1">연동 예정</Chip>
          </Button>
        }
      />

      {saved && (
        <div className="mt-5 rounded-xl border border-ok/30 bg-ok-soft px-4 py-3 text-sm font-semibold text-ok" role="status">
          {saved} <span className="font-normal text-ink-3">(목업: 서버 연동 전이라 새로고침하면 사라져요)</span>
        </div>
      )}

      <form
        className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={(e) => {
          e.preventDefault();
          submit("published");
        }}
      >
        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-bold text-ink">기본 정보</h2>
            <div className="mt-4 grid gap-4">
              <Field label="공고명" htmlFor="ad-title">
                <Input id="ad-title" value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="예: 서울강동 국민임대주택 예비입주자 모집" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="기관" htmlFor="ad-agency">
                  <Select id="ad-agency" value={form.agency} onChange={(e) => set("agency")(e.target.value)}>
                    <option value="LH">LH 한국토지주택공사</option>
                    <option value="SH">SH 서울주택도시공사</option>
                    <option value="GH">GH 경기주택도시공사</option>
                    <option value="IH">iH 인천도시공사</option>
                    <option value="BMC">부산도시공사</option>
                    <option value="PRIVATE">민간사업자</option>
                  </Select>
                </Field>
                <Field label="주택 유형" htmlFor="ad-type">
                  <Select id="ad-type" value={form.housingType} onChange={(e) => set("housingType")(e.target.value as HousingType)}>
                    {HOUSING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="지역(시·도)" htmlFor="ad-region">
                  <Select id="ad-region" value={form.region} onChange={(e) => set("region")(e.target.value)}>
                    <option value="전국">전국</option>
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field label="세부 지역" htmlFor="ad-district">
                  <Input id="ad-district" value={form.district} onChange={(e) => set("district")(e.target.value)} placeholder="예: 서울 강동구" />
                </Field>
                <Field label="세대수" htmlFor="ad-units">
                  <Input id="ad-units" inputMode="numeric" value={form.units} onChange={(e) => set("units")(e.target.value.replace(/[^\d]/g, ""))} className="tnum" placeholder="0" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="접수 시작" htmlFor="ad-start">
                  <Input id="ad-start" type="date" value={form.applyStart} onChange={(e) => set("applyStart")(e.target.value)} required />
                </Field>
                <Field label="접수 마감" htmlFor="ad-end">
                  <Input id="ad-end" type="date" value={form.applyEnd} onChange={(e) => set("applyEnd")(e.target.value)} required />
                </Field>
                <Field label="입주 예정" htmlFor="ad-movein">
                  <Input id="ad-movein" value={form.moveIn} onChange={(e) => set("moveIn")(e.target.value)} placeholder="예: 2027년 상반기" />
                </Field>
              </div>
              <Field label="임대 조건 한 줄" htmlFor="ad-rent">
                <Input id="ad-rent" value={form.rentNote} onChange={(e) => set("rentNote")(e.target.value)} placeholder="예: 보증금 2,800만 ~ 4,100만 원 / 월 18만 ~ 27만 원" />
              </Field>
              <Field label="공고문 원문 링크" htmlFor="ad-url">
                <Input id="ad-url" type="url" value={form.originalUrl} onChange={(e) => set("originalUrl")(e.target.value)} placeholder="https://apply.lh.or.kr/..." />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-ink">핵심 요약</h2>
            <p className="mt-1 text-sm text-ink-3">한 줄에 하나씩, 3~5줄. 사용자가 공고문을 안 읽어도 되게 「누가·얼마에·언제」를 사람 말로 써요.</p>
            <Textarea
              className="mt-3"
              value={form.summary}
              onChange={(e) => set("summary")(e.target.value)}
              placeholder={"강동구 고덕·강일 지구 국민임대 4개 단지의 예비입주자를 뽑아요.\n소득 70% 이하가 기본이고, 1인 가구는 90%까지 봐줘요."}
            />
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">조건 빌더</h2>
                <p className="mt-1 text-sm text-ink-3">자격요건은 하나라도 미달이면 「조건 미달」. 가점은 순위 안에서 점수로만 반영돼요.</p>
              </div>
              <div className="w-full sm:w-64">
                <Field label="순위 산정 방식" htmlFor="ad-ranking">
                  <Select id="ad-ranking" value={form.ranking} onChange={(e) => set("ranking")(e.target.value as RankingMethod)}>
                    {(Object.keys(RANKING_HINT) as RankingMethod[]).map((k) => <option key={k} value={k}>{k}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
            <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{RANKING_HINT[form.ranking]}</p>
            <div className="mt-4">
              <ConditionBuilder rows={rows} onChange={setRows} />
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <h2 className="text-base font-bold text-ink">게시</h2>
            <p className="mt-1 text-sm text-ink-3">게시하면 조건에 맞는 회원에게 「새 공고」 알림이 나가요.</p>
            <div className="mt-4 grid gap-2">
              <Button type="submit" size="lg">
                <Send size={17} /> 게시하기
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => submit("draft")}>
                <Save size={17} /> 임시저장
              </Button>
            </div>
          </Card>
          <Card className="text-[13px] leading-relaxed text-ink-2">
            <p className="font-bold text-ink">등록 순서</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>공고문 PDF에서 자격요건·배점표를 찾는다.</li>
              <li>자격요건을 먼저 넣고 체험 계정 미리보기로 판정을 확인한다.</li>
              <li>순위 조건과 가점을 넣는다. 유형 템플릿(국민임대·행복주택 등)은 연동 시 제공.</li>
              <li>요약을 쓰고 게시한다.</li>
            </ol>
          </Card>
        </div>
      </form>
    </Container>
  );
}

function FormLoader() {
  const params = useSearchParams();
  const editId = params.get("id");
  const [editing, setEditing] = useState<Announcement | undefined>();
  const [loadingId, setLoadingId] = useState<string | null>(editId);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    fetch(`/api/admin/announcements/${editId}`)
      .then((res) => (res.ok ? res.json() : undefined))
      .then((data) => {
        if (!cancelled) setEditing(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  if (editId && loadingId === editId) {
    return <Container className="py-10 text-ink-3">불러오는 중이에요.</Container>;
  }

  // id가 바뀌면 폼을 새로 마운트해서 초기값을 다시 계산한다
  return <AnnouncementForm key={editId ?? "new"} editing={editId ? editing : undefined} />;
}

export default function NewAnnouncementPage() {
  return (
    <Suspense fallback={<Container className="py-10 text-ink-3">불러오는 중이에요.</Container>}>
      <FormLoader />
    </Suspense>
  );
}
