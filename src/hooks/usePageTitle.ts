import { useEffect } from "react";

const SITE_NAME = "延岡市政見える化ポータル";

/** ページ滞在中だけブラウザのタブ名を切り替え、離れたらサイト全体の名前に戻す。 */
export function usePageTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle}｜${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = SITE_NAME;
    };
  }, [pageTitle]);
}
