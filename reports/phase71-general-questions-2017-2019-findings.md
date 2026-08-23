# Phase71 一般質問2017-2019年（2019年は1-5月のみ）実投入 調査結果

作成日：2026-08-23
担当：Phase71ワーカー

**本タスクで編集・作成したファイルは以下の2種類のみ**：本ファイル、
`reports/phase71-general-questions-2017-2019-findings.json`（新規作成）。
`src/data`・`scripts`配下は一切変更していない（`scripts/lib/minutes-source.mjs`含め読み取り専用として扱った）。
**git commit / git push は行っていない。ブラウザツールは使用していない。**

延岡市議会会議録検索システムへの実アクセスは**合計19回**（詳細は`findings.json`の
`networkAccessSummary`参照）。上限目安20-25回以内、429/403/5xxは0件。

---

## 0. 対象範囲と重複チェックの前提

- 対象：平成29年（2017年）・平成30年（2018年）・2019年1〜5月相当（平成31年1〜4月＋令和元年5月分だが、
  令和元年5月分＝令和元年6月定例会より前の期間には該当会期自体が存在しないため、実質的には
  「平成31年」個別タブ＝2019年2〜3月開催の第22回定例会のみが対象）。
- 既存`src/data/councilSpeechSummaries.json`の全398件`speeches`の`date`を機械的に抽出し、
  2017-01-01〜2019-05-31の範囲でフィルタした結果、**該当0件**。
  `src/data/councilSessions.json`の42件のidもすべて`2019-06`以降（最古が`2019-06`）であることを
  確認済み。したがって、本Phaseで新規発見した候補について、
  **memberId・sessionId・date（既存データとの直接重複）の観点でのduplicate除外は0件**。

---

## 1. 2019年1-5月分（平成31年）へのアクセス方法

Phase56の`resolveYearTreedepth(2019)`は令和元年のみを指すため、2019年1〜5月分（平成31年個別タブ）
へは到達できない（Phase56報告のwarningsで既知）。本Phaseでは`scripts/lib/minutes-source.mjs`を
一切改変せず、以下の手順を**別スクリプト（スクラッチパッド内、リポジトリ外）で手動navigation**して
到達した。

1. root See.exeの年タブ一覧を取得し、`"平成30年～令和元年"`境界グループタブ（treedepth値は
   `令和元年`）を特定。
2. そのtreedepthでPOSTし、内部タブとして`令和元年`・`平成31年`・`平成30年`の3個別年タブが
   現れることを確認（Phase56の発見どおり）。
3. `平成31年`タブのtreedepthでPOSTし、会期一覧を取得。**平成31年第22回定例会（2019年2月26日〜
   3月20日、7日程）の1会期のみ**が存在することを確認した。

この会期は、2015年4月26日執行の延岡市議会議員選挙で選出された任期（旧任期）における
**最後の定例会**であり、2019年4月21日執行の市議会議員選挙後の令和元年6月定例会（第2回、
既存データの最古会期）の直前にあたる。既存データとの隣接リスクが最も高い会期として、
本Phaseで最重点的に確認した。

---

## 2. 選定した会期と確認結果

| 会期 | 提案sessionId | 確認日程 | 一般質問・代表質問者（確認済み） |
|---|---|---|---|
| 平成29年第12回定例会 | `2017-06` | 第2号（6月13日） | 河野治満・白石良盛・甲斐行雄・上杉泰洋・佐藤誠（5名） |
| 平成30年第20回定例会 | `2018-12` | 第2号（12月4日） | 早瀬賢一・三上毅・梶本英一・佐藤誠・北林幹雄（5名） |
| 平成31年第22回定例会 | `2019-03` | 第2号（3月5日） | 白石良盛・北林幹雄・上杉泰洋・太田龍（代表質問）・長友幸子（5名） |

各会期とも第2号（一般質問が行われる典型日）のみを確認した。第3号以降（特に2019年3月は
7日程）に追加の一般質問がある可能性は未確認（次Phaseへの申し送り事項）。

---

## 3. 発言者照合（在籍期間・選挙結果による二次確認）

`src/data/electionResults.json`の`election-council-2015`（2015-04-26執行）を用い、
上記11名全員について、会議録上の氏名（漢字）と選挙結果の候補者名（ひらがな表記が多い）を
`linkedProfileId`経由で突き合わせ、**当選事実と現職／元議員IDの対応を二次確認した**。

