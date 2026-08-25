# Phase155: 公約変更履歴・タイムラインの改善

## 対象範囲

- `src/pages/MayorPromiseDetailPage.tsx` の「進捗履歴」セクション（`SectionCard title="進捗履歴"`、`promise.progressHistory` を表示している箇所）のみを変更した。
- 「公約原文」「市民向け概要」「現在の進捗」「公約の現在地（個別の取組み）」「判断根拠」「根拠資料一覧」等、Phase154が担当する他セクションには一切触れていない。
- `src/types/index.ts`・`src/data/mayorPromises.json` を含むデータファイルは変更していない（既存の型・データはそのまま）。

## 調査結果：存在する時点の確認

`src/data/mayorPromises.json`（全14件）を確認した結果：

- **選挙時公約発表日（`announcedDate`）**：14件すべて未設定。個別公約ごとの発表日データは存在しないため、タイムラインには追加していない（無理に埋めていない）。
- **令和7年度時点のデータ**：`progressHistory`等に令和7年度時点の状態として登録された独立エントリは無い（令和7年度実績への言及は「進捗更新」の本文中の説明としてのみ存在し、独立した時点データではない）。
- **`referenceDate`（基準日）**：14件中12件が`2026-07-14`、残り2件（4-4, 4-5）が`2026-07-31`で設定済み。これは実在するデータのため「基準時点」として表示に追加した。
- **`progressHistory`**：14件中12件に`2026-07-31`付けの1件のみ存在（TASK-172で投入済み）。残り2件（4-4, 4-5）は`progressHistory`未設定。

以上より、今回表示可能な時点は次の2種類のみとした。存在しない時点（選挙時・令和7年度単独時点）は表示していない。

1. **基準時点**（`referenceDate`）
2. **進捗更新**（`progressHistory`の各エントリ）

## UI変更内容

- `buildPromiseTimeline()` ヘルパー関数を追加し、公約ごとに「基準時点」1件（`referenceDate`が`progressHistory`のいずれの日付とも重複しない場合のみ）と「進捗更新」N件（`progressHistory`）を統合し、日付降順で並べる。
- タイムラインは`src/components/council/PersonTimeline.tsx`と同じ視覚言語（`border-l`＋丸ドット）を踏襲し、新規デザインシステムは作成していない。
- 各エントリに種別バッジを表示し、次の2種類を明確に区別した。
  - 「基準時点」（ニュートラルな配色：`bg-surface-container-high`）：この日を基準にデータを整理していることを示す。個別の進捗更新イベントではないため、本文には固定の説明文のみを表示し、根拠資料リンクは表示しない（`progressSummary`等は上部セクション参照に誘導）。
  - 「進捗更新」（`bg-primary-container`）：`progressHistory`エントリ本来の内容（`summary`／`note`、出典リンク）を表示する。
- セクション冒頭に、「公約原文自体の変更」と「進捗情報の更新」を区別して記録する方針を明記した注記を追加。今回は`promiseText`の変更は一切発生していないため、「現時点で公約原文の変更履歴は登録されていません」と明示し、架空の変更履歴は作成していない。
- 型`PromiseTimelineEntry`のコメントで、将来`promiseText`変更を記録するデータが追加された場合に`"promise_text_change"`種別を追加できる設計であることを明記した（今回はそのデータが存在しないため実装はしていない）。
- 基準時点のみで進捗更新が1件も無い公約（4-4, 4-5）については、タイムラインの下に「この基準日以降の進捗更新は、公開資料で確認でき次第追加します」という注記を表示し、「確認できない＝未着手」に読めないようにした。
- 日付表示は既存の`formatJapaneseDate`ヘルパーをそのまま使用。

## 検証結果

- `npm run validate:data`：errors=0, warnings=40（変更前と同数。データファイル自体は無変更のため差分なし）
- `npm run typecheck`：エラーなし
- `npm run lint`（oxlint）：警告・エラーなし
- `npm run test`：`scripts/test-activity-radar.mjs`が失敗するが、変更前（`git stash`でベースラインに戻して再実行）でも同一の失敗が再現することを確認済み。本Phaseの変更とは無関係の既存の失敗。
- `npm run build`：ビルド成功。`validate:seo`（2243ページ, failures=0 warnings=0）、`validate:content`（2243ページ, errors=0 warnings=0）とも問題なし。

## 未実施・残作業

- `progressHistory`が今後複数エントリになった場合の表示は`buildPromiseTimeline()`がそのまま日付降順で並べるため追加対応不要。
- `promiseText`の変更を記録するデータモデル（例：`promiseTextHistory`）は今回新設していない。将来Phase154側等でそのようなデータが追加される場合は、`PromiseTimelineEntry`の`kind`に`"promise_text_change"`を追加し、`buildPromiseTimeline()`に統合する設計とする。
