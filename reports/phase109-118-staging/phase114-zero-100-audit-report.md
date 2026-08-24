# Phase114: 「0件／100%／完全収録」等の誤解を招く表示 横断監査 報告

対象: 延岡市政見える化ポータル（E:\nobeoka-gikai）
実施日: 2026-08-24
担当: Phase114 worker

## 目的

サイト全体（`src/pages/*.tsx`、`src/components/*.tsx`、`src/lib/seo.ts`）を対象に「0件」「0名」「100%」「完全収録」「確認済み」「全件」「すべて」「完全」を横断検索し、**数字自体が正しくても、母数（分母）が限定されている場合に「全資料を確認済み」とユーザーが誤解しない表現になっているか**を検証する。

先行監査 `reports/phase89-100percent-audit-findings.json`（Phase89、同種の監査でコード修正0件）を先に読み、同じ検索パターンの単純な繰り返しにならないよう、今回は「母数の正確性」（Phase89で検証済み）ではなく「表現の分かりやすさ・誤解防止」に焦点を当てて再確認した。

## 実施内容

1. `src/pages`（35ファイル該当）、`src/components`（12ファイル該当）、`src/lib/seo.ts` を対象に、`0件` `0名` `100%` `完全収録` `確認済み` `全件` `すべて` `完全` 等のパターンで横断検索した。
2. `src/lib/completeness.ts`（`CompletenessStatus` 型・`simpleCompleteness()` ・`formatCoverageRate()`）本体と、その全19箇所の呼び出し元（`src/lib/dataCompletenessSummary.ts`、`src/pages/DataStatusPage.tsx`）を確認し、`confirmed_zero` / `not_collected` / `under_review` / `unavailable` 等のステータスを母数から除外して100%を作り出している箇所が無いかを確認した。
3. 一般質問の対象会期数算出（`src/lib/generalQuestionStats.ts`）で、会議録未取得会期（`transcriptAvailable:false`）が母数から除外されていないかを確認した。
4. 母数が限定的な項目（現職市長のみを対象とする公約DB、詳細アーカイブの収集範囲年度、記名投票1件のみの議案等）について、その限定が本文中に明示されているかを個別に確認した。
5. `src/lib/seo.ts` のページ別meta description生成ロジックのうち、件数0件のケースの分岐を確認した。

## 主な検証結果

### 1. `src/lib/completeness.ts` とその呼び出し元は健全（Phase89の結論を再確認）

母数（`totalKnown`）は全19箇所の呼び出しで `billVotes.length` 等の実データ配列の全長、または `questionCollectionStatus.json` の会期一覧全件を使用しており、特定ステータスのレコードを事前に除外して母数を小さくする実装は見つからなかった。`confirmed_zero`（確認した結果ゼロ）と `not_collected`（未調査）は型レベルで区別されている。

### 2. 母数が限定的な項目は、必ずその限定を文中で明示している

- `MayorDetailPage.tsx`：「当サイトの公約データベースは現職市長の任期のみを対象としており、歴代の市長の…政策原文は収集していません」「この市長の在任期間は詳細アーカイブの収集範囲（○〜○年度）外のため未収集です」
- `MethodologyActivityRadarPage.tsx`：「現職議員{entries.length}名は全員この記名投票の対象だったため{entries.length}名とも算定可能ですが、**対象議案が1件のみである点にご留意ください**」
- `CouncilDocumentsArchivePage.tsx`：統計カードに「全件一覧ではありません」のhintを常設し、本文でも「少数ずつ登録しています」と明示。
- `DataStatusPage.tsx`：「収録件数は登録済みレコード数の事実集計であり、実際に存在するはずの全件数（分母）を当サイトが把握しているとは限りません」という総括注記あり。

### 3. 「0件」表示は一貫して「未確認」と区別されている

`CouncilActivityPage.tsx` `MemberFormerDetailPage.tsx` `CouncilActivityMemberPage.tsx` `MayorDetailPage.tsx` `PolicyComparePage.tsx` `MayorPolicyProgressPage.tsx` など、0件が表示されうる箇所では例外なく「0件という意味ではありません」「確認できていないだけ」等の注記が併記されている。これは `src/components/EmptyState.tsx`（TASK-074）の共通5区分バッジ設計に沿ったもの。

### 4. `src/lib/seo.ts` のmeta descriptionも0件を確認済みゼロと誤読させない設計

`councilSessionSeo()` は、資料未収集の会期について「（0件）を掲載しています」ではなく「本サイトでは現在未収集です（資料が存在しないという意味ではありません）」という別文言に分岐する実装になっており、コード内コメントにもCLAUDE.mdの「未確認データを0として扱わない」方針への準拠が明記されている。

## コード修正

**直接修正：0件**
**提案のみ：0件**

横断検索した約60箇所の該当表現をすべて個別に確認したが、母数を推測・除外して100%や完全収録を演出している箇所、または母数の限定を隠したまま「確認済み」「全件」と表示している箇所は発見されなかった。Phase17・TASK-074・TASK-078〜081・TASK-097・Phase86・Phase89・Phase111等、これまでの複数回の監査で既に同種の問題が繰り返し点検・修正されてきた結果、既存の実装・文言が十分に安全な設計になっていることを確認した。

## 品質確認

コード・データの変更が無いため、`npm run validate:data` / `typecheck` / `lint` / `build` は実行していない。

## 変更したファイル

なし。

## 成果物

- `reports/phase114-zero-100-audit.json`
- `reports/phase109-118-staging/phase114-zero-100-audit-report.md`（本ファイル）
