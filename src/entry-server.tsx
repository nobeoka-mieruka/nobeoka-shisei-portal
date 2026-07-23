/**
 * ビルド時プリレンダリング専用のサーバーサイドレンダリングエントリ。
 * ブラウザには読み込まれない（scripts/prerender.mjsからのみ使用する）。
 *
 * App（SiteHeader・BottomNav・Footerを含む既存のルート構成）をStaticRouterで
 * 指定URL分だけレンダリングする。Web標準のStreams API（renderToReadableStream）を使うため、
 * Node固有の型（Buffer・node:stream）を必要とせず、既存のブラウザ向けtsconfigのままで済む。
 * App.tsx側のReact.lazyによるコード分割は stream.allReady で待ち合わせるため、そのまま利用できる。
 */
import { renderToReadableStream } from "react-dom/server.edge";
import { StaticRouter } from "react-router-dom";
import App from "./App";

export { getSeoForPath } from "./lib/seo";

const RENDER_TIMEOUT_MS = 20000;

/** 指定URLのページ本文（<div id="root">の中身）をHTML文字列として返す。 */
export async function renderApp(url: string): Promise<string> {
  const stream = await renderToReadableStream(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
    { signal: AbortSignal.timeout(RENDER_TIMEOUT_MS) },
  );
  await stream.allReady;
  return new Response(stream).text();
}
