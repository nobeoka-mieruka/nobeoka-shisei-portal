# Phase45〜55 開始前ベースライン

作成日：2026-08-22　基準commit：`7246c93`（Phase34-44統合、origin/mainへpush済み）

## git状態
- 現在ブランチ：main、origin/mainと同期済み
- 未コミット差分：`.claude/settings.local.json`（ローカル専用）、`src/data/councilSessions.json`（改行コードのみ）のみ

## データ件数ベースライン

| 項目 | 件数 |
|---|---|
| generalQuestions.json（キュレーション済み一般質問） | 15件 |
| councilSpeechSummaries.json（現議員任期の会派別要約） | 36名分、analyzedSessionCount合計は各議員ごとに異なる |
| questionCollectionStatus.json（現任期13会期の機械集計） | registeredSpeakerCount合計162、registeredQuestionCount合計1,122（会議録ベースの機械集計であり、精査済み構造化データの件数ではない） |
| billVotes.json | 1,177件 |
| committees.json | 6件 |
| committeeActivityReports.json | 15件 |
| archiveCouncilDocuments.json（請願・陳情詳細アーカイブ） | 13件（うち請願3・陳情4、Phase41調査確認） |
| electionResults.json | 39件 |
| archiveFiscalYears.json | 70年度分（うちdebtフィールドは26年度、financeフィールドは24年度） |
| kohoNobeokaIssues.json（広報のべおか） | 197号（OCR完了196号・2,498ページ） |
| kohoOcrSearchIndex.json | 2,187件（192号分、OCR完了済みだが4号がインデックス0件というギャップあり） |
| dataQualitySummary.sourceHealth.warnings | 15件 |
| dataQualitySummary.linkHealth.broken | 11件／677件チェック中 |
| reports/phase33-master-unresolved-ledger.json | 21件（Phase44時点） |
| validate:data warnings | 15件（変化なし） |

**注記**：ユーザー指示に記載の「既存397件・1,470質問項目」という数値は、本ベースライン調査（questionCollectionStatus.json・councilSpeechSummaries.json直接集計）とは一致しなかった（現任期のみの機械集計では162名分・1,122件）。旧任期（令和元年6月〜令和5年3月）分を含めた正確な母数は、Phase45ワーカーの冒頭で再集計し、本レポートへ追記する。数値の相違は推測で埋めず、実測値をもって基準とする。

## Phase45〜54 実行方針の調整（開始前に明示）

10並列を厳密に維持すると、Phase45（2020年代）・Phase46（2010年代）・Phase47（2000年代）の3workerが同一の外部システム（延岡市議会会議録検索システム）へ同時アクセスすることになり、「サーバーへ過度な負荷をかけない」というユーザー自身の指示と矛盾する。また、Phase39（既存調査）で判明した通り、既存parser（scripts/lib/minutes-source.mjs）は令和表記の日付のみに対応しており、2000〜2019年分の実データ化には新規パース処理の追加検証が必要（単純なデータ収集ではなくコード整備を伴う）。

このため、Phase45〜47を**1worker（Aワーカー）に統合**し、同一外部システムへのアクセスを直列化・総リクエスト数を制限する。これにより実質**8並列**での実行とする（並列数を増やすこと自体が目的ではない、というユーザー方針に従う）。その他の点（staging専用ファイル、共有JSON非直接編集、commit/push禁止、外部照会送信禁止、現地閲覧対象外）は全workerで維持する。
