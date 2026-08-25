# Phase120（旧称Phase62）一般質問データ監査・拡張 findings

作業日：2026-08-25
対象：`src/data/generalQuestions.json`、`src/data/councilSpeechSummaries.json`、
`src/data/councilSessions.json`、`src/data/questionCollectionStatus.json`、
`src/data/themes.json`、`src/lib/councilSpeeches.ts`、`src/lib/themeClassification.ts`、
`src/pages/GeneralQuestionsPage.tsx`、`src/pages/GeneralQuestionDetailPage.tsx`、
`src/pages/ThemesPage.tsx`、`src/pages/ThemeDetailPage.tsx`

## 0. 前提：ユーザー指示にあった数値の扱い

ユーザー指示にあった「13/13会期」「418登壇・1,567質問項目」は、指示より前の時点（2026-08-05
時点の`questionCollectionStatus.json`集計、または`docs/session-handoff.md`のTASK-054時点の
値）に基づく古い数値であり、その後の追加登録（例：稲田雅之議員 令和7年6月/令和6年12月/
令和6年6月/令和5年12月/令和5年6月分の追加が`verificationNote`に記録されている）で実数が
増えている。**本監査では推測で数値を合わせず、2026-08-25時点で実データを機械集計した値を
以下に記載する。**

## 1. 正確な現状件数（2026-08-25時点、機械集計）

用語を区別して集計した（混同しない）。

| 区分 | 定義 | 件数 |
|---|---|---|
| **登壇数**（確認済み・会議録ベース） | `councilSpeechSummaries.json`の`speeches`配列の要素数（議員1名×会期1回×質問区分（一般質問／代表質問／関連質問等）1回分の登壇） | **419件** |
| **質問項目数**（確認済み） | 上記419件の登壇に含まれる`questionItems`の合計 | **1,568件** |
| **発言件数**（`councilSpeechSummaries.json`の記録単位） | 上記「登壇数」と同一（このファイルの最小記録単位が1登壇＝1speechレコードのため） | 419件（登壇数と同義） |
| **会議録発言数**（公式会議録本文の個別発言・答弁の引用箇所） | このデータ構造では発言単位の生カウントは保持していない。各登壇の`summarySources`が会議録原文への直接URL（`GetText3.exe?...&pos=...`形式、質問・答弁それぞれ1件以上）を記録しているのみで、「会議録上の発言総数」として独立集計できる項目は無い（推測で件数を作らない） | 集計対象外（該当項目なし） |
| **質問通告書件数**（`generalQuestions.json`、質問通告書ベース） | 令和8年6月定例会の議員別質問通告書PDF登録数（Phase120で1件削除、詳細は2章） | **14件**（従来15件） |
| **質問通告書に基づく質問項目数** | 上記14件の`questionItems`合計 | **151件**（従来156件） |

答弁確認率（`questionAnswerLinkStatus`／`answerSummary`／`answerers`の充足率）：
confirmed=1,564件、partially-confirmed=4件（計1,568件、100%が何らかの形で対応関係を確認済み）。
`answerers`・`answerSummary`の欠落は0件（100%充足、TASK-054時点の記録と一致）。

## 2. 発見した重複・データ不整合とその対処

### 2-1.〔修正済み〕`generalQuestions.json`のgq2019-06-m01が`councilSpeechSummaries.json`と実質重複していた

- `generalQuestions.json`のgq2019-06-m01（稲田雅之、令和元年6月25日、質問項目5件、
  Phase23で追加）は、`notes`欄に「質問通告書ではなく実際の会議録での確認」と明記されており、
  同一議員・同一日付の登壇が`councilSpeechSummaries.json`側にも
  `m01-2019-06-25-ippan-shitsumon`として既に登録されていた（質問項目8件、
  質問・答弁の往復まで構造化済み、summarySourcesで会議録原文URLも確認可能）。
  両者は同一の実在イベントを指しており、5件の質問項目はいずれも8件側に含まれる部分集合
  だった（地域振興基金／地域電力会社／過疎法／森林環境税／観光資源調査の5テーマが完全一致）。
- `generalQuestionsPage.tsx`のセクション1見出しは「最新会期の予定質問項目（質問通告書ベース、
  会議録公開前）」であり、このレコードは`sourceType`こそ「議会会議録」だが、見出しの文脈
  （予定・未公開）とは矛盾する形でセクション1に混在していた。
