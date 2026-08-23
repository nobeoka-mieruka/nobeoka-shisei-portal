# Phase87 QAインフラ拡張 作業報告

## 目的

今回、人手（並列worker）で確認した内容のうち、今後自動検出できるものをドラフトスクリプト化した。
既存の監査資産（`scripts/validate-data.mjs`、`scripts/ui-audit-phase76.mjs`、
`scripts/site-completeness-audit.mjs`）を読み込み、重複しない範囲で拡張案を設計・実装・動作確認した。

**注意：本Phaseで作成したものはすべてドラフトです。`scripts/` への正式配置、`package.json`
への登録、`docs/` への配置は一切行っていません（Phase88の判断待ち）。`src/data/*.json` や
既存の `scripts/*` ファイルへの編集も行っていません。git commit / push も行っていません。**

## 作成した成果物

すべて `reports/phase78-88-staging/` 配下に格納。

### ドラフトスクリプト本体（`phase87-draft-scripts/`）

| ファイル | 内容 |
|---|---|
| `_lib.mjs` | ドラフト共通の読み取り専用ヘルパー（JSON読込・再帰walk等） |
| `check-duplicate-ids-global.mjs` | ID重複の横断チェック（ファイル内＋ファイル横断） |
| `check-orphan-foreign-keys.mjs` | 外部キー参照切れ（孤立ID）の横断チェック |
| `check-source-refs-coverage.mjs` | 出典（sourceRefs等）カバレッジのカテゴリ別集計 |
| `check-completeness-status-usage.mjs` | CompletenessStatus語彙とstatus系フィールドの棚卸し・混線検出 |
| `check-finance-unit-anomalies.mjs` | 財政データの単位異常（円/千円混在の疑い）・前年比異常変動検出 |
| `check-term-overlaps.mjs` | 任期重複・任期逆転の横断チェック |
| `check-search-index-and-updates-order.mjs` | 検索インデックスの母数カバレッジ＋updateHistoryの日付降順チェック |
| `check-list-vs-detail-count.mjs` | 一覧の母数とdist/内の詳細ページ生成数の整合チェック |
| `quality-check-draft.mjs` | 上記＋既存npm scriptsを1コマンドでまとめて実行する統合案 |

8本すべて実際に実行し、動作確認済み（詳細は `phase87-qa-infra-findings.json` を参照）。
いずれも**読み取り専用**（`fs.readFileSync`/`readdirSync`のみ使用）で、`src/data`・`scripts/`
への書き込みは一切行わない設計にしている。

### その他

- `phase87-qa-infra-findings.json` — 本Phaseの構造化された成果一覧（作成スクリプト・テスト結果・重複回避確認・既存スクリプト拡張提案）
- `phase87-docs-draft.md` — `docs/`配置候補の「データ更新後の品質チェック手順」ドラフト文書

## 既存資産との重複回避について

- **broken internal link / blank page**：`scripts/ui-audit-phase76.mjs` に既に実装済みのため、新規スクリプトは作らず、統合レポートのキー名を揃えるという設計メモのみ提案した。
- **title/description欠落**：同上、`ui-audit-phase76.mjs` に既存のため新規実装なし。
- **0件誤表示**：新規スクリプトではなく、既存の `scripts/site-completeness-audit.mjs` の拡張案として `phase87-qa-infra-findings.json` の `recommendationsForExistingScriptExtension` に記載した（指示通り）。
- その他（duplicate ID／orphan ID／missing sourceRefs／invalid status／completeness母数不整合／財政単位異常／任期重複・逆転／search index漏れ／updates日付順）はいずれも既存スクリプトに未実装であることを確認した上で新規ドラフト化した。

## 動作確認で見つかった実データ上の注目点（自動チェックの有効性の裏付け）

ドラフトスクリプトを実データに対して実行したところ、いくつか**実際にレビュー価値のある事実**を検出できた（今回は報告のみ、修正は行っていない）。

