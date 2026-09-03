# Phase205 次期改善対象の確定

生成日：2026-09-03（分析のみ。`src/data` 配下のデータは一切変更していない）

対象：`src/data/billVotes.json`（1,177件）／`src/data/mayorPromises.json`（14公約）／`src/data/mayorPromiseMeasures.json`（33施策）
機械可読版：`reports/phase205-bill-explanation-priority.json`／`reports/phase205-mayor-promise-linkage.json`

新規のオンライン調査は行っていない。既存データと既存レポートの集計・構造化のみ。

---

## A. 議案詳細説明

### 集計に使ったフィールドの定義

既存の `src/lib/billSummaryQuality.ts`・`src/lib/billSourceRetrieval.ts` の判定と同一の定義を使っている（Phase205で新しい判定基準は作っていない）。

| 呼び方 | 判定に使ったフィールド |
| --- | --- |
| 出典確認済み | sourceFilePath または sourceDocumentId のいずれかが存在する（審議結果PDF等が紐付いている）。src/lib/billSummaryQuality.ts の isSourceLinked と同一。 |
| 一次資料本文確認済み | sourceTextVerifiedAt が存在する（会議録等の本文を人が実際に確認した日付が記録されている）。同 isSourceTextVerified と同一。 |
| 詳細説明あり | summarySource === "manual" かつ reason / mainChanges（1件以上）/ citizenImpact のいずれかを保有する。同 hasCitizenSummary と同一（＝Level3）。 |
| 詳細説明なし | 上記『詳細説明あり』に該当しない議案（Level1＋Level2）。 |
| 原資料未確認 | sourceTextVerifiedAt が無く、かつ詳細説明も無い（＝Level1）。出典PDFは全件紐付いているため『出典が無い』という意味ではない。 |
| HUMAN_ACTION_REQUIRED | billVotes.json 内には該当フィールド・該当値は存在しない（0件）。人手対応の管理台帳は src/data/blockedTaskClassification.json 側にある。 |
| source不足 | transcriptUrl（会議録本文へのリンク）が未登録の議案。resultDocumentUrl（審議結果PDF）は全件登録済みのため、出典が皆無という意味ではない。 |

### 件数

| 項目 | 件数 |
| --- | --- |
| 議案総数 | 1177 |
| 出典確認済み | 1177（100.0%） |
| 一次資料本文確認済み | 775（65.8%） |
| 詳細説明あり | 622（52.8%） |
| 詳細説明なし | 555（47.2%） |
| 原資料未確認（Level1） | 402 |
| HUMAN_ACTION_REQUIRED | 0（billVotes.json 側には該当なし。管理台帳は `blockedTaskClassification.json`） |
| source不足（transcriptUrl未登録） | 284 |

説明段階（Level）の内訳：

| Level | 意味 | 件数 |
| --- | --- | --- |
| 0 | 出典未確認 | 0 |
| 1 | 議案名・議決結果・出典のみ（定型説明） | 402 |
| 2 | 一次資料本文を確認済み・独自説明なし | 153 |
| 3 | 一次資料本文に基づく説明あり | 622 |

### Priority A：一次資料本文確認済み ＋ 説明未作成（153件）

| 区分 | 件数 |
| --- | --- |
| NO_INDIVIDUAL_REASON_CONFIRMED | 151 |
| RECHECK_CANDIDATE | 2 |

**この153件は「説明を書き忘れている」案件ではない。**
151件は `verificationNote` に「会議録を確認したが、この議案固有の提案理由の記載は見当たらなかった」と明記されている。多くは市長が複数議案をまとめて一括で説明した会期のもの（例：「議案第八七号から第一〇二号……は、辺地に係る総合整備計画の変更であります」）で、一次資料に個別の材料が存在しない。ここへ説明文を新規生成することは推測の混入にあたるため行わない。

安全に前進できる方向は文章生成ではなく、**既に `verificationNote` へ引用済みの「共通の一括説明」を、出典付きの構造化フィールドとして表示すること**（「この議案は他のN件とまとめて説明されました。共通の提案理由は……」）。

残る 2件（`RECHECK_CANDIDATE`）は、本文確認の記録はあるが個別記載の有無について記述が無く、再確認の余地がある。ただし確認には会議録本文の再読（＝新規の一次資料調査）が必要なため、Phase205 では候補として記録するにとどめた。

- `2025-09-gian-50` 令和7年9月定例会 議案第50号 令和7年度延岡市水道事業会計補正予算（予算）／verificationNote 0文字
- `2021-06-gian-7` 令和3年6月定例会 議案第7号 令和3年度延岡市水道事業会計補正予算（予算）／verificationNote 68文字

カテゴリ内訳：その他 128 / 予算 18 / 条例 3 / 決算 2 / 契約 1 / 財産取得 1

### Priority B：一次資料あり ＋ 追加構造化が必要（174件、うち直ちに着手可 113件）

| 区分 | 件数 |
| --- | --- |
| TRANSCRIPT_LINKED_NOT_READ | 118 |
| HELD_RECORD_NOT_APPLIED | 56 |

