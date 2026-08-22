# Phase56 一般質問parser改修（平成年代対応）調査・実装結果

作成日：2026-08-23
担当：Phase56ワーカー（Phase57・58の前提となる単独実行タスク）

**本タスクで編集・作成したファイルは以下の3種類のみ**：
`scripts/lib/minutes-source.mjs`（改修）、`scripts/test-minutes-source-parser.mjs`（新規作成）、
本ファイル。`src/data`配下・他のscriptsファイルは一切変更していない
（`git status`で`src/data/councilSessions.json`が変更表示されるが、これは本タスク開始前から
既に変更されていたもので、本ワーカーによる変更ではない）。
**git commit / git push は行っていない。ブラウザツールは使用していない。**

延岡市議会会議録検索システム（`https://www.kensakusystem.jp/nobeoka/`）への実アクセスは
**合計12回**（raw curl 7回＋`scripts/lib/minutes-source.mjs`の`fetchWithRetry`経由5回。
うち令和期の確認は既存の本番キャッシュ（`scripts/.cache/minutes/`）をそのまま利用したため
追加アクセス0回）。上限目安20回以内。

---

## 1. 変更内容（diff要約）

### 1.1 `parseYearRange(altLabel)`

- 変更前：正規表現`/令和\s*(元|\d+)年/g`固定、西暦オフセット`+2018`固定。
- 変更後：正規表現を`/(令和|平成)\s*(元|\d+)年/g`に拡張し、マッチした元号文字列（`m[1]`）で
  `ERA_CONFIG`（新設）からオフセットを引く分岐に変更。**令和側の計算式・返り値は完全に同一**
  （`令和 X年`→`2018+X`は変更なし）。
- 追加効果：「平成30年～令和元年」のような元号をまたぐグループタブのラベルも、各トークンを
  個別にパースして正しい範囲（`{fromYear: 2018, toYear: 2019}`）を返せるようになった
  （実データで確認、1.4節参照）。

### 1.2 `resolveYearTreedepth({code, year})`

- 変更前：`eraNum = year - 2018`固定、ラベルは`令和 ${eraNum}年`固定。
- 変更後：`year >= 2019`なら令和、`year < 2019`（かつ`1989`以上）なら平成、として`ERA_CONFIG`から
  設定を選択し、そこからoffset・ラベル生成関数を取得。**令和側（`year >= 2019`）は
  `eraNum = year - 2018`、ラベル生成`eraNum===1 ? "令和元年" : "令和 ${eraNum}年"`と、
  従来の計算式・分岐と完全に同一**。木構造ナビゲーション自体（direct一致→範囲タブ探索→
  POST→innerTabs探索）のロジックは一切変更していない。
- 平成側のラベル生成は`eraNum===1 ? "平成元年" : "平成${eraNum}年"`（**スペースなし**。令和が
  `"令和 8年"`とスペースありなのとは異なる書式で、実データで確認済み＝1.4節）。
- JSDocおよびエラーメッセージの「令和5年〜令和8年の範囲で動作確認済み」を、平成対応を反映した
  内容に更新。

### 1.3 `fileNameToIsoDate(fileName)`

- 変更前：正規表現`^R(\d{2})(\d{2})(\d{2})[A-Z]$`（Rプレフィックス固定）、`REIWA_START_YEAR=2018`
  固定でオフセット計算。
- 変更後：まず令和（`R`プレフィックス）を試し、マッチすれば**従来と全く同じ計算**で返す。
  マッチしなければ平成（`H`プレフィックス、`^H(\d{2})(\d{2})(\d{2})[A-Z]$`）を試し、マッチすれば
  新設の`HEISEI_START_YEAR=1988`でオフセット計算して返す。どちらにもマッチしなければ
  `undefined`（従来と同じフォールバック）。

### 1.4 追加した定数・実データ確認事項

```js
const REIWA_START_YEAR = 2018;   // 変更なし
const HEISEI_START_YEAR = 1988;  // 新設。平成元年=1989年
```

Phase56で新たにcurlで確認した書式の違い（Phase45-47の報告では明記されていなかった詳細）：

