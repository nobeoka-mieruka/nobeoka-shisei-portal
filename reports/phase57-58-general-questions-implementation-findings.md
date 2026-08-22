# Phase57+58統合 一般質問2010年代・2000年代 実投入 調査・実装結果

作成日：2026-08-23
担当：Phase57+58統合ワーカー

**本タスクで編集・作成したファイルは以下の2種類のみ**：本ファイル、
`reports/phase57-58-general-questions-implementation-findings.json`（新規作成）。
`src/data`・`scripts`配下は一切変更していない（読み取り専用として扱った）。
**git commit / git push は行っていない。ブラウザツールは使用していない。**

延岡市議会会議録検索システム（`https://www.kensakusystem.jp/nobeoka/`）への実アクセスは
**合計13回**（`scripts/lib/minutes-source.mjs`の実関数経由、`getFetchStats()`で実測）。
上限目安25回以内。429/403/5xxは0件。同一ページの再取得は行っていない。
内訳は`reports/phase57-58-general-questions-implementation-findings.json`の
`networkAccessLog`に記録した。

---

## 0. 最重要の発見：councilSessions.jsonにマージをブロックする構造的な欠落がある

作業に入る前にcouncilSpeechSummaries.jsonの実スキーマと`scripts/validate-data.mjs`の検証ロジックを
精査した結果、**今回の3件（矢野戦一郎・後藤哲朗・甲斐正幸2014年分）はいずれも、現状のまま
`src/data/councilSpeechSummaries.json`へマージするとvalidate-dataがエラーになる**ことが分かった。

- `scripts/validate-data.mjs`は、`speech.sessionId`が`src/data/councilSessions.json`の`id`一覧に
  含まれているかを**`isPublished`の真偽に関係なく無条件で**チェックし、含まれていなければ
  `err()`（エラー）にする（2703-2705行目）。
- 機械確認した結果、`src/data/councilSessions.json`の全42件のidは**すべて`2019-06`以降**であり、
  `2013`・`2005`・`2000`・`2014`・`2018`で始まるidは**1件も存在しない**（会議録検索システムの
  収録範囲自体はPhase56で平成12年＝2000年まで遡って動作確認済みだが、councilSessions.json側の
  データはそこまで遡って整備されていない）。
- したがって、`sessionId: "2013-06"`（矢野戦一郎）・`"2005-09"`（後藤哲朗）・`"2014-03"`
  （甲斐正幸）はいずれも、現状のcouncilSessions.jsonには存在しないIDであり、このままマージすると
  `npm run validate:data`が失敗する。

このため、**今回作成した3件の候補データはすべて`isPublished: false`とした**。マージには、
`src/data/councilSessions.json`へ該当する旧会期のエントリ（`id`・`title`・`sessionType`・
`sessionNumber`・`documents`等、councilSessions.jsonの実スキーマに準拠したもの）を追加する
**別タスクが必須**である。councilSessions.jsonの実スキーマは議案審議結果PDF等の一次資料リンクを
要求する重い構造のため、本ワーカーの読み取り専用制約内では実施できなかった（提案のみ、
`findings.json`の`blockingDependency`に記録した）。

---

## 1. 矢野戦一郎・後藤哲朗の確定結果

### 1.1 memberId確定

Phase59の照合結果をそのまま採用した。

| 候補 | memberId | confidence | 根拠 |
|---|---|---|---|
| 矢野戦一郎（2013-06-11） | `fm49`（「矢野 せんいちろう」） | high | かな完全一致・在籍期間の重なり・同姓同名候補なし。fm49側の漢字表記が未確定のためexactではなくhigh（Phase59提案：fm49の`name`を「矢野 戦一郎」へ更新する候補あり。本ワーカーはformerMembers.jsonを編集していない） |
| 後藤哲朗（2005-09-14） | `fm14`（「後藤 哲朗」） | exact | 氏名漢字・かな完全一致、在籍期間の重なり、同姓同名候補なし |

両名とも`formerMembers.json`への新規追加は不要。

### 1.2 councilSpeechSummaries.jsonへのマージ用データ構造

