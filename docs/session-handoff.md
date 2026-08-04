# セッション引き継ぎメモ（2026-08-04 更新・フェーズ10B完了）

フェーズ9（9A〜9D）・フェーズ10A（自動巡回基盤）は完了・コミット済み。今回は**フェーズ10B
（実データ巡回・差分検知）**が完了した。push・デプロイは未実施。**フェーズ10C（AI解析・自動登録）
は開始していない**。

フェーズ9・10Aの詳細は本メモには残していない（`git log`の各コミットメッセージを参照）。

## ロードマップ

1. フェーズ6〜9（政策比較基盤〜比較・可視化・タイムライン） → **すべて完了**
2. フェーズ10：自動巡回の完成・全体検証・本番デプロイ
   - 10A：自動巡回基盤（ダミー実装） → 完了
   - **10B：実データ巡回・差分検知 → 完了**（今回。取得したデータのサイトへの反映＝
     AI解析・自動登録は行っていない）
   - 10C以降：AI解析・自動登録、全体最終検証、GitHubへpush、Cloudflare Pagesデプロイ確認等 →
     未着手（フェーズ10の内訳は過去に複数回、内容の異なる指示を受け取っているため、
     着手前にユーザーに範囲を確認すること）

## 完了した作業（フェーズ10B：実データ巡回・差分検知）

**実際にHTTP取得を行った**（10Aはダミー実装だったが、今回は本物のfetch）。取得したデータの
サイトデータ（`src/data/archiveFiscalYears.json`等）への反映（AI解析・自動登録）は行っていない
（`archiveCrawlerState.json`という巡回専用の状態ファイルのみ更新）。

### 巡回対象と方式（13対象）

- **既存実装への統合**（重複取得しない）：一般質問（`general-question`）・議員名簿
  （`member-roster`）は`reports/sync-council-data-report.json`を、議案・条例・請願・陳情
  （`bill`/`ordinance`/`petition`/`request`、4対象とも同一の議案審議結果一覧ページ）は
  `reports/council-document-update-report.json`を読み込み、既存スクリプトの実行結果を
  `ArchiveCrawlerResult`へマッピングした（再取得していない）。
- **実際にHTTP取得**（`scripts/lib/city-site-fetch.mjs`を再利用）：財政（`finance`、
  健全化判断比率等の公表ページ）・人口（`population`、xls）・基金（`fund`、PDF）の3対象。
  許可ドメイン（`www.city.nobeoka.miyazaki.jp`）内のURLのみ取得している。
- **スキップ**（推測でアクセスしない）：市長（`mayor`）は監視対象URLが市長個人サイト
  （`hisatomo-m.jp`）で許可ドメイン外のため取得していない（費用対効果よりも、
  city-site-fetch.mjsの許可ドメイン制限という既存の安全策を尊重する判断。フェーズ10Aで
  一つの対象にまとめている「歴代市長・現職市長」は今回も分割していない＝歴代市長個別の
  公式ページは確認できておらず、現職市長の監視は上記の理由で対象外）。市債（`debt`）・
  政策（`policy`）・テーマ（`theme`）は監視対象URLが未確認/複数出典に分散のため引き続きスキップ。

### 差分検知方式

- 一般質問・議員名簿・議案等：既存スクリプトのレポートが持つnew/updated/unchanged件数
  （議員名簿は`changed`真偽値）をそのまま採用。
- 財政・人口・基金：取得したバイト列のSHA-256ハッシュを`scripts/lib/city-site-fetch.mjs`の
  `sha256OfBuffer()`で算出し、前回ハッシュ（`archiveCrawlerState.json`）と比較。
  前回ハッシュが無ければ`new`、一致すれば`unchanged`、異なれば`changed`。

### 更新判定・状態保存

`ArchiveCrawlerRunStatus`を`"ok"`から`"new" | "changed" | "unchanged" | "possiblyRemoved" |
"error" | "skipped"`へ整理（フェーズ10Aの型を拡張）。`archiveCrawlerState.json`が保持する項目：

- `lastRunAt`（最終巡回日時）／`lastSuccessfulRunAt`（最終成功日時、120時間ゲートの起点）
- 対象ごとの`lastCheckedAt`・`lastSuccessfulAt`・`lastUpdatedAt`（新規/変更検出日時）・
  `lastStatus`・`lastContentHash`・`consecutiveNotFoundCount`（削除判定用）
- `totalCount`（対象件数）・`changedCount`（新規+変更の差分件数）・`removedCount`（削除候補件数）・
  `errorCount`（失敗件数）

### エラー処理

`scripts/lib/city-site-fetch.mjs`（既存、変更していない）が429（Retry-After尊重・1回再試行）・
403（連続再試行しない）・5xx（最大2回再試行）・15秒タイムアウトを既に実装済みだったため再利用。
今回`scripts/run-archive-crawler.mjs`に追加したのは、タイムアウト等のネットワークエラーの
1回リトライ（既存インフラが対応していなかった箇所のみ追加）。404は2回連続で初めて
`possiblyRemoved`（削除候補）とし、1回だけの失敗では削除候補にしない。

### 削除判定

