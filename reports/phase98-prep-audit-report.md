# Phase98 準備監査 報告（統合前の下調べ・下書き）

生成日: 2026-08-23
担当: Phase98 worker（準備監査。実際の統合・commit・pushは親エージェントが実施）

**結論を先に**: `src/data/*.json` の直接編集は一切行っていません。成果物は本レポートと `reports/phase89-98-staging/phase98-prep-audit-findings.json` のみです。

---

## 1. 主要ページの状態語彙点検（0件／未収録／未確認／確認中／確認済み 等）

対象は指示された11ページ（トップページ、財政4ページ、元議員一覧、歴代市長、一般質問、議案、選挙、委員会）＋参照元の `/data-status`。すべてのページのソースコード（`src/pages/*.tsx`）を精読し、あわせて `npm run build` 済みの `dist/`（2,245ファイル）で対象ルートのHTMLに「0件」という文字列が実際にどう出力されているかも機械確認しました。

### 結果：新規に見つかった「誤解を招きうる表示」は2件、いずれも軽微（現状は非顕在化）

1. **`/data-status` の「最新会期の予定質問」行**（`DataStatusPage.tsx`）
   件数（`questionStats.scheduledCount`、現在15件）が将来0になった場合、「未収録」バッジが自動表示されます。しかし0になる典型的な理由は「最新会期の会議録が既に確認できて“予定”質問という区分自体が無くなった」という健全な状態のはずで、「未収録（調査不足）」を表す `not_collected` バッジとは意味が異なります。現在は15件のため表面化していませんが、将来のデータ更新時に紛らわしい表示になりうる点を記録しました。

2. **`/committees` の確認日欄**
   委員会データに `lastVerifiedAt` が1件も無い場合、確認日の表示（`LastUpdated`）自体が丸ごと非表示になります。財政ページ等は値が無い場合「確認中」と明示する設計なのに対し、このページだけ欄自体が消えるという非対称な挙動です。現在は全委員会にデータがあるため問題ありませんが、設計の一貫性の観点で記録しました。

### 全体所感

対象ページの大部分は、**Phase78-88で実施済みの10並列横断監査**（「数字・出典・0件表示・UI」を専門に扱った監査）によって、既にこの種の問題が集中的に発見・修正済みでした。具体例:

- `ElectionsPage.tsx`：候補者名簿が未確認の選挙を「候補者延べ数」の合算から除外し、未確認分の件数をhintで明示（Phase84発見・修正）
- `FinanceBudgetPage.tsx` / `FinanceDebtPage.tsx` / `FinanceFundsPage.tsx`：`missingFiscalYears()` で欠落年度を年度別に注記し、「確認中」と0円を区別
- `DataStatusPage.tsx`：`CompletenessStatus` の7区分（完全収録／一部収録／確認済み0件／未収録／一次資料未公開／母数未確認／調査中）を全ページで統一利用し、100%表示は実データの分母と一致した場合のみ
- `MayorsPage.tsx`：任期空白13件を明示し、推測で職務代理者を補っていない

このため、今回の監査で見つかった新規の指摘は上記2件（いずれも低優先度・潜在リスク）にとどまりました。

---

## 2. 更新履歴（updateHistory.json）の反映漏れ確認

`src/data/updateHistory.json`（現在115件）と `git log --oneline -30` を突き合わせました。直近のPhase78-88統合コミット（HEAD）では、財政データ拡充・市長記者会見・市政年表拡充・表の折り返し修正の6件が既に `u109`〜`u114` として反映済みです。

しかし、同じコミットメッセージの「修正した実害バグ」セクションに記載されている4件の修正のうち、**3件がupdateHistory.jsonに未反映**であることが分かりました（下書きを作成、`u115`〜`u117`）。