- **対処**：Phase67-76以降に整備された、より完全な`councilSpeechSummaries.json`側の記録
  （質問・答弁の対応関係まで構造化済み）を正とし、`generalQuestions.json`からgq2019-06-m01を
  削除した。参照元を確認したところ、ライブページ・コンポーネント・
  `archivePolicyQuestionRelations.json`のいずれもこのIDを参照しておらず（`reports/`配下の
  過去監査ログのみが参照、これらは時点記録のため変更不要）、`src/data/searchIndex.json`のみ
  該当エントリを含んでいたため`npm run generate:search`で再生成し追随させた。
  `/questions/gq2019-06-m01`は404になるが、同一内容はより充実した形で
  `/members/m01/questions/m01-2019-06-25-ippan-shitsumon`から引き続き閲覧できる。
- 影響：`generalQuestions.json`は15件→14件（すべて令和8年6月定例会の質問通告書、
  `sourceType`は全件「質問通告書」に統一）。

### 2-2.〔修正済み〕`questionCollectionStatus.json`の登録件数が実データより古い（4会期で乖離）

- `questionCollectionStatus.json`は`generatedAt: 2026-08-05`時点のスナップショットのまま
  更新されておらず、その後`councilSpeechSummaries.json`（`generatedAt: 2026-08-23`）へ
  追加登録された分が反映されていなかった。`validate-data.mjs`は現状この2ファイル間の
  件数を突き合わせるロジックを持たない（スクリプト内コメントに「将来の拡張余地」と明記
  されており、既知の未実装）ため、既存のvalidate:dataでは検出されない不整合だった。
- 機械集計で突き合わせた結果、以下4会期で乖離を検出し、実件数へ更新した（このファイルの
  値はサイト表示には使われておらず【2-3参照】、実害は無かったが放置すると今後の判断材料が
  古くなるため修正した）。

  | sessionId | registeredSpeakerCount（旧→新） | registeredQuestionCount（旧→新） |
  |---|---|---|
  | 2023-06 | 14 → 15 | 96 → 101 |
  | 2023-12 | 14 → 15 | 116 → 122 |
  | 2024-06 | 15 → 16 | 136 → 142 |
  | 2025-03 | 12 → 14 | 102 → 106 |

  残り9会期（2023-09、2024-03、2024-09、2024-12、2025-06、2025-09、2025-12、2026-03、
  2026-06）は実件数と一致しており変更していない。`generatedAt`を2026-08-25へ更新し、
  乖離検出の経緯を`note`欄に追記した。

### 2-3. 参考：`questionCollectionStatus.json`の件数は公開ページの表示には使われていない

`src/lib/generalQuestionStats.ts`を確認したところ、サイト上に表示される「確認済み件数」
「質問項目数」（トップページ・一般質問データベース・データ収録状況ページ共通）は、
`councilSpeechSummaries.json`から都度ライブ集計しており、`questionCollectionStatus.json`の
`registeredSpeakerCount`/`registeredQuestionCount`は使っていない（同ファイルから使うのは
`sessionId`／`transcriptAvailable`／`generatedAt`のみ）。したがって2-2の乖離は表示不具合には
つながっていなかったが、管理用データとしての正確性のために修正した。

### 2-4. referential integrity・重複IDチェック（新規問題なし）

以下をスクリプトで機械監査し、いずれも0件（新規問題なし）だった。

- `councilSpeechSummaries.json`の全419speechIdの重複：0件
- 各speech内`questionItems`のid重複：0件（1,568件中）
- `memberId`が`members.json`/`formerMembers.json`のいずれにも存在しない参照：0件
- `sessionId`が`councilSessions.json`に存在しない参照：0件
- speech配下の`memberId`とレコード側`memberId`の不一致：0件
- 発言日付が対象`councilSessions.json`の`startDate`〜`endDate`範囲外（両方登録済みの
  20会期分で検証）：0件
- 同一議員×同一会期で複数speechレコードが存在する10件（例：m01|2025-03、m03|2026-03等）は
  すべて「代表質問＋一般質問」または「関連質問＋一般質問」など`speechType`が異なる正当な
  複数登壇であり、誤登録・重複ではないことを個別に確認した。

## 3. 会期カバー率（正確な分母分子、2区分で提示）

「会期」の母数の取り方が2通りあるため、混同しないよう分けて示す。

### 3-1. 現議員任期（`councilSpeechPeriod.json`基準：令和5年4月23日以降）

`questionCollectionStatus.json`が対象とする13会期（令和5年6月定例会〜令和8年6月定例会）
のうち：

- 会議録本文まで確認済み：**12/13会期**（令和8年6月定例会を除く全会期）
- 令和8年6月定例会（2026-06）：質問通告書は14議員分登録済み、
  「のべおか市議会だより」第108号で開催の事実は確認済みだが、公式会議録本文は
  本サイト確認時点（2026-08-15再確認）でまだ検索システムに掲載されておらず、
  「未収録」ではなく「確認待ち」として区別している。

