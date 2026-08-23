# Phase80 外部リンク監査レポート

生成日時: 2026-08-23T01:29:25.977Z

## 概要

src/data配下の全JSONファイルから抽出したユニークURLは合計 **5340件**。うち実際にHTTPリクエストで確認したのは **1382件**。

延岡市議会の会議録個別発言リンク（kensakusystem.jp の GetText3.exe、1発言＝1URL）は4470件と極めて大量かつ同一システム・同一URLパターンのため、対象サーバーへの負荷を避ける目的で全会議（101セッション）から層化サンプリングして512件のみ実チェックした。それ以外のURL（870件）はすべて実チェック済み。詳細は本レポート末尾の「調査方法・サンプリングについて」を参照。

## カテゴリ別件数（抽出した全URL, 5340件）

| カテゴリ | 件数 |
|---|---|
| 宮崎県 | 31 |
| その他 | 90 |
| NDL | 54 |
| PDF | 25 |
| その他公的資料 | 34 |
| Wayback | 9 |
| 延岡市公式 | 488 |
| 延岡市議会 | 4609 |

## ステータス別件数（実チェック済み 1382件）

| ステータス | 件数 |
|---|---|
| 200 | 1368 |
| 403 | 0 |
| 404 | 6 |
| 429 | 0 |
| 3xx_redirect | 8 |
| 5xx | 0 |
| timeout | 0 |
| wayback_known_issue | 0 |
| other | 0 |

## 対応が必要な項目

### 404 / 恒久エラーなど broken 判定（6件）

| URL | 状態 | カテゴリ | 参照元（file#recordId(field)） |
|---|---|---|---|
| https://ja.wikipedia.org/wiki/仲田又次郎 | 404 (404) | その他 | archiveMayorTerms.json#mayor-04-term-01(sourceUrl), dataQualitySummary.json#-(url) |
| https://news.yahoo.co.jp/articles/54bca0ed2ef221f61c15fcb199c2377eda2bf8ba | 404 (404) | その他 | archiveMayors.json#mayor-14(sourceUrl), archiveMayorTerms.json#mayor-14-term-01(sourceUrl), dataQualitySummary.json#-(url) |
| https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27879.pdf | 404 (404) | 延岡市公式 | councilWatchedDocuments.json#session-schedule-5774a79eedad(sourceUrl) |
| https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27980.xls | 404 (404) | 延岡市公式 | dataQualitySummary.json#-(url) |
| https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28156.pdf | 404 (404) | 延岡市公式 | councilWatchedDocuments.json#session-schedule-a392dabc3484(sourceUrl) |
| https://www.the-miyanichi.co.jp/kennai/_84868.html | 404 (404) | その他 | archiveMayors.json#mayor-03(sourceUrl), archiveMayors.json#mayor-14(sourceUrl), archiveMayorTerms.json#mayor-03-term-02(sourceUrl), civicTimelineEvents.json#civic-159(url), dataQualitySummary.json#-(url) |

### リダイレクト（8件）

| 旧URL | 新URL(Location) | ステータス | カテゴリ | 参照元 |
|---|---|---|---|---|
| https://lin.ee/HLXDNIS | https://line.me/R/ti/p/@674sqgtj | 301 | その他 | members.json#m13(url) |
| https://ops-jg.d1-law.com/opensearch/SrJbF01/init?jctcd=8A91AC49CD&houcd=H345901010026&no=1&totalCount=1&fromJsp=SrMj | https://ops-jg.d1-law.com/opensearch/css/font.css | 302 | その他公的資料 | committees.json#committee-somu-seisaku(url), committees.json#committee-sangyo-kensetsu(url), committees.json#committee-kosei-kyoiku(url), committees.json#committee-gikai-unei(url), committees.json#committee-gikai-kasseika(url) |
| https://web.archive.org/web/20111114185739/http://www.city.nobeoka.miyazaki.jp/contents/kikaku/keieiseisaku/kouhou/2011_05.pdf | https://web.archive.org/web/20140715111156/http://www.city.nobeoka.miyazaki.jp/contents/kikaku/keieiseisaku/kouhou/2011_05.pdf | 302 | Wayback | archiveFiscalYears.json#-(sourceUrl), dataQualitySummary.json#-(url) |
| https://www.facebook.com/100080664301633/ | https://www.facebook.com/people/%E5%8C%97%E6%9E%97%E3%81%BF%E3%81%8D%E3%81%8A%E5%BE%8C%E6%8F%B4%E4%BC%9A/100080664301633/ | 301 | その他 | members.json#m11(url) |
| https://www.facebook.com/100083679123855/ | https://www.facebook.com/people/%E4%B8%AD%E5%B3%B6-%E3%82%88%E3%81%97%E3%81%AF%E3%82%8B/pfbid02vyg8D8zAf1KQk76cz6EYSDKNVxhRHWHoiCti7jZrBMbeGxTfwSkRnSUtgYxMeHXWl/ | 301 | その他 | members.json#m15(url) |
| https://www.facebook.com/579107342584087/ | https://www.facebook.com/100027116246393/ | 301 | その他 | members.json#m23(url) |
| https://www.facebook.com/profile.php?id=100007160117141 | https://www.facebook.com/people/%E5%B0%8F%E9%87%8E-%E6%AD%A3%E4%BA%8C/pfbid02kyDvbxa2Nbm9Rz6TkkaeN3xDbPQNvveC79oohdBEMn3k2EkMLgWzUZ6FsTazkNiUl/ | 301 | その他 | members.json#m04(url) |
| https://www.facebook.com/profile.php?id=100039255065122 | https://www.facebook.com/people/%E6%B3%B0%E6%B4%8B%E4%B8%8A%E6%9D%89/100039255065122/ | 301 | その他 | members.json#m03(url) |

