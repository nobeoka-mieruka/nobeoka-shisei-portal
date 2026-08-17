# NDLサーチ手動ログイン後の自動調査・資料収集 設計書

作成日：2026-08-17
ステータス：設計のみ（TASK-100）。実際のNDL検索・資料確認はTASK-101〜105（いずれもBLOCKED、
claude-in-chrome接続＋ユーザー本人のNDLログインが前提）で今後実施する。歴代市長分は
新規番号を起こさず、既存TASK-045・TASK-074（`src/data/blockedTaskClassification.json`に
reopenConditions構造化済み）を再開する。

関連文書：
- [historical-civic-data-plan.md](./historical-civic-data-plan.md)（アーカイブ全体設計）
- `reports/ndl-historical-source-ledger.json`（既存、TASK-090で新規作成・14件）
- `reports/physical-source-candidates.md`（既存、TASK-090で新規作成、優先度別資料リスト）
- `reports/historical-mayor-research-status.md`（既存、TASK-092で新規作成）
- `docs/session-handoff.md`「2026-08-17（続き3）」（前回セッションの詳細記録）

---

## 1. 目的

延岡市政見える化ポータルで不足している歴史資料・市政資料を補完するため、国立国会図書館
「NDLサーチ」を用いて延岡市に関係する資料を可能な限り網羅的に調査する。

今回追加する範囲は、**NDLへのID・パスワード入力および初回ログインは人間が行い、
ログイン完了後のブラウザセッションを利用して、検索・資料確認・URL収集・分類・台帳化を
可能な範囲で自動化する**ことである。既存のWayback Machine調査（TASK-083・092、現在
再生バックエンドが503のため停止中）と並行して進める。

TASK-090（`2fd4a92`）は、claude-in-chrome未接続のためログイン不要の書誌検索のみで実施済み。
今回の設計は、claude-in-chromeが接続され、ユーザーがNDLへログインした状態を前提に、
その先（個人送信サービスでの本文確認を含む）の調査を安全に進めるための体制を定める。

---

## 2. 禁止事項（必ず守る）

1. NDLのID・パスワードをソースコードへ保存しない
2. `.env`にも原則としてID・パスワードを保存しない
3. GitHubへ認証情報・Cookie・セッション情報を絶対にcommitしない
4. CAPTCHA・二要素認証・利用規約上の制限を回避しない
5. ログイン処理そのものは自動化しない（人間が毎回手動で行う）
6. NDLのアクセス制御を回避しない
7. 大量アクセスを行わない
8. NDLサーバーへ過剰な負荷を与えない
9. robots.txt、利用規約、画面上の注意事項を尊重する
10. 有料・館内限定・個人送信限定等のコンテンツを不正に取得しない
11. 閲覧権限がない資料は「存在確認＋書誌情報＋URL」の収集までにする
12. ブラウザのユーザープロファイルやCookieファイルをGit管理しない

claude-in-chromeは既存のChromeブラウザセッション（拡張機能経由）を操作する方式であり、
専用プロファイルファイルや永続Cookieファイルをリポジトリ内に生成しない。そのため
`.gitignore`への追加項目は現時点でなし（将来、ローカルキャッシュファイルを
`data/research/ndl/.cache/`等に置く場合は、`scripts/.cache/`と同様のパターンで追加する）。

---

## 3. 接続・実行方式

### 3.1 ブラウザ自動操作の方式

ユーザー指示により、**claude-in-chrome拡張機能**を使用する（Edge専用プロファイルや
Playwright persistent contextは今回採用しない）。ログイン自体は人間が行う前提のため、
既存のChromeブラウザ操作を壊さない範囲で、claude-in-chromeが新規タブを開いて操作する。

### 3.2 接続確認（毎回の作業開始時に必須）

1. `list_connected_browsers`でclaude-in-chrome拡張が接続されているか確認する
2. 接続されていない場合、**ログイン確認以前の問題**としてTASK-045・074・101〜105を進めず、
   ユーザーへ「Chrome拡張機能の接続」を依頼して停止する
   （本設計書作成時点＝2026-08-17時点で確認したところ、接続0件。TASK-090時点と同じ状態）
3. 接続されている場合、`tabs_context_mcp`でタブ状況を確認してから次に進む

### 3.3 人間待機機構（ログインが必要な場面）

1. NDLサーチ（`https://ndlsearch.ndl.go.jp/`）へ遷移する
2. ログイン状態（マイページ表示・個人送信サービスの利用可否）を画面から確認する
3. 未ログインの場合、作業を止めてユーザーへ「NDLへのログインが必要です。手動でログイン後、
   完了したとお知らせください」と伝える。ログイン操作（ID/PW入力）そのものは行わない
4. ユーザーから完了の連絡を受けてから、検索・確認・台帳化を再開する
5. セッション中にログアウトされた・個人送信サービスが利用できなくなった等の兆候が
   見えた場合も同様に停止し、再ログインを依頼する

---

## 4. 既存資産との重複回避

新規調査の前に、必ず以下の既存データ・記録を確認し、同一資料の重複登録を避ける。

