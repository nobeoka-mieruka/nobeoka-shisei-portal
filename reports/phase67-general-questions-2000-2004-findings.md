# Phase67 一般質問2000-2004年 実投入 調査・実装結果

作成日：2026-08-23
担当：Phase67ワーカー

**本タスクで編集・作成したファイルは以下の2種類のみ**：本ファイル、
`reports/phase67-general-questions-2000-2004-findings.json`（新規作成）。
`src/data`・`scripts`配下（`scripts/lib/minutes-source.mjs`含む）は一切変更していない
（読み取り専用として扱った）。
**git commit / git push は行っていない。ブラウザツールは使用していない。**

延岡市議会会議録検索システム（`https://www.kensakusystem.jp/nobeoka/`）への実アクセスは
**合計16回**（`scripts/lib/minutes-source.mjs`の実関数を、スクラッチパッド上の一時ハーネス
スクリプト（`explore.mjs`、リポジトリ外・スクラッチパッドのみに配置）経由で呼び出し、
`getFetchStats()`で実測。内訳は`phase67-general-questions-2000-2004-findings.json`の
`networkAccessLog`参照）。上限目安20-25回以内。429/403/5xxは0件、同一ページの再取得・retryは
発生していない（全16リクエストが1回で成功）。3回失敗して打ち切った（blocked）ページは0件。

---

## 0. 最重要タスク：UNR-026対応（councilSessions.json案の作成）

Phase57-58で発見された構造的な欠落（`src/data/councilSessions.json`に2019-06より前の
会期エントリが1件も存在せず、`scripts/validate-data.mjs`が`speech.sessionId`の存在チェックを
`isPublished`の真偽に関係なく無条件でエラー化するため、旧年代の一般質問候補が永久に
公開できない）は、今回も解消されていない（`src/data`配下は読み取り専用のため、本ワーカーは
実際のマージを行えない）。

今回は、この欠落を埋めるための**councilSessions.jsonマージ用レコード案そのものを作成した**
（Phase57-58は問題提起のみだったが、今回は実際に2会期分の会期を会議録検索システムで
確認し、councilSessions.jsonの実スキーマ（`scripts/validate-data.mjs`のL442-600の検証ロジックを
精査した上で）に準拠する形で提案した）。

| 提案id | 会期 | 本会議日程 | 出典確認方法 |
|---|---|---|---|
| `2000-09` | 平成12年9月定例会（第11回定例会） | 第1号9/5〜第5号9/25（5日程） | `listMeetingDays`で実データ確認 |
| `2004-06` | 平成16年6月定例会（第9回定例会） | 第1号6/7〜第6号6/23（6日程） | `listMeetingDays`で実データ確認 |

`documents`（議案審査結果PDF等の一次資料）は、当該会期のPDF資料の所在を今回探索していない
ため、いずれも空配列とした（無理に埋めていない。`storageType`を持つdocumentを1件でも入れると
`filePath`の実ファイル存在チェック等の追加検証が働くため、根拠のない資料を作るよりは
空配列の方が安全という判断）。`summary`・`shortSummary`等の生成フィールドも一切作らず、
`title`・`sessionType`・`sessionNumber`・`startDate`・`endDate`・`folderPath`・`description`
という事実ベースの最小限の項目のみで構成した（指示どおり）。

**この2案が`src/data/councilSessions.json`へ実際にマージされない限り、下記4件の一般質問候補は
`validate-data.mjs`でエラーになるため、依然として`isPublished: false`のまま**である。

---

## 1. 対象年度の選定

Phase56で動作確認済みの5年度（2000, 2005, 2013, 2014, 2018年）のうち、2000年度はPhase56で
`resolveYearTreedepth`・`listSessionsForYear`が実際に実行済み（キャッシュ済み、今回は
追加アクセス0回で再取得できた）。2005年度はPhase45-47・57-58で既に候補作成済みのため対象外。
本タスクの対象範囲（2000-2004年度）の中で、以下の年度をすべて`resolveYearTreedepth`・
`listSessionsForYear`で実データ確認した。

