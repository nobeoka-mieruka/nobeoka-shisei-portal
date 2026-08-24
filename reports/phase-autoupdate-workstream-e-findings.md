# 自動更新パイプライン Workstream E（定期実行・レポートPR化）実装報告

作成日：2026-08-24
担当範囲：`.github/workflows/` 配下の新規ファイルのみ

## 1. 新規作成したファイル

- `.github/workflows/auto-update-dryrun.yml`（新規作成、唯一の実装ファイル）

既存の3つのworkflow（`update-council-documents.yml`・`sync-council-data.yml`・
`civic-archive-sync.yml`）は一切編集していない（読んで設計を参考にしたのみ）。
`scripts/auto-update/core/`・`bills/`・`questions/`・`finance/`・`population/`・
`integration/`、`package.json`、`src/data/*.json`も編集していない。

## 2. 事前確認（重複実装防止）

作業開始時点では `scripts/auto-update/bills/update-bills.mjs` のみが実装済みで、
`questions/`・`finance/`・`population/` は未着手だった。作業途中で他Workstream
（B・C・D）が並行して以下を実装完了させたため、それぞれ存在を確認したうえで
このworkflowの対象に組み込んだ。

- `scripts/auto-update/bills/update-bills.mjs`（Workstream C）
- `scripts/auto-update/questions/update-questions.mjs`（Workstream B）
- `scripts/auto-update/finance/update-finance.mjs`（Workstream D）
- `scripts/auto-update/population/update-population.mjs`（Workstream D）

いずれも `node scripts/auto-update/<target>/update-<target>.mjs [--verbose]` という
共通CLIパターンで、`scripts/auto-update/core/report.mjs` の `writeRunReport`/
`updateStatus` を通じて `reports/auto-update/run-<target>-<timestamp>.json` と
`reports/auto-update/status.json` を書き出す統一フォーマットになっていることを確認した
（`target`/`startedAt`/`overallLevel`/`summary.{detected,green,yellow,red,error}`/
`entries[].outcome`/`circuitBreakerTripped`）。このworkflowはUpdaterのロジック自体には
一切手を加えず、この統一フォーマットのレポートを実行・収集・PR化するだけの薄い層として設計した。

未実装の場合（このworkflowが将来動く時点でまだ`questions`等が無い場合）に備え、
各Updaterの実行前に `[ -f <path> ]` でファイル存在チェックを行い、無ければスキップする設計にした
（タスク指示通り「存在するもののみ」実行する）。

## 3. workflowの構成

### 3.1 トリガー

- `workflow_dispatch`：手動実行、`target`（choice: `all`/`bills`/`questions`/`finance`/
  `population`、既定`all`）を選択可能。
- `schedule`：`cron: "0 9 * * *"`（UTC 9:00、dry-runのみ）。

### 3.2 既存3workflowとのcron時刻分散設計

既存3workflowのcronはすべてUTC基準で次の通りで、いずれもJST深夜〜早朝に集中している。

| workflow | cron (UTC) | JST目安 |
|---|---|---|
| `update-council-documents.yml` | `0 21 * * *` | 翌6:00ごろ |
| `sync-council-data.yml` | `30 18 * * *` | 翌3:30ごろ |
| `civic-archive-sync.yml` | `0 19 * * *` | 翌4:00ごろ |

新規の `auto-update-dryrun.yml` は `0 9 * * *`（UTC 9:00＝JST 18:00ごろ）とし、
既存3件から**半日以上**離した。理由は次の通り（workflowファイル冒頭コメントにも記載）。

1. 本workflowが呼ぶ各Updaterも延岡市公式サイトへ実際にHTTPアクセスする
   （`fetch-nobeoka-council-documents.mjs --dry-run`のサブプロセス実行、新規資料への
   到達確認、`core/fetch.mjs`の`fetchWithRetry`等）。既存3workflowと同時間帯に走らせると、
   同一ホストへのアクセスが短時間に重なる可能性がある。
2. GitHub Actionsのジョブ実行枠・cron起動タイミングの競合を避ける。
3. 日中（JST 18:00ごろ）に完了させることで、当日中に人がPRの内容を確認しやすくする
   （既存3件はJST深夜〜早朝実行のため、翌朝以降にしか確認できない）。

### 3.3 対象Updaterの逐次実行（並列禁止）

タスク指示「同一ホストへの負荷集中を避けるため、複数Updaterを並列実行しない」に対応し、
1ジョブ内でstepを直列に並べた（GitHub Actionsのjob内stepは元々直列実行のため、
matrix等の並列化構文を意図的に使っていない）。加えて、実際にHTTPアクセスを伴う
Updaterが実行された場合のみ、次のUpdaterへ進む前に30秒待機（`sleep 30`）を挟み、
短時間に複数Updaterが同一ホストへ連続アクセスすることを避けている。