| 元号 | 個別年ラベル書式 | 例 |
|---|---|---|
| 令和 | 全角スペースあり（「令和元年」のみ例外） | `"令和 8年"`、`"令和元年"` |
| 平成 | 常にスペースなし（「平成元年」も同様と推定） | `"平成26年"`、`"平成31年"`、`"平成30年"` |

この違いを踏まえ、`ERA_CONFIG`のラベル生成関数を元号ごとに分けて実装した（1つの共通フォーマット
関数ではなく、令和用・平成用を別々に定義。これにより既存の令和ラベル生成コードを1文字も変えずに
温存できた）。

### 1.5 `classifySpeakerLabel(label)`

- `officialTitles`配列に`"助役"`を1件追加（`["市長", "副市長", "教育長", "選挙管理委員会委員長", "監査委員", "助役"]`）。
- 分類ロジック自体（`title === "市長" ? "mayor" : "official"`）は変更していないため、
  「助役」は`speakerType: "official"`として扱われる（副市長制導入以前の役職。
  Phase45-47で平成17年＝2005年の会議録に実例を確認済み）。
- `normalizeSpeakerName()`・`matchSpeakerToMember()`は変更していない
  （「必要最小限」の方針に従い、`classifySpeakerLabel`の1リストへの追加のみに留めた）。

---

## 2. fixtureテスト（`scripts/test-minutes-source-parser.mjs`）

### 2.1 テスト構成

1. **令和 回帰テスト**：`REIWA_BEFORE_SNAPSHOT`（変更前のコードを実際に呼び出して得た結果を
   埋め込んだfixture。2019〜2026年の8年分、`resolveYearTreedepth`・`listSessionsForYear`
   （会期一覧・treedepth・sessionNumber・sessionType全項目）・`fileNameToIsoDate`5パターン）
   と、変更後コードの実行結果を突き合わせる。
2. **平成 新規対応テスト**：2000年（平成12年、See.exeの最古タブ）・2005年（平成17年）・
   2013年（平成25年）・2014年（平成26年）・2018年（平成30年、元号境界年）の
   `resolveYearTreedepth`結果と`listSessionsForYear`の会期数を検証。
3. **`fileNameToIsoDate`平成プレフィックス**：`H250611A`→`2013-06-11`、`H170914A`→
   `2005-09-14`（いずれもPhase45-47の実データと一致）、`H010101A`→`1989-01-01`（平成元年の
   境界値、ネットワーク不要の純粋関数テスト）、令和`R080216A`の再確認、不正形式の
   `undefined`確認。
4. **`classifySpeakerLabel`「助役」対応**：`"助役（柳田喜継君）"`→`official`/`"助役"`、
   既存の`市長`・一般議員ラベルの分類が変わっていないことの再確認。
5. **元号境界の分岐確認**：`resolveYearTreedepth(2018)`（平成30年）と`resolveYearTreedepth(2019)`
   （令和元年）が異なる値を返し、2019年専用ロジック（既存、変更なし）が引き続き令和元年を
   指すことを確認。

### 2.2 実行結果

```
node scripts/test-minutes-source-parser.mjs
=== 結果: 40件成功 / 0件失敗（regression件数=0） ===
```

令和8年分の`resolveYearTreedepth`・`listSessionsForYear`（会期数40件超、`sessionNumber`・
`sessionType`まで含む完全一致）・`fileNameToIsoDate`5パターンすべてが変更前と完全に同じ結果を
返すことを確認した（JSON往復比較で、明示的`undefined`キーの有無による偽陽性を排除した上での
完全一致）。

---

## 3. curl実データ検証（平成年代）

`scripts/lib/minutes-source.mjs`と同じ`sjisPercentEncode`ロジック・User-Agent・Shift_JISデコード
（iconv-lite）を使い、Node.js経由でcurlを実行して以下を確認した（コード値は既存本番と同じ
`Code=48o046ot0cia1xvtw7`）。

