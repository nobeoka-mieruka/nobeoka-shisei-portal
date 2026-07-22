# 延岡市議会 活動レポート

延岡市議会議員27名と市長の活動（プロフィール、一般質問、議案賛否、活動レポートなど）を紹介するWebサイトです。

React + TypeScript + Vite + Tailwind CSS（Material Design 3風）で構築しています。

## セットアップ

```bash
npm install
npm run dev      # 開発サーバー起動 (http://localhost:5173)
npm run build    # 本番ビルド
```

## データの追加・編集

すべて `src/data/` 以下のJSONファイルで管理しています。コードを触らずに編集・追加できます。

- `src/data/factions.json` … 会派一覧（id / name / color）
- `src/data/members.json` … 議員27名分のデータ（配列）
- `src/data/mayor.json` … 市長のデータ（単一オブジェクト）
- `src/data/compensationComparison.json` … 市長・議長・副議長・議員の報酬比較データ（近隣市ごとの配列。`/compensation` ページで使用）
- `src/data/cityGuideCategories.json` … 「延岡市役所 どこに行けばいい？診断」（`/city-guide`）の相談カテゴリ一覧（行政組織名ではなく、市民が検索しやすい相談内容の切り口で分類）
- `src/data/cityGuideEntries.json` … 同診断の相談窓口データベース本体（id / category / question / department / phone / location / officialUrl / description / lastChecked）。同じカテゴリ内では配列の並び順どおりに「はい／いいえ」で質問し、「はい」で担当課が確定する。電話番号・場所・公式URL・lastChecked は延岡市公式ホームページ「組織でさがす」の各課ページで確認できたものだけを登録し、未確認の項目は空文字列のままにする（推測で入力しないこと）
- `src/data/cityGuideConfig.json` … 同診断の全課共通設定（受付時間 officeHours、市役所名 officeName、補足 note、代表電話 representativePhone など）。受付時間はここ1か所を書き換えるだけで全結果画面に反映される。型定義は `src/types/cityGuide.ts`、読み込み層は `src/lib/cityGuide.ts`

型定義は `src/types/index.ts` にあります。フィールドの意味に迷ったらこちらを参照してください。

### 議員を1名追加する例（members.json に1件追記）

```json
{
  "id": "m28",
  "name": "山下花子",
  "nameKana": "やましたはなこ",
  "photoUrl": "",
  "factionId": "shinwa",
  "termCount": 1,
  "age": 45,
  "committees": ["総務委員会"],
  "profile": "プロフィール文章...",
  "sns": [{ "platform": "x", "url": "https://x.com/example" }],
  "questions": [],
  "votes": [],
  "reports": []
}
```

- `photoUrl` を空文字のままにすると、名前の頭文字を使った仮アバター（イニシャルアイコン）が自動表示されます。実際の顔写真が用意できたら画像URL（`/photos/xxx.jpg` など、`public/` 配下に置いたパス）を指定してください。
- `factionId` は `factions.json` の `id` と一致させてください。
- `sns.platform` は `x` / `facebook` / `instagram` / `youtube` / `line` / `blog` / `website` のいずれかです。
- `votes.result` は `賛成` / `反対` / `棄権` / `欠席` のいずれかです。

会派を追加・変更する場合は `factions.json` に `{ "id": ..., "name": ..., "color": "#rrggbb" }` を追加するだけです。`color` は省略可（自動で色が割り当てられます）。

## 開発・運用管理

- [CLAUDE.md](./CLAUDE.md) … 開発ルールと自律実行手順
- [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) … 中長期の開発方針と優先順位
- [TASKS.md](./TASKS.md) … 現在実行する具体的タスク
- [PROJECT_PLAN.md](./PROJECT_PLAN.md) … 機能ごとの実装状況
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) … 公開前後の確認項目
- [UPDATE_GUIDE.md](./UPDATE_GUIDE.md) … データ更新、GitHub Push、Cloudflare Pages反映手順

## 注意事項

現在収録されている議員・市長のプロフィール、会派名、質問内容、議案、活動レポート等は**すべてサンプル（仮）データ**です。実際の延岡市議会の情報に置き換えてご利用ください。顔写真も仮アバター表示になっています。
