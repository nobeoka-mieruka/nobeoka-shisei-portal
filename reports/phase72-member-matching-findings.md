# Phase72 一般質問・人物照合専任 調査報告

- 調査日：2026-08-21〜2026-08-23
- 対象：Phase67-71が生成する `B_member_mapping_pending`（`memberId: null` の一般質問候補レコード）を、
  `src/data/formerMembers.json`（58名）・`src/data/members.json`（現職26名）・`src/data/electionResults.json`
  （councilMember選挙10件：一般選挙7回＋補欠選挙3回、1999〜2023年）と照合する。
- 作業範囲：`src/data`配下は読み取り専用。本ファイルと`reports/phase72-member-matching-findings.json`
  以外は編集・作成していない。git commit / git push / ブラウザ操作は行っていない。
- 前提として参照：`reports/phase59-member-matching-findings.md`（confidence段階の原設計）、
  `reports/phase45-47-general-questions-findings.json`（候補レコードのスキーマ実例：
  `status: "candidate_pending_member_id_resolution"`、`memberId: null`）。

---

## 0. 実行開始時のPhase67-71成果物確認

作業開始時点（2026-08-23）で `reports/phase67-*` 〜 `reports/phase71-*` の
`*-findings.json` を確認したところ、**いずれも未生成**だった（Phase67-71は並行実行中で、
本ワーカー開始時点ではまだ成果物が出揃っていなかった）。既存の`reports/`一覧で
確認できた関連ファイルは以下のみ：

- `reports/phase59-member-matching-findings.md`（照合ロジックの原設計、既読）
- `reports/phase45-47-general-questions-findings.json`（先行パイロットの候補レコード実例、既読）
- `reports/phase66-integration-checkpoint.md`（Phase60-65統合チェックポイント、Phase67-71への直接言及なし）

このため、指示どおり前半をPhase59の照合ロジック精緻化（設計・準備）に充て、
Phase67-71成果物の出現をバックグラウンドで監視しながら並行して照合エンジンを構築した。
後半で成果物が出揃い次第、実際の照合作業を行う（本ファイルは後半で追記・更新する）。

---

## 1. 照合ロジックの精緻化（Phase59ベース）

### 1.1 Phase59からの主な変更点

Phase59（`reports/phase59-member-matching-findings.md` §1）の5段階confidence定義・
決定ルールをそのまま踏襲しつつ、以下を追加で精緻化した。

1. **表記ゆれの正規化を機械化**：旧字体・異体字（﨑→崎、髙→高、澤→沢、邊/邉→辺、齋/齊→斎/斉、
   櫻→桜、國→国、學→学 等）を変換テーブルで正規化した上で漢字完全一致を判定する。
   敬称（君・さん・氏・様）・全角/半角スペース・役職接頭辞（議員・委員）も除去する。
2. **かな正規化の機械化**：カタカナ→ひらがな変換、長音・ハイフンのゆれ吸収を行った上で
   `nameKana`一致を判定する。
3. **在籍期間の重なりを日付演算で自動判定**：`electionResults.json`から対象人物の
   `linkedProfileId`当選記録日を全件抽出し、「当選日 ～ 次回のcouncilMember選挙日
   （一般選挙・補欠選挙いずれも含む、全10回のデータを昇順ソートして使用）」を在職ウィンドウとし、
   会期ID（例：`2013-06`→近似日`2013-06-15`。sourceRefsに実日付があればそちらを優先）が
   ウィンドウ内かどうかを機械的に判定する。ウィンドウ外なら氏名が一致していても`medium`以下へ
   自動的に格下げする（Phase59 §1.3 ルール3をロジック化）。
4. **同姓同名リスクの機械検出を強化**：(a)候補記録の氏名正規化キーが`electionResults.json`上で
   複数の異なるかな読みに対応していないか、(b)確定したプロファイルと同一かな読みを持つ
   別プロファイルが`formerMembers.json`/`members.json`内に存在しないか、の両方を全件走査で検証する。
