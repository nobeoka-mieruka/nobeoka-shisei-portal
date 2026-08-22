# Phase65 UI・検索・sourceRefs・status改善 調査結果

- 調査日：2026-08-23
- 調査者：Phase65 worker（読み取り専用調査。`reports/phase65-ui-search-findings.md`以外は未編集・未作成）
- git commit / git push は行っていない。ブラウザツールは使用していない。
- 事前確認済み資料：`reports/phase43-source-ui-audit-findings.md`、`reports/phase54-source-ui-findings.md`、
  `reports/phase55-integration-checkpoint.md`、`reports/phase56-66-baseline.md`、`reports/phase45-47-general-questions-findings.md`、
  `reports/phase59-member-matching-findings.md`、`src/data/dataQualitySummary.json`、`scripts/generate-search-index.mjs`、
  `src/lib/completeness.ts`、`src/lib/dataAvailabilityStatus.ts`、`src/lib/elections.ts`

---

## 1. 検索index（generate-search-index.mjs）のカバー状況確認結果

Phase55で新規追加されたデータが、コード変更なしで検索indexへ正しく反映される設計になっているかを実件数で検証した。

| 確認項目 | 結果 |
|---|---|
| `archiveCouncilDocuments.json`の請願・陳情+26件 | ✅ 反映済み。`generate-search-index.mjs`はdocumentTypeを問わず`archiveCouncilDocuments`全件をループする実装（Phase54調査どおり）。現在の`archiveCouncilDocuments.json`は39件（うち請願・陳情33件）、`searchIndex.json`の`type: "council-document"`エントリも39件で完全一致。petition/request 33件のうち、index内に`council-document-{id}`が存在しない欠落は0件（機械照合済み）。 |
| `civicTimelineEvents.json`の新規3件（civic-206〜208） | ✅ 反映済み。`civicTimelineEvents.json`は現在207件、`searchIndex.json`の`civic-timeline-*`エントリも207件で完全一致。ループは全件無条件処理のため、新規3件も含め欠落なし。 |
| 全体件数 | `searchIndex.json`＝**2,151件**（`reports/phase56-66-baseline.md`記載のベースラインと同数、Phase56〜65開始時点から未再生成・変化なし）。type別内訳：member 26／former-member 58／mayor 15／policy 16／council-document 39／promise 12／bill 1,177／question 15／speech 398／compensation 1／finance 2／guide 1／press-conference 1／political-fund 21／election 39／committee 6／page 226／update 98。 |

**結論**：Phase55統合で追加された請願・陳情26件・市政年表3件は、いずれも`generate-search-index.mjs`の既存ループ処理（documentType別のフィルタなし、全件処理）でコミット時に既に自動反映されており、スクリプト側の追加対応は不要（Phase54の結論を実件数照合で再確認した）。

---

## 2. broken link 11件の再確認結果（3回目の実測）

`src/data/dataQualitySummary.json`の`linkHealth.generatedAt`は依然として`2026-08-16T23:25:10.204Z`のまま（Phase43時点から未再生成）。本フェーズであらためて11件をcurl（`-L --max-time 20`）で実測した。

| 分類 | 件数 | 本フェーズ実測結果 |
|---|---|---|
| `not_found_404`（恒久404） | 4件 | 変化なし、4件とも引き続き404 |
| `server_error`（503、Wayback一時障害） | 7件 | **7件全てが200 OKへ復旧していることを再確認** |

### 経緯の整理（3回の再確認結果の推移）

| フェーズ | 実測有無 | server_error 7件の結果 |
|---|---|---|
| Phase43 | 実測なし（記録の再確認のみ） | ―（記録どおり11件broken） |
| Phase54 | 実測あり | 7件すべて200へ復旧 |
| Phase55統合チェックポイント | 実測あり（再チェック） | 復旧を再現できず、11件のままと判断・据え置き |
| **Phase65（本フェーズ）** | 実測あり | **7件すべて200へ復旧（Phase54と同じ結果を再現）** |

3回にわたる実測で「200／503が入れ替わる」パターンが確認できたため、これは当サイトの不具合ではなく、**Wayback Machine側の再生バックエンドが断続的に503を返す既知の不安定挙動**（`dataQualitySummary.json`の既存noteの説明と整合）と判断する。

