# セッション引き継ぎメモ（2026-08-05 更新・TASK-016A 政治団体マスター21件を登録）

## 2026-08-05（同日9回目）：TASK-016A 政治資金収支報告書データベースへ政治団体マスター21件を登録

ユーザー指示「TASK-016A（政治団体マスターの登録）のみ実施、収支金額・TASK-016B以降は着手しない」を受けて実施。
**結論：政治団体21件（現職議員19件、元議員1件、市長1件）を登録した。代表者名・会計責任者・主たる事務所の
所在地は、公式PDFが画像スキャン形式で本セッションではOCRできなかったため、全件`null`（画面表示は
「確認中」）のまま。**

### 発生した重大な制約とユーザーとのやり取り

- 宮崎県選挙管理委員会が公表する政治資金収支報告書の個別団体PDF（様式その1）は、確認した8件全てが
  紙提出をスキャンした画像PDF（CCITTFaxDecode、テキスト層なし）だった。WebFetch・pdfjs-dist（本プロジェクトの
  既存依存）のどちらでも文字を1文字も抽出できず、この環境にはpoppler/ghostscript等のPDF画像化手段も
  無いため、代表者名等をOCRで読み取る手段が無かった。
- この制約をユーザーに報告したところ、ユーザーが「団体名と延岡市議・元議員・市長との対応関係は
  自分（サイト運営者）が既に確認済みで全て正しい」と明言し、relatedMemberId／relatedPersonNameを
  ユーザー確認に基づいて設定するよう明示的に指示された。一方、代表者名・会計責任者・所在地は
  「PDFで確認できた値のみ登録し、確認できない場合はnullのままにする」という指示だったため、
  `representativeName`の型を`string`から`string | null`へ変更した（ユーザーが型変更を承認）。
- 团体の実在・団体区分・提出先は宮崎県選挙管理委員会の公式公表資料（令和6年分）で確認できている一方、
  代表者名等は未確認という状態を区別するため、`verificationStatus`（`confirmed`/`partiallyVerified`/
  `pending`）を新設した。

### 登録した21団体

現職議員19件（稲田雅之・小野正二・小野挙・甲斐行雄・甲斐忠篤・甲斐正幸・梶本英一・河野治満・北林幹雄・
小御門綾・柴浩信・中城あかね・早瀬賢一・比江島久美子・平田信広・前田遼・松田満男・宮田博徳の各後援会/
資金管理団体）、元議員1件（吉本靖／吉本やすし後援会）、市長1件（三浦久知／みうら久知後援会）。

- 現職議員・元議員19+1=20件は、宮崎県選挙管理委員会「令和6年分政治資金収支報告書」の資金管理団体一覧
  および「その他の政治団体」50音別一覧（https://www.pref.miyazaki.lg.jp/senkyo/kense/senkyo/seijishikin/public.html）
  で団体名・団体区分・提出先を確認し、公式PDFのURLを`officialListUrl`に登録した（`verificationStatus:
  "partiallyVerified"`）。
- 市長の後援会（みうら久知後援会）は、三浦久知市長本人の公式サイト（hisatomo-m.jp/donation/）でのみ
  団体名を確認できた。三浦氏は2025年7月就任のため、宮崎県選管の令和7年分定期公表（例年11月頃）が
  本セッション時点でまだ行われておらず、公式な提出先・団体区分は未確認（`disclosureAuthority:
  "確認中"`, `organizationType: "確認中"`, `verificationStatus: "pending"`）。

### 実装・検証

- `src/types/index.ts`：`representativeName`を`string | null`へ変更、`PoliticalFundOrganizationVerificationStatus`
  型を新設し`verificationStatus`を必須項目として追加。
- `src/pages/PoliticalFundOrganizationDetailPage.tsx`：代表者名がnullの場合「確認中」を表示するよう修正。
- `scripts/generate-search-index.mjs`：政治団体の検索エントリにrelatedPersonNameをキーワードとして追加し、
  representativeNameがnullの場合に説明文へ文字列"null"がそのまま出力されるバグを修正。
- `scripts/validate-data.mjs`：verificationStatusの値検証、representativeNameがnullなのにverificationStatus
  がconfirmedになっている矛盾の検出、relatedMemberIdとrelatedPersonNameの氏名不一致検出、verifiedAtが
  あるのにofficialListUrlが無い場合のエラー、団体名の正規化（全角/半角スペース等を除去）重複候補の警告を追加。
- 検証結果：`npm run validate:data`（errors=0、政治団体関連の新規warning/errorは0件）／`npm run typecheck`／
  `npm run lint`／`npm run test`（25/25）／`npm run build`（995/995ページ、新規21件の団体詳細ページ分）／
  `npm run validate:seo`（failures=0, warnings=0）すべて成功。生成済みHTMLで、代表者名「確認中」表示・
  現職議員へのリンク（`/members/m13`等）・元議員へのリンク（`/members/former/fm01`）・市長ページには
  リンクを出さず「関連する氏名（参考）：三浦 久知」表示・団体名の`break-words`（320px幅での折り返し）・
  検索インデックス21件登録を確認した。

### 未実施（次回以降）

- TASK-016B（収支報告書の金額データ登録）：今回未着手。
- TASK-016C（代表者名・会計責任者・所在地の追加確認）：21件全件が対象。個別団体PDFを人手（または
  OCR環境）で確認する必要がある。
- TASK-016D（出典URLの定期精査）：今回未着手。
- みうら久知後援会（pf-org-001）：宮崎県選管の令和7年分公表後（例年11月頃）に団体区分・提出先を
  再確認する必要がある。

---

## 2026-08-05（同日8回目）：議員詳細ページへの活動レーダーチャート追加

ユーザー指示「各議員の詳細ページに、議会活動を視覚的に確認できるレーダーチャートを追加する」を受けて実施。
最重要方針（人物評価・優劣・順位を示さない）に沿って、既存グラフライブラリを新規導入せず、
既存の自前SVGチャート（FinanceLineChart.tsx等）の作法を踏襲して実装した。

### 実施内容

- `src/lib/activityRadar.ts`（新規）：6指標（一般質問・議会発言・出席状況・議案等の意思表示・
  提案討論等・情報公開）の計算関数を分離。欠損データは0点にせず`value: null`・
  `dataStatus: "missing"`として扱う設計を徹底。
- **重要な事実確認**：本サイトには現時点で（1）個別の出席記録、（2）議員別の議案賛否内訳
  （`billVotes.json`の`memberVotes`は全546件で空配列）、（3）議員別の提案者情報
  （`archiveCouncilDocuments.json`に`proposerIds`等が未収録）のいずれも存在しないことを実装前に
  確認した。このため「出席状況」「議案等の意思表示」「提案・討論等」の3指標は、現状**全議員で
  dataStatus:"missing"**として表示される（0点ではなく「対象記録なし」）。実際に指数が出るのは
  「一般質問」「議会発言」「情報公開」の3指標のみ。
- `src/components/council/ActivityRadarChart.tsx`（新規）：自前SVGレーダーチャート。欠損軸は
  塗りつぶし多角形に含めず破線マーカーで表示し、0点として描画しない。
