import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

export function NotFoundPage() {
  usePageTitle();

  return (
    <div className="px-4 py-10 text-center sm:px-6">
      <p className="text-sm font-medium text-on-surface-variant">404</p>
      <h1 className="mt-2 text-xl font-semibold text-on-surface sm:text-2xl">
        ページが見つかりませんでした
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-on-surface-variant">
        お探しのページは、URLが変更されたか、削除された可能性があります。
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        トップページに戻る
      </Link>
    </div>
  );
}
