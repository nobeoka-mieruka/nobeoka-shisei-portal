# 最終品質監査レポート（2026-08-17、TASK-094以降）

## 監査方針

TASK-080〜092で完了済みの監査・修正はやり直さず、`docs/session-handoff.md`・`TASKS.md`・
既存`reports/`・既存sourceInventoryを基準に、未解決部分だけを対象とした（ユーザー指示）。
NDL・Wayback・未公開資料を必要としない範囲に限定して実施した。

## サマリー

| 項目 | 件数 |
|---|---|
| 新規発見の問題 | 3件 |
| 修正済み | 3件 |
| BLOCKED | 0件 |
| 出典必要（対応不可） | 0件 |
| 手動確認が必要 | 0件 |
| 内部リンク切れ | 0件 |
| 外部リンク切れ（既知・新規0） | 12件 |
| 出典なしレコード | 0件 |
| 孤立レコード | 0件 |
| 重複候補 | 0件 |

## 発見・修正した問題（3件）

### 1. 内部ジャーゴンの公開UI漏れ（medium）

前回セッション（TASK-085）で`archiveMayors.json`の5レコード（mayor-05・06・09・10・13）に
追記した内部の作業記録文「TASK-085：既存sourceRefs（Wikipedia、needsReview）のnotesに...」
が、そのまま`/mayors/:slug`の公開ページに表示されていた。**修正**：内部記録文を削除し、
事実部分のみ残した。

### 2. 内部ID参照の可読性（low）

同じく前回セッションで`civicTimelineEvents.json`の3レコード（civic-002・005・019）に
追加したnotesが、既存の慣例（内部ID＋人名の併記）と異なり内部ID単体（例：`mayor-04`）を
裸で参照していた。`/history`の公開ページに表示される。**修正**：既存慣例に合わせ人名を併記。

### 3. 監査ツール自体の誤検知（low）

Priority 8-10向けに新規作成した`scripts/generate-final-quality-audit.mjs`の初版が、
`sourceRefs`配列以外の出典スキーマ（billVotes.json・members.json・
politicalFundOrganizations.json・formerMembers.json・archiveFiscalYearsのサブオブジェクト等）
を認識できず、1,308件を誤って「出典なし」と誤検知した。**修正**：判定ロジックを拡張し、
実データの変更なしで誤検知を解消（再実行後0件）。

## カテゴリ別監査結果（新規問題0件を含む）

| カテゴリ | 結果 |
|---|---|
| 過去議員（formerMembers/memberProfiles） | 0件（重複・orphan・current/former混同いずれも無し） |
| 一般質問の孤立データ | 0件（397件/1,470件の集計ロジックが正しいことを再確認） |
| 議案・条例 | 0件（session+billNumber重複0件） |
| 委員会 | 0件（memberId orphan0、全委員会で委員長・副委員長確認済み） |
| 選挙データ | 既存の少数未確認値（投票率1件・有権者数2件）はUIで「確認中」表示済み、新規調査は対象外 |
| 市政年表 | 0件（year/sourceRefs欠落0、重複0） |
| 出典品質（A〜E） | A=276 B=0 C=0 D=126 E=12（E=既知のリンク切れ、新規0） |
| サイト内検索 | 主要カテゴリすべて索引化済み。市政年表のtype表記が汎用的（2026-08-14時点の既知の低優先度課題、今回新規ではない） |
| 内部リンク | 0件（build時の`validate-content.mjs`で継続確認） |
| モバイル・アクセシビリティ | 今回変更したページは既存パターンを踏襲、新規問題0件 |

## 更新履歴（/updates）への反映

今回までの改善のうち市民に意味のある変更2件を追加した（開発者向けの細かい内部変更は
掲載していない）：

- 財政データの人口収録を全26年度で完了
- データ収録状況ページに出典・リンクの点検結果を追加、表示用語の統一

## 検証結果

`validate:data`（errors=0, warnings=14=既存同数）・`validate:freshness`（0/0）・
`typecheck`・`lint`・`test`（26/26）・`build`（2128/2128ルート、validate-seo 0/0、
validate-content 0/0）すべて成功。新規error・warning0件。
