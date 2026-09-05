import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bell, BellRing, ListChecks, SlidersHorizontal } from "lucide-react";
import hero from "../../public/hero-living.webp";
import { ANNOUNCEMENTS, getAnnouncement } from "@/lib/mock/announcements";
import { DEMO_PROFILE, deriveFacts } from "@/lib/profile-data";
import { matchAnnouncement } from "@/lib/matching";
import { daysLeft } from "@/lib/format";
import { QuickFilter } from "@/components/QuickFilter";
import { AnnouncementRow } from "@/components/AnnouncementRow";
import { StatusBadge } from "@/components/StatusBadge";
import { ButtonLink, Card, Container } from "@/components/ui";

const STEPS = [
  { Icon: SlidersHorizontal, title: "조건 5개 고르기", body: "사는 곳, 나이, 소득, 결혼, 집 유무. 30초면 돼요." },
  { Icon: ListChecks, title: "가능한 공고만 보기", body: "신청할 수 있는 공고에 초록 표시. 안 되면 이유도 알려줘요." },
  { Icon: BellRing, title: "마감 전 알림 받기", body: "가입하면 마감 3일 전과 1일 전에 알려드려요." },
];

const FAQ = [
  {
    q: "무료인가요?",
    a: "네. 공고 보기와 판정은 무료예요. 가입도 무료이고, 가입하면 조건이 저장되고 알림을 받을 수 있어요.",
  },
  {
    q: "제 정보는 어디에 저장되나요?",
    a: "가입 전엔 어디에도 저장하지 않아요. 지금 이 화면에서 고른 조건은 이 브라우저 탭에서만 쓰고 닫으면 사라져요. 가입 후에도 소득은 금액이 아니라 구간(예: 100% 이하)만 저장해요.",
  },
  {
    q: "판정은 얼마나 정확한가요?",
    a: "공고문의 자격 요건을 그대로 옮겨 계산해요. 다만 최종 자격은 LH·SH 같은 공급기관이 세대원 전체의 소득·자산을 심사해서 정하니, 참고용으로 보고 공고문 원문을 꼭 확인하세요.",
  },
  {
    q: "어떤 공고가 올라오나요?",
    a: "LH, SH(서울), GH(경기), iH(인천), 부산도시공사 등의 국민임대·행복주택·매입임대·전세임대·장기전세·청년안심주택·공공분양 공고예요. 공공데이터를 매일 여러 번 가져와요.",
  },
];

