# Phase68 一般質問2005-2009年度 実投入 調査結果

作成日：2026-08-23
担当：Phase68ワーカー（Phase67と同一条件・同一スキーマで2005-2009年度を担当）

**本タスクで編集・作成したファイルは以下の2種類のみ**：本ファイル、
`reports/phase68-general-questions-2005-2009-findings.json`（新規作成）。
`src/data`・`scripts`配下は一切変更していない（読み取り専用として扱った。
`scripts/lib/minutes-source.mjs`はスクラッチパッド上のスクリプトからimportして実行しただけで、
ファイル自体は編集していない）。**git commit / git push は行っていない。ブラウザツールは使用していない。**

延岡市議会会議録検索システム（`https://www.kensakusystem.jp/nobeoka/`）への実アクセスは
**合計21回**（`scripts/lib/minutes-source.mjs`の実関数経由、各スクリプト実行後の`getFetchStats()`
の`completed`値を合算して算出）。上限目安20-25回以内。429/403/5xxは0件。同一URL・同一POST bodyの
再取得は行っていない（root See.exeの年タブ一覧ページはPhase56で既にキャッシュ済みのため、
2006〜2009年いずれの年も`resolveYearTreedepth`の初回GETで新規アクセスが発生しなかった）。

---

## 1. 事前確認事項

- `reports/phase56-parser-findings.md`：`scripts/lib/minutes-source.mjs`が平成12年（2000年）〜
  平成30年（2018年）の範囲で実データ確認済みであることを確認した（2005-2009年度は全てこの
  確認済み範囲に含まれる）。
- `reports/phase57-58-general-questions-implementation-findings.md`：UNR-026（`councilSessions.json`
  に2019-06より前の会期エントリが1件も存在しないため、一般質問候補が`validate-data.mjs`で
  エラーになる）を確認した。本タスクでも同じ制約が発生することを前提に作業した。
- `scripts/lib/minutes-source.mjs`：`resolveYearTreedepth`/`listSessionsForYear`/`listMeetingDays`/
  `listSpeakerSegments`/`fetchSegmentText`/`classifySpeakerLabel`の関数シグネチャとキャッシュ機構を
  確認した（読み取りのみ）。
- `src/data/councilSessions.json`：全42件のidが`2019-06`以降であることを再確認した（Phase57-58と
  同じ結論）。
- `src/data/councilSpeechSummaries.json`：`members`配列36名・`speeches`合計398件を確認した。
  2005-2009年度（`date < 2010-01-01`）のレコードは**0件**であることを機械確認した
  （Phase57-58の候補データも未マージのままであることを裏付ける）。

---

## 2. 会期選定と実データ取得

### 2.1 選定方針

2005-2009年度の5年度のうち、**2005年度（平成17年9月定例会、後藤哲朗議員）は
`reports/phase45-47-general-questions-findings.json`・
`reports/phase57-58-general-questions-implementation-findings.md`で既に確定済み**
（fm14、confidence: exact、questionItems8件、ただし未マージ）であるため、本ワーカーでは
同一会期・同一議員の重複調査を行わず、代わりに**2006・2007・2008・2009年度の4年度**で
新規に会期を選定し、フルパイプラインを実行した。

各年度、`listSessionsForYear`で会期一覧を取得した上で、6月または9月の定例会（第2号、
一般質問が行われる典型的な日程位置）を選び、`listSpeakerSegments`で最初の議員発言者を
確認し、その質問全文（壇上）と、直後に続く市長答弁を`fetchSegmentText`で取得した。

| 年度 | 会期 | 会議日 | 最初の議員発言者 | memberId | confidence |
|---|---|---|---|---|---|
| 2006 | 平成18年第21回定例会（第2号 6月13日） | H180613A | 中城あかね君 | m16 | exact |
| 2007 | 平成19年第2回定例会（第2号 6月12日） | H190612A | 白石武仁君 | fm45 | exact |
| 2008 | 平成20年第9回定例会（第2号 9月10日） | H200910A | 髙木益夫君 | fm57 | high |
| 2009 | 平成21年第15回定例会（第2号 9月8日） | H210908A | 平田信広君 | m20 | exact |

