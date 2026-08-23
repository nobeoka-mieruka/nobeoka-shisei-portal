# Phase84 監査報告：選挙・議案・請願陳情データの内部整合性チェック

- 生成日：2026-08-23
- 対象：`src/data/electionResults.json`（選挙結果、39件）、`src/data/billVotes.json`（議案・採決、1,177件）、`src/data/committees.json`（委員会マスタ、6件）、`src/data/archiveCouncilDocuments.json`（議案・条例・請願・陳情アーカイブ、39件）、`src/data/councilSessions.json`（会期、61件）
- 方針：`src/lib/completeness.ts`のCompletenessStatus語彙（complete／partial／not_collected／not_available／unknown／under_review／confirmed_zero）に沿って判定。新規の外部一次資料調査は行わず、既存`reports/`配下の調査結果のみを参照した。データ本体・スクリプト・既存reportsへの変更は一切行っていない（本監査は`reports/phase78-88-staging/`配下の2ファイルのみに出力）。

## 総括

| 分類 | 件数 | 内訳 |
|---|---|---|
| P1（要修正・実害あり） | 1 | 選挙結果一覧の「候補者延べ数」集計 |
| P2（要確認・完成度ギャップ） | 2 | 調査特別委員会の委員会マスタ未収録／令和3年度の請願・陳情0件 |
| P3（軽微・データ整合性のみ） | 1 | verified済みレコードのunresolvedFields残存 |
| info（設計どおり・問題なし） | 複数 | 詳細は本文参照 |
| 参考情報（新規登録候補） | 1グループ | 市議選11回分の一次資料候補（本文未確認） |

全体として、このサイトは`confirmed_zero`／`not_collected`／`under_review`等の区別についてかなり丁寧に設計されている（`DataStatusPage.tsx`のデフォルトフォールバック、`councilActivityBarometer.ts`のresearch_exhausted運用など）ことを確認した。今回見つかった問題は、既存の丁寧な設計から**部分的に取りこぼされた箇所**（Phase76で修正済みの検索インデックスと同種のバグが選挙結果一覧ページにも残っていた等）が中心。

---

## 1. 選挙結果データ（electionResults.json）

### 1a. 候補者数・定数・得票・当落の内部整合性

全39件を機械的に突合した結果、**不整合は0件**だった。

- `dataCompleteness.candidateListConfirmed`がtrue（または省略＝全項目確認済み扱い）の全レコードで、`candidateCount`と`candidates`配列の件数が完全一致。
- `seats`（定数）が判明している全レコードで、`elected: true`の候補者数が`seats`と完全一致（市長選は定数の概念がないためseats=nullが大半、1971年以前の統一地方選挙年の市議選は市議選データ自体が未収録）。
- `votes`が記録されているのに`elected`がboolean以外（未確定）になっている候補者は0件。

`scripts/validate-data.mjs`（L3617-3618）に既に同種のチェックがあり、本監査の結果と整合する。

### 1b. 「候補者未確認」なのに候補者数を計算値で表示している箇所（Phase76型バグの再発有無）

**新たに1件発見（P1）**：`src/pages/ElectionsPage.tsx` L42・L67の「候補者延べ数」StatCard。

```
const totalCandidates = sortedAll.reduce((n, e) => n + e.candidates.length, 0);
```

`dataCompleteness.candidateListConfirmed === false`の19選挙（1975年市長選〜1998年市長選、戦前の市長選出等）は、`candidates`配列に当選者1名分しか登録されておらず、真の候補者数（`candidateCount`、判明していればそれより大きい値、多くはnull＝不明）とは異なる。この合計値は下限値に過ぎないにもかかわらず、画面上は確定値として無条件に表示されている。

これは、Phase76で`scripts/generate-search-index.mjs`に対して修正された問題（`candidateListConfirmed`でガードせずに`candidates.length`をそのまま件数表示に使ってしまう）と同種のバグである。当該スクリプトは既にガード済み（L545-556）だが、UI側の集計StatCardには同じ考慮が及んでいなかった。

なお、以下は確認の結果**問題なし**と判定した（同種の疑いがあったため個別に検証）。