export default function LandingPage() {
  const open = ANNOUNCEMENTS.filter((a) => a.status === "published" && daysLeft(a.applyEnd) >= 0);
  const upcoming = [...open].sort((a, b) => daysLeft(a.applyEnd) - daysLeft(b.applyEnd)).slice(0, 3);

  const facts = deriveFacts(DEMO_PROFILE);
  const samples = ["lh-gangdong-national-2026-2", "sh-purchase-2026-3", "lh-hanam-gamil-happy"]
    .map((id) => getAnnouncement(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ a, r: matchAnnouncement(a, facts) }));

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <Image
          src={hero}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[68%_50%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 to-white/55 md:from-white/92 md:via-white/70 md:to-white/10"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ground to-transparent" />

        <Container className="relative pb-36 pt-12 md:pb-44 md:pt-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/80 px-3.5 py-1.5 text-[13px] font-semibold text-ink-2 backdrop-blur">
              지금 접수 중인 공고 <span className="text-brand tnum">{open.length}</span>건
              <span aria-hidden className="h-3 w-px bg-line-strong" />
              LH · SH · GH · 청약홈 한곳에
            </p>
            <h1 className="mt-5 text-[32px] font-extrabold leading-[1.18] text-ink md:text-[48px]">
              나에게 맞는 공공주택 공고,
              <br />
              고르기만 하면 찾아드려요.
            </h1>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2 md:text-[19px]">
              여러 기관에 흩어진 임대·분양 공고를 매일 모아요. 내 조건을 고르면 신청할 수 있는 공고만 골라 보여주고,
              몇 순위인지도 계산해 드려요.
            </p>

            <ol className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
              {STEPS.map(({ Icon, title, body }, i) => (
                <li
                  key={title}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/70 bg-white/85 p-3 text-center shadow-card backdrop-blur sm:flex-row sm:items-start sm:gap-3 sm:p-4 sm:text-left"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-white sm:size-11">
                    <Icon size={22} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold text-brand tnum sm:text-[13px]">{i + 1}단계</span>
                    <span className="block text-[14px] font-bold leading-snug text-ink sm:text-[16px]">{title}</span>
                    <span className="mt-0.5 hidden text-[13px] leading-snug text-ink-2 sm:block">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <Container className="relative z-10 -mt-28 md:-mt-32">
        <Card id="quick" className="scroll-mt-24 border-brand/20 shadow-pop md:p-8">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[22px] font-extrabold text-ink md:text-2xl">1단계. 다섯 가지만 골라 주세요</p>
              <p className="mt-1 text-[15px] text-ink-3">가입 없이 바로 결과가 나와요. 정확하지 않아도 괜찮아요, 나중에 고칠 수 있어요.</p>
            </div>
            <Link href="/login" className="inline-flex items-center gap-1 text-[15px] font-semibold text-brand hover:underline">
              이미 가입했어요 <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-6">
            <QuickFilter size="lg" />
          </div>
        </Card>
      </Container>

      <Container className="py-14 md:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[24px] font-extrabold text-ink md:text-[30px]">2단계. 결과는 이렇게 보여요</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-ink-2">
            공고마다 색으로 표시돼요. 초록이면 신청할 수 있고, 주황이면 어떤 조건이 안 맞는지 적혀 있어요. 파랑은
            아직 조건을 정리하는 중이라는 뜻이에요.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <StatusBadge status="eligible" />
          <StatusBadge status="ineligible" />
          <StatusBadge status="needs_review" />
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <p className="border-b border-line bg-surface-2 px-4 py-2.5 text-[13px] text-ink-3 md:px-5">
            예시: 서울 사는 32세 1인 가구, 소득 100% 이하, 무주택, 청약통장 78회 납입
          </p>
          <ul className="divide-y divide-line">
            {samples.map(({ a, r }) => (
              <li key={a.id}>
                <AnnouncementRow a={a} result={r} />
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <section className="border-y border-line bg-surface">
        <Container className="py-14 md:py-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-extrabold text-ink md:text-[30px]">곧 마감되는 공고</h2>
              <p className="mt-2 text-[16px] text-ink-2">위에서 조건을 고르면 이 공고들에도 판정이 붙어요.</p>
            </div>
            <Link href="/announcements" className="inline-flex shrink-0 items-center gap-1 text-[15px] font-semibold text-brand hover:underline">
              전체 보기 <ArrowRight size={16} />
            </Link>
          </div>
          <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {upcoming.map((a) => (
              <li key={a.id}>
                <AnnouncementRow a={a} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="py-14 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div>
            <h2 className="text-[24px] font-extrabold text-ink md:text-[30px]">자주 묻는 질문</h2>
            <ul className="mt-5 divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
              {FAQ.map((f) => (
                <li key={f.q}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[17px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ground text-ink-3 transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="px-5 pb-5 text-[16px] leading-relaxed text-ink-2">{f.a}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-brand p-6 text-white shadow-card">
              <div className="flex items-center gap-2">
                <Bell size={22} />
                <p className="text-[19px] font-bold">3단계. 가입하면 알림이 와요</p>
              </div>
              <ul className="mt-3 space-y-2 text-[16px] leading-relaxed text-white/90">
                <li>조건을 한 번만 저장하면 새 공고가 올라올 때마다 자동으로 판정해요.</li>
                <li>신청할 수 있는 공고가 마감 3일 전, 1일 전이면 알려드려요.</li>
                <li>관심 공고를 모아두고 순위·가점 내역을 언제든 다시 봐요.</li>
              </ul>
              <ButtonLink href="/signup" variant="inverse" size="lg" className="mt-5 w-full">
                카카오로 3초 만에 시작
              </ButtonLink>
            </div>
            <Card>
              <p className="text-[17px] font-bold text-ink">소득이 어느 구간인지 모르겠다면</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
                월 건강보험료만 넣으면 구간을 계산해 드려요. 금액은 저장하지 않아요.
              </p>
              <ButtonLink href="/tools/income" variant="secondary" className="mt-4 w-full">
                소득 구간 계산하기
              </ButtonLink>
            </Card>
          </div>
        </div>
      </Container>
    </>
  );
}
