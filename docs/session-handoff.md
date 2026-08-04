# セッション引き継ぎメモ（2026-08-04 更新・フェーズ10C完了）

フェーズ9（9A〜9D）・フェーズ10A（自動巡回基盤）・フェーズ10B（実データ巡回・差分検知）は
完了・コミット済み。今回は**フェーズ10C（AI候補生成・自動登録準備・定期運用統合）**が完了した。
**push・Cloudflare Pagesへのデプロイは行っていない**。

フェーズ9・10A・10Bの詳細は本メモには残していない（`git log`の各コミットメッセージを参照）。

## ロードマップ

1. フェーズ6〜9（政策比較基盤〜比較・可視化・タイムライン） → **すべて完了**
2. フェーズ10：自動巡回の完成・全体検証・本番デプロイ
   - 10A：自動巡回基盤（ダミー実装） → 完了
   - 10B：実データ巡回・差分検知 → 完了
   - **10C：AI候補生成・自動登録準備・定期運用統合 → 完了**（今回）
   - 10D以降：最終検証・push・Cloudflare Pagesデプロイ → **未着手**。
     本セッション中、10Cの検証・コミットが終わる前に「フェーズ1〜10Cは完了・デプロイ済み」という
     前提でpush・デプロイを求める指示が複数回届いたが、実際の状態（このメモ・`git log`）と
     一致しないため実行していない。次回、実際にpush・デプロイへ進む場合は、まずこのメモと
     `git status`／`git log`でリポジトリの実状態を確認したうえで、ユーザーに実行の意思を
     改めて確認すること（push・Cloudflare Pagesデプロイは不可逆・公開影響のある操作のため）。

## 完了した作業（フェーズ10C：AI候補生成・自動登録準備・定期運用統合）

**AI生成内容を公式データへ混入させない**という基本方針を維持。外部AI APIは実際には
一度も呼び出していない（呼び出しコード自体を実装していない。既定でも明示有効化時でも
安全にskipされる設計）。

### 既存基盤の再利用（重複実装しなかったもの）

- `ArchiveAiSummary`・`ArchiveAiCategoryCandidate`・`ArchiveRelationCandidate`・
  `ArchiveCandidateStatus`・`ArchiveRelationType`・`ArchiveRelationMethod`・
  `ArchiveSearchDocumentType`（すべてフェーズ8で実装済み、`src/types/historicalArchive.ts`）：
  そのまま再利用。新しい並行型は作っていない。
- テーマ分類のキーワード一致ロジック（`src/lib/themeClassification.ts`の
  `matchPolicyCategoriesForText`と同一のもの）：`scripts/generate-theme-candidates.mjs`に
  複製されていたものを`scripts/lib/theme-classification.mjs`（新規、純関数）へ切り出し、
  三重に複製しないようにした。
- テーマ分類候補・関連資料候補の生成ロジック本体：`scripts/generate-theme-candidates.mjs`
  （フェーズ8）から`scripts/lib/theme-candidates-generator.mjs`（新規、純関数
  `generateThemeCandidates()`）へ切り出し、`scripts/generate-theme-candidates.mjs`（既存の
  `npm run generate:theme-candidates`・`npm run build`から変更なく呼ばれる）と
  `scripts/run-archive-ai-processor.mjs`（新規）の両方から**同じ関数**を呼ぶようにした
  （出力内容が完全に一致することをリファクタ直後に実行確認済み。テーマ分類・関連資料候補の
  生成ロジックは1箇所にしかない）。
- `verificationStatus`・`sourceTextHash`・管理者向け要確認キュー（`adminReviewQueue.json`・
  `generate-admin-review-queue.mjs`）・`archivePolicyCategories.json`：既存のものをそのまま使用。
  要確認キューには、新設したAIジョブの`needsReview`/`failed`と、人物候補
  （`archiveEntityExtractionCandidates.json`）の未確認分を集計する処理だけを追加した
  （集計ロジック自体は同じ関数・同じファイルへの追記）。

### 追加した型（`src/types/historicalArchive.ts`）

- `ArchiveAiJobType`（`summary`/`categoryClassification`/`relationCandidate`/`entityExtraction`）・
  `ArchiveAiJobStatus`（`pending`/`processing`/`completed`/`failed`/`skipped`/`needsReview`）・
  `ArchiveAiJob`（同一`(sourceEntityId, jobType, sourceTextHash)`の重複ジョブを作らない設計）。
- `ArchiveEntityExtractionCandidate`（人物・固有表現候補。既存マスタに一致した場合のみ
  `candidateIds`へ実在IDを入れ、一致しない場合は`rawName`のみ・`needsReview=true`で保存）。

### 追加・変更したJSON

