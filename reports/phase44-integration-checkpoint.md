# Phase44 統合チェックポイント（10並列調査の統合）

作成日：2026-08-22

## 1. 統合対象

Phase34〜43の10workerが作成した`reports/phase3[4-9]-*-findings.md`・`reports/phase40-43-*-findings.md`（計11ファイル、Phase35のみ.mdと.jsonの2件）をすべて読み込み、以下の方針で統合した。

- 一次資料で確度高く確認できた新規数値のみ`src/data`へ反映する。
- 複数worker・複数資料で独立にクロスチェックが取れているものを優先する。
- 「候補」「未確定」段階のものは`src/data`へは反映せず、統合後のunresolved ledgerまたは本チェックポイントへの記録にとどめる。
- 既存の確定済みデータ・sourceRefsは上書きしない（すべて`null`だったフィールドへの追記のみ）。

## 2. src/dataへ反映した内容

### 2-1. `src/data/archiveFiscalYears.json`

- **FY2010・FY2009**：`debt.balance.ordinaryAccountLocalBondBalanceYen`を新規登録（67,343,886,000円／68,428,838,000円）。出典：総務省「平成22年度財政状況資料集」宮崎県延岡市（p.1総括表とp.3健全化判断比率表で完全一致を確認）。既存のFY2007・FY2008値（総務省市町村決算カード出典）とも千円単位まで整合。
- **FY2001〜2006**：`finance.financialStrengthIndex`を新規登録（0.55／0.56／0.55／0.55／0.48／0.49）。既存の「要確認」フラグ（3ヵ年平均定義の不一致懸念）を、総務省「指標の説明」公式文書との照合により解消。抽出した基金残高が既存登録値と完全一致することでもクロスチェック済み。すべて`verificationStatus: "needsReview"`として登録（座標ベースPDF抽出のため既存慣例に準拠）。

### 2-2. `src/data/nobeokaCensusPopulation.json`

- **1985・1990・1995・2000・2005年**の`observedPopulation`（当時の行政区域＝合併前の旧延岡市域人口）を新規登録（136,381／130,624／126,629／124,761／121,635人）。出典：総務省統計局e-Stat国勢調査時系列データ（一次資料）。旧延岡市＋北方町＋北川町＋北浦町の合計が既存の`reconstructedCurrentBoundaryPopulation`と1人の誤差もなく完全一致することを確認し、mergerEventsとの整合性を公式統計で裏付けた。

### 2-3. `reports/council-hub-source-audit.json`

- Phase27由来の未解決事項「議案第14号の条例／補正予算の齟齬」に`phase40Resolution`を追記。Phase40調査で第26回審議結果PDFを全文突合し、第14号＝条例（既存登録どおり）、ユーザー想定の補正予算は実際には議案第20号だったことを確定。`billVotes.json`自体の修正は不要と判明。

### 2-4. `reports/phase33-master-unresolved-ledger.json`

- UNR-017〜UNR-021の5件を新規追加（議長・副議長のschema gap／FY2011-2017の地方債現在高欠落／FY1990-2000の市債データ欠落／住基人口・世帯数・面積の年次時系列欠落／令和7年国勢調査確報待ち）。
- UNR-012・UNR-016に関連する新規発見の参照を追記（UNR-016はPhase38のTASK-BACKFILL-002定義を反映）。
- summary集計を再計算（totalItems: 16→21）。

### 2-5. UI修正（低リスクの表記・実装是正）

- `src/pages/DataStatusPage.tsx`：委員会所管事項の説明文が実データ（6/6件で所管事項確認済み）と食い違っていた点を是正（Phase41指摘）。「件数不整合」カードが`dataQualitySummary.countConsistencyChecks`の実データではなくハードコードされた文字列だった点を、実データ連動に修正（Phase43指摘）。
- `src/pages/CompareMayorsPage.tsx`：現職市長の関連政策0件表示に、他の0件表示と一貫した補足を追加（Phase43指摘）。

## 3. src/dataへ反映しなかった内容（意図的・理由付き）

- **Phase34**：FY2011-2017の地方債現在高（経路は確立、未実行→UNR-018）、FY1990-2000の市債データ（e-Stat表33、JS UI制約で未取得→UNR-019）。
- **Phase35**：`debtServiceRatioPercent`（公債費比率・旧指標）FY2001-2006の副産物的に判明した値（依頼スコープ外のため今回は見送り）。
- **Phase36**：令和7年国勢調査速報値（**速報であり確定値ではない**ため→UNR-021）、住民基本台帳人口・世帯数・面積の時系列（.xls解析環境なし、スキーマ拡張も必要→UNR-020）。
- **Phase37**：助役6-10代・収入役1-6代/14代以降の日付（NDLクロップ読み取りが既に2回失敗、blocked維持）。
- **Phase38**：1975/1978/1982年市長選挙対立候補（同上blocked維持）、市議選1933-1998年（TASK-BACKFILL-002として定義のみ、実行なし）。
- **Phase39**：TASK-BACKFILL-001の実行（定義の妥当性検証のみ。parserが令和表記専用で平成データ非対応という新たな制約を確認）。
- **Phase42**：市政年表登録候補6件（教育長就任日候補、副議長交代詳細等）。すべて確信度「中」以下のOCR由来候補であり、一次資料での確認前にsrc/dataへは反映していない。

## 4. 品質検証（統合後）

- `npm run validate:data`：errors=0, warnings=15（既存ベースラインと同一）
- `npm run validate:finance`：errors=0, warnings=2（FY1950→FY1954の急変、Phase44の変更とは無関係の既存警告）, info=8
- `npm run validate:completeness`：errors=0, warnings=0
- `npx tsc -b`：クリーン
- `npx oxlint`：クリーン
- `npm run build`：2175/2175ルート + 404.html 生成成功
- `npm run validate:seo`（buildに含む）：0 failures / 0 warnings
- `npm run validate:content`（buildに含む）：0 errors / 0 warnings

## 5. コンフリクト

worker間で同一対象について異なる結論を出したケースは発見されなかった（`conflicting_sources`該当0件）。Phase38が新規発見した「ndl-src-17（宮崎県選挙管理委員会「選挙の記録1」）は市長・市議選を対象外とする」という情報は、他workerの成果と矛盾しない追加知見として記録済み。

## 6. 除外ファイル

`src/data/councilSessions.json`（改行コードのみの差分）、`.claude/settings.local.json`（ローカル専用）は今回もコミットから除外。