5. **「姓一致・名の読み未確認/名の漢字不一致」を独立した扱いとして新設（2系統）**：
   - **(a) 名がひらがな登録のみ（漢字未確定）**：Phase59の矢野戦一郎（fm49「矢野
     せんいちろう」）のように、既存プロファイル側の名がひらがな登録のみのケースは、
     漢字→読みの変換辞書を持たない機械的照合では、候補記録の漢字氏名の読みが本当に
     一致するかを証明できない。Phase59では人間（エージェント）が「戦一郎＝せんいちろう」
     という読みの一般常識・会議録原文のふりがな等から`high`と判定したが、これは機械照合の
     範囲を超えた人手判断である。今回のエンジンでは`surnameOnlyFallback`として明示的に検出し、
     自動では`low`（`B_confirm_needed`）にとどめ、候補プロファイルを提示した上で人手確認を
     要求する（`requiresHumanReadingCheck: true`）。対象になり得る5名（formerMembers.json内で
     名がひらがな登録のみ）：fm47「うちだ りさ」、fm49「矢野 せんいちろう」、fm55「上田
     みとし」、fm56「佐藤 つとむ」、fm57「高木 ますお」。
   - **(b) 姓は一致するが名の漢字が既存登録と異なる**：Phase59のfm04（三上毅／外部資料
     表記「三上武」）・fm10（本部仁俊／外部資料表記「本部泰俊」）と同型のneedsReviewパターン。
     `surnameKanjiMismatchFallback`として検出し、同様に`low`（`B_confirm_needed`）にとどめる。
   - 検証：`三上武`（fm04の外部資料表記）を候補として投入するテストで、エンジンはfm04を
     候補提示しつつ`low`にとどめ、`exact`への誤格上げをしないことを確認した（§1.3参照）。
6. **OCR誤認への配慮**：広報誌OCR由来の候補（`kohoOcrSearchIndex.json`等）を想定し、
   士/土、己/巳/已、白/百、未/末、ロ/口、干/千等の代表的なOCR混同ペアを記録した
   （自動置換は行わず、目視確認時の着眼点としてのみ使用する）。

### 1.2 confidence段階（Phase59を継承、判定ロジックを明文化）

| confidence | 判定条件（本エンジンでの機械判定基準） | 格上げ可否 |
|---|---|---|
| exact | 漢字完全一致（正規化後）が一意 **かつ** 在籍期間ウィンドウ内 **かつ** 同一かな読みの別プロファイルなし | `A_ready_for_merge` |
| high | 漢字は一致しない（またはelectionResults経由の代理一致）が、かな読みが一意 **かつ** 在籍期間ウィンドウ内 **かつ** 同姓同名候補なし | `A_ready_for_merge` |
| medium | 在籍期間ウィンドウ内、または`servedSessions`に会期が直接登録済みだが、同姓同名候補が存在する等の留保あり | `B_confirm_needed`（親エージェント確認） |
| low | 姓のみ一致・名の読み未確認（`surnameOnlyFallback`）、または在籍期間ウィンドウ外、または在籍期間データ自体が不明 | `B_confirm_needed`（親エージェント確認） |
| unresolved | 姓一致フォールバックを含めいずれの候補も見つからない | `B_confirm_needed`（新規追加要否を含め親エージェント確認） |

**厳守事項の再確認**：氏名一致のみでの自動確定は行わない。`exact`/`high`と判定した場合も、
在籍期間の裏付け・同姓同名リスクの不在確認を経た上でのみ`A_ready_for_merge`とする。
`medium`以下は本ワーカーの判断では確定させず、すべて親エージェント確認対象として分離する。

### 1.3 実装（設計検証用スクリプト）

上記ロジックをNode.jsスクリプトとして実装し、Phase59の既知2候補（矢野戦一郎・後藤哲朗）で
動作検証した（スクリプト本体はスクラッチパッド配下に置いており、リポジトリへは追加していない）。

- 後藤哲朗（2005-09、raw「後藤哲朗」）→ 自動判定：**exact**、`fm14`「後藤 哲朗」に一致。
  Phase59の人手判定（exact）と一致し、ロジックの妥当性を確認した。
