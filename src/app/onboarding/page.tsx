import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "내 정보 입력" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Container className="py-10 text-ink-3">불러오는 중이에요.</Container>}>
      <OnboardingFlow />
    </Suspense>
  );
}
