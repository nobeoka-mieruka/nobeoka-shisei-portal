# 最新情報確認 差分一覧（2026-10-20）

巡回日：2026-10-20（日本時間）。前回の差分監査は `reports/official-diff-audit-2026-10-09.md`（2026-10-09）。
今回はそれ以降（2026-10-09〜10-20）に公開・更新された延岡市公式サイトの資料を確認し、本番データ（`src/data/`、
コミット 21e36ab 時点）とURL・数値単位で照合した。前回までに完了したPhase・調査は再実行していない。

巡回範囲：新着情報の一覧（`/soshiki/list1-1〜4.html`、2026-09-07〜10-20更新分）、市議会（議員名簿・委員会／会派名簿・
会議日程・議案等審議結果・意見書決議・会議録検索システム・議会だより・録画配信）、市長室（記者会見・交際費・公約進捗）、
財政課（予算・財政状況・健全化判断比率・財政事情・財政分析報告書）、統計（人口）。

信頼レベル：`PRIMARY`＝延岡市・延岡市議会の公式ページ／公式PDF・Excel（一次資料）。今回の対象はすべて PRIMARY。

## A. 新規公開資料（ポータル未収録）

| # | 資料名 | URL | 公開・更新日 | ポータル反映状況 | 対象ページ | 対象データファイル | 信頼レベル | 更新要否 | 備考 |
|---|---|---|---|---|---|---|---|---|---|
| A1 | 故 松田満男議員を悼む | https://www.city.nobeoka.miyazaki.jp/site/gikai/52556.html | 2026-10-16 | 未反映（現職として掲載中） | /members、/members/m22、議員比較・活動指標・トップ件数 | members.json、formerMembers.json ほか | PRIMARY | 要（ユーザー確認後） | 松田満男議員（自民党きずなの会）が2026-10-13に逝去。現職→元議員への移行は参照箇所が多く（src配下27ファイル・テストの「26名」固定）、大規模変更のため扱いを確認する |
| A2 | 延岡市議会 議員名簿（令和8年10月14日現在、定数27名-現員25名） | https://www.city.nobeoka.miyazaki.jp/site/gikai/1455.html | 2026-10-14（ページ内表記） | 未反映（現員26のまま） | /members | members.json | PRIMARY | 要（A1と同じ） | 松田議員の行が削除され25名。松田議員の公式プロフィール（1445.html）は404 |
| A3 | 正・副議長、各委員会等名簿（令和8年10月14日現在） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29348.pdf | 2026-10-16（市議会の構成ページ更新日） | 未反映 | /committees | committees.json | PRIMARY | 要（A1と同じ） | 松田議員の所属（厚生教育委員会）が名簿から外れている |
| A4 | 会派役員及び所属議員名簿（令和8年10月14日現在、定数27-現員25） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29349.pdf | 2026-10-16 | 未反映 | /factions | factions.json | PRIMARY | 要（A1と同じ） | 自民党きずなの会 8人（松田議員を除く） |
| A5 | 令和8年度 常任委員会・特別委員会開催予定表（10月13日現在） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29336.pdf | 2026-10-13 | 巡回で検出、監視台帳のみ登録 | 委員会日程 | councilWatchedDocuments.json、committeeMeetingSchedule.json | PRIMARY | 要 | 旧版（29104.pdf、9月25日現在）からの差分を確認して反映 |
| A6 | 延岡市長交際費の公表について（令和8年9月分） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29347.pdf | 2026-10（市長の交際費等ページに掲載） | 未反映 | /mayor（交際費） | mayorEntertainmentExpenses.json | PRIMARY | 要 | 3件・合計56,912円・累計370,404円。4〜9月の合計と累計が一致することを検算済み |
| A7 | 令和8年10月1日現在 現住人口・世帯数の推移 | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29305.xls | 2026-10-13（統計ページ更新日） | 未反映（9月1日現在のまま、出典URLは404） | /finance、/data/fiscal-years、他市比較 | financeDashboard.json、archiveFiscalYears.json、municipalityComparison.json | PRIMARY | 要 | 最新値 107,614人（10月1日現在）。B1の過去値の改定も参照 |
| A8 | 議会活動報告会を開催します（令和8年11月8日開催） | https://www.city.nobeoka.miyazaki.jp/site/gikai/46558.html | 2026-10-20 | 未収録 | — | — | PRIMARY | 不要 | 開催前の告知。現行データに「今後の議会行事」の収録欄が無い |
| A9 | YouTube 録画配信「令和8年9月定例会」再生リスト | https://www.city.nobeoka.miyazaki.jp/site/gikai/28033.html | 2026-10-13 | 未収録 | — | — | PRIMARY（配信ページ）。動画は公式記録ではないと市が明記 | 不要 | ポータルは録画配信ページ（28033.html）へのリンクのみを持ち、会期別の再生リストは収録していない |

