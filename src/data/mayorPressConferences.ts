/**
 * 市長定例記者会見・発表事項のデータ。
 * 延岡市公式ホームページ「市長定例記者会見」（/site/mayor/50998.html）に掲載された発表事項を、
 * 発表内容・日付・担当課・PDFリンクとも公式資料のとおりに記録する。独自の評価・推測は含めない。
 * 今後の記者会見は、この配列に新しい要素を追加するだけで一覧・詳細ページに反映される。
 */

export interface MayorPressConferenceAnnouncementPdf {
  /** PDFのリンク文言（例：「発表事項」「チラシ」） */
  label: string;
  url: string;
}

export interface MayorPressConferenceAnnouncement {
  id: string;
  /** 発表事項の分類（延岡市公式資料の内容に基づく大まかな分野名） */
  category: string;
  /** 発表タイトル（公式資料の見出しのとおり） */
  title: string;
  /** 市民向けの短い概要（公式資料の概要文に基づく） */
  summary: string;
  /** 開催日、募集期限などの重要情報（公式資料に記載された内容のとおり） */
  keyInfo: string[];
  /** 担当課（公式資料に記載のとおり） */
  department: string;
  departmentPhone?: string;
  /** 公式PDFへのリンク */
  pdfs: MayorPressConferenceAnnouncementPdf[];
}

export interface MayorPressConference {
  /** ISO形式。記者会見の開催日。詳細ページのURL（/mayor/press-conferences/:date）にも使用する。 */
  date: string;
  /** 記者会見のタイトル（公式資料の表記のとおり） */
  title: string;
  /** 延岡市公式ホームページ上の記者会見情報ページURL */
  sourceUrl: string;
  sourceLabel: string;
  /** ISO形式。当サイトがこの内容を公式ページで確認した日。 */
  verifiedAt: string;
  announcements: MayorPressConferenceAnnouncement[];
}

const PDF_BASE = "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment";

