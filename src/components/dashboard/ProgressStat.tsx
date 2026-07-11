interface ProgressStatProps {
  label: string;
  count: number;
  total: number;
}

export function ProgressStat({ label, count, total }: ProgressStatProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="text-on-surface">{label}</span>
        <span className="shrink-0 font-medium text-on-surface-variant">
          {count}/{total}人（{pct}%）
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
