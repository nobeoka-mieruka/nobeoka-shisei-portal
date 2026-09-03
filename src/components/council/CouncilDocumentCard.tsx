import { useState } from "react";
import type { CouncilDocument } from "../../types";
import { councilDocumentCategoryLabels } from "../../lib/councilDocuments";
import { formatJapaneseDate } from "../../config/site";
import { DocumentIcon, GlobeIcon } from "../icons";
import { humanizeDataNote } from "../../lib/citizenTermLabels";

const buttonFocusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function safeFormatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  try {
    return formatJapaneseDate(iso);
  } catch {
    return undefined;
  }
}

export function CouncilDocumentCard({ document: doc }: { document: CouncilDocument }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const isLocal = doc.storageType === "local";
  // ローカル保存（local）の場合のみサイト内PDFへのボタンを出す。sourceUrlは保存の有無によらず、
  // 確認できていれば常に「公式サイトで確認する」ボタンとして案内する。
  const pdfUrl = isLocal ? doc.filePath : undefined;
  const officialUrl = doc.sourceUrl;
  const previewUrl = pdfUrl ?? (!isLocal ? officialUrl : undefined);

  const publishedDate = safeFormatDate(doc.publishedDate);
  const verifiedAt = safeFormatDate(doc.verifiedAt);

  return (
    <li className="rounded-xl border border-outline-variant bg-surface p-4 shadow-e1 sm:p-5">
      <div className="flex flex-wrap items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
          <DocumentIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
              {councilDocumentCategoryLabels[doc.category]}
            </span>
            {!doc.isOfficial && (
              <span className="rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-medium text-on-tertiary-container">
                公式資料以外
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-base font-semibold leading-snug text-on-surface">{doc.title}</p>
          {doc.description && (
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{humanizeDataNote(doc.description)}</p>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-4">
        {publishedDate && (
          <div>
            <dt className="inline">公開日：</dt>
            <dd className="inline text-on-surface">{publishedDate}</dd>
          </div>
        )}
        {doc.pages != null && (
          <div>
            <dt className="inline">ページ数：</dt>
            <dd className="inline text-on-surface">{doc.pages}ページ</dd>
          </div>
        )}
        {doc.fileSize && (
          <div>
            <dt className="inline">ファイルサイズ：</dt>
            <dd className="inline text-on-surface">{doc.fileSize}</dd>
          </div>
        )}
        {verifiedAt && (
          <div>
            <dt className="inline">最終確認日：</dt>
            <dd className="inline text-on-surface">{verifiedAt}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${doc.title}のPDFを新しいタブで開く`}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${buttonFocusClass}`}
          >
            <DocumentIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            PDFを開く
          </a>
        )}
        {officialUrl && (
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${doc.title}を延岡市議会公式サイトで確認する（新しいタブで開く）`}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition hover:opacity-90 ${
              pdfUrl
                ? "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
                : "bg-primary-container text-on-primary-container shadow-e1"
            } ${buttonFocusClass}`}
          >
            <GlobeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            公式サイトで確認する
          </a>
        )}
        {!pdfUrl && !officialUrl && (
          <p className="rounded-full bg-surface-container-high px-3 py-2 text-xs text-on-surface-variant">
            この資料はまだ閲覧用リンクが登録されていません
          </p>
        )}
        {previewUrl && (
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-expanded={previewOpen}
            className={`hidden min-h-11 items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high sm:inline-flex ${buttonFocusClass}`}
          >
            {previewOpen ? "プレビューを閉じる" : "この画面でプレビューする"}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-on-surface-variant">
        リンクは新しいタブで開きます。{!isLocal && officialUrl && "（延岡市議会公式サイトのPDFです）"}
      </p>

      {previewOpen && previewUrl && (
        <div className="mt-3 hidden overflow-hidden rounded-lg border border-outline-variant sm:block">
          <iframe
            src={previewUrl}
            title={`${doc.title}のプレビュー`}
            className="h-[60vh] w-full bg-surface-container-high"
          />
          <p className="border-t border-outline-variant bg-surface-container-low p-2 text-xs text-on-surface-variant">
            正しく表示されない場合は、上のボタンから開いてご確認ください。
          </p>
        </div>
      )}
    </li>
  );
}
