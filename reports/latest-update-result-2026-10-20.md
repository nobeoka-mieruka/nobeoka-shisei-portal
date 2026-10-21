# 最新情報更新 結果レポート（2026-10-20）

差分一覧は `reports/latest-update-audit-2026-10-20.md`。本レポートはその反映結果と検証結果をまとめる。
コミット：953f096（TASK-207 データ更新）、TASK-208（議員の移行・リンク切れ表示）は本レポートと同じコミット。

## 1. 今回発見した新規資料

| 資料 | URL | 公開・更新日 |
|---|---|---|
| 故 松田満男議員を悼む | https://www.city.nobeoka.miyazaki.jp/site/gikai/52556.html | 2026-10-16 |
| 議員名簿（令和8年10月14日現在、定数27名-現員25名） | https://www.city.nobeoka.miyazaki.jp/site/gikai/1455.html | 2026-10-14 |
| 正・副議長、各委員会等名簿（10月14日現在） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29348.pdf | 2026-10-16 |
| 会派役員及び所属議員名簿（10月14日現在） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29349.pdf | 2026-10-16 |
| 常任委員会・特別委員会開催予定表（10月13日現在） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29336.pdf | 2026-10-13 |
| 延岡市長交際費の公表について（令和8年9月分） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29347.pdf | 2026-10 |
| 令和8年10月1日現在 現住人口・世帯数の推移 | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/29305.xls | 2026-10-13 |
| 議会活動報告会（11月8日開催）※収録欄なし | https://www.city.nobeoka.miyazaki.jp/site/gikai/46558.html | 2026-10-20 |

## 2. 更新したファイル

- データ：`members.json`、`formerMembers.json`、`archiveMemberProfiles.json`、`archiveMemberTerms.json`、`committees.json`、
  `factions.json`、`councilDebateSpeeches.json`、`councilWatchedDocuments.json`、`committeeMeetingSchedule.json`、
  `mayorEntertainmentExpenses.json`、`financeDashboard.json`、`archiveFiscalYears.json`、`municipalityComparison.json`、
  `archiveCrawlerTargets.json`、`updateHistory.json`、ほか生成物（`searchIndex.json`、`dataQualitySummary.json`、`civicEventTimeline.json`、`sitemap.xml` 等）
- スクリプト：`scripts/validate-data.mjs`、`scripts/test-council-activity-profile.mjs`、`scripts/auto-update/population/resolve-population-source.mjs`
- ワークフロー：`.github/workflows/update-council-documents.yml`（運用台帳の再生成）
- 画面：`src/components/SourceLink.tsx`、`src/components/SourceList.tsx`、`src/components/timeline/CivicEventTimeline.tsx`、
  `src/pages/PublicCommentsPage.tsx`（リンク切れURLをリンクにしない）、`src/pages/MethodologyCouncilActivityPage.tsx`（「26名」を時点つきに）
- 記録：`TASKS.md`（TASK-207・208）、`PROJECT_PLAN.md`、`reports/latest-update-audit-2026-10-20.md`、本レポート、
  `reports/human-action-ledger.*`、`reports/external-link-check.json`、`reports/phase191-responsive/audit-2026-10-20*.json`

## 3. 更新したページ

議員一覧（/people?type=member）、/members/m22・/members/former/m22（元議員表示）、元議員一覧、委員会（/committees、厚生教育委員会）、
会派、市長交際費（/mayor/entertainment-expenses）、財政（/finance：人口・1人あたり予算）、財政の年度別記録、他市比較、
委員会日程、更新履歴（/updates、3件追加）、ダッシュボード・トップの現員表示、出典欄全般（リンク切れ表示）。
ルートの追加・変更はなし。

## 4. 変更したデータ件数