councilSpeechSummaries.jsonの実スキーマ（`members`は配列、各要素は
`memberId/isFormerMember/scope/analysisPeriod/analyzedSessionCount/.../topicCounts/speeches`を持ち、
`speeches[]`の各要素は`id/memberId/sessionId/date/meetingNumber/meetingType/speechType/isPublished/
summaryStatus/topics/shortSummary/questionItems/summarySources/verifiedAt/verificationNote`という
構造。既存の元議員（`fm01`〜`fm10`、10名）のエントリで実際に使われている形式を確認した上で、
それに完全準拠する形で再構成した）に基づき、`fm14`・`fm49`それぞれについて**新規のトップレベル
memberオブジェクト**（`members`配列への追加要素）として組み立てた。詳細は
`reports/phase57-58-general-questions-implementation-findings.json`の
`resolvedCandidates[0]`（矢野戦一郎）・`resolvedCandidates[1]`（後藤哲朗）を参照。

元の候補データ（Phase45-47）からの主な修正点：

- `summaryStatus: "verified-pilot-partial"`（存在しない値）→ `"partially-verified"`
  （`VALID_SPEECH_SUMMARY_STATUSES`に実在する値）へ修正。
- `term: "legacy-pilot-2010s"`のような独自値（`validate-data.mjs`は`term`を`"current"|"previous"`
  以外許容しない）は**使用しない**こととした（`fm01`等の既存元議員エントリも`term`フィールド自体を
  持たない）。
- `sourceRefs`という独自キー名 → 実スキーマのキー名`summarySources`へ修正。
- 質問側の`exchanges`で`speakerName: "矢野戦一郎"`としていた箇所 →
  実際の慣例（`fm01`の例）に合わせ`speakerId: "fm49"`（自分自身の発言は`speakerId`、
  答弁側は`speakerName`に役職名）へ修正。

---

## 2. 追加取得できた質問項目

Phase45-47では、矢野戦一郎・後藤哲朗とも「壇上質問の全文を読めば他にも項目があると推定されるが、
時間の制約で最初の答弁のみ要約した」という制約が明記されていた。今回、`fetchSegmentText`で
壇上質問全文と追加の答弁セグメントを取得し、以下のとおり追加した。

### 2.1 矢野戦一郎（2013-06-11）：2項目 → 6項目

壇上質問全文（pos=3524）を読んだ結果、通告は「市長の政治姿勢（マニフェスト＋公募制）」
「小型家電リサイクル法施行」「外郭団体との随意契約」「総合支所機能・区や消防団の見直し」
「新型インフルエンザ対策」「鮎やなオーナー制度」「北川流域の浸水対策」「学校の文化財一元管理」
「食物アレルギー対策」の**約10項目**を含むことが判明した。今回、市長・企画部長・総務部長の
答弁セグメント（pos=12992, 14956, 17274）を追加取得し、以下4項目を新規に構造化した
（既存2項目と合わせて6項目）。

- q3: 公募制導入の進捗状況（平成23年9月以降の新規導入団体・未導入団体への対応）— 総務部長
- q4: 外郭団体（第三セクター）との随意契約の状況と今後の対応 — 企画部長
- q5: 総合支所のあり方の検討・地域自治会（区）組織の再編 — 企画部長
- q6: 新型インフルエンザ対策協議会の設置 — 総務部長

残り約4項目（小型家電リサイクル法、鮎やなオーナー制度、北川流域浸水対策・堆積土砂撤去、
文化財一元管理、食物アレルギー対策）に対応する答弁セグメント（市民環境部長・健康福祉部長・
商工観光部長・消防長・教育長・教育部長・北川町総合支所長、pos=18916〜24688）、および
後藤議員自身の再質問ラウンド（order16以降）は、アクセス回数の制約により今回は取得していない。

### 2.2 後藤哲朗（2005-09-14）：5項目 → 8項目

壇上質問全文（pos=17749）で本人が「十八項目の質問をさせていただきます」と明言していることを
再確認した。今回、助役・企画部長の答弁セグメント（pos=38543, 40037）を追加取得し、以下3項目を
新規に構造化した（既存5項目と合わせて8項目）。

- q6: 指定管理者制度導入における公募の判断根拠・経過、今後の制度導入の考え方 — 助役
  （指定期間の設定根拠についての質問への直接の言及はこのセグメント内では確認できなかったため
  `questionAnswerLinkStatus: "partially-confirmed"`とした）
- q7: 市町村合併支援道路等整備プロジェクトの進捗・スケジュール — 企画部長
- q8: 大学（九州保健福祉大学・聖心ウルスラ短期大学）を活かしたまちづくり・PR強化 — 企画部長

