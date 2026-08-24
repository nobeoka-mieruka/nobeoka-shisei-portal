# Phase99: linkHealth（外部リンク健全性）再実測レポート

作業日: 2026-08-24
対象: `src/data/dataQualitySummary.json` の `linkHealth` セクション（生成元データの再検証）

## 手法

`src/data/` 配下のJSONから外部URLを収集して実際にfetch確認する仕組みは、既に
`scripts/check-external-links.mjs`（監査キャッシュ: `reports/external-link-check.json`）
として整備済みだった。本タスクでは重複実装を避け、この既存基盤を実行して再検証した。

- `node scripts/check-external-links.mjs --force`
  → kensakusystem.jp（会議録検索システム、約4,600件、通常除外）を除く **733件を全件フレッシュ再検証**（キャッシュ流用0件）。
- `node scripts/check-external-links.mjs --sample-kensakusystem=60`
  → kensakusystem.jpから決定論的に60件を追加抽出して確認（全件ok）。
- 前回broken一覧11件のうち、Wikipedia記事の実在確認はWikipedia内検索（WebFetch）でも別途裏付け。
- HEAD優先→405/501時のみGETフォールバック、タイムアウト12秒、リトライ1回、同一ホスト同時接続数2、
  リクエスト間隔350ms、という既存スクリプトの負荷配慮設定をそのまま使用。

## 開始件数 → 終了件数

| | 件数 |
|---|---|
| 開始（2026-08-16時点のdataQualitySummary.json） | totalChecked=677（ok653 / redirect10 / 404が4 / 5xxが7） |
| 終了（今回、非kensakusystem733件を全件再検証＋kensaku60件サンプル） | ターゲット793件（新規検証733件＋既存kensaku累計含め検証済み99件） |
| build再生成時に反映される想定値（generate-quality-summary.mjsと同一ロジックで算出） | totalChecked=838 / ok=817 / redirect=12 / notFound404=6 / serverError=**0** |

※ 件数が677→838と増えているのは「チェック漏れが増えた」のではなく、(1) 2026-08-16以降にデータ追加された
新規URLが対象に加わったこと、(2) 今回kensakusystem.jpのサンプル検証を追加したこと、が主因。

## 分類別内訳（今回の実測）

| 分類 | 件数 |
|---|---|
| healthy（ok） | 817 |
| redirect | 12（すべて想定内の正常なリダイレクト。移転なし） |
| broken(404) | 6 |
| server_error | **0**（前回7件はすべて回復） |
| timeout | 0 |
| blocked / ssl_error | 0 |
| kensakusystem.jpサンプル60件 | 全件ok |

## 前回broken 11件の再検証結果

| URL | 前回 | 今回 | 対応 |
|---|---|---|---|
| ja.wikipedia.org/wiki/仲田又次郎 | 404 | **404（継続）** | 記事は現存せず。移転先不明のため未編集（findingsに記録） |
| news.yahoo.co.jp/articles/54bca0...（archiveMayors/archiveMayorTerms） | 404 | 404だがアクティブ参照は既に無し | **Phase96（本タスク前）でWayback版へ差し替え済み**。編集不要 |
| web.archive.org（2011_05.pdf, archiveFiscalYears） | 503 | 302→200に回復 | 編集不要 |
| web.archive.org（cont=140324102214, archiveMayors） | 503 | 200に回復 | 編集不要 |
| web.archive.org（2006year.html, civicTimelineEvents） | 503 | 200に回復 | 編集不要 |
| web.archive.org（2007year.html, civicTimelineEvents） | 503 | 200に回復 | 編集不要 |
| web.archive.org（2008year.html, civicTimelineEvents） | 503 | 200に回復 | 編集不要 |
| web.archive.org（2009year.html, civicTimelineEvents） | 503 | 200に回復 | 編集不要 |
| web.archive.org（cont=180131171602, archiveMayors/Terms） | 503 | 200に回復 | 編集不要 |
| city.nobeoka.../attachment/27980.xls（municipalityComparison） | 404 | 404だがアクティブ参照は既に無し | **2026-08-11時点で既に28569.xlsへ差し替え済み**。編集不要 |
| the-miyanichi.co.jp/kennai/_84868.html | 404 | 404だがアクティブ参照は既に無し | **Phase96でWayback版へ差し替え済み**。編集不要 |

