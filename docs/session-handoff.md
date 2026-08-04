# セッション引き継ぎメモ（2026-08-04 更新・フェーズ10A完了）

フェーズ9（9A〜9D：比較・可視化・タイムライン）は完了・コミット済み。今回は**フェーズ10A
（自動巡回基盤）**が完了した。push・デプロイは未実施。**フェーズ10B以降は開始していない**。

フェーズ9（9A〜9D）の詳細は本メモには残していない（`git log`の各コミットメッセージを参照）。
このメモは直近フェーズの状態・次にやることを中心に記録する。

## ロードマップ

1. フェーズ6〜9（政策比較基盤〜比較・可視化・タイムライン） → **すべて完了**
2. フェーズ10：自動巡回の完成・全体検証・本番デプロイ
   - **10A：自動巡回基盤 → 完了**（今回。実データ取得・AI解析・push・デプロイは行っていない）
   - 10B以降：ユーザーから複数回、内容の異なる指示を受領済み（下記「フェーズ10Bの定義について
     の注意」参照）。未着手。

## 完了した作業（フェーズ10A：自動巡回基盤）

「基盤のみ」実装。実際のHTTP取得・AI解析・push・デプロイは行っていない。

### 既存実装の調査（重複実装を避けるため）

着手前に、この用途の自動化がすでに存在するか調査した。

- `.github/workflows/sync-council-data.yml` + `scripts/sync-council-data.mjs`
  （5日間隔・120時間ゲート・bot branch経由PR、既存実装）：一般質問質問通告
  （question-notice）・議員名簿変更検知（member-roster-watch）・会議日程・意見書決議・
  委員会活動報告書を既に巡回している。
- `scripts/fetch-nobeoka-council-documents.mjs` + `scripts/generate-council-documents.mjs`
  （既存実装）：議案審議結果一覧ページ（議案・条例・請願・陳情）を既に取得している。

このため、今回追加した巡回対象定義（`archiveCrawlerTargets.json`）では、これらと重複する
カテゴリに`existingImplementation`フィールドで既存スクリプトのパスを明記し、ダミー巡回では
常にスキップする（重複取得しない）設計にした。

### 追加したファイル

- `src/types/archiveCrawler.ts`（新規）：`ArchiveCrawlerTarget`・`ArchiveCrawlerResult`・
  `ArchiveCrawlerLog`・`ArchiveCrawlerTargetState`・`ArchiveCrawlerState`・
  `ArchiveCrawlerCategory`（13種）。
- `src/data/archiveCrawlerTargets.json`（新規）：巡回対象13件。すべて実在するURL
  （`financeDashboard.json`・`mayor.json`・`members.json`・既存sync scriptsが既に参照している
  URLを再利用、推測のURLは追加していない）。市債（`debt`）・政策（`policy`）・テーマ（`theme`）は
  単一の公式監視対象ページが無い/未確認のため`url: null`。
- `src/lib/archiveCrawler.ts`（新規）：`runDummyCrawl()`（対象ごとに
  既存実装ありなら"skipped"、url未確認なら"skipped"、それ以外は"unchanged"を返すダミー実装）・
  `shouldFlagAsPossiblyRemoved()`（削除判定：2回連続未検出、かつ代替URL無しの場合のみ削除候補、
  ダミー実装では未使用）・`mergeCrawlerState()`。
- `src/data/archiveCrawlerState.json`（新規）：初期状態。`scripts/run-archive-crawler.mjs`を
  ローカルで実際に1回実行して動作確認した結果を反映している（対象13件、変更0、エラー0、
  9件skipped＝既存実装ありまたはurl未確認、4件unchanged＝url確認済み・既存実装なし）。
- `scripts/run-archive-crawler.mjs`（新規）：CI実行用のプレーンJSランナー。
  `src/lib/archiveCrawler.ts`と同じ判定ロジックをミラー実装している（このプロジェクトの
  scripts/配下は他ファイルと同様、ビルド前のTypeScriptを直接importできないため。
  `scripts/lib/public-routes.mjs`の既存コメントと同じ理由）。ロジック変更時は両方を更新すること。
  `--force`で120時間ゲートを無視できる。
- `.github/workflows/civic-archive-sync.yml`（新規）：5日間隔（120時間ゲート、
  `sync-council-data.yml`と同じ方式）・`workflow_dispatch`（forceオプション付き）・
  `timeout-minutes: 10`・`concurrency`グループ・ログはGitHub Actions Summary＋コンソール出力。
  **今回はダミー実装のためcommit・PR作成は行わない**（実データ取得を実装する時点で
  `sync-council-data.yml`と同じbot branch経由PR方式を追加する）。

### 変更した既存ファイル

- `scripts/lib/sync-state.mjs`：`loadLocalState()`・`saveLocalState()`に`statePath`引数を追加
  （デフォルトは既存の`scripts/_sync-state.json`のため後方互換）。新しい巡回ジョブ
  （`run-archive-crawler.mjs`）が120時間ゲートの状態ファイルを分離して使えるようにした
  （既存の`sync-council-data.mjs`とゲートが混ざらないように）。