`shouldFlagAsPossiblyRemoved(consecutiveNotFoundCount, hasAlternateUrlCandidate)`
（フェーズ10Aで用意済み）：2回以上連続で取得できず、かつ代替URLが無い場合のみ`possiblyRemoved`。
今回の実行では404は発生しなかった（該当なし）。

### 実行して見つかった重要な制約（正直に記録）

`finance`（財政健全化判断比率等の公表ページ、HTML）を数分間隔で2回実際に取得したところ、
**内容が変わっていないはずなのにSHA-256ハッシュが一致しなかった**（`changed`と誤判定）。
`Last-Modified`ヘッダーも取得時刻に近い値を返しており、ページが動的生成されている
（本文に生成時刻等の変動要素を含む）可能性が高い。一方、`population`（xls）・`fund`（pdf）は
2回とも同一ハッシュで一致し、安定して差分検知できた。**HTMLページの生バイト列比較は
誤検知（false positive）のリスクがあり、そのまま自動反映の判断根拠にするのは危険**。
本文の特定部分のみを抽出して比較する等の改善が今後必要（今回は時間の都合で見送り、
既知の注意点として記録するに留めた）。

### 変更したファイル

- `src/types/archiveCrawler.ts`：ステータス種別の整理（new/possiblyRemoved追加）、
  `ArchiveCrawlerTargetState`に`lastUpdatedAt`・`consecutiveNotFoundCount`追加、
  `ArchiveCrawlerState`に`removedCount`追加。
- `src/lib/archiveCrawler.ts`：`determineFetchStatus()`（ハッシュ比較による新規/変更/変更なし
  判定）・`summarizeResults()`を追加。引き続きNode専用API（実際のfetch・`node:crypto`）は
  呼び出さない（判定ロジックのみ、環境非依存）。
- `scripts/run-archive-crawler.mjs`：既存レポート統合・実際のHTTP取得・ネットワークエラー
  リトライを追加した本実装（10Aはダミーのみ）。
- `.github/workflows/civic-archive-sync.yml`：コメントを更新（ダミー実装の説明を削除）。
  **コミット・PR作成の挙動は変更していない**（引き続き行わない。データのサイトへの反映は
  次フェーズの範囲）。
- `scripts/validate-data.mjs`：巡回結果整合性（`changedCount`等が`totalCount`を超えない）・
  `lastStatus`の妥当性・削除判定の妥当性（`possiblyRemoved`は`consecutiveNotFoundCount`が
  2以上の場合のみ）を追加。

## 検証結果（フェーズ10B）

- `node scripts/run-archive-crawler.mjs --force`をローカルで**実際に2回**実行し、
  実HTTP取得（財政・人口・基金、3件）・120時間ゲート（2回目は`--force`無しで正しく
  スキップされることを確認）・差分検知（xls/pdfは安定、htmlは上記の制約あり）が
  動作することを確認した。取得統計：checked=3, 429/403/5xx=0, errors=0（実行のたびに増える）。
- `npm run validate:data`：errors=0, warnings=1257（既存警告のみ、新規警告0件）。
- `npm run typecheck`：エラーなし。
- `npx oxlint`：クリーン。
- `npm run build`：912ページ生成（新規Reactページなし、ページ数前回と同一）。
- `npm run validate:seo`：failures=0, warnings=0。

## 既知の注意点・落とし穴（継続）

- **HTMLページ（`finance`ターゲット）のSHA-256全文比較は動的生成コンテンツにより誤検知しうる**
  （上記「実行して見つかった重要な制約」参照）。今後、自動反映に使う場合は本文の安定部分のみを
  抽出する等の改善が必要。xls/pdf（`population`・`fund`）は問題なし。
- `mayor`ターゲットの監視対象URL（`hisatomo-m.jp`）は`scripts/lib/city-site-fetch.mjs`の
  許可ドメイン外のため取得できない。市長の巡回を実装する場合は、別のfetchクライアントを
  用意するか、市の公式サイト内に市長プロフィールページが無いか確認すること
  （推測でドメイン許可リストを広げない）。
- `npm run build`実行のたびに`src/data/siteUpdate.json`等のタイムスタンプだけが更新される。
  実データ変更を伴わない場合はコミットせず`git restore`で戻す。
- `scripts/`配下のNode実行スクリプトは、ビルド前の`src/`配下のTypeScriptを直接importできない。
  同じロジックが必要な場合は`.mjs`側にミラー実装する。
- 自動巡回関連のローカル状態ファイル（`scripts/_sync-state.json`・
  `scripts/_archive-crawler-sync-state.json`）はGit管理外。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`。会計年度は4月始まり。
- 比較ページのクエリパラメータは年度ベースが`?years=`、市長・議員・政策比較が`?items=`
  （統一していない）。
- 委員会マスタが存在しない（`committeeId`は1件も確認できていない）。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`と`git status`で本メモと状態が一致しているか確認。
2. `npm run validate:data && npm run typecheck`で現状に問題がないか確認。
3. フェーズ10の残り（AI解析・自動登録、全体最終検証、push、デプロイ確認等）に着手する場合は、
   範囲・順序をユーザーに確認してから着手する（フェーズ10の内訳定義は過去に複数回変わっている）。
4. 可能であれば`/timeline`・`/compare/*`等をブラウザで375px・390px・768px・1280pxで確認する
   （フェーズ9A以降、実機確認が未実施のまま）。