| 項目 | 変更前 | 変更後 | 理由 |
|---|---:|---:|---|
| 現職議員 | 26 | 25 | 松田満男議員の逝去（2026-10-13） |
| 元議員 | 58 | 59 | 同上（ID m22 のまま移行） |
| 議員定数 | 27 | 27 | 変更なし |
| 議案 | 1,215 | 1,215 | 変更なし |
| 一般質問（構造化） | 27 | 27 | 変更なし |
| 会期 | 62 | 62 | 変更なし |
| 歴代市長 | 14（任期30） | 14（任期30） | 変更なし |
| 市長公約 | 変更なし | 変更なし | 公約進捗ページの更新なし |
| 財政年度（archiveFiscalYears） | 70 | 70 | 値の改定1件（令和8年1月1日の人口） |
| 市長交際費 | 36件 | 39件 | 9月分3件 |
| 委員会開催予定 | 35件 | 36件 | 10月15日分1件 |
| 更新履歴 | 192 | 195 | u194〜u196 |
| 委員会委員（厚生教育） | 8 | 7 | 同上 |
| 会派（自民党きずなの会） | 9 | 8 | 同上 |

不自然な減少は無い（減少は上記の逝去によるもののみ）。

## 5. 未反映の資料

- 議会活動報告会（11月8日）、YouTube「令和8年9月定例会」再生リスト：収録欄なし。
- 事務処理ミスの公表（令和8年9月分・10月個別公表）：収録構造なし（TASK-205の提案のまま）。

## 6. 会議録公開待ち

- 第27回定例会（令和8年9月定例会）：会議録検索システムの令和8年は第24〜26回のみ（2026-10-20確認）。
  議案第48号の採決方法・付託委員会、会期の閉会日は未確定のまま（TASK-004、WAITING_EXTERNAL）。議員別賛否は補完しない。

## 7. 手動確認が必要な資料

- 決算審査意見書等の出典PDF 5件（attachment/15731・15733・20032・24565・24566）が今回新たに404。掲載ページ（/soshiki/78/1210.html）ごと削除され、
  後継ページ・新URLは監査委員事務局のページ一覧・RSSに無い（2026-10-20確認）。**【対応済み（TASK-209）】**令和4年度2件は Internet Archive 保存版で
  登録値16項目の一致を確認し出典を差し替え。令和5・6年度3件は保存版も無く、記録を残して「リンク切れ・代替資料確認中」表示（市の再掲載待ち）。
- パブリックコメント「延岡市教育大綱（素案）」の案件ページ（soshiki/1/51626.html）と素案PDF（28700.pdf）が404。**【確認済み（TASK-210）】**移動先は総合政策課のページ一覧・RSS・新着情報のいずれにも無い。運用状況一覧（10月13日更新）は削除済みページへのリンクのまま。Internet Archive の保存版（2026-10-12）を出典に追加し、元のURLは記録として残した（リンク切れ表示）。結果公表ページの掲載待ち。
- 委員会名簿 令和8年5月8日現在版（27271.pdf）が404。5月8日時点の根拠として記録を残し、10月14日現在版（29348.pdf）を追加済み。
- 人口：令和7年10月1日以降の月次値の改定理由は資料に記載なし（値は市の最新公表値に合わせた）。

## 8. 外部資料待ち

- 第27回定例会の会議録（上記）。
- 議員定数条例改正（議案第55号）の改正後の人数・施行日（例規集・選挙管理委員会に未掲載）。
- 松田議員の退任による欠員の扱い（補欠選挙の告示なし。告示が無いことを「行わない」とは扱わない）。

## 9. 自動更新の異常

| 項目 | 状況 | 対応 |
|---|---|---|
| Civic archive crawler（10/18）失敗 | 日次更新が TASK-004 の確認日を書き換えるのに運用台帳を再生成せず、test-human-action-ledger が2件失敗 | update-council-documents.yml に台帳の再生成とコミット対象を追加（修正済み） |
| Sync council data（10/18） | 開催予定表の新版と議員名簿の変更を検出したが、PR作成が無効なため通知のみでデータ未反映 | ローカルで巡回して反映（構造上の課題として残る。BOT_PULL_REQUESTS_ENABLED は未設定） |
| Update council documents（日次） | 10/10〜10/20すべて成功。ただし実データの変化は無く、確認日・照会回数だけが更新されている | 異常ではない（ハッシュ不変） |
| 人口xlsの添付ID変更 | 28990→29305。固定URLが404 | 固定URLを29305へ更新 |
| Auto-update dry-run：questions RED | 6月定例会の質問通告書14件（404・会議録確認済み会期）が毎回RED | 8月から継続する既知の安全装置。未修正（下記「次に対応すべき」） |
| Auto-update dry-run：finance YELLOW 1件 | PDF本文を抽出しない資料（24913.pdf）の変更検知 | 人の確認待ち（既存の仕様） |

