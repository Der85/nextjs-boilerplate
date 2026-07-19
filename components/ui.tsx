import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "ok"
      ? "text-ok"
      : tone === "warn"
        ? "text-warn"
        : tone === "bad"
          ? "text-bad"
          : "text-text";
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className={`text-2xl font-semibold ${toneClass}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
}

export function PageHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold text-text">{title}</h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}

// Days-left badge colour: red < 7, amber 7–14, green otherwise.
export function stockTone(daysLeft: number | null): "ok" | "warn" | "bad" {
  if (daysLeft === null) return "ok";
  if (daysLeft < 7) return "bad";
  if (daysLeft <= 14) return "warn";
  return "ok";
}

export function DaysBadge({ daysLeft }: { daysLeft: number | null }) {
  const tone = stockTone(daysLeft);
  const cls =
    tone === "bad"
      ? "bg-bad/15 text-bad"
      : tone === "warn"
        ? "bg-warn/15 text-warn"
        : "bg-ok/15 text-ok";
  const label =
    daysLeft === null ? "—" : `${Math.max(0, Math.floor(daysLeft))}d left`;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