1. **`updateHistory.json` の並び順が一部崩れている**：`u1`〜`u4`（2026-07-14の初期エントリ）の直後に、最新の`u98`〜`u104`（2026-08-22／23）が続いており、配列末尾付近で日付降順が2箇所崩れている。表示ページは配列順をそのまま使うため、更新履歴ページの並びに影響する可能性がある。
2. **カテゴリID「childcare」「disability」「finance」の複数ファイル間での再利用**：`archivePolicyCategories.json` と `cityGuideCategories.json`（`childcare`／`disability`）、`archiveCrawlerTargets.json` と `archivePolicyCategories.json`（`finance`）で同じidが使われている。異なるドメインでの意図的な命名一致の可能性が高いが、念のため一覧化した。
3. **`financeDashboard.json` の歳入内訳合計が総額（`totalThousandYen`）と約9%乖離**：内訳項目に「その他」等の省略がある可能性が高く、実害の有無は人手確認が必要。
4. **`archiveMemberAffiliations.json` の党派切替は同日付での境界一致**：既存の `checkNoOverlappingPeriods` と同じ判定基準（`prevEnd >= curStart`）で「重複」と判定されるが、これは同日付での党派変更という正当なケースであり、修正不要と判断した。

いずれも即エラーではなく「要確認候補」としての性質のものだが、1は特に軽微な運用修正で対応可能な実バグの可能性が高い。

## 統合案 `npm run quality:check`（ドラフト）の動作確認

`quality-check-draft.mjs` を `--skip-build` オプション付きで実行し、以下を確認した。

- `validate:data` / `typecheck` / `lint` / `validate:seo` / `validate:content` / Phase87横断監査8本すべてを、途中で失敗しても止めずに最後まで実行できることを確認（Windows環境で `spawnSync` に `shell:true` を指定する必要があることが実機テストで判明し、修正済み）。
- 最終的に `PASS` / `WARNING` / `FAIL` の一覧と総合結果を表示することを確認。実行時は上記の `updateHistory.json` 並び順の実データ検出により `総合結果: WARNING` となった（他はすべてPASS）。
- `validate:data` / `typecheck` / `lint` / `build` は `severity: "error"`（失敗でFAIL）、Phase87の新規ドラフト群は当面 `severity: "warn"`（失敗でもWARNING止まり）という段階導入の設計にしている。

## 品質確認（本Phase自体について）

- 本Phaseは `src/data`・`scripts/`・`package.json` を一切変更していないため、`npm run validate:data` / `typecheck` / `lint` / `build` への影響はない（変更なしのため実行不要と判断し、個別のドラフトスクリプト単体の動作確認のみ実施した）。
- 作成した8本のドラフトスクリプトおよび `quality-check-draft.mjs` は、いずれも実行してエラーなく完走することを確認済み。

## Phase88へのお願い（判断が必要な事項）

1. 8本のドラフトスクリプトのうち、`scripts/` へ正式配置するもの・統合するもの（例：`check-search-index-and-updates-order.mjs` のupdateHistory順序チェックは `validate-data.mjs` へ数行追加する形が望ましい）・ドラフトのまま保留するものの仕分け。
2. `package.json` への `quality:check` 等のscripts登録の要否。
3. `phase87-docs-draft.md` の `docs/` への正式配置の要否・内容調整。
4. 上記「動作確認で見つかった実データ上の注目点」1〜3の実データ修正要否（本Phaseでは未修正）。

## 変更ファイル一覧（すべて新規作成、既存ファイルへの変更なし）

- `reports/phase78-88-staging/phase87-draft-scripts/_lib.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/check-duplicate-ids-global.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/check-orphan-foreign-keys.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/check-source-refs-coverage.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/check-completeness-status-usage.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/check-finance-unit-anomalies.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/check-term-overlaps.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/check-search-index-and-updates-order.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/check-list-vs-detail-count.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/quality-check-draft.mjs`
- `reports/phase78-88-staging/phase87-draft-scripts/_out-*.json`（各スクリプトのテスト実行結果、参考用）
- `reports/phase78-88-staging/phase87-docs-draft.md`
- `reports/phase78-88-staging/phase87-qa-infra-findings.json`
- `reports/phase78-88-staging/phase87-qa-infra-report.md`（本ファイル）

git commit / push は行っていません。
