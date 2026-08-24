# Workstream F：GREEN自動反映 統合・安全装置 実装報告

## 実装したファイル一覧

- `scripts/auto-update/integration/apply-green.mjs`（新規作成）
  - GREEN自動反映エンジンの骨格。フィーチャーフラグ判定・GREEN項目一覧化・
    適用可否の最終判定・dry-runログ／レコード出力を実装。
- `scripts/auto-update/integration/rollback-policy.md`（新規作成）
  - GREEN自動反映を将来有効化した場合のロールバック方針書（コードではなく方針文書）。

上記2ファイル以外は編集していない（`scripts/auto-update/core/`・`bills/`・`.github/workflows/`・
`package.json`・`src/data/*.json` はいずれも未変更）。

## AUTO_APPLY_GREEN の現在値と有効化の前提条件

- 現在値：**false（デフォルト）**。環境変数 `AUTO_APPLY_GREEN` が文字列 `"true"` と厳格一致する
  場合のみ有効（`readAutoApplyGreenFlag`）。未設定・`"false"`・その他の値はすべて無効側。
- 今回の実装では、`AUTO_APPLY_GREEN=true` にしても**実際の書き込みロジックは実装していない**ため、
  常にdry-run相当の動作になる（ログ・レポート出力のみ）。
- 将来「実際に書き込む」機能を追加する場合の前提条件（`isEligibleForAutoApply(status, report)`）：
  - `reports/auto-update/status.json` の当該targetの `consecutiveSuccessfulRuns >= 3`
  - 当該実行レポートの `summary.red === 0`
  - 当該実行レポートの `summary.yellow === 0`
  - `report.circuitBreakerTripped === false`
  - これは `core/report.mjs` の `updateStatus` が計算する `eligibleForAutoApply`
    （`consecutiveSuccessfulRuns >= 3 && yellow === 0`）と整合させてあり、
    `apply-green.mjs` 側はさらに当該レポート自体の `red===0`／サーキットブレーカー未発動も
    明示的に再チェックする。

## 動作確認結果（既存の議案レポートを使った実地テスト）

入力：`reports/auto-update/run-bills-2026-08-23T22-45-30-426Z.json`
（Workstream C生成済み、GREEN26件・YELLOW0件・RED0件）、
`reports/auto-update/status.json`（bills: `consecutiveSuccessfulRuns=4`, `eligibleForAutoApply=true`）

1. `node scripts/auto-update/integration/apply-green.mjs --target=bills`（`AUTO_APPLY_GREEN`未設定＝false）
   - 出力：`GREEN=26件 YELLOW=0件 RED=0件 連続正常実行=4回 最終適用可否(isEligibleForAutoApply)=true`
   - `26件のGREEN項目がありますが、AUTO_APPLY_GREEN=falseのため何も反映していません（dry-run）。`
   - 想定どおりのログが出力されることを確認。
2. `AUTO_APPLY_GREEN=true node scripts/auto-update/integration/apply-green.mjs --report=<同レポート>`
   - `26件のGREEN項目があります。AUTO_APPLY_GREEN=trueですが、本番データへの書き込みロジックは
     今回のスクリプトには実装されていないため、依然として何も反映していません（dry-run相当）。`
   - 実行後に `git status --porcelain src/data` を確認し、`src/data/` 配下に一切差分が発生していない
     ことを確認済み（本番データ無変更）。
3. `isEligibleForAutoApply` の判定：`status.json`（`consecutiveSuccessfulRuns=4`）と当該レポート
   （RED0・YELLOW0・circuitBreakerTripped=false）から `true` を返すことを確認。
   `core/report.mjs` の `updateStatus` が同レポートから計算した `eligibleForAutoApply: true`
   （`reports/auto-update/status.json` に保存済み）と一致し、整合性を確認できた。
4. エラー系：`--target`/`--report` 両方省略時、および存在しないtarget指定時に、それぞれ
   分かりやすいエラーメッセージと `exitCode=1` を返すことを確認。
5. `npx oxlint scripts/auto-update/integration/` を実行し、警告・エラーなし（`exit=0`）を確認。

実行結果として `reports/auto-update/dry-run-apply-bills-*.json` が生成される
（「反映されたであろう内容」の記録。本番データではない）。これは
`apply-green.mjs` の正常出力の一部であり、削除の必要はない。

## ロールバック方針の要約（`rollback-policy.md`）

- 将来 `AUTO_APPLY_GREEN` を有効化した場合、書き込みは**1回の自動実行＝1コミット**を基本単位とし、
  複数targetをまとめてコミットしない。
- 専用バックアップディレクトリ／`*.bak`は作らない。**Git履歴そのものをロールバック手段とする**方針。
- 誤反映時は基本 `git revert <コミットID>`（pushしてしまっている場合の標準手順）。
  push前ならローカルのみ `git reset --hard HEAD~1` も可（共有ブランチでは使わない）。
- 複数コミットの一括ロールバックは `git revert --no-commit <古い>..<新しい>` → 内容確認 → 1コミットに
  まとめる手順を明記。
- 復旧後は `npm run validate:data` / `npm run typecheck` / `npm run build` で状態確認する。
- サーキットブレーカー発動時はそもそも自動反映しない設計（`isEligibleForAutoApply` が除外）。

## 未実装・今後の課題

- **本番データ（`src/data/*.json`）への実際の書き込みロジックは意図的に未実装。**
  今回のタスク範囲は「GREEN自動反映を将来ONにできる構造（フィーチャーフラグ・適用可否判定・
  dry-runログ）」の実装であり、実際にJSONを書き換えてGitコミットを作る処理、および
  各target（bills／questions／finance／population）ごとの「GREEN項目をどのフィールドへ
  どうマージするか」という個別マッピングロジックは範囲外とした。これは各Updater
  （Workstream B・C・D）のデータ構造に依存するため、統合フェーズで各Workstreamの
  レポート形式が固まってから、本方針書に沿って別途実装する必要がある。
- 実際に書き込みを実装する際は、`isEligibleForAutoApply` の判定結果を必ず経由させ、
  かつ1 target = 1コミットの単位を守ること。
- 現状 `listApplicableGreenItems` は `report.entries` の `level === "GREEN"` のみを見ており、
  target固有のスキーマ差異（例：財政・人口Updaterのentries形状がbills/questionsと異なる場合）
  には未対応。`AutoUpdateItemResult` 型（`src/lib/auto-update/types.ts`）に沿っている前提だが、
  各Workstreamの実装が同型を守っているか、統合時に再確認が必要。
- CI（`.github/workflows/`）への組み込みは今回のスコープ外（担当外ファイルのため未着手）。
  `apply-green.mjs` をワークフローから呼び出す場合の具体的なステップ追加は他Workstreamまたは
  統合担当が行う想定。