実行順序：`bills` → `questions` → `finance` → `population` →
品質監査（`validate:data` → `typecheck` → `lint`）。

各Updater実行stepは `continue-on-error: true` にしている。Updaterは
RED判定がある場合に`process.exitCode = 1`で終了する設計（`update-bills.mjs`等を確認済み）
のため、これをそのままにすると1つのUpdaterのRED判定で以降のUpdater実行・レポート収集・
PR作成が止まってしまう。RED件数はstepの終了コードではなくレポートJSONの内容から
集計し、PR本文に明記する設計にした。

### 3.4 品質監査

実際に`package.json`へ存在するnpm scriptsのみを対象にした。

- `npm run validate:data`
- `npm run typecheck`
- `npm run lint`

（`npm run build`はdry-run専用workflowとしては重く、タスク指示にも明示されていないため
含めていない。既存3workflowはいずれも本番データ変更を伴うため`build`まで実行しているが、
本workflowは本番データを一切変更しないため、フルbuildまでは必須ではないと判断した。
詳細は「6. 今後の課題」参照）。

各監査stepも`continue-on-error: true`とし、失敗してもレポート作成・PR作成は継続する。
ただし、監査結果（`success`/`failure`等）はPR本文に必ず記載し、job全体の最後に
「監査のいずれかが失敗していればjobを失敗として終了する」stepを置くことで、
GitHub Actions上のjob成否には監査結果が正しく反映されるようにした（continue-on-errorで
握りつぶして常時green表示になることを防止）。

### 3.5 PR生成の仕組み（本番データ変更を伴わないこと）

`sync-council-data.yml`と同じ「botブランチ作成 → commit → push → `gh pr create`」方式。

- 差分検出：`git status --porcelain -- reports/auto-update`（`reports/auto-update/`配下の
  みを対象。他ディレクトリは一切見ない）。
- 差分がある場合のみ、`bot/auto-update-dryrun-<timestamp>`ブランチを作成し、
  `git add reports/auto-update` → commit → push → `gh pr create`（base: `main`）。
- **commitに含まれるのは`reports/auto-update/`配下のレポートファイルのみ**
  （`src/data/*.json`は各Updaterがそもそも書き換えないため、対象にすらならない）。
- PR本文（`pr-body.md`、Node inline scriptで生成）には以下を含む。
  - 実行日時、実行対象（target入力値）、ワークフロー実行ログURL
  - Updaterごとの「選択対象か／実装済みでdry-run実行したか・未実装でスキップしたか」の表
  - 検出合計・新規件数・更新件数・GREEN/YELLOW/RED/ERROR件数（今回差分が出たレポートの合算）
  - RED判定が1件でもある場合は「⚠️ RED判定あり」セクションを追加し、
    「このPRをauto-mergeの対象にしないでください」と明記
  - 品質監査結果（validate:data/typecheck/lintそれぞれの成否）。いずれか失敗していれば
    「マージ前に必ず内容を確認してください」を追記
  - 本番データ変更が無いことの明記、変更ファイル一覧
- 本workflow自体はauto-mergeを実装していない（既存3workflowも未実装であり、タスク指示
  通りこのworkflowでも実装しない）。

### 3.6 Artifact

`actions/upload-artifact@v4`で`reports/auto-update/run-*.json`・`status.json`を
`if: always()`（監査失敗時・レポート差分なし時も含め常に）アップロードする
（`retention-days: 30`、既存civic-archive-sync.ymlの`archive-crawler-state`と同程度）。

## 4. workflow構文の検証結果

ローカルにactionlintが無かったため、GitHub公式の`rhysd/actionlint`をリリースページから
ダウンロードして検証した（`v1.7.12`、Windows amd64バイナリ）。

```
$ actionlint .github/workflows/*.yml
（既存3workflow含め、出力なし＝エラー0件）
$ actionlint .github/workflows/auto-update-dryrun.yml
（出力なし＝エラー0件、終了コード0）
```

加えて、`js-yaml`（npm）でYAMLとして正しくパースできること、`on`キーが文字列
（YAML 1.1由来の`true`への暗黙変換ではなく）として解釈されること、`jobs.dryrun.steps`が
想定通り16個であることも確認した。

## 5. ローカルでのコマンド動作確認結果

workflowが呼ぶ各コマンドをすべて実際にローカル実行し、正常終了することを確認した。