- 矢野戦一郎（2013-06、raw「矢野戦一郎」）→ 自動判定：**low**（`surnameOnlyFallback`、
  候補プロファイル`fm49`「矢野 せんいちろう」を提示、`requiresHumanReadingCheck: true`）。
  Phase59では人手判定で`high`としているが、これは「戦一郎＝せんいちろう」という漢字の読みを
  人間が確認した結果であり、機械的な文字列比較だけでは`high`まで到達できないことを確認した
  （想定どおりの安全側の挙動。読みの確認自体は後半の実照合作業で人手により行う）。

この結果は、**機械照合エンジン単体では「名の一部がひらがな登録のみ」のケースを`high`まで
自動格上げしない**という安全側の設計が機能していることを示す。実際の照合作業では、
このように`low`+`requiresHumanReadingCheck`となった候補について、候補記録のsourceRefs
（会議録原文）や外部資料でふりがなを人手確認し、Phase59と同水準の判断基準で
`high`格上げの妥当性を個別評価する。

追加で、以下2種類の自己検証を実施した。

- **自己整合性チェック（formerMembers.json全58名）**：各人物の登録済み漢字氏名をそのまま
  候補として投入し、自分自身に戻るかを検証した。`servedSessions`に実データがある10名
  （fm01〜fm10）は全員`exact`で自分自身に一致し、在籍期間・`servedSessions`直接一致の
  両エビデンスも正しく生成された。`servedSessions`が空の48名（fm11〜fm58）は、
  会期情報がない自己テスト条件下では`low`にとどまった（Phase59 §4の「48名はmedium相当」という
  結論と整合する保守的な挙動であり、`exact`への誤格上げは1件も発生しなかった）。
- **既知の表記ゆれ誤爆防止チェック**：fm04の外部資料表記「三上武」（登録名は「三上毅」）を
  候補として投入したところ、`surnameKanjiMismatchFallback`によりfm04を候補提示しつつ
  `low`にとどめ、`exact`への誤格上げが発生しないことを確認した。

---

## 2. Phase67-71候補の実照合

### 2.1 分類スキームの確認

Phase70成果物（`reports/phase70-general-questions-2014-2016-findings.json`、2026-08-23出現）の
`summary.新規追加候補件数（分類別）`により、Phase67-71共通の分類スキームが以下の6区分で
あることを確認した：`A_ready_for_merge` / `B_member_mapping_pending` /
`C_source_verification_pending` / `D_parser_error` / `E_duplicate` / `F_unavailable`。
本フェーズの担当は`B_member_mapping_pending`区分の候補のみである。

### 2.2 Phase70（2014-2016年度）

`reports/phase70-general-questions-2014-2016-findings.json`を精読した。

- 候補3件（`m03-2014-09-09-ippan-shitsumon`、`m17-2015-09-08-ippan-shitsumon`、
  `m03-2016-09-06-ippan-shitsumon`）はいずれも`category: "A_ready_for_merge"`、
  `memberIdResolution.confidence: "exact"`で、**Phase70ワーカー自身が現職議員
  （`members.json` m03「上杉 泰洋」、m17「長友 幸子」）への氏名完全一致・同姓同名候補なしを
  確認済み**。
- **`B_member_mapping_pending`該当：0件**（`summary.新規追加候補件数（分類別）.
  B_member_mapping_pending: 0`、`memberMappingPendingCount: 0`と明記）。
- 本ワーカー（Phase72）としての追加照合の必要なし。ただし独自に以下を再検証した：
  - m03「上杉 泰洋」・m17「長友 幸子」とも`members.json`上に同一かな読みの別プロファイル
    （`formerMembers.json`含む）が存在しないことを、本エンジンの`homophoneRisk`チェック相当の
    手順（`formerMembers.json`58名・`members.json`26名の氏名正規化リストを目視・grep照合）で
    再確認した。該当なし。
  - Phase70の`warnings`に記載された「m17の会派表記『社民党市議団』と現行`factionId`
    （riltuken）の整合性」は、氏名・人物同定そのものの問題ではなく会派変遷の論点であるため、
    `B_member_mapping_pending`の対象外と判断した（本ワーカーの担当範囲外）。
