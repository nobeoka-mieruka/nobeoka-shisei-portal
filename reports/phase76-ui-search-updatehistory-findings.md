# Phase76 UI・検索・出典・更新履歴 調査・修正結果

- 作業日：2026-08-23
- 作業者：Phase76 worker
- 許可されたファイル編集：`scripts/generate-search-index.mjs`（このスクリプトの実修正のみ許可）、
  `reports/phase76-ui-search-updatehistory-findings.md`（本ファイル）。他の`src`・`scripts`は未編集。
- git commit / git push は行っていない。ブラウザツールは使用していない。
- 事前確認済み：`reports/phase65-ui-search-findings.md`、`scripts/generate-search-index.mjs`、
  `src/lib/elections.ts`（`electionCandidateListConfirmed()`）、`src/pages/ElectionsPage.tsx`、
  `src/pages/ElectionDetailPage.tsx`、`src/data/updateHistory.json`（直接編集はしていない）。

---

## 1. 最優先タスク：election description誤表示の修正（完了）

### 1.1 問題

`scripts/generate-search-index.mjs`の選挙エントリdescription生成が、
`src/lib/elections.ts`の`electionCandidateListConfirmed()`ガードを使わず

```js
description: `${e.electionName}（${e.electionDate}投票、定数${e.seats ?? "確認中"}、候補者${e.candidateCount ?? e.candidates.length}名）の結果です。`,
```

としていたため、`candidateCount`が`null`（候補者数自体が未確認）の選挙で
当選者のみ登録された`candidates`配列の長さ（通常1）へフォールバックし、
「候補者1名」という誤った確定情報を検索結果descriptionに表示していた。

### 1.2 修正内容

`src/lib/elections.ts`の`electionCandidateListConfirmed()`と同じ判定ロジック
（`dataCompleteness == null || dataCompleteness.candidateListConfirmed !== false`）を
`generate-search-index.mjs`内に複製し（このスクリプトはビルド時のプレーンJSでTypeScriptを
直接importできないため、既存の`formatDateWithPrecisionForIndex()`と同じ複製方針を踏襲）、
未確認の場合は候補者数を出さず「候補者未確認」に切り替えた。

```js
function electionCandidateListConfirmedForIndex(e) {
  return e.dataCompleteness == null || e.dataCompleteness.candidateListConfirmed !== false;
}
...
const candidateListConfirmed = electionCandidateListConfirmedForIndex(e);
const candidateCountLabel = candidateListConfirmed ? `候補者${e.candidateCount ?? e.candidates.length}名` : "候補者未確認";
description: `${e.electionName}（${e.electionDate}投票、定数${e.seats ?? "確認中"}、${candidateCountLabel}）の結果です。`,
```

### 1.3 修正結果（実行・機械照合済み）

`node scripts/generate-search-index.mjs`を修正前後で実行し比較した。

| 項目 | 修正前 | 修正後 |
|---|---|---|
| 総件数 | 2,159件 | 2,159件（変化なし） |
| type別内訳 | election: 39 他17type | election: 39（他type含め全て変化なし） |
| `npm run validate:data`（本フェーズはvalidate:data部分のみ実行） | errors=0, warnings=15 | errors=0, warnings=15（変化なし） |

`git diff src/data/searchIndex.json`は19行の`description`変更のみで、他フィールド（id/title/url/keywords/sourceId）は無変化。

修正対象は**19件**（想定していた直接公選11件に加えて、副次効果として8件も是正された）：

- **直接公選11件（Phase65で指摘された対象）**：`election-mayor-1947-04`、`1948-07`、`1952-07`、`1960-04`、`1964-04`、`1978`、`1982`、`1986`、`1990`、`1994`、`1998` → いずれも「候補者1名」→「候補者未確認」に修正。
- **市議会による間接選出7件（1933・1937×3・1941・1942・1946）**：同様に「候補者1名」→「候補者未確認」に修正（Phase65が「実害はやや小さい」としつつ指摘していた表現不正確も解消）。
- **`election-mayor-1975`（1件、想定外の追加是正）**：`candidateCount: 3`が明示登録されているため元は「候補者3名」と表示されていたが、`dataCompleteness.candidateListConfirmed === false`（対立候補2名の氏名が未確定のためunconfirmed維持、`electionResults.json`の`notes`参照）のため、ページ単位UI（`ElectionsPage.tsx`・`ElectionDetailPage.tsx`）は元々この選挙の候補者数を「確認中」として非表示にしている。今回の修正で検索descriptionもページUIと同じ「候補者未確認」表示に統一された（**候補者数という数値そのものは確認済みだが「候補者一覧（氏名）」が未確認のため数値を出さない**、という既存のサイト全体の設計方針にdescriptionが追従した形であり、退行ではない）。

直接公選の`election-mayor-1971`（候補者2名・確認済み）、`election-council-*`各回、`election-mayor-1967-01`（単独候補・確認済み、候補者1名で維持が正しい）等、既存の確認済みレコードの表示は変化していないことを確認した。

