import { useLocation } from "react-router-dom";
import publicCommentsData from "../data/publicComments.json";
import type { PublicComment, PublicCommentDataset, PublicCommentStatus } from "../types/publicComment";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SectionCard } from "../components/SectionCard";
import { SourceList } from "../components/SourceList";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { GlobeIcon, LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { useTodayJst } from "../hooks/useTodayJst";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate, SITE_URL } from "../config/site";
import type { CsvColumn } from "../lib/csv";

const dataset = publicCommentsData as PublicCommentDataset;
const entries = dataset.entries as PublicComment[];

/**
 * 市の公表区分をそのまま日本語で表示する。募集期間の日付から状態を計算しない
 * （src/types/publicComment.ts の PublicCommentStatus の説明を参照）。
 */
const STATUS_LABELS: Record<PublicCommentStatus, string> = {
  planned: "意見募集予定",
  open: "意見募集中",
  "closed-preparing-result": "意見募集終了（結果準備中）",
  "result-published": "意見募集終了（結果公表済み）",
  "not-conducted": "意見募集をしなかった案件",
};

/** 表示順。市の「運用状況」一覧と同じ並び（これから→受付中→終了）にする。 */
const STATUS_ORDER: PublicCommentStatus[] = [
  "planned",
  "open",
  "closed-preparing-result",
  "result-published",
  "not-conducted",
];

const STATUS_DESCRIPTIONS: Record<PublicCommentStatus, string> = {
  planned: "延岡市が「意見募集予定の案件」として公表しているものです。",
  open: "延岡市が「意見募集中の案件」として公表しているものです。提出方法・提出先は延岡市の公式ページをご確認ください。",
  "closed-preparing-result": "募集期間が終わり、延岡市が結果を取りまとめている段階として公表しているものです。",
  "result-published":
    "募集期間が終わり、寄せられた意見と市の考え方が延岡市から公表されているものです。意見の本文は当サイトへ転載せず、公式資料へリンクしています。",
  "not-conducted": "パブリックコメント条例の適用除外として、意見募集を行わなかったと延岡市が公表しているものです。",
};

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const PUBLIC_COMMENT_CSV_COLUMNS: CsvColumn<PublicComment>[] = [
  { header: "案件名", value: (e) => e.title },
  { header: "所管課", value: (e) => e.department },
  { header: "募集開始日", value: (e) => e.startDate },
  { header: "募集終了日", value: (e) => e.endDate },
  { header: "市の公表区分", value: (e) => STATUS_LABELS[e.status] },
  { header: "提出者数", value: (e) => (e.submitterCount == null ? "公表なし" : String(e.submitterCount)) },
  { header: "意見数", value: (e) => (e.opinionCount == null ? "公表なし" : String(e.opinionCount)) },
  { header: "公式ページURL", value: (e) => e.officialUrl },
  { header: "対象資料URL", value: (e) => e.documentUrls },
  { header: "結果URL", value: (e) => e.resultUrl ?? "" },
  { header: "公式ページの更新日", value: (e) => e.sourcePageUpdatedAt ?? "" },
  { header: "最終確認日", value: (e) => e.lastVerifiedAt },
  { header: "サイト内URL", value: () => `${SITE_URL}/public-comments` },
];

function ExternalDocumentLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}を新しいタブで開く`}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded py-1 text-sm text-primary underline ${linkClass}`}
    >
      <GlobeIcon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="break-words">{label}</span>
      <span aria-hidden className="text-xs text-on-surface-variant">
        （外部サイト）
      </span>
    </a>
  );
}