| 会議録上の氏名 | memberId | 選挙公報名 | 当選 | 備考 |
|---|---|---|---|---|
| 河野治満 | m10 | 河野 はるみつ | ○ | |
| 白石良盛 | fm05 | 白石 よしもり | ○ | |
| 甲斐行雄 | m06 | 甲斐 いくお | ○ | 現職継続（termCount:3） |
| 上杉泰洋 | m03 | 上杉 やすひろ | ○ | |
| 佐藤誠 | fm02 | さとう 誠 | ○ | |
| 早瀬賢一 | m18 | はやせ けんいち | ○ | 会議録表記は異体字「早瀨」 |
| 三上毅 | fm04 | 三上 たけし | ○ | |
| 梶本英一 | m09 | かじもと 英一 | ○ | |
| 北林幹雄 | m11 | 北林 みきお | ○ | |
| 太田龍 | fm40 | 太田 龍 | ○ | 2019年選挙の当選記録なし＝旧任期最後の定例会 |
| 長友幸子 | m17 | 長友 さちこ | ○ | 現職継続（termCount:4） |

11名全員が2015年選挙で当選しており、同姓同名リスクや現職／元議員の混同リスクはない。
特に**太田龍（fm40）**は、formerMembers.json既存noteに「2019年4月選挙の当選記録がなく、
在職中の一般質問記録は会議録収録範囲（令和元年6月以降）に含まれないため未収録（0件ではなく
未収録）」と明記されていた既知ギャップに、本Phaseで発見した2019年3月5日の代表質問が
ちょうど整合する。

---

## 4. 完全構造化できた候補（4件、classification: A_ready_for_merge）

いずれも壇上質問全文・答弁本文を取得し、質問項目・答弁・出典を構造化した。
**共通のブロッカー**：`src/data/councilSessions.json`に`2017-06`・`2018-12`・`2019-03`の
会期エントリが存在しないため（Phase57-58と同一の構造的ブロッカー）、`isPublished: false`とした。

| memberId | 氏名 | 日付 | speechType | 質問項目数 | confidence |
|---|---|---|---|---|---|
| m06 | 甲斐行雄 | 2017-06-13 | 一般質問 | 2/2（壇上全項目） | exact |
| m18 | 早瀬賢一 | 2018-12-04 | 一般質問 | 2/2（壇上全項目） | high（異体字） |
| fm40 | 太田龍 | 2019-03-05 | 代表質問 | 15/約20（市長答弁分のみ、副市長以下は未取得） | exact |
| m17 | 長友幸子 | 2019-03-05 | 一般質問 | 1/1（同日終盤の短時間質問） | exact |

詳細（questionItems・summarySources・verificationNote）は`findings.json`の
`flagshipCandidates_fullyStructured`を参照。

---

## 5. 識別済みだが未構造化の候補（11件、classification: C_source_verification_pending）

`listSpeakerSegments`で質問者として発言者ラベルを確認し、members.json/formerMembers.json照合
および2015年選挙での当選事実の二次確認まで完了しているが、アクセス予算の制約により
壇上質問・答弁本文（`fetchSegmentText`）は未取得のため、questionItemsは**一切作成していない**
（架空データの掲載を避けるため）。

対象：河野治満(m10)・白石良盛(fm05×2会期)・上杉泰洋(m03×2会期)・佐藤誠(fm02×2会期)・
三上毅(fm04)・梶本英一(m09)・北林幹雄(m11×2会期)。詳細は`findings.json`の
`additionalIdentifiedQuestioners_notYetStructured`を参照。

副次的な発見として、`formerMembers.json`の**fm05・fm02・fm04のservedSessionsが
現状2019-06以降のみ**であり、本Phaseの発見（2017年・2018年の会議録に本人発言を確認）により
`servedSessions`をより早い会期まで拡張できる根拠資料が揃ったことも申し送り事項とする
（本ワーカーはformerMembers.jsonを編集していない）。

---

## 6. councilSessions.json案

`findings.json`の`councilSessionsProposals`に、`2017-06`・`2018-12`・`2019-03`の3件を
既存レコードの命名規則（`fiscalYear`は3月定例会のみ前年扱い等）に準拠して作成した。
**`documents`（議案等審議結果PDF等の一次資料リンク）は本ワーカーの読み取り専用制約・
アクセス予算内では取得できなかったため空配列とし、別タスクでの補完が必須**
（Phase57-58で報告された構造的ブロッカーと同一）。

