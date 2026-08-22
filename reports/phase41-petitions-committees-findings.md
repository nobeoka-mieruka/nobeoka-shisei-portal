# Phase41 調査報告：請願・陳情・委員会

- 調査日：2026-08-22
- 対象：請願／陳情／常任委員会／議会運営委員会／特別委員会／委員会発言／委員会報告
- 方針：本レポート作成のみ。コード修正・データ作成・コミットは行っていない。

## 1. 「委員会6件100%」の母数の実態

### 1.1 表示箇所の特定

`src/pages/DataStatusPage.tsx` 内に、「委員会6件100%」に相当する表示が **2箇所** ある。いずれも母数は `src/data/committees.json` の全レコード数（現在ちょうど6件：総務政策委員会・産業建設委員会・厚生教育委員会・議会運営委員会・議会活性化特別委員会・議会のあり方検討特別委員会）。

**(A) データ領域サマリー「委員会（常任・議会運営・特別）」（L405-415）**

```ts
const committeesWithJurisdiction = committees.filter((c) => c.jurisdiction !== null).length;
const councilCommittees: DataDomain = {
  label: "委員会（常任・議会運営・特別）",
  count: committees.length,
  unit: "件",
  scope: "現行の委員名簿（令和8年5月8日現在）",
  detail: `委員名簿・任期を登録済み。所管事項が確認できたもの：${committeesWithJurisdiction}／${committees.length}件（延岡市議会委員会条例の条文が未確認のため残りは「確認できず」と表示）。活動報告書（所管事務調査、令和5〜7年度）：${committeeActivityReports.length}件登録。`,
  ...
  fullyCovered: committeesWithJurisdiction === committees.length,
};
```

`committees.length` = 6（現行の委員名簿のみ、`scope` フィールドに「現行の委員名簿（令和8年5月8日現在）」と明記済み）。`committeesWithJurisdiction`（jurisdictionが非nullの件数）も現状6（後述）。`fullyCovered: 6===6` → `true` → バッジは「完全収録」。

**(B) 品質整合性チェック「委員会：所管事項の確認」（L543-547）**

```ts
{
  label: "委員会：所管事項の確認",
  metric: simpleCompleteness(committeesWithJurisdiction, committees.length),
  note: "常任委員会3件と、設置時提案理由で目的が確認できた特別委員会1件は確認済み。議会運営委員会・他の特別委員会は、条例上、所管事項の個別列挙を持たない構造のため、この項目には該当しない",
},
```

`simpleCompleteness(6, 6)` → `status: "complete"`、`coverageRate: 100`。画面には「収録6件／収録率：100%」の形で表示される（`src/lib/completeness.ts` の `formatCoverageRate`、`DataStatusPage.tsx` L237/L241）。これが「委員会6件100%」の実体。

### 1.2 母数は「現任期のみ」か「全期間」か

**現任期のみ。** `scope: "現行の委員名簿（令和8年5月8日現在）"` として明示されており（(A)の表示）、この点は既に利用者へ正しく開示されている。`committees.json` には過去の任期の委員構成（歴代委員会名簿）は収録されておらず、`committees.ts` のコメントにも「予算審査特別委員会・決算審査特別委員会・長期総合計画審査特別委員会等、会期ごとに議長を除く全議員で構成・設置される臨時の委員会は committees.json には収録していない」と明記されている。`CommitteesPage.tsx`（L76-78）にも同様の注記が表示画面に存在する。
→ **この軸では表示は誤解を招かない。**

### 1.3 「100%」の計算ロジックに指摘事項あり（表示修正はしていない、指摘のみ）

`committeesWithJurisdiction = committees.filter((c) => c.jurisdiction !== null).length` は、現在の `committees.json` を確認したところ **6件全て `jurisdiction` が非null**（`委員会運営委員会` は「地方自治法第109条第3項に基づく」という法律上の一般規定の説明文、`議会活性化特別委員会`・`議会のあり方検討特別委員会` は「設置時の提案理由」の説明文が入っている）。そのため `committeesWithJurisdiction === committees.length`（6===6）が成立し、`fullyCovered: true` および `simpleCompleteness(6,6)` → 100%表示となっている。

しかし、この項目に付随する `note`（L546）は次のように書かれている：

