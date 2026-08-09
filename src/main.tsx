import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

const rootElement = document.getElementById("root")!;
const appTree = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// 本番（Cloudflare Pages）はscripts/prerender.mjsが生成した静的HTMLを配信するため、
// #root には既にサーバー側でレンダリング済みの内容が入っている。従来は常にcreateRoot()で
// クライアント側から丸ごと再レンダリングしており、せっかくの静的HTMLの内容を初回描画直後に
// 破棄して最初から再構築していた（TASK-051、2026-08-09）。本番の実LCPは変更前から既に
// 良好（1.9秒）だったが、無駄な再レンダリング自体は設計上の欠陥のため是正した。
// #root に既存の子要素がある場合のみhydrateRoot()で再利用し、それ以外（`npm run dev`が
// 提供する空の#root）は従来どおりcreateRoot()にフォールバックする。
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, appTree);
} else {
  createRoot(rootElement).render(appTree);
}