## B. 更新された既存資料

| # | 資料名 | URL | 公開・更新日 | ポータル反映状況 | 対象ページ | 対象データファイル | 信頼レベル | 更新要否 | 備考 |
|---|---|---|---|---|---|---|---|---|---|
| B1 | 現住人口及び世帯数の推移（旧 9月1日現在版 → 10月1日現在版） | 旧 /uploaded/attachment/28990.xls（404）→ 新 29305.xls | 2026-10-13 | 旧URL・旧値のまま | /finance、/data/fiscal-years、他市比較 | 同上 | PRIMARY | 要 | 新ファイルでは2025-10-01以降の月次値が改定されている。登録済み30年度分のうち29件は一致、2026-01-01のみ不一致（109,266人・50,224世帯 → 109,181人・50,215世帯）。9月1日現在も 107,803 → 107,718人、他市比較で使う7月1日現在も 108,044 → 107,959人。新ファイルの2025-10-01の行には人口動態（-94人）と増減（+42人）の差136人の調整が記載されているが、改定理由の記述は無い。旧版はWaybackにも保存が無い |
| B2 | 常任委員会・特別委員会開催予定表（9月25日現在 → 10月13日現在） | 旧 29104.pdf → 新 29336.pdf | 2026-10-13 | 旧版を出典として掲載中 | 委員会日程 | committeeMeetingSchedule.json | PRIMARY | 要 | A5と同じ |
| B3 | 延岡市議会の構成について（委員会名簿・会派名簿） | https://www.city.nobeoka.miyazaki.jp/site/gikai/1415.html | 2026-10-16 | 旧名簿で掲載中 | /committees、/factions | committees.json、factions.json | PRIMARY | 要（A1と同じ） | A3・A4と同じ |
| B4 | 延岡市議会の日程をお知らせします | https://www.city.nobeoka.miyazaki.jp/site/gikai/6758.html | 2026-10-13 | 本会議日程28674.pdfは掲載済み（ハッシュ一致） | — | councilWatchedDocuments.json | PRIMARY | 一部要（B2のみ） | 本会議日程は変更なし |
| B5 | 市長の交際費等 | https://www.city.nobeoka.miyazaki.jp/site/mayor/49506.html | 2026-10（9月分追加） | 8月分まで反映 | /mayor | mayorEntertainmentExpenses.json | PRIMARY | 要 | A6と同じ |

## C. 既に反映済み（追加作業不要）

| # | 資料名 | URL | 公開・更新日 | ポータル反映状況 | 対象データファイル | 信頼レベル | 備考 |
|---|---|---|---|---|---|---|---|
| C1 | 第27回延岡市議会定例会 議案等審議結果（10月5日現在） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29234.pdf | 2026-10-05 | 反映済み | billVotes.json | PRIMARY | 日次自動更新（10/20）で unchanged。ハッシュ不変 |
| C2 | 意見書・決議を掲載します | https://www.city.nobeoka.miyazaki.jp/site/gikai/19435.html | 2026-10-05 | 反映済み | councilWatchedDocuments.json | PRIMARY | 44件すべて変更なし（10/20巡回） |
| C3 | 委員会活動報告書 | https://www.city.nobeoka.miyazaki.jp/site/gikai/43039.html | — | 反映済み | committeeActivityReports.json | PRIMARY | 6件変更なし |
| C4 | 一般質問 質問通告一覧 | https://www.city.nobeoka.miyazaki.jp/site/gikai/1416.html | — | 反映済み | generalQuestions.json | PRIMARY | 本文ハッシュ一致 |
| C5 | 第27回定例会 会議日程 | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28674.pdf | 2026-08-21 | 反映済み | councilWatchedDocuments.json | PRIMARY | ハッシュ一致 |
| C6 | 令和9年9月29日市長定例記者会見（公式題名のまま） | https://www.city.nobeoka.miyazaki.jp/site/mayor/52268.html | 2026-09-29 | 反映済み | mayorPressConferences.ts | PRIMARY | 以降の記者会見の掲載なし |
| C7 | 令和8年度9月補正（2次分）予算 | https://www.city.nobeoka.miyazaki.jp/site/mayor/51885.html | 2026-09-04 | 反映済み（概要PDF 28904.pdf） | budgetRevisions.json | PRIMARY | — |
| C8 | 市長公約の進捗状況 | https://www.city.nobeoka.miyazaki.jp/site/mayor/51666.html | 2026-08-25 | 反映済み | mayorPolicyProgress.json | PRIMARY | 更新なし |
| C9 | 財政状況（財政状況資料集） | https://www.city.nobeoka.miyazaki.jp/soshiki/18/48504.html | 2026-09-30 | 反映済み（10/09差替え） | archiveFiscalYears.json | PRIMARY | 以降の更新なし |
| C10 | 令和7年度健全化判断比率等の公表 | https://www.city.nobeoka.miyazaki.jp/soshiki/18/51957.html | 2026-09-18 | 反映済み | financeDashboard.json | PRIMARY | — |
| C11 | 延岡市の財政事情／令和8年度予算／財政分析報告書／地方消費税交付金充当一覧 | /soshiki/18/48505.html ほか | 2026-03-27〜03-31 | 反映済み | financeDashboard.json ほか | PRIMARY | 前回以降の更新なし |
| C12 | のべおか市議会だより 第108号（最新号） | https://www.city.nobeoka.miyazaki.jp/site/gikai/1457.html | 2026-08-03 | 反映済み | — | PRIMARY | 第109号は未発行 |
| C13 | 令和7年度森林環境譲与税の使途について | https://www.city.nobeoka.miyazaki.jp/soshiki/39/45391.html | 2026-10-07 | 反映済み（TASK-206） | forestEnvironmentTax.json | PRIMARY | — |
| C14 | 西階公園陸上競技場整備基本計画（案）意見募集ほかパブコメ | /soshiki/60/52197.html ほか | 2026-10-02 | 反映済み | publicComments.json | PRIMARY | — |