export const mayorPressConferences: MayorPressConference[] = [
  {
    date: "2026-07-16",
    title: "令和8年7月16日市長定例記者会見",
    sourceUrl: "https://www.city.nobeoka.miyazaki.jp/site/mayor/50998.html",
    sourceLabel: "延岡市公式ホームページ「市長定例記者会見」",
    verifiedAt: "2026-07-18",
    announcements: [
      {
        id: "2026-07-16-1",
        category: "スポーツ",
        title: "県内初となるリーグH公式戦の開催について",
        summary:
          "日本最高峰のハンドボールリーグ「リーグH」の公式戦が延岡市で開催されます。リーグHの公式戦開催は県内初です。女子リーグ「熊本ビューストピンティーズ」のホームゲームとして実施されます。",
        keyInfo: [
          "対戦カード：熊本ビューストピンティーズ vs アランマーレ富山（2026-27リーグHレギュラーシーズン第2節）",
          "開催日：令和8年10月18日（日）13：00開始",
          "会場：アスリートタウン延岡アリーナ メインアリーナ",
        ],
        department: "延岡市 教育委員会 アスリートタウン推進課 スポーツ振興係",
        departmentPhone: "0982-22-7033",
        pdfs: [{ label: "発表事項（PDF）", url: `${PDF_BASE}/28112.pdf` }],
      },
      {
        id: "2026-07-16-2",
        category: "募集・公園",
        title: "愛宕山笠沙の御碕公園実証実験イベント等の募集",
        summary:
          "愛宕山笠沙の御碕公園へのカフェ誘致等を検討するため、実証実験イベントを実施する事業者・団体を募集し、事業に要する費用の一部を補助します。",
        keyInfo: [
          "募集期間：令和8年7月16日（木）～令和8年8月17日（月）",
          "補助上限額：50万円",
          "選定会議：令和8年8月中に開催予定、交付決定通知：令和8年9月中に通知予定",
        ],
        department: "延岡市 都市建設部 都市計画課 公園緑地係",
        departmentPhone: "0982-22-7046",
        pdfs: [{ label: "発表事項（PDF）", url: `${PDF_BASE}/28113.pdf` }],
      },
      {
        id: "2026-07-16-3",
        category: "防災",
        title: "陸上自衛隊第8師団による令和8年度自衛隊統合防災演習（08JXR）について",
        summary:
          "南海トラフ地震の発生を想定し、陸上自衛隊第8師団による統合防災演習が延岡市内で実施されます。空輸訓練・車両積載等訓練・通信設備設置訓練などが行われ、実施時間帯には交通規制が予定されています。",
        keyInfo: [
          "延岡市での実施期間：令和8年7月21日（火）～7月22日（水）",
          "7月21日 空輸訓練：14時40分着陸予定～15時20分離陸予定（西階陸上競技場）",
          "交通規制：7月21日14時30分～14時45分・15時10分～15時25分（市道全面通行止め）、13時00分～15時30分（西階公園園路全面通行止め）",
        ],
        department: "延岡市 危機管理部 危機管理企画課",
        departmentPhone: "0982-22-7077",
        pdfs: [{ label: "発表事項（PDF）", url: `${PDF_BASE}/28114.pdf` }],
      },
      {
        id: "2026-07-16-4",
        category: "文化・イベント",
        title:
          "延岡城・内藤記念博物館 特別展「INSECTS／NOBEOKA－驚異の昆虫アート－」の開催について",
        summary:
          "延岡城・内藤記念博物館で、12名の作家による昆虫アート作品30余点を展示する特別展が開催されます。オープニングセレモニーやギャラリートークなど、会期中に関連イベントも行われます。",
        keyInfo: [
          "会期：令和8年8月1日（土）～令和8年10月12日（月・祝）",
          "会場：延岡城・内藤記念博物館 企画展示室（開館時間9時～17時、最終入場16時30分、休館日：毎週月曜日〈祝日の場合は翌平日〉）",
          "観覧料：一般1,000円／高大生600円（要学生証）／中学生以下無料",
          "オープニングセレモニー：令和8年8月1日（土）8時30分～8時45分（予約不要）",
        ],
        department: "延岡市 商工観光文化部 歴史・文化都市推進課",
        departmentPhone: "0982-20-3335",
        pdfs: [
          { label: "発表事項（PDF）", url: `${PDF_BASE}/28115.pdf` },
          { label: "チラシ（PDF）", url: `${PDF_BASE}/28106.pdf` },
        ],
      },
      {
        id: "2026-07-16-5",
        category: "市民サービス",
        title: "土日祝祭日の本庁舎市民スペースの開放について",
        summary:
          "暑さ対策等のため、本庁舎の市民スペースを土曜日・日曜日・祝祭日に開放します。",
        keyInfo: [
          "開放開始日：令和8年7月25日（土）から",
          "開放日：土曜日、日曜日、祝祭日",
          "開放時間：8時30分～16時30分",
        ],
        department: "延岡市 総務部 管財課 管理係",
        departmentPhone: "0982-22-7009",
        pdfs: [{ label: "発表事項（PDF）", url: `${PDF_BASE}/28116.pdf` }],
      },
      {
        id: "2026-07-16-6",
        category: "教育",
        title: "新たな学びの多様化学校の学校名（案）を在籍生徒自らが定例教育委員会で提案",
        summary:
          "令和9年4月に「本校型」の学びの多様化学校として生まれ変わる南浦中学校学びの多様化学校分教室「熊野江教室」について、在籍生徒が地域・民間の方々とともに考えた学校名（案）を定例教育委員会で提案します。",
        keyInfo: [
          "日時：令和8年7月29日（水）午後1時35分～午後1時50分",
          "会場：本庁5階 災害対策本部室",
          "参加者：在籍生徒（5名）及び保護者、熊野江教室職員（4名）、オノコボデザイン合同会社（3名）",
        ],
        department: "延岡市教育委員会 学校教育課 指導係",
        departmentPhone: "0982-22-7031",
        pdfs: [
          { label: "発表事項（PDF）", url: `${PDF_BASE}/28117.pdf` },
          { label: "資料（PDF）", url: `${PDF_BASE}/28110.pdf` },
        ],
      },
    ],
  },
];

export function getMayorPressConferenceByDate(date: string): MayorPressConference | undefined {
  return mayorPressConferences.find((c) => c.date === date);
}

export function getSortedMayorPressConferences(): MayorPressConference[] {
  return [...mayorPressConferences].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
