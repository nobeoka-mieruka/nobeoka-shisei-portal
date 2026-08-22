# Phase56〜66 開始前ベースライン

作成日：2026-08-23　基準commit：`3c3af0b`（Phase45-54並列バックフィル＋Phase55統合、origin/mainへpush済み）

## git状態
- 現在ブランチ：main、origin/mainと同期済み
- 未コミット差分：`.claude/settings.local.json`（ローカル専用）、`src/data/councilSessions.json`（改行コードのみ）のみ

## データ件数ベースライン

| 項目 | 件数 |
|---|---|
| generalQuestions.json（キュレーション済み） | 15件 |
| councilSpeechSummaries.json（構造化済み質問項目、speeches合計） | 398件（36議員分） |
| 一般質問候補（Phase45-47パイロット、未反映） | 2件（memberId未解決） |
| parser blocked件数 | 1件（scripts/lib/minutes-source.mjsが令和表記専用） |
| 現職議員数（members.json） | 26名 |
| 元議員数（formerMembers.json） | 58名 |
| historical member（archiveMemberProfiles.json等） | 別途Phase59で棚卸し |
| unresolved member mapping件数 | 2件（矢野戦一郎・後藤哲朗、UNR-023） |
| 選挙件数（electionResults.json） | 39件 |
| 未確認選挙件数 | 市長選3件（1975/78/82、候補者未確定）＋市議選1933-1998（65年間丸ごと未収録） |
| 議案件数（billVotes.json） | 1,177件 |
| 財政年度件数（archiveFiscalYears.json） | 70件（うちordinaryAccountLocalBondBalanceYen非null=24年度） |
| 広報OCR候補件数 | 確定4件・未照合2件（Phase52） |
| search index件数 | 2,151件 |
| sourceRefs不足件数 | Phase54調査で重大な不足は未発見（既存sourceHealth.warnings=15件に含まれる） |
| unresolved件数（master ledger） | 25件（内訳：disputed 3, unconfirmed 6, partially_resolved 1, not_collected 8, under_review 2, reference_pending 4, resolved 1） |
| warnings件数（validate:data） | 15件 |

## Phase56〜65 実行方針の調整（開始前に明示）

Phase56（parser改修）はPhase57・58（2010年代・2000年代の実投入）の前提であり、既存の正常データ（councilSpeechSummaries.json 398件分）を壊さない安全な改修が最優先。このため、以下の依存順序で実行する。

- **第1陣（並列8worker）**：Phase56（parser改修・単独集中）、Phase59（人物照合エンジン）、Phase60（市議選1933-1998backfill）、Phase61（1975/78/82市長選再調査）、Phase62（財政残年度改善）、Phase63（広報OCR原紙照合）、Phase64（元議員第2巡）、Phase65（UI/検索/sourceRefs）。
- **第2陣**：Phase56完了・回帰テスト確認後、Phase57＋Phase58（2010年代・2000年代の実投入）を開始する。Phase45-47と同じ理由（延岡市議会会議録検索システムへの同時アクセス負荷回避）により、この2つも1worker（または直列）で実施する。

Phase61（1975/78/82市長選）は、Phase27・28（NDL精読、2回失敗）およびPhase48（非NDL資料再調査、新規資料なし）で既に十分に試行済みのため、**同じ検索の反復を避け、未試行の資料ルートのみ**を対象とする。