- `.gitignore`：`scripts/_archive-crawler-sync-state.json`（新しいゲート状態ファイル、
  Git管理外）を追加。
- `scripts/validate-data.mjs`：巡回対象の重複ID・URL重複（既存実装が食い違う場合のみ警告、
  bill/ordinance/petition/requestが同一URLを意図的に共有するのは許容）・category妥当性・
  url形式・`archiveCrawlerState.json`とのstate整合性（存在しない対象IDの参照、日時形式、
  件数の非負性）を検証する処理を追加。

## 検証結果（フェーズ10A）

- `npm run validate:data`：errors=0, warnings=1257（既存警告のみ、新規警告0件）。
  意図的に対象IDを重複させて新チェックが実際に発火することを確認済み（その後、正しい内容に戻した）。
- `npm run typecheck`：エラーなし（`tsconfig.app.json`の`include: ["src"]`により、
  未importの新規ファイルも型検査対象になっていることを確認）。
- `npx oxlint`：クリーン。
- `npm run build`：912ページ生成（新規Reactページは追加していないためページ数は前回と同一。
  `archiveCrawler`関連コードはどのページからもimportされていないため、ビルド後のバンドルに
  含まれない＝バンドルサイズへの影響なしを確認）。
- `npm run validate:seo`：failures=0, warnings=0。
- `node scripts/run-archive-crawler.mjs`をローカルで実際に実行し、120時間ゲート判定・
  ダミー巡回・`archiveCrawlerState.json`の更新が動作することを確認済み。

## フェーズ10Bの定義についての注意

本セッション中、フェーズ10の内訳についてユーザーから複数回、内容の異なる指示を受け取っている。

1. 1回目：10A＝自動巡回基盤、10B＝全体最終検証と公開前監査、10C＝GitHubへpush、
   10D＝Cloudflare Pagesデプロイ確認（10A・10B完了後にいったん停止、10C・10Dは明示許可待ち）。
2. 2回目（今回のフェーズ10A実施指示）：「フェーズ10B（実データ巡回）は開始しないでください」
   とあり、10Bを「実データ巡回」と表現している（1回目の「全体最終検証」という定義と異なる）。

次回、フェーズ10Bに着手する際は、どちらの定義（全体最終検証／実データ巡回）を指すか
ユーザーに確認すること。指示文だけで判断せず、`git log`・このメモ・実際のリポジトリ状態を
正として確認してから着手する（本セッションでは実際に前段階が未完了の状態で
「フェーズ1〜9（またはフェーズ1〜9D）は完了済み」という前提の指示が複数回届いたことがある）。

## 既知の注意点・落とし穴（継続）

- **`npm run build`実行のたびに`src/data/siteUpdate.json`・`archiveAiCategoryCandidates.json`・
  `archiveRelationCandidates.json`・`adminReviewQueue.json`のタイムスタンプだけが更新される**。
  実データ変更を伴わない場合はコミットせず`git restore`で戻す。
- `scripts/`配下のNode実行スクリプトは、ビルド前の`src/`配下のTypeScriptを直接importできない
  （Vite/tsxのようなトランスパイル実行環境が入っていないため）。同じロジックが必要な場合は
  `.mjs`側にミラー実装する（`scripts/lib/public-routes.mjs`・今回の
  `scripts/run-archive-crawler.mjs`と同じパターン）。
- 自動巡回関連のローカル状態ファイル（`scripts/_sync-state.json`・
  `scripts/_archive-crawler-sync-state.json`）はGit管理外。GitHub Actions側は`actions/cache`で
  実行間を跨いで保持する。
- 一般質問・議案・条例・請願・陳情・議員名簿の自動巡回は`sync-council-data.yml`・
  `fetch-nobeoka-council-documents.mjs`が既に担っている。歴代市長・財政・人口・基金・市債・政策・
  テーマの自動巡回は`archiveCrawlerTargets.json`に対象定義のみあり、実装は未着手（フェーズ10B以降）。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`。会計年度は4月始まり。
- 比較ページのクエリパラメータは年度ベース（finance/budget/debt/funds/population）が`?years=`、
  市長・議員・政策比較が`?items=`（統一していない）。
- 委員会マスタが存在しない（`committeeId`は1件も確認できていない）。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`と`git status`で本メモと状態が一致しているか確認。
2. `npm run validate:data && npm run typecheck`で現状に問題がないか確認。
3. フェーズ10Bに着手する場合は、上記「フェーズ10Bの定義についての注意」を踏まえ、
   ユーザーに意図（全体最終検証か、実データ巡回か）を確認してから着手する。
4. 可能であれば`/timeline`・`/compare/*`等をブラウザで375px・390px・768px・1280pxで確認する
   （フェーズ9A以降、実機確認が未実施のまま）。