## 10. UI異常

- 変更ページの実測（375・390・430・768・1280px、28ページ×5幅）：横スクロール0、はみ出し要素0。
- レスポンシブ監査（full、11幅×46ページ＝506組合せ）：横スクロール0組合せ、TIMEOUT・ERROR 0。
  ISSUES 111組合せはすべてタップ領域（tap-target-small 382件・本文内リンク 2,168件）で、今回変更していない
  ページ（議員活動バロメーター、選挙、公約進捗等）の既存の指摘（Phase281監査では tap-target-small 2,385件）。
- 公開画面でクリック可能なリンク切れ：対応前7件 → 0件。

## 11. テスト結果

| 検証 | 結果 |
|---|---|
| validate:data | errors=0、warnings=21（既存と同じ21件） |
| typecheck | 成功 |
| lint | エラー0、警告4（既存：test-bill-phase157-integration の未使用変数・Fast refresh） |
| npm test | 全件成功 |
| build（prerender・SEO・内容検査を含む） | 成功（2,317ページ、validate-seo failures=0、validate-content errors=0） |
| check:internal-links | リンク切れ0件 |
| check:broken-link-exposure | 公開画面のクリック可能なリンク切れ0件（内部データ上の到達不能URL 25件は記録として保持） |
| check:external-links | 919件確認：ok 877・redirect 12・404 30（新たな404は9件。上記7と既知の29070・29104） |
| scan:era／validate:freshness／validate:completeness／validate:political-funds／release:check／audit:attribution／audit:hydration | いずれも異常0 |
| validate:sources／validate:finance | errors=0（warnings 23・6は既存） |
| check:bundle-size | エラー0、警告4（基準値比の超過。今回の変更はデータ1件の移動と表示分岐のみ） |
| audit:responsive | 上記10 |

## 12. 次に対応すべき優先事項

1. 令和5・6年度の決算審査意見書3件（20032・24565・24566）：市が新しいページで再掲載した時点で出典を差し替え（令和4年度2件はTASK-209で保存版へ差し替え済み）。
2. 教育大綱（素案）パブリックコメント：結果公表ページが掲載された時点で resultUrl と status を更新（移動先が無いことはTASK-210で確認済み）。
3. 第27回定例会の会議録公開後、議案第48号の採決方法・付託委員会と会期の閉会日を登録（日次ワークフローが検知）。
4. Auto-update dry-run の questions RED（6月定例会の404通告書14件を毎回REDにする）を、removed-confirmed の資料を対象外にする等で解消するか判断。**【対応済み（TASK-211、2026-10-21）】**RED 14→0。
5. Sync council data の検出結果がデータへ届かない構造（PR作成無効）について、BOT_PULL_REQUESTS_ENABLED の設定可否をユーザー判断。

## 13. 今回の作業の終了判断（2026-10-21）

- 2026-10-20時点でサイト側で対応できる更新・修正・検証・デプロイは完了として終了（TASK-207〜210、最終コミット 1b9a386）。
- 市側の一次資料が未公開の残件は WAITING_EXTERNAL のまま維持する。
- 次回の確認対象は次の3件のみとし、**公開されたものだけ**反映する。完了済みタスク（TASK-207〜210）の再実行・再調査は行わない。
  1. 第27回定例会の会議録・議案第48号の関連資料（採決方法・付託委員会、会期の閉会日）
  2. 決算審査意見書3件（令和5・6年度：attachment/20032・24565・24566 の再掲載先）
  3. 教育大綱（素案）パブリックコメントの結果公表ページ（pc-r08-005 の resultUrl・status）