- 結論：Phase70については親エージェント確認対象の新規候補なし。Phase70自身の`A_ready_for_merge`
  判定（exact）は、本エンジンの判定基準（漢字完全一致・同姓同名候補なし）と整合しており、
  追加の確認事項はない。

### 2.3 照合エンジンのバグ発見・修正（在職期間ウィンドウの計算誤り）

Phase69の`fm02`候補（次節2.5）を検証する過程で、§1で構築した照合エンジンに
**在職期間ウィンドウの計算バグ**を発見し、修正した。

- **バグ内容**：`nextElectionDateAfter()`が、councilMember選挙の**補欠選挙日も含めて**
  「次回選挙日」を計算していた。補欠選挙は欠員1議席のみを補充するものであり、
  他の在職議員の任期を打ち切るものではない（任期は4年固定で一般選挙でのみリセットされる）。
  この結果、2007年の一般選挙で当選した議員の在職ウィンドウ終了日が、本来の次回一般選挙
  （2011-04-24）ではなく、間に挟まる2010-01-24の補欠選挙に誤って設定され、2010年6月時点の
  会期が実際には在職期間内であるにもかかわらず「ウィンドウ外」と誤判定される事象が発生した。
- **修正**：`nextElectionDateAfter()`が参照する選挙日リストから、`electionResults.json`上の
  `id`に`byelection`を含む補欠選挙を除外し、一般選挙（`election-council-1999`/`-2003`/
  `-2007`/`-2011`/`-2015`/`-2019`/`-2023`の7回）のみを任期終了境界として使用するよう修正した。
  本人が補欠選挙で当選した場合の在職開始日としては、引き続き補欠選挙日を使用する
  （開始日と終了日境界の扱いを区別）。
- **影響範囲の確認**：修正前後でformerMembers.json全58名の自己整合性チェック
  （§1.3参照）を再実行し、`exact`/`high`の自己一致件数に変化がないこと（引き続き
  `servedSessions`実データを持つ10名が正しく`exact`で自己一致）を確認した。

### 2.4 Phase67（2000-2004年度）

`reports/phase67-general-questions-2000-2004-findings.json`を精読した。

- `candidatesByClassification.B_member_mapping_pending: 0`。本フェーズの担当候補なし。
- 参考：`warnings`に記載の`identifiedButNotProcessed`（氏名照合済み・本文未取得の6件：
  平田信広m20×2会期分、宮原則秋fm28、佐藤正人fm11、西原茂樹fm18の別会期分、山田良市fm24）は、
  氏名照合自体は完了済みで人物同定の課題ではなく本文未取得（コンテンツ完成度）の課題のため、
  `B_member_mapping_pending`の対象外と判断した（本ワーカーの担当範囲外）。

### 2.5 Phase68（2005-2009年度）

`reports/phase68-general-questions-2005-2009-findings.json`を精読した。

- `classification.B_member_mapping_pending: 1`件：**中井一萬（なかい かずかず、読み未確認）**、
  平成18年第21回定例会（2006-06-13、第2号、`order4`、`pos=10160`）で一般質問に登壇。
- **本ワーカーによる独立再検証**：
  - `electionResults.json`全39件（councilMember 10件含む全選挙種別）を「中井」姓の完全走査で
    再確認したところ、**1999年〜2023年の全councilMember選挙（一般選挙7回・補欠選挙3回、計10回）
    を通じて「中井」姓の候補者は1件も存在しない**ことを確認した（Phase68は1999/2003の2回のみを
    確認していたが、本ワーカーは全10回を再確認し、結論は変わらないことを検証した）。
  - `formerMembers.json`（58名）・`members.json`（26名）のいずれにも「中井」姓のプロファイルは
    存在しない。
  - 姓一致フォールバック（§1.1(5)(b)）も該当候補ゼロのため作動しない。
