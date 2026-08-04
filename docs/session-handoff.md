# セッション引き継ぎメモ（2026-08-04 更新・フェーズ7完了）

フェーズ7「議案・条例・請願・陳情アーカイブ」の基盤を実装した。push・デプロイは未実施。

## ロードマップ

1. フェーズ6：政策データ・政策比較基盤 → **完了**
2. フェーズ7：議案・条例・請願・陳情アーカイブ → **完了**
3. フェーズ8：AI横断検索・テーマ検索 → 次回
4. フェーズ9：比較・可視化・タイムライン
5. フェーズ10：自動巡回の完成・全体検証・本番デプロイ

## 直近のコミット（ローカルのみ、未push）

```
3af84bb feat: add council documents archive
5402e06 docs: フェーズ7の調査・設計をセッション引き継ぎメモへ記録
fb8d18c docs: フェーズ6完全完了を反映しセッション引き継ぎメモを更新
48832bb chore: complete policy archive validation and search indexing
87af7b1 feat: 延岡市政アーカイブの政策データ・政策比較基盤（フェーズ6）を追加
```

`git status`は`.claude/settings.local.json`（ローカル専用）以外クリーン。

停止直前に確認済み：`npm run validate:data`（errors=0、既存の推奨語彙警告＋新規
archiveCouncilDocuments.jsonの出典accessedAt未設定13件のみ）／`npm run typecheck`／
`npx oxlint`（クリーン）／`npm run build`（875ページ生成、prerender成功）／
`npm run validate:seo`（failures=0, warnings=0）すべて成功。

## 完了した作業（フェーズ7：議案・条例・請願・陳情アーカイブ）

### 設計方針

既存`billVotes.json`（546件）が条例・請願・陳情のカテゴリ・議員別賛否・議決結果を
すでに広くカバーしていたため、新規アーカイブ層は**複製せず参照する**設計にした
（歴代市長・元議員アーカイブと同じパターン）。`ArchiveCouncilDocument.existingBillVoteId`
で既存レコードを参照し、議員別賛否・出典PDFはそちらを正とする。

### 型（`src/types/historicalArchive.ts`）

`ArchiveCouncilDocumentType`（bill/ordinance/petition/request）、
`ArchiveCouncilDocument`（共通項目一式：id/slug/documentType/title/summary/number/
fiscalYear/sessionId/meetingDate/submittedDate/decisionDate/proposerType/proposerIds/
status/result/committeeId/relatedMemberIds/relatedMayorIds/relatedPolicyIds/
relatedQuestionIds/relatedBudgetIds/relatedFiscalYears/sourceRefs/verificationStatus/
notes/createdAt/updatedAt/existingBillVoteId/voteEntries）、`ArchiveCouncilDocumentDetail`
（判別可能ユニオン）、`ArchiveBillDetail`・`ArchiveOrdinanceDetail`・`ArchivePetitionDetail`・
`ArchiveRequestDetail`、`ArchiveCouncilDecision`、`ArchiveCouncilVote`
（既存`BillMemberVoteStatus`8区分＋`sourceUnavailable`＝資料未確認）、
`ArchiveCouncilRelation`（member/mayor/policy/question/budget/documentの汎用関連付け）。

### データ

`src/data/archiveCouncilDocuments.json`（13件：条例3・請願3（全件）・陳情4・議案3、
すべて既存`billVotes.json`から`existingBillVoteId`で参照・出典付きで移行。新規外部取得
なし）、`archiveCouncilRelations.json`（0件、関連付けの仕組みのみ用意）。

条例の改廃区分（`revisionType`）はタイトル文言（「一部を改正する」「廃止する」等）から
確認できる事実のみで判定し、`effectStatus`（現行/失効）は現行例規集との突合ができていない
ため全件`"unknown"`のままにした（推測で埋めていない）。施行日・公布日も未確認のため空欄。

### ページ

- `/bills`（議案アーカイブ一覧）・`/bills/:slug`（詳細）：既存の
  `<Route path="/bills" element={<Navigate to="/bills/votes" replace />} />`を
  置き換えた。既存`/bills/votes`（議員別賛否専用）・`/bills/votes/:id`・`/bills/compare`
  は無変更。
- `/ordinances`・`/ordinances/:slug`、`/petitions`・`/petitions/:slug`、
  `/requests`・`/requests/:slug`：新規。
- 実装は`src/pages/CouncilDocumentsArchivePage.tsx`1ファイルに、共通の
  `DocumentsListPage`/`DocumentDetailPage`内部コンポーネントから8つの named export
  （`BillsArchivePage`/`BillArchiveDetailPage`/`OrdinancesPage`/`OrdinanceDetailPage`/
  `PetitionsPage`/`PetitionDetailPage`/`RequestsPage`/`RequestDetailPage`）を切り出す形で
  重複実装を避けた。