なお、「助役（柳田喜継君）」の発言が`classifySpeakerLabel()`で`speakerType: "official"`,
`title: "助役"`として正しく分類されること（Phase56で追加したofficialTitles拡張）を、実データで
再確認できた。

残り10項目（総務部長＝駐輪場整備・第五次行政改革・自治会加入促進等、市民環境部長＝環境行政2点、
商工部長＝観光振興2点、都市建設部長＝駐輪場整備、教育部長＝備品整備率）、および後藤議員自身の
再質問ラウンド（order14以降）は今回未取得。

---

## 3. 新規パイロット会期の構造化結果

### 3.1 選定：平成26年（2014年）3月定例会（第19回定例会）

Phase56で動作確認済みの年度（2000, 2005, 2013, 2014, 2018年）のうち、2005年・2013年は
Phase45-47で既に着手済みのため、未着手の**2014年**を選定した。フルパイプラインを実際に実行した。

```
resolveYearTreedepth({year:2014}) → "平成26年"（Phase56キャッシュヒット、新規アクセス0回）
listSessionsForYear({year:2014}) → 6会期（第18回臨時会〜第23回定例会、Phase56キャッシュヒット）
  → "平成26年 第19回定例会 " を選択
listMeetingDays(...) → 6日程（H260225A〜H260319A、1回アクセス）
  → 第2号 3月4日（H260304A）を選択（一般質問が行われる典型的な日程位置）
listSpeakerSegments({fileName:"H260304A"}) → 150発言セグメント（1回アクセス）
  → order6 "甲斐正幸君"（pos=9352）を最初の質問者として発見
fetchSegmentText(pos=9352) → 甲斐正幸議員の壇上質問全文取得（1回アクセス）
fetchSegmentText(pos=24246) → 市長答弁取得（1回アクセス）
```

### 3.2 発言者の照合：甲斐正幸君 → m08（現職継続議員、confidence: exact）

`members.json`を確認したところ、**現職議員m08「甲斐 正幸」（会派：無所属、期数4期）と氏名完全一致**
した。同姓の議員（甲斐行雄=m06、甲斐忠篤=m07、甲斐武=fm16、甲斐英孝=fm30、甲斐勝吉=fm33）は
いずれも下の名前が異なる別人であり、同姓同名リスクはない。m08は既にcouncilSpeechSummaries.jsonに
2019-06以降の一般質問が14件登録済み（在職の事実が既存データで裏付けられている）ため、
在籍期間の照合という観点でも矛盾がない。**member mapping: resolved（confidence: exact）**。

甲斐正幸議員は現職継続議員のため、この2014年分の発言は**新規メンバー行の追加ではなく、
既存m08レコードの`speeches`配列への追加候補**として構造化した（`term: "previous"`を付与。
`councilSpeechPeriod.from`＝2023-04-23より前の日付であるため、既存の152件の`term:"previous"`の
前例と同じ扱い）。

### 3.3 質問項目数：3項目（壇上通告は約24項目）

壇上質問全文（pos=9352）を精読したところ、この発言は「のべおか市民派クラブを代表して」の
**総括質疑・一般質問**（`speechType: "総括質疑・一般質問"`。この値は`src/lib/
questionLikeSpeechTypes.ts`のコメントで甲斐正幸議員の令和8年3月分の実例として明記されている
区分と同一）であり、市長の政治姿勢8点・企業誘致5点・観光振興3点・協働共汗事業の充実・
消防団の活性化4点・アスリートタウンのべおか3点の**計約24項目**を含む大部な質問だった。

市長の答弁（pos=24246）冒頭で直接対応が確認できた以下3項目のみを今回要約対象とした
（無理に埋めず、確実に構造化できる範囲にとどめた）。

- q1: 平成26年度当初予算編成の重点方針
- q2: 市長選挙（三期目当選）の振り返りと過去最低投票率について
- q3: 多選禁止に関する市長の考え方（三期目時点）

同じ答弁セグメント内には他に「三期目の抱負（マニフェスト・内藤記念館等再整備）」
「市内経済の状況と対策（消費増税）」「特命担当副市長の企業誘致活動評価」の3項目も含まれていたが、
今回は時間の制約により要約を見送った。残りの項目（副市長・企画部長・総務部長・商工観光部長・
都市建設部長・消防長・教育部長・北浦町総合支所長の答弁、order8以降）は未取得。