```
$ node scripts/auto-update/bills/update-bills.mjs
[update-bills] 検出=26 GREEN=26 YELLOW=0 RED=0 ERROR=0 総合判定=GREEN サーキットブレーカー=正常
EXIT=0

$ node scripts/auto-update/questions/update-questions.mjs
[update-questions] 検出=14 GREEN=14 YELLOW=0 RED=0 ERROR=0 総合判定=GREEN サーキットブレーカー=正常
EXIT=0

$ node scripts/auto-update/finance/update-finance.mjs
[update-finance] 検出=5 GREEN=4 YELLOW=1 RED=0 総合判定=YELLOW サーキットブレーカー=正常
EXIT=0

$ node scripts/auto-update/population/update-population.mjs
[update-population] 検出=1 GREEN=1 YELLOW=0 RED=0 総合判定=GREEN サーキットブレーカー=正常
EXIT=0
```

また、PR本文を生成するNode inline script（workflow内`Build PR summary from run reports`
stepのheredoc本体）を実際のレポートJSON群に対して単体実行し、期待通りの集計・
Markdown出力になることを確認した（bills×3件・questions×2件・finance×2件・
population×2件の実レポートを合算し、検出合計118・GREEN116・YELLOW2・RED0の
Markdownテーブルとサマリーが正しく生成されることを確認）。

補足：`update-bills.mjs`は内部で`fetch-nobeoka-council-documents.mjs --dry-run`を
サブプロセス実行するため、ローカル確認の副作用として`reports/council-document-update-report.json`・
`reports/sync-council-data-report.json`のタイムスタンプ等が更新されている（既存スクリプトの
既定動作であり、本workflow・本タスクが新たに実装した挙動ではない）。`src/data/*.json`
（本番データ）への書き込みは発生していない。これらのローカル確認結果は本セッションでは
commitしていない。

## 6. 未実装・今後の課題

- **本番自動commitの有効化**：本workflowはタスク指示通り、dry-run結果のレポートPR化
  までを実装しており、`src/data/*.json`への自動反映は行わない。将来的にGREEN判定を
  自動反映する場合は、`core/report.mjs`の`updateStatus()`が既に管理している
  `consecutiveSuccessfulRuns`/`eligibleForAutoApply`（3回連続成功かつYELLOW=0で true）
  を判定条件として使えるが、実際に`src/data/*.json`へ書き込むapply処理自体は
  `scripts/auto-update/integration/apply-green.mjs`（Workstream統合担当）側の責務であり、
  本workflowはそれをまだ呼び出していない。
- **`npm run build`監査の要否**：現状はdry-run専用のため`validate:data`/`typecheck`/`lint`
  のみを監査対象にしている。将来、本番反映（apply-green.mjs呼び出し等）を同じworkflowに
  追加する場合は、既存3workflowと同様にフルbuild（prerender・SEO検証含む）を監査に含める
  ことを検討する。
- **PR本文の情報源URL明記**：`sync-council-data.yml`のPR本文は監視ページのURLを列挙して
  いるが、本workflowのPR本文は各Updaterのレポート内`watchedSource`等の個別URLまでは
  展開していない（Updaterごとに監視対象URLの数・構造が異なるため、詳細はワークフロー
  実行ログ・artifactのレポートJSONを参照する設計にした）。必要であれば、各レポートの
  `watchedSource`／`entries[].sourceUrl`を集約してPR本文に追記する拡張が可能。
- **実際のGitHub Actions実行**：本セッションはローカル環境のため、このworkflowを
  実際にGitHub Actions上で動かすことはできていない。次回、GitHubへpush後に
  `workflow_dispatch`で`target=bills`等の小さい範囲から手動実行し、Artifact・PR作成が
  想定通り機能するかを確認することを推奨する。
- **PR発生頻度についての注意点**：`core/report.mjs`の`writeRunReport()`は実行のたびに
  `run-<target>-<startedAt>.json`という一意なタイムスタンプ付きファイル名で新規ファイルを
  書き出す設計になっている（Workstream A所管、本タスクでは変更不可）。そのため、
  Updaterが1件でも実行されれば`reports/auto-update/`には毎回「新規ファイル」の差分が
  生じ、本workflowの差分検出（`git status --porcelain -- reports/auto-update`）は
  ほぼ毎回trueになり、**内容が実質「変更なし（GREEN・新規0件）」の日でも、cronが回るたびに
  PRが作成される**。これは`sync-council-data.yml`・`civic-archive-sync.yml`が既存の
  監視対象ファイル（`councilWatchedDocuments.json`等）の差分で判定しているのと同じ
  「そのファイルが変わったら差分あり」という設計方針を`reports/auto-update/`にもそのまま
  適用した結果であり、本workflow独自の不具合ではないが、運用上は「ほぼ毎日PRが立つ」
  想定でよいか、あるいは「新規0件・YELLOW/RED0件の日はPRを作らない」条件をこの
  workflow側（またはcore/report.mjs側）に追加すべきかは、Workstream A・運用担当と
  すり合わせが必要な今後の検討事項として記録しておく。
