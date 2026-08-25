# Phase154: 公約進捗UI最終改善 作業報告

## 対象範囲

- `/mayor/policy-progress`（一覧ページ、`src/pages/MayorPolicyProgressPage.tsx`）
- `src/pages/MayorPromiseDetailPage.tsx` の「公約原文」「市民向け概要」「現在の進捗」
  「公約の現在地（個別の取組み）」セクション
- 「進捗履歴」セクション・タイムライン表現には一切手を加えていない（Phase155の担当範囲）

## 変更内容

### 1. 一覧ページ（MayorPolicyProgressPage.tsx）

- 各政策カテゴリ（4分野・14公約）の見出しに、既存の `aggregateCategoryStatus`
  （`src/lib/mayorPromiseStatus.ts`、新規ロジックは追加せず既存関数をそのまま再利用）で
  算出したカテゴリ全体の進捗ステータスを `MayorPromiseStatusBadge` で表示するよう変更。
  これにより「結局、この政策分野はどこまで進んでいるのか」がカテゴリ見出しだけで一目で
  分かるようにした（達成率・独自採点は一切追加していない）。
- 全公約数・進捗状況ごとの件数（StatCard）は元々`promises.length`から動的算出されており、
  14件（新規4-4／4-5含む）ベースで正しく表示されていることを確認した（変更不要）。

### 2. 詳細ページ（MayorPromiseDetailPage.tsx）「公約の現在地（個別の取組み）」

- 個別施策ごとの進捗表示ラベルを、汎用的な「前年度実績／今年度の実績／今後の予定／将来目標」
  から、実際の年度表記（例：【令和7年度】【令和8年度】【今後】）に変更。
  - `previousYearResult` → `【（fiscalYear-1年度）】`
  - `currentYearResult`／`currentYearPlan` → `【fiscalYear（例：令和8年度）】実施：〜／予定：〜`
  - `futureTarget` → `【今後】`
  - いずれも既存データ（`mayorPromiseMeasures.json`）のフィールドをそのまま表示しているだけで、
    新しいデータは作成していない。
- 年度ラベルの算出用に `src/lib/mayorPromiseMeasureStatus.ts` へ
  `shiftFiscalYearLabel(fiscalYear, offsetYears)` を追加（"令和8年度" → "令和7年度" のような
  表示ラベルの言い換えのみを行う純粋関数。実績・予定の中身は一切補完・推測しない。
  パターンに一致しない場合は `null` を返し、呼び出し側は汎用ラベルへフォールバックする）。
- 出典表示を「【出典】{sourceTitle}（{sourcePage}） {snapshotDate}現在」の順に整理し、
  ユーザー要望の表示例（延岡市「市長公約に関する取組み 令和8年度」2026年7月31日現在 PDF p.X）
  に近い形に統一。
- 施策ごとの現在ステータスは、既存の `MayorPromiseMeasureStatusBadge`
  （アイコン＋文字ラベル、色だけに依存しない設計）をそのまま利用し、
  「現在の状況：」という明示ラベルを前置して視認性を強化。ラベル文言
  （COMPLETED→完了／IN_PROGRESS→実施中／CONTINUING→継続／PLANNED→予定／
  PREPARING→準備中／NOT_ASSESSABLE→判定できず）は `src/lib/mayorPromiseMeasureStatus.ts`
  の既存定義のまま変更していない。
- 「公約原文」「市民向け概要」「現在の進捗」セクションは既存実装のまま変更していない
  （既に十分明確であり、無理な変更は行わなかった）。

### 達成率・独自採点について

- 達成率・独自スコアリングは一切追加していない。既存の `mayorPromiseStatusLabel` /
  `mayorPromiseMeasureStatusLabel` の文字ラベルをそのまま利用している。

## モバイル対応状況

- claude-in-chromeによる実機確認は**行っていない**（このタスクでは使用していない）。
- コードレベルの静的確認のみ：
  - すべての変更箇所は `flex flex-wrap` を用いており、固定幅・横スクロールを発生させる
    スタイルは追加していない。
  - 既存の `SectionCard` / `MayorPromiseStatusBadge` / `MayorPromiseMeasureStatusBadge`
    コンポーネントをそのまま再利用しており、既存ページで確認済みの375px/390px/768px/1280px
    表示崩れがないレイアウトパターンを踏襲している。
  - 新規に固定px幅・`overflow`挙動を追加するコードは書いていない。

## 出典表示

- 「公約の現在地（個別の取組み）」セクションの各施策に、`sourceTitle` / `sourcePage` /
  `snapshotDate` を用いた出典表示（PDFへのリンク付き）を維持・改善して表示している。
- 出典データそのものは既存の `mayorPromiseMeasures.json`（TASK-172／Phase148で登録済み）を
  そのまま使用しており、新規データは追加していない。

## 品質確認結果

| コマンド | 結果 |
|---|---|
| `npm run validate:data` | `errors=0 warnings=40`（変更前と同数、既存の警告のみ） |
| `npm run typecheck` | エラーなし |
| `npm run lint`（oxlint） | エラーなし（exit code 0） |
| `npm run test` | 失敗（`scripts/test-activity-radar.mjs` が `src/lib/activityRadar.ts` の構造不一致で例外。**本タスクの変更前（`git stash`で確認）から同一エラーで失敗しており、本Phase154の変更による回帰ではない**） |
| `npm run build` | 成功。`vite build` OK、prerender 2242/2242ルート成功 |
| `npm run validate:seo`（build内で実行） | `checked 2243 page(s). failures=0 warnings=0` |
| `npm run validate:content`（build内で実行） | `checked 2243 page(s) — errors=0 warnings=0` |
| `npm run validate:sources` | `errors=0 warnings=15 info=66`（変更前と同数、既存の警告のみ） |

ビルド後の生成HTMLを直接確認し、以下を確認済み：

- `/mayor/policy-progress/1-1/` の「公約の現在地」に「令和7年度」6件・「令和8年度」26件の
  年度ラベルが正しく出力されている。
- `/mayor/policy-progress/` の各政策カテゴリ見出し（`#children` `#economy` `#senior`
  `#city-hall`）に、`aggregateCategoryStatus` によるバッジ（例：「進行中」）が出力されている。

## 変更したファイル

- `src/pages/MayorPolicyProgressPage.tsx`
- `src/pages/MayorPromiseDetailPage.tsx`
- `src/lib/mayorPromiseMeasureStatus.ts`（`shiftFiscalYearLabel` 追加）

新規ページ・新規ルートの追加はなし。新規コンポーネントの追加もなし（既存の
`MayorPromiseStatusBadge` / `MayorPromiseMeasureStatusBadge` / `aggregateCategoryStatus` を
再利用）。

## 残作業・次の改善提案

- クロスブラウザでの実機モバイル表示確認（claude-in-chrome等）は未実施。次回作業時に
  375px/390px/768px/1280pxでの実機確認を推奨する。
- `npm run test`（activity-radarパッチ検証）が本タスク以前から失敗している状態のため、
  別タスクでの修正を推奨する（本Phase154のスコープ外）。
- 進捗履歴セクション・タイムライン表現の改善はPhase155の担当範囲のため未着手。