### 3-2. 全収録対象（Phase67-76で2000年度まで拡大した範囲、定例会のみ）

`councilSessions.json`に登録済みの定例会48件のうち：

- 確認済み発言が1件以上ある会期：**46/48会期**
- 確認済み発言が0件の会期：**2件**
  - 2026-06（令和8年6月定例会）：3-1と同じ「確認待ち」（会議録未公開）
  - **2010-06（平成22年6月定例会）**：`councilSessions.json`上に会期自体は登録されている
    （第20回定例会）が、`documents`欄が空で、`councilSpeechSummaries.json`にも該当議員の
    登壇記録が1件も無い。理由を示す既存の調査メモは見当たらなかった（未公開資料か、
    単に未着手かを本監査だけでは判別できない）。**推測で「会議録なし」と断定せず、
    「原因未確認の欠落1件」として記録するに留める**（外部一次資料へのオンラインアクセスに
    よる新規調査は今回のタスク範囲では実施していない）。

### 3-3. Phase67-76より前（1999年度以前）への拡張

臨時会13件を除く定例会の最古登録は2000-09（平成12年9月）であり、これより前への拡張は
今回のセッションでは実施していない（`docs/session-handoff.md`に記載の通り、1990年代以前は
オンラインで確認できる一次資料がほぼ存在しないことが既存調査（TASK-073等）で確認済みであり、
本監査でも新たな反証は見つからなかった。物理資料調査以外での前進は見込みにくいという既存の
判断を追認する）。

## 4. テーマ分類の精度監査

### 4-1. 監査方法

`src/lib/themeClassification.ts`の`classifyTopicToThemeSlug`（`themes.json`の`keywords`への
部分一致、最初に一致したテーマを採用）を、`councilSpeechSummaries.json`の全419登壇・
279種類の生トピック文字列に対して手動ロジックで再実行し、割り当て結果を全件目視で確認した
（AIタグの再生成はせず、既存ロジックの出力を検証する形をとった）。

### 4-2. 結果：誤分類（wrong bucket）は0件

279種類の生トピックのうち132種類（分類イベント数で887件）が16テーマのいずれかへ分類され、
すべて意味的に妥当な割り当てだった（例：「高齢者運転免許自主返納」→福祉・介護、
「南延岡駅バリアフリー化」→道路・交通、「産業廃棄物」→環境・ごみ、
「都市公園」→都市整備など、キーワードと文脈が一致）。明らかな誤分類（無関係なテーマへの
割り当て）は確認されなかった。

### 4-3. カバレッジの限界（誤分類ではなく「未分類」の設計上の制約）

残り147種類（分類イベント数で457件、全体の約34%）は`themes.json`の16テーマいずれの
キーワードにも一致せず「未分類（unclassified）」となった。頻度上位は「行政運営」(45)、
「スポーツ」(27)、「コロナ対策」(26)、「国政・政治」(20)、「市長の政治姿勢」(17)、
「上下水道」(17)など。これは分類ロジックの不具合ではなく、**現行`themes.json`の16テーマ
（子育て・教育／福祉・介護／医療・健康／防災・消防／人口減少・移住／商工業・雇用／観光／
農林水産業／道路・交通／都市整備／環境・ごみ／財政・行政改革／デジタル化／市役所・職員／
地域コミュニティ／その他）が、行政運営・国政・スポーツ・上下水道・平和・人権といった
テーマ群を最初から対象としていない設計上の限界**である。「未分類」は
`themes.json`自身が「自動分類の対象語句に一致しなかった質問テーマ」として明記している
正規のカテゴリであり、`ThemesPage.tsx`でも「他の議員についても順次確認・追加します」等、
未確定であることを表示済みで、虚偽表示ではない。

ユーザー指示にあった横断テーマ例のうち「**空き家**」は、現行`themes.json`に対応する
キーワードが無く（3件のトピック「空き家」「避難所付近の空き家活用」はいずれも未分類側に
分類される）、新テーマの追加が必要になる。これは既存分類の「誤り」ではなく「未対応」であり、
`themes.json`へどのテーマ（都市整備寄りか地域コミュニティ寄りか等）へ統合するかは
設計判断を要するため、今回は**推測で追加せず**、今後の検討課題として記録するに留めた
（「問題があれば個別修正のみ行う」という作業方針において、これは個別のキーワード修正では
なく新規テーマ追加という設計変更にあたるため）。

