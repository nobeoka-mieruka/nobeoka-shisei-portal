interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  /** Use a smaller value size for long strings (e.g. dates) instead of the default large numeral. */
  compact?: boolean;
}

export function StatCard({ label, value, unit, hint, compact = false }: StatCardProps) {
  return (
    <div className="rounded-xl bg-surface-container-low p-4 shadow-e1">
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p
        className={`mt-1 font-bold leading-tight text-on-surface ${compact ? "text-lg" : "text-3xl leading-none"}`}
      >
        {value}
        {unit && <span className="ml-1 text-base font-medium text-on-surface-variant">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}