**提案（実装しない）**：
- 単発の`curl`結果で`dataQualitySummary.json`の`broken`件数を書き換えるのは避けるべき（Phase55が実際にそれで「11件のまま」と「7件」の間で判断がブレた前例がある）。次に`scripts/generate-quality-summary.mjs`を再実行する際は、Wayback Machine分の7件のみ**複数回（例：3回、数分間隔）再試行して全て200だった場合のみ復旧扱いにする**リトライロジックの追加を検討する余地がある（現状のスクリプトは1回のcurl結果をそのまま記録している可能性が高く、揮発的な503を拾いやすい）。
- 恒久404の4件（Wikipedia「仲田又次郎」・Yahooニュース・延岡市.xls・宮崎日日新聞）は3フェーズ連続で404のままであり、リンク切れとして確定扱いしてよい。

---

## 3. 「データなし」「未収録」「資料確認待ち」の区別に関する追加調査結果

### 3-1. Phase45-47の一般質問未構造化候補2件（矢野戦一郎fm49・後藤哲朗fm14）のUI表示確認

`src/data/formerMembers.json`のfm14・fm49の`note`は、いずれも既に
「在職中の一般質問・発言記録は、現行の会議録検索システム・councilSpeechSummaries.jsonの収録範囲（令和元年6月定例会以降）に含まれないため確認できていない（**0件ではなく未収録**）」
と明記されている（Phase59調査時点で変更なし）。

`src/pages/MemberFormerDetailPage.tsx:313-316`のUI実装を確認した：

```tsx
<SectionCard title="一般質問履歴">
  {speeches.length === 0 ? (
    <EmptyState message="公開している一般質問記録はまだありません。" status="not_collected" />
  ) : ( ... )}
```

`speeches.length === 0`のとき、裸の「0件」ではなく`EmptyState status="not_collected"`（＝`DataAvailabilityStatus`の「未収録」）を表示する設計になっており、fm14・fm49を含む全元議員について、Phase59が指摘した「0件ではなく未収録」の区別は**UI側でも既に正しく実装されている**（バグなし）。

同ページの`一般質問履歴`情報充足バッジ（`calculateInformationDisclosureIndex`のfilled判定、L127）も`speeches.length > 0`を条件とする加点方式であり、「0件」という数値ラベルを露出しない設計。レーダーチャートの`radarEligibleSessions`も`servedSessions`（在職確認済み会期）を基準にしており、fm14・fm49のように`servedSessions: []`（会議録収録範囲外）の場合は対象期間自体が空になる設計のため、誤って「活動なし＝0点」と表示される実害は確認できなかった。

**結論**：fm14・fm49固有の問題ではなく、`servedSessions`が会議録収録範囲外の全元議員に共通する既存の適切な設計。Phase59のconfidence判定（fm14=exact、fm49=high）自体は`src/data`へまだマージされていない（矢野戦一郎候補記録のmemberId解決はreports止まり）が、これはマージ作業待ちであり、UI表示の不具合ではない。

### 3-2. 人物照合pending（Phase59）発生時の想定UI表示

Phase59は矢野戦一郎・後藤哲朗の2件を`pending 0件`（両方とも`exact`/`high`confidenceで確定）と報告しているが、Phase59の提案`matchConfidence`／`matchEvidence`フィールドは**未実装**（`src/data`のスキーマに存在しない）。したがって現時点では「人物照合pending」を表す専用のUI状態・バッジは存在しない。

既存の類似パターンとして、`verificationStatus: "needsReview"`（`src/lib/people.ts`のCompareMembersPage向け照合ロジック等）が使われているが、これは出典検証状態の語彙であり、人物同定（同姓同名判定）のconfidenceとは意味が異なる。

**想定されるリスク（実装時の注意点として記録）**：
- 将来Phase59提案の`matchConfidence`（`exact/high/medium/low/unresolved`）を実装する場合、`medium`/`low`/`unresolved`を画面に出す際は、本レポート4節で指摘する`CompletenessStatus`／`DataAvailabilityStatus`のキー衝突と同じ問題（`under_review`・`unknown`等の語彙の使い回し）を新たに発生させないよう、既存2語彙のいずれとも重複しない新しいキー名（例：`matchConfidence`専用の`exact`/`high`/`medium`/`low`/`unresolved`は現状他語彙と字面が重複していないため問題なし）を維持すること。
- `medium`/`low`の場合の推奨UI文言は、既存の`needsReview`運用（fm04三上毅/三上武、fm10本部仁俊/本部泰俊の`note`内自由記述、バッジ化はされていない）を踏襲するか、`DataAvailabilityBadge`の`under_review`（「未確認」）を流用するかの判断が必要。現状バッジ化されていない自由記述運用のままだと、他の収録状況バッジ群との視覚的一貫性がない点は改善余地。
- 現時点で実装が存在しないため、実害としての誤表示は0件。将来実装時の設計指針としてのみ記録する。

