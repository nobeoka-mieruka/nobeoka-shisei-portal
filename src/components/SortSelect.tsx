import { SortIcon } from "./icons";

export type SortKey = "kana" | "ageAsc" | "ageDesc" | "termAsc" | "termDesc" | "faction";

const options: { value: SortKey; label: string }[] = [
  { value: "kana", label: "五十音順" },
  { value: "ageAsc", label: "年齢が若い順" },
  { value: "ageDesc", label: "年齢が高い順" },
  { value: "termAsc", label: "当選回数が少ない順" },
  { value: "termDesc", label: "当選回数が多い順" },
  { value: "faction", label: "会派順" },
];

interface SortSelectProps {
  value: SortKey;
  onChange: (value: SortKey) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <label className="flex min-h-11 max-w-full shrink-0 items-stretch gap-2 rounded-full bg-surface-container-high px-4 text-sm text-on-surface-variant shadow-e1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      <SortIcon className="h-4 w-4 shrink-0 self-center" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        aria-label="並び替え"
        className="min-w-0 max-w-full truncate bg-transparent text-on-surface focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