| # | 内容 | URL/POSTボディ | 結果 |
|---|---|---|---|
| 1 | root See.exe（年タブ一覧） | `GET See.exe?Code=48o046ot0cia1xvtw7` | 10タブ確認（令和8年〜平成12-14年グループ）。平成グループのaltLabel・treedepth書式を実データで確認 |
| 2 | 平成24-26年グループ展開 | `POST treedepth=平成26年` | 個別年タブ`平成24年`/`平成25年`/`平成26年`（スペースなし）＋平成26年の会期一覧（6会期）が同時に返った |
| 3 | 平成25年（個別）会期一覧 | `POST treedepth=平成25年` | 第11回定例会〜第17回定例会（7会期）を確認 |
| 4 | 平成17年（個別）会期一覧 | `POST treedepth=平成17年` | 第12回臨時会〜第17回定例会（6会期）を確認 |
| 5 | 平成25年第14回定例会 本会議日一覧 | `POST treedepth=平成25年 第14回定例会 ` | `H250603A`〜`H250621A`（5日程）。`H250611A`＝第2号6月11日を確認（Phase45-47と一致） |
| 6 | 平成17年第16回定例会 本会議日一覧 | `POST treedepth=平成17年 第16回定例会 ` | `H170907A`〜`H170928A`（5日程）。`H170914A`＝第2号9月14日を確認（Phase45-47と一致） |
| 7 | 平成30年～令和元年 境界グループ展開 | `POST treedepth=令和元年` | 個別年タブとして`令和元年`・`平成31年`・`平成30年`が別々に存在することを確認（重要な発見、3.1節） |

その後、変更後の`resolveYearTreedepth`・`listSessionsForYear`関数自体を実際に呼び出し
（`fetchWithRetry`経由、5回の新規ネットワークアクセス）、2000年・2005年・2013年・2014年・
2018年の5年分すべてで正しい年度・会期一覧を解決できることを確認した（2節のテスト結果に反映済み）。

### 3.1 重要な発見：2019年（令和元年/平成31年）の二重構造

root See.exeの境界タブは`"平成30年～令和元年"`という1つのaltLabelだが、これを展開すると
`令和元年`・`平成31年`・`平成30年`という**3つの個別年タブ**が現れる。これは、2019年が
暦年としては1つでも、会議録システム上は「1〜4月分＝平成31年」「5月以降分＝令和元年」という
**2つの別タブに分かれて収録されている**ことを意味する。

既存の`resolveYearTreedepth(2019)`は（本タスクで変更していない令和ロジックにより）常に
`"令和元年"`のみを指すため、**2019年1〜4月（平成31年）分の会議録は、現状のコードでは
`year: 2019`を渡しても到達できない**。ただし、これは既存動作であり（`旧任期`の収録開始が
`2019-06`＝令和元年6月であるため実害は生じていない）、本タスクの指示（令和ロジックを変更
しない）にも合致するため、あえて変更していない。**Phase57・58で2019年1〜4月分（平成31年）の
会議録を扱う場合は、`year: 2019`ではなく実質的に別の指定方法（例：明示的に平成31年の
treedepthを使う等）が必要になる点をwarningsとして記録する**（6節参照）。

---

## 4. validate:data実行結果

```
npm run validate:data
[validate-data] members=26 generalQuestions=15 billVotes=1177 councilSessions=42 — errors=0 warnings=15
```

**errors=0**。warnings=15件はすべて本タスク開始前から存在していた既存の警告
（`archiveMayorTerms.json`の任期空白期間、`archiveFiscalYears.json`の欠番年度、
`councilSpeechSummaries.json`の`questionApproach`推奨語彙外、計15件）であり、
本タスクによる新規warningsは0件。`src/data`配下を一切変更していないため、この結果は
本タスク実施前と完全に同一である。

`npx tsc -b`（typecheck相当）・`npx oxlint scripts/lib/minutes-source.mjs scripts/test-minutes-source-parser.mjs`
（lint）はいずれもエラー・警告なし。

---

## 5. 結論：Phase57・58が使用できる状態になったか

**結論：使用可能な状態になった。**

- `parseYearRange`・`resolveYearTreedepth`・`fileNameToIsoDate`の3関数はいずれも、令和期
  （2019〜2026年、既存本番と完全に同一の挙動）と平成期（2000〜2018年、Phase56で新規に
  実データ確認）の両方を、元号文字列そのもの（または西暦年から導出した元号）で分岐して
  正しく処理する。
