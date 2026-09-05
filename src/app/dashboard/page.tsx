import type { Metadata } from "next";
import { DashboardView } from "@/components/DashboardView";

export const metadata: Metadata = { title: "홈" };

export default function DashboardPage() {
  return <DashboardView />;
}