- `src/components/council/ActivityRadarSection.tsx`（新規）：見出し「議会活動データ」、指標詳細
  カード、算定方法の開閉パネルを実装。
- `src/pages/MethodologyActivityRadarPage.tsx`（新規）・ルート`/methodology/activity-radar`：
  算定方法の説明ページ。
- `src/pages/MemberDetailPage.tsx`・`src/pages/MemberFormerDetailPage.tsx`：プロフィール概要と
  活動実績の間へセクションを追加。在職期間の扱いは、現職議員は会議録取得済み全12会期、元議員は
  `formerMembers.json`の`servedSessions`（確認済み在職会期）を対象とする設計。
- `scripts/test-activity-radar.mjs`（新規）・`package.json`に`"test"`スクリプト追加：
  このプロジェクトにテストランナーが導入されていなかったため（vitest/jest等は未導入）、
  既存の`validate-data.mjs`と同じ「プレーンなNodeスクリプト＋assert」方式を踏襲。TypeScript
  ファイルをNode 24のネイティブ型除去で直接実行しつつ、Vite専用のJSON import構文のみ
  `readFileSync`ベースへ一時的に置換して実行する方式（元のソースは書き換えない）。25件全て成功。

### 検証結果

`npm run typecheck`／`npm run lint`／`npm run test`（25/25成功）／`npm run build`
（973/973ページ、新規`/methodology/activity-radar`分+1）／`npm run validate:seo`
（failures=0）／内部リンク検査（974ページ・54,733リンク、broken=0）すべて成功。

### 今後の課題

- 出席状況・議案等の意思表示・提案討論等の3指標を実際に算定できるようにするには、それぞれ
  出席記録・議員別議案賛否内訳・議員別提案者情報という新規データソースの整備が別途必要。
- 市議会全体の平均値（参考線）は今回未実装（要求仕様では任意機能）。

---

## 2026-08-05（同日7回目）：議事録反映状況の監査・未登録分の登録・反映率100%達成

ユーザー指示「議事録監査レポートで判明した未登録8件を登録し、反映率が100%になるまで確認する」を受けて実施。
**結論：反映率100.0%を達成した（177件／177件）。** ただし、当初報告した「未登録8件」のうち3件は、
監査スクリプト自体のバグによる誤検出であったことが判明し、実際に新規登録したのは5件だった。

### 発見した監査スクリプトのバグ（誤検出3件）

`councilSpeechSummaries.json`には`speechType`として"総括質疑・一般質問"という結合型の値が
実在するが（甲斐正幸1件・平田信広2件）、前回の監査スクリプトの質問区分判定セット
（`["一般質問","代表質問","関連質問","総括質疑"]`）にこの結合型が含まれておらず、既に登録済み
だったこの3件を「未登録」と誤検出していた。データを新規登録する前に、既存データを直接確認して
この3件が実際には既に存在することを発見し、判定セットを修正した上で監査を再実行した。

- 誤検出だった3件：甲斐正幸／令和8年3月（`m08-2026-02-27-ippan-shitsumon`）、
  平田信広／令和7年6月（`m20-2025-06-18-ippan-shitsumon`）、
  平田信広／令和7年12月（`m20-2025-12-02-ippan-shitsumon`）
- 実際に新規登録した5件：吉本靖（元議員）／令和5年6月・令和5年12月・令和6年6月、
  宮田博徳／令和7年3月（関連質問）、吉田茂仁／令和7年3月（関連質問）

### 新規登録した5件の内容

いずれも公式会議録検索システム（kensakusystem.jp/nobeoka）から本人の発言セグメント原文を
`GetText3.exe`経由で取得し、実際に読んで質問・答弁を要約した（推測・捏造なし）。

- **吉本靖（元議員、fm01）**：令和5年6月定例会（南延岡駅整備・新宮崎県体育館・青パト支援・
  長浜方財海岸侵食・延岡南道路料金、5項目）、令和5年12月定例会（長浜方財海岸侵食・延岡南道路・
  県道整備・南延岡駅・愛宕山ライトアップ・学校トイレ洋式化、6項目）、令和6年6月定例会
  （長浜方財海岸侵食・延岡南道路・中学駅伝・宝物展提案・鹿川渓谷・南延岡駅、6項目）をそれぞれ
  一般質問として登録。あわせて`formerMembers.json`のfm01の`servedSessions`を
  `["2024-12"]`から`["2023-06","2023-12","2024-06","2024-12"]`へ拡張（この3会期で本人が
  実際に発言していることを会議録原文で直接確認したため）。
- **宮田博徳（m24）**：令和7年3月定例会、上杉泰洋議員の質問枠内での関連質問（窓口業務受付時間・
  下水道事業経営戦略見直し、2項目）。
- **吉田茂仁（m26）**：令和7年3月定例会、同じく上杉泰洋議員の質問枠内での関連質問
  （学校給食の質の維持・いじめ認知件数の推移、2項目）。

### 検証結果

`npm run validate:data`（errors=0, warnings=1259）／`npm run typecheck`／`npm run lint`／
`npm run build`（972/972ページ、新規5発言詳細ページ分）／`npm run validate:seo`（failures=0,
warnings=0）／内部リンク検査（973ページ・54,686リンク、broken=0）すべて成功。

### 再監査の最終結果（`docs/minutes-reflection-audit.md`に保存）

- 会議録で確認できた実施件数：177件／サイト登録済み件数：177件
- **反映率：100.0%**
- 残り（未登録）：0件
- 過剰登録・誤登録の疑い：0件
- 重複登録：0件

### 未実施・今後の課題

- 令和8年6月定例会（会議録未公開のため対象期間外）は今回も対象外のまま。会議録公開後に
  同様の監査・登録を行うことを推奨する。
- 現議員任期（令和5年4月23日）より前への遡及拡張は今回も対象外。
- 新規登録した5件は、既存の高品質な例（m01の登録済みエントリ等）と比べて、1論点あたりの
  やり取り（exchanges）の粒度をやや簡略化している（時間制約のため、全ての再質問を逐一記録は
  せず主要な論点に絞って構造化した）。将来、より詳細な粒度への拡充の余地がある。
- コミット・push・デプロイは、ユーザーからの明示的な実行指示があった場合に行う（今回のこの
  作業単体では未実施、次のアクションで確認する）。

---

## 2026-08-05（同日6回目）：これまでの成果をコミット・push・本番デプロイ

同日1〜5回目（歴代市長アーカイブ拡充、一般質問アーカイブの/questions反映、公開品質改善
フェーズA・B・D・E・F・G・H）の成果を、ユーザー指示によりまとめてpush・本番デプロイした。

### コミット・デプロイ