> 「常任委員会3件と、設置時提案理由で目的が確認できた特別委員会1件は確認済み。議会運営委員会・他の特別委員会は、条例上、所管事項の個別列挙を持たない構造のため、**この項目には該当しない**」

これは「本当に確認済みなのは4件（常任委員会3＋特別委員会1）で、議会運営委員会・議会のあり方検討特別委員会はこの集計の対象外（該当なし）」という趣旨の説明であり、**実際のコードの集計（jurisdiction非null＝6件）とnoteの説明（真に確認済みは4件）が整合していない**。おそらく、Phase16前後で「常任委員会3件＋活性化特別委員会1件」のみ `jurisdiction` を埋めていた時点でこの note が書かれ、その後 Phase27〜28（2026-08-16頃）で議会運営委員会・議会のあり方検討特別委員会にも `jurisdiction`（条例上の個別列挙ではなく、法律上の一般規定や設置時提案理由の説明文）を追記した際に、`committeesWithJurisdiction` の集計対象（`jurisdiction !== null`）とnote文言の食い違いが生じたまま放置されている。

**指摘（実装修正はしていない）：**
- 「委員会：所管事項の確認 100%」は、字面どおりには「6委員会すべてで条例上の所管事項個別列挙が確認できた」ように読めるが、実際には6件のうち2件（議会運営委員会・議会のあり方検討特別委員会）は「条例上の個別列挙は存在しない」ことを確認した結果としての説明文が `jurisdiction` に入っているだけであり、性質が異なる。`jurisdiction !== null` という二値判定が「所管事項が確認できた」という意味と「所管事項の個別列挙という概念自体が適用されないことを確認した」という意味を区別できていない。
- note文言（「確認済みは4件」）と実際の集計（6件）が矛盾しており、利用者が「詳しい内訳を見る」を開かずに「6件／100%」だけを見た場合、上記の実態（性質の異なる委員会が混在）が伝わらない可能性がある。
- 是正案（提案のみ、実装はしていない）：`committeesWithJurisdiction` の定義を「条例上の所管事項個別列挙が存在する委員会」（常任委員会3件）＋「設置時提案理由等で目的確認済みの特別委員会」（現状の note が言う4件）に厳密化するか、あるいは note を「6件全てで何らかの所管根拠（条例の個別列挙／法律の一般規定／設置時提案理由）を確認済み」という趣旨に更新し、集計とnoteの定義を一致させる。

## 2. 議案データと委員会データの重複有無

**重複登録は確認されなかった。** 設計は正規化されており、`billVotes.json` の各議案レコードは `committee` フィールドに委員会名の文字列（例：「総務政策委員会」「予算審査特別委員会」）を保持するのみで、委員名簿等は保持していない。`src/lib/committees.ts` の `billsForCommittee()` が `billVotes.json` の `committee` 文字列を逆引きして委員会別の審査議案一覧を組み立てる方式で、`committees.json` 側に議案リストを重複して持たせていない（コード冒頭のコメントに明記：「審査議案の一覧は billVotes.json の committee フィールドから逆引きする（重複保持しない）」）。

`billVotes.json` の `committee` 値の内訳（grep結果）：

| committee値 | 件数 | committees.jsonに存在するか |
|---|---|---|
| 予算審査特別委員会 | 249 | しない（会期ごとの臨時設置のため対象外、CommitteesPage.tsxで注記済み） |
| 付託なし（本会議で即日議決） | 149 | 該当なし（委員会付託省略） |
| 厚生教育委員会 | 232 | する |
| 市職員の不適正な事務処理及び市長の不適切発言等に関する調査特別委員会 | 2 | しない（過去の臨時特別委員会） |
| 市職員の不適正な事務処理等に関する調査特別委員会 | 1 | しない（名称違いの旧表記、過去の臨時特別委員会） |
| 決算審査特別委員会 | 49 | しない（臨時設置のため対象外） |
| 産業建設委員会 | 141 | する |
| 総務政策委員会 | 293 | する |
| 議会活性化特別委員会 | 4 | する |
| 議会運営委員会 | 29 | する |
| 長期総合計画審査特別委員会 | 4 | しない（臨時設置のため対象外） |

