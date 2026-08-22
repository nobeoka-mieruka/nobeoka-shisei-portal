# Phase66 統合チェックポイント（Phase56-65 + 更新履歴監査タスクの統合）

作成日：2026-08-23

## 1. 実行順序（依存関係の遵守）

第1陣（並列8worker）：Phase56（parser改修・単独最優先）、Phase59（人物照合エンジン）、Phase60（市議選backfill）、Phase61（市長選再調査）、Phase62（財政残年度）、Phase63（広報OCR照合）、Phase64（元議員第2巡）、Phase65（UI/検索）。Phase56完了・独立検証（回帰テスト40件成功、`validate:data`変化なしを親エージェントが再実行して確認）後、第2陣としてPhase57+58（一般質問2010s/2000s実投入、統合実行）を開始した。

追加タスクとして、ユーザー指示により更新履歴（`/updates`）の掲載漏れ監査を並行実施した。

## 2. src/dataへ反映した内容

### 2-1. `scripts/lib/minutes-source.mjs`・`scripts/test-minutes-source-parser.mjs`（Phase56）
一般質問取得parserに平成年代対応を追加。令和期の既存ロジック・返り値は完全に温存（fixtureテストで無変化を確認）、平成12年（2000年）〜平成30年（2018年）を実データで動作確認。`classifySpeakerLabel`に「助役」区分を追加。

### 2-2. `src/data/archiveFiscalYears.json`（Phase62）
FY1990-2000の一般会計等ベース地方債現在高を新規登録（11年度全て）。総務省「地方財政状況調査」表33-4の「合計」行から抽出し、10/10の年度間チェーン検証（前年度末残高＝翌年度期首残高）と、FY2000→既存FY2001値との連続性（+1.1%）で裏付け済み。UNR-019を解決。

### 2-3. `src/data/civicTimelineEvents.json`（Phase63）
civic-209（2018年4月組織改編）を新規追加。実PDF画像照合により確定。

### 2-4. `src/data/citySpecialPosts.json`（Phase63）
csp-55（副市長・中間弘、2020年6月25日就任）を新規追加。csp-39（山本一丸副市長、2022年3月25日再任）・csp-41（澤野幸司教育長、2021年9月17日再任）に再任記録を追記。いずれも既存billVotes.jsonの議決記録と実PDF画像照合で確定。

### 2-5. `src/data/formerMembers.json`（Phase64）
fm14（後藤哲朗）の後の経歴（宮崎県議会議員転身、2025年市長選次点落選）を新規確認・追記。

### 2-6. `src/data/updateHistory.json`（追加タスク：更新履歴監査）
2026-08-17（既存最新掲載日）以降、掲載漏れとなっていた本番反映済み変更7件を市民向け表現で追加（詳細は5節）。

### 2-7. `reports/phase33-master-unresolved-ledger.json`（25→26件）
UNR-019を解決。UNR-020（人口・世帯数の.xls解析制約）・UNR-023（一般質問parser）を前進。UNR-026（councilSessions.jsonの平成年代レコード欠落、一般質問backfillの最後のボトルネック）を新規追加。UNR-001〜004・UNR-016のlastCheckedAtと調査履歴を更新。

## 3. src/dataへ反映しなかった内容（意図的・理由付き）

- **Phase57+58の一般質問候補3件**（矢野戦一郎・後藤哲朗・甲斐正幸）：parser改修・人物照合はいずれも解決済みだが、`src/data/councilSessions.json`に2019-06より前のレコードが1件も無く、`validate-data.mjs`がsessionId未登録でエラーとするため、`isPublished: false`のまま据え置いた（UNR-026として新規記録）。councilSessions.jsonへの平成年代会期メタデータ追加は、公式PDF出典・会期種別・開閉会日を正確に構成する必要があり、拙速な追加はデータ品質リスクがあるため今回は見送った。
- **Phase60（市議選1933-1998）**：新規確定選挙0件（推測禁止を遵守、正直に報告）。延岡市史下巻の年表という新リードを発見。
- **Phase61（1975/78/82市長選）**：新規確定候補者0件（既存2回失敗＋Phase48・61で未試行ルートも尽きたことを確認）。
- **UNR-020の実データ統合**：ツール制約は解消（xlsxパッケージで.xls解析可能と実証）したが、スキーマ拡張（世帯数フィールド追加）と30年度分のデータ反映は次フェーズへ持ち越し。

## 4. 品質検証（統合後）

- `npm run validate:data`：errors=0, warnings=15（既存ベースラインと同一、Phase57-58の未マージ分含め新規warningsなし）
- `npm run validate:finance`：errors=0, warnings=2（既存、無関係）, info=8
- `npm run validate:completeness`：errors=0, warnings=0
- `npx tsc -b`：クリーン
- `npx oxlint`：クリーン
- `npm run build`：2201/2201ルート + 404.html（Phase55と同数。今回の追加はいずれも既存アーカイブページ内のレコード追加であり新規ルートを伴わない）
- `npm run validate:seo`（build内）：0 failures / 0 warnings
- `npm run validate:content`（build内）：0 errors / 0 warnings
- `node scripts/generate-search-index.mjs`再実行：2,159件（civicTimelineEvents・citySpecialPosts等の新規レコードを反映）
- `node scripts/generate-quality-summary.mjs`再実行：broken link 11件で変化なし（Phase65の「7件復旧」報告は今回も再現せず、Wayback Machine側の一時的変動と判断し実測値を維持）

## 5. 追加タスク：更新履歴（/updates）監査結果

- 監査範囲：Phase28（`bddc74b`）以降〜現在（`3c3af0b`まで）の全7コミットについて、`src/data`・`src/pages`・`src/components`への実質的な変更（自動生成の集計ファイルのみの変更は除外）を洗い出した。
- 既存の`updateHistory.json`は2026-08-17（`u97`）が最新掲載で、それ以降の本番反映（2026-08-22〜23の3コミット分）が未掲載だった。
- 内部Phase名・commit ID・完全性語彙（completeness／sourceRefs／parser／member mapping等）を市民向け表現に変換し、テーマ単位で7件へ統合して追加した（個々のfiscal-year単位の追加は「財政データを拡充」等にまとめ、細分化しなかった）。
- 未公開のまま（`isPublished: false`）据え置いたPhase57-58の一般質問候補、およびstaging段階のPhase60/61の調査結果は、更新履歴へ一切掲載していない。
- 日付は各コミットの実際のpush日（`git log --date=short`で確認）を使用し、推測していない。
- 品質チェック：日付降順（`sortUpdateHistoryByDateDesc`が処理）、ID重複なし（`u98`〜`u104`を新規発行、既存`u1`〜`u97`と衝突なし）、追加した`linkUrl: "/petitions"`は`src/lib/seo.ts`に実在するルートであることを確認済み。

## 6. コンフリクト
worker間で同一対象について異なる結論を出したケースは発見されなかった。

## 7. 除外ファイル
`src/data/councilSessions.json`（改行コードのみの差分）、`.claude/settings.local.json`（ローカル専用）は今回もコミットから除外。
