# セッション引き継ぎメモ（2026-08-04 更新・フェーズ8は基盤のみ完了、ページ層は未着手）

フェーズ8「AI横断検索・テーマ検索」は**データ層（型・バグ修正・ルールベース分類・
候補データ・管理者向け要確認キュー）のみ完了**し、ページ層（/people、/themes拡張、
/search拡張）は未着手のままコンテキスト予算の都合で停止した。**フェーズ9は開始していない**
（フェーズ9の詳細指示は受領済みだが、フェーズ8のページ層が先に必要なため着手を見送った）。
push・デプロイは未実施。

## ロードマップ

1. フェーズ6：政策データ・政策比較基盤 → 完了
2. フェーズ7：議案・条例・請願・陳情アーカイブ → 完了
3. フェーズ8：AI横断検索・テーマ検索 → **データ層のみ完了、ページ層は次回**
4. フェーズ9：比較・可視化・タイムライン → **詳細指示を受領済み、未着手**
5. フェーズ10：自動巡回の完成・全体検証・本番デプロイ

## 直近のコミット（ローカルのみ、未push）

```
815cf51 feat: add cross-archive search data layer (phase 8, foundational scope)
93fb6ef docs: フェーズ7完了を反映しセッション引き継ぎメモを更新
3af84bb feat: add council documents archive
```

`git status`は`.claude/settings.local.json`（ローカル専用）以外クリーン。

停止直前に確認済み：`npm run validate:data`（errors=0、既存警告のみ）／
`npm run typecheck`／`npx oxlint`（クリーン）／`npm run build`（875ページ生成、
prerender成功）／`npm run validate:seo`（failures=0, warnings=0）すべて成功。

## 完了した作業（フェーズ8：データ層）

- **バグ修正**：`src/types/index.ts`の`SearchEntryType`にフェーズ5〜7で
  `generate-search-index.mjs`が生成していた`"former-member"`・`"policy"`・
  `"council-document"`が抜けており、`SearchPage.tsx`の`typeLabels[entry.type]`が
  `undefined`を表示していた（実害のあるバグ）。型を追加し、`typeLabels`・
  `EXAMPLE_KEYWORDS`を修正した。
- **型**（`src/types/historicalArchive.ts`）：`ArchiveSearchDocument`（横断検索の
  共通ドキュメント型、22種類のdocumentType）、`ArchiveRelationCandidate`（関連資料候補、
  relationType/method/status）、`ArchiveAiSummary`（AI要約、sourceTextHashで原文変更時の
  再確認判定が可能）、`ArchiveAiCategoryCandidate`（AI/ルールベース分類候補）。
  `ArchivePolicyCategory`に`keywords?: string[]`を追加。
- **既存/search・searchIndex.jsonは変更方針を維持**：`SearchIndexEntry`/`search.ts`/
  `SearchPage.tsx`の中核ロジックは無変更（型バグ修正のみ）。`ArchiveSearchDocument`は
  「段階的統合」の受け皿として型のみ用意し、実データJSON化・検索エンジンの置き換えは
  次回以降（既存の動作実績あるロジックを壊さないため）。
- **ルールベース分類**（`src/lib/themeClassification.ts`）：既存の
  `classifyTopicToThemeSlug`（質問テーマ用、短い語句を最初の一致1件へ分類）はそのまま残し、
  新規`matchPolicyCategoriesForText()`（長文から複数候補を確信度順に返す）を追加。
  外部AI APIは一切呼び出さない。
- **共通テーママスタ**：`archivePolicyCategories.json`（28件）に`keywords`を追加した
  （既存`themes.json`の質問テーマキーワードを流用できるものは流用し、無いものは
  ラベルの同義語のみを最小限追加。新規テーマ体系は作らず、既存マスタを正本とした）。
- **候補データ**（`scripts/generate-theme-candidates.mjs`で生成、既存データのみ使用・
  外部取得なし）：
  - `archiveAiCategoryCandidates.json`（8件）：`archiveCouncilDocuments.json`
    （条例・請願・陳情・議案）の本文にキーワード一致したテーマ候補。
  - `archiveRelationCandidates.json`（4件）：上記候補分類が、政策側の確定分類
    （`archivePolicies.json`の`categoryIds`）と一致した場合の関連候補
    （relationType="sameTheme"、method="keywordMatch"）。
  - すべて`status="candidate"`のまま。確信度0.3〜0.6程度の低〜中程度で、
    人による確認前提。
  - `archiveAiSummaries.json`：0件（外部AI APIを呼んでいないため）。型・保存構造のみ。
