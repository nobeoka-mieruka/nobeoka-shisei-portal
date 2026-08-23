# Phase89: 「100%／完全収録」断定表示の横断監査 報告

対象: 延岡市政見える化ポータル（E:\nobeoka-gikai）
実施日: 2026-08-23
担当: Phase89 worker

## 目的

サイト内で「100%」「完全収録」「全件収録」「完全確認」等の断定的な完全性表示が、実際に一次資料で確認できた母数（分母）に基づいているか、それとも母数を推測・決め打ちして100%を作り出していないかを横断的に検証する。

## 実施内容

1. `src/pages` `src/components` `src/lib` 全体、およびビルド済み `dist/**/*.html`（2,245ファイル）を対象に、`100%` `完全収録` `全件収録` `完全確認` `全期間` 等のパターンで横断検索した。
2. CSSの `width:100%` `calc(100%-...)` 等のレイアウト用途を除外した。
3. 該当箇所ごとに、以下を実データ・実コードで検証した。
   - 母数フィールド（`totalKnown` 等）が実在し、`null` でないか
   - その母数が推測ではなく実データ配列長（`billVotes.length` 等）や一次資料確認済みフラグに基づいているか
   - `src/lib/completeness.ts` の `simpleCompleteness()` / `CompletenessStatus` 語彙を正しく通っているか、独自に100%を決め打ちしていないか
4. `src/lib/completeness.ts` の `CompletenessStatus` 語彙（`complete` / `partial` / `not_collected` / `not_available` / `unknown` / `under_review` / `confirmed_zero`）が各ページで正しく使い分けられているかを点検した。
5. トップページ・データ収録状況（`/data-status`）・議員活動バロメーター・財政（市債・基金・予算等）・選挙・委員会・一般質問・議案等、主要ページを横断確認した。

## 主な検証結果

### 1. `src/lib/completeness.ts` は健全に設計されている

- 母数（`totalKnown`）が `null` の場合、`coverageRate` も必ず `null` になり、`formatCoverageRate()` は「算出不可（母数未確認）」を返す。
- `formatCoverageRate()` は、四捨五入で99.9%が「100%」に見えてしまう問題を避けるため、実際にちょうど100%（`complete`）でない限り表示上は99%が上限になるよう切り捨てる実装になっている。
- `simpleCompleteness()` は `collected >= totalKnown` の場合のみ `complete` を返す設計であり、母数を下回っている限り `partial` または `not_collected` になる。

### 2. `/data-status`（データ収録状況ページ）の「完全収録」バッジは全て実データの配列長に基づく

`DataStatusPage.tsx` の `completenessRows`（14項目）を全て確認した。母数はいずれも次のような実データ配列長であり、決め打ちの数値は使われていなかった。

- 一般質問：`questionStats.targetSessionCount`（`questionCollectionStatus.json` の会議録取得済み会期数）
- 議案関連3項目：`billVotes.length`（1,177件）
- 政治資金団体：`politicalFundOrganizations.length`
- 委員会：`committees.length`
- 財政5項目：`archiveFiscalYears.length`
- 歴代市長：`archiveMayorTerms.length`
- 議員プロフィール2項目：`members.length`

トップページの「データ整備状況」抜粋（`src/lib/dataCompletenessSummary.ts`）も同じ実データ・同じ `simpleCompleteness()` を使っており、`/data-status` と数値が食い違わない設計だった。

### 3. 議員活動バロメーターの「実施率100%」も母数を実データで検証済み

`src/lib/activityRadar.ts` の分母は `TRANSCRIPT_AVAILABLE_SESSION_IDS`（`questionCollectionStatus.json` で会議録取得を確認済みの会期のみ）に基づいており、推測での母数拡張は無い。

個人ページの「議案等の意思表示：100%（2／2）」についても実データで裏取りした。分母 `billsWithAnyMemberVoteDisclosed` を実際に計算したところ、現在サイト全体で議員個人の賛否（`memberVotes`）が1件以上入っている議案は **1,177件中2件のみ** であることを確認した。分母が小さいのは「まだ個人別内訳が公開されている議案自体が2件しかない」という実態であり、母数の水増しではない。

### 4. 財政ページの完全性フォールバック文言も安全

`FinanceDebtPage.tsx` の「対象期間の全年度で市債残高を確認済みです。」というフォールバック文言は、`missingFiscalYears()` が全年度を実走査して1件でも未収録があれば非nullの注記に切り替える設計により保護されており、本当に全年度確認済みの場合のみ表示されることを確認した。

### 5. `dist` の「100%」出現1,253件は大半がCSS

ビルド済みHTMLで `100%` は1,253ファイルに出現していたが、実体を追跡した結果、大半は `ReviewFlowTimeline.tsx` の `calc(100%-1.25rem)`（タイムライン縦線の高さ計算、審査フロー図の全ページに出現）であり、データ完全性の表示とは無関係だった。

## コード修正

**今回のコード修正は0件。** 監査の結果、母数を推測で埋めて100%を作り出している箇所、または `simpleCompleteness()` 等の既存ロジックを迂回して独自に100%を決め打ちしている箇所は見つからなかった。既存の実装（Phase17・TASK-078・TASK-080・TASK-081・TASK-097・Phase86 UI監査・Phase111等）が既にこの種の問題を強く警戒した設計になっており、安全な修正を要する不具合は発見されなかった。

## 今後の検討候補（データ収集・保守が必要な項目）

コードのバグではないが、将来のドリフトリスク・保守性の観点で3件を `flaggedForFutureDataCollection` として記録した。

1. **`DataStatusPage.tsx:305` の `mayorGapCount = 13`（手動集計値）**
   `npm run validate:data` を実行し、`archiveMayorTerms.json` の空白期間検出結果（13件）と一致することを確認済み。ただし手動同期が前提の値であり、将来データが更新されて空白件数が変わった際にコード側の更新を忘れると「完全収録」バッジの判定がずれるリスクが残る。`scripts/validate-data.mjs` の空白検出ロジックを共有関数化し、ビルド時に動的算出する方式への変更を推奨（緊急性は低い）。

2. **`src/lib/activityRadar.ts:164-168` のJSDocコメント乖離**
   コメントは「常にdataStatus:"missing"を返す」と書かれているが、実装は個人別賛否データが登録された議案がある場合に `complete` を返すよう既に更新されている（Phase97相当）。ユーザー表示への影響はないが、コメント更新を推奨。

3. **`CouncilActivityMemberPage.tsx` の★（星）評価表示**
   本監査の直接対象（100%等の完全性表示）ではないが、隣接する懸念として記録した。星の数は既に検証済みの指標値（0〜100）を1〜5段階に変換した視覚表現であり、新たな採点ロジックは追加されていない。ただし、CLAUDE.mdの「推測、架空データ、根拠のない順位、独自採点を掲載しない」という方針や、同じ議員活動バロメーター機能内の別コンポーネントが明示的に「ランキングという語は使わない」としている方針との整合性は、プロダクト判断として別途検討の余地がある。データ精度そのものに問題はないため、コード変更は行っていない。

## 品質確認

- `npm run typecheck`：エラー0件（`tsc -b` 完走）
- `npm run lint`：エラー・警告0件（`oxlint` 完走）
- 上記はいずれも今回コード変更が無いためのベースライン確認。既存のerrors/warningsを増やしていないことを確認済み。

## 変更したファイル

なし（`src/data/*.json` への直接編集も行っていない）。

## 成果物

- `reports/phase89-98-staging/phase89-100percent-audit-findings.json`
- `reports/phase89-98-staging/phase89-100percent-audit-report.md`（本ファイル）
