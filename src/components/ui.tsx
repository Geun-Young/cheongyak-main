import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "kakao" | "danger" | "inverse";
type ButtonSize = "sm" | "md" | "lg";

const variantCls: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-brand-soft hover:text-brand",
  kakao: "bg-kakao text-kakao-ink hover:brightness-95",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
  inverse: "bg-white text-brand hover:bg-brand-tint",
};

const sizeCls: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

const baseBtn =
  "inline-flex items-center justify-center rounded-md font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={cx(baseBtn, variantCls[variant], sizeCls[size], className)}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
  external,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls = cx(baseBtn, variantCls[variant], sizeCls[size], className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function Card({
  className,
  children,
  padded = true,
  id,
}: {
  className?: string;
  children: ReactNode;
  padded?: boolean;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cx(
        "rounded-xl bg-surface border border-line shadow-card",
        padded && "p-5 md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Tone = "ok" | "warn" | "info" | "muted" | "brand" | "danger";
const toneCls: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  muted: "bg-ground text-ink-3",
  brand: "bg-brand-soft text-brand",
  danger: "bg-danger-soft text-danger",
};

export function Chip({
  tone = "muted",
  className,
  children,
  size = "md",
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm font-semibold whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-xs" : "h-8 px-3 text-sm",
        toneCls[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const controlBase =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx("ui-select h-11", controlBase, className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx("h-11", controlBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cx(controlBase, "min-h-28 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && <div className="text-[13px] text-ink-3 leading-snug">{hint}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <span>
        <span className="block font-medium text-ink">{label}</span>
        {description && <span className="block text-[13px] text-ink-3">{description}</span>}
      </span>
      <span
        className={cx(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "inline-block size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  name,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex w-fit max-w-full flex-wrap rounded-md border border-line-strong bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-9 rounded-sm px-3 text-sm font-semibold transition-colors",
            value === o.value ? "bg-brand text-white" : "text-ink-2 hover:bg-brand-soft hover:text-brand",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      {body && <p className="max-w-md text-ink-3">{body}</p>}
      {action}
    </div>
  );
}

export function PageTitle({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-[28px]">{title}</h1>
        {lead && <p className="mt-1.5 max-w-2xl text-ink-3">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-6xl px-4 md:px-6", className)}>{children}</div>;
}