- `ElectionDetailPage.tsx` L83：`candidateListConfirmed ? (candidateCount ?? candidates.length) : "確認中"` で正しくガード。
- `ElectionsPage.tsx` L135-150（一覧カード内の定数／候補者数／当選者数）：`candidateListConfirmed`がtrueの場合のみ表示するブロック内。
- `MayorDetailPage.tsx` L186：`unopposed = e.candidateCount === 1` で、配列長ではなく`candidateCount`フィールドを直接参照。

### 1c. DB上0件だが、既存reports/の調査で一次資料の所在が判明している選挙

`electionResults.json`には市議選（councilMember）が1999年以降しか収録されていない。1933〜1998年のうち、統一地方選挙年11回分（1955・1959・1963・1967・1971・1975年4月・1979・1982-83年セット・1987・1991・1995年）について、`reports/phase73-election-backfill-findings.md`が宮崎県選挙管理委員会刊行「選挙結果記録」「選挙の記録」シリーズの該当巻を**書誌情報レベル**（所蔵館・請求記号、一部はNDLデジタルコレクションのpidまで）で特定済みであることを確認した。

**重要な留保**：同レポート自身が明記している通り、これは「市町村選挙を収録範囲に含む巻の存在」が確認できた段階に過ぎず、「延岡市の個別データが実際に記載されているか」は本文未確認である。運用ルール上（NDL個人送信サービス不使用）、本文には到達していない。したがって、この11回分は`confirmed`（確定登録可能）ではなく、`reference_pending`（一次資料候補は特定済みだが内容未確認）として扱うべきであり、そのままelectionResults.jsonへ登録することは推奨しない。

1975年1月・1978年11月・1982年10月の市長選挙（対立候補氏名・得票）についても同種の候補資料（一部は同じNDL pid）が見つかっているが、これらは既にDBに`disputed`／`unconfirmed`として部分登録済みのため、「DB上0件」には該当しない（参考情報として記載）。

---

## 2. 議案・条例データ（billVotes.json）

### 2a. 賛否データの内部整合性

`memberVotes`（議員別賛否）配列に実データが入っているレコードは、1,177件中**わずか2件**（`2023-07-extraordinary-01-gian-9`＝27票、`2019-09-gian-47`＝27票）。いずれも投票総数27が、該当年度の議員定数（`electionResults.json`のseats=27）と完全一致し、memberId重複も0件。**ハードな不整合は検出されなかった**が、これは検証対象がわずか2件しかないという限定つきの結果である点に留意（残り1,175件は個人別内訳自体が非公開・未調査）。

なお`2023-07-extraordinary-01-gian-9`（再議、賛成16・反対11で「否決」）は、地方自治法上の再議・2/3ルールに基づく正当な結果であることをverificationNoteで確認済み（矛盾ではない）。

**軽微な不整合（P3）**：`2019-09-gian-52`〜`57`・`2019-09-seigan-1`の計7件は、`verificationStatus: "verified"`かつverificationNoteで内容確認済みと明記されているのに、`unresolvedFields: ["result"]`が残ったまま。`BillVoteDetailPage.tsx`（L384-390）では`verificationStatus`がverifiedの場合はこの警告文言自体を表示しないようガードされているため、ユーザー向け表示への実害はないが、データの内部整合性としては矛盾が残っている。

### 2b. 委員会付託の記載と委員会マスタ（committees.json）の整合性

billVotes.jsonのcommittee値と、現行の委員名簿マスタ`committees.json`（6件）を突合した結果：

- **問題なし（設計どおり）**：「予算審査特別委員会」（249件）「決算審査特別委員会」（49件）「長期総合計画審査特別委員会」（4件）は`committees.json`に存在しないが、`CommitteesPage.tsx`（L77）に「議長を除く全議員で構成・設置される委員会は委員名簿に個別掲載しない」と明記済みの意図的な設計。UIも`getCommitteeByName`がundefinedの場合はリンクなしテキスト表示にフォールバックし、破綻しない。
- **要確認（P2）**：「市職員の不適正な事務処理等に関する調査特別委員会」（1件）「市職員の不適正な事務処理及び市長の不適切発言等に関する調査特別委員会」（2件）の2つの地方自治法100条型調査特別委員会は、`committees.json`にもCommitteesPage.tsxの除外理由の明示列挙にも含まれていない。予算審査・決算審査等の「全議員構成」除外理由がこの2委員会にも当てはまるかどうかは本監査だけでは確認できなかった（調査特別委員会は一般に特定委員で構成されることが多い）。設置時の会議録で構成員を確認したうえで、委員名簿の追加か除外理由の明記追加のいずれかを検討すべき。
- **情報（問題なし）**：`committees.json`にある「議会のあり方検討特別委員会」（設置2026-03-19）はbillVotes.jsonから一度も参照されていないが、設置が最近のため未付託の可能性が高い。
- **情報（問題なし）**：委員会付託が未設定（undefined）の24件は、いずれも令和8年5〜6月定例会（直近会期）のみで、会議録未公開によるものと`DataStatusPage.tsx`の説明文で確認済み。

