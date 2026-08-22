# Phase32：全「確認中・未確認・reference_pending」総点検（Priority A）

作成日：2026-08-22
対象期間：1933〜2026年（新しい年代への調査拡大は行わない）
範囲：**Priority A（歴代市長・助役・副市長・収入役・教育長・議長／副議長・市長選挙・市議選・財政年度欠落・mayorId/mayorTermId整合性）を完了。Priority B・Cは軽量パスにとどめた（詳細はPhase32後半セクション参照）。**

## 0. 開始時基準値

機械的な文字列カウントではなく、各ドメインの実データを確認したうえでの集計（2026-08-22時点）。

| 分類 | 件数／状態 |
|---|---|
| 歴代市長（archiveMayorTerms.json） | 30任期レコード、mayorId重複・矛盾なし。日単位未確認の空白13件（validate:dataの既知WARN、戦前・戦中中心） |
| 助役（citySpecialPosts.json role=assistant-mayor） | 8件登録（初代〜5代：1933-1948、14代・15代：1971-1983）。**6〜10代（1946年ごろ〜1960年ごろ）は氏名のみ確認・日付未登録。13代（房野博）はmayor-11との同一人物性が未確定のため未登録。16代（三樹博）は姓が未確認のため未登録。** |
| 副市長（citySpecialPosts.json role=deputy-mayor） | 9件登録（2006年〜現職まで） |
| **助役→副市長 間の空白** | **1983年（16代・三樹博、至現在＝1983年刊行時点）〜2006年（杉本隆晴、csp-35）の間、citySpecialPosts.jsonに助役／副市長の登録が1件もない（約23年分の空白）** |
| 収入役（citySpecialPosts.json role=treasurer） | 3件登録（7〜13代：1951-1978）。**1〜6代（1933-1951年ごろ）、14代以降（1978-2007年ごろ）は未登録** |
| 会計管理者（収入役の後継制度、2007年〜） | **CitySpecialPostRole型に会計管理者の役職値そのものが存在しない（スキーマ上の欠落）** |
| 教育長（citySpecialPosts.json role=superintendent） | 4件登録、いずれも2010年以降。**1933〜2009年は0件（約77年分が未着手）** |
| 議長・副議長 | **横断的な「歴代議長」専用データファイルが存在しない**。civicTimelineEvents.jsonに1970年代の議長4名（松崎光行・黒木定夫・酒井正喜・佐藤済）のみ個別登録。副議長は0件（1933〜2026年通じて）。現職の議長・副議長は議員プロフィール文（members.json）内に文章として記載されるのみで、構造化データではない |
| 市長選挙（electionResults.json） | 1933〜2026年、市議会による間接選出時代を含め連続して登録済み。矛盾なし |
| 市議選（electionResults.json） | 「延岡市議会議員選挙」「延岡市議会議員補欠選挙」の型でデータ存在を確認。年代別の網羅性は今回は個別監査していない（Priority Bへ） |
| 財政年度欠落（archiveFiscalYears.json） | 登録範囲(1933〜2026)内で24年度が欠番。うち**9年度（FY1951・1952・1953・1959・1983〜1987）はreports/phase20-missing-years-status.jsonでreference_pendingとして能動的に追跡中**。**残り15年度（FY1934〜FY1948）は同ファイルに未登録＝ステータスが一切割り当てられていない状態を新規発見した**（「0件」でも「reference_pending」でもない、無追跡の欠落） |
| mayorId／mayorTermId整合性 | 今回の監査で新たな不整合は発見しなかった |

## 1. Priority A：財政年度欠落の再確認（FY1951・1952・1953・1959）

`reports/phase20-missing-years-status.json`を確認したところ、4年度とも引き続き`reference_pending`（照会文完成・未送付、Phase29-30で照会文を完成させたが実送付はユーザー〈人間〉が行う運用のまま）だった。過去に使用済みの検索ルート（延岡市決算書並意見書R1、市政二十年史R2、地方財政統計年報R5等）を再度機械的に繰り返すことはせず、新しいオンライン一次資料の有無のみ確認したが、発見できなかった。**ステータスは変更していない**（新しい一次資料がなければreference_pendingを解除しない、という既存方針を継続）。

## 2. Priority A：新規発見 — FY1934〜1948（15年度）の無追跡状態

`archiveFiscalYears.json`の欠番リスト（validate:dataのWARN）には1934〜1948年度が含まれているが、`reports/phase20-missing-years-status.json`（財政欠落年度の追跡台帳）にはFY1951以降の9年度しか登録されておらず、**戦前・戦中・戦後直後にあたるこの15年度は、そもそも追跡対象にすら入っていなかった**。これは「0件」でも「確認済みreference_pending」でもない、第三の状態（未着手・無追跡）であり、今回のPhase32監査で新たに可視化した。

具体的な資料候補（延岡市統計書・市政二十年史・宮崎県統計年鑑等）は年度によって異なる可能性が高く、現時点で確定した候補資料を持たないため、本ファイルへの安易な追加登録（推測での資料候補記入）は行わなかった。**次フェーズで、この15年度を対象とした資料候補調査を新規に行うことを推奨する。**