| 年度 | 元号 | 会期一覧の取得結果 | 深掘り |
|---|---|---|---|
| 2000 | 平成12年 | 6会期（第8回臨時会〜第13回定例会） | ○（第11回定例会・第2号を深掘り） |
| 2001 | 平成13年 | 6会期（第14回定例会〜第19回定例会） | 会期一覧のみ確認、本文取得なし |
| 2002 | 平成14年 | 6会期（第20回臨時会〜第25回定例会） | 会期一覧のみ確認、本文取得なし |
| 2003 | 平成15年 | 6会期（第26回臨時会〜平成15年 第4回定例会。第26回・第27回で改選前の番号が終わり、
  第1回から新任期の番号体系に切り替わっている） | 会期一覧のみ確認、本文取得なし |
| 2004 | 平成16年 | 7会期（第5回臨時会〜第11回定例会） | ○（第9回定例会・第2号を深掘り） |

2001〜2003年度は会期一覧の存在・parserの動作は確認済みだが、アクセス回数の予算配分上、
本会議日一覧・発言者一覧・本文の深掘りは行わなかった（水増しを避けるため、確実に本文まで
確認できた2000年度・2004年度の2会期に絞った）。

---

## 2. 一般質問候補（4件、すべてA_ready_for_merge）

いずれも「councilSessions.json案とセットでマージ可能」という条件付きでA_ready_for_mergeに
分類した（`isPublished`は現状falseのまま。詳細分類基準は`findings.json`の
`classificationNote`参照）。

### 2.1 平成12年9月定例会（2000-09-12、第2号）から2件

| 候補 | memberId | confidence | 二次確認 | 項目数 |
|---|---|---|---|---|
| 猪股秀明 | `fm12` | exact | 1999-04-25執行選挙で当選（1期目在職中） | 2/約15項目中 |
| 西原茂樹 | `fm18` | exact | 1999-04-25執行選挙で当選（1期目在職中） | 3/約15項目中 |

猪股秀明議員は（仮称）歴史民俗資料館の基本構想・高齢者施策を、西原茂樹議員は岡富山共有地
問題（市が刑事告訴を受け、警察の捜査を理由に答弁を差し控えた件。事実をそのまま中立的に
記録し、評価は付加していない）・太陽光発電の推進・ヘルストピア延岡の入館料改定について、
それぞれ市長の答弁を確認・構造化した。

### 2.2 平成16年6月定例会（2004-06-14、第2号）から2件

| 候補 | memberId | confidence | 二次確認 | 項目数 |
|---|---|---|---|---|
| 後藤哲朗 | `fm14` | exact | phase57-58で既にexact確認済み、再確認 | 3/約14項目中 |
| 太田龍 | `fm40` | exact | 2003-04-27執行選挙で当選（1期目在職中）、本人が壇上で党派を名乗り一致 | 4/約20項目中 |

後藤哲朗議員は**phase57-58で既に2005-09-14分の候補が存在する人物**であり、本候補
（2004-06-14分）は同一人物の**別会期の発言**である。マージ時は新規メンバーオブジェクトを
2つ作らず、既存提案（phase57-58）のspeeches配列へ本speechを追加した単一のfm14オブジェクトに
統合すること（`findings.json`の`proposedMemberRecordWrapperMerged`参照）。

太田龍議員の質問には核実験・イラク戦争・国民年金未納問題等、国政に関する議員個人の見解が
含まれるが、編集方針（特定政党・政治団体・議員への支持推薦批判をしない）に沿い、会議録に
記録された質問・答弁内容をそのまま中立的に要約し、評価・意見は付加していない。

### 2.3 全候補共通の限定事項

4件とも、壇上通告は10〜20項目超に及ぶが、**市長の答弁セグメントで直接対応が確認できた
2〜4項目のみ**を構造化した（部長級・教育長級の答弁は今回未取得）。無理に全項目を埋めず、
確実に構造化できた範囲にとどめている。

---

## 3. 氏名照合まで完了・本文未取得（6件、identifiedButNotProcessed）

同じ本会議日の発言者一覧で氏名照合（`matchSpeakerToMember`＋選挙結果による二次確認）まで
完了したが、アクセス回数の予算配分上、質問全文・答弁全文を取得しなかった人物を記録した
（`findings.json`の`identifiedButNotProcessed`参照。将来のワーカーが追加調査する際の起点）。

| fileName | 発言者 | memberId | 備考 |
|---|---|---|---|
| H120912A | 平田信広君 | `m20`（現職） | 市議6期24年（2023年時点自己申告）と整合 |
| H120912A | 宮原則秋君 | `fm28` | 1999年当選 |
| H120912A | 佐藤正人君 | `fm11` | 1999年当選。議長「佐藤道男」（fm26）とは別人 |
| H160614A | 西原茂樹君 | `fm18` | 2.1節と同一人物の別会期分（3ラウンド） |
| H160614A | 平田信広君 | `m20` | 上記と同一人物、2004年も在職継続 |
| H160614A | 山田良市君 | `fm24` | 1999年当選、2003年再選（2期目在職中） |

