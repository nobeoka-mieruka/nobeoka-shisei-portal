# 自動更新基盤：既存資産の棚卸しと拡張方針（設計ドキュメント）

> 2026-08-24作成。「自動更新機能の追加」という依頼を受け、実装前にまず既存資産を確認した
> 結果、想定より成熟した自動更新基盤が既に稼働していることが判明したため、新規構築ではなく
> **既存基盤の可視化・formalize・ギャップ抽出**を優先する。このドキュメント自体はコードを
> 変更しない。

## 1. 既存の自動更新基盤（棚卸し結果）

### 1.1 GitHub Actions（3本、いずれも稼働中）

| workflow | 対象 | 頻度 | 反映方式 |
|---|---|---|---|
| `update-council-documents.yml` | 延岡市議会「議案等審議結果」の新規PDF検出 | 毎日（実質） | **直接commit・push**（差分がある場合のみ） |
| `sync-council-data.yml` | 会議日程・意見書決議・委員会活動報告書・一般質問質問通告一覧・議員名簿 | 5日ごと（毎日起動・120時間ゲート） | botブランチ経由の**PR作成** |
| `civic-archive-sync.yml` | 財政・人口・基金（HTTP取得＋ハッシュ比較）＋AI候補生成（既定rule-based、AI既定オフ） | 5日ごと | 既定はレポート統合のみ。`create_pr=true`明示時のみPR |

**既に満たされている要件**（message4の要求と対応）：
- 差分検知：SHA-256ハッシュ比較（`scripts/lib/city-site-fetch.mjs`）で実装済み → §4
- 実行時間の分散：3workflowのcron時刻をUTC 18:30/19:00/21:00とずらして重複回避済み → §13
- 安全な反映方式：`update-council-documents.yml`のみ直接push、他はPR経由 → §29（PR方式優先）に近い設計が既に一部採用済み
- 外部APIの無断呼出し禁止：`civic-archive-sync.yml`のAI処理は既定`rule-based`（外部プロバイダー未接続、常にskipped）→ §3のLevel C/D的な慎重さと合致
- 状態管理：`scripts/_sync-state.json`・`scripts/_archive-crawler-sync-state.json`（Git管理外、actions/cacheで永続化）で前回実行時刻を管理 → §5の一部
- ドメイン制限・429/403/5xx処理：`scripts/lib/city-site-fetch.mjs`に実装済み → §14・§36
- 手動実行時のforce/dry-run/target等の入力パラメータ → §33のdry-run思想に近いものが`civic-archive-sync.yml`に既に存在

### 1.2 関連スクリプト（重複実装しないための一覧）

取得・差分検知：`fetch-nobeoka-council-documents.mjs`／`fetch-nobeoka-minutes.mjs`／
`fetch-nobeoka-minutes-batch.mjs`／`fetch-nobeoka-speaker-minutes.mjs`／
`sync-council-data.mjs`／`run-archive-crawler.mjs`／`prepare-wayback-recovery-queue.mjs`

登録・生成：`import-bills.mjs`／`import-members.mjs`／`generate-council-documents.mjs`／
`generate-session-summaries.mjs`／`generate-speech-summary-scaffold.mjs`／
`generate-member-speech-analysis.mjs`／`generate-bill-summaries.mjs`／
`generate-theme-candidates.mjs`／`generate-admin-review-queue.mjs`

OCR：`ocr-pdf-page-windows.ps1`／`ocr-batch-pdf-windows.ps1`（WinRT、Windows PowerShell 5.1限定）

監査：`scripts/qa-checks/*`（Phase78-88で新設）／`generate-quality-summary.mjs`／
`generate-freshness-report.mjs`／`site-completeness-audit.mjs`

## 2. message4が求めた要素との対応表（GREEN/YELLOW/RED）

| 情報源 | 現状の扱い | 対応する3段階 |
|---|---|---|
| 延岡市議会「議案等審議結果」新規PDF | 自動検出・直接反映（`update-council-documents.yml`） | 実質GREEN（機械的URL検出のみ、内容解釈は伴わない） |
| 会議日程・委員会活動報告書・一般質問質問通告一覧・議員名簿変更 | 自動検出→PR作成、人間マージ待ち | YELLOW |
| 財政・人口・基金（HTTP+ハッシュ） | 自動検出→レポート統合、PR化は明示指定時のみ | YELLOW（既定） |
| AI要約・テーマ分類・関連資料候補 | 既定オフ（rule-basedのみ、外部AI未接続） | 既に安全側（RED相当）に倒してある |
| 歴代市長任期推定・OCRのみの古い数字・人物同一性判定 | **自動更新の対象外**（本セッションのPhase作業のように人手＋一次資料照合で実施） | RED（自動化していない、現状維持を推奨） |

## 3. 確認された未整備部分（ギャップ）

1. **取得履歴台帳の形式が統一されていない**：`_sync-state.json`等は「前回実行時刻」のみを
   保持し、message4が求める `sourceUrl/sourceType/firstSeenAt/lastCheckedAt/lastChangedAt/
   httpStatus/contentHash/parserVersion/extractionStatus/validationStatus/appliedAt/
   errorMessage` を1レコードずつ持つ統一台帳の形にはなっていない。
2. **`npm run update:dry-run`のような統一エントリポイントが無い**：各workflowが個別スクリプトを
   直接呼んでおり、`npm run update:daily`/`update:weekly`/`update:questions`等の統一命名は
   未整備。
3. **異常検知（急変・重複・矛盾）が更新パイプライン自体には組み込まれていない**：人口前年比
   50%増減・基金10倍・議員26→100人等の異常検知は、現状`scripts/qa-checks/`側の事後監査
   （`check-finance-unit-anomalies.mjs`等）でのみ行われており、自動更新の「反映前ゲート」には
   なっていない。
4. **市民向け「自動更新状況」表示が無い**：最終自動確認日時・確認待ち件数等を`/data-status`等で
   市民向けに要約表示する仕組みは未実装。
5. **Zod等のランタイムスキーマ検証は未導入**：現状はTypeScript型（コンパイル時のみ）と
   `validate-data.mjs`（ビルド時の後追い検証）のみ。

## 4. 推奨する次の一歩（実装は今回は行わない、提案のみ）

優先度の高い順に、既存基盤を壊さず段階的に拡張することを推奨する。

1. `scripts/qa-checks/`の異常検知ロジック（`check-finance-unit-anomalies.mjs`等）を、
   `civic-archive-sync.yml`のPR作成直前のゲートとして呼び出せるよう関数を切り出す
   （新規実装ではなく既存ロジックの再利用）。
2. 取得履歴台帳を`reports/auto-update/ledger.json`のような単一ファイルへ統一する設計を
   別途検討する（3 workflowの状態ファイルを段階的に統合、一度に置き換えない）。
3. `/data-status`に「最終自動確認日時」セクションを追加する場合、`scripts/_sync-state.json`
   相当の情報のうち公開して問題ない部分（日時のみ、内部URLやエラー詳細は含めない）を
   ビルド時に集計する専用スクリプトを新設する。

**今回のセッションでは、上記1-3のコード実装は行っていない**（既存の正常な自動更新・
GitHub Actionsを壊すリスクを避けるため、設計提案のみに留めた）。