いずれの年も、`listSpeakerSegments`の発言セグメント一覧で議長名を確認したところ
（2006=稲田和利／2007-2008=新名種歳／2009=後藤哲朗）、`electionResults.json`の
当選記録（fm22/fm23/fm14）と矛盾なく一致しており、会期・年の特定が正しいことの
追加的な裏付けとなった。

### 2.2 発言セグメント一覧で発見した未マッピングの発言者（2006年）

2006-06-13の発言セグメント一覧（70件）には、中城あかね議員（order16、pos=28080）より前に
**「中井一萬君」（order4、pos=10160）**という別の議員による一般質問が存在することを確認した。
`electionResults.json`（1999年・2003年市議選の全候補）・`formerMembers.json`（58名）・
`members.json`（26名）のいずれにも一致する氏名・かな読みの候補が見つからなかったため、
**推測でmemberIdを付与せず、候補化しなかった**（質問本文・答弁本文も取得していない）。
`formerMembers.json`の1999年〜2003年任期のカバレッジに欠落がある可能性を示す発見として、
`unmappedSpeakerDiscoveries`に記録した（3.5節参照）。中城あかね議員（2006年1月29日執行補欠選挙で
初当選、m16、初当選後最初期の一般質問）を代わりに構造化候補とした。

---

## 3. 4候補の詳細

### 3.1 m16 中城あかね（2006-06-13、既存m16への追加候補）

- **member mapping**：exact（氏名完全一致、electionResults.jsonの2006年補欠選挙当選記録と
  日程が矛盾なく整合）。
- **確定できた質問項目：2件**（合併後の肉づけ予算における行財政改革の反映、民間経営感覚を
  活かした行財政改革への決意）。いずれも市長が直接答弁した部分のみを採用した。
- 質問には他に障害者自立支援法（福祉保健課長へ）・山下新天街アーケード跡地の駐車場問題
  （商工部長へ）の項目も含まれていたが、それらの答弁セグメントは未取得のため対象外とした。

### 3.2 fm45 白石武仁（2007-06-12、新規トップレベルmember候補）

- **member mapping**：exact（2007年4月市議選で改選後、本人が「トップバッター」と自認する
  内容と会期・日程が完全に整合。2003年・2007年とも当選記録あり）。
- **確定できた質問項目：4件**（長崎市長銃撃事件への見解・身辺警備、巡回バス実現、住民税増税に
  伴う国保税・介護保険料減免、乳幼児医療費助成拡充）。
- 質問には他に都市建設部長（交差点改良）・選挙管理委員会委員長（期日前投票）・教育長
  （歴史教育DVD教材）への項目も含まれていたが、それらの答弁セグメントは未取得のため対象外。

### 3.3 fm57 髙木益夫（2008-09-10、新規トップレベルmember候補）

- **member mapping**：high（かな読み完全一致・在籍期間の重なりは確認できたが、
  `formerMembers.json`側の既存`name`登録が「高木 ますお」＝ひらがな表記のみで、
  今回の会議録原文が漢字表記「髙木益夫」を新たに提示しているため、Phase59のfm49
  （矢野せんいちろう→矢野戦一郎）と同型のケースとしてexactではなくhighとした）。
- **確定できた質問項目：4件**（北川ダム対策検討委員会最終報告書の内容と取り組み状況、
  ダム問題への今後の取り組み姿勢、入札制度の考え方、ドクターヘリ誘致活動状況）。
- 質問には他に工事予定価格・落札率、単品スライド条項、ツーリズム観光、ごみ不法投棄・
  野焼き対策、南延岡駅前駐輪場についての項目（次の答弁者＝企画部長へ続く）も含まれていたが、
  それらの答弁セグメントは未取得のため対象外とした。

### 3.4 m20 平田信広（2009-09-08、既存m20への追加候補）

- **member mapping**：exact（氏名完全一致、2003年・2007年とも当選記録あり、
  本人発言「日本共産党市議団の平田信広」「これまで六回のトップ登壇」も既存の長期在職記録と
  矛盾しない）。
