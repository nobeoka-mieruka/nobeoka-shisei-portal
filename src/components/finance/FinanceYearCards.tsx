import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export interface FinanceYearCardField<T> {
  /** カード内に表示する指標名（例：「地方債現在高」）。 */
  label: string;
  value: (row: T) => number | null;
  /** 非nullの値を「123.4億円」のように単位込みで整形する。単位を別列・別バッジにはしない。 */
  format: (value: number) => string;
  /** 値のわきに添える短い注記（例：「見込額」）。長文にしない。 */
  note?: (row: T) => string | null | undefined;
}

interface FinanceYearCardsProps<T> {
  /** スクリーンリーダー向けの一覧タイトル。 */
  caption: string;
  years: T[];
  getYear: (row: T) => number;
  rowKey: (row: T) => string;
  fields: FinanceYearCardField<T>[];
  detailHref: (row: T) => string;
  detailLabel?: string;
}

type CardStatus = "confirmed" | "partial" | "unconfirmed";

const STATUS_LABEL: Record<CardStatus, string> = {
  confirmed: "確認済み",
  partial: "一部確認済み",
  unconfirmed: "未確認",
};

const STATUS_STYLE: Record<CardStatus, string> = {
  confirmed: "bg-tertiary-container text-on-tertiary-container",
  partial: "bg-secondary-container text-on-secondary-container",
  unconfirmed: "border border-outline-variant text-on-surface-variant",
};

function eraOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/**
 * 年度ごとに複数の財政指標をまとめて表示するカード一覧。
 * 市民が数秒で「年度・金額・指標・確認状況」を把握できることを優先し、
 * 定義・出典等の長文は一覧に出さず、年度詳細ページ（/timeline/:year）へのリンクに任せる。
 * 年度が多い場合に備え、年代フィルターと「確認済みのみ表示」フィルターを内蔵する。
 */
export function FinanceYearCards<T>({ caption, years, getYear, rowKey, fields, detailHref, detailLabel = "詳細を見る" }: FinanceYearCardsProps<T>) {
  const eras = useMemo(() => {
    const set = new Set(years.map((y) => eraOf(getYear(y))));
    return Array.from(set).sort((a, b) => b - a);
  }, [years, getYear]);

  const [era, setEra] = useState<number | "all">("all");
  const [confirmedOnly, setConfirmedOnly] = useState(false);

  const statusOf = (row: T): CardStatus => {
    const nonNullCount = fields.filter((f) => f.value(row) != null).length;
    if (nonNullCount === 0) return "unconfirmed";
    if (nonNullCount === fields.length) return "confirmed";
    return "partial";
  };

  const filtered = years.filter((y) => {
    if (era !== "all" && eraOf(getYear(y)) !== era) return false;
    if (confirmedOnly && statusOf(y) !== "confirmed") return false;
    return true;
  });

  return (
    <div>
      {eras.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="年代で絞り込む">
          <button
            type="button"
            onClick={() => setEra("all")}
            className={`min-h-[44px] rounded-full px-3 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              era === "all" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
            aria-pressed={era === "all"}
          >
            すべて
          </button>
          {eras.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEra(e)}
              className={`min-h-[44px] rounded-full px-3 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                era === e ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
              aria-pressed={era === e}
            >
              {e}年代
            </button>
          ))}
        </div>
      )}

      <label className="mb-3 flex min-h-[44px] w-fit items-center gap-2 text-sm text-on-surface">
        <input
          type="checkbox"
          checked={confirmedOnly}
          onChange={(e) => setConfirmedOnly(e.target.checked)}
          className="h-4 w-4 rounded border-outline-variant text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        確認済みデータのみ表示
      </label>

      {filtered.length === 0 ? (
        <p className="rounded-lg bg-surface-container-high p-3 text-sm text-on-surface-variant">
          該当する年度がありません。絞り込み条件を変更してください。
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={caption}>
          {filtered.map((row) => {
            const status = statusOf(row);
            return (
              <li key={rowKey(row)} className="rounded-lg border border-outline-variant bg-surface-container p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-on-surface">{getYear(row)}年度</span>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <dl className="mt-3 space-y-3">
                  {fields.map((f) => {
                    const v = f.value(row);
                    const note = f.note?.(row);
                    return (
                      <div key={f.label}>
                        <dt className="text-xs text-on-surface-variant">{f.label}</dt>
                        <dd className="mt-0.5 [font-variant-numeric:tabular-nums]">
                          {v != null ? (
                            <>
                              <span className="text-lg font-bold text-on-surface">{f.format(v)}</span>
                              {note && <span className="ml-1 text-xs text-on-surface-variant">（{note}）</span>}
                            </>
                          ) : (
                            <>
                              <span className="text-lg font-bold text-on-surface-variant" aria-hidden>
                                —
                              </span>
                              <span className="ml-1.5 text-xs text-on-surface-variant">未確認</span>
                            </>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <Link
                  to={detailHref(row)}
                  className="mt-3 inline-flex min-h-[44px] items-center text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {detailLabel} →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