- **管理者向け要確認キュー**（`scripts/generate-admin-review-queue.mjs`）：候補データ・
  出典未確認・委員会マスタ未整備・重複候補等を集計し`adminReviewQueue.json`
  （32件）を生成。**公開ルートからは一切参照していない**（内部データのみ）。
- **validate-data.mjs**：上記3ファイルのid重複、sourceEntityId/targetEntityId/
  categoryId参照整合性（対応可能な種別のみ）、confidence 0〜1範囲、
  status妥当性、candidate→confirmedへの無記録昇格の検出、sourceTextHash必須化を追加。
- **package.json**：`generate:theme-candidates`・`generate:admin-review-queue`を
  追加し、`npm run build`のパイプラインに組み込んだ（`validate-data.mjs`の前に実行し、
  検証対象に含めた）。

## 未実施（次回、フェーズ8の残り）

ユーザー指示の「今回の実装範囲」15項目のうち、次はまだ着手していない。

1. **`/people`・`/people/:slug`（人物別横断ページ）**：現職議員・元議員・市長の
   基本情報は既存`/members/:id`等へリンクし、そこに無い横断情報（関連政策・
   関連議案等）のみ新規表示する設計を想定（重複実装を避けるため）。
2. **`/themes/:slug`への横断表示拡張**：既存の質問テーマ（14件、`themes.json`）は
   そのまま維持し、`archiveRelationCandidates.json`を使って「関連の可能性がある
   政策・議案等（候補）」を確認済み情報と明確に区別して追加表示する設計を想定。
3. **`/search/advanced`、および`/search`への追加絞り込み**（年度・確認状況・
   AI生成情報を含める切替等）。
4. **既存`scripts/generate-search-index.mjs`との統合**：`ArchiveSearchDocument`型を
   実際に使う検索インデックス生成、またはpersonIds/fiscalYears等の追加フィールドを
   既存`SearchIndexEntry`へマージするかの設計判断が必要。

## 次にやること（優先順）

1. 上記「未実施」1〜4から着手する。
2. その後、フェーズ9「比較・可視化・タイムライン」（ユーザーから詳細指示を受領済み。
   `/compare/mayors`・`/compare/policies`等の**既存比較ページを維持しつつ拡張**する方針、
   市長任期と年度の対応判定、財政数値の定義・単位表示、市政タイムライン`/timeline`、
   点数化・順位付け・優劣判定の禁止などが指示されている）。

## 既知の注意点・落とし穴（継続）

- **`npm run build`実行のたびに`src/data/siteUpdate.json`のタイムスタンプだけが更新される**。
  実データ変更を伴わない場合はコミットせず`git restore`で戻してよい。
- **`archiveAiCategoryCandidates.json`・`archiveRelationCandidates.json`・
  `adminReviewQueue.json`も、`npm run build`のたびに`generatedAt`/`createdAt`
  タイムスタンプが再生成される**（内容が同じでも差分が出る）。siteUpdate.jsonと
  同様、実質的な内容変更が無ければ気にせずコミットしてよい（生成物として正しい状態）。
- `src/data/searchIndex.json`・`public/sitemap.xml`は生成物だがGit管理下にある。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`。
- 比較ページの命名規則は`/xxx/compare`ではなく`/compare/xxx`。
- 委員会マスタが存在しない（`committeeId`は1件も確認できていない）。
- `validate-seo.mjs`には`public-routes.mjs`とは独立したハードコードチェックが
  一部あるため、既存ページの索引状態を変更する場合はこのファイルも確認すること。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`と`git status`で本メモと状態が一致しているか確認。
2. `npm run validate:data && npm run typecheck`で現状に問題がないか確認。
3. フェーズ8の残り（`/people`・`/themes`拡張・`/search`拡張）から着手する。
4. 完了後、フェーズ9「比較・可視化・タイムライン」（詳細指示は本メモ執筆時点で
   ユーザーから受領済み。次回セッションで再掲を依頼するか、会話ログを参照）。