- `HELD_RECORD_NOT_APPLIED`（56件）：Phase160 が会議録本文（`reports/phase160-held-for-future-56.json`）まで到達し、共通の一括説明文と会議録ファイル名まで引用済みでありながら、`billVotes.json` 側へ `sourceTextVerifiedAt` を書かずに保留した56件。**新規調査ゼロで前進できる唯一のまとまった候補**。ただし Level1→Level2 の件数が動くため、Phase162系の既存テストの期待値更新とセットでなければ実施できない。
- `TRANSCRIPT_LINKED_NOT_READ`（118件）：会議録リンクが既に登録済みで本文へ到達できるが、まだ読まれていない Level1。ただしこのうち人事案件（個人名を含む）と、市長提出でない議案（意見書・決議・請願・陳情・委員会提出）は、既存方針どおり自動処理の対象外。

### Priority C：原資料不足（228件）

| 区分 | 件数 |
| --- | --- |
| TRANSCRIPT_LINK_UNRESOLVED | 204 |
| MINUTES_NOT_PUBLISHED | 24 |

- `MINUTES_NOT_PUBLISHED`（24件）：令和8年度。会議録そのものが未公開で、TASK-004（`WAITING_EXTERNAL`）と同じ理由。日次の自動巡回で公開され次第反映されるため、人手の再調査では解決しない。
- `TRANSCRIPT_LINK_UNRESOLVED`（204件）：会議録自体は公開済みだが、この議案への個別リンクが未登録。**「原資料が存在しない」という意味ではない**（`billSourceRetrieval.ts` の注記のとおり）。

内訳合計の検算：153 + 174 + 228 = 555（＝詳細説明なし 555件、一致）

---

## B. 市長公約 → 予算 → 議案 → 成果（14公約）

### 状態名について

新しい status enum は導入していない。status は Phase166（`reports/phase166-mayor-promise-audit.json`）で既に使われている **confirmed / candidate / unconfirmed** をそのまま再利用した。

ただし既存の3値だけでは「関連議案が無いことを確認済み」と「まだ確認できていない」が同じ `unconfirmed` に潰れてしまうため、**unconfirmed の理由だけを `reasonCode` として補足**した。reasonCode は status を置き換えるものではない。

### 予算

| status / reasonCode | 件数 |
| --- | --- |
| NOT_IN_MAJOR_PROJECT_LIST | 8 |
| (confirmed) | 4 |
| WITHIN_EXISTING_OPERATING_COST | 1 |
| MULTI_YEAR_MULTI_BILL | 1 |

### 議案

| reasonCode | 件数 |
| --- | --- |
| NO_SEPARATE_BILL_LIKELY | 7 |
| BUDGET_BILL_INCLUDED | 4 |
| NOT_INTERPRETED | 1 |
| PENDING_FUTURE_BILL | 1 |
| CONFIRMED_RELATED_BILL | 1 |

**確認済みで「独立議案なし」と言えるのは `BUDGET_BILL_INCLUDED` の4件のみ。**
`NO_SEPARATE_BILL_LIKELY`（7件）は原文自身が「議案化を伴わない可能性が高いが、断定はしていない」と明記しているため、**「議案なしを確認済み」として扱ってはならない**（表示上も「確認中」側に置く）。
関連議案が確認できているのは1公約（2-3）のみで、登録議案は9件。

### 成果

| status / reasonCode | 件数 |
| --- | --- |
| (confirmed) | 12 |
| PLAN_ONLY | 1 |
| PREVIOUS_YEAR_ONLY | 1 |

### 公約別一覧

| 公約 | 予算 | 議案 | 成果 | 進捗 |
| --- | --- | --- | --- | --- |
| 1-1 家庭環境に関わらず、すべての子どもが延岡の自… | confirmed | BUDGET_BILL_INCLUDED | unconfirmed（PREVIOUS_YEAR_ONLY） | 進行中 |
| 1-2 子どもひとりひとりの理解度に合わせた学びを実… | confirmed | BUDGET_BILL_INCLUDED | confirmed | 進行中 |
| 1-3 市役所に「こども未来部」を設置し子育て支援を… | unconfirmed（WITHIN_EXISTING_OPERATING_COST） | PENDING_FUTURE_BILL | confirmed | 進行中 |
| 2-1 地域商社を設立し、延岡の優れた農林水産物の販… | confirmed | BUDGET_BILL_INCLUDED | confirmed | 検討中 |
| 2-2 愛宕山の魅力をさらに高めるカフェを誘致し、市… | confirmed | BUDGET_BILL_INCLUDED | confirmed | 検討中 |
| 2-3 アスリートタウン延岡アリーナや西階野球場を核… | unconfirmed（MULTI_YEAR_MULTI_BILL） | CONFIRMED_RELATED_BILL | confirmed | 進行中 |
| 3-1 診療所やクリニックの事業承継を支援し、地域の… | unconfirmed（NOT_IN_MAJOR_PROJECT_LIST） | NO_SEPARATE_BILL_LIKELY | confirmed | 進行中 |
| 3-2 津波対策と福祉避難体制を強化し、避難所環境の… | unconfirmed（NOT_IN_MAJOR_PROJECT_LIST） | NOT_INTERPRETED | confirmed | 進行中 |
| 3-3 豊富な経験を持つシニア世代が地域で力を発揮で… | unconfirmed（NOT_IN_MAJOR_PROJECT_LIST） | NO_SEPARATE_BILL_LIKELY | confirmed | 進行中 |
| 4-1 若手職員によるプロジェクトチームを発足します… | unconfirmed（NOT_IN_MAJOR_PROJECT_LIST） | NO_SEPARATE_BILL_LIKELY | unconfirmed（PLAN_ONLY） | 進行中 |
| 4-2 民間人材と市職員がチームを組む仕組みをつくり… | unconfirmed（NOT_IN_MAJOR_PROJECT_LIST） | NO_SEPARATE_BILL_LIKELY | confirmed | 進行中 |
| 4-3 市民が身近な場所で気軽に悩みを相談できる体制… | unconfirmed（NOT_IN_MAJOR_PROJECT_LIST） | NO_SEPARATE_BILL_LIKELY | confirmed | 進行中 |
| 4-4 北方・北浦・北川・島浦の支所に地域活性化専門… | unconfirmed（NOT_IN_MAJOR_PROJECT_LIST） | NO_SEPARATE_BILL_LIKELY | confirmed | 進行中 |
| 4-5 職員の多様な働き方を推進します。… | unconfirmed（NOT_IN_MAJOR_PROJECT_LIST） | NO_SEPARATE_BILL_LIKELY | confirmed | 進行中 |