前回serverError=7件は「2026-08-16から継続中のWayback Machine再生バックエンド障害」とdataQualitySummary.jsonの
noteに記載されていた通り一時的なもので、**今回7件とも自然回復（200 or 302→200）を確認**した。

## 新規に見つかった問題（前回一覧には無かったもの）

`councilWatchedDocuments.json` 内の2件が404:

- `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27879.pdf`（第26回市議会定例会 会議日程）
- `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28156.pdf`（令和8年度 常任委員会・特別委員会開催予定表）

このデータは `firstDetectedAt` / `lastCheckedAt` / `missingStreak` 等の追跡フィールドを持ち、
`scripts/sync-council-data.mjs` が管理する自動監視データと確認した。会期終了に伴う一時資料PDFの
撤去という典型的なライフサイクルの可能性が高い。**本タスクでは編集せず、sync-council-data担当への
申し送り事項としてfindings.jsonに記録した**（同ファイルは他worker予約ファイルではないが、専用の
自動追跡パイプラインが別途この種の検出を担う設計のため、手動でのURL書き換えは避けた）。

## リダイレクト10件の確認結果

すべて「公式サイト移転」ではなく、想定内の正常なリダイレクト挙動と判断（詳細はfindings.json参照）。

- kotobank.jp: URLエンコードの空白除去のみ
- lin.ee → line.me: LINE公式短縮URLの仕様通りの挙動
- ops-jg.d1-law.com（会議規則検索システム、committees.json）: セッション依存URLの期限切れによるCSSアセットへの302（既知の仕様）
- Facebook（5件、members.json）: 数値IDから正規化URLへの自動リダイレクト
- komei.or.jp（2件、members.json）: WordPressのcronトリガーによる一時クエリ付与

いずれもURLの書き換えは行っていない（内容・到達先が同一で、移転の事実が確認できないため）。

## 直接編集したファイル

**なし（0件）**。

理由：
1. 前回broken 11件中7件（Wayback 503）は一時障害の自然回復であり、データ側に問題は無かった。
2. 3件（yahoo news／miyanichi／27980.xls）は、本タスク開始前の**Phase96で既に正しいURLへ置き換え済み**であることを確認した（`archiveMayors.json` / `archiveMayorTerms.json` / `municipalityComparison.json`）。現在アクティブなsourceUrlとしては使用されておらず、古いURLが残っているのは `src/data/dataQualitySummary.json` の集計テキストのみで、次回 `npm run generate:quality-summary`（＝build時に自動実行）でこの一覧自体が更新され自然に消える。
3. 残り1件（Wikipedia）は移転先を確実に確認できず、推測でのURL書き換えは方針違反のため見送った。
4. 新規発見の2件（councilWatchedDocuments.json）は他パイプライン管理データのため対象外。

## 更新したファイル

- `reports/external-link-check.json`（監査キャッシュ）: 実fetch結果で最新化。非kensakusystem 733件を全件フレッシュ再検証、kensakusystem.jpから60件サンプル追加。
- `src/data/dataQualitySummary.json` の `linkHealth` セクションは **意図的に直接編集していない**（タスク指示通り、`npm run build` 実行時に `generate-quality-summary.mjs` が `reports/external-link-check.json` から自動再生成するため）。参考として、同一ロジックで算出した「build後に反映される想定値」をfindings.jsonに記録した。

## 他workerへの申し送り事項

1. `councilWatchedDocuments.json` の2件のPDF 404（`sync-council-data.mjs`担当向け）。
2. `archiveMayorTerms.json` の仲田又次郎に関するWikipedia出典が記事消失により404。同一事実はkotobank.jp・延岡市公式資料で裏付け済みのため実害は小さいが、当該sourceRefエントリの扱い（削除／代替出典への統合）は人手判断が必要。

## 品質確認

本タスクはsrc/data配下を直接編集していないため、`validate:data` / `typecheck` / `lint` / `build` の
再実行は必須ではないと判断した（`reports/`はビルド対象外、`generate-quality-summary.mjs`のコメントにも
明記の通り）。次回のbuild実行（統合フェーズ）で `reports/external-link-check.json` の更新内容が
`src/data/dataQualitySummary.json` へ自動反映される。