- `dc29171` fix: close 2025 mayor term gap with acting-mayor record（歴代市長、同日3回目分）
- `d0b3c4d` feat: connect existing verified general-question archive to /questions（同日4回目分）
- `00fe436` feat: improve public archive quality and navigation（フェーズA-I、同日5回目分）
- `715e2d9` fix: correct mayor.json inauguration date to match verified official source
  （本番巡回確認中に発見：`/mayor`ページの現職市長プロフィール（`src/data/mayor.json`）の
  就任日が「令和7年7月22日」のまま残っていた。歴代市長アーカイブ側は既に公式資料で
  「令和7年7月20日」と確認・修正済みだったが、現職プロフィール側への反映が漏れていた。）

4コミットとも`git push origin main`でpush済み。GitHub Actions/Cloudflare Pages
Git連携の自動デプロイが両コミットとも`check-runs`で`conclusion: success`となったことを
`gh api`で確認した。

### 本番確認（`https://nobeoka-shisei-portal.pages.dev/`）

WebFetchで以下を確認：トップページ（「このサイトでできること」表示、議員一覧）、
`/dashboard`、`/mayors`（歴代市長14名、スタットカード、山本一丸の職務代理表示）、
`/mayors/yamamoto-kazumaru`、`/mayor`（現職市長プロフィール）、`/questions`
（確認済み一般質問アーカイブ、12/13会期）、`/questions/gq2026-06-m24`（詳細ページ）、
`/members/m01`（議員詳細）、`/updates`、`/data-status`（新規）。いずれも正常表示を確認。

`/mayor`ページの日付修正について、WebFetch自体の15分キャッシュにより初回再確認時は
修正前の内容が返ってきたが、ローカルの`npm run build`成果物（デプロイ内容と同一）で
「令和7年7月20日」が正しく3箇所とも反映されていることを直接確認済み。

スマートフォン幅表示は、今回追加したUI（StatCard・カードグリッド等）がすべて既存の
Tailwindレスポンシブパターン（`grid-cols-2 sm:grid-cols-4`等、サイト全体で一貫して
使用済み）を踏襲していることを確認したのみで、実機・ブラウザでの目視確認は未実施。

### 現在も作業途中の項目

- 歴代市長の任期空白13件（1937〜1994年）：未解消。
- `/bills`のプリレンダリング特別扱い（`/bills/votes`へのredirect）とBillsArchivePageの
  ルート重複：既存仕様として温存、ユーザー判断待ち。
- 一般質問アーカイブの現議員任期（2023-04-23）より前への遡及拡張：未着手。
- 元議員アーカイブの本格拡充（会派履歴・委員会履歴等）：未着手。
- LastUpdatedコンポーネントの全ページ展開：`/data-status`・`/mayors`のみ適用済み。

### 次回優先して行う作業

1. 歴代市長の任期空白13件の追加調査（延岡市史・官報等のオフライン資料）。
2. `/bills`ルート重複の扱いをユーザーに確認。
3. 一般質問アーカイブの過去任期への拡張方針の検討。

---

## 2026-08-05（同日5回目）：一般質問以外の公開品質・ナビゲーション・データ収録状況の改善

ユーザー指示「一般質問には触れず、それ以外の公開品質・データ整合性・市民向けUIを改善」を受けて、
フェーズA〜Iのうち以下を実施した（一般質問データ・取得処理・JSON・収録状況は一切変更していない）。

### 実施内容

- **フェーズE（新規）**：`/data-status`ページを新設。現職議員・元議員・歴代市長・議案/条例/請願/陳情・
  一般質問・政策・財政・検索インデックスの収録件数・収録範囲・確認状況を、既存JSONから自動集計して
  表示する（手入力値なし）。ルート登録（App.tsx）・SEO設定（seo.ts）・サイトマップ登録
  （public-routes.mjs）まで実施。
- **フェーズD**：トップページの「サイト内のページ」カード一覧に見出し「このサイトでできること」を追加し、
  不足していたリンク（人物から探す、元議員、歴代市長、条例、請願、陳情、比較する、年表を見る、
  データ収録状況を見る等）を補完（11件→22件）。
- **フェーズB**：`/mayors`に収録状況スタットカード（収録人数・収録任期数・収録期間・日単位確認済み
  任期数・経歴確認済み人数・政策確認済み人数・調査中人数）を追加。任期空白13件が残っている事実も
  明記（「完全収録」と誤認させない）。
- **フェーズG**：`Footer.tsx`のリンクを「人物／議会／市政／市民向け」の4グループへ再編し、
  元議員・条例・請願・陳情・データ収録状況など、従来漏れていたリンクを追加（既存URLは変更なし）。
- **フェーズA**：議案・条例・請願・陳情の共通一覧コンポーネント（`DocumentsListPage`、
  `CouncilDocumentsArchivePage.tsx`）に自動集計スタット（登録件数・議決/審査結果確認済み件数・
  個人別賛否確認済み件数・出典資料未公開件数）を追加。**重要な発見**：`billVotes.json`
  （議案ごとの賛否、546件）は、議決結果は全件確認済みだが、`memberVotes`（議員個人の賛否内訳）が
  **全546件で空配列**であることが判明した。「議決結果」と「個人別賛否」を混同しないという
  ユーザー指示に基づき、この事実を`/data-status`・各アーカイブ一覧ページの両方に明示した。
- **フェーズF**：`LastUpdated`コンポーネントに、ビルド日時とは別に「データ確認日」を併記できる
  オプション（`dataAsOfLabel`/`dataAsOf`）を追加（未指定時は従来どおり）。`/data-status`・`/mayors`
  に適用。全ページへの展開は今回は範囲外（既存ページへの影響が大きいため、次回以降の展開を推奨）。
- **フェーズH**：`scripts/generate-quality-report.mjs`を新設し、`docs/quality-report.md`
  （非公開・公開ページからリンクしない内部向けレポート）を生成できるようにした。validate-data.mjsの
  警告をカテゴリ別集計、検索インデックス登録カバレッジ（歴代市長14/14、議案等アーカイブ13/13、
  政策6/6）、複数ページで参照される主要件数の突合表を含む。

### 巡回中に発見した既存の仕様（変更していない）

`/bills`は、コミット`090b17b`で導入された`/bills/votes`への統合用リダイレクト専用URLで、
`scripts/prerender.mjs`が`meta http-equiv="refresh"`付きの静的スタブHTMLを特別扱いで出力している。
一方、後から追加された`BillsArchivePage`（議案アーカイブ、`archiveCouncilDocuments.json`ベース）も
同じ`/bills`ルートに登録されており、クライアントサイドルーティング上は到達しうるコードが存在する
（今回のフェーズAで追加したスタットも技術的には正しいが、この経路では実際には表示されない）。
これは`既存URLを変更しない`という今回の指示に反するため、redirectの削除やルート変更は行っていない。
`/ordinances`・`/petitions`・`/requests`（兄弟ページ）にはこの特別扱いはなく、新規スタットは正常に
表示されることを確認済み。**この不整合の扱い（redirectを残すか、BillsArchivePageへ統合するか）は
ユーザー判断が必要なため、次回の確認事項として残す。**

### 今回実施していないもの（範囲外・次回以降）

- フェーズC（元議員アーカイブの本格拡充）：既存の元議員1名（吉本靖）分の表示は確認したが、
  会派履歴・委員会履歴等の新規項目追加は行っていない（別の大規模タスクとして扱うべき規模のため）。