### 3-3. 選挙のincomplete表示（候補者不明だが実施は確認済み）の区別確認

`src/data/electionResults.json`の`dataCompleteness.candidateListConfirmed`は、市長選挙11件（1947・1948・1952・1960・1964・1975・1978・1982・1986・1990・1994・1998）と市議選前史の間接選出7件（1933-1946の council_selection）で`false`。

**ページ単位のUI（`ElectionsPage.tsx`・`ElectionDetailPage.tsx`）は正しく区別できている：**
- `src/lib/elections.ts:48-50` の `electionCandidateListConfirmed()` ヘルパーで判定。
- `ElectionsPage.tsx:135-150`：`candidateListConfirmed`が`false`の場合、候補者数を表示せず「候補者一覧・得票数：未確認」という文言に切り替える（数値を出さない設計）。
- `ElectionDetailPage.tsx:75-79, 83`：同様に「候補者数」の`StatCard`の値を`"確認中"`に切り替え、加えて説明文「この選挙は実施年月までは公式資料で確認できていますが、候補者一覧・得票数・投票率はまだ確認できていません。」を表示する。**実施確認済みと未確認項目の区別が明確。**

**ただし、`scripts/generate-search-index.mjs`（L544-556）の選挙エントリ`description`生成ロジックには、上記ガードが適用されていない、実際の誤表示候補を発見した：**

```js
description: `${e.electionName}（${e.electionDate}投票、定数${e.seats ?? "確認中"}、候補者${e.candidateCount ?? e.candidates.length}名）の結果です。`,
```

`candidateCount`が`null`（＝候補者数そのものが未確認）の場合、`candidates.length`（＝当選者のみ登録された配列の長さ、通常1）へフォールバックする。実件数を機械照合した結果、**直接公選制（`direct_public_vote`）の11件全て**が該当し、いずれも検索結果の説明文が「候補者1名」という、あたかも無投票・単独候補だったかのような誤った確定情報を表示する設計になっている（実際は対立候補の有無・人数が未確認なだけで、単独当選だったと確認されたわけではない）。

該当11件：`election-mayor-1947-04`、`election-mayor-1948-07`、`election-mayor-1952-07`、`election-mayor-1960-04`、`election-mayor-1964-04`、`election-mayor-1978`、`election-mayor-1982`、`election-mayor-1986`、`election-mayor-1990`、`election-mayor-1994`、`election-mayor-1998`。

（間接選出7件は「候補者」概念自体が制度上存在しない旨が`notes`に明記されているため実害はやや小さいが、同様に「候補者1名」という数値が出る点は表現として不正確。`election-mayor-1975`は`candidateCount: 3`が既に設定されているため問題なし。）

**修正案（提案のみ、実装しない）**：`generate-search-index.mjs`の選挙descriptionにも、`src/lib/elections.ts`の`electionCandidateListConfirmed()`と同等のロジック（`dataCompleteness == null || dataCompleteness.candidateListConfirmed !== false`）を複製し、`false`の場合は「候補者◯名」の代わりに「候補者：未確認」等へ切り替える。このスクリプトは既に`formatDateWithPrecisionForIndex()`など`src/lib`側ロジックの複製パターンを採用しているため（TypeScriptを直接importできない制約による、L17-27のコメント参照）、同じ方針で対応できる。

### 3-4. その他

- `PeoplePage.tsx:310`の`otherActivityCount > 0 ? "not_collected" : "under_review"`という三項演算子は、Phase54が指摘したとおり健全（活動0件＝未確認、活動が別途あるのに個別データがない＝未収録、という区別）。今回変更なし。
- `DataStatusPage.tsx:633-634`（Phase43指摘の「件数不整合」カードの静的「0件」ハードコード）は本フェーズ時点でも未修正のまま（`countConsistencyChecks`配列は1件のみ・`status: "fixed_2026-08-17"`のため現状の表示内容自体は事実と一致）。追加の劣化は確認されなかった。

---

## 4. naming-collision risk（CompletenessStatus vs DataAvailabilityStatus）の再評価と修正手順

