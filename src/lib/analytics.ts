declare global {
  interface Window {
    dataLayer: unknown[][];
    gtag: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

const LOCALHOST_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/** 本番環境かつlocalhost以外、かつ測定IDが設定されている場合のみ計測を有効にする。 */
function isAnalyticsEnabled(): boolean {
  if (!GA_MEASUREMENT_ID) return false;
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  if (LOCALHOST_HOSTNAMES.includes(window.location.hostname)) return false;
  return true;
}

let initialized = false;

/** gtag.jsを読み込み、初期化する。アプリ起動時に1回だけ呼び出す。 */
export function initGoogleAnalytics(): void {
  if (initialized || !isAnalyticsEnabled()) return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  // React Router側でページ遷移ごとに手動送信するため、初回の自動送信は無効にする。
  window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
}

/** ページ遷移ごとにpage_viewイベントを送信する（404ページを含む）。 */
export function trackPageView(path: string): void {
  if (!isAnalyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
  });
}
