import type { Metadata } from "next";
import { Card, Container, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "이용약관" };

export default function TermsPage() {
  return (
    <Container className="max-w-3xl py-6 md:py-10">
      <PageTitle title="이용약관" lead="초안이에요. 서비스 오픈 전 법률 검토를 거쳐 확정해요." />
      <Card className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink-2">
        <section>
          <h2 className="text-base font-bold text-ink">서비스의 성격</h2>
          <p className="mt-1">청약순위계산기는 공공기관이 공개한 공고 정보를 모아 보여주고, 이용자가 입력한 정보로 신청 가능 여부와 예상 순위를 계산해 주는 정보 서비스예요. 청약 신청을 대행하거나 당첨을 보장하지 않아요.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-ink">판정 결과의 한계</h2>
          <p className="mt-1">판정은 이용자가 입력한 정보와 운영자가 정리한 조건으로 계산한 참고 자료예요. 최종 자격과 순위는 각 공급기관의 심사로 정해지며, 정리한 내용과 공고문이 다르면 공고문이 우선해요.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-ink">공고 정보의 출처</h2>
          <p className="mt-1">마이홈포털, LH, SH, 한국부동산원 청약홈 등이 공공데이터포털에 개방한 자료를 사용하며, 공공누리 출처표시 조건을 따라요.</p>
        </section>
      </Card>
    </Container>
  );
}
