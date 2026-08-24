# GREEN自動反映 ロールバック方針（Workstream F）

このドキュメントは、`AUTO_APPLY_GREEN` を将来有効化し、GREEN判定の変更を
`src/data/*.json` へ実際に自動反映するようになった場合の運用方針を定める。

**現時点（本ドキュメント作成時点）では `AUTO_APPLY_GREEN` は無効（デフォルトfalse）であり、
本番データへの自動書き込みは一切行われていない。** 本ドキュメントは、将来有効化する際に
従うべき方針を先にまとめたものである。

## 1. 基本方針：Git履歴をロールバック手段として使う

- GREEN自動反映を有効化した場合、書き込みは**1回の自動実行＝1コミット**を基本単位とする。
  複数targetの変更をまとめて1コミットにしない（原因の切り分けを容易にするため）。
- コミットメッセージには、実行日時・target・反映件数・元になったレポートファイル名を含める
  （例：`auto-update(bills): GREEN 3件を自動反映 [run-bills-2026-08-24T00-00-00-000Z.json]`）。
- 異常が発覚した場合は、**専用の手動バックアップファイルやバックアップディレクトリを探す必要はない**。
  `git revert <コミットID>` で直前の正常状態に戻すことを標準の復旧手段とする。
- そのため、自動反映の実装においても、`*.bak` や `backups/` のような独自バックアップの仕組みを
  新設しない方針とする。バックアップの実体は常にGit履歴そのものである。
- 理由：
  - 専用バックアップディレクトリは肥大化・陳腐化・「どれが最新の正しい状態か分からなくなる」リスクを生む。
  - Gitは既に「誰が・いつ・何を・なぜ変えたか」を構造化して保持しており、二重管理を避けられる。
  - `git revert` は追加のコミットとして記録されるため、ロールバックの事実そのものが監査可能になる。

## 2. 誤反映時の具体的な復旧手順

### 2.1 直近1回の自動反映コミットを取り消す（最も一般的なケース）

```bash
# 1. 何が起きたか確認する
git log --oneline -5
git show <該当コミットID>

# 2. そのコミットだけを打ち消す新しいコミットを作る（履歴は残る、force pushしない）
git revert <該当コミットID>

# 3. 打ち消しコミットの内容を確認してからpush
git show HEAD
git push origin main
```

### 2.2 直近複数回の自動反映コミットをまとめて取り消す

```bash
# 直近N件の自動反映コミットIDを新しい順に確認
git log --oneline --grep="auto-update(" -n 10

# 古い順に1件ずつrevertする（衝突を避けるため、まとめてrevertレンジを使う場合も
# 必ず --no-commit で内容を確認してからコミットする）
git revert --no-commit <古いコミットID>..<新しいコミットID>
git status
git diff --cached
git commit -m "auto-update: 自動反映コミットN件を一括ロールバック"
git push origin main
```

### 2.3 pushする前に気付いた場合（ローカルのみ）

```bash
# まだpushしていない自動反映コミットを取り消す（履歴を書き換える。共有ブランチでは使わない）
git reset --hard HEAD~1
```

このコマンドはリモートと共有していないローカルコミットにのみ使用する。
一度でも `git push` 済みのコミットに対しては 2.1 の `git revert` を使う
（force push で履歴を書き換えない）。

### 2.4 サーキットブレーカーが発動していた場合

サーキットブレーカー（`scripts/auto-update/core/classify.mjs` の `checkCircuitBreaker`）が
発動した実行では、そもそもGREEN自動反映は行われない設計とする
（`isEligibleForAutoApply` が `circuitBreakerTripped === true` を除外条件に含む）。
万一、発動前後の境界条件の不具合等でコミットが作られてしまった場合も、
復旧手順は 2.1／2.2 と同じ（`git revert`）。

### 2.5 復旧後の確認

```bash
npm run validate:data
npm run typecheck
npm run build
```

を実行し、`src/data/*.json` がスキーマ的・型的に正しい状態へ戻ったことを確認してから
デプロイ（Cloudflare Pages自動デプロイ）が完了するのを待つ。

## 3. 有効化の前提条件（再掲・整合性確認用）

`AUTO_APPLY_GREEN=true` にする場合でも、個々の実行が実際に本番データへ書き込んで良いかは、
`scripts/auto-update/integration/apply-green.mjs` の `isEligibleForAutoApply(status, report)` が
`true` を返す場合に限る。条件は以下のすべてを満たすこと：

- `reports/auto-update/status.json` の当該targetの `consecutiveSuccessfulRuns >= 3`
  （直近3回以上、RED0件・エラーなし・サーキットブレーカー未発動の連続実行実績があること）
- 当該実行の `report.summary.red === 0`
- 当該実行の `report.summary.yellow === 0`（人間確認が必要な項目が1件もないこと）
- `report.circuitBreakerTripped === false`

この判定ロジックは `core/report.mjs` の `updateStatus` が計算する `eligibleForAutoApply` と
整合させてある（`consecutiveSuccessfulRuns >= 3` かつ `yellow === 0` が両者に共通する必要条件）。
`apply-green.mjs` 側はこれに加えて、「今まさに渡された当該レポート自体」の `red === 0` と
`circuitBreakerTripped === false` も明示的に再チェックする（statusは過去の集計であり、
直近のレポート自体の異常有無は別途確認する必要があるため）。

## 4. 未実装であることの明示

`scripts/auto-update/integration/apply-green.mjs` は、`AUTO_APPLY_GREEN=true` の場合でも
**実際に `src/data/*.json` へ書き込む処理を実装していない**。今回のスコープは
「将来ONにできる構造（フィーチャーフラグ・適用可否判定・dry-runログ）」を作ることまでであり、
実際の書き込み処理・Gitコミット作成処理は、本ロールバック方針を踏まえた上で別途実装する。