- 実データ確認範囲：平成12年（2000年、See.exeの最古タブ＝Phase39調査で確認済みの下限）〜
  平成30年（2018年、令和境界の直前）。平成元年（1989年）〜平成11年（1999年）の個別年タブは
  See.exe上に存在しないため（root タブの最古が「平成12年～平成14年」）、コード上は理論上
  対応しているが実データでの確認はできていない（3節参照、5.1節unresolvedにも記載）。
- 会期一覧（`listSessionsForYear`）・本会議日一覧（`listMeetingDays`、正規表現は既存のまま
  無改修で動作、Phase45-47で確認済み）・発言セグメント一覧（`listSpeakerSegments`）・
  本文抽出（`fetchSegmentText`/`parseSegmentTextHtml`）は、Phase45-47で既に平成期の実データ
  （矢野戦一郎議員・後藤哲朗議員の質問全文）で動作確認済みであり、本タスクでは変更していない
  （既存のまま平成期にも通用することが既に実証されている）。
- Phase57・58は、`resolveYearTreedepth({code, year})`・`listSessionsForYear({code, year})`・
  `fileNameToIsoDate(fileName)`に**平成期の西暦年（2000〜2018年）をそのまま渡せば**、令和期と
  同じ呼び出し方で正しい結果が得られる状態になっている。

---

## 6. 終了時報告

- **対応年度範囲**：
  - **before**（変更前）：令和期のみ（西暦2019年〜2026年、JSDoc記載は「令和5年〜令和8年の
    範囲で動作確認済み」）。平成期を渡すと、`parseYearRange`が正規表現不一致で`null`を返し、
    `resolveYearTreedepth`が最終的に`throw`する状態だった。
  - **after**（変更後）：令和期（2019〜2026年、挙動完全に同一）＋平成期
    （2000〜2018年を実データ確認、コード上は1989〜2018年に対応）。
- **parser regression件数**：**0件**（2節のfixtureテストで令和8年分・40項目のうち令和関連の
  全アサーションが変更前と完全一致することを確認。`npm run validate:data`のerrors=0・
  warnings=15も本タスク実施前と完全に同一）。
- **warnings**：
  1. 2019年（令和元年/平成31年境界）は1つの暦年が2つの個別年タブに分かれており、
     既存の`resolveYearTreedepth(2019)`は`令和元年`のみを指す（`平成31年`＝2019年1〜4月分には
     到達できない）。本タスクでは令和ロジックを変更していないため意図的に未対応のまま
     残した。Phase57・58で2019年1〜4月分を扱う場合は別途の対応が必要（3.1節）。
  2. 平成元年（1989年）〜平成11年（1999年）は、コード上は`ERA_CONFIG`により理論上対応して
     いるが、See.exeの最古タブが「平成12年～平成14年」（2000〜2002年）であるため、
     この範囲の個別年タブの存在・ラベル書式は実データで確認できていない（Phase39調査の
     既存知見と整合。仮に将来1999年以前を扱う場合は、まず該当年タブの実在を確認すること）。
  3. `classifySpeakerLabel`の`normalizeSpeakerName()`（助役ラベルの氏名部分抽出）は
     変更していない。「助役（氏名）」形式は既存の括弧内抽出ロジックでそのまま氏名部分のみ
     抽出される（動作に問題はないが、`isOfficialLabel`判定リストに「助役」は含まれていない
     点は今後の参考情報として記録する）。
  4. Phase45-47で作成された候補レコード（矢野戦一郎議員・後藤哲朗議員、
     `reports/phase45-47-general-questions-findings.json`）は、本タスクで
     `scripts/lib/minutes-source.mjs`の平成対応が完了したことにより、`requiresBeforeMerge`
     に記載されていた「平成対応パッチ実装」の前提条件が満たされた。ただし`memberId`未解決
     （矢野戦一郎・後藤哲朗ともに現行`members.json`/`formerMembers.json`に一致なし）は
     未解決のままであり、マージにはPhase57以降での別途対応が必要。
