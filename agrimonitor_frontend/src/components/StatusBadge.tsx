type StatusBadgeTone = "info" | "success" | "warning";

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
};

const toneClassName: Record<StatusBadgeTone, string> = {
  info: "bg-sky-50 text-sky-700 ring-sky-100",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
};

export function StatusBadge({ label, tone = "info" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneClassName[tone]}`}
    >
      {label}
    </span>
  );
}