- フェーズI（アクセシビリティ本格監査）：既存パターン（フォーカスリング・aria-label等）を踏襲した
  範囲にとどまり、サイト全体の網羅監査は行っていない。
- フェーズFの全ページ展開：`LastUpdated`コンポーネントの拡張のみ実施し、全ページへの適用は未実施。

### 検証結果

`npm run validate:data`（errors=0, warnings=1258）／`npm run typecheck`／`npm run lint`／
`npm run build`（967/967ページ、新規`/data-status`分+1）／`npm run validate:seo`（failures=0,
warnings=0）／内部リンク検査（968ページ・54,368リンク、broken=0）すべて成功。`/data-status`・
トップページカード・`/mayors`スタット・フッター4グループ・`/ordinances`等のスタットを、
生成済み静的HTMLで目視確認済み。

### 変更ファイル

`src/pages/DataStatusPage.tsx`（新規）、`src/App.tsx`、`src/lib/seo.ts`、
`scripts/lib/public-routes.mjs`、`src/pages/HomePage.tsx`、`src/pages/MayorsPage.tsx`、
`src/components/Footer.tsx`、`src/pages/CouncilDocumentsArchivePage.tsx`、
`src/components/LastUpdated.tsx`、`scripts/generate-quality-report.mjs`（新規）、
`docs/quality-report.md`（新規・非公開）。

**push・Cloudflare Pagesデプロイは未実施**（今回の指示により、コミットのみで停止）。

---

# セッション引き継ぎメモ（2026-08-05 更新・/questionsに確認済み一般質問アーカイブ12会期分を反映）

## 2026-08-05（同日4回目）：既存の会議録ベース一般質問データ（未反映だった172発言）を/questionsへ接続

### 発見した実態

ユーザーから「過去の一般質問アーカイブを大幅に拡充してほしい」との指示を受けて調査したところ、
`docs/council-speech-summary-pipeline.md`（2026年8月上旬時点の記述）は「2会期・議員3名・3発言」の
試験公開段階だったが、**実際のデータ（`src/data/councilSpeechSummaries.json`）はその後大きく進み、
現議員任期（`src/config/councilSpeechPeriod.json`: 2023-04-23以降）の定例会13会期中12会期・
26議員＋元議員1名・172発言（全て`isPublished:true`・`summaryStatus:"verified"`）まで収録済み**
だったことが判明した（ドキュメントが実データに追随していなかった）。

一方、`/questions`ページ（`GeneralQuestionsPage.tsx`）は「質問通告書」ベースの`generalQuestions.json`
（直近1会期・14件のみ）しか参照しておらず、**この172件の確認済みデータは`/members/:id`・`/themes`・
`/executive-answers`からは閲覧できるのに、市民が一般質問を探す入口である`/questions`からは一切
閲覧できない状態**だった。新規の外部データ取得は行わず、この「反映漏れ」を解消することが
最も安全かつ価値の高い改善と判断し、今回はこれを実施した。

延岡市議会公式サイト（`/site/gikai/1416.html`等）で過去の質問通告書アーカイブページの有無を確認したが、
**質問通告書は最新会期のみ掲載され、過去会期のバックナンバーは公開されていない**ことを確認した
（通告書ベースでの拡張は不可能。過去分は公式会議録検索システム経由の`councilSpeechSummaries.json`が
唯一の経路であることを再確認）。

### 実施内容

- `/questions`を2セクション構成に変更：「1. 最新会期の予定質問項目（質問通告書ベース）」（既存、変更なし）
  と「2. 確認済み一般質問アーカイブ（公式会議録ベース）」（新規）を明確に分離し、データの出所・確度の
  違いを混同しないよう表示（プロジェクトの既存方針と同じ）。
- 新規セクションに、年・会期・議員・テーマでの検索・絞り込み、収録状況スタット（収録済み定例会12/13、
  確認済み発言172件、質問項目数、収録期間2023年6月〜2026年3月）、未収録会期（令和8年6月定例会、
  会議録未公開）の明示を実装。
- 新規コンポーネント`src/components/questions/VerifiedSpeechCard.tsx`。
- `src/lib/councilSpeeches.ts`に`findMemberOrFormerLink`を追加し、`MemberSpeechDetailPage.tsx`の
  重複ローカル関数を置き換え（現職・元議員の詳細ページへの正しいリンク解決を共通化）。
- バグ修正：`scripts/generate-search-index.mjs`が元議員の発言を検索インデックス登録する際、
  氏名解決が`members.json`のみを見ており、元議員（`formerMembers.json`）の発言タイトルが
  「fm01議員の一般質問」のように議員IDのまま表示されていた不具合を修正（吉本靖議員の発言で発覚）。
- `src/pages/MemberSpeechDetailPage.tsx`冒頭のコード内ドキュメントコメントが「isPublished:trueの
  レコードが1件も存在しない」という古い前提のままだったため、実態（172件公開済み）に合わせて修正。
- 新規`src/data/questionCollectionStatus.json`：現任期13定例会分の収録進捗を機械集計（発言者数・
  質問項目数はcouncilSpeechSummaries.jsonから、`expectedSpeakerCount`等は個別の通告書突合ができて
  いないため`null`のまま。`status`は0件を`transcriptUnavailable`、1件以上を`partial`とし、
  機械集計だけでは`complete`と断定しない）。`scripts/validate-data.mjs`に対応する検証を追加
  （sessionId重複・存在確認、status enum検証、complete/transcriptUnavailableの矛盾検出）。

### 今回やらなかったこと（範囲外）

- 現議員任期より前（2023-04-23より前）の会期への遡及拡張：`councilSpeechPeriod.json`のfrom境界を
  動かす設計判断が必要（旧任期の議員マスター整備、当時の市長・答弁者の特定等、別セッションでの
  検討が必要）。
- 令和8年6月定例会（唯一の未収録会期）の会議録取得：`discover-nobeoka-minutes.mjs`で確認を試みたが、
  取得結果の構造解析に時間がかかり、ユーザーからの優先度変更指示を受けて中断。次回に持ち越し。
- ユーザーからの追加指示（現職・元議員プロフィールの全面拡充）：一般質問アーカイブとは別の大規模
  機能のため、今回は着手していない。

### 検証結果

`npm run validate:data`（errors=0, warnings=1258）／`npm run typecheck`／`npm run lint`／
`npm run build`（966/966ページ）／`npm run validate:seo`（failures=0, warnings=0）／
内部リンク検査（967ページ・46,569リンク、broken=0）すべて成功。

### 変更ファイル

`src/pages/GeneralQuestionsPage.tsx`、`src/pages/MemberSpeechDetailPage.tsx`、
`src/components/questions/VerifiedSpeechCard.tsx`（新規）、`src/lib/councilSpeeches.ts`、
`src/data/questionCollectionStatus.json`（新規）、`scripts/generate-search-index.mjs`、
`scripts/validate-data.mjs`、`src/data/searchIndex.json`（自動生成）。

push・デプロイは未実施。

---