---

## 4. memberId照合の方法（二次確認の実施内容）

指示（「名前一致だけで確定しない、選挙結果・在籍期間で二次確認」）に従い、全10名
（候補4件＋identifiedButNotProcessed 6件）について以下の手順を実施した。

1. `classifySpeakerLabel()`で発言者ラベルを分類し、議員（`speakerType: "member"`）と
   役職者（`speakerType: "official"/"mayor"/"chair"`）を区別。
2. `matchSpeakerToMember()`で`members.json`・`formerMembers.json`の両方に対して氏名完全一致
   照合（敬称・空白除去後の完全一致のみ、部分一致では確定しない）。
3. 一致候補が1件のみであることを確認（同姓の別人が存在する場合はfamily name単位で
   `formerMembers.json`・`members.json`全体を横断検索し、下の名前の相違を個別確認。
   例：「佐藤」姓は`formerMembers.json`に6名存在するが、下の名前ですべて判別できた）。
4. `formerMembers.json`の`note`に記載された選挙結果（`go2senkyo.com`由来、当選年・党派・
   得票数）を参照し、質問が行われた年月時点でその人物が在職中の任期に含まれているかを
   確認（例：`fm40`太田龍は2003-04-27執行選挙で初当選、質問日2004-06-14はその1期目在職中）。
   現職議員（`m20`平田信広）については`members.json`の`career`フィールドに記載された
   本人の選挙公報の自己申告（「市議6期24年」＝2023年時点）から初当選年を逆算し整合を確認した。
5. 上記1〜4がすべて一致した場合のみ`confidence: "exact"`とした。今回の10名はすべて
   exact一致（`high`や`speaker-identification-pending`に該当する事例はなかった）。

`servedSessions`（`formerMembers.json`）はいずれも空配列（令和元年6月以降の会議録収録範囲を
基準に構築されたフィールドのため、2000年代の在職は反映されていない）。これは
`scripts/validate-data.mjs`のロジック上、warning（要在職確認）にとどまりerrorにはならない
ことをコードで確認済み（`served.size === 0`の場合はwarn、served内に無い場合のみerr）。

---

## 5. 重複確認

`src/data/councilSpeechSummaries.json`（398件）・`src/data/generalQuestions.json`（15件）の
全date値と、本タスクの新規候補4件のdate（`2000-09-12`×2、`2004-06-14`×2）を機械突合し、
一致するレコードが存在しないことを確認した（`node -e`による確認、詳細は
`findings.json`の`summary.duplicateCheckMethod`参照）。

**除外件数：0件（E_duplicateに分類した候補なし）。**

---

## 6. parser不具合の発見（2件、修正はしていない）

`scripts/lib/minutes-source.mjs`は指示により読み取り専用で扱った。実データ検証中に
以下2件の不具合を発見したため、修正せず具体的に記録する（親エージェントの対応事項）。

### 6.1 `parseSessionLabel()`：会期番号の半角スペース非対応

正規表現`/第(\d+)回(定例会|臨時会)/`が「第」と数字の間の半角スペースに対応していない。
会議録検索システムは単一桁の会期番号（1〜9）を2桁幅に揃えるため半角スペースで
パディングしている（例：`"第 8回臨時会"`、`"第 9回定例会"`）。実データで確認した該当例：

- 平成12年（2000年）：`第 8回臨時会`・`第 9回定例会`
- 平成15年（2003年）：`第 1回臨時会`・`第 2回定例会`・`第 3回定例会`・`第 4回定例会`
- 平成16年（2004年）：`第 5回臨時会`・`第 6回定例会`・`第 7回臨時会`・`第 8回臨時会`・
  `第 9回定例会`

`listSessionsForYear()`の戻り値でこれらの`sessionNumber`・`sessionType`が両方`undefined`に
なることを実行結果で確認した。treedepth・labelは正しく取得できるため本文取得自体への実害は
ないが、`councilSessions.json`案を自動生成する仕組みを将来作る場合はこの不具合を先に
直す必要がある（本ファイルの`councilSessionsProposal`の`sessionNumber: "第9回"`は、この不具合を
人手で回避してスペースを除去した値）。

