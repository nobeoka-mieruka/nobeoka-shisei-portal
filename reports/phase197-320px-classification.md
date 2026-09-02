# Phase197 320x568 要対応候補の完全分類

生成日時：2026-09-02T03:51:12.026Z（ラベル：before）

Phase191監査の「320x568の要対応件数」と同じ条件（tap-target-inline-link以外の全検出）。横スクロール・突出・文字切れ・table溢れ・重なり・オーバーレイ位置は0件のため、要対応候補はすべてタップ領域である。

候補総数：89件

| 分類 | 件数 |
| --- | --- |
| ACCESSIBILITY_IMPROVEMENT（改善対象） | 9 |
| INTENTIONAL（設計上の意図） | 79 |
| FALSE_POSITIVE（検出器の誤り） | 1 |

| # | ルート | 要素 | 表示テキスト | 実装 | UI種別 | サイズ | 実効サイズ | 24px(AA) | 44px(AAA) | 最近接 | 分類 | 市民の利用を妨げるか |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 2 | `/dashboard` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 3 | `/dashboard` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 4 | `/dashboard` | a | 市長公約の進捗状況を詳しく見る | src/pages/DashboardPage.tsx（市長公約の進捗状況への導線） | text link（独立した導線リンク） | 210x20 | 210x20 | × | × | 477px | ACCESSIBILITY_IMPROVEMENT | 妨げない（最近接36px。高さ20pxでAAA未達） |
| 5 | `/dashboard` | a | この会期の資料を見る | src/pages/DashboardPage.tsx（今の会期・委員会の導線リンク） | text link（独立した導線リンク） | 140x20 | 140x20 | × | × | 27px | ACCESSIBILITY_IMPROVEMENT | 妨げない（最近接27pxで間隔例外は充足。ただし高さ20pxでAAA未達） |
| 6 | `/dashboard` | a | 委員会の一覧を見る | src/pages/DashboardPage.tsx（今の会期・委員会の導線リンク） | text link（独立した導線リンク） | 126x20 | 126x20 | × | × | 27px | ACCESSIBILITY_IMPROVEMENT | 妨げない（最近接27pxで間隔例外は充足。ただし高さ20pxでAAA未達） |
| 7 | `/data-status` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 8 | `/data-status` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 9 | `/people` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 10 | `/people` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 11 | `/questions` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 12 | `/questions` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 13 | `/questions` | a | 甲斐 忠篤議員の一般質問 | src/components/questions/VerifiedSpeechCard.tsx（カード見出しリンク） | card action（カード見出しリンク） | 256x22 | 256x22 | × | × | 104px | ACCESSIBILITY_IMPROVEMENT | 妨げない（幅256px以上・最近接104px。高さ22pxでAA下限に2px足りない） |
| 14 | `/bills` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 15 | `/bills` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 16 | `/bills` | a | /bills/votes | src/pages/CouncilDocumentsArchivePage.tsx（登録状況の注記文） | inline citation（注記文中のインラインリンク） | 62x17 | 62x17 | × | × | 242px | FALSE_POSITIVE | 妨げない（本文中のインラインリンク） |
| 17 | `/bills/votes` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 18 | `/bills/votes` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 19 | `/bills/votes` | a | 詳細を見る | src/pages/BillVotesPage.tsx（一覧カードの「詳細を見る」） | chip link（カードの主要操作） | 102x36 | 102x36 | ○ | × | 257px | ACCESSIBILITY_IMPROVEMENT | 妨げない（36pxでAA充足、最近接198px。AAA未達） |
| 20 | `/committees` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 21 | `/committees` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 22 | `/finance` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 23 | `/finance` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 24 | `/timeline` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 25 | `/timeline` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 26 | `/mayor` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 27 | `/mayor` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 28 | `/mayors` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 29 | `/mayors` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 30 | `/mayor/policy-progress` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 31 | `/mayor/policy-progress` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 70px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 32 | `/compare` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 33 | `/compare` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 34 | `/compensation` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 35 | `/compensation` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 36 | `/compensation` | a | 延岡市公式資料 | src/pages/CompensationPage.tsx（スマートフォン用カードの出典リンク） | source link（出典リンク） | 98x20 | 98x20 | × | × | 283px | ACCESSIBILITY_IMPROVEMENT | 妨げない（最近接283px。高さ20pxでAAA未達） |
| 37 | `/council-activity` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 38 | `/council-activity` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 39 | `/council-activity` | a | 1位 上杉 泰洋 | src/pages/CouncilActivityPage.tsx（発言量TOP3・提出者件数TOP3の議員リンク） | text link（一覧内の議員リンク） | 95x20 | 95x20 | × | × | 26px | ACCESSIBILITY_IMPROVEMENT | 妨げない（最近接26pxで間隔例外は充足。ただし余裕が2pxしかない） |
| 40 | `/council-activity` | a | 1位 北林 幹雄 | src/pages/CouncilActivityPage.tsx（発言量TOP3・提出者件数TOP3の議員リンク） | text link（一覧内の議員リンク） | 95x20 | 95x20 | × | × | 26px | ACCESSIBILITY_IMPROVEMENT | 妨げない（最近接26pxで間隔例外は充足。ただし余裕が2pxしかない） |
| 41 | `/council-activity` | input | （テキストなし） | src/pages/CouncilActivityPage.tsx（スマートフォン用一覧の「比較」チェックボックス） | checkbox（比較対象の選択） | 16x16 | 46x16 | × | × | 81px | ACCESSIBILITY_IMPROVEMENT | 妨げない（`<label>`により実効46x16px、最近接81px。ただし高さ16pxでAA未達） |
| 42 | `/members/m01` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 43 | `/members/m01` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 44 | `/members/m01` | a | 議員一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 45 | `/members/m02` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 46 | `/members/m02` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 47 | `/members/m02` | a | 議員一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 48 | `/members/m03` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 49 | `/members/m03` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 50 | `/members/m03` | a | 議員一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 51 | `/members/m04` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 52 | `/members/m04` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 53 | `/members/m04` | a | 議員一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 54 | `/questions/gq2026-06-m24` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 164px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 55 | `/questions/gq2026-06-m24` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 98px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 56 | `/questions/gq2026-06-m24` | a | 一般質問データベース | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 119x16 | 119x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 57 | `/questions/gq2026-06-m17` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 164px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 58 | `/questions/gq2026-06-m17` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 98px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 59 | `/questions/gq2026-06-m17` | a | 一般質問データベース | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 119x16 | 119x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 60 | `/questions/gq2026-06-m14` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 164px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 61 | `/questions/gq2026-06-m14` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 98px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 62 | `/questions/gq2026-06-m14` | a | 一般質問データベース | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 119x16 | 119x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 63 | `/questions/gq2026-06-m08` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 164px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 64 | `/questions/gq2026-06-m08` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 98px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 65 | `/questions/gq2026-06-m08` | a | 一般質問データベース | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 119x16 | 119x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 66 | `/bills/votes/2019-06-gian-10` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 67 | `/bills/votes/2019-06-gian-10` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 68 | `/bills/votes/2019-06-gian-10` | a | 議案一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 69 | `/bills/votes/2019-06-chinjo-1` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 70 | `/bills/votes/2019-06-chinjo-1` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 71 | `/bills/votes/2019-06-chinjo-1` | a | 議案一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 72 | `/bills/bill-fy2026-general-account-supplementary-budget-2` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 73 | `/bills/bill-fy2026-general-account-supplementary-budget-2` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 79px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 74 | `/bills/bill-fy2026-general-account-supplementary-budget-2` | a | 議案アーカイブ | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 83x16 | 83x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 75 | `/bills/bill-auditor-appointment-2026-06` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 76 | `/bills/bill-auditor-appointment-2026-06` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 79px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 77 | `/bills/bill-auditor-appointment-2026-06` | a | 議案アーカイブ | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 83x16 | 83x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 78 | `/bills/bill-bridge-repair-contract-2026-06` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 79 | `/bills/bill-bridge-repair-contract-2026-06` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 79px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 80 | `/bills/bill-bridge-repair-contract-2026-06` | a | 議案アーカイブ | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 83x16 | 83x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 81 | `/mayors/aoki-yoshisuke` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 82 | `/mayors/aoki-yoshisuke` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 83 | `/mayors/aoki-yoshisuke` | a | 歴代市長 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 84 | `/mayors/miura-hisatomo` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 85 | `/mayors/miura-hisatomo` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 86 | `/mayors/miura-hisatomo` | a | 歴代市長 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 87 | `/mayors/fusano-hiroshi` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 88 | `/mayors/fusano-hiroshi` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 89 | `/mayors/fusano-hiroshi` | a | 歴代市長 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |

※「実効サイズ」は、`<label>`による包み込みや`position:absolute; inset:0`のカード全面リンクなど、見た目の矩形より広い操作領域を実測した値。「最近接」は他の操作要素の中心までの最短距離で、WCAG 2.2 2.5.8の間隔例外（24px）の判定に用いる。各候補は320x568の実描画から要素を切り出した画像でも確認した（`reports/phase197-screenshots/`、Git管理外・再生成可能）。
