# 自動更新パイプライン Workstream B（一般質問Updater）実装報告

作成日：2026-08-24
担当範囲：`scripts/auto-update/questions/` 配下のみ

## 1. 実装したファイル一覧

- `scripts/auto-update/questions/update-questions.mjs`（新規作成、唯一の実装ファイル）
  - 一般質問 質問通告書PDFの自動更新パイプライン本体。
  - dry-runのみで完結し、本番データ（`src/data/*.json`）への書き込みは一切行わない。

このほか、実行によって共通コア（Workstream A、編集対象外）が管理する共有ファイルが更新されている。
- `reports/auto-update/run-questions-2026-08-23T22-54-00-127Z.json`（今回のdry-run結果。直近1件のみ残置）
- `reports/auto-update/status.json`（`questions`ターゲットの連続正常実行カウントを追記。他ターゲット(bills/finance/population)の既存エントリはそのまま）

## 2. 再利用した既存処理（重複実装していないことの説明）

`scripts/sync-council-data.mjs`（5日ごと本番巡回スクリプト。一般質問 質問通告一覧
`/site/gikai/1416.html` → 最新会期の通告一覧ページの取得・HTML解析・PDFの新規/変更/削除判定を
既に実装済み）を**`node scripts/sync-council-data.mjs --dry-run`としてサブプロセス実行**し、
`reports/sync-council-data-report.json`を読み取ることで結果を再利用している
（`bills/update-bills.mjs`が`fetch-nobeoka-council-documents.mjs`をサブプロセス実行する方式と同じ設計）。

このスクリプトはHTML取得・スクレイピングロジックを一切自前で持たない。新規に追加したのは以下の4点のみ：

1. 基底スクリプトのdry-run結果と、既存スナップショット`src/data/councilWatchedDocuments.json`
   （category="question-notice"、読み取りのみ）を突き合わせ、各質問通告書PDFについて
   `src/data/generalQuestions.json`（予定質問）に「登録済み／未登録（新規候補）／内容差分あり／
   公式サイトから見えなくなった」を判定するクロスチェックロジック（`deriveSessionInfo()`は
   `sync-council-data.mjs`が既に抽出済みの`title`文字列（例："第26回延岡市議会(令和8年6月定例会)
   （6月23日 個人質問）"）を再パースする最小限のテキスト処理であり、公式サイトのHTML構造の
   取得・解析ロジックの再実装ではない）。
2. 新規候補（`generalQuestions.json`未登録）についてのみ、`core/fetch.mjs`の`fetchWithRetry`で
   実際に到達性・ハッシュを確認する（`bills/update-bills.mjs`の`probeNewDocument`と同型）。
   既知資料は`councilWatchedDocuments.json`の既存`fileHash`をそのまま差分照合に使い、
   公式サーバーへ再アクセスしない。
3. スキーマ検証：`core/validate.mjs`の`validateEntry`（`sessionId`形式・`sourceUrl`ドメイン・
   必須フィールド）。
4. GREEN/YELLOW/RED判定・サーキットブレーカー・統一レポート出力：`core/classify.mjs`の
   `classifyItem`/`checkCircuitBreaker`、`core/report.mjs`の`writeRunReport`/`updateStatus`。

`scripts/lib/council-shared.mjs`の`sha256OfBuffer`（既存の共有ヘルパー）もそのまま再利用した。
独自のハッシュ関数は実装していない。

## 3. 実際に使用した公式URL

- 入口ページ：`https://www.city.nobeoka.miyazaki.jp/site/gikai/1416.html`
- 詳細ページ（最新会期の通告一覧）：`https://www.city.nobeoka.miyazaki.jp/site/gikai/1402.html`
  （令和8年6月定例会、`sync-council-data.mjs`が自動追跡）
- 個別PDF（14件）：`https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/276xx.pdf`
  （`councilWatchedDocuments.json`に記録済みの既知資料。今回は新規0件のためPDF本体への
  追加アクセスは発生していない）

アクセスは`sync-council-data.mjs`自身のrate limit・許可ホスト検証（`www.city.nobeoka.miyazaki.jp`等）
に従っており、本Updater側でも新規候補が出た場合のみ`core/fetch.mjs`の`fetchWithRetry`
（同一ホスト最短1.5秒間隔、timeout・指数バックオフretry付き）を使う設計にしている。

## 4. 1回目dry-run結果

実行日時：2026-08-23T22:53:51.304Z（`--verbose`付き）

- 基底スクリプト（`sync-council-data.mjs --dry-run`）：正常終了（exitCode=0）。質問通告一覧は
  「前回確認時から変更なし（タイトル・更新日・会期・本文ハッシュ一致）」のため、PDFの再解析は
  スキップ（＝公式サイト側に変化なし）。
- 検出=14　GREEN=14　YELLOW=0　RED=0　ERROR=0
- 総合判定＝GREEN、サーキットブレーカー＝正常
- 全14件が既存の`generalQuestions.json`と`sourceUrl`一致・`memberId`一致・`sessionName`一致・
  `questionDate`一致（outcome="unchanged"）で、話者特定も全件`confirmed`、対象会期
  （`2026-06`）は`questionCollectionStatus.json`上でも`transcriptAvailable: false`
  （会議録未公開）のため異常検知なし。

