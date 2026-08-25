# UNR優先順位付け一覧（Phase136）

作成日: 2026-08-25

## 本ファイルの位置づけ

`reports/phase33-master-unresolved-ledger.json`（UNR-001〜UNR-031、**31件**）の各項目へ、既存の記載内容（primaryRoute・status・notes等）から読み取れる範囲で優先順位・影響範囲・調査手法・対象機関・想定難易度・期待される証拠・依存関係を付与し、次に着手すべき順序を整理したものである。

- **新規のオンライン検索・WebFetch・WebSearchは一切行っていない。**
- 既存の `reports/phase33-master-unresolved-ledger.json` の `status` 等は変更していない（本ファイルは別ファイルとして新規作成）。
- 機械可読版: `reports/field-research/unr-priority-master.json`

### 件数についての前提

ユーザーからは「UNR131件」と案内されたが、`reports/phase33-master-unresolved-ledger.json` を実際に集計すると **31件**（UNR-001〜UNR-031）である。推測で件数を水増しせず、実在する31件を対象とした。参考情報として `src/data/blockedTaskClassification.json`（15件、BLOCKEDタスク）も本ファイル末尾に整理し、対応関係が既存資料から読み取れるもののみ紐付けた。

## 優先度の定義

| 優先度 | 定義 |
|---|---|
| **A1** | サイト主要数値・人物・任期に直接影響（市長選挙結果、歴代特別職〔副議長・教育長・収入役・助役〕の氏名任期、財政欠落年度、市長任期空白、議案賛否の出典欠落など） |
| **A2** | 重要な歴史データに影響（コア機能を側面支援する構造的ボトルネックの解消・財政データの補完的拡張など） |
| **B** | データ品質向上（スキーマ整備、表記整合性、重複解消、補助的な人物データ等） |
| **C** | 補足・将来拡張（人口・面積の時系列拡充、確報待ちなど） |

## 優先度別内訳

| 優先度 | 件数 | UNR ID |
|---|---|---|
| A1 | 17 | UNR-001, 002, 003, 004, 005, 006, 008, 009, 010, 011, 014, 015, 016, 028, 029, 030, 031 |
| A2 | 3 | UNR-023, 026, 027 |
| B | 8 | UNR-007, 012, 013, 017, 018, 019, 022, 025 |
| C | 3 | UNR-020, 021, 024 |
| **合計** | **31** | |

## 調査手法（researchMethod）別内訳

| 手法 | 件数 |
|---|---|
| LIBRARY_COPY_REQUEST | 13 |
| EMAIL_INQUIRY | 8 |
| NDL_ONSITE | 8 |
| PHONE_INQUIRY | 8 |
| FIELD_VISIT | 7 |
| WAITING_RESPONSE | 1 |
| INFORMATION_DISCLOSURE | 0 |
| （新規外部調査不要・内部作業のみ） | 12 |

※複数手法が該当する項目があるため、手法別件数の合計は31件を超える。

## A1優先度クラスター（特に高優先度と明示された項目）

1. **財政欠落24年度**（UNR-014・UNR-015） — 財政ダッシュボードの長期・中期時系列に直接影響
2. **市長任期空白13区間**（UNR-029） — 1937〜1994年に分散する13区間の日単位就任・退任日が未確定
3. **歴代特別職の根拠不足**（UNR-005副議長・UNR-006教育長・UNR-008収入役後任・UNR-009助役6-10代・UNR-010助役/副市長空白・UNR-011収入役1-6代）
4. **市長・市議選挙結果**（UNR-001〜004市長選挙・UNR-016市議選挙、1933-1998年）
5. **歴代議員データベースの欠落**（UNR-028、中井一萬氏の人物特定）
6. **議案・財政の重要な出典欠落**（UNR-030財政調整基金＝解決済み記録・UNR-031議案別賛否の構造的ギャップ）

## 全件一覧

### A1（17件）

