import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="max-w-xl">
          <p className="text-[15px] font-bold text-ink">청약순위계산기</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
            판정 결과는 입력한 정보로 계산한 참고용이에요. 최종 자격과 순위는 각 공급기관의 심사로
            정해집니다. 공고 정보 출처: 마이홈포털·LH·SH·청약홈 공공데이터(공공누리 출처표시).
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-ink-2">
          <li><Link href="/" className="hover:text-brand">서비스 소개</Link></li>
          <li><Link href="/tools/income" className="hover:text-brand">소득 구간 계산기</Link></li>
          <li><Link href="/privacy" className="hover:text-brand">개인정보처리방침</Link></li>
          <li><Link href="/terms" className="hover:text-brand">이용약관</Link></li>
          <li><Link href="/admin/announcements" className="hover:text-brand">관리자</Link></li>
        </ul>
      </div>
    </footer>
  );
}