補足: Facebookプロフィール2件・LINE公式アカウント1件のリダイレクトはSNS側のURL仕様変更によるもので、リンク自体は生きている（サイトの表示は問題なし、参照URLを新URLへ更新する価値はある）。Wayback Machineの1件は同一アーカイブ内の別スナップショットへの302で、内容確認自体は可能。宮崎県弁護士会の例規集検索システム（ops-jg.d1-law.com）へのリダイレクトはセッション/検索パラメータに依存する仕組みのため、自動チェックではCSSリソースへ302される結果になったが、これは検索システムの仕様上の挙動であり、ブラウザから通常アクセスした場合の到達性を別途人手で確認することを推奨する（機械的なbroken判定はしない）。

### Wayback Machine 既知の一時的挙動（503, 0件）

該当なし。

## 延岡市公式サイトの移転に関する所見

延岡市公式サイト（www.city.nobeoka.miyazaki.jp）参照URL488件のうち実チェックした結果、ドメインやサイト構造全体の移転（パス体系の変更等）を示す兆候は見られなかった。485件は200 OKで到達可能。broken判定になったのは個別の添付ファイル3件（`/uploaded/attachment/27879.pdf`, `/uploaded/attachment/27980.xls`, `/uploaded/attachment/28156.pdf`）のみで、これはサイト全体の移転ではなく、当該ファイルが公式サイト側で削除・差し替えされたことによる404と考えられる。新URL候補は自動検出できなかった（同名ファイルの再配置先が確認できないため）。該当ファイルを参照している議案・会議資料側の記録について、公式サイトのお知らせ一覧やdataQualitySummary.json等での代替URL調査、または国立国会図書館インターネット資料収集保存事業(WARP)やWayback Machineでのアーカイブ確認を推奨する。

## 調査方法・サンプリングについて

src/data配下の全JSONファイルからURLを抽出。延岡市議会の会議録個別発言リンク(kensakusystem.jp GetText3.exe)は同一システム・同一URLパターンで4470件と大量にあり、全件を短時間に直列/少数並列でリクエストすると対象サーバーに過度な負荷をかけるため、101会議(セッション)ごとに層化サンプリング（10件以下のセッションは全件、11件以上のセッションは先頭・中央・末尾の3件）を行い512件を実チェックした。それ以外のURL(870件: 延岡市公式488件、宮崎県31件、NDL54件、PDF25件、その他公的資料34件、その他90件、kensakusystem.jpの会議単位ページ139件、Wayback9件)は全件を実チェックした。

サンプリング対象外とした4470件中の3958件(サンプルに含まれなかった残り)は個別チェックを行っていない。同一会議・同一システムの発言リンクであり、サンプルチェックで異常が見つかった会議についてはPhase81以降で当該会議の全リンクを追加調査することを推奨する。

- HTTPメソッド: kensakusystem.jp は GET直接、それ以外はHEAD優先（HEAD非対応時はGETへフォールバック）
- タイムアウト: 15秒
- リトライ: timeout/5xx/429は1回だけ再試行し、それでも失敗した場合のみbroken扱い
- Wayback Machineの503は既知の一時的挙動として `wayback_known_issue` に区分（brokenに含めない）
- 本レポートはPhase80の調査結果であり、コード・データの変更は行っていない。broken/redirect/公式サイト移転の対応判断はPhase88で行う。
