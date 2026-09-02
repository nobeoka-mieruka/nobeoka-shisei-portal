# Phase194 WCAG 2.1 AA・キーボード操作 実動作監査レポート

実施日：2026-09-02
対象：`npm run build` 後の本番同等ビルド（`vite preview`、2,271ページ生成）
監査ページ数：78ページ（`src/App.tsx` の全ページコンポーネントを1URLずつ網羅。一覧・詳細・404を含む）
使用ツール：Playwright（Chromium）＋ `@axe-core/playwright`
実行スクリプト：`scripts/audit-accessibility.mjs`
機械可読な結果：`reports/phase194-wcag-keyboard-audit.json`

> **重要な前提**：自動監査（axe-core）の violation が 0 件になったことは、WCAG 2.1 AA へ
> 完全準拠したことを意味しない。axe-core が機械判定できる範囲は WCAG 達成基準の一部であり、
> 本監査では自動監査に加えて、実ブラウザでのキーボード操作・フォーカス表示・200%拡大・
> ダークテーマ・`prefers-reduced-motion` を実測して補完している。それでも、スクリーンリーダー
> による読み上げ順序・文言の適切さ、認知的な分かりやすさなどは人手確認が必要である。

---

## 1. 結果サマリ

| 項目 | 監査前 | 監査後 |
| --- | --- | --- |
| 自動監査 violation（critical） | 0 | 0 |
| 自動監査 violation（serious） | 95ノード | **0** |
| 自動監査 violation（moderate） | 11ノード | **0** |
| 自動監査 violation（minor） | 0 | 0 |
| ダークテーマのコントラスト violation | 8ノード（2ページ） | **0** |
| キーボードトラップ | 0 | 0 |
| フォーカス表示が確認できない要素 | 13要素（6ページ） | **0** |
| スキップリンクの不具合 | 0 | 0 |
| 見出し階層の飛び（h1→h3等） | 11ページ | **0** |
| ラベルのない `<nav>` ランドマーク | 2件×78ページ | **0** |
| 存在しないIDを指す `aria-controls` | 2ページ | **0** |
| 横スクロール発生（320/375/640px） | 0 | 0 |
| `prefers-reduced-motion` が効かない要素 | 0 | 0 |

Tab キーで実際に到達した要素の総数：3,387（78ページ合計）
開閉UI（`aria-expanded`）の Enter/Space 実操作テスト：14件

---

## 2. 自動監査で検出し、修正した問題

### 2-1. `link-in-text-block`（serious・62ノード・23ページ）

WCAG 1.4.1（色の使用）。本文中のリンクが色のみで区別されており、周囲の本文との
コントラスト比が 1.44:1〜2.66:1（3:1未満）で、下線などの区別も無かった。

- 修正：`text-primary hover:underline`（ホバー時のみ下線）を `text-primary underline`
  （常時下線）へ統一。src配下 64ファイル・195箇所。

### 2-2. `heading-order`（moderate・11ページ）

フッターのリンクグループ見出しが `<h3>` だったため、本文に `<h2>` を持たないページで
h1 → h3 の飛びが発生していた。

- 修正：`src/components/Footer.tsx` のグループ見出しを `<h2>` へ変更（表示は変更なし）。

### 2-3. `color-contrast`（serious・19ノード・3ページ／ダーク8ノード・2ページ）

| 箇所 | 修正前 | 修正後 |
| --- | --- | --- |
| `MethodologyActivityRadarPage` の凡例（10px） | `text-on-surface-variant/70` 3.63:1 | 不透明度を外し 8.0:1 以上 |
| `CouncilActivityPage` / `CouncilActivityMemberPage` の件数表示 | `text-orange-600` 3.59:1 | `text-orange-700`（暗所は `orange-300`） |
| 会派チップ（`FactionChip`）の白文字 | 公明党市議団 #F59E0B で 2.15:1、友愛クラブ #16A34A で 3.30:1 | 背景色の相対輝度から文字色を自動選択（8.00:1 / 5.22:1） |
| `CouncilActivityHistoryPage` ほか（ダークテーマ） | `text-on-primary-container/70` 4.44:1 | `/80` へ変更し 5.30:1 |

会派色は公表資料に基づく識別色であり **データ（`src/data/factions.json`）は一切変更していない**。
表示側（`src/lib/contrastColor.ts` 新規）で WCAG の相対輝度計算により白／濃色を選び分けている。

### 2-4. `definition-list` / `dlitem`（serious・13ノード）