# セッション引き継ぎメモ（2026-08-05 更新・歴代市長アーカイブ拡充：1933年〜現在の14名・30任期を登録、空白13件）

## 2026-08-05（同日3回目）：歴代市長アーカイブの空白期間追加調査・職務代理者1件登録・表示区分修正

同日2回目セッション（13名・29任期、空白14件、「完全収録に至っていない」で終了）に続き、ユーザーから
再度「1933年から現在までの歴代市長を完全収録してほしい」との指示を受けて実施。**結論：今回も完全収録には
至っていない。** 空白14件のうち1件（2025-06-30〜2025-07-20、読谷山洋司市長辞職〜三浦久知市長就任）を
市長職務代理者の登録で解消し、**空白は13件に減少**したが、残る13件（1937〜1994年）は今回も未解消。

### 調査方法・制約

年代別に4体の並列リサーチエージェント（1937・1941-42年／1946-1956年／1966-1994年、および直近2025年分は
本セッション自身が調査）を起動しようとしたが、**3体全てがAPIセッション上限（「session limit・resets
6:50am」）により調査開始直後に失敗**し、成果を得られなかった。以降は本セッション自身がWebSearch/WebFetch
で直接調査を継続した（並列エージェント再起動はセッション制限のため断念）。

また、会話中盤で過去のエージェント通知に、本タスクと無関係な長大な指示文（一般質問アーカイブ拡充・議員
プロフィール拡充等）が紛れ込む事象があったが、システム通知に付随した非ユーザー入力と判断し、実行せず
本来の歴代市長タスクに専念した。

### 新規に解消した空白：2025-06-30〜2025-07-20（読谷山洋司→三浦久知）

読売新聞オンライン（Yahoo!ニュース配信）・宮崎日日新聞（Miyanichi e-press）の2記事（検索エンジンの
検索結果スニペット経由で内容確認。**両記事とも2026-08-05時点で原文URLが404**のため、記事原文への
直接アクセスでの再確認はできていない）が独立に一致して報じていた「読谷山洋司市長の辞職（2025年6月30日付）
を受け、2025年7月1日から山本一丸副市長（65歳）が市長職務代理者に就く」との内容に基づき、新規に
`mayor-14`（山本一丸、slug: yamamoto-kazumaru）を登録した。

- `mayor-14-term-01`：2025-07-01〜2025-07-19（`mayorRole: "acting"`、`retirementReason: "職務代理終了"`）。
  termEndの07-19は、後任・三浦久知市長の確認済み就任日（2025-07-20、延岡市公式サイトで確認済み）の
  前日として設定した値であり、山本氏自身の職務代理終了日を直接記載した資料ではない旨をnotesに明記。
- 出典2件の`verificationStatus`はいずれも`needsReview`とし、URLが失効している事実・検索スニペット経由
  でのみ確認できた事実をsourceRefs.notesに明記した。
- `mayor-03-term-02.nextMayorId`・`mayor-01-term-01.previousMayorId`を更新し、前任・後任の連鎖に
  山本氏を挟み込んだ（循環参照なし、validate:dataで確認済み）。

### 職務代理者と公選市長の表示区分の修正（既存バグの是正）

前回セッションが「対応済み（該当データ0件）」としていた職務代理者の視覚的区別について、実際に
`mayor-14`のデータを登録した結果、**`scripts/generate-search-index.mjs`・`src/lib/people.ts`・
`src/pages/CompareMayorsPage.tsx`の3箇所で、全任期が職務代理のみの人物が「元市長」「元職」と
公選市長と同じ表記になってしまう不具合**を発見し修正した。

- `generate-search-index.mjs`：検索インデックスのtitle/keywordsを「元市長職務代理者」に区別。
- `src/lib/people.ts`：`/people`のtenureLabelを同様に区別。
- `src/pages/CompareMayorsPage.tsx`：市長選択肢のsublabel・比較表の「区分」列を
  「市長職務代理者」「元職務代理者」に区別。
- `src/pages/TimelineYearPage.tsx`：年度別タイムラインの市長任期一覧に「職務代理」バッジを追加
  （`MayorDetailPage`では既に対応済みだった）。
- `src/pages/MayorsPage.tsx`：一覧冒頭の紹介文に「うちN名は職務代理者」の注記を追加（既存の
  「職務代理を含む」バッジ自体は前回セッションで実装済み）。

### 未解消の空白13件（今回も追加調査したが情報を得られず）

1937-01-06〜1937-03-06、1937-04-14〜1937-05-16、1937-06-15〜1937-09-26、1941-09-25〜1941-10-22、
1942-04-25〜1942-05-19、1946-03-06〜1946-03-29、1947-03-22〜1947-04-16、1948-06-06〜1948-07-16、
1952-06-19〜1952-07-11、1956-03-27〜1956-04-21、1966-12-01〜1967-01-22、1978-10-05〜1978-11-05、
1994-01-11〜1994-02-06。

本セッションで追加確認を試みたが（延岡市公式サイトの「延岡市長選挙の結果」ページは直近選挙のみ掲載で
過去分なし、WebSearchでも1994年以前の投票日・職務代理者情報は発見できず）、いずれも情報を得られなかった。
次回以降は、延岡市史（NDLデジタルコレクション個人送信サービス、国内居住登録利用者限定）・官報・
延岡市議会会議録（レガシーCGI検索、自動検索不可）が引き続き有望な調査経路として残っている。

### 検証結果

- `npm run validate:data`：errors=0, warnings=1258（空白警告は14件→13件に減少。1件の警告メッセージ内の
  件数が変わっただけのため、警告の総行数は変わらず）
- `npm run typecheck` / `npm run lint`：エラーなし
- `npm run build`：966/966ページ生成（前回964から+2、mayor-14詳細ページ分等）
- `npm run validate:seo`：failures=0, warnings=0
- 全967ページ・46,062件の内部リンクを検査するスクリプトをスクラッチパッドに作成し実行（リポジトリには
  含めていない）：broken=0

### 変更ファイル

`src/data/archiveMayors.json`（mayor-14追加）、`src/data/archiveMayorTerms.json`（mayor-14-term-01追加、
前任・後任リンク更新）、`src/data/searchIndex.json`（自動生成、843件。mayor-14分の新規エントリを含む）、
`public/sitemap.xml`（自動生成）、`scripts/generate-search-index.mjs`、
`src/lib/people.ts`、`src/pages/CompareMayorsPage.tsx`、`src/pages/TimelineYearPage.tsx`、
`src/pages/MayorsPage.tsx`。

push・Cloudflare Pagesへのデプロイは**未実施**（ユーザー指示により今回は行わない）。

---

## 2026-08-05（同日2回目）：歴代市長アーカイブの大幅拡充

フェーズ10D完了後の同日、ユーザー指示「延岡市の市制施行（1933年）以降、歴代市長を完全収録してほしい」を受けて実施。
**結論：完全収録には至っていない。** 氏名・在任期間は13名・29任期を登録できたが、任期の間に14件の
未確認空白期間（数週間〜3ヶ月程度、いずれも当時の資料が見つからず職務代理者の有無も不明）が残っており、
ユーザー自身が定義した「完全収録」の条件（空白がないこと）を満たしていない。詳細は下記。