- Wayback Machine調査（`reports/wayback-*.json`、TASK-083・085・086・092）
- 広報のべおか調査（`docs/session-handoff.md`該当セクション、TASK-085・086）
- 延岡市議会会議録調査（`docs/nobeoka-minutes-fetch-investigation.md`、`data/minutes/`）
- 歴代市長調査（`src/data/archiveMayors.json`、`src/data/archiveMayorTerms.json`、
  `reports/historical-mayor-research-status.md`、`src/data/blockedTaskClassification.json`）
- 財政資料調査（`src/data/archiveFiscalYears.json`、TASK-057系列）
- 選挙資料調査（`src/data/archiveElections*.json`があれば参照）
- 市政年表調査（`src/data/civicTimelineEvents.json`）
- 既存NDL台帳（`reports/ndl-historical-source-ledger.json`、`reports/physical-source-candidates.md`）

重複判定は以下のいずれかの一致で行う：

- URL（`ndlUrl`／`sourceUrl`）
- NDL書誌ID（`ndlBibId`）
- ISBN
- 全国書誌番号
- DOI等の識別子
- （上記が無い場合）タイトル＋発行者＋発行年の組み合わせ

---

## 5. データスキーマ

### 5.1 方針：既存台帳を拡張する（新規ディレクトリは作らない）

CLAUDE.mdの「既存データを壊さない」「重複実装を避ける」方針に従い、
`data/research/ndl/`のような新規ディレクトリは作らず、**既存の
`reports/ndl-historical-source-ledger.json`を拡張**して全カテゴリを収容する
（`reports/`は既存の内部レポート運用パターンで、ビルド・型チェック対象外）。

理由：
- 既に5件のエントリと`statusDefinitions`が定義済みで、重複判定ロジック（4章）もこの
  ファイルを前提に設計されている
- カテゴリ別に別ファイルへ分割すると、資料が複数カテゴリにまたがる場合
  （例：延岡市史は歴代市長・議会・財政すべてに関連）に重複登録のリスクが増える

### 5.2 追加フィールド（既存5件は後方互換のため必須にしない）

既存フィールド（`id` / `title` / `author` / `publisher` / `publishedYear` / `ndlBibId` /
`ndlUrl` / `ndlDigitalPid` / `page` / `relatedMayorIds` / `relatedYears` / `dataTypes` /
`status` / `sourceType` / `lastCheckedAt` / `notes`）はそのまま維持する。

新規追加：

```jsonc
{
  // 既存フィールドに加えて
  "category": "mayor", // "mayor" | "council" | "finance" | "election" | "statistics" |
                        // "publicRelations" | "newspaper" | "specialPost" | "formerMunicipality"
  "accessStatus": "unknown",
    // "public_fulltext"      全文閲覧可能（ログイン不要）
    // "public_metadata"      書誌情報のみ公開
    // "login_required"       NDLログイン後に確認可能（個人送信サービス）
    // "personal_transmission" 個人向けデジタル化資料送信サービス対象（login_requiredの詳細区分）
    // "library_only"         図書館向け送信サービス等、個人送信対象外
    // "onsite_only"          国立国会図書館館内のみ
    // "unavailable"          閲覧不可
    // "unknown"              未確認
  "reliabilityGrade": null, // "A" | "B" | "C" | "D" | "E" | null（未判定）
  "relatedCouncilMemberIds": [], // 既存 relatedMayorIds に加え、議員関連資料用
  "relatedFormerMunicipality": null, // "北方町" 等、該当すれば
  "searchQuery": "" // この資料をヒットさせた検索語（検索ログとの突合用）
}
```

`accessStatus`は既存`status`（調査ワークフロー状態：metadata_only→login_required→
readable→reviewed→adopted/rejected）とは別軸。`status`は「この資料を採用したか」の
作業進捗、`accessStatus`は「NDL上でどう公開されているか」という資料側の性質。

### 5.3 信頼度グレード（A〜E）

`scripts/generate-final-quality-audit.mjs`（TASK-096）が既にサイト全体の出典を
A〜Eで機械採点している（A=延岡市等一次資料、B=NDL・公的図書館、C=新聞報道、
D=その他二次資料、E=出典不明・リンク切れ）。今回のNDL台帳もこの基準に合わせる：

- A：延岡市・延岡市議会・選挙管理委員会が発行した一次資料（NDLに所蔵されているだけでは
  Aにならない。発行主体で判定する）
- B：国・宮崎県・公的図書館・NDL自身が発行者の資料
- C：新聞・報道機関
- D：書籍・論文（民間出版、個人編纂等）
- E：個人サイト・ブログ・SNS

**NDLに掲載されているという理由だけで自動的にAにはしない。** 例えば「延岡市史」は
延岡市発行なのでA、「日本の歴代市長 第3巻」は歴代知事編纂会（民間）発行なのでD、
という判定になる。

台帳（`reports/`内部データ）はサイトの本番`sourceRefs`とは別管理のため、
`generate-final-quality-audit.mjs`の対象外のまま据え置く。台帳の資料を実際に
`src/data/archiveMayors.json`等へ採用（`status: adopted`）した時点で、通常の
`sourceRefs`登録フローに従い、そちらの出典が品質監査の対象になる。