`/council-activity` の「確認状況」ブロックで、`<dl>` 直下のグループ `<div>` が
`dt`/`dd` 以外（`div`・`p`）を含んでいた。grid レイアウトで見た目を保ったまま
`dt` + `dd` + `dd` の構成へ修正。

### 2-5. `scrollable-region-focusable`（serious・1ノード）

`/compare/similar-municipalities` の横スクロール表にフォーカス可能な要素が無く、
キーボードだけでは横スクロールできなかった（WCAG 2.1.1）。
`tabIndex={0}` ＋ `role="region"` ＋ `aria-label` ＋ フォーカス表示を付与。

---

## 3. 自動監査では検出できず、実動作で見つかった問題

axe-core は以下をいずれも violation として報告しなかった。実ブラウザ操作・DOM実測で検出した。

### 3-1. 検索結果ページの絞り込み `<select>` にフォーカス表示が無かった（WCAG 2.4.7）

`SearchPage` の年度／確認状況／並び替えの `<select>` は `focus:outline-none` を持ち、
親 `<label>` にも `focus-within:outline` が無かったため、**キーボードで移動しても
フォーカス位置が視覚的に分からない**状態だった（共通コンポーネントの `FilterSelect` /
`SortSelect` にはこの指定があり、SearchPage だけ独自実装で漏れていた）。

- 検出方法：Tab を実送信し、`document.activeElement` と祖先の computed style
  （`outlineStyle` / `outlineWidth`）を実測。
- 修正：該当 `<label>` 4箇所へ `focus-within:outline …` を付与。

### 3-2. 検索コンボボックスの `aria-controls` が存在しないIDを指していた

候補リストが閉じている間も `aria-controls="search-suggestions-listbox"` が固定で出力され、
参照先 DOM が存在しなかった（axe は `aria-controls` の参照切れを violation にしない）。

- 修正：展開中のみ `aria-controls` を出力。Escape 後に属性が消えることを実操作で確認済み。

### 3-3. `role="listbox"` の直下に `role="option"` 以外の要素があった

候補リストが `<ul role="listbox"> > <li> > <button role="option">` 構造で、
`<li>`（暗黙ロール `listitem`）が listbox の直接の子になっていた。

- 修正：`<li role="presentation">` を付与。

### 3-4. ラベルの無い `<nav>` ランドマークが全ページに2つあった

ヘッダーの主要メニューと画面下部メニューがどちらも無名で、スクリーンリーダーの
ランドマーク一覧で区別できなかった（表示幅により片方が `display:none` のため
axe の `landmark-unique` は発火しなかった）。

- 修正：`aria-label="主要メニュー"` / `aria-label="画面下部メニュー"` を付与。

### 3-5. `role` の無い `<div>` に `aria-label` を付けていた（読み上げが無視される）

`YearlySpeechTrendChart` の年別バーで、汎用 `<div>` に `aria-label` を付けていた
（axe では violation ではなく incomplete＝要確認扱い）。可視テキストが同じ内容を
持っているため `aria-label` を削除。
`CouncilActivityPage` の一覧表セルも `aria-label` による内容置き換えをやめ、
記号を `aria-hidden`、意味を `sr-only` テキストで併記する形へ変更。

### 3-6. 200%拡大時に議員名・かな・「公式プロフィール」が省略記号で切れていた（WCAG 1.4.4）

1280px を `zoom: 200%` にした状態で `MemberCard` の `truncate`（`text-overflow: ellipsis`）
により文字が欠けていた（`scrollWidth 134px` に対し `clientWidth 94px` 等）。
横スクロールは発生していないため、axe でもビューポート幅チェックでも検出できない。

- 修正：`MemberCard` の氏名・ふりがな・公式プロフィールリンクを `truncate` から
  `break-words`（折り返し）へ変更。

---

## 4. 実動作で確認し、問題が無かった項目

- **キーボードトラップ**：78ページで Tab を最大90回送信して巡回。トラップ 0件。
- **Shift+Tab**：`/finance/budget`・`/compare/mayors`・`/bills/votes`・`/elections` で
  逆順に正しく戻ることを実操作で確認（自動判定で疑わしいと出た19ページは、
  同一テキストの要素が連続するための誤検知だった）。
- **スキップリンク**：全78ページで最初の Tab で「本文へ移動」が可視化され、Enter で
  `#main-content` へフォーカスが移り、続く Tab が本文内から始まることを確認。
- **開閉UI**：アコーディオン・`aria-expanded` ボタン（1280px 幅を含む）で Enter と Space の
  両方が開閉として機能。`<details>/<summary>`（全ページ計153要素）も Enter/Space で開閉。
