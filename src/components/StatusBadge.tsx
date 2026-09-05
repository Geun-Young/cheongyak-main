import { AlertTriangle, CheckCircle2, HelpCircle, Lock } from "lucide-react";
import type { EligibilityStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/matching";
import { Chip } from "./ui";

const ICON = {
  eligible: CheckCircle2,
  ineligible: AlertTriangle,
  needs_review: HelpCircle,
  closed: Lock,
} as const;

export function StatusBadge({ status, size = "md" }: { status: EligibilityStatus; size?: "sm" | "md" }) {
  const meta = STATUS_META[status];
  const Icon = ICON[status];
  return (
    <Chip tone={meta.tone} size={size}>
      <Icon size={size === "sm" ? 13 : 15} strokeWidth={2.4} />
      {meta.label}
    </Chip>
  );
}