**結論：最優先タスクは修正完了。**

---

## 2. generate-search-index.mjsのデータ型カバー状況確認（確認のみ、コード変更なし）

一般質問（`generalQuestions.json`）・議案（`billVotes.json`）・会議録要約
（`councilSpeechSummaries.json`）・選挙（`electionResults.json`）・財政ダッシュボード
（`financeDashboard.json`）は、いずれも既存ループで無条件処理されており、件数が増えても
コード変更なしで自動反映される設計であることを確認した（Phase65までの調査と同じ結論）。

**新規に発見した未カバー領域（本フェーズ時点で既にsrc/dataに存在するデータ）**：

| データ | 件数 | 使用ページ | search index収録状況 |
|---|---|---|---|
| `archiveFiscalYears.json`（延岡市の年度別財政アーカイブ、1933〜2026年度） | 70年度分 | `/finance/budget`、`/finance/debt`、`/finance/funds` | **未収録**。`generate-search-index.mjs`はこのファイルを一度も読み込んでいない。 |
| `kohoNobeokaIssues.json`（広報のべおかOCRアーカイブ） | 197号分 | `/koho-search`（専用検索UI、`kohoOcrSearchIndex.json`と`src/lib/kohoSearch.ts`による独自の全文検索） | **未収録**。専用検索ページが別途あるため実害は限定的だが、サイト共通検索からは見つからない。 |
| 静的ページ自体（`/finance/budget`・`/finance/debt`・`/finance/funds`・`/koho-search`・`/timeline`・`/timeline/:year`） | ― | ― | `staticPages`配列（L619-705）に未登録。ページの存在自体がサイト内検索で見つからない。 |

これらは今回発見した既存の（Phase67-75以前からの）カバレッジ・ギャップであり、
今回のPhase76最優先タスク（election description修正）とは独立した問題である。
**指示どおりコード変更は行っていない**（確認のみ）。もしPhase67-75で
`archiveFiscalYears.json`・`kohoNobeokaIssues.json`に新規年度・新規号数が追加されても、
既存レコードと同様に検索indexには反映されない状態が続く見込み。次フェーズ以降で
対応を検討する価値がある（対応時は本フェーズと同じ「TypeScript importできないためロジック複製」
方針を踏襲すればよい）。

---

## 3. broken link 11件の再確認結果（4回目の実測）

`src/data/dataQualitySummary.json`の`linkHealth.generatedAt`は依然として
`2026-08-16T23:25:10.204Z`のまま（読み取り専用のため本フェーズでは更新していない）。
11件を`curl -L --max-time 20`で実測した。

| 分類 | 件数 | 本フェーズ実測結果 |
|---|---|---|
| `not_found_404`（恒久404） | 4件 | 変化なし。4件とも引き続き404（Wikipedia「仲田又次郎」、Yahooニュース記事、延岡市.xls添付ファイル、宮崎日日新聞記事） |
| `server_error`（503、Wayback Machine一時障害） | 7件 | 7件全てが200 OKへ復旧していることを再確認（Phase54・Phase65と同じ結果を再現） |

Phase65までの分析（Wayback Machine側の再生バックエンドが断続的に503を返す既知の不安定挙動であり、
当サイトの新規不具合ではない）と一致する結果であり、追加の対応は不要と判断した。
`dataQualitySummary.json`自体は変更していない（Phase65が指摘したとおり、単発curl結果での
上書きは推奨しない）。

---

## 4. 更新履歴（src/data/updateHistory.json）の草稿

### 4.1 重要な制約：Phase67-75の実データがまだ存在しない

本フェーズ作業中に`git status`・`git log`・`reports/`ディレクトリを繰り返し確認したが、
**Phase67-75の成果物（コミット・findingsレポートのいずれも）は本フェーズ終了時点で
まだ出揃っていなかった**。具体的な根拠：

- `reports/`配下で新規に出現したのは`reports/phase72-member-matching-findings.md`（未コミット）
  1件のみ。その報告書自身が「作業開始時点（2026-08-23）で`reports/phase67-*`〜`reports/phase71-*`の
  `findings.json`を確認したところ、いずれも未生成だった（Phase67-71は並行実行中で成果物が
  出揃っていなかった）」と明記しており、Phase73-75についても同様に本フェーズ側からは
  確認できなかった。
- `git status --short`では`src/data`側の実質的な差分（財政・一般質問・OCR・選挙データの追加）は
  本フェーズ終了時点で確認できなかった（`councilSessions.json`の差分は改行コードのみで実質0行）。
- 過去の類似パターン（`d42d18f` Phase56-65+66統合コミットが`updateHistory.json`へ市民向け
  更新履歴7件をまとめて追加）から、Phase67-75の内容も**Phase77の親エージェント統合時に
  実際のdiffを見てから**具体的な件数・年度・号数を確定する運用が妥当と判断した。

