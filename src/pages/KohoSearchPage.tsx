import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  kohoOcrSearchIndex,
  searchKohoOcrIndex,
  kohoSearchAvailableYears,
  KOHO_SEARCH_CATEGORY_LABEL,
} from "../lib/kohoSearch";
import type { KohoOcrSearchEntry } from "../types/kohoSearch";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const EXAMPLE_KEYWORDS = ["市長選", "実質公債費比率", "新庁舎", "合併", "決算", "市議会議員"];

type CategoryFilter = "all" | KohoOcrSearchEntry["category"];

function formatIssueDate(issueDate: string | null): string {
  if (!issueDate) return "発行年月確認中";
  const [y, m] = issueDate.split("-");
  return `${y}年${Number(m)}月号`;
}

export function KohoSearchPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>("all");

  const availableYears = useMemo(() => kohoSearchAvailableYears(), []);
  const issueCount = useMemo(() => new Set(kohoOcrSearchIndex.map((e) => e.issueId)).size, []);

  const results = useMemo(
    () =>
      searchKohoOcrIndex(query, {
        category: category === "all" ? undefined : category,
        verifiedOnly,
        yearFrom: yearFilter === "all" ? undefined : Number(yearFilter),
        yearTo: yearFilter === "all" ? undefined : Number(yearFilter),
      }),
    [query, category, verifiedOnly, yearFilter],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">広報のべおか　文字起こし検索（試験版）</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          広報のべおかバックナンバーのPDFを、当サイトがWindowsのOCR機能・PDF内蔵テキストの抽出で文字起こしした結果から、あらかじめ定めたキーワードに一致した箇所を検索できます。対象：{issueCount}号分。
        </p>
      </div>

      <div className="rounded-xl border-2 border-tertiary/60 bg-tertiary-container/30 p-4 text-sm leading-relaxed text-on-surface">
        <p className="font-semibold">この検索結果はOCR（文字認識）による文字起こしを含みます。原資料（PDF）と内容が異なる場合があります。</p>
        <p className="mt-2">
          「確認済み」と表示された記事は、当サイト運営者が元のPDF画像と照合し内容を確認したものです。それ以外（「OCR未確認」）は、機械的な文字起こしをそのまま検索対象にしたもので、人名・数字等が誤って認識されている可能性があります。重要な情報は、必ず元のPDF（各結果からリンク）でご確認ください。
        </p>
      </div>

      <SectionCard title="キーワード検索">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例：市長選、実質公債費比率、新庁舎、令和6年"
          aria-label="広報のべおか文字起こし検索"
          className={`w-full rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant ${linkClass}`}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_KEYWORDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setQuery(k)}
              className={`rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant transition hover:bg-surface-container ${linkClass}`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            カテゴリ
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              className={`rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-sm text-on-surface ${linkClass}`}
            >
              <option value="all">すべて</option>
              {(Object.keys(KOHO_SEARCH_CATEGORY_LABEL) as KohoOcrSearchEntry["category"][]).map((c) => (
                <option key={c} value={c}>
                  {KOHO_SEARCH_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            発行年
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className={`rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-sm text-on-surface ${linkClass}`}
            >
              <option value="all">すべて</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-sm text-on-surface">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className={`h-4 w-4 ${linkClass}`}
            />
            確認済みのみ
          </label>
        </div>
      </SectionCard>

      {query.trim() === "" ? (
        <EmptyState message="キーワードを入力するか、上の例から選んでください。" />
      ) : results.length === 0 ? (
        <EmptyState message={`「${query}」に一致する結果は見つかりませんでした。`} />
      ) : (
        <SectionCard title={`検索結果（${results.length}件）`}>
          <ul className="space-y-3">
            {results.slice(0, 100).map((r: KohoOcrSearchEntry, i: number) => (
              <li key={`${r.issueId}-${r.page}-${r.keyword}-${i}`} className="rounded-lg bg-surface-container-low p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-on-surface">
                    {formatIssueDate(r.issueDate)}　p.{r.page}
                  </span>
                  <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs text-on-primary-container">
                    {KOHO_SEARCH_CATEGORY_LABEL[r.category]}
                  </span>
                  {r.verificationStatus === "verified" ? (
                    <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-semibold text-on-tertiary-container">
                      確認済み
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface-variant">
                      OCR未確認
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                  …{r.context}…
                </p>
                {r.verificationStatus !== "verified" && (
                  <p className="mt-1 text-xs text-on-surface-variant/80">
                    OCRによる文字起こしのため誤認識を含む可能性があります。
                  </p>
                )}
                {r.sourcePdf && (
                  <a
                    href={r.sourcePdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-1 inline-block text-xs text-primary underline ${linkClass}`}
                  >
                    元のPDFを見る
                  </a>
                )}
              </li>
            ))}
          </ul>
          {results.length > 100 && (
            <p className="mt-3 text-xs text-on-surface-variant">結果が多いため、上位100件のみ表示しています。キーワードを絞り込んでください。</p>
          )}
        </SectionCard>
      )}

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        広報のべおかは2010年4月号以降のPDFを対象としています（それ以前の号は市公式サイトに掲載がなく確認できていません）。文字起こしは段階的に進めており、全号を網羅しているわけではありません。詳しい進捗は
        {" "}
        <a href="/data-status" className={`text-primary underline ${linkClass}`}>
          データ収録状況
        </a>
        {" "}をご覧ください。
      </p>

      <LastUpdated className="mt-4" />
    </div>
  );
}