## 3. Priority A：折小野良一氏の代数問題

`reports/phase28-election-personnel-investigation.md`等、過去phaseの記録を確認したところ、折小野良一氏（mayor-10）の代数表記について、延岡市史上巻の市長選挙一覧表・歴代市長一覧表と、延岡市公式年表側の表記に不一致がある可能性が指摘されていた記録は、今回の監査範囲では**具体的な「第十一・十二代」vs「第12代・第13代」という不一致の再現を確認できなかった**（archiveMayorTerms.jsonのmayor-10-term-01/02のtermNumberはいずれも1・2〈個人の期数〉であり、延岡市通算代数〈市長職の何代目か〉とは別の数え方で登録されている）。この「個人の期数」と「延岡市長職の通算代数」を区別する設計は、既存のmayor-11（房野博）のsourceRefsに「第15代（term-02）再選」という注記がある通り、既にプロジェクトの設計として意識されていることを確認した。したがって、今回**新たな矛盾は発見されなかった**が、UI上でこの2つの数え方（個人の期数／延岡市長職の通算代数）を混同しないような表示になっているかは、別途UI監査（Phase31のUI総点検の範囲）で確認する事項とする。

## 4. Priority A：外部照会案件（INQ-001〜009）の状態確認

`reports/phase21-inquiry-tracker.json`を確認した。

| ID | status |
|---|---|
| INQ-001 | waiting（送付済み、回答待ち） |
| INQ-002 | waiting（送付済み、回答待ち） |
| INQ-003〜009 | draft（未送信） |

**実際に送信していないものをsentへ誤って変更している事例は無かった。** 送信済み2件（INQ-001・002）は既に前フェーズで実際に送付されたもので、今回新たに送信したものはない。

## 6. Priority B（一般質問・議案・条例・請願・陳情・委員会・人物経歴）

Priority Aと異なり、この領域はすでに専用の追跡インフラが整備されていることを確認した。

- **一般質問**：`src/data/councilSpeechSummaries.json`に36名分・398件の発言データが構造化済み。会議録は存在するがDB化されていない案件は、`src/data/blockedTaskClassification.json`で個別追跡されている（後述）。
- **議案・条例・請願・陳情・委員会**、その他の「会議録公開待ち」案件は、`src/data/blockedTaskClassification.json`（15件）で以下のように分類済み：

  | ステータス | 件数 | 意味 |
  |---|---|---|
  | MANUAL_REVIEW | 8 | 人手による追加調査が必要 |
  | WAITING_EXTERNAL | 2 | 公式資料の公開待ち（GitHub Actionsの日次自動巡回で会議録公開時に自動反映） |
  | RESEARCH_EXHAUSTED | 2 | 調査を尽くしたが未確認（資料不存在の確定ではない） |
  | COMPLETED | 3 | 解決済み |

  各タスクにはblockedReasonCode（例：SOURCE_NOT_PUBLISHED）・lastCheckedAt・attemptCount・autoRecheckMechanismが付与されており、推測での分類がないことをnotesで明示する設計が既に確立されている。**Priority Bとして新たに整理すべき「未構造化の一般質問」は、この既存インフラの外に漏れているものは今回発見しなかった。**
- 「0件」と「未収録」の区別：`src/lib/completeness.ts`のCompletenessStatus語彙（confirmed_zero／not_collected／under_review／unavailable等7区分）が既にDataStatusPage.tsx等で一貫して使われていることをPhase31（UI総点検）で確認済み。今回のPhase32範囲では、この語彙から漏れて「0件」とだけ表示されている箇所は新たに発見しなかった。

## 7. Priority C（出典メタデータ・リンク切れ・ページ／コマ不足）

こちらも既存の自動監査インフラ（`scripts/generate-quality-summary.mjs`、`validate:sources`）がビルドのたびに実行されており、`src/data/dataQualitySummary.json`として常時最新化されている。

- 出典不足（sourceHealth）：errors=0、warnings=15（出典タイトル欠落等の改善余地）、info=65（二次資料・Wayback経由公式資料の使用通知、異常ではない）
- リンク切れ（linkHealth）：677件中11件が404等（現行サイトで使用中のデータのみ対象）。個別のURL・該当ファイルは`dataQualitySummary.json`のlinkHealth.brokenに既に記録されている
- 件数不整合チェック：1件（2026-08-17に修正済み、既知の問題は解消済み）

これらは既に自動化された継続監査であり、Phase32として新たに手作業で洗い出す必要のある項目は、今回の範囲では発見しなかった。**Priority Cの主要な成果は「既存の自動監査が正しく機能していることの再確認」である。**

## 5. Priority A checkpoint

以上の監査結果に基づき、以下をsrc/dataへ反映するかどうかを検討したが、**新たなsrc/dataの変更は行っていない**（今回のPriority A監査は「発見・可視化」が中心であり、推測に基づく新規登録は行わないため）。上記の発見事項（助役・副市長間の空白、収入役スキーマの欠落、教育長の大規模空白、議長／副議長の構造化データ不在、FY1934〜1948の無追跡状態）は、いずれも本レポートに記録し、次フェーズの優先候補とする。
