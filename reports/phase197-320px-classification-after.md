# Phase197 320x568 要対応候補の完全分類

生成日時：2026-09-02T04:10:42.655Z（ラベル：after）

Phase191監査の「320x568の要対応件数」と同じ条件（tap-target-inline-link以外の全検出）。横スクロール・突出・文字切れ・table溢れ・重なり・オーバーレイ位置は0件のため、要対応候補はすべてタップ領域である。

候補総数：82件

| 分類 | 件数 |
| --- | --- |
| ACCESSIBILITY_IMPROVEMENT（改善対象） | 1 |
| INTENTIONAL（設計上の意図） | 79 |
| FALSE_POSITIVE（検出器の誤り） | 2 |

| # | ルート | 要素 | 表示テキスト | 実装 | UI種別 | サイズ | 実効サイズ | 24px(AA) | 44px(AAA) | 最近接 | 分類 | 市民の利用を妨げるか |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 2 | `/dashboard` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 3 | `/dashboard` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 4 | `/data-status` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 5 | `/data-status` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 6 | `/people` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 7 | `/people` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 8 | `/questions` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 9 | `/questions` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 10 | `/questions` | a | 甲斐 忠篤議員の一般質問 | （修正後の再測定：実装ファイルは修正前のレポートを参照） | （実測による自動判定） | 256x30 | 256x30 | ○ | × | 105px | ACCESSIBILITY_IMPROVEMENT | 妨げない（AA充足・AAA未達） |
| 11 | `/bills` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 12 | `/bills` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 13 | `/bills` | a | /bills/votes | src/pages/CouncilDocumentsArchivePage.tsx（登録状況の注記文） | inline citation（注記文中のインラインリンク） | 62x17 | 62x17 | × | × | 242px | FALSE_POSITIVE | 妨げない（本文中のインラインリンク） |
| 14 | `/bills/votes` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 15 | `/bills/votes` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 16 | `/committees` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 17 | `/committees` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 18 | `/finance` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 19 | `/finance` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 20 | `/timeline` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 21 | `/timeline` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 22 | `/mayor` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 23 | `/mayor` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 24 | `/mayors` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 25 | `/mayors` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 26 | `/mayor/policy-progress` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 27 | `/mayor/policy-progress` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 70px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 28 | `/compare` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 29 | `/compare` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 30 | `/compensation` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 31 | `/compensation` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 32 | `/council-activity` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 33 | `/council-activity` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 104px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 34 | `/council-activity` | input | （テキストなし） | （修正後の再測定：実装ファイルは修正前のレポートを参照） | （実測による自動判定） | 16x16 | 46x44 | ○ | ○ | 91px | FALSE_POSITIVE | 妨げない（実効タップ領域44px以上） |
| 35 | `/members/m01` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 36 | `/members/m01` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 37 | `/members/m01` | a | 議員一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 38 | `/members/m02` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 39 | `/members/m02` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 40 | `/members/m02` | a | 議員一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 41 | `/members/m03` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 42 | `/members/m03` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 43 | `/members/m03` | a | 議員一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 44 | `/members/m04` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 45 | `/members/m04` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 46 | `/members/m04` | a | 議員一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 47 | `/questions/gq2026-06-m24` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 164px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 48 | `/questions/gq2026-06-m24` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 98px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 49 | `/questions/gq2026-06-m24` | a | 一般質問データベース | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 119x16 | 119x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 50 | `/questions/gq2026-06-m17` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 164px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 51 | `/questions/gq2026-06-m17` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 98px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 52 | `/questions/gq2026-06-m17` | a | 一般質問データベース | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 119x16 | 119x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 53 | `/questions/gq2026-06-m14` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 164px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 54 | `/questions/gq2026-06-m14` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 98px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 55 | `/questions/gq2026-06-m14` | a | 一般質問データベース | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 119x16 | 119x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 56 | `/questions/gq2026-06-m08` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 164px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 57 | `/questions/gq2026-06-m08` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 98px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 58 | `/questions/gq2026-06-m08` | a | 一般質問データベース | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 119x16 | 119x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 59 | `/bills/votes/2019-06-gian-10` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 60 | `/bills/votes/2019-06-gian-10` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 61 | `/bills/votes/2019-06-gian-10` | a | 議案一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 62 | `/bills/votes/2019-06-chinjo-1` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 63 | `/bills/votes/2019-06-chinjo-1` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 64 | `/bills/votes/2019-06-chinjo-1` | a | 議案一覧 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 47px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 65 | `/bills/bill-fy2026-general-account-supplementary-budget-2` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 66 | `/bills/bill-fy2026-general-account-supplementary-budget-2` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 79px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 67 | `/bills/bill-fy2026-general-account-supplementary-budget-2` | a | 議案アーカイブ | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 83x16 | 83x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 68 | `/bills/bill-auditor-appointment-2026-06` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 69 | `/bills/bill-auditor-appointment-2026-06` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 79px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 70 | `/bills/bill-auditor-appointment-2026-06` | a | 議案アーカイブ | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 83x16 | 83x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 71 | `/bills/bill-bridge-repair-contract-2026-06` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 72 | `/bills/bill-bridge-repair-contract-2026-06` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 79px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 73 | `/bills/bill-bridge-repair-contract-2026-06` | a | 議案アーカイブ | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 83x16 | 83x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 74 | `/mayors/aoki-yoshisuke` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 75 | `/mayors/aoki-yoshisuke` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 76 | `/mayors/aoki-yoshisuke` | a | 歴代市長 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 77 | `/mayors/miura-hisatomo` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 78 | `/mayors/miura-hisatomo` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 79 | `/mayors/miura-hisatomo` | a | 歴代市長 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 80 | `/mayors/fusano-hiroshi` | a | 検索 | src/components/SiteHeader.tsx（サイト内検索リンク） | header nav（検索リンク） | 74x36 | 74x36 | ○ | × | 179px | INTENTIONAL | 妨げない（36pxでAA充足、最近接92px） |
| 81 | `/mayors/fusano-hiroshi` | a | ホーム | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 36x16 | 36x16 | × | × | 62px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |
| 82 | `/mayors/fusano-hiroshi` | a | 歴代市長 | src/components/Breadcrumbs.tsx | breadcrumb（パンくずリンク） | 48x16 | 48x16 | × | × | 46px | INTENTIONAL | 妨げない（16pxだが最近接46〜58pxで間隔例外を充足） |

※「実効サイズ」は、`<label>`による包み込みや`position:absolute; inset:0`のカード全面リンクなど、見た目の矩形より広い操作領域を実測した値。「最近接」は他の操作要素の中心までの最短距離で、WCAG 2.2 2.5.8の間隔例外（24px）の判定に用いる。各候補は320x568の実描画から要素を切り出した画像でも確認した（`reports/phase197-screenshots/`、Git管理外・再生成可能）。
