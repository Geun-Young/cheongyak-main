import type { Metadata } from "next";
import { connection } from "next/server";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileTabBar } from "@/components/MobileTabBar";

export const metadata: Metadata = {
  title: {
    default: "청약순위계산기",
    template: "%s | 청약순위계산기",
  },
  description:
    "LH·SH·GH 등 여러 기관의 공공주택 공고를 한곳에 모으고, 내 조건으로 신청 가능 여부와 예상 순위를 계산합니다.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 목업 데이터가 "오늘" 기준 상대 날짜라, 빌드 시점에 굳히면 서버·클라이언트 값이 어긋난다.
  // 요청 시점에 렌더하도록 한다. 실제 데이터 연동 후에는 페이지별 캐시 전략으로 바꿀 것.
  await connection();
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col pb-16 md:pb-0">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <MobileTabBar />
      </body>
    </html>
  );
}
