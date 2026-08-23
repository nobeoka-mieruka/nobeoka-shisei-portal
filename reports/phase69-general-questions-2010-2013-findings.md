# Phase69 一般質問2010-2013年度 実投入 調査・実装結果

作成日：2026-08-23
担当：Phase69ワーカー（Phase67と同一条件で2010-2013年度を担当）

**本タスクで編集・作成したファイルは以下の2種類のみ**：本ファイル、
`reports/phase69-general-questions-2010-2013-findings.json`（新規作成）。
`src/data`・`scripts`配下は一切変更していない（読み取り専用として扱った）。
**git commit / git push は行っていない。ブラウザツールは使用していない。**

延岡市議会会議録検索システム（`https://www.kensakusystem.jp/nobeoka/`）への実アクセスは
**合計19回**（`scripts/lib/minutes-source.mjs`の実関数経由、`getFetchStats()`で実測）。
上限目安20-25回以内。429/403/5xxは0件。内訳は
`reports/phase69-general-questions-2010-2013-findings.json`の`networkAccessLog`に記録した。

---

## 0. 前提確認

- `reports/phase56-parser-findings.md`：`scripts/lib/minutes-source.mjs`が平成期（2000〜2018年、
  実データ確認範囲）に対応済みであることを確認。
- `reports/phase57-58-general-questions-implementation-findings.md`：councilSessions.jsonに
  2019-06より前の会期エントリが1件も存在しない構造的欠落（**UNR-026**）を確認。同Phaseが
  矢野戦一郎（fm49、2013-06-11）・後藤哲朗（fm14、2005-09-14）・甲斐正幸（m08、2014-03-04）の
  3件を`isPublished: false`の候補として`reports/phase57-58-general-questions-implementation-findings.json`
  に作成済み（**未マージ**）であることを確認し、本Phaseではこれらと重複しない会期・日付を選定した。
- `src/data/councilSessions.json`（現在42件、全て2019年以降）・`src/data/councilSpeechSummaries.json`
  （既存398件、`fm01`〜`fm10`・`m01`〜`m26`のみ登録、`fm14`・`fm49`は未登録＝Phase57-58候補が
  未マージであることを再確認）・`scripts/lib/minutes-source.mjs`のスキーマ・実装を確認した
  （いずれも読み取りのみ）。

---

## 1. UNR-026対応：councilSessions.json案（4件）

2010-2013年度で実際に発言者一覧・質問全文を取得できた4会期について、councilSessions.jsonの
実スキーマに準拠したドラフトを作成した（`findings.json`の`unr026_councilSessionsDraft.proposedEntries`）。

| id | 会期 | 本会議日程 | 確認した一般質問 |
|---|---|---|---|
| `2010-06` | 平成22年6月定例会（第20回定例会） | 6/9〜6/24（4日程） | 第2号（6/16）に佐藤誠ほか計5名が登壇（発言者一覧のみ確認） |
| `2011-03` | 平成23年3月定例会（第25回定例会） | 3/1〜3/25（6日程） | 第2号（3/8）に矢野仁祺（会派代表質問） |
| `2012-09` | 平成24年9月定例会（第8回定例会） | 9/4〜9/24（5日程） | 第2号（9/11）に西原茂樹 |
| `2013-09` | 平成25年9月定例会（第16回定例会） | 9/3〜9/24（6日程） | 第2号（9/10）に甲斐正幸ほか計5名が登壇（甲斐分のみ構造化） |

いずれも`documents: []`（議案PDF等は未調査）、`summaryStatus: "pending"`（一般質問の存在確認のみに
基づく暫定エントリ、議案審議・採決結果は未調査）としている。マージ担当者は、必要に応じて議案書等の
一次資料調査を行った上でsummaryStatus等を見直すこと。

`2013-09`はPhase57-58が扱った`2013-06`（平成25年第14回定例会、矢野戦一郎=fm49）とは別会期であり、
IDが重複しないことを確認済み。

---

## 2. 分類結果

### 2.1 A_ready_for_merge（3件）

