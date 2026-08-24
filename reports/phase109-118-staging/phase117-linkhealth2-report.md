# Phase117: linkHealth（外部リンク健全性）再実測2 レポート

作業日: 2026-08-24
前提資料: `reports/phase99-108-staging/phase99-linkhealth-report.md` / `phase99-linkhealth-findings.json`（broken 11→6、serverError 7→0 を確認済み）

## 方針

Phase99は同日（2026-08-24 03:39〜03:54）に非kensakusystem 733件を全件フレッシュ再検証済みで、
`scripts/check-external-links.mjs` のキャッシュ有効期限（14日）内のため、指示通り**同じURLの無意味な再チェックを回避**した。
一方、kensakusystem.jp（会議録検索システム、全4,609件）はこれまで累計99件（2.1%）しか確認されておらず、
未チェック領域が最大だったため、ここを優先して拡大サンプリングした。

- 実行コマンド: `node scripts/check-external-links.mjs --sample-kensakusystem=400`
- サンプリングは決定論的な間引き（`step = floor(total/count)`）のため、件数400を指定するとstepが前回60件時と異なり、
  ほぼ新規のURL群がサンプリングされる（実際、394件が新規、6件のみ前回サンプルと偶然重複＝キャッシュ再利用）。
- 非kensakusystem 733件は全件キャッシュ再利用（0件の無意味な再確認）。

### 実行環境メモ

本セッションの標準サンドボックスは外部ネットワークへのfetchを遮断していたため、`dangerouslyDisableSandbox`
を有効にして実fetchを行った（環境側の制約であり、対象サイトやデータの問題ではない）。

## チェック件数

| 区分 | 件数 |
|---|---|
| 今回のtargets総数 | 1,133（非kensaku733 + kensakuサンプル400） |
| キャッシュ再利用（無意味な再チェック回避） | 739 |
| 新規フレッシュ確認 | **394**（すべてkensakusystem.jp） |
| kensakusystem.jp累計確認数 | 99 → **485**（全4,609件中10.5%） |

## healthy／redirect／broken 内訳

### 新規確認394件（kensakusystem.jpサンプル拡大分）

| 分類 | 件数 |
|---|---|
| healthy(200) | **394（全件）** |
| redirect | 0 |
| notFound404 | 0 |
| serverError | 0 |
| wayback_temporarily_unavailable | 0 |
| blocked/rate_limited | 0 |

新規に発見されたリンク切れ・エラーは**0件**。

### 今回のtargets全体（1,133件、キャッシュ再利用含む・現行アクティブ参照のみ）

| 分類 | 件数 |
|---|---|
| healthy(ok) | 1,117 |
| redirect | 10（Phase99から変化なし、すべて想定内） |
| notFound404 | 6（Phase99から件数変化なし。ただし内訳を精査、下記参照） |
| serverError | 0 |

## notFound404（6件）の内訳精査

Phase99から件数は変わらず6件だが、うち3件は**現在アクティブなsourceUrlとしては使用されておらず**
（`dataQualitySummary.json`の集計残骸のみ）、実害はない（Phase99で確認済み・変化なし）。

**現在アクティブに参照されている真の404は3件**:

1. **`archiveMayorTerms.json`** — 仲田又次郎のWikipedia出典。Phase99から状態変化なし、記事は現存しない。
   実害は小さい（kotobank.jp等で裏付け済み）。推測でURLを差し替えず、findings記録のみ。
2. **`councilWatchedDocuments.json`**（id: session-schedule-5774a79eedad, 27879.pdf, 第26回定例会 会議日程）
   — 延岡市議会サイトの一覧ページ（https://www.city.nobeoka.miyazaki.jp/site/gikai/6758.html）を実際にfetchして
   確認したところ、旧PDFは撤去済みで、**「第27回延岡市議会（定例会）会議日程」として新URL
   `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28674.pdf`（HEAD確認=200）が新規掲載**されていた。
   ただし内容は第26回→第27回で**文書の実体が異なる**ため、単純なURL置換ではなく「新規ドキュメントとして追加登録」を
   sync-council-data.mjs担当へ提案した。
3. **`councilWatchedDocuments.json`**（id: session-schedule-a392dabc3484, 28156.pdf, 令和8年度 常任委員会・特別委員会開催予定表）
   — 同じ一覧ページで**タイトルが完全一致のまま**新URL `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28682.pdf`
   （HEAD確認=200）に差し替わっていた。同一文書の改訂版の可能性が高く、差し替え候補として提案した
   （本文の同一性までは未確認のため、最終判断は一次資料本文比較を推奨）。

いずれも**推測でURLを作らず、実fetchで新URLの存在と200応答を確認した上での提案**である。

## Wayback一時障害の扱い

今回の確認範囲では serverError・timeout は0件（Phase99の「Wayback一時障害7件は自然回復」を維持）。
新たなWayback一時障害は検出されなかった。

## redirect（10件）

Phase99から状態・件数ともに変化なし。全て想定内の正常挙動（LINE短縮URL、Facebook正規化、komei.or.jpの
wp_cronクエリ、d1-lawセッション期限切れによるCSS誘導、Wayback直近スナップショット誘導）。移転の事実はなく、
URLの書き換えは行っていない。

## 副次的な発見: stale backup残骸

`reports/external-link-check.json` の履歴には `members.backup.json` / `mayor.backup.json`
（現在は存在しないファイル）由来の残骸エントリが31件残っている（not_found_404が28件、fetch failedのerrorが3件）。
grepで確認した結果、これらのURLは現行の `src/data` 配下には存在せず、`generate-quality-summary.mjs` も
`*.backup.json` 参照を除外して集計するため、**現行データへの実害はない**。編集不要と判断した。

## 直接編集したファイル

- `reports/external-link-check.json`（監査キャッシュ、独占編集ファイル）のみ。
- `src/data` 配下は編集していない（Phase110/111/113/115が編集中のため、提案のみfindings.jsonへ記録）。

## 他workerへの提案（3件）

1. sync-council-data.mjs担当（councilWatchedDocuments.json）: 27879.pdf → missingStreak処理 + 新規ドキュメント
   `28674.pdf`（第27回定例会 会議日程）の追加登録を提案。
2. sync-council-data.mjs担当（councilWatchedDocuments.json）: 28156.pdf → 同一タイトルの後継URL
   `28682.pdf` への差し替え候補を提案（本文の最終確認は担当側で推奨）。
3. archiveMayorTerms.json担当: 仲田又次郎のWikipedia出典404は継続中、削除または代替出典への統合を
   人手判断で検討されたい（Phase99からの継続申し送り、実害小）。

## 品質確認

本タスクは `src/data` 配下を直接編集していないため、`validate:data` / `typecheck` / `lint` / `build` の
再実行は必須ではないと判断した（`reports/`はビルド対象外）。