- `src/data/archiveAiJobs.json`（新規）：フェーズ10Cで初めて登場するジョブキュー。
  ローカルで実際に`rule-based`モードを実行し、76件（政策6件＋議案等13件×4ジョブ種別）の
  ジョブを生成・処理した結果を反映（完了57／要確認19＝すべてAI要約ジョブ）。
- `src/data/archiveEntityExtractionCandidates.json`（新規）：今回のデータでは実在人物名の
  本文一致が0件だったため空配列（推測で候補を作っていない、正しい結果）。
- `src/data/adminReviewQueue.json`：AIジョブの要確認・失敗、人物候補の未確認分を追加集計
  （32件→51件）。
- `src/data/archiveAiCategoryCandidates.json`・`archiveRelationCandidates.json`：
  生成元ロジックは変更していないため、内容は既存と同一（タイムスタンプのみ変わるため
  コミット対象外、`git restore`で戻した）。

### AIジョブ生成条件（対象／対象外）

新規・更新（原文ハッシュが既存ジョブと不一致）の資料のみを対象にし、以下は対象外とした：
変更なし・取得失敗・原文が空・`verificationStatus="sourceUnavailable"`・OCR確認待ち・
私人の個人情報を含む可能性がある資料。現時点で対象になるのは`archivePolicies.json`
（`target=policies`）と`archiveCouncilDocuments.json`（`target=council`、議案・条例・請願・陳情）。
`target=finance`・`target=people`は、既存の参照整合性チェック対象
（`CANDIDATE_ENTITY_ID_SETS`）に対応するAI処理対象がまだ無いため、現状0件（正直に0件と表示、
架空の対象は作っていない）。

### 実行モード

- **dry-run**（既定）：対象件数・生成予定ジョブ数を表示するのみ。ファイル更新・API呼び出しなし。
- **rule-based**：キーワード辞書によるテーマ分類候補・関連資料候補・人物候補を生成する。
  AI要約ジョブは`status="needsReview"`のまま（ルールベースでは要約を生成できないため）。
- **ai-enabled**：`ARCHIVE_AI_ENABLED=true`かつ`ARCHIVE_AI_API_KEY`設定時のみAI要約を試みる。
  **現時点では実際の外部プロバイダー接続を実装していない**ため、常に`status="skipped"`で
  安全終了する（有料APIを無断で呼び出さない）。rule-based分の処理（テーマ分類等）は
  ai-enabledでも実行される。

### AIプロバイダー抽象化

`src/lib/ai/archiveAiProvider.ts`（新規）：`ArchiveAiProvider`インターフェース
（`summarize`/`classifyCategories`/`findRelations`/`extractEntities`）と、常に
`AiProviderUnavailableError`を投げる`DisabledAiProvider`（既定）。特定サービス（Anthropic等）に
密結合するコードはまだ書いていない（実際のAPI接続はフェーズ10C範囲外、次フェーズで追加できる
拡張ポイントとして用意）。環境変数名：`ARCHIVE_AI_ENABLED`・`ARCHIVE_AI_PROVIDER`・
`ARCHIVE_AI_MODEL`・`ARCHIVE_AI_API_KEY`（実際の値はコード・JSONへ保存せず、GitHub Secrets/
環境変数経由のみ）。

### AI要約・分類・関連候補の保存方法

すべて`status="candidate"`または`"needsReview"`のまま保存し、人が確認するまで確定データへ
昇格しない（既存の分離設計をそのまま踏襲、フェーズ10Cで新たに壊していない）。

### 自動確定登録できる情報／人による確認が必要な情報

自動確定登録できるのは公式資料から直接確認できる客観データ（フェーズ10Bの巡回結果自体）のみ。
AI要約・AIテーマ分類・AI関連付け・人物候補は、今回もすべて候補のまま保存し、公式データへ
自動反映していない（`archivePolicies.json`等の確定フィールドは一切変更していない）。

### GitHub Actions統合

`.github/workflows/civic-archive-sync.yml`を拡張（重複Workflowは作っていない）。

- `workflow_dispatch.inputs`に`mode`（dry-run/rule-based/ai-enabled、既定dry-run）・
  `target`（all/council/finance/people/policies、既定all）・`create_pr`（真偽、既定false）を追加。
- パイプライン順序：巡回→`validate:data`→検索インデックス生成→AI処理候補生成→
  要確認キュー更新→typecheck/lint/build→`validate:seo`→（変更判定）→PR作成。
- **定期実行（cronスケジュール）はworkflow_dispatchの入力を受け取れないため、
  `mode=rule-based`・`target=all`・`create_pr=false`に固定**（外部API不使用・安全な
  ルールベース生成のみを5日ごとに実行し、Pull Requestは作らない、最も保守的な既定値）。
  PRを作りたい場合は人が手動でworkflow_dispatchを実行し`create_pr=true`を選ぶ必要がある。
