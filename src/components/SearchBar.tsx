import { SearchIcon } from "./icons";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "議員名で検索" }: SearchBarProps) {
  return (
    <label className="flex items-center gap-3 rounded-full bg-surface-container-high px-4 py-3 shadow-e1 transition focus-within:shadow-e2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      <SearchIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full min-w-0 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
      />
    </label>
  );
}