- **speechType**：「総括質疑・一般質問」（本人が冒頭「ただいまから総括質疑並びに一般質問を
  行います」と明言。`src/lib/questionLikeSpeechTypes.ts`のコメントに平田信広議員
  〔令和7年6月／12月〕の実例として明記されている値と同一区分）。
- **確定できた質問項目：2件**（2009年8月30日衆院選＝政権交代の結果への見解と市政への影響、
  民主党マニフェスト〔高速道路無料化・子ども手当・日米FTA〕への懸念点）。
- 質問には他に新型インフルエンザ対策・後期高齢者医療制度・市道整備進捗・市営住宅管理・
  学校給食調理業務民間委託の項目（次の答弁者＝総務部長へ続く）も含まれていたが、
  それらの答弁セグメントは未取得のため対象外とした。

### 3.5 未マッピングの発見（候補化していない）

| 発言者ラベル | 会期 | fileName | order/pos | 状況 |
|---|---|---|---|---|
| 中井一萬君 | 平成18年第21回定例会（第2号 6月13日） | H180613A | order4 / pos=10160 | electionResults.json/formerMembers.json/members.jsonのいずれにも一致候補なし。質問本文・答弁本文とも未取得。 |

---

## 4. UNR-026対応：councilSessions.jsonマージ用レコード案

`src/data/councilSessions.json`には2019-06より前の会期エントリが1件も存在しないため
（Phase57-58で既に確認済みのUNR-026、`reports/phase33-master-unresolved-ledger.json`に記録）、
上記4候補はいずれも`isPublished: false`のまま据え置いた。

本タスクでは、`scripts/validate-data.mjs`が要求する必須項目（`id`/`title`/`eraYear`/`year`/
`fiscalYear`/`sessionType`/`folderPath`）のみで構成した**最小限の会期エントリ案**を
`reports/phase68-general-questions-2005-2009-findings.json`の`councilSessionsProposals`に
5件（2006-06・2007-06・2008-09・2009-09・参考記載の2005-09）作成した。`documents`・
`summarySources`等の一次資料PDFリンクは今回取得できていないため意図的に省略した
（これらはoptional項目であり、省略してもvalidate-data.mjsはエラーにならないことを
`scripts/validate-data.mjs`のロジックを読んで確認済み）。

2005-09（後藤哲朗、fm14）分は本ワーカーが新規に取得したものではなく、既存の
`reports/phase45-47-general-questions-findings.json`・
`reports/phase57-58-general-questions-implementation-findings.md`で既に検証済みの情報を
参考記載として追加した。この5件がすべてマージされれば、本タスクの4候補に加え、
既存の後藤哲朗（fm14）候補もあわせて公開可能になる見込みである。

**本ワーカーは`src/data/councilSessions.json`を一切編集していない（提案のみ）。**

---

## 5. 品質確認

- `npm run validate:data`は実行していない（`src/data`配下を変更していないため、
  実行しても本タスクによる新規errors/warningsは生じない。Phase57-58と同じ理由）。
- `scripts/lib/minutes-source.mjs`は一切編集していない（parser regression件数0件）。
- 4候補すべて、`questionAnswerLinkStatus: "confirmed"`の項目のみを採用した（市長が直接答弁した
  部分に限定し、他の答弁者に委ねられた項目や未取得の答弁は対象外とした。無理に埋めていない）。
- 発言者ラベルの`classifySpeakerLabel`分類は4セッションとも想定どおり（`member`区分4名、
  `mayor`区分の市長答弁4件）で、誤分類は確認されなかった。

---

## 6. 終了時報告

- **新規追加候補件数（分類別）**：
  - `A_ready_for_merge`：**4件**（m16-2006-06-13＝既存m16への追加候補・questionItems2件、
    fm45-2007-06-12＝新規トップレベルmember・questionItems4件、
    fm57-2008-09-10＝新規トップレベルmember・confidence:high・questionItems4件、
    m20-2009-09-08＝既存m20への追加候補・questionItems2件）
  - `B_member_mapping_pending`：**1件**（中井一萬、2006-06-13。質問本文は未取得のまま）
  - `C_source_verification_pending`：0件
  - `D_parser_error`：0件
  - `E_duplicate`：**1件**（後藤哲朗、2005-09-14、fm14。Phase45-47/57-58で既に確定済みのため
    重複調査を回避）
  - `F_unavailable`：0件
