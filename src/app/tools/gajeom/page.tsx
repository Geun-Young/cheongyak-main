import type { Metadata } from "next";
import { DepositTable, GajeomCalculator } from "@/components/GajeomCalculator";
import { ButtonLink, Card, Container, PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "청약 가점 계산기",
  description: "무주택 기간·부양가족·청약통장 가입 기간으로 민영 아파트 청약 가점(84점)을 계산하고, 1순위 예치금을 확인해요.",
};

const RULES = [
  {
    max: 32,
    title: "무주택 기간",
    body: "1년 미만 2점, 이후 1년마다 2점씩 올라 15년 이상이면 32점이에요. 만 30세부터 세고, 그 전에 결혼했다면 혼인신고일부터 세요.",
  },
  {
    max: 35,
    title: "부양가족",
    body: "0명 5점, 1명마다 5점씩 올라 6명 이상이면 35점이에요. 배우자, 자녀, 3년 넘게 같은 등본에 올라 있는 부모님이 들어가요.",
  },
  {
    max: 17,
    title: "청약통장 가입 기간",
    body: "6개월 미만 1점, 6개월~1년 2점, 이후 1년마다 1점씩 올라 15년 이상이면 17점이에요. 배우자 통장은 절반(최대 3점)을 더해요.",
  },
];

export default function GajeomToolPage() {
  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title="청약 가점 계산기"
        lead="민영 아파트 일반공급은 1순위 안에서 가점이 높은 순서로 뽑아요. 세 가지만 움직여 보면 내 점수가 나와요. 입력한 값은 어디에도 저장하지 않아요."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <GajeomCalculator />
        <DepositTable />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {RULES.map((r) => (
          <Card key={r.title}>
            <p className="text-[12px] font-bold text-brand tnum">최대 {r.max}점</p>
            <p className="mt-1 text-[16px] font-bold text-ink">{r.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{r.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 border-brand/30 bg-brand-tint">
        <p className="text-[17px] font-bold text-ink">공공임대는 가점이 아니라 순위로 뽑아요</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
          국민임대·행복주택 같은 공공임대는 공고마다 순위와 배점표가 달라요. 공고를 열면 내 조건으로 순위와 배점을 따로 계산해 드려요.
        </p>
        <ButtonLink href="/announcements" variant="secondary" className="mt-4">
          공고 찾기
        </ButtonLink>
      </Card>
    </Container>
  );
}