- 絞り込み：年度・会期・結果（各ページ共通）。委員会・提出者の絞り込みは、現状
  確認できているデータに変化が無い（committeeIdが1件も確認できていない）ため見送った
  （下記「残っている作業」参照）。
- 詳細ページは議員別賛否（`existingBillVoteId`経由で`/bills/votes/:id`へリンク）・
  関連する一般質問・関連政策・関連財政年度・条例の改廃区分・出典を表示する。

### 検索インデックス・validate-data.mjs

- `scripts/generate-search-index.mjs`に`type: "council-document"`で13件追加
  （議案名・概要・資料番号・年度・会期・提出者・議決結果・関連政策テーマをkeywordsに）。
- `scripts/validate-data.mjs`に、id/slug重複、documentType/status/result妥当性
  （議案・条例はBillVoteResult、請願・陳情は独自の審査結果区分で別々に検証）、
  sessionId/proposerIds/relatedMemberIds/relatedMayorIds/relatedPolicyIds/
  relatedQuestionIds/existingBillVoteIdの参照整合性、sourceRefs必須、
  verificationStatus妥当性、documentTypeとdetailブロックの整合性（例：
  documentType≠"ordinance"なのにordinanceDetailがある場合はエラー）、
  請願・陳情の`petitionerCategory`が許可リスト外（＝私人の氏名等の疑い）の場合の検出を追加。
- `scripts/validate-seo.mjs`の`/bills`に関する古いnoindex前提チェック
  （`for (const p of ["/search", "/bills"])`）を、/billsが実在の索引対象ページになった
  ことに合わせて修正した（`/search`のみに変更）。

### 既存機能への影響

`/bills/votes`・`/bills/votes/:id`・`/bills/compare`・一般質問・現職/元議員・市長・
歴代市長・政策・財政・検索・SEO・5日ごとの自動巡回は無変更。`npm run build`の
プリレンダリング件数は875ページ（フェーズ6の859から純増）。

## 残っている作業（次回以降）

- **委員会マスタが存在しない**：`committee`/`committeeId`のデータが1件も確認できて
  いないため、委員会での絞り込み・参照整合性チェックは実装していない。委員会活動報告書
  等から委員会マスタを整備できた時点で追加する。
- **relatedBudgetIds・relatedPolicyIdsの参照整合性は空文字チェックのみ**：予算項目単位の
  IDマスタが未整備のため、`relatedBudgetIds`は参照整合性チェックを行っていない
  （空文字のみエラー）。`relatedPolicyIds`は`archivePolicies.json`との参照整合性を
  検証済みだが、初期データでは実際の関連付けは0件（確認できたものが無かったため）。
- **条例の効力状況（`effectStatus`）が全件`"unknown"`**：現行例規集との突合を行っていない。
  次回、延岡市の例規集公開ページを調査し、確認できたものから`inForce`/`expired`を設定する。
- **陳情の重複審査回**：`request-tsunami-evacuation-area-2025-03`
  （`doc-request-04`）と同一議題が令和7年6月・9月定例会でも継続審査・撤回として
  扱われているが（`2025-06-chinjo-6`・`2025-09-chinjo-6`）、初期データでは最初の登録分
  のみを対象とした。継続案件の追跡方法（同一documentIdで更新するか、別レコードにして
  関連付けるか）は次回設計が必要。
- **議案アーカイブ（`/bills`）の対象は代表3件のみ**：既存議案賛否（546件）全体をアーカイブ
  層へ拡張するかどうかは未定。少数の代表例のみ登録した状態。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`と`git status`で本メモと状態が一致しているか確認。
2. `npm run validate:data && npm run typecheck`で現状に問題がないか確認。
3. フェーズ8「AI横断検索・テーマ検索」の調査・設計から着手する。

## 既知の注意点・落とし穴（継続）

- **`npm run build`実行のたびに`src/data/siteUpdate.json`のタイムスタンプだけが更新される**。
  実データ変更を伴わない場合はコミットせず`git restore`で戻してよい。
- `src/data/searchIndex.json`・`public/sitemap.xml`は生成物だがGit管理下にある。
  データ・生成スクリプトを変更した場合は`npm run build`で再生成して差分をコミットに含める。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`（`scripts/lib/minutes-source.mjs`の
  `REIWA_START_YEAR`を参照）。
- 比較ページの命名規則は`/xxx/compare`ではなく`/compare/xxx`
  （既存の`/compare/mayors`・`/compare/policies`等に合わせる）。
- `validate-seo.mjs`にはpublic-routes.mjsとは独立したハードコードチェック
  （サイトマップにnoindexページが含まれていないか等）が一部あるため、既存ページの
  索引状態を変更する場合はこのファイルも確認すること（今回`/bills`変更時に見落としかけた）。