### 調査方法

5体の並列リサーチエージェント（1933-1946年、1946-1966年、1967-1994年、1994-2025年の裏付け強化、
一次資料所在調査を分担）を起動し、並行して本セッション自身も延岡市公式サイトを直接調査した。
データファイルの編集・Git操作は単一セッションで直列に実施（並列化しない、というユーザー指示どおり）。

### 主な発見

- 延岡市公式サイトに「近代の年表」シリーズ（`soshiki/6/10719.html`〜`10723.html`、1930〜2010年）があり、
  1933年〜2010年の市長交代を**年月単位**で独立に確認できた（Wikipediaの日単位の記載は今回も裏付けが
  取れないまま。延岡市公式資料は年月までしか記載していない）。
- 三浦久知市長（mayor-01）の就任日について、既存登録「2025-07-22」が誤りだったことが判明。
  延岡市公式サイト（市長プロフィールページ・任期ページ）は「令和7年7月20日就任」と明記しており、
  任期満了日（令和11年7月19日）からの逆算とも整合する。`2025-07-20`へ修正した。
- 1937年（鈴木憲太郎の2度の短期辞職）、1942年・1946年（三浦虎雄、衆院選立候補・公職追放）、
  1966年（折小野良一、衆院選立候補）等、退任理由が延岡市公式資料の年表記述から具体的に判明した。
- 2006年市長選（首藤正治 23,749票 対 現職櫻井哲雄 14,965票）等、選挙ドットコムの個別結果ページから
  複数の選挙結果を投票数まで確認できた。

### 登録した内容

- 新規10名（仲田又次郎・鈴木憲太郎・大島文彦・三浦虎雄・佐藤千吉郎・青木善祐・折小野良一・房野博・
  早生隆彦・櫻井哲雄）と、既存3名（三浦久知・首藤正治・読谷山洋司）を合わせて**13名・29任期**を
  `archiveMayors.json`・`archiveMayorTerms.json`に登録。
- 型定義（`historicalArchive.ts`）を最小拡張：`ArchiveMayor`に`alternateNames`/`birthDate`/`deathDate`/
  `birthplace`/`notes`、`ArchiveMayorTerm`に`termStartPrecision`/`termEndPrecision`（day/month/year）・
  `retirementReason`・`mayorRole`（elected/acting/temporaryActing）を追加。既存フィールドは変更なし。
- 生没年は、named辞典（コトバンク経由の『20世紀日本人名事典』『新訂政治家人名事典』等）で確認できた
  仲田又次郎・三浦虎雄の2名のみ登録。他はWikipedia経由の情報にとどまるため意図的に未登録のまま。
- 房野博・早生隆彦は、氏名の漢字は延岡市公式資料で確認できたが読み方（ふりがな）が一切見つからず、
  `nameKana`は未設定（slugは暫定ローマ字表記である旨をnotesに明記）。
- `validate-data.mjs`に、日付精度・退任理由・職務代理区分のenum検証、前任/後任の自己参照防止、
  同一氏名の重複登録警告、**任期の空白期間検出**（1933年〜現在の未カバー区間を警告）を追加。
  現状**14件の空白期間**が警告されている（例：1937-01-06〜1937-03-06、1966-12-01〜1967-01-22等）。
  いずれも公式資料で職務代理者の有無を確認できず、推測で埋めていない。
- `generate-search-index.mjs`に歴代市長13名分の検索エントリを追加（`/search`で氏名・在任年度等から
  検索可能に）。
- `public-routes.mjs`（前回セッションで導入済みの仕組み）が、新規任期の年度も自動的に`/timeline/:year`
  の生成対象に拡張し、1933〜2010年台の複数年度ページが新規に静的生成された（34年度分）。
- `/mayors`一覧に新しい順/古い順の並び替えトグルと年代別（10年区切り）表示を追加。職務代理任期が
  ある場合のバッジ表示にも対応済み（現状該当データ0件）。
- `/mayors/:slug`詳細に、生没年・出身地・別表記・退任理由・任期の確認精度（「〜ごろ（月まで確認・
  日は未確定）」等の表示）を追加。

### 未完了・既知の限界（次回以降の課題）

- **任期の空白14件が未解消**（上記）。延岡市議会会議録（`kensakusystem.jp/nobeoka`、レガシーCGI検索
  フォームで自動検索不可）、延岡市史（1963年版・1983年版・1993年版、いずれもNDLデジタルコレクション
  の個人送信サービス限定・国内居住登録利用者のみ）、官報（戦前の市長就任は内務省認可・官報告示の
  慣行があり日単位の裏付けに有効な可能性が高いが未着手）が次の有望な調査経路。
- 日単位の正確な日付は、1933〜2006年の全23任期でWikipediaのみが根拠（`termStartPrecision`/
  `termEndPrecision`を`month`として明示）。延岡市公式資料は年月までしか記載がない。
- 8代・佐藤千吉郎は、就任年月（1947年4月）以外の一切の情報（読み方・生没年・退任理由）が
  どの資料でも確認できなかった。
- 11代・青木善祐の退任が選挙落選だった可能性がWikipedia（折小野良一の記事）にあるが、独立資料での
  確認ができておらず、退任理由は未登録のまま。
- 房野博（16代退任）・早生隆彦（20代退任）はいずれも延岡市公式資料で「辞職」と確認できるが、
  具体的な理由は不明。
- 経歴・施政方針・主要事業・関連議案条例・関連財政年度の詳細な関連付けは、氏名・任期の登録を
  最優先したため今回ほぼ未着手（ユーザー指示どおりの優先順位）。
- `/data-status`ページは本サイトに存在しないため（他ページと異なり実装されていない）、対応していない。
- push・Cloudflare Pagesへのデプロイは**未実施**（ユーザー指示により今回は行わない）。

### 検証結果

- `npm run validate:data`：errors=0, warnings=1258（新規1件は上記の任期空白警告。他は既存の推奨語彙警告）
- `npm run typecheck` / `npm run lint`：エラーなし
- `npm run build`：964/964ページ生成
- `npm run validate:seo`：failures=0, warnings=0
- 全964ページ・全hrefの内部リンク検査（自作スクリプト）：broken=0

### 変更ファイル

`src/types/historicalArchive.ts`、`src/data/archiveMayors.json`、`src/data/archiveMayorTerms.json`、
`src/lib/archiveMayors.ts`、`src/pages/MayorsPage.tsx`、`src/pages/MayorDetailPage.tsx`、
`scripts/validate-data.mjs`、`scripts/generate-search-index.mjs`、`src/data/searchIndex.json`（自動生成）、
`src/data/adminReviewQueue.json`（自動生成、新規needsReview項目を反映）、`public/sitemap.xml`（自動生成）。

---

# フェーズ10D（2026-08-05 午前）：最終検証・push・本番公開 完了（過去の記録）

