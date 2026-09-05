import { ButtonLink, Card, Container, Empty } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="py-16">
      <Card>
        <Empty
          title="이 페이지를 찾을 수 없어요"
          body="공고가 내려갔거나 주소가 바뀌었을 수 있어요."
          action={<ButtonLink href="/announcements">공고 목록으로</ButtonLink>}
        />
      </Card>
    </Container>
  );
}
