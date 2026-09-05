import type { Metadata } from "next";
import { IncomeCalculator } from "@/components/IncomeCalculator";
import { Card, Container, PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "소득 구간 계산기",
  description: "월 건강보험료만 넣으면 도시근로자 월평균소득 대비 내 소득 구간을 계산해요.",
};

export default function IncomeToolPage() {
  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title="소득 구간 계산기"
        lead="공고에 적힌 「도시근로자 월평균소득의 100% 이하」가 나한테 해당되는지, 월 건강보험료 하나로 계산해요. 금액은 어디에도 저장하지 않아요."
      />
      <Card className="mt-6">
        <IncomeCalculator />
      </Card>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            level: "지금",
            title: "건강보험료로 역산",
            body: "직장가입자는 보험료가 보수월액에 비례해서 오차가 1% 안쪽이에요. 지역가입자는 재산이 섞여 있어 추정치예요.",
          },
          {
            level: "다음",
            title: "납부확인서 사진으로 자동 입력",
            body: "The건강보험 앱이나 정부24에서 받은 납부확인서를 올리면 보험료를 읽어 자동으로 채워요. 원본은 바로 지워요.",
          },
          {
            level: "이후",
            title: "공공 마이데이터로 직접 확인",
            body: "동의만 하면 건강보험료 납부확인서·소득금액증명을 행정안전부 API로 받아와요. 기관 심사 자료와 같은 값이에요.",
          },
        ].map((s) => (
          <Card key={s.title}>
            <p className="text-[12px] font-bold text-brand">{s.level}</p>
            <p className="mt-1 text-[16px] font-bold text-ink">{s.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{s.body}</p>
          </Card>
        ))}
      </div>
    </Container>
  );
}
