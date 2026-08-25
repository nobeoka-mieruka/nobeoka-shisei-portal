# Phase130: 実機全ページUI監査 報告

## 実施日
2026-08-25

## 監査方式の判定

`list_connected_browsers`（claude-in-chrome拡張）を実行した結果、接続済みブラウザは0件（空配列）だった。
Chrome拡張が未接続のため、タスク指示に従い**実機（本番URL）でのスクリーンショット確認は実施していない**。
待機・リトライは行わず、直ちに静的コード監査（手順4）に切り替えた。

**重要**: 本レポートの内容はすべて静的コード監査によるものであり、実際のブラウザ描画・実機での横スクロール発生・
コンソールエラーの有無は確認できていない。「実機で確認した」という記述は一切含まない。

## 実機確認できたページ

なし（Chrome拡張未接続のため0件）。

対象として指定されていたページ（`/`, `/dashboard/`, `/finance/`, `/council-activity/`, `/people/`,
`/data-status/`, `/members/m01`, `/general-questions/`, `/bill-votes/`, `/mayors/`, `/compensation/`,
`/city-guide/`）はいずれも実機スクリーンショット・コンソールログ確認を行っていない。

## 静的コード監査の対象と方法

`src/pages/` 配下の対象ページコンポーネント（HomePage, DashboardPage, FinancePage, CouncilActivityPage,
PeoplePage, DataStatusPage, MemberDetailPage, GeneralQuestionsPage, BillVotesPage, MayorsPage,
CompensationPage, CityGuidePage）および共通コンポーネント（SiteHeader, BottomNav, FinanceTable,
MiyazakiComparisonTable, VoteResultBadge等）について、以下をコードレベルで確認した。

1. 固定px幅（`w-[Npx]`, `min-w-[Npx]`）の使用箇所と、横スクロール要因になり得るか
2. `<table>` 要素とその外側の `overflow-x-auto` ラップの有無
3. `grid-cols-*` のブレークポイント設計（375px相当のベース列数が過密でないか）
4. `flex-wrap` の付与状況（フィルターチップ・タブ等の折り返し）
5. 色のみで意味を伝えていないか（採決結果バッジ等のテキストラベル併記）
6. ボタン・リンクのタップ領域（padding指定）とfocus-visibleスタイルの有無

### 確認結果

**固定幅テーブルはすべて `overflow-x-auto` で適切にラップ済み**

- `CompensationPage.tsx`（`min-w-[1150px]` の自治体比較表）: `hidden overflow-x-auto ... sm:block` でPC/タブレットのみ表形式表示、モバイルはカード表示（`sm:hidden`の別ブロック、436行目）に切り替え。コメントで「以前はsm:hiddenとなっており、カード表示のスマートフォン利用者に実際には存在しない横スクロールを案内してしまっていた」という過去の修正経緯が明記されている。
- `CouncilActivityPage.tsx`（`min-w-[820px]`, `min-w-[640px]`の2表）: いずれも `hidden overflow-x-auto sm:block` でPC表示のみ、モバイル側は別途カード/リスト表示。
- `MayorEntertainmentExpensesPage.tsx`（`min-w-[820px]`）: 同様に `hidden overflow-x-auto sm:block`。
- `CompareSimilarMunicipalitiesPage.tsx`（`min-w-[640px]`）: モバイルでもカード表示を持たず意図的に横スクロールさせる設計（コメントに明記、TASK-083）。`overflow-x-auto` でページ全体ではなく表のみがスクロールする実装。
- 共通コンポーネント `FinanceTable.tsx`（`min-w-[360px]`）・`MiyazakiComparisonTable.tsx`（`min-w-[560px]`）も同様に `overflow-x-auto` でラップ済み。`FinanceTable.tsx` には「Phase31で発見」した日本語1文字縦折り返しバグの回避策（`whitespace-nowrap`）が丁寧にコメントされている。

これらはいずれも過去フェーズ（Phase31、TASK-083、Phase78ほか）で既に監査・修正済みの実装であり、今回の監査で新たな崩れは確認できなかった。

**grid-cols のブレークポイント**

対象ページの `grid-cols-*` はすべてベース（無指定=モバイル）が `grid-cols-1〜3`、`sm:`以降で列数を増やす設計になっており、375px幅で過密になる4列以上のベース指定は見つからなかった。

**flex-wrap**

`GeneralQuestionsPage.tsx`, `MemberDetailPage.tsx`, `CityGuidePage.tsx` のフィルターチップ・タグ表示は軒並み `flex flex-wrap` が付与されており、要素数増加時に横方向へはみ出さず折り返す設計になっている。

**色のみで意味を伝えていないか**

`VoteResultBadge.tsx` は「賛成」「反対」「棄権」等のテキストラベルを背景色付きバッジ内に表示しており、色だけに依存していない。`BillVotesPage.tsx` 内に色のみのステータス表現は見つからなかった。

**タップ領域・フォーカス**

`BottomNav.tsx`、`SiteHeader.tsx`、`CityGuidePage.tsx` のボタン・リンクは概ね `px-4 py-2〜2.5` 程度の余白と `focus-visible:outline` を持っており、明らかにタップ領域が不足している要素は確認できなかった（ただし実機でのCSS計算値・実測ではなくクラス名からの推定）。

## 発見された問題

なし。静的監査の範囲では、CLAUDE.md記載の要件（横スクロール防止、色のみに依存しない表現、タップ領域確保等）に反する明確な不具合は見つからなかった。

## 修正内容

修正なし。問題が確認されなかったため、コード変更は行っていない。

## 未実施事項（正直な報告）

- 実機（本番URL）でのスクリーンショット確認は0ページ（Chrome拡張未接続のため）。
- 375px/390px/768px/1280pxでの実際のレンダリング・横スクロール発生有無の目視確認は未実施。
- ブラウザのコンソールエラー（`read_console_messages`）の確認は未実施。
- 動的な状態（フィルター適用後、詳細展開後等）でのレイアウト崩れは静的コードからは判定できないため未確認。
- 画像・フォント読み込み後の実際のレンダリング崩れ、実デバイスでのタップ領域の実測は未確認。

## 次回への申し送り

Chrome拡張が接続可能な環境で、本レポート冒頭に列挙した12ページ×4幅（375/390/768/1280px）の実機スクリーンショット確認と
コンソールエラー確認を改めて実施することを推奨する。