---

## 7. parser issue（D）・duplicate（E）・unavailable（F）

- **D_parser_error**：0件。`scripts/lib/minutes-source.mjs`は一切改変せず、Phase56の平成対応を
  そのまま利用した。令和元年/平成31年の境界タブ探索はモジュール外の手動navigationで対応したが、
  これはモジュールの不具合ではなく、Phase56報告書に明記された既知の未対応範囲（令和元年専用
  ロジックが平成31年へ到達しない）への対処であり、モジュール自体に不具合は発見していない。
- **E_duplicate**：0件（0節参照）。
- **F_unavailable**：0件（今回アクセスしたページはすべて取得成功。429/403/5xx=0件）。

---

## 8. 終了時報告

- **新規追加候補件数（分類別）**：
  - A_ready_for_merge：**4件**（m06・m18・fm40・m17。うち太田龍fm40は既存councilSpeechSummaries.jsonに
    レコード自体が存在しない新規追加、他3件は既存現職memberIdへのterm:"previous"追加）
  - C_source_verification_pending：**11件**（発言者識別・memberId確定・選挙結果二次確認済みだが
    本文未取得）
  - B_member_mapping_pending：0件（全15件のmemberId確定に成功）
  - D_parser_error：0件
  - E_duplicate：0件
  - F_unavailable：0件
- **duplicate除外件数（既存398件との照合結果）**：0件（既存398件の`date`フィールドを機械的に
  全件走査し、2017-01-01〜2019-05-31の範囲に該当データが皆無であることを確認済み。
  `councilSessions.json`の42件idもすべて`2019-06`以降で重複なし）。
- **parser issue件数**：0件
- **実アクセス回数**：19回（上限目安20-25回以内、429/403/5xx=0件）
- **warnings**：
  1. **（最重要、Phase57-58と同一）** `src/data/councilSessions.json`に`2017-06`・`2018-12`・
     `2019-03`の会期エントリが存在しないため、A_ready_for_merge 4件はすべて`isPublished: false`
     とした。マージには`councilSessionsProposals`の3件（documents未確定）を先に整備する
     別タスクが必須。
  2. `fm40`（太田龍）の`formerMembers.json`エントリは`servedSessions: []`（空）のまま。
     本Phaseの発見により`'2019-03'`を追加できる根拠が揃ったが、本ワーカーはformerMembers.jsonを
     編集していない。
  3. 太田龍の代表質問は壇上約20項目に対し、今回構造化できたのは市長答弁で直接確認できた
     15項目のみ（副市長・企画部長・総務部長・健康福祉部長・消防長・教育長の答弁は未取得）。
     無理に埋めていない。
  4. 早瀬賢一（m18）は会議録上の表記が異体字「早瀨」であり、`matchSpeakerToMember()`の
     機械マッチングは対応していない（Phase56/45-47から既知の未対応事項）。本Phaseでは
     選挙結果の当選記録で手動二次確認した上でhigh confidenceとした。
  5. 各会期とも第2号のみ確認済み。第3号以降（特に2019年3月は7日程）に追加の一般質問がある
     可能性は未確認。
  6. `fm05`・`fm02`・`fm04`のservedSessionsが本Phaseで発見した会期（2017年・2018年）より
     後ろの日付から始まっており、拡張の余地があることを申し送り事項とした。

---

## 9. マージ作業者向けチェックリスト（本ワーカーは実施していない）

`findings.json`の`mergeChecklist_forDataOwner`を参照。要約：
1. councilSessions.jsonへ3件の会期エントリを追加（documentsは別途調査要）。
2. councilSpeechSummaries.jsonへA_ready_for_merge 4件を追加（fm40は新規トップレベル
   memberオブジェクト、他3件は既存memberIdのspeeches配列へ追加）。
3. formerMembers.json fm40のservedSessionsへ'2019-03'を追加。
4. C_source_verification_pending 11件を次Phaseで本文取得・構造化。
5. 各会期の第3号以降の追加一般質問有無を次Phaseで確認。
6. 上記完了後、`npm run validate:data` / `typecheck` / `lint` / `build`をエラー0件で確認してから
   `isPublished`をtrueに切り替えるかを判断する。
