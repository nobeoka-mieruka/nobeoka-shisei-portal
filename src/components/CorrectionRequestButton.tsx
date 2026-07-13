import { CONTACT_FORM_URL } from "../config/site";
import { GlobeIcon } from "./icons";

interface CorrectionRequestButtonProps {
  /** ボタンの下に表示する補足文で、対象の議員名やページ名を案内するために使う。 */
  pageName?: string;
  /** 将来、ページごとに異なるフォームURL（事前入力済みリンクなど）を使う場合に上書きできる。未指定時は共通のフォームURLを使う。 */
  formUrl?: string;
}

export function CorrectionRequestButton({ pageName, formUrl }: CorrectionRequestButtonProps) {
  const url = formUrl ?? CONTACT_FORM_URL;
  if (!url) return null;

  return (
    <div className="space-y-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="このページの情報について訂正・追加情報を提供する（外部フォームが新しいタブで開きます）"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
      >
        <GlobeIcon className="h-4 w-4 shrink-0" />
        このページの情報について訂正・追加情報を提供する
        <span aria-hidden className="text-xs opacity-80">
          （外部フォーム）
        </span>
      </a>
      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        {pageName
          ? `フォーム内に「${pageName}」など、対象のページが分かる名称をご記入ください。`
          : "フォーム内に、対象となる議員名またはページ名をご記入ください。"}
      </p>
    </div>
  );
}