---

## 3. 請願・陳情データ

### 3a. confirmed_zero と not_collected の混同チェック

現行コード（`DataStatusPage.tsx`のstatusBadge()、`councilActivityBarometer.ts`の請願関連指標、`scripts/lib/session-summary.mjs`のhasPetitions判定）を確認した限り、**明示的な混同バグは見つからなかった**。0件のときの既定フォールバックは`not_collected`であり、確認なしに`confirmed_zero`へ格上げする箇所はなかった。

一方、**要確認事項を1件発見（P2）**：`billVotes.json`のcategory="請願"／"陳情"の年度別件数を集計したところ、令和1〜8年度（2019〜2026年度）の8年度中、**令和3年度（FY2021）のみ0件**という突出したパターンが見つかった。同じ4会期（令和3年6月・9月・12月定例会、令和4年3月定例会）には条例49件・予算33件・その他32件など他カテゴリは通常どおり存在しており、単なる会議録未公開ではない。

| 年度 | 議案総数 | 請願・陳情 | その他 |
|---|---|---|---|
| 令和1年度 | 172 | 10 | 33 |
| 令和2年度 | 154 | 7 | 43 |
| **令和3年度** | **140** | **0** | **32** |
| 令和4年度 | 165 | 4 | 31 |
| 令和5年度 | 165 | 5 | 49 |
| 令和6年度 | 157 | 3 | 44 |
| 令和7年度 | 200 | 3 | 56 |
| 令和8年度 | 24 | 1 | 0 |

このデータモデルには年度単位で「請願・陳情が確認済みで0件（confirmed_zero）」か「未収集・誤分類の可能性がある（not_collected/under_review）」かを区別する専用フィールドが存在しない。「その他」32件の中に請願・陳情が誤分類されている可能性も否定できないため、令和3年度4会期分の「議案等審議結果」PDF原文の再確認を推奨する（本Phaseでは新規調査・データ修正は行っていない）。

なお、この0件は`scripts/lib/session-summary.mjs`のhasPetitions判定にも連動しており、councilSessions.json内の令和3年度4会期のsummary文もすべて一貫して「請願・陳情の審査も行われました」の一文を欠いている（データが一貫している分、もし誤分類だった場合は複数箇所に影響が及ぶ）。

---

## 4. proposedFixes 一覧（詳細はJSON参照）

1. `src/pages/ElectionsPage.tsx`：「候補者延べ数」集計を`candidateListConfirmed`でガードする（P1、低リスク）。
2. `src/data/electionResults.json`：市議選11回分の一次資料本文確認を別タスクとして計画する（本Phaseでは新規登録しない）。
3. `src/data/billVotes.json`：7件の`unresolvedFields`をクリアする（P3、低リスク、表示影響なし）。
4. `src/data/committees.json` / `CommitteesPage.tsx`：調査特別委員会2件の構成員を一次資料で確認し、委員名簿追加か除外理由の明記追加を検討する（P2）。
5. `src/data/billVotes.json`（令和3年度4会期分）：請願・陳情0件の真偽をPDF原文で再確認する（P2）。

---

## 5. 監査の限界

- billVotes.jsonの個人別賛否（memberVotes）データは1,177件中2件のみ実データがあり、2aの内部整合性チェックはこの2件に限定される。
- 1c（一次資料所在の抽出）は、既存reports/配下のPhase73等の記載を読み合わせただけであり、新規の外部資料調査・現地確認は行っていない。所在候補が「延岡市データを実際に含むか」は依然未確認。
- 請願・陳情の年度別0件パターン（令和3年度）は、公式PDF原文の再確認をしていないため、confirmed_zeroかnot_collected/誤分類かの最終判定はできていない。