### 4-1. 現状の再確認（Phase43・Phase54から変化なし）

- `CompletenessStatus`（`src/lib/completeness.ts`、7区分）を実際にimportしているのは`DataStatusPage.tsx`のみ（本フェーズ再確認、Phase54は「HomePage.tsxも」としていたが、`HomePage.tsx`は型を直接importせず文字列リテラルのみ使用している可能性があり、importしている実ファイルは`DataStatusPage.tsx`と`completeness.ts`自身の2ファイルのみと確認した）。
- `DataAvailabilityStatus`（`src/lib/dataAvailabilityStatus.ts`、5区分）の呼び出し実績は7箇所・4ファイル（`MayorPage.tsx`1、`MemberFormerDetailPage.tsx`5、`PeoplePage.tsx`1）で、Phase54から変化なし。全て`under_review`のみ使用（`unknown`の呼び出し実績は依然0件）。
- 両者は同じキー名（`under_review`・`unknown`・`not_collected`）を持ちながら、ラベルの対応が一部で入れ替わっている：

| キー | CompletenessStatus | DataAvailabilityStatus |
|---|---|---|
| `under_review` | 調査中 | 未確認 |
| `unknown` | 母数未確認 | 調査中 |
| `not_collected` | 未収録 | 未収録（一致） |

- 現時点で両者を混同して使っている実装バグは今回も発見できなかった（TypeScriptの構造的型付けにより将来的にコンパイルエラーなく混用できてしまう潜在リスクのみ）。

### 4-2. リスクの再評価

- **発生確率**：低〜中のまま変化なし。呼び出し箇所がこの10フェーズ間（Phase43〜65）増えていない（新規ページでのEmptyState/DataAvailabilityBadge利用実績は今回の調査でも新規発見なし）。ただし、Phase59が提案する`matchConfidence`（人物照合confidence）や、Phase65が新規発見した選挙description（3-3節）のような**新しい状態表現が今後も増え続けている**傾向があり、「同じキー名を別の語彙で使い回すリスク」自体は時間とともに増加している。
- **深刻度**：現状は実害0件（コンパイルは通るが、実際に混用されているコード箇所はない）。ただし発生した場合の症状は「調査中」と「未確認」の意味が逆転する、または「母数未確認」と「調査中」が入れ替わるという、**利用者が状態を正反対に誤解しかねない**性質のバグになりうる（サイトの編集方針上「確認できない情報は区別して表示する」ことが根幹方針であるため、この種のバグは方針の根幹に抵触するリスクとして重めに扱うべき）。
- **総合評価**：優先度は「低〜中」で据え置くが、次にどちらかの語彙へ手を入れる（新規キー追加・呼び出し箇所の追加）タイミングで着手することを推奨する。放置してよい理由にはならない。

### 4-3. 具体的な修正手順（実装しない、手順のみ提示）

Phase54の提案（DataAvailabilityStatus側2キーをリネーム）を踏襲しつつ、実施手順を具体化する。

**Step 1. 型定義の変更**（`src/lib/dataAvailabilityStatus.ts`）
1. `export type DataAvailabilityStatus = "confirmed" | "not_collected" | "under_review" | "unavailable" | "unknown";`
   → `"confirmed" | "not_collected" | "unverified" | "unavailable" | "investigating";`
2. `DATA_AVAILABILITY_STATUS_LABELS`のキーを`under_review`→`unverified`、`unknown`→`investigating`に変更（値＝日本語ラベルはそれぞれ「未確認」「調査中」のまま変更しない）。
3. `DATA_AVAILABILITY_STATUS_NOTES`も同様にキーのみ変更。

**Step 2. コンポーネント側の変更**（`src/components/DataAvailabilityBadge.tsx`）
4. `STYLE_BY_STATUS`（または同等の色・アイコン対応表）のキーを同じく変更。

**Step 3. 呼び出し側7箇所の変更**（すべて`status="under_review"`→`status="unverified"`のリテラル置換のみ、`unknown`の呼び出し実績は0件のため対応不要）
5. `src/pages/MayorPage.tsx:195`
6. `src/pages/MemberFormerDetailPage.tsx:253, 270, 284, 300`
7. `src/pages/PeoplePage.tsx:310`（三項演算子内の`"under_review"`のみ変更、`"not_collected"`側は変更不要）

