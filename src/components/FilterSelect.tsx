interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

/**
 * Phase192：
 * - `min-h-11`（44px）でタップ領域の最小サイズを確保する。
 * - `max-w-full` + `min-w-0` + `truncate` により、選択肢の文字列が長い場合に
 *   ネイティブselectの固有幅が画面幅を超えて右方向へはみ出すのを防ぐ
 *   （320px幅で最大208pxのはみ出しを実測していた）。
 */
export function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="flex min-h-11 max-w-full shrink-0 items-stretch gap-2 rounded-full bg-surface-container-high px-4 text-sm text-on-surface-variant shadow-e1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="min-w-0 max-w-full truncate bg-transparent text-on-surface focus:outline-none"
      >
        <option value="all">{label}：すべて</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