- **コンボボックス（サイト内検索）**：↓↑ で候補移動（`aria-activedescendant` が追従）、
  Enter で確定して URL に反映、Escape で閉じてもフォーカスが入力欄に残ることを確認。
- **モーダル**：サイト内にモーダルダイアログ（`role="dialog"`）は存在しない。
  フォーカストラップの必要な箇所そのものが無い。
- **フォーム**：入力フォームは `/` のヒーロー検索と各一覧の絞り込みのみ（送信フォームは
  外部フォームへのリンク）。ラベルの無いフォームコントロールは 78ページで 0件。
- **画像**：`<img>` は2箇所のみで、いずれも `alt` あり。装飾アイコン（SVG）は
  `role` を持たないため支援技術に露出しない。
- **`aria-current`**：React Router の `NavLink` により現在地に `aria-current="page"` が付与。
- **横スクロール**：320px / 375px / 640px（1280pxの200%拡大相当）で
  `documentElement.scrollWidth > clientWidth` となるページは 0件。
- **`prefers-reduced-motion`**：`reduce` を有効化した状態で、transition を持つ846要素すべての
  `transition-duration` が 0.05秒以下になることを実測（Phase190 のグローバル指定が有効）。
- **ダークテーマ**：78ページを `prefers-color-scheme: dark` で再監査し、コントラスト違反 0件。

---

## 5. 残課題（人手確認が必要な項目）

1. **axe の `color-contrast` incomplete 68件**：機械判定できなかったもので、内訳は
   次の4種類。いずれも手計算で AA を満たすことを確認済みだが、恒久的な自動チェックは不可。
   - グラデーション背景の見出し（`bg-gradient-to-br from-primary-container to-surface-container-low`）
     → ライト 13.27〜15.55:1、ダーク 7.27〜13.31:1。
   - `aria-hidden` の装飾記号（▼）のみを含む要素 → 読み上げ対象外。
   - 画面下部固定メニューに一部重なる要素 → 実際の背景は不透明。
   - スクロール表のセルがヘッダーに一部隠れるケース → 実際の背景は不透明。
2. **スクリーンリーダー実機確認は未実施**：NVDA / VoiceOver / TalkBack による
   読み上げ順序・文言の妥当性は本監査の対象外。
3. **`truncate` による省略が残る箇所**：前後ページ送り（議案・一般質問・公約）や
   パンくずの末尾など、長いタイトルを意図的に省略している10箇所は変更していない
   （全文は遷移先で確認でき、DOM上のテキストも省略されていないため読み上げには影響しない）。
4. **監査対象は各ページコンポーネント1URLずつ**：同一コンポーネントでもデータ次第で
   結果が変わる可能性は残る（例：議員別ページ2,270件のうち監査したのは代表1件）。
5. **`playwright` / `@axe-core/playwright` は package.json に追加していない**
   （Cloudflare Pages のビルドを重くしないため）。再実行時は
   `npm i --no-save playwright @axe-core/playwright` が必要。

---

## 6. 変更ファイル

**新規**
- `scripts/audit-accessibility.mjs`（監査スクリプト）
- `src/lib/contrastColor.ts`（背景色から読みやすい文字色を選ぶユーティリティ）
- `reports/phase194-wcag-keyboard-audit.json` / `.md`（本レポート）

**修正（主なもの）**
- `src/components/Footer.tsx`（見出し階層）
- `src/components/SiteHeader.tsx` / `src/components/BottomNav.tsx`（ランドマークのラベル）
- `src/components/FactionChip.tsx`（文字色の自動選択）
- `src/components/MemberCard.tsx`（200%拡大時の文字切れ）
- `src/components/council/YearlySpeechTrendChart.tsx`（不要な `aria-label` の削除）
- `src/pages/SearchPage.tsx`（フォーカス表示・`aria-controls`・listbox構造）
- `src/pages/CouncilActivityPage.tsx`（`dl` 構造・コントラスト・表セルの読み上げ）
- `src/pages/CouncilActivityMemberPage.tsx` / `src/pages/MethodologyActivityRadarPage.tsx`
  / `src/pages/CouncilActivityHistoryPage.tsx`（コントラスト）
- `src/pages/CompareSimilarMunicipalitiesPage.tsx`（横スクロール表のキーボード操作）
- 本文中リンクの常時下線化：src配下 64ファイル

データ（`src/data/**`）の中身・`status`・`HUMAN_ACTION_REQUIRED` の内容は一切変更していない。