**Step 4. 検証**
8. `npx tsc -b`でリテラル型の不一致がコンパイルエラーとして検出されないことを確認（型を変更した直後は、置換漏れがあれば`Type '"under_review"' is not assignable to type 'DataAvailabilityStatus'`という形で確実に検出される点が、このリファクタの安全性の根拠）。
9. `npm run validate:data`・`npm run build`で回帰がないことを確認。
10. 画面表示文言（日本語ラベル）は一切変更していないため、スクリーンショット比較等の追加確認は不要（型のキー名のみの変更、UIの見た目は無変化）。

**変更しない理由の確認（対象外）**：
- `not_collected`は両語彙でラベルが完全一致（「未収録」）のため、リネーム対象から除外（Phase54の判断を踏襲）。
- `confirmed`・`unavailable`はCompletenessStatus側に同名キーが無いため対象外。
- `CompletenessStatus`側のリネームは、`DataStatusPage.tsx`内の参照箇所数（7区分×複数箇所）がDataAvailabilityStatus側より多く、変更コストが大きいため見送り（Phase54と同じ結論）。

**根本対策（将来検討、今回は範囲外）**：新しい状態語彙を追加する際は、既存の`CompletenessStatus`・`DataAvailabilityStatus`（改修後は`unverified`/`investigating`）とキー名が重複しないことを確認する運用ルールを、CLAUDE.mdまたは`src/lib/`配下の共通コメントに明記することを推奨する。今回新たに確認したPhase59提案の`matchConfidence`（`exact/high/medium/low/unresolved`）は、現状この2語彙とキー名の重複がないため問題ない。

---

## 5. 終了時報告

- **search index件数の現況**：2,151件（Phase56-66開始時ベースラインと同数、未再生成・変化なし）。Phase55新規データ（請願・陳情+26件、市政年表+3件）はコード変更なしで自動反映される設計であることを実件数照合で確認した（欠落0件）。
- **sourceRefs補強件数**：0件（本フェーズは読み取り専用調査のため、データへの追記は行っていない）。
- **0件誤表示候補件数**：1件（新規発見）＋確認のみ2件（既存指摘の追跡）
  - 新規：`scripts/generate-search-index.mjs`の選挙エントリdescription（3-3節）。`dataCompleteness.candidateListConfirmed===false`かつ`candidateCount===null`の直接公選11件で、検索結果の説明文が「候補者1名」という誤った確定情報を表示する設計（ページ単位のUIでは既に正しく「確認中」等へ切替済みだが、検索descriptionだけガードが欠落）。
  - 追跡：`DataStatusPage.tsx`の「件数不整合」カード静的「0件」（Phase43指摘、未修正、現状は事実と一致のため実害なし）。`CompareMayorsPage.tsx`裸の「0件」（Phase43指摘、未再調査・変化なしと推定）。
  - fm14・fm49（Phase45-47候補、Phase59でexact/high確定）の一般質問セクションは、`EmptyState status="not_collected"`により「0件ではなく未収録」が正しく表示されており、誤表示なし（3-1節）。
- **broken link再確認結果**：11件中4件は3回連続で恒久404を確認。残り7件（Wayback Machine由来）は3回の実測で「200／503が入れ替わる」ことを確認し、断続的な外部側の障害と判断（当サイトの新規不具合ではない）。`dataQualitySummary.json`自体は未変更（読み取り専用のため）。
- **naming-collision risk**：現状は実害0件のまま据え置き（Phase43・Phase54から変化なし）。本フェーズで具体的な修正手順（4段階10ステップ）を提示した。優先度は「低〜中」を維持するが、新規状態語彙（Phase59のmatchConfidence等）が増え続けている傾向を踏まえ、次に既存2語彙のどちらかへ手を入れるタイミングでの着手を推奨する。
- **warnings**：
  1. `generate-search-index.mjs`の選挙description未ガード（3-3節、新規発見・優先度中）。
  2. `dataQualitySummary.json`のlinkHealthは2026-08-16生成のまま。Wayback Machine 7件は再実行のタイミングにより200/503どちらの記録にもなり得る揮発性があり、単発実行での上書きは推奨しない（2節）。
  3. naming-collision riskは未対応のまま（4節、手順は具体化済み）。
  4. Phase59提案の`matchConfidence`は未実装のため、人物照合pendingの専用UI状態は現状存在しない（3-2節、将来実装時の設計指針を記録）。
  5. `npm run validate:data`：errors=0, warnings=15（既存ベースラインと同一、本フェーズでの変更なし）。