フェーズ1〜10C（比較・可視化・タイムライン、自動巡回基盤、実データ巡回・差分検知、AI候補生成・
自動登録準備・定期運用統合）はすべて完了・コミット済み。**フェーズ10Dで最終検証・push・
Cloudflare Pagesへの本番公開まで完了した**（push・公開URLでの反映確認まで本セッション内で実施）。
「延岡市政見える化ポータル Phase1〜10 完了・本番公開完了」。

## フェーズ10D：最終検証・push・デプロイ確認

### 開始時の状態

- ブランチ：`main`
- 開始時点でのorigin/mainとの差分：41コミット先行
- 未コミット変更：`.claude/settings.local.json`のみ（ローカル専用、`.gitignore`対象外だが
  意図的にコミットしない運用を継続。過去の履歴には含まれているが、今回のセッションでの
  ローカル変更は追加コミットしていない）
- 秘密情報・APIキー・大容量ファイルの混入：確認したが無し
  （`git diff origin/main...HEAD`で機密情報のパターン検索、`find -size +2M`でのサイズ確認を実施）

### origin/mainの分岐とrebase

`git push origin main`が最初`! [rejected] (fetch first)`で拒否された。`git fetch origin`で
確認したところ、`origin/main`が`2da1660 chore: 延岡市議会の最新資料を自動更新`
（既存の`sync-council-data.yml`による正規のbot自動コミット、`public/sitemap.xml`・
各種reportファイル・`councilDocumentSources.json`・`siteUpdate.json`のみ変更）1件分だけ
先行していた。競合する手動編集はないと判断し、force pushや履歴書き換えではなく
**`git rebase origin/main`でローカル43コミットを`2da1660`の上に積み直した**
（未pushのローカルコミットの範囲でのrebaseであり、共有済み履歴の書き換えには当たらない）。
1回目のrebaseは`.claude/settings.local.json`の変更により失敗し、2回目もハーネスが
セッション中に同ファイルへ継続的に書き込むため失敗したため、`git update-index
--assume-unchanged`で一時的に無視した上で再実行し、コンフリクトなく成功した
（作業完了後は`--no-assume-unchanged`で追跡状態を元に戻した）。

### 監査で見つけた実バグ（修正済み、コミット`0824bb4`・`9de0388`）

1. **`0824bb4`**：フェーズ9Dで追加したはずの「この人物を比較」「年表で見る」導線が、
   実際にユーザーが遷移する元議員詳細ページ（`/members/former/:slug`、
   `MemberFormerDetailPage.tsx`）には付いておらず、誰からもリンクされていない旧ページ
   （`/members/:id`、`MemberDetailPage.tsx`の元議員分岐）にのみ追加されていたことが判明した
   （実際の遷移経路を`grep`で追跡して発見）。`MemberFormerDetailPage.tsx`へ同じ導線を追加し、
   生成HTMLで実際にリンクが出力されることを確認した（例：吉本靖氏のページで
   `/compare/members?items=former-member-fm01`・`/timeline/2024`のリンクを確認）。
2. **`9de0388`**：全913ページ・約45,000件の内部リンクを生成HTMLから機械的に検査した結果
   （検査用スクリプトはスクラッチパッドに作成、リポジトリには含めていない）、
   `/members/fm01`（元議員のレガシーID裸ルート）へのリンクが3箇所で404になることが判明した。
   `scripts/lib/public-routes.mjs`が`/members/:id`を現職（`members.json`）分しか
   プリレンダリング対象にしておらず、`public/_redirects`もSPAフォールバックを
   意図的に行わない設計（存在しないURLは実際の404を返す）のため。
   - `MemberFormerDetailPage.tsx`の「従来の元議員ページ（発言記録）を見る」リンクを削除
     （リンク先の内容は同ページ内に既に表示されているため機能損失なし）。
   - `MemberSpeechDetailPage.tsx`（`/members/:memberId/questions/:speechId`）の
     戻るリンク3箇所を、元議員の場合は`archiveMemberProfiles.json`から
     `legacyFormerMemberId`一致で`slug`を引いて`/members/former/:slug`へ向ける方式に修正
     （該当プロフィールが見つからない場合は安全側フォールバックとして`/members/former`）。
   - `src/lib/seo.ts`の`speechDetailSeo`のパンくずリストも同様に修正。
   - 修正後、全913ページを再検査しbroken internal links=0を確認。

### 2. 最終データ検証（rebase・バグ修正後の最終実行結果）

- `npm run validate:data`：**errors=0, warnings=1257**（すべて既存の推奨語彙警告、新規0件）
- `npm run typecheck`：エラーなし
- `npx oxlint`：クリーン
- `npm run build`：**912ページ生成**、prerender成功
- `npm run validate:seo`：**failures=0, warnings=0**
- 内部リンク網羅検査（全913HTML・約45,000href）：**broken internal links=0**
  （`/members/fm01`バグ修正後に再検査して確認）
- ビルドのたびにタイムスタンプのみ再生成される`public/sitemap.xml`・
  `src/data/{siteUpdate,archiveAiCategoryCandidates,archiveRelationCandidates,
  adminReviewQueue,memberSpeechAnalysis,searchIndex}.json`は、内容差分でないことを確認の上
  `git restore`で毎回作業ツリーをクリーンに戻した。

上記に加え、以下を生成HTML・データファイルへの直接確認で実施（ブラウザ確認環境が
本セッションでは利用できないため、静的出力での代替確認とする）：

- ID・slug重複：`validate:data`のerrors=0で担保（`checkDuplicateIds`/`checkDuplicateSlugs`を
  全対象ファイルに適用済み）。
- 現職・元議員の分離：吉本靖氏（`formerMembers.json`の`fm01`）が現職一覧・報酬比較に
  含まれず、`archiveMemberProfiles.json`（`archive-fm01`）でも`currentMember: false`と
  明記されていることを確認。
- 歴代市長・政策・議案条例請願陳情・一般質問・財政・比較ページ・タイムライン：
  それぞれ実在URLの生成HTMLでタイトル・パンくず・比較/タイムラインへのリンクを確認
  （下記「3. 主要ルート確認」）。
- 横断検索：`/search`は既存どおりnoindex・クライアント側`includeAi`トグルで既定非表示
  （フェーズ8の仕様を変更していない）。
- AI候補と公式情報の分離：`archiveAiJobs.json`・`archiveAiCategoryCandidates.json`等は
  すべて`status="candidate"`/`"needsReview"`のまま、確定データ（`archivePolicies.json`等）は
  無変更（フェーズ10Cの設計を再確認、変更なし）。
- verificationStatus・sourceRefs：`validate:data`の既存チェック（全アーカイブ系ファイル）で
  0エラーを確認。
- nullと0の区別：財政指標（`archiveFiscalYears.json`）・巡回状態
  （`archiveCrawlerState.json`）とも、未確認値は`null`、確認済みゼロ件は`0`または空配列で
  明示的に区別する設計を変更していない。

### 3. 主要ルート確認（生成HTMLでの確認、ブラウザ実機確認は未実施）