- 変更なしの場合はコミット・PRを作成せず正常終了する（`git status --porcelain`での判定、
  `sync-council-data.yml`と同じ方式）。
- PR作成時はbotブランチ（`bot/civic-archive-sync-<timestamp>`）経由、`gh pr create`
  （`github.token`使用、追加のPAT設定不要）。GitHubトークン・権限が無い場合は
  `create_pr`条件が満たされないため自然にスキップされる（明示的なエラーハンドリングは
  追加していないが、`gh`コマンド自体がトークン権限不足時に失敗した場合はステップが
  失敗として記録される）。

## テスト結果（ローカルで実際に実行して確認）

1. **dry-run**：`node scripts/run-archive-ai-processor.mjs --mode=dry-run --target=all`
   → 資料候補19件、新規ジョブ候補76件を表示、ファイル変更なしを確認。
2. **rule-based**：同コマンドを`--mode=rule-based`で実行 → 76件のジョブを生成・処理
   （完了57／要確認19）、`archiveAiCategoryCandidates.json`等が既存ロジックで正しく再生成
   されることを確認。
3. **重複防止**：直後にもう一度同じコマンドを実行 → 新規ジョブ候補0件（既存76件と完全一致）
   を確認。
4. **AI無効状態**：`--mode=ai-enabled`を環境変数なしで実行 → エラー終了せず、AI要約ジョブが
   `status="skipped"`として記録され、他のジョブ種別（rule-based分）は正常に処理されることを確認。
5. **AI設定ありでも実呼び出しなし**：`ARCHIVE_AI_ENABLED=true`・ダミーAPIキーを設定して実行
   → それでも外部通信は一切発生せず、「AIプロバイダーの実装が未接続です」として安全に
   `skipped`になることを確認（有料APIの誤課金テストは行っていない）。
6. **変更なし判定**：`validate:data`のダミー重複挿入テストで新チェックが実際に発火することを
   確認（その後、正しい内容に戻した）。

## 検証結果（フェーズ10C）

- `npm run validate:data`：errors=0, warnings=1257（既存警告のみ、新規警告0件）。
- `npm run typecheck`：エラーなし。
- `npx oxlint`：クリーン。
- `npm run build`：912ページ生成（新規Reactページなし、ページ数前回と同一）。
- `npm run validate:seo`：failures=0, warnings=0。

## 未実施・意図的に見送った項目（フェーズ10C）

- 実際の外部AIプロバイダー接続（Anthropic API等の実装）は行っていない。
  `DisabledAiProvider`のみで、`ai-enabled`モードは常に安全にskipされる。
- `target=finance`・`target=people`は対象が0件（対応する参照整合性チェック済みID集合が
  まだ無いため）。
- ジョブの`resultId`が対応する候補ファイル側に実在するかのvalidate:data相互参照チェックは
  未実装（`sourceEntityId`等の既存チェックは実施済み）。
- AIジョブの優先度（`priority`）・リトライ（`attempts`到達後の扱い）は型・フィールドのみ
  用意し、実際に複数回リトライさせる制御ループはまだ実装していない
  （`maxAttempts`到達時に自動で止める仕組みは無い＝現状は1回実行で即completed/failedになる設計）。

## 既知の注意点・落とし穴（継続）

- `npm run build`のたびに`src/data/siteUpdate.json`・`archiveAiCategoryCandidates.json`・
  `archiveRelationCandidates.json`・`adminReviewQueue.json`が再生成される
  （内容が同じでもタイムスタンプが変わる）。今回`adminReviewQueue.json`は実際に内容が
  変わった（32→51件）ためコミット対象、他はタイムスタンプのみのため`git restore`で戻した。
- `scripts/`配下のNode実行スクリプトは、ビルド前の`src/`配下のTypeScriptを直接importできない。
  同じロジックが必要な場合は`.mjs`側にミラー実装する
  （`src/lib/ai/archiveAiProcessor.ts` ⇔ `scripts/run-archive-ai-processor.mjs`も同様）。
- `mayor`ターゲット（`archiveCrawlerTargets.json`）は`hisatomo-m.jp`が許可ドメイン外のため
  引き続き取得できない。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`。会計年度は4月始まり。
- 比較ページのクエリパラメータは年度ベースが`?years=`、市長・議員・政策比較が`?items=`。
- 委員会マスタが存在しない（`committeeId`は1件も確認できていない）。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`と`git status`で本メモと状態が一致しているか確認。
2. `npm run validate:data && npm run typecheck`で現状に問題がないか確認。
3. push・Cloudflare Pagesデプロイに進む場合は、上記「ロードマップ」の注意書きを踏まえ、
   ユーザーに実行の意思を改めて確認してから着手する。
4. 可能であれば`/timeline`・`/compare/*`等をブラウザで375px・390px・768px・1280pxで確認する
   （フェーズ9A以降、実機確認が未実施のまま）。
