# Phase33 STEP5 チェックポイント（UI・warnings分類・sourceRefs・最終品質検証）

作成日：2026-08-22

## 1. warnings 15件の分類

`npm run validate:data`の警告は2種類・15行で構成される（うち2行は複数年度・複数任期をまとめた集約警告）。

| # | 内容 | 分類 | 理由 |
|---|---|---|---|
| 1 | archiveMayorTerms.json：任期空白13件（1937〜1994年、主に戦前・戦中・辞職前後の短期間） | **A**（データ欠落による正常な警告） | 各空白は既存sourceRefs・notesで理由が記録済み（辞職・任期満了と後任就任のタイムラグ等）。**B（未解決案件）としてもmaster ledgerのUNR-005〜011の一部と関連** |
| 2 | archiveFiscalYears.json：欠番24年度（1934-1948、1951-1953、1959、1983-1987） | **A／B** | FY1951-53・59・83-87の9年度はmaster ledger UNR-015（reference_pending、現地閲覧・外部照会待ち）。FY1934-1948の15年度はUNR-014（Phase32新規発見、無追跡状態から今回追跡対象へ格上げ） |
| 3〜15 | councilSpeechSummaries.json：questionApproachが推奨語彙にない（13件、m01・m09・m17・m21・m22・fm01の発言データ） | **F**（その他：語彙の確認推奨であり、データ誤りではない） | validate-data.mjs自身が「誤りではないが確認推奨」と明記。人手による表現の見直しは可能だが、データの正確性には影響しない軽微な指摘であり、**警告を消すこと自体を目的とせず、必要な警告として残す**（ユーザーの既存方針） |

**分類結果：A=2件相当（内容としては），B=2件（Aと重複計上、master ledgerとの対応関係を明示する目的）、C=0、D=0、E=0、F=13件。** 新規schema改善・UI改善・実データ不整合に該当する警告は無かった。**warningsを人為的に0件へ削減することは今回の目的ではなく、15件はすべて正当な理由を持つ既知の警告として維持する。**

## 2. sourceRefs補強

Phase32で確認済みの通り、`dataQualitySummary.json`のsourceHealth（warnings=15、出典タイトル欠落等の改善余地）は既存の自動監査（`validate:sources`）で継続的に把握されている。今回のPhase33で新たに登録したcitySpecialPosts.jsonのcsp-50〜54（Phase29-31時点で新規登録済み）は、いずれもsourceRefs（資料名・URL）を伴って登録済みであり、sourceRefsなしのレコードを新たに追加していない。

## 3. UIの未解決表示の再確認

Phase31（UI総点検）・Phase32（Priority B/C監査）で、`src/lib/completeness.ts`のCompletenessStatus語彙（confirmed_zero／not_collected／under_review／unavailable等）がDataStatusPage.tsx等で一貫して使われていることを確認済み。Phase33 STEP5で改めてDataStatusPage.tsxの該当箇所を確認したが、**「0件」と「未収録／確認中」を混同する表示は今回も発見しなかった**。新しいstatusの追加は行っていない（既存語彙で対応可能なため）。

## 4. 最終品質検証

以下を実行した（結果は最終報告セクションを参照）。

- validate:data
- typecheck（tsc -b）
- lint（oxlint）
- build（vite build + prerender）
- validate:seo
- validate:content

重点監査：mayorId／mayorTermId／memberId の重複・矛盾は今回の全STEPを通じて新規発見なし。人物任期の重複も新規発見なし（空白は上記の通りA/B分類で整理済み）。fiscalYear・election dateの重複も発見なし。confirmed_zero／not_collected誤表示も発見なし。

## このSTEP5で新たにsrc/dataへ反映した内容

**なし。** Phase33全体を通じて、src/dataへの新規変更は行っていない（監査・分類・台帳整備が中心）。