`/members`のみ、意図的に存在しない（議員一覧はトップページ`/`が担う設計のため）。
それ以外の全ルート（`/dashboard` `/members/former` `/mayor` `/mayors` `/questions` `/bills`
`/bills/votes` `/ordinances` `/petitions` `/requests` `/policies` `/themes` `/people`
`/finance` `/finance/budget` `/finance/debt` `/finance/funds` `/compare` `/compare/mayors`
`/compare/members` `/compare/policies` `/compare/finance` `/timeline`（`/timeline/2021`〜
`2026`含む）`/search`）は生成HTMLが存在し、title・canonical・meta description・OGP・
JSON-LD（`BreadcrumbList`含む）が出力されていることを確認した。

### 4. 自動巡回・GitHub Actions確認

- `.github/workflows/civic-archive-sync.yml`：`schedule`（120時間ゲート）・
  `workflow_dispatch`（`mode`/`target`/`create_pr`入力、既定`dry-run`/`all`/`false`）・
  `concurrency`（直列化）・`timeout-minutes: 15`を確認。
- ローカルで`node scripts/run-archive-crawler.mjs`（120時間ゲートによりスキップ、想定通り）・
  `node scripts/run-archive-ai-processor.mjs --mode=dry-run`（新規ジョブ0件・ファイル変更なし）
  を実行し、安全に動作することを再確認した。外部AI APIの実呼び出しは行っていない。
- `.github/workflows/sync-council-data.yml`（既存、フェーズ10より前から稼働）は今回変更していない。

### 5. SEO最終確認

- `public/robots.txt`：`Allow: /`、sitemap参照あり。
- `public/sitemap.xml`：902件のURL。`/timeline`系7件を含み、`/compare/mayors`等noindex対象
  （10ページ）は含まれない（912プリレンダーページ − 902サイトマップ = 10件で一致）。

### 6. コミット

- `0824bb4 fix: add compare/timeline links to the actual former-member detail page`
- `9de0388 fix: correct former-member back-links to avoid 404 on non-prerendered legacy route`
- `docs/session-handoff.md`更新（本コミット）

### 7. push（完了）

`git push origin main`を実行し、成功した：`2da1660..9de0388  main -> main`
（force push・履歴書き換えなし、通常のfast-forward push）。詳細は本メモ末尾「push結果」を参照。

### 8. Cloudflare Pages（デプロイ確認済み）

Cloudflareダッシュボード・APIへの直接アクセス手段は持っていないため、公開URL
（https://nobeoka-shisei-portal.pages.dev/）への実HTTPリクエストで代替確認した。
push直後の時点で、修正後のコンテンツ（`/members/fm01/questions/fm01-2024-12-04-ippan-shitsumon/`の
`href="/members/former/fm01"`、`MemberFormerDetailPage`から削除したはずのデッドリンクが
出力されていないこと）がすでに公開URLへ反映されていることを確認した。
Git連携による自動デプロイが機能していると判断できる。デプロイID等の詳細な識別情報は
取得手段がないため未確認（必要であればCloudflareダッシュボードで確認すること）。

## ロードマップ

1. フェーズ6〜10D（政策比較基盤〜AI候補生成・定期運用統合〜最終検証・push・本番公開）
   → **すべて完了**
2. 次回以降は新規大規模フェーズではなく、**運用・品質改善フェーズ**とする
   （自動巡回の実運用監視、AI候補のレビュー・確定作業、データ拡充、ブラウザ実機確認など）。
   着手前に必ずこのメモと`git log`／`git status`／Cloudflareダッシュボードの実状態を確認すること。

## 既知の注意点・落とし穴（継続）

- `npm run build`のたびに`src/data/siteUpdate.json`・`archiveAiCategoryCandidates.json`・
  `archiveRelationCandidates.json`・`adminReviewQueue.json`のタイムスタンプだけが更新される
  （内容が同じ場合は`git restore`で戻す。今回も実施）。
- `/members`という単独ルートは存在しない（議員一覧はトップページ`/`）。ユーザー・指示文が
  `/members`を主要ルートとして挙げることがあるが、設計上の欠落ではない。
- 元議員関連のページは`/members/:id`（`MemberDetailPage.tsx`の分岐、現職専用の
  プリレンダリング対象外で本番では404になる）と`/members/former/:slug`
  （`MemberFormerDetailPage.tsx`、プリレンダリング対象・実際の主要な遷移先）の
  **2つのコンポーネントに分かれている**。今回の監査で、(1)導線が旧ページにしか付いていなかった
  バグ（`0824bb4`）と(2)旧ページへのリンクが本番で404になるバグ（`9de0388`、
  `MemberSpeechDetailPage.tsx`の戻るリンク・`seo.ts`のパンくずが対象）の両方を発見・修正した。
  今後、元議員向けの機能を追加する際は、**リンク先を`/members/former/:slug`に統一する**方針とし、
  `/members/:id`側（プリレンダリング対象外）へは新規に導線を張らないこと。
- `scripts/`配下のNode実行スクリプトは、ビルド前の`src/`配下のTypeScriptを直接importできない。
  同じロジックが必要な場合は`.mjs`側にミラー実装する。
- `mayor`巡回ターゲット（`archiveCrawlerTargets.json`）は`hisatomo-m.jp`が許可ドメイン外の
  ため取得できない。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`。会計年度は4月始まり。
- 比較ページのクエリパラメータは年度ベースが`?years=`、市長・議員・政策比較が`?items=`。
- 委員会マスタが存在しない（`committeeId`は1件も確認できていない）。
- **ブラウザでの実機確認（375/390/768/1280px）は本セッション全体を通じて未実施**
  （Chrome拡張が接続できなかったため）。次回セッションで可能であれば実施すること。

## push結果

- コマンド：`git push origin main`
- 結果：成功（`2da1660..9de0388  main -> main`、force pushなし）
- push後のHEAD：`9de0388`（ローカル`HEAD`と`origin/main`が完全一致、ahead 0 / behind 0を確認）
- GitHub Actions起動有無：起動なし（想定どおり）。本リポジトリのworkflowは3件とも
  `schedule` + `workflow_dispatch`のみで`on: push`トリガーを持たないため、
  push自体でActionsが起動しないのは正常な挙動（`gh run list`で直近実行がスケジュール起動の
  みであることを確認）。
- Cloudflare Pages：公開URLへのHTTPリクエストで、push後の修正内容が反映済みであることを
  確認済み（上記「8. Cloudflare Pages」参照）。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`・`git status`・`git log origin/main -1`で、このメモの内容
   （HEAD=`9de0388`、push済み）と実際のリポジトリ状態が一致しているかを確認する。
2. 可能であれば実機・ブラウザでのスマートフォン表示確認（375/390/768/1280px）を行う
   （本セッション全体を通じて未実施のまま）。
3. 新しい作業に着手する前に、このメモと実際のリポジトリ状態が食い違っていないかを必ず確認する
   （本セッションでは「完了済み」という誤った前提の指示が複数回届いたことがある）。
4. 次フェーズは新規の大規模機能追加ではなく、運用・品質改善（自動巡回の実運用監視、AI候補の
   レビュー・確定、データ拡充、ブラウザ実機確認）を優先する。