- **confidence: unresolved**（Phase59 §1.2の定義どおり、いずれのデータソースにも一致候補が
  見つからない）。`A_ready_for_merge`格上げは不可。**新規`formerMembers.json`エントリ追加の
  要否を含め、親エージェント確認対象**とする。
- 参考：Phase68自身は`fm57`（髙木益夫／既存登録「高木 ますお」）を`high`確信度で
  `A_ready_for_merge`済みとしている（矢野戦一郎fm49と同型の「名がひらがな登録のみ」ケース）。
  この判定はPhase68ワーカー自身が行ったものであり、`B_member_mapping_pending`区分の対象外
  （本ワーカーの担当範囲外）だが、§1.1(5)(a)の設計と整合する判定であることを確認した。

### 2.6 Phase69（2010-2013年度）

`reports/phase69-general-questions-2010-2013-findings.json`を精読した。

- `classification.B_member_mapping_pending`：1件（**佐藤誠、fm02候補、2010-06-16**）。
- Phase69の`reasonPending`：「fm02は`electionResults.json`上で2019年4月21日執行分の当選記録が
  1回のみ確認されており（fm02の`note`欄に『当選回数は2019年の1回のみ確認、それ以前の当選歴は
  資料未確認』と明記）、2010年6月時点の在職を示す独立証拠が存在しない」として、氏名完全一致・
  同姓同名候補なしにもかかわらず`B_member_mapping_pending`とした。

**本ワーカーによる独立再検証の結果、この判定を`A_ready_for_merge`（confidence: exact）へ
格上げすることを提案する。** 根拠：

1. Phase69の`reasonPending`は、fm02の**`note`欄の記述テキスト**（fm02登録当初、2019年選挙のみ
   確認した時点の記述）を根拠にしており、**`electionResults.json`の現在の内容を直接再照会して
   いなかった**。本ワーカーが`electionResults.json`を直接machine-readで全件走査したところ、
   fm02（佐藤誠）には`linkedProfileId: "fm02"`かつ`elected: true`の当選記録が
   **2007-04-22・2011-04-24・2015-04-26・2019-04-21の4回連続**で存在することを確認した
   （おそらく別フェーズ、Phase60系の選挙結果バックフィル作業で追加されたが、fm02の`note`欄への
   反映が漏れている）。
2. 4回分の年齢が51歳→55歳→59歳→63歳と、4年ごとに正確に+4歳で推移しており（一貫した
   単調増加）、氏名一致に加えて生年ベースの整合性という独立した裏付けがある（同姓同名の
   偶然の一致では説明しづらい）。
3. 2010-06-16（会期`2010-06`）は、2007-04-22当選〜2011-04-24（次回一般選挙）の在職ウィンドウ
   内に収まる（本ワーカーの照合エンジンで機械的に確認、§2.3のバグ修正後）。
4. 同姓同名リスク：`electionResults.json`の「佐藤」姓候補全件（1999〜2023年、一般選挙・
   補欠選挙とも）を機械的に再走査した結果、「さとうまこと」のかな読みを持つ候補は全期間を
   通じてfm02以外に存在しないことを確認した（佐藤正人=fm11「まさと」、佐藤道男=fm26
   「みちお」、佐藤大志=fm46「ふとし」、佐藤つとむ=fm56、佐藤裕臣=fm58「ひろおみ」は
   いずれも別の読み）。
5. これらは氏名一致のみに依拠した判断ではなく、独立した選挙結果データ（年齢推移・投票日・
   同姓同名走査）による裏付けがあるため、Phase59 §1.2の`exact`基準
   （漢字完全一致＋在職期間の重なり＋同姓同名候補なし）を満たすと判断する。

**残る留保事項（マージ担当者への申し送り）**：`formerMembers.json`のfm02`note`/`sourceNote`
欄は「当選回数は2019年の1回のみ確認」という記述のまま更新されておらず、`electionResults.json`
側の実データ（2007/2011/2015年の当選記録）と整合していない。本ワーカーは`src/data`を
編集していないため、`note`欄の更新は行っていないが、マージ担当者は`electionResults.json`の
現状を反映するようfm02の`note`/`sourceNote`テキストの更新を検討されたい（データそのものは
既に正しくリンクされており、プローズ記述のみが古いという状況）。