---

## 6. 調査優先順位

`reports/historical-mayor-research-status.md`（TASK-092）で判明した既存の欠落領域
（歴代市長9名の議案条例・財政データが構造的に0件、mayor-04〜12の空白）を踏まえ、
次の順で進める。

1. 歴代市長（`physical-source-candidates.md`優先度「高」4件：延岡市史1983年版上・下巻／
   1993年版／日本の歴代市長第3巻）
2. 過去の市議会（会議録・議会だより・歴代議長副議長・議員名簿）
3. 財政資料（予算・決算・公債・基金・財政力指数等、昭和期まで遡及）
4. 選挙関連資料（市長選・市議選、年代別整理）
5. 人口・統計資料
6. 広報のべおか（創刊号から号別に台帳化）
7. 新聞・雑誌・報道資料（全文不可なら書誌情報のみ）
8. 特別職（副市長・教育長・監査委員等）の歴代整理
9. 旧町村・合併資料（北方町・北浦町・北川町等）

### 年代別優先度

1930年代を最優先とし、10年区切りで新しいほど後回しにする
（1930-39 / 1940-49 / 1950-59 / 1960-69 / 1970-79 / 1980-89 / 1990-99 /
2000-09 / 2010-19 / 2020-現在）。新しい年代は既存のWeb公開資料でカバー済みのことが多いため。

---

## 7. 表記揺れ対応

検索語には以下の揺れを考慮する。

- 地名：延岡／延岡市／延岡町／延岡市役所／延岡市役所編
- 議会：延岡市議会／延岡市会
- 市長：延岡市長／延岡市長選／延岡市長選挙
- 人名の異体字：高橋／髙橋、浜田／濱田 等、対象人物ごとに確認する

---

## 8. 検索ログ

`docs/research/ndl-search-log.md`に、検索セッションごとに以下を記録する。

| 検索日時 | 検索語 | ヒット件数 | 確認件数 | 採用件数 | 備考 |
|---|---|---|---|---|---|

台帳側の`searchQuery`フィールドと突合できるようにする。

---

## 9. タスク分割

大きな1タスクにせず、`TASKS.md`へ小さく分割して登録する（TASK-101〜105、6章参照。
歴代市長分は既存TASK-045・074を再開する）。
1回のセッションで一気に処理せず、逐次コミットする。以下は自己判断で進めてよい：

- 検索語の追加、年代分割の微調整
- 重複除去、カテゴリ分類
- 出典（`notes`）の追加
- OCR可能性の確認
- `validate:data`・型定義との整合性確認

以下はユーザー確認が必須：

- 有償資料の購入・郵送複写の申込
- 来館・現物閲覧の予約
- ログイン操作そのもの（自動化しない）

---

## 10. Git・運用

- 作業後に`git status`で、認証情報・Cookie・セッションファイルが追跡対象になっていないか
  必ず確認する
- 大きな1コミットにまとめず、カテゴリ・セッション単位でコミットする
- `reports/`配下の台帳更新はビルド・型チェック対象外だが、`validate:data`・`typecheck`・
  `lint`は毎回実行し、既存の警告件数（14件）から増えていないか確認する

---

## 11. 最終報告フォーマット

各TASK-045・074・101〜105完了時、以下を記録する。

- フェーズ／NDL調査進捗
- 検索クエリ数
- ヒット件数／確認件数／新規資料件数／重複件数
- アクセス区分別内訳（全文可／書誌のみ／個人送信対象／館内限定）
- カテゴリ別内訳（市長関連／議会関連／財政関連／選挙関連／その他）
- 未解決事項・次回の再開条件

---

## 12. 最終目標

単なる「会議録＋広報のべおか＋選挙資料＋財政資料」のリンク収集で終わらせず、
**1933年（延岡市制施行）以降の延岡市政を、可能な限り時系列・人物・政策軸で整理できる
土台にする**。特に歴代市長については、「氏名と任期」だけでなく、政策・主要事業・
市政上の出来事と紐づけることを目指す。

ただし、資料から直接確認できない関係性を推測で登録しないこと（CLAUDE.mdの原則どおり）。
既存の`archiveMayors.json`・`archiveMayorTerms.json`・`archivePolicies.json`・
`civicTimelineEvents.json`等への反映は、資料本文で直接確認できた事実のみを対象とする。

---

## 13. 次回セッションの開始手順

1. `git status`／現在のブランチ／`origin/main`との差分／直近コミットを確認する
2. `list_connected_browsers`でclaude-in-chrome接続を確認する。未接続ならユーザーへ
   接続を依頼して停止する
3. 接続済みならNDLサーチへ遷移し、ログイン状態を確認する。未ログインなら3.3節の
   手順でユーザーに手動ログインを依頼する
4. ログイン確認後、TASKS.mdのTASK-101（優先度最上位）からIN_PROGRESSにして着手する
5. 本設計書の3〜11章の運用ルールに従って進める