- **確定できた質問項目の合計**：**12件**（m16=2件、fm45=4件、fm57=4件、m20=2件。
  すべて`questionAnswerLinkStatus: "confirmed"`）
- **member mapping resolved件数**：4件（m16=exact、fm45=exact、fm57=high、m20=exact）
- **duplicate除外件数**：1件（後藤哲朗、2005-09-14。src/data本体には未反映のため実データ上の
  重複は0件）
- **parser issue件数**：0件（`scripts/lib/minutes-source.mjs`は一切編集していない。
  今回使用した全関数が2006〜2009年の4年分で想定どおりの結果を返した）
- **実アクセス回数**：21回（上限目安20-25回以内、429/403/5xx=0件）
- **warnings**：
  1. **（最重要）** `src/data/councilSessions.json`に2019-06以前の会期エントリが存在しないため
     （UNR-026）、本タスクの4候補はいずれも`isPublished: false`とした。
     `councilSessionsProposals`（5件）をマージすれば5候補すべてが公開可能になる見込み。
  2. 各セッションとも、壇上質問には市長以外の答弁者（部長級・委員会委員長等）に向けた
     追加項目が複数含まれているが、それらの答弁セグメントは未取得のため意図的に対象外とした
     （水増しを避けるため、確認できた範囲のみを構造化した）。
  3. fm57（髙木益夫）は`formerMembers.json`側の既存`name`登録（ひらがな「高木 ますお」）と
     今回発見した会議録原文の漢字表記（「髙木益夫」）が異なる。fm49（矢野戦一郎）と同型の
     ケースで、`name`フィールド更新の要否は別途データ管理者判断が必要（本ワーカーは
     `formerMembers.json`を編集していない）。
  4. 中井一萬（2006-06-13）は、現行の`electionResults.json`/`formerMembers.json`/
     `members.json`のいずれにも一致する候補が見つからなかった。1999年〜2003年任期の
     `formerMembers.json`カバレッジに欠落がある可能性を示す発見であり、将来の
     `formerMembers.json`拡充タスクでの追加調査を推奨する。
  5. m16（中城あかね）・m20（平田信広）は現職継続議員であり、`term: "previous"`を付与した
     2019年より前の日付の追加である点は、Phase57-58のm08（甲斐正幸、2014-03-04）と同型の
     前例（旧任期一般質問アーカイブ拡張）である。

---

## 7. マージ作業者向けチェックリスト（本ワーカーは実施していない）

1. `src/data/councilSessions.json`へ、`councilSessionsProposals`の5件
   （2006-06・2007-06・2008-09・2009-09・2005-09）を追加する。
2. `reports/phase68-general-questions-2005-2009-findings.json`の
   `resolvedCandidates[0]`（m16）の`speech`を、既存`memberId:"m16"`レコードの`speeches`配列へ
   追加する。
3. `resolvedCandidates[1]`（fm45）の`proposedMemberRecordWrapper`＋`speech`を
   `councilSpeechSummaries.json`の`members`配列へ新規要素として追加する。
4. `resolvedCandidates[2]`（fm57）の`proposedMemberRecordWrapper`＋`speech`を同様に新規要素として
   追加する（`formerMembers.json`のname更新要否も合わせて判断する）。
5. `resolvedCandidates[3]`（m20）の`speech`を、既存`memberId:"m20"`レコードの`speeches`配列へ
   追加する。
6. 上記1〜5完了後、`isPublished`を`true`に切り替えるかはデータ管理者の判断とする
   （切り替える場合は`npm run validate:data`でエラー0件を確認すること）。
7. `npm run validate:data` / `npm run typecheck` / `npm run lint` / `npm run build`を実行し、
   問題がないことを確認してからコミットする。
8. 併せて、Phase57-58の未マージ3件（矢野戦一郎fm49＝2013-06、後藤哲朗fm14＝2005-09、
   甲斐正幸m08＝2014-03）も、同じcouncilSessions.json拡張作業の中でまとめてマージ可否を
   検討することを推奨する（councilSessionsProposalsの2005-09エントリは、この既存候補の
   マージも見据えて追加した）。