## 5. 2回目dry-run結果（同一性・重複の有無）

実行日時：2026-08-23T22:54:00.127Z（1回目の直後に再実行）

- 検出=14　GREEN=14　YELLOW=0　RED=0　ERROR=0（1回目と完全一致）
- 1回目・2回目のレポートJSONについて、時刻系フィールド（`startedAt`/`finishedAt`/各エントリの
  `lastCheckedAt`）を除いた内容を`diff`で比較した結果、**差分ゼロ（完全一致）**を確認した。
- 新規（outcome="new"）は両回とも0件であり、同一資料が重複検出されないこと（冪等性）を確認した。
- `reports/auto-update/status.json`の`questions.consecutiveSuccessfulRuns`が1→2と正しく
  積み上がっており、実行ごとに二重集計や不整合が発生していないことも確認した。

テストで生成した`run-questions-*.json`は2件生成されたが、直近1件
（`run-questions-2026-08-23T22-54-00-127Z.json`）のみを残し、1回目分は削除済み。

## 6.「予定」と「確認済み」を混同していないことの説明

- 本Updaterは`src/data/generalQuestions.json`（予定・会議録未公開）と
  `src/data/councilSpeechSummaries.json`（確認済み・会議録本文で内容確認済み）を、
  それぞれ別々の読み取り専用の照合対象として扱っている。**新規に検出した通告書は、
  常に「予定質問の追加候補」としてのみ分類し（outcome="new"）、確認済みへ昇格させる処理は
  一切実装していない。**
- 予定/確認済みの境界を機械的に監視するため、通告書の対象会期（`sessionId`、
  `title`文字列から導出）が`src/data/questionCollectionStatus.json`上で
  既に`transcriptAvailable: true`（会議録確認済み）の場合は`anomalyDetected=true`とし、
  `core/classify.mjs`の仕様どおり**無条件でRED**（自動反映対象外）にする設計にした。
  これにより、「予定質問として検出したはずの会期が、実はもう会議録確認済みだった」という
  状態を自動でGREEN/YELLOWとして見逃すことがない。
- 話者（議員）自動特定ができていない通告書（`speakerIdentificationStatus !== "confirmed"`）も
  常に人間確認（YELLOW以上）とし、`memberId`不明のまま予定質問へ追加されることを防いでいる。
- 既存の予定質問との重複登録を防ぐため、`sourceUrl`を基本キーに`generalQuestions.json`と
  照合し、一致すれば"unchanged"（変更なし・重複登録の心配なし）、`memberId`/`sessionName`/
  `questionDate`のいずれかが食い違えば"updated"（差分あり、人間確認）としている。

## 7. 未実装・今後の課題

- **`sync-council-data.mjs`のdry-runモードにおける既知の制限**：同スクリプトのdry-run時、
  質問通告一覧について新規/更新の**件数**は`reports/sync-council-data-report.json`に
  記録されるが、**個別のURL**は記録されない仕様（公式サーバー負荷対策として、dry-run中は
  新規PDFの再取得・記録自体を行わないため）。今回の実行では新規0件だったためこの制限は
  顕在化しなかったが、将来新しい会期の通告書が公開された直後にこのUpdaterを実行した場合、
  基底スクリプトの集計上は新規件数が計上されても、本Updaterのentriesにはその新規PDFの
  詳細が反映されない可能性がある。この場合はnoteフィールドへその旨を明記し、総合判定を
  少なくともYELLOWへ引き上げる分岐は実装済みだが、実際にこのケースを実データで
  再現・検証することはできていない（新しい会期が公開されるタイミングを待つ必要がある）。
  恒久対応としては、`sync-council-data.mjs`側（担当外）でdry-run時にも新規検出URLの一覧を
  レポートへ出力するよう改修することが望ましい。
- 本Updaterは`generalQuestions.json`への実際の書き込み（予定質問としての追加・更新）は
  行っていない（要件通りdry-runのみ）。GREEN自動反映を有効化する場合は、別途
  「予定質問追加用の本番反映スクリプト」と人間承認フローの設計が必要（未着手）。
- `councilWatchedDocuments.json`のcategory="question-notice"レコードのうち、
  2026-08-03以前に取得された一部レコードには`sessionTitle`/`questionDate`の専用フィールドが
  無く、`title`文字列からの再パースに頼っている。今後`sync-council-data.mjs`側でこれらの
  専用フィールドが常に付与されるようになれば、本Updater側の`deriveSessionInfo()`は
  フィールドを直接参照する形へ簡素化できる（担当外のため今回は変更していない）。
- 臨時会（`-extraordinary`）の質問通告書については、今回の実データ（令和8年6月定例会のみ）
  では検証できていない。`deriveSessionInfo()`は臨時会パターンにも対応する正規表現を
  実装済みだが、実データでの動作確認は未実施。
