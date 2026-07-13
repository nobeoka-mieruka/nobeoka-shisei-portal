import { CONTACT_FORM_URL } from "../config/site";
import { GlobeIcon } from "./icons";

export function CorrectionRequestButton() {
  if (!CONTACT_FORM_URL) return null;

  return (
    <a
      href={CONTACT_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="このページの情報について、訂正・追加情報を提供する（外部フォームが新しいタブで開きます）"
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
    >
      <GlobeIcon className="h-4 w-4 shrink-0" />
      このページの情報について、訂正・追加情報を提供する
      <span aria-hidden className="text-xs opacity-80">
        （外部フォーム）
      </span>
    </a>
  );
}