このため、本節では**指示された「Phase67-75で実際に本番へ反映される見込みの変更」の具体的な
確定内容を報告することができない**（実データが存在しないため）。代わりに、Phase76の指示文で
示された対象領域（一般質問・財政・OCR・選挙データ）ごとに、既存`updateHistory.json`
（`u91`〜`u97`等）の文体・粒度を踏襲した**記入テンプレート（プレースホルダー）**を4件用意した。
Phase77で実データが確定した時点で、`{{ }}`部分を実数値に置き換えて登録することを想定する。

### 4.2 テンプレート草稿（4件、いずれもプレースホルダー・未確定）

```json
[
  {
    "id": "{{次のuID、例：u98}}",
    "date": "{{Phase77統合日、例：2026-08-2X}}",
    "title": "延岡市の財政データを{{追加年度数}}年度分、新たに確認しました",
    "description": "延岡市の財政ページ（予算・決算、市債、基金）で、これまで資料が確認できていなかった{{対象年度、例：昭和XX年度（19XX年度）〜昭和XX年度（19XX年度）}}について、広報のべおかのOCR調査等から新たに{{件数}}年度分のデータを確認し、追加しました。",
    "targetPages": ["延岡市の財政", "予算・決算規模の推移", "市債の推移", "基金残高の推移"],
    "category": "データ更新"
  },
  {
    "id": "{{次のuID、例：u99}}",
    "date": "{{Phase77統合日}}",
    "title": "広報のべおかのバックナンバーから、市政の記録を新たに確認しました",
    "description": "広報のべおかのバックナンバー（第{{対象号数}}号など、計{{件数}}号分）を新たに確認し、市政年表・歴代市長・選挙結果などのページに記載内容を反映しました。",
    "targetPages": ["市政年表", "歴代市長詳細"],
    "category": "データ更新"
  },
  {
    "id": "{{次のuID、例：u100}}",
    "date": "{{Phase77統合日}}",
    "title": "昭和・平成初期の市長選挙について、新たに資料を確認しました",
    "description": "延岡市長選挙のうち、これまで実施年月までしか確認できていなかった{{対象年、例：昭和XX年（19XX年）}}分の選挙について、対立候補の氏名・得票数等を新たに確認し、選挙結果ページに反映しました。",
    "targetPages": ["選挙結果一覧"],
    "category": "データ更新"
  },
  {
    "id": "{{次のuID、例：u101}}",
    "date": "{{Phase77統合日}}",
    "title": "一般質問データベースの議員照合を見直しました",
    "description": "過去の一般質問記録のうち、議員名の記載だけでは現職・元議員のどちらの記録か紐付けが確認できていなかった{{件数}}件について、選挙結果・在職期間等の資料と突き合わせて確認し、対応する議員のページへ反映しました。",
    "targetPages": ["一般質問データベース", "元議員詳細"],
    "category": "データ更新"
  }
]
```

**草稿件数：4件（すべてプレースホルダー。実データ未確定のため、そのままでは登録不可）。**

`src/data/updateHistory.json`は指示どおり直接編集していない。

---

## 5. 終了時報告

- **election description修正の適用結果**：`scripts/generate-search-index.mjs`の選挙description生成に
  `electionCandidateListConfirmed()`相当のガードを適用し修正完了。修正対象19件（直接公選11件＋間接選出7件＋
  想定外の副次是正1件〔`election-mayor-1975`、ページUIとの表示統一〕）で「候補者N名」の誤表示を
  「候補者未確認」へ修正。
- **search index件数（before/after）**：2,159件 → 2,159件（変化なし。descriptionのテキストのみ修正、
  レコードの追加・削除なし）。`npm run validate:data`：errors=0, warnings=15（修正前後で変化なし）。
- **broken link再確認結果**：11件中4件は4回連続で恒久404（Wikipedia「仲田又次郎」、Yahooニュース、
  延岡市.xls、宮崎日日新聞）。残り7件（Wayback Machine由来）は4回目の実測でも200へ復旧しており、
  外部側の断続的な問題と判断（対応不要、`dataQualitySummary.json`は未変更）。
- **更新履歴の草稿件数**：4件（すべてプレースホルダー・実データ未確定）。Phase67-75の成果物が
  本フェーズ終了時点で未生成のため、具体的な件数・年度・号数を含む確定版は作成できなかった。
  Phase77統合時に実diffを見てから内容を確定することを推奨する。
- **warnings**：
  1. `generate-search-index.mjs`は`archiveFiscalYears.json`（70年度分）・`kohoNobeokaIssues.json`
     （197号分）・関連する静的ページ（`/finance/budget`等6ページ）を索引化していない
     （既存の未対応領域、本フェーズでは指示により未修正）。Phase67-75でこれらのデータが
     追加されても検索結果には反映されない。
  2. Phase67-75の成果物は本フェーズ終了時点で未生成・未コミットのため、更新履歴の草稿は
     具体的な数値を伴わないテンプレートにとどまる（4.1節参照）。
  3. broken link 7件（Wayback Machine由来）は引き続き揮発性があり、`dataQualitySummary.json`の
     再生成時は複数回リトライしてから更新することを推奨（Phase65からの継続提案）。
