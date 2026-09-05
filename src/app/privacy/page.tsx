import type { Metadata } from "next";
import { Card, Container, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "개인정보처리방침" };

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-6 md:py-10">
      <PageTitle title="개인정보처리방침" lead="초안이에요. 서비스 오픈 전 법률 검토를 거쳐 확정해요." />
      <Card className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink-2">
        <section>
          <h2 className="text-base font-bold text-ink">수집하는 항목</h2>
          <p className="mt-1">생년월일, 거주 지역과 거주 시작일, 혼인 상태, 가구원 수, 자녀 수, 주택 소유 여부, 소득 구간, 총자산과 자동차가액, 청약통장 정보(종류·가입일·납입 횟수·납입 총액), 알림 수신 설정.</p>
          <p className="mt-1">소득은 금액이 아니라 구간(예: 100% 이하)만 저장해요. 소득 구간 계산기에 입력한 건강보험료·소득 금액은 저장하지 않아요.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-ink">쓰는 목적</h2>
          <p className="mt-1">공고별 신청 가능 여부와 예상 순위 계산, 마감·새 공고 알림 발송. 이 밖의 목적으로는 쓰지 않아요.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-ink">보관과 삭제</h2>
          <p className="mt-1">회원 탈퇴 즉시 삭제해요. 비회원 빠른 필터 입력값은 서버로 보내지 않고 브라우저 탭을 닫으면 사라져요.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-ink">알림에 담기는 정보</h2>
          <p className="mt-1">이름(호칭)과 공고명, 남은 일수만 담아요. 소득 구간 등 판정 근거는 알림에 넣지 않아요.</p>
        </section>
      </Card>
    </Container>
  );
}