| 下書きID | 内容（市民向け表現） | 対象ページ |
|---|---|---|
| u115 | 歴代市長一覧・関連ページの「代数」表記の誤り（第四代→第29代）を、公式広報紙の原本確認により訂正 | 市長公約の進捗、広報のべおか文字起こし検索、歴代市長一覧・詳細 |
| u116 | 選挙結果一覧の「候補者延べ数」の数え方を修正（未確認選挙分の含み方を是正） | 選挙結果一覧 |
| u117 | 定例会・議会資料ページの検索結果表示（meta description）の文言を、誤解を招く「0件」表現から改善 | 定例会・議会資料（※本文表示ではなくメタ情報のみの変更のため、他2件より市民への直接的な可視性はやや低い） |

4件目（`/members/:id` の元議員SEOメタデータ修正）は本文表示に変化が無く、「市民が実際にサイト上で見られる変化」とは言いがたいため、下書きの対象外としました。

Phase89-97の各workerのレポート（後述）も確認しましたが、いずれも「コード修正は行っていない／実データを変更していない」と明記されており、updateHistory.json側で追加反映すべき事項は見当たりませんでした。

---

## 3. 他workerの成果物（軽く確認）

`reports/phase89-98-staging/` には本監査時点で以下が既に存在していました（phase90・91・96は未生成でした。並行実行中のため待たずに自分の作業を進めています）。

- `phase89-100percent-audit-*`：「100%／完全収録」断定表示の横断監査。**コード修正0件**（既存の `completeness.ts` 設計が既に健全と確認）
- `phase92-term-gaps-*`
- `phase93-orikono-ordinal-*`
- `phase94-source-reinforcement-*`
- `phase95-phase84-followup-*`：議案賛否件数不整合・令和3年度請願陳情0件問題を調査。**コード修正0件**（billVotes.jsonの`unresolvedFields`修正候補7件をレポートのみで提案、令和3年度4会期は「確認済み0件」と一次資料で確認しUI修正は不要と判断）
- `phase97-warnings-recheck-*`：findings.jsonのみ確認（レポート未生成）

いずれも本監査の担当範囲（1〜3）と重複する内容の実コード変更は無く、統合時の競合リスクは低いと見られます。

---

## 4. 統合時の品質ゲート・確認事項チェックリスト（19項目）

詳細は `phase98-prep-audit-findings.json` の `integrationChecklist` に構造化して記載しました。要点:

1. Phase89-97各workerの成果物レポートを全件確認（phase90/91/96含む、統合直前に再確認）
2. 各workerの修正提案（データ直接編集は禁止されているため提案どまり）を親エージェントが検証のうえ適用
3. `updateHistory.json` の統合（本監査のu115〜u117下書きを含め、ID重複に注意して1回にまとめる）
4. `npm run validate:data`（ベースライン：errors=0, warnings=21）
5. `npm run typecheck`
6. `npm run lint`
7. `npm run build`（ベースライン：2241/2241ルート+404.html）
8. `npm run validate:seo` / `npm run validate:content`
9. `npm run validate:finance`（ベースライン：errors=0, warnings=3）
10. `npm run validate:completeness`（ベースライン：errors=0, warnings=0）
11. `npm run validate:political-funds`
12. `npm run quality:check`（`scripts/qa-checks/` 配下8本を含む一括実行。既知WARNING＝updateHistory.jsonの配列順序が一部悪化していないか確認）
13. `reports/phase33-master-unresolved-ledger.json` の更新（現在31件）
14. 検索インデックス（`searchIndex.json`）の再生成確認
15. サイトマップ・robots.txtの再生成確認
16. 画面幅の目視確認（375px, 390px, 430px, 768px, 1280px）
17. `git diff` 最終確認（`.claude/settings.local.json` 等のローカル専用ファイルを巻き込まない）
18. コミットメッセージへの反映（修正ファイル・検証結果を明記）
19. push後のCloudflare Pages自動デプロイ確認

---

## 成果物

- `reports/phase89-98-staging/phase98-prep-audit-findings.json`
- `reports/phase89-98-staging/phase98-prep-audit-report.md`（本ファイル）

`git commit` / `git push` は行っていません。