これらは想定どおりの構造（`committees.json`は「委員名簿に個別掲載される委員会」のみを収録し、会期ごとに全議員で構成される臨時特別委員会は対象外という方針がCommitteesPage.tsx L76-78で明示済み）であり、重複登録ではない。

## 3. 請願・陳情データの有無（schema gapの再確認）

**タスク指示にある「存在しない可能性がある」という前提は誤りだった。請願・陳情のデータは既に存在する。schema gapではない。**

- `src/data/archiveCouncilDocuments.json` に `documentType: "petition"`（請願）3件、`documentType: "request"`（陳情）4件、計7件の詳細アーカイブレコードが存在する（`ArchiveCouncilDocument` 型、`src/types/historicalArchive.ts` L483, 577-586）。
- 対応する専用ページも実装済み：`src/pages/CouncilDocumentsArchivePage.tsx` の `PetitionsPage`/`PetitionDetailPage`/`RequestsPage`/`RequestDetailPage`。ルーティングも `src/App.tsx`（L304-307）に登録済み（`/petitions`、`/petitions/:slug`、`/requests`、`/requests/:slug`）。トップページ（`HomePage.tsx` L125）・フッター（`Footer.tsx` L31-32）からも導線あり。
- さらに母集団としては、`src/data/billVotes.json` に `category: "請願"` が14件、`category: "陳情"` が19件、計33件の議決レベルの基礎データが既に登録されている。
- `archiveCouncilDocuments.json` の各請願・陳情レコードは `existingBillVoteId` で `billVotes.json` の該当レコードを参照する設計になっており（例：`doc-petition-01.existingBillVoteId = "2023-06-seigan-1"`）、`billVotes.json` 側の実在も確認した（grep で該当ID全て検出）。これは重複格納ではなく、詳しく調べた一部（7件）を「詳細アーカイブ」として上位レイヤーに正規化してインデックスしたものである（`notes` フィールドに「既存billVotes.jsonのカテゴリ『請願』レコードをアーカイブ層へインデックスしたもの」と明記）。

**未解決のカバレッジ課題（schema gapではなく収集範囲のギャップ）：**
- `billVotes.json` の請願14件・陳情19件（計33件）のうち、詳細アーカイブ化（`archiveCouncilDocuments.json`）されているのは請願3件・陳情4件（計7件）のみ。残り26件は議決結果のみ登録され、提出経緯等の詳細調査は未着手。
- ただしこの点は `DataStatusPage.tsx`（L388, L669）で「延岡市議会に提出された請願・陳情全件の一覧ではありません」「『詳細アーカイブ化済み』は全件一覧ではありません」と既に利用者へ明示されており、隠れた欠損ではない。

## 4. 終了時報告

- 委員会関連新規件数：0件（新規データ登録なし。既存コードの母数ロジックを調査し、指摘事項を本レポートに記録したのみ）
- 請願新規件数：0件（既に14件が billVotes.json に、うち3件が archiveCouncilDocuments.json に存在することを確認。新規追加なし）
- 陳情新規件数：0件（既に19件が billVotes.json に、うち4件が archiveCouncilDocuments.json に存在することを確認。新規追加なし）
- 残件：
  1. 「委員会：所管事項の確認」の note文言と `committeesWithJurisdiction` の集計ロジックの不整合の是正（本レポート1.3節、実装未着手）。
  2. 請願14件・陳情19件のうち、詳細アーカイブ未着手の26件（請願11件・陳情15件）の追加調査（提出経緯・審査過程の人手調査、実施すれば「詳細アーカイブ化済み請願／陳情」の件数が増える）。
  3. 委員会内部（常任・特別・議会運営委員会）の個別発言・逐語記録の一般公開有無は `committeeReportActivity.json` の generatedAt note で「research_exhausted（0件ではなく調査を尽くしたが確認できず）」と既に記録済み。追加調査の必要があれば別途。
- Warnings：
  - `E:\nobeoka-gikai\.claude\settings.local.json` が作業開始時点でuncommitted状態（`git status` の `M`）だったが、本タスクの制約（reports配下のみ編集可）に従い、このファイルには一切触れていない。
  - 本タスクではファイル作成・編集は `reports/phase41-petitions-committees-findings.md` のみ。git commit / push は行っていない。
