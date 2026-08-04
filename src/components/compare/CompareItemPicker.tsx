import { MAX_COMPARE_ITEMS } from "../../lib/archiveCompare";
import type { CompareOption } from "../../types/compare";

export type { CompareOption as CompareItemOption } from "../../types/compare";

interface CompareItemPickerProps {
  legend: string;
  options: CompareOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}

/**
 * 比較対象（年度・市長など）を最大件数までチェックボックスで選ぶ共通コンポーネント。
 * 選択順を保つため、配列の末尾に追加・任意の位置を除去する形で管理する。
 */
export function CompareItemPicker({ legend, options, selected, onChange, max = MAX_COMPARE_ITEMS }: CompareItemPickerProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
      return;
    }
    if (selected.length >= max) return;
    onChange([...selected, id]);
  };

  return (
    <fieldset>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-medium text-on-surface">
          {legend}（最大{max}件まで選択できます。現在{selected.length}件選択中）
        </legend>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-full px-2 py-1 text-xs text-on-surface-variant underline hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            選択をすべて解除
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.id);
          const disabled = !checked && selected.length >= max;
          return (
            <label
              key={opt.id}
              className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
                checked
                  ? "border-primary bg-primary-container text-on-primary-container"
                  : "border-outline-variant bg-surface text-on-surface"
              } ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface-container-low"}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(opt.id)}
              />
              <span>
                {opt.label}
                {opt.sublabel ? <span className="ml-1 text-xs text-on-surface-variant">{opt.sublabel}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {options.length === 0 && <p className="text-sm text-on-surface-variant">選択できるデータがまだ登録されていません。</p>}
    </fieldset>
  );
}