### 次回重点調査すべき公約（優先度順）

| 優先度 | 公約 | 理由 | 併記事項 | 次に見るべき一次資料 |
| --- | --- | --- | --- | --- |
| 1 | 3-1 | relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。 | — | 令和8年度 延岡市予算に関する説明書（当初予算） |
| 1 | 3-2 | relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。 | 議案側も未整理（NOT_INTERPRETED）。議案検索で該当0件だが、議案が無い理由の整理が relatedBill 本文に記載されていない。 | 令和8年度 延岡市予算に関する説明書（当初予算） |
| 1 | 3-3 | relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。 | — | 令和8年度 延岡市予算に関する説明書（当初予算） |
| 1 | 4-1 | relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。 | — | 令和8年度 延岡市予算に関する説明書（当初予算） |
| 1 | 4-2 | relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。 | — | 令和8年度 延岡市予算に関する説明書（当初予算） |
| 1 | 4-3 | relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。 | — | 令和8年度 延岡市予算に関する説明書（当初予算） |
| 1 | 4-4 | relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。 | — | 令和8年度 延岡市予算に関する説明書（当初予算） |
| 1 | 4-5 | relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。 | — | 令和8年度 延岡市予算に関する説明書（当初予算） |
| 2 | 1-3 | 既存の人件費・事務費の枠内とみられるが未確認。予算に関する説明書の組織費目で確認できる可能性がある。 | — | 令和8年度 延岡市予算に関する説明書（総務費） |
| 4 | 2-3 | 個別の工事請負契約金額は relatedBillVoteIds の各議案（いずれもLevel3・一次資料確認済み）に既に記載があり、relatedBudget からも参照済み。追加調査の必要性は低い。 | — | （追加調査不要） |
| 6 | 1-1 | 予算・議案とも一次資料で確認済み。次は成果（実績値）の確認が中心。 | — | 「市長公約に関する取組み」次年度版 |
| 6 | 1-2 | 予算・議案とも一次資料で確認済み。次は成果（実績値）の確認が中心。 | — | 「市長公約に関する取組み」次年度版 |
| 6 | 2-1 | 予算・議案とも一次資料で確認済み。次は成果（実績値）の確認が中心。 | — | 「市長公約に関する取組み」次年度版 |
| 6 | 2-2 | 予算・議案とも一次資料で確認済み。次は成果（実績値）の確認が中心。 | — | 「市長公約に関する取組み」次年度版 |

最優先は **rank 1 の8公約**。いずれも `relatedBudget` 本文が「予算に関する説明書等のより詳細な資料での確認が必要」と次に見るべき資料を具体的に名指ししており、**同じ1資料（令和8年度 予算に関する説明書）で8公約が同時に解決しうる**。

---

## Phase205 での実装判断

**実装は行わなかった。** 理由：

1. Priority A の153件は、一次資料に個別の提案理由が無いことを確認済みの案件であり、説明文の新規生成は推測の混入になる。
2. Priority B の `HELD_RECORD_NOT_APPLIED` 56件は新規調査ゼロで前進できるが、Level1/Level2 の件数が動き、Phase162系の既存テストの期待値と `RELEASE_SNAPSHOT.md` の baseline に影響する。Phase205 の「baseline を理由なく書き換えない」「新規warning 0」の条件下では、テスト更新とセットで独立フェーズとして扱うのが安全。
3. 公約2-3の `relatedBudget`（`MULTI_YEAR_MULTI_BILL`）は、個別の工事請負契約金額が既に relatedBillVoteIds の各議案（すべてLevel3・一次資料確認済み）に記載され、relatedBudget 本文からも参照済みで、追加対応は不要と判断した。
