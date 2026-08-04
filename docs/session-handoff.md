# セッション引き継ぎメモ（2026-08-04 更新・フェーズ9C完了）

フェーズ9「比較・可視化・タイムライン」を小分けで進めている。今回は**フェーズ9C（市長・議員・政策比較）**が完了した。
push・デプロイは未実施。**フェーズ9D・フェーズ10は開始していない**。両方の詳細指示は本セッション中に
ユーザーから受領済みだが、フェーズ9Cの検証・コミットが終わる前に立て続けに届いたため、
「一度に複数の大規模タスクを開始しない」という運用方針に従い、今回はフェーズ9Cのみを完了させて停止した。
詳細は下記「次にやること」を参照。

## ロードマップ

1. フェーズ6：政策データ・政策比較基盤 → 完了
2. フェーズ7：議案・条例・請願・陳情アーカイブ → 完了
3. フェーズ8：AI横断検索・テーマ検索 → 完了
4. フェーズ9：比較・可視化・タイムライン
   - 9A：共通型・共通コンポーネント・`/compare`入口整理・`/timeline`基盤ページ → 完了
   - 9B：財政比較・グラフ・年度別タイムライン → 完了
   - **9C：市長・議員・政策比較 → 完了**
   - 9D：テーマ別タイムライン・compare/timeline全体の導線整理・出典表示統一等 →
     詳細指示を受領済み、未着手（下記「次にやること」参照）
5. フェーズ10：自動巡回の完成・全体検証・本番デプロイ → 詳細指示を受領済み、未着手（同上）

## 完了した作業（フェーズ9C）

### 追加・変更したページ

- `/compare/mayors`：既存の任期・就任回数比較に加え、在籍年数（概算、暦年ベース）・関連政策件数・
  関連議案条例請願陳情件数を比較表へ追加。件数（在籍年数／関連政策件数／関連議案等件数）を選んで
  棒グラフで比較できるトグルを追加。表示コンポーネントを`FinanceTable`から`CompareTable`へ統一。
- `/compare/members`（新規）：現職議員・元議員を横断して2〜4名を選び比較する新規ページ。
  氏名（`/people/:slug`へリンク）・区分・会派・在籍状況・関連政策件数・関連議案等件数・
  議案賛否記録件数・確認状況を比較表で表示。件数トグル＋棒グラフあり。出典は現職議員の
  `profileUrl`・`sources`、元議員の`sourceNote`を`CompareSourceNotice`向けに変換して表示
  （元議員は構造化出典URLが無いため「出典未登録」表示になる場合がある）。
- `/compare/policies`：発表時期（`announcedDate`）・関連財政年度・関連一般質問件数・関連議案件数を
  比較表へ追加。`relatedQuestionIds`/`relatedBillVoteIds`が未設定（未整理）の場合は「確認中」、
  設定済みでゼロ件の場合は「0件」と区別している。件数トグル＋棒グラフを追加。
  表示コンポーネントを`FinanceTable`から`CompareTable`へ統一。
- `/compare`（入口）：「議員の比較」（`/compare/members`）へのリンクを追加。
- `/people/:slug`：ヒーロー部の「プロフィール・発言記録の詳細を見る」の隣に「この人物を比較」
  導線を追加（フェーズ8で残していたコメントを実装）。市長は`/compare/mayors?items=<id>`、
  議員・元議員は`/compare/members?items=<slug>`へ、この人物を選択済みの状態でリンクする。

### 実装内容（共通基盤・重複実装を避けるための整理）

- `src/lib/people.ts`：`voteCountForPerson()`を追加（既存`PeoplePage.tsx`にインライン重複していた
  「議員別賛否記録件数」ロジックを共通化し、`PeoplePage.tsx`側もこの関数を使うよう置き換えた）。
  `buildPersonIndex()`・`policiesForPerson()`・`councilDocumentsForPerson()`（いずれもフェーズ8で
  実装済み）を`/compare/mayors`・`/compare/members`から再利用し、集計ロジックを複製していない。
- 市長・議員・政策の比較件数（政策件数・議案等件数・議案賛否件数・関連一般質問件数）は、
  いずれも登録済みデータを実際にフィルタした結果の件数であり、独自の点数化・優劣判定ではない。

### 比較できる件数・グラフ

- 市長・議員：2〜4名。政策・議案条例請願陳情・議案賛否の関連件数を`FinanceBarChart`（既存の
  財政比較ページで使っているものと同一コンポーネント）で比較する棒グラフを追加。新規グラフ
  ライブラリは追加していない。
- 政策：2〜4件。関連一般質問・関連議案件数の棒グラフを追加。

### 欠損状態

- 議員の会派・出典・元議員の在籍状況等は「確認中」で表示し、0件と区別。
- 政策の`relatedQuestionIds`/`relatedBillVoteIds`は「未設定＝確認中」「設定済み0件＝0件」を明確に
  区別（配列がundefinedかどうかで判定）。

## 検証結果（フェーズ9C）

- `npm run validate:data`：errors=0, warnings=1257（既存警告のみ、新規警告0件。新規データファイルは
  追加していないため`validate:data`自体への追加は行っていない）