## D. 未確認・外部待ち

| # | 資料名 | URL | 状況 | ポータル反映状況 | 対象データファイル | 状態 | 備考 |
|---|---|---|---|---|---|---|---|
| D1 | 第27回定例会（令和8年9月定例会）の会議録 | 会議録検索システム（kensakusystem.jp） | 2026-10-20に照会。令和8年のタブは第24回・第25回・第26回のみで、第27回は未掲載 | — | blockedTaskClassification.json（TASK-004） | WAITING_EXTERNAL | 議案第48号の採決方法・付託委員会はこの会議録の公開待ち。議員別の賛否は推測で補完しない |
| D2 | 第27回定例会の閉会日 | 同上 | 審議結果PDFに閉会日の記載なし | 会期「確認中」 | councilSessions.json | WAITING_EXTERNAL | — |
| D3 | 議員定数条例改正（議案第55号）の改正後の人数・施行日 | 例規集・選挙管理委員会「公職の任期、定数」 | 未掲載（議員名簿も「定数27名」の表記） | 定数27のまま | constants.ts | UNR | 前回から変化なし |
| D4 | 松田満男議員の退任に伴う欠員の扱い（補欠選挙の有無など） | 選挙管理委員会 | 補欠選挙の告示は見当たらない | — | — | UNR | 告示が無いだけで「行わない」とは扱わない |

## 範囲外（OUT_OF_SCOPE、収録構造なし）

事務処理ミスの公表（令和8年9月分、/soshiki/8/52545.html、2026-10-20／10月分個別公表 52294.html）、
公共工事発注見通し（39406.html）、地域公共交通利便増進実施計画の変更（40686.html）、職員採用試験合格発表、
最低賃金改定、選挙運動用ポスター掲示場設置場所（52598.html、特定の選挙の告示ではない一般案内）、入札公告・イベント・募集・
支所だより等。事務処理ミスの公表は前回（TASK-205）の提案のまま。

## 自動更新系の確認（要約。詳細は結果レポート）

- Update council documents（日次）：10/10〜10/20すべて成功。ただし実データの変化は無く、`lastCheckedAt`・`attemptCount` だけが更新されている（審議結果PDFのハッシュ不変）。
- Sync council data（5日ごと）：10/18に「会議日程 新規1件（29336.pdf）」「議員名簿ページ 変更検知あり（要確認）」を検出したが、PR作成が無効なため通知だけで終わり、データへは未反映だった（今回ローカルで巡回して取り込み）。
- Civic archive crawler：10/18に失敗。原因は `test-human-action-ledger` の2件（日次更新が TASK-004 の確認日を書き換えるのに運用台帳を再生成していないため、台帳と実データがずれる）。人口xls（28990.xls）の404連続3回も検出。
- Auto-update dry-run：bills GREEN。population は新xls（29305）を一覧ページから解決して YELLOW（固定URLの更新を推奨）。questions は6月定例会の質問通告書14件が RED（会議録確認済みの会期と重複するための安全装置。8月から継続中）。finance YELLOW 1件（PDF本文を抽出しない資料の変更検知）。