### 2.7 Phase71（2017-2019年度）

`reports/phase71-general-questions-2017-2019-findings.json`を精読した（Phase67-71全5ファイル出揃い、コーディネーターから正常完了の連絡：4件`A_ready_for_merge`、11件`C_source_verification_pending`、0件重複）。

- Phase71は他フェーズと異なり`classification`をトップレベルの分類集計として持たず、候補ごとに
  `classification`フィールドを付与する形式だった。全件を機械的に走査したところ、
  `classification: "A_ready_for_merge"`が4件（`flagshipCandidates_fullyStructured`）、
  `classification: "C_source_verification_pending"`が1グループ11件
  （`additionalIdentifiedQuestioners_notYetStructured.items`）で、**`B_member_mapping_pending`
  に該当する候補は0件**。
- `C_source_verification_pending`の11件は、いずれも`memberMappingConfidence: "exact"`が
  既に付与されており（`election-council-2015`当選記録との突合まで完了済み）、分類理由は
  「壇上質問・答弁本文（fetchSegmentText）が本Phaseのアクセス予算制約により未取得」という
  **コンテンツ完成度の問題であり、人物同定の問題ではない**。本ワーカーの担当範囲外と判断した。
- **独立再検証**：念のため、11件のうち氏名照合の根拠が薄いと見える3例（河野治満=m10、
  梶本英一=m09、北林幹雄=m11）について、`electionResults.json`の該当姓を機械的に再走査し、
  同姓同名リスクがないことを確認した。
  - 河野治満（m10）：「河野 はるみつ」（2007〜2023年、連続当選、`linkedProfileId: m10`）。
    2007年に落選した別候補「河野 広美」（かな：ヒロミ、`linkedProfileId: null`）が存在するが、
    読みが異なり同姓同名リスクなし。
  - 梶本英一（m09）：`electionResults.json`側の候補者名表記は漢字ではなく「かじもと 英一」
    （ひらがな姓）だが、`linkedProfileId: m09`で一貫しており、`members.json`側の登録
    （漢字「梶本 英一」）と矛盾しない。
  - 北林幹雄（m11）：「北林 みきお」（2015〜2023年、連続当選、`linkedProfileId: m11`）で
    一貫しており、同姓同名候補なし。
- 結論：Phase71については親エージェント確認対象の新規候補なし。

---

## 3. 終了時報告

### 3.1 Phase67-71の`B_member_mapping_pending`候補 総括

| Phase | 対象年度 | B_member_mapping_pending件数 | 本ワーカーの判定 |
|---|---|---|---|
| Phase67 | 2000-2004 | 0件 | 対象なし |
| Phase68 | 2005-2009 | 1件（中井一萬、2006-06-13） | **unresolved**（一致候補なし、親確認対象） |
| Phase69 | 2010-2013 | 1件（佐藤誠/fm02、2010-06-16） | **exact**（`A_ready_for_merge`へ格上げ提案） |
| Phase70 | 2014-2016 | 0件 | 対象なし |
| Phase71 | 2017-2019 | 0件 | 対象なし |

### 3.2 resolved件数（exact/high、`A_ready_for_merge`格上げ提案）：1件

- **佐藤誠（fm02）2010-06-16分**（出典：`reports/phase69-general-questions-2010-2013-findings.json`）。
  Phase69は`B_member_mapping_pending`としたが、`electionResults.json`を本ワーカーが直接
  再照会した結果、fm02の当選記録が2007/2011/2015/2019年の4回連続で存在し（年齢が4年毎に
  正確に+4歳で単調増加）、2010-06-16がその在職ウィンドウ内に収まること、および同姓同名候補が
  存在しないことを確認した。Phase59基準の`exact`（漢字完全一致＋在職期間の重なり＋同姓同名
  候補なし）を満たすため、`A_ready_for_merge`への格上げを提案する（詳細は§2.6）。
  **格上げの採否自体は親エージェント判断とする**（本ワーカーはPhase69ファイル・src/data配下を
  編集していない）。