| UNR ID | カテゴリ | 影響範囲（要約） | 対象機関 | 難易度 | ステータス（既存維持） |
|---|---|---|---|---|---|
| UNR-001 | election | 1975年市長選挙の対立候補氏名2名が未確定 | 延岡市選挙管理委員会 | 中 | disputed |
| UNR-002 | election | 1978年市長選挙の候補者数・対立候補氏名が未確定 | 延岡市選挙管理委員会 | 中 | disputed |
| UNR-003 | election | 1982年市長選挙の候補者数・対立候補氏名が未確定 | 延岡市選挙管理委員会 | 中 | disputed |
| UNR-004 | election | 4回の市長選挙の候補者別得票数・無効票数が未確認 | 延岡市選挙管理委員会・宮崎県選管 | 中 | unconfirmed |
| UNR-005 | person | 歴代副議長（1933-2026年）の構造化データが皆無 | NDL・延岡市議会事務局 | 高 | unconfirmed |
| UNR-006 | person | 教育長の氏名・在任期間が約70年分空白 | 延岡市教育委員会 | 高 | partially_resolved |
| UNR-008 | person | 1978年以降の収入役後任者氏名が未確認 | 延岡市議会事務局・NDL | 中 | partially_resolved |
| UNR-009 | person | 助役6-10代の就任・退任日が未確認 | NDL（既到達） | 中 | unconfirmed |
| UNR-010 | person | 助役/副市長1983-1991年の空白（8年間） | 延岡市史所蔵図書館 | 中 | partially_resolved |
| UNR-011 | person | 収入役1-6代の氏名・任期が皆無（Level0） | NDL（既到達） | 中 | not_collected |
| UNR-014 | finance | 財政欠落15年度（FY1934-1948）が無追跡状態 | 宮崎県文書センター | 中 | reference_pending |
| UNR-015 | finance | 財政欠落9年度（FY1951-53,59,83-87） | 図書館・宮崎県文書センター | 中 | reference_pending |
| UNR-016 | election | 市議選（1933-1998年、推定300-600候補者）未収録 | 延岡市選管・図書館 | 高 | not_collected |
| UNR-028 | generalQuestions | 「中井一萬」議員が人物DBのいずれにも不一致 | 延岡市選挙管理委員会 | 中 | unconfirmed |
| UNR-029 | mayor | 市長任期13区間の日単位就任・退任日未確定 | NDL・国立公文書館 | 高 | partially_resolved |
| UNR-030 | finance | 財政調整基金の複数年度同一値疑い（解決済み） | ― | 低 | resolved |
| UNR-031 | bills | 議案別個人賛否のカバレッジが1177件中2件のみ | 延岡市議会会議録検索システム | 高 | partially_resolved |

### A2（3件）

| UNR ID | カテゴリ | 影響範囲（要約） | 対象機関 | 難易度 | ステータス |
|---|---|---|---|---|---|
| UNR-023 | generalQuestions | 平成年代（2000-2019年）一般質問backfillのparser拡張（実装済み・会期メタデータ整備待ち） | 会議録検索システム（既到達） | 中 | reference_pending |
| UNR-026 | schema | councilSessions.jsonの平成年代会期レコード欠落（大部分解決済み） | ― | 低 | resolved |
| UNR-027 | finance | FY1960-1988の市債・基金等がオンライン経路尽きた状態 | 延岡市立図書館・宮崎県立図書館 | 高 | reference_pending |

### B（8件）

| UNR ID | カテゴリ | 影響範囲（要約） | 対象機関 | 難易度 | ステータス |
|---|---|---|---|---|---|
| UNR-007 | person | 早生隆彦氏（mayor-12）の生年月日未確定 | 宮崎県立図書館 | 高 | unconfirmed |
| UNR-012 | schema | 会計管理者の役職値がCitySpecialPostRole型に無い（データ待ち） | ― | 低 | not_collected |
| UNR-013 | person | 折小野良一氏の代数表記の資料間相違（任期自体は確定済み） | NDL | 中 | under_review |
| UNR-017 | schema | 議長・副議長の役職値がCitySpecialPostRole型に無い（データ待ち） | ― | 低 | not_collected |
| UNR-018 | finance | 地方債現在高FY2011-2017（解決済み） | ― | 低 | resolved |
| UNR-019 | finance | 市債・地方債データFY1990-2000（解決済み） | ― | 低 | resolved |
| UNR-022 | bills | H27-30年度22会期の議案番号復元（可決・否決結果は登録済み） | 会議録検索システム（既到達） | 高 | not_collected |
| UNR-025 | dataQuality | generalQuestions.jsonとcouncilSpeechSummaries.jsonの重複 | ― | 低 | under_review |

### C（3件）

| UNR ID | カテゴリ | 影響範囲（要約） | 対象機関 | 難易度 | ステータス |
|---|---|---|---|---|---|
| UNR-020 | population | 住民基本台帳人口・世帯数・面積の時系列がスキーマに無い（データ抽出済み・反映待ち） | ― | 低 | reference_pending |
| UNR-021 | population | 令和7年国勢調査の確報未公表（速報値は確認済み） | 総務省統計局 | 低 | reference_pending |
| UNR-024 | schema | formerMembers.jsonの構造化フィールド不足 | ― | 中 | not_collected |