| 候補 | memberId | 会期・日付 | speechType | 構造化した質問項目数 | member confidence |
|---|---|---|---|---|---|
| 矢野仁祺 | `fm54`（新規member行として提案） | 2011-03（平成23年3月定例会、第2号3/8） | 代表質問 | 12/約24項目 | exact（同姓同名なし、formerMembers.jsonの2007年当選記録と在職期間が整合） |
| 西原茂樹 | `fm18`（新規member行として提案） | 2012-09（平成24年9月定例会、第2号9/11） | 一般質問 | 4/約10項目 | exact（同姓同名なし、formerMembers.jsonの1999〜2015年5期連続当選記録と在職期間が整合） |
| 甲斐正幸 | `m08`（既存レコードへの追加分） | 2013-09（平成25年9月定例会、第2号9/10） | 一般質問 | 2/約10項目 | exact（現職、councilSpeechSummaries.jsonに既に14件登録済みで在職裏付けあり。Phase57-58の2014-03-04分とは別会期で重複なし） |

3件とも`isPublished: false`とした（councilSessions.jsonに該当sessionIdが存在しないため、UNR-026が
解消されるまでマージできない＝Phase57-58と同じ制約）。

各候補は、壇上質問全文（約10〜24項目に及ぶ大部な質問）のうち、市長・企画部長・副市長等の**初回答弁で
直接対応関係を確認できた項目のみ**を構造化し、対応が確認できない項目は無理に埋めていない
（詳細な理由は`findings.json`の各`speech.verificationNote`を参照）。

### 2.2 B_member_mapping_pending（1件）

**佐藤誠（2010-06-16、H220616A、pos=4290）**：発言者ラベル「佐藤誠君」は`formerMembers.json`の
`fm02`（佐藤 誠）と氏名完全一致し、同姓同名の他候補もいない。しかし`fm02`のnoteには「当選回数は
2019年の1回のみ確認、それ以前の当選歴は資料未確認」と明記されており、`electionResults.json`にも
2019年4月21日執行分の当選記録しかない。2010年時点の在職を示す独立した証拠（2007年以前の当選記録・
servedSessionsへの記載等）が存在しないため、約9年の空白をまたぐ同一人物との断定を避け、
**A_ready_for_mergeとせずB_member_mapping_pendingとした**（架空memberIdの使用・在職期間の推測拡張を
避けるため）。本文取得（fetchSegmentText）はアクセス回数節約のため今回見送り、member mapping確定後の
別タスクとした。followUpNeededを`findings.json`に記載した。

### 2.3 C/D/E/F（各0件）

- C_source_verification_pending：0件
- D_parser_error：0件（後述のparserIssuesは今回の候補選定・構造化には支障がなかったため、
  候補自体をD分類にはしていない）
- E_duplicate：0件（Phase57-58候補・既存398件のいずれとも重複なし。特に甲斐正幸は
  Phase57-58の2013-06-11とは意図的に異なる会期＝2013-09-10を選定して重複を回避した）
- F_unavailable：0件

---

## 3. 「質問予定」と「実施確認済み」の分離について

本Phaseで参照したデータソース（See.exe／r_Speakers.exe／GetText3.exe）は、いずれも**本会議で
実際に記録された発言データ**であり、事前の質問通告のみを示す情報は提供しない。採用した4候補
（A×3、B×1）は、いずれも`r_Speakers.exe`の発言者一覧で実際の登壇順・発言者ラベルを確認し、
`GetText3.exe`で発言原文（少なくとも壇上質問部分）を取得した上で構造化した——**すなわち「実施確認済み」
のみを対象とした**。したがって「予定のみ」を理由に除外した候補は**0件**である（そもそも通告書段階の
情報に触れていない）。「延岡市議会だより」等による質問予定と実施の突合はアクセス回数の制約により
今回実施していない（今後の二次検証の余地として記録）。

---

## 4. parser issue（報告のみ、修正なし）

指示に従い、`scripts/lib/minutes-source.mjs`は一切編集していない。以下2件を実データで確認した
（詳細は`findings.json`の`parserIssues`）。

1. **`parseSessionLabel`の正規表現が1桁回次（全角スペース入り）にマッチしない**：
   `/第(\d+)回(定例会|臨時会)/`は「第 1回臨時会」「第 5回定例会」のようなラベル（統一地方選挙直後で
   回次が1桁に戻った年に出現）にマッチせず、`listSessionsForYear()`の`sessionNumber`/`sessionType`が
   `undefined`になる。平成23年後半4件・平成24年前半5件で実データ確認。`label`フィールド自体は全文を
   保持しているため実害は限定的だが、`sessionNumber`/`sessionType`に依存する呼び出し側は注意が必要。
