import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nobeoka-shisei-portal:search-history";
const MAX_ITEMS = 5;

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(items: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorageが使えない環境（プライベートモード等）では保存をあきらめる。
  }
}

/**
 * 検索履歴を端末内（localStorage）だけに保存するフック。個人情報や検索結果の内容は保存せず、
 * 入力した検索語の文字列のみを最大5件、外部へは送信しない。
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const addTerm = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((t) => t !== trimmed)].slice(0, MAX_ITEMS);
      writeHistory(next);
      return next;
    });
  }, []);

  const removeTerm = useCallback((term: string) => {
    setHistory((prev) => {
      const next = prev.filter((t) => t !== term);
      writeHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    writeHistory([]);
  }, []);

  return { history, addTerm, removeTerm, clearHistory };
}