---

## 4. 終了時報告

- **2010年代追加件数**：2件（矢野戦一郎2013-06-11＝新規メンバー行、甲斐正幸2014-03-04＝
  既存m08への追加候補）
- **2000年代追加件数**：1件（後藤哲朗2005-09-14）
- **member mapping resolved件数**：3件（fm49=high、fm14=exact、m08=exact）
- **member mapping pending件数**：0件
- **duplicate除外件数**：0件（councilSpeechSummaries.jsonの既存`speeches[].id`・
  `(memberId, sessionId, date, speechType)`の組み合わせと突き合わせ、重複なしを確認した）
- **parser regression件数**：0件（`scripts/lib/minutes-source.mjs`は一切編集していない。
  今回使用した関数（`resolveYearTreedepth`・`listSessionsForYear`・`listMeetingDays`・
  `listSpeakerSegments`・`fetchSegmentText`・`classifySpeakerLabel`）はすべてPhase56の
  平成対応実装をそのまま利用し、想定どおりの結果を返すことを確認した。「助役」ラベルの
  `classifySpeakerLabel`分類も実データで再確認できた）
- **実アクセス回数**：13回（上限目安25回以内、429/403/5xx=0件）
- **warnings**：
  1. **（最重要）** `src/data/councilSessions.json`に2019-06より前の会期エントリが存在しないため、
     今回の3件はすべて`isPublished: false`とした。マージには別タスクとしてcouncilSessions.jsonへ
     旧会期エントリを追加する作業が必須（0節参照）。
  2. 矢野戦一郎（6/約10項目）・後藤哲朗（8/18項目）・甲斐正幸（3/約24項目）とも、壇上質問の
     全項目に対応する答弁を網羅できていない。取得できた範囲のみを正直に記録した。
  3. 甲斐正幸2014-03-04分は、会議録収録範囲（2019-06以降）で既に14件のspeechesが登録済みの
     現職継続議員m08に対する「旧任期（`term:"previous"`）」の追加である。既存の
     `term:"previous"`前例（152件）はすべて2019-06以降の日付（councilSessions.json収録範囲内）
     であり、2019年より前の日付に`term:"previous"`を使う前例は今回が初めてとなる
     （sessionId欠落の問題とは独立に、この用法自体に既存のvalidate-dataロジック上の矛盾はない
     ことを確認済み）。
  4. fm49（矢野戦一郎）の`formerMembers.json`上の`name`フィールド更新（「矢野 せんいちろう」→
     「矢野 戦一郎」）はPhase59からの申し送り事項のまま未実施（本ワーカーもformerMembers.json
     を編集していない）。

---

## 5. マージ作業者向けチェックリスト（本ワーカーは実施していない）

1. `src/data/councilSessions.json`へ、平成25年第14回定例会（2013-06相当）・
   平成17年第16回定例会（2005-09相当）・平成26年第19回定例会（2014-03相当）のエントリを
   councilSessions.jsonの実スキーマ（`documents`・`summarySources`等含む）に準拠して追加する。
2. `reports/phase57-58-general-questions-implementation-findings.json`の
   `resolvedCandidates[0].proposedMemberRecordWrapper`＋`speech`を
   `councilSpeechSummaries.json`の`members`配列へ新規要素として追加する（矢野戦一郎=fm49）。
3. 同様に`resolvedCandidates[1]`（後藤哲朗=fm14）を新規要素として追加する。
4. `resolvedCandidates[2]`の`speech`を、既存の`memberId:"m08"`レコードの`speeches`配列へ追加する
   （甲斐正幸2014-03-04）。あわせてm08の`analyzedSessionCount`等の集計値を+1する場合は、
   2014年以前の他会期の状況を別途調査した上で`unfetchedSessionCount`等を検討する
   （本ワーカーは推測で埋めていない）。
5. 上記1〜4完了後、`isPublished`を`true`に切り替えるかはデータ管理者の判断とする
   （切り替える場合は`npm run validate:data`でエラー0件を確認すること）。
6. `npm run validate:data` / `npm run typecheck` / `npm run lint` / `npm run build`を実行し、
   問題がないことを確認してからコミットする。