**提案修正（未実装）**：正規表現を`/第\s*(\d+)回(定例会|臨時会)/`に変更する。

### 6.2 `classifySpeakerLabel()`：2000年代特有の役職名の非対応

`officialTitles`配列・正規表現`/部長|課長|局長|次長|事務局長/`が以下の役職名に対応していない
（いずれも`speakerType: "member"`に誤分類される）。

- `農業委員会会長`（例：H120912A order10「農業委員会会長（高本清君）」）
- `建設部参事`（例：同order73「建設部参事（児玉太君）」、"部長"ではなく"参事"のため
  正規表現に一致しない）
- `教育委員長`（教育長とは別の役職。例：H160614A order41「教育委員長（岩佐郁子君）」）

本ワーカーは全候補についてmatchSpeakerToMember()の結果を選挙結果で個別に二次確認したため、
実際の候補データへの影響はなかった。ただし、`classifySpeakerLabel()`の結果だけで
「member=一般質問の登壇者」と機械的に判定する将来の自動化処理では、これらの役職者が
誤って一般質問の登壇候補として拾われる恐れがある。

**提案修正（未実装）**：`officialTitles`に「農業委員会会長」「教育委員長」を追加し、
正規表現に「参事」を追加する。

---

## 7. 終了時報告

- **councilSessions.json案**：2件（`2000-09`＝平成12年9月定例会・第11回定例会、
  `2004-06`＝平成16年6月定例会・第9回定例会）。いずれも本会議日程を実データで確認済み、
  `documents`は空配列（一次資料未探索のため無理に埋めていない）。
- **新規追加候補件数（分類別内訳）**：
  - `A_ready_for_merge`：**4件**（猪股秀明fm12・西原茂樹fm18＝2000-09-12、
    後藤哲朗fm14・太田龍fm40＝2004-06-14）
  - `B_member_mapping_pending`：0件
  - `C_source_verification_pending`：0件
  - `D_parser_error`（候補としての分類、上記6節のparser不具合とは別枠）：0件
  - `E_duplicate`：0件
  - `F_unavailable`：0件
- **新規質問項目（questionItems）件数**：12件（猪股2＋西原3＋後藤3＋太田4）
- **duplicate除外件数**：0件（5節参照）
- **member mapping resolved件数**：10件（候補4件＋identifiedButNotProcessed 6件、すべてexact）
- **member mapping pending件数**：0件
- **parser regression件数**：0件（`scripts/lib/minutes-source.mjs`は一切編集していない）
- **parser issue（新規発見・未修正）件数**：2件（6節参照、D_parser_error）
- **実アクセス回数**：16回（上限目安20-25回以内、429/403/5xx=0件、blocked=0件）
- **warnings**：`findings.json`の`summary.warnings`に6件記録（councilSessions.json未マージ問題、
  fm14の統合方法、項目数の限定、identifiedButNotProcessedの活用、parser不具合2件、
  太田龍候補の国政関連質問の中立的記述について）。

---

## 8. マージ作業者向けチェックリスト（本ワーカーは実施していない）

1. `src/data/councilSessions.json`へ、`councilSessionsProposal`の2件（`2000-09`・`2004-06`）を
   追加する。
2. `src/data/councilSpeechSummaries.json`のmembers配列へ、`fm12`・`fm18`・`fm40`を新規
   メンバーオブジェクトとして追加する。
3. `fm14`は、`reports/phase57-58-general-questions-implementation-findings.json`の
   `resolvedCandidates[1]`（2005-09-14分）と本ファイルの候補（2004-06-14分）の**両方**を
   1つのspeeches配列にまとめた単一のfm14メンバーオブジェクトとして追加する
   （`proposedMemberRecordWrapperMerged`を参照）。
4. 上記1〜3完了後、`isPublished`を`true`に切り替えるかはデータ管理者の判断とする
   （切り替える場合は`npm run validate:data`でエラー0件を確認すること）。
5. `npm run validate:data` / `npm run typecheck` / `npm run lint` / `npm run build`を実行し、
   問題がないことを確認してからコミットする。
6. 6節のparser不具合2件（`parseSessionLabel()`の半角スペース非対応、
   `classifySpeakerLabel()`の役職名非対応）の修正要否を検討する。
7. `identifiedButNotProcessed`の6件（3節）を次回タスクの起点として利用できる。