## 参考情報: BLOCKEDタスク台帳との対応関係（src/data/blockedTaskClassification.json、15件）

新規調査は行わず、既存の `blockedTaskClassification.json` 15件を、対応関係が読み取れる範囲でUNRに紐付けた。

| Task ID | ステータス | 対応するUNR | 備考 |
|---|---|---|---|
| TASK-004 | WAITING_EXTERNAL | ― | 令和8年5月臨時会・6月定例会の会議録未公開待ち。billVotes24件（UNR-031とは別枠） |
| TASK-011 | COMPLETED | ― | 全国報酬比較データ投入済み |
| TASK-012 | COMPLETED | ― | 類似団体報酬比較データ投入済み |
| TASK-016B | WAITING_EXTERNAL | ― | 市長後援会R7分収支報告書、選管公表待ち |
| TASK-023 | COMPLETED | ― | FAQ構造化データは実装見送りで確定 |
| TASK-032 | MANUAL_REVIEW | ― | 現職議員8名の経歴データ、選挙公報でも未確認 |
| TASK-045 | MANUAL_REVIEW | UNR-029 | 歴代市長任期空白13件のNDL調査、ログイン必須 |
| TASK-046 | RESEARCH_EXHAUSTED | UNR-016 | 1999年より前の市議選候補者別結果、オンライン経路を尽くした |
| TASK-047 | RESEARCH_EXHAUSTED | ― | koho-2010-04号PDFの構造破損（配信元の長期破損） |
| TASK-074 | MANUAL_REVIEW | UNR-005, 006, 008, 009, 011, 029 | 歴代市長・特別職データのNDL調査、ログイン必須 |
| TASK-101 | MANUAL_REVIEW | UNR-005, 016 | 過去の市議会（会議録・議会だより・歴代議長副議長）NDL調査 |
| TASK-102 | MANUAL_REVIEW | UNR-014, 015, 027 | 財政資料（昭和期まで遡及）NDL調査 |
| TASK-103 | MANUAL_REVIEW | UNR-001〜004, 016, 020 | 選挙資料・人口統計NDL調査、claude-in-chrome未接続で着手不可 |
| TASK-104 | MANUAL_REVIEW | ― | 広報のべおかNDL調査（号別台帳化） |
| TASK-105 | MANUAL_REVIEW | UNR-005, 006 | 新聞・特別職・旧町村合併資料NDL調査、claude-in-chrome未接続で着手不可 |

## 分類方針についての補足

`priority` は `reports/phase33-master-unresolved-ledger.json` の既存 `priority` フィールド（A/B/Cの3段階、routeベース）を出発点とし、Phase136の指示に従いA1/A2/B/Cの4段階へ再分類した。

- **UNR-016・UNR-028・UNR-029** は既存ledgerでは優先度C/C/Cだったが、それぞれ「市長・市議選挙結果」「歴代議員データベースの欠落」「市長任期空白13区間」という、タスク指示で明示された高優先度カテゴリに該当するためA1へ引き上げた。
- **UNR-012・UNR-017** は既存ledgerで優先度Aだったが、「データが揃うまでスキーマ変更を見送る」方針が既存notesに明記されており、新規の外部一次資料調査は不要な内部作業（他UNRのデータ確定待ち）であるため、Bへ整理した。
- 既存の `reports/phase33-master-unresolved-ledger.json` の `priority`・`status` 等は一切変更していない。

## 次のアクション（優先順）

1. A1のうち、既に照会文が完成している項目（UNR-001〜004＝INQ-006、UNR-007・UNR-014・UNR-015＝INQ-001/008等）を実際に送付する（Claude Codeからは送信しない、人手作業）。
2. A1のうち、NDLに既到達で精読のみで前進できる項目（UNR-005, 009, 011, 013）を優先的に再読する。
3. UNR-014（宮崎県文書センター、簿冊番号5043・107051を優先候補として指定済み）の閲覧・複写申請を進める。
4. A2の内部作業項目（UNR-023, 026）は開発タスクとして次フェーズのバックフィル作業に組み込む。
5. B・Cのスキーマ待ち項目（UNR-012, 017, 024）は対応する人物データ（UNR-005, 006, 008等）が確定した時点でまとめて実施する。