2. **`classifySpeakerLabel`の`officialTitles`に「教育委員長」が含まれない**：
   「教育委員長（○○君）」ラベルが`speakerType: "member"`（一般議員扱い）に分類される。
   平成24年9月・平成25年9月の会議録で実例確認（今回は教育委員長の発言を構造化対象にしなかったため
   実害なし）。

---

## 5. 終了時報告

- **新規追加候補件数（分類別）**：
  - A_ready_for_merge：**3件**（矢野仁祺=fm54新規、西原茂樹=fm18新規、甲斐正幸=m08追加分）
  - B_member_mapping_pending：**1件**（佐藤誠、fm02への氏名一致だが在職継続の独立証拠不足）
  - C_source_verification_pending：0件 / D_parser_error：0件 / E_duplicate：0件 / F_unavailable：0件
- **duplicate除外件数**：**0件**（既存398件・Phase57-58未マージ候補3件のいずれとも重複なし。
  甲斐正幸は意図的にPhase57-58と異なる会期を選定して重複を回避）
- **「予定のみ」除外件数**：**0件**（本Phaseで扱ったデータソースは全て実施確認済みの本会議記録であり、
  通告のみの情報を扱っていないため、除外対象自体が発生しなかった）
- **parser issue件数**：**2件**（`parseSessionLabel`の1桁回次未対応、`classifySpeakerLabel`の
  「教育委員長」未対応。いずれも報告のみで修正はしていない）
- **UNR-026対応（councilSessions.json案）**：**4件**（`2010-06`・`2011-03`・`2012-09`・`2013-09`、
  いずれも`documents: []`・`summaryStatus: "pending"`のドラフト。マージには別タスクでの正式追加が必須）
- **実アクセス回数**：19回（上限目安20-25回以内、429/403/5xx=0件）
- **warnings**：7件（`findings.json`の`warnings`配列を参照。主な内容：UNR-026未解消のためA案件は全て
  `isPublished: false`／壇上質問の一部項目のみ構造化／fm54・fm18の`servedSessions`未設定／fm02の
  在職継続証拠不足／政治的立場に触れる質問内容は事実要約のみに留めた／議会だよりとの突合未実施／
  同日に登壇した他議員（計8名）は今回未着手で次フェーズの候補として活用可能）

## 6. マージ作業者向けチェックリスト（本ワーカーは実施していない）

1. `src/data/councilSessions.json`へ、`findings.json`の`unr026_councilSessionsDraft.proposedEntries`
   （4件：`2010-06`・`2011-03`・`2012-09`・`2013-09`）を実スキーマに準拠して追加する
   （必要に応じて議案書等の一次資料を追加調査した上で`documents`・`summaryStatus`等を精緻化する）。
2. `src/data/formerMembers.json`の`fm54`（矢野仁祺）・`fm18`（西原茂樹）の`servedSessions`へ、
   それぞれ`2011-03`・`2012-09`を追加する（在職確認済みのため妥当）。
3. `findings.json`の`classification.A_ready_for_merge`の3件を`councilSpeechSummaries.json`へ
   追加する（fm54・fm18は新規member行、m08は既存レコードの`speeches`配列への追加）。
4. `findings.json`の`classification.B_member_mapping_pending`（佐藤誠）について、`followUpNeeded`に
   従い`electionResults.json`等で2007年以前の当選記録を追加調査する。確認できれば`fm02`の
   `servedSessions`更新とあわせて質問全文を取得・構造化する。
5. 上記1〜3完了後、`isPublished`を`true`に切り替えるかはデータ管理者の判断とする
   （切り替える場合は`npm run validate:data`でエラー0件を確認すること）。
6. `npm run validate:data` / `npm run typecheck` / `npm run lint` / `npm run build`を実行し、
   問題がないことを確認してからコミットする。
7. H220616A（2010-06-16）の大金賢二・大西幸二・上田美利・白石武仁、H250910A（2013-09-10）の
   太田龍・葛城隆信・下田英樹・白石良盛（計8議員分）は、同じ本会議日に登壇済みであることが
   発言者一覧で確認済みのため、次フェーズでの追加候補として活用できる。