function PublicCommentCard({ entry, today }: { entry: PublicComment; today: string | null }) {
  // 状態そのものは市の公表区分（entry.status）から表示する。ここでの日付比較は状態の判定ではなく、
  // 「掲載内容が古くなっている可能性がある」ことをその場で伝えるための補足に限る。
  // ハイドレーション完了後（today !== null）にだけ出すため、プリレンダリング済みHTMLに
  // ビルド日の判定が焼き付くことはない。
  const mayBeOutdated = today != null && entry.status === "open" && today > entry.endDate;

  return (
    <li className="rounded-lg border border-outline-variant p-3">
      <h3 className="text-sm font-semibold text-on-surface">{entry.title}</h3>
      <dl className="mt-2 space-y-1 text-xs leading-relaxed text-on-surface-variant">
        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">意見募集期間</dt>
          <dd>
            ：{formatJapaneseDate(entry.startDate)}〜{formatJapaneseDate(entry.endDate)}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">所管課</dt>
          <dd>：{entry.department}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">市の公表区分</dt>
          <dd>：{STATUS_LABELS[entry.status]}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">提出者数</dt>
          <dd>：{entry.submitterCount == null ? "公表なし（結果公表前）" : `${entry.submitterCount}人`}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">意見数</dt>
          <dd>：{entry.opinionCount == null ? "公表なし（結果公表前）" : `${entry.opinionCount}件`}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">公式ページの更新日</dt>
          <dd>：{entry.sourcePageUpdatedAt ? formatJapaneseDate(entry.sourcePageUpdatedAt) : "記載なし"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">当サイトの最終確認日</dt>
          <dd>：{formatJapaneseDate(entry.lastVerifiedAt)}</dd>
        </div>
      </dl>

      {mayBeOutdated && (
        <p className="mt-2 rounded bg-surface-container p-2 text-xs leading-relaxed text-on-surface-variant">
          この案件は、延岡市の一覧では「意見募集中」に掲載されていますが、掲載されている募集期間の最終日（
          {formatJapaneseDate(entry.endDate)}）は過ぎています。受付が続いているかどうかは当サイトでは判断できませんので、延岡市の公式ページでご確認ください。
        </p>
      )}

      {entry.note && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{entry.note}</p>}

      <ul className="mt-2 space-y-1">
        <li>
          <ExternalDocumentLink href={entry.officialUrl} label="延岡市の案件ページ" />
        </li>
        {entry.documentUrls.map((url, index) => (
          <li key={url}>
            <ExternalDocumentLink
              href={url}
              label={entry.documentUrls.length > 1 ? `意見募集の対象資料（${index + 1}）` : "意見募集の対象資料"}
            />
          </li>
        ))}
        {entry.resultUrl && entry.resultUrl !== entry.officialUrl && (
          <li>
            <ExternalDocumentLink href={entry.resultUrl} label="意見募集の結果（意見と市の考え方）" />
          </li>
        )}
      </ul>

      <div className="mt-2">
        <SourceList sources={entry.sourceRefs} />
      </div>
    </li>
  );
}

export function PublicCommentsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const today = useTodayJst();

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: entries.filter((e) => e.status === status).sort((a, b) => b.startDate.localeCompare(a.startDate)),
  })).filter((g) => g.items.length > 0);

  const coveredLabel = dataset.coveredFiscalYears.join("・");

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">パブリックコメント（意見募集）</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市が計画や条例の案をつくる過程で、市民から意見を募集する手続き（パブリックコメント）の一覧です。
          {coveredLabel}に延岡市が公表した{entries.length}件を、延岡市公式ホームページの「運用状況」一覧に基づいて整理しています。
        </p>
      </div>

      <div className="mb-5 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        <p>
          各案件が「意見募集中」なのか「終了して結果が公表済み」なのかは、延岡市が公表している区分をそのまま掲載しています。当サイトが募集期間の日付から自動で判定することはありません。市の一覧ページの更新日は
          {formatJapaneseDate(dataset.statusSourceUpdatedAt)}、当サイトが最後に確認した日は
          {formatJapaneseDate(dataset.lastVerifiedAt)}です。
        </p>
        <p className="mt-2">
          意見の提出方法・提出先・様式は延岡市の公式ページに掲載されています。当サイトから意見を提出することはできません。提出された意見の本文と市の考え方も転載せず、公式資料へのリンクで案内しています。
        </p>
        <div className="mt-2">
          <SourceList sources={[dataset.statusSource]} />
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <CsvDownloadButton
          filename="nobeoka-public-comments.csv"
          rows={entries}
          columns={PUBLIC_COMMENT_CSV_COLUMNS}
        />
      </div>

      {grouped.map(({ status, items }) => (
        <SectionCard key={status} title={`${STATUS_LABELS[status]}（${items.length}件）`} className="mb-4">
          <p className="text-xs leading-relaxed text-on-surface-variant">{STATUS_DESCRIPTIONS[status]}</p>
          <ul className="mt-3 grid grid-cols-1 gap-3">
            {items.map((entry) => (
              <PublicCommentCard key={entry.id} entry={entry} today={today} />
            ))}
          </ul>
        </SectionCard>
      ))}

      <SectionCard title="このページの収録範囲" className="mb-4">
        <p className="text-xs leading-relaxed text-on-surface-variant">{dataset.note}</p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          収録しているのは{coveredLabel}分です。過年度の実施結果は延岡市公式ホームページに掲載されています。
        </p>
      </SectionCard>

      <LastUpdated
        className="mt-4"
        dataAsOfLabel="掲載データの最終確認日"
        dataAsOf={formatJapaneseDate(dataset.lastVerifiedAt)}
      />

      <div className="mt-4">
        <CorrectionRequestButton pageName="パブリックコメント（意見募集）" />
      </div>
    </div>
  );
}