### 3.3 親エージェント確認対象件数（medium以下）：1件

- **中井一萬 2006-06-13分**（出典：`reports/phase68-general-questions-2005-2009-findings.json`）。
  `electionResults.json`全10回（councilMember、一般選挙7回＋補欠選挙3回、1999-2023年）・
  `formerMembers.json`（58名）・`members.json`（26名）のいずれにも「中井」姓の候補が
  存在しないことを本ワーカーが独立に再確認した（Phase68は1999/2003の2回のみ確認していたが、
  本ワーカーが全10回に拡大して再確認し結論は変わらないことを検証した）。
  **confidence: unresolved**。新規`formerMembers.json`エントリ追加の要否を含め、親エージェントの
  判断が必要（詳細は§2.5）。

### 3.4 unresolved件数：1件（上記3.3の中井一萬と同一）

### 3.5 その他の重要な発見

1. **照合エンジンのバグ発見・修正**（§2.3）：在職期間ウィンドウの計算で、補欠選挙日を
   誤って任期終了境界に使用するバグを発見・修正した。修正がなければ佐藤誠（fm02）の
   2010-06-16分は誤って「在職期間外」と判定され続けていた可能性が高い。この知見は、
   今後、他フェーズが同様の在職期間判定ロジックを実装する際にも有用と考えられる。
2. **fm02のnote/sourceNoteテキストの陳腐化**：fm02（佐藤誠）の`formerMembers.json`上の
   `note`/`sourceNote`は「当選回数は2019年の1回のみ確認」という登録当初の記述のまま
   更新されておらず、`electionResults.json`側の実データ（2007/2011/2015年の当選記録、
   おそらくPhase60系の選挙結果バックフィル作業で追加）と不整合になっている。データ自体は
   既に正しくリンクされているため実害は限定的だが、プローズ記述の陳腐化は将来同様の
   誤判定を招くリスクがあるため、マージ担当者への申し送り事項とする。
3. **Phase68・69・71自身が行った`A_ready_for_merge`判定（fm57「髙木益夫」high、
   その他exact多数）は、本ワーカーの担当範囲（`B_member_mapping_pending`区分）外のため
   悉皆検証は行っていない**が、§1.1(5)の設計と照らして矛盾する判定は確認されなかった
   （抽出的に確認した範囲内）。

### 3.6 warnings

1. Phase69の`B_member_mapping_pending`判定（佐藤誠/fm02）は、`electionResults.json`の
   現状を直接再照会せず、`formerMembers.json`側の古い`note`テキストのみを根拠にしていた。
   同様のパターン（`note`欄が最新の`electionResults.json`の状態を反映していない）が
   他の未検証の元議員プロファイルにも存在する可能性があり、将来のデータ整合性監査で
   横断的に確認することを推奨する。
2. 中井一萬（Phase68発見）は、1999年〜2003年任期の`formerMembers.json`カバレッジに
   欠落がある可能性を示す発見であり、Phase29計画済みの現物資料調査（延岡市議会だより・
   議案書等）と連携した追加調査が望ましい。
3. 本ワーカーが設計・実装した照合エンジン（スクラッチパッド配下、リポジトリ外）は、
   `src/data`配下へは一切反映していない設計検証用ツールである。将来、同様の機械照合を
   継続的に行う場合は、`scripts/`配下への正式な実装（バグ修正済みロジックを含む）を
   別タスクとして検討する余地がある。
4. `A_ready_for_merge`への格上げ提案（佐藤誠/fm02）を含め、本ワーカーはいずれの
   ファイルへのマージ・編集も行っていない（`src/data`は読み取り専用として扱った）。
   実際のマージ作業・格上げの最終採否は、本報告を踏まえた人手／親エージェント判断が必要。
5. git commit / git push、ブラウザツールの使用はいずれも行っていない。