### 4-4. `GeneralQuestionsPage.tsx`のテーマ絞り込みは`themes.json`を経由していない

一般質問データベースページ（`/questions`）の「テーマ」フィルタ（質問通告書セクション・
確認済みアーカイブセクションいずれも）は、`themes.json`の16分類ではなく、
各質問項目の生の`topics`文字列（279種類）をそのままドロップダウン選択肢にしている。
`/themes`ページ（16分類での横断表示）とは別設計であり、既存のコード上に明記された意図的な
仕様（`ThemesPage.tsx`のコメントで「試験公開中」と明記）であって、バグではない。
両方の絞り込みが実際に機能することをブラウザ相当のロジック確認（`filteredQuestions`／
`filteredVerifiedSpeeches`／`findSpeechesByThemeSlug`の絞り込み条件を読み解いて確認）で
確認した。壊れている箇所は見つからなかったため、コード修正は行っていない。

## 5. ページ動作確認（`GeneralQuestionsPage.tsx`／`GeneralQuestionDetailPage.tsx`／`ThemesPage.tsx`／`ThemeDetailPage.tsx`）

- `GeneralQuestionsPage.tsx`：質問通告書セクション（検索・議員・テーマ・年度・会議・
  質問区分の5フィルタ＋3種の並び替え）、確認済みアーカイブセクション（検索・議員・テーマ・
  年・会議・答弁者の5フィルタ＋20件ページング）ともにロジックを確認し、正常に機能する
  実装であることを確認した。修正不要。
- `ThemesPage.tsx`／`ThemeDetailPage.tsx`：`aggregateSpeechesByTheme`／
  `findSpeechesByThemeSlug`のロジックを確認し、16テーマそれぞれで会期・議員・発言を
  横断集計・絞り込みできる実装であることを確認した。修正不要。
- `GeneralQuestionDetailPage.tsx`：個別レコード表示ロジックを確認し、gq2019-06-m01削除に
  伴う参照切れが無いことを確認した（2-1参照）。修正不要。

大規模リライトは行っていない（今回の変更はデータファイル3件のみ、コンポーネント・ページの
コード変更は0件）。

## 6. 変更したファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/data/generalQuestions.json` | gq2019-06-m01（councilSpeechSummaries.jsonと重複）を削除。15件→14件 |
| `src/data/questionCollectionStatus.json` | 2023-06/2023-12/2024-06/2025-03の4会期の`registeredSpeakerCount`/`registeredQuestionCount`を実データへ更新。`generatedAt`・各`lastCheckedAt`・`note`を更新 |
| `src/data/searchIndex.json` | `npm run generate:search`で再生成（gq2019-06-m01のエントリ削除に追随） |
| `reports/phase119-123-staging/phase120-questions-findings.md` | 本ファイルを新規作成 |

コード（`.ts`/`.tsx`）の変更は無し。

## 7. 検証結果

- `node --experimental-strip-types scripts/validate-data.mjs`：**errors=0, warnings=40**
  （既存warningsと同数、新規warning無し。generalQuestions=14件と正しく反映）
- `npx tsc -b`：エラー無し（exit 0）
- `npx oxlint`：エラー無し（exit 0）
- `npm run build`：2240/2240ルート生成成功、`validate:seo`（failures=0, warnings=0）、
  `validate:content`（errors=0, warnings=0）すべて成功

## 8. 今後の課題（今回は着手しない、推測で埋めない）

1. `themes.json`に「空き家」等、現行16テーマでカバーされない頻出トピック（行政運営、
   スポーツ、コロナ対策、国政・政治、上下水道等）への対応要否の検討（新規テーマ追加は
   設計判断を要するため今回は見送り）。
2. 2010-06（平成22年6月定例会）に確認済み登壇が0件である原因の特定（未公開資料か未着手か
   の切り分けは今回できなかった）。
3. `validate-data.mjs`に、`questionCollectionStatus.json`の`registeredSpeakerCount`/
   `registeredQuestionCount`と`councilSpeechSummaries.json`実データの突き合わせチェックを
   追加すること（スクリプト内に既に「将来の拡張余地」と明記されている）。今回は手動検証に
   留め、恒久的な自動検知の追加は別タスクとして切り出す方が安全と判断した。
4. 令和8年6月定例会（2026-06）の公式会議録本文の公開監視を継続すること（既存の自動更新
   パイプラインが対象）。
5. 1999年度以前への収録範囲拡張は、既存調査（TASK-073等）の結論通りオンライン一次資料が
   乏しく、物理資料調査以外での前進は見込みにくい。