- `npm run typecheck`：エラーなし
- `npx oxlint`：クリーン
- `npm run build`：912ページ生成（前回911→+1、`/compare/members`）、prerender成功
- `npm run validate:seo`：failures=0, warnings=0
- 生成HTML確認：`/compare/members`（title・`robots: noindex, follow`を確認）、`/compare`
  （「議員の比較」リンクを確認）、`/people/mayor-mayor-01`・`/people/member-m01`
  （「この人物を比較」リンクとhref `/compare/mayors?items=mayor-01`・`/compare/members?items=member-m01`
  を確認）をそれぞれgrepで確認済み。
- **ブラウザでの実機確認は未実施**（Chrome拡張が本セッションでも未接続。フェーズ9A・9Bから継続する
  既知の制約）。

## 次にやること

本セッション中に、フェーズ9C完了前の段階でユーザーからフェーズ9D・フェーズ10の詳細指示が
立て続けに届いたが、実装済み・検証済みの内容だけを完了と報告する方針のため、今回は着手していない。
次回セッションはこの2つのどちらかから再開する想定。

### フェーズ9D「比較・可視化・タイムラインの仕上げ」（受領済み指示の要約）

1. テーマ別タイムライン：各テーマ（`/themes/:slug`）ごとに一般質問・政策・議案・条例・請願・陳情・
   予算・決算・市債・基金・人口・市長・議員を時系列表示。AI分類候補のみのものは「AI候補」と明示。
2. 人物ページ・テーマページ・検索結果から比較・タイムラインへの導線追加
   （「この人物を比較」は今回9Cで実装済み。「このテーマを比較」「このテーマの年表を見る」
   「この年度を見る」「関連政策・議案・条例を見る」等は未実装）。
3. `/compare`・`/timeline`全体の導線整理。
4. AI候補表示の最終整理、出典・定義・確認状況表示の統一。
5. SEO・サイトマップ更新、validate:data拡張（timelineイベント重複・compare対象存在確認・
   theme/person/policy存在確認・関連ID存在確認・AI候補混入確認等）。

### フェーズ10「自動巡回・最終検証・本番デプロイ準備」（受領済み指示の要約）

1. 自動巡回システム完成（議会サイト・質問主意書・議案条例請願陳情・市長ページ・財政ページ・
   人口統計・サイトマップの巡回）。既存`.github/workflows/sync-council-data.yml`・
   `scripts/sync-council-data.mjs`（フェーズ8以前に基盤あり）の調査から着手すること。
2. 5日に1回のGitHub Actions巡回設定（手動実行対応・差分取得・削除検知・更新日時記録・ログ保存）。
3. AI解析（新規データのみ・AI候補生成・公式データと完全分離・verificationStatus付与）。
4. 通知（更新件数・カテゴリ・取得失敗・削除検知。Slack/メール等は実装せず拡張ポイントのみ）。
5. validate:data最終版、検索最終確認、SEO最終確認、パフォーマンス確認（build/prerender/不要import/
   bundle）。
6. 最終検証（validate:data/typecheck/lint/build/validate:seo）、docs/session-handoff.md更新。

**重要**：フェーズ10着手時は、まず`git log`・`docs/session-handoff.md`で実際にフェーズ1〜9が
完了しているか確認すること。ユーザー指示に「フェーズ1〜9は完了済み」とあっても、実際のリポジトリ
状態（コミット履歴・このメモ）を正として確認してから着手する。

## 既知の注意点・落とし穴（継続）

- **`npm run build`実行のたびに`src/data/siteUpdate.json`・`archiveAiCategoryCandidates.json`・
  `archiveRelationCandidates.json`・`adminReviewQueue.json`のタイムスタンプだけが更新される**。
  実データ変更を伴わない場合はコミットせず`git restore`で戻す（今回も実施）。
- `ArchiveDebt`・`ArchiveFund`の`sourceRefs`は型のトップレベルではなく`balance.sourceRefs`にネスト
  されている。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`。会計年度は4月始まり（1〜3月は前年度扱い）。
- 比較ページの命名規則は`/xxx/compare`ではなく`/compare/xxx`。年度ベースの比較ページ
  （finance/budget/debt/funds/population）は`?years=`、市長・議員・政策比較は`?items=`
  （歴史的経緯、統一していない）。
- 議員・元議員のid空間（`m01`等／`fm01`等）はプレフィックスで衝突しないことを確認済み。
  `/people/:slug`のslugは`personType-id`形式（例："member-m01"）で、比較ページの選択IDにも
  この形式（議員のみ）を使っている。
- 委員会マスタが存在しない（`committeeId`は1件も確認できていない）。
- `validate-seo.mjs`には`public-routes.mjs`とは独立したハードコードチェックが一部ある。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`と`git status`で本メモと状態が一致しているか確認。
2. `npm run validate:data && npm run typecheck`で現状に問題がないか確認。
3. 可能であれば`/compare/members`・`/people/mayor-mayor-01`をブラウザで375px・390px・768px・
   1280pxで確認する（フェーズ9A〜9Cとも実機確認が未実施のまま）。
4. 上記「次にやること」のフェーズ9Dまたはフェーズ10のどちらかに、ユーザーの指示を確認の上で着手する。
