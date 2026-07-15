import { backupJson, readExistingJson, readTable, writeDiffReport, writePreview } from "./lib/import-shared.mjs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("使い方: npm run import:members -- <ファイルパス（.xlsx または .csv）>");
  process.exit(1);
}

const VALID_GENDERS = new Set(["male", "female", "other", "undisclosed", "unknown"]);
const GENDER_ALIASES = {
  男性: "male",
  女性: "female",
  その他: "other",
  非公開: "undisclosed",
  不明: "unknown",
};

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/[、,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toGender(value) {
  const v = String(value ?? "").trim();
  if (VALID_GENDERS.has(v)) return v;
  if (GENDER_ALIASES[v]) return GENDER_ALIASES[v];
  return v || "unknown";
}

function toNumberOrUndefined(value) {
  if (value === "" || value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const rows = await readTable(filePath);
  const errors = [];
  const results = [];
  const seenIds = new Set();

  rows.forEach((row, i) => {
    const line = i + 2; // ヘッダー行を1行目とした場合の行番号
    const id = String(row.id ?? "").trim();
    const name = String(row["氏名"] ?? "").trim();
    const nameKana = String(row["ふりがな"] ?? "").trim();
    const factionId = String(row["会派ID"] ?? "").trim();

    if (!id) errors.push(`${line}行目: idが空です`);
    else if (seenIds.has(id)) errors.push(`${line}行目: idが重複しています（${id}）`);
    else seenIds.add(id);

    if (!name) errors.push(`${line}行目: 氏名が空です（id=${id}）`);
    if (!nameKana) errors.push(`${line}行目: ふりがなが空です（id=${id}）`);
    if (!factionId) errors.push(`${line}行目: 会派IDが空です（id=${id}）`);

    const gender = toGender(row["性別"]);
    if (!VALID_GENDERS.has(gender)) errors.push(`${line}行目: 性別の値が不正です（${row["性別"]}）`);

    const photoUrl = String(row["写真パス"] ?? "").trim();
    if (photoUrl && !photoUrl.startsWith("/")) {
      errors.push(`${line}行目: 写真パスは "/" から始めてください（${photoUrl}）`);
    }
    const profileUrl = String(row["公式プロフィールURL"] ?? "").trim();
    if (profileUrl && !/^https?:\/\//.test(profileUrl)) {
      errors.push(`${line}行目: 公式プロフィールURLの形式が不正です（${profileUrl}）`);
    }

    results.push({
      id,
      name,
      nameKana,
      photoUrl: photoUrl || undefined,
      factionId,
      termCount: toNumberOrUndefined(row["当選回数"]),
      age: toNumberOrUndefined(row["年齢"]),
      ageAsOf: String(row["年齢基準日"] ?? "").trim() || undefined,
      district: String(row["選挙区"] ?? "").trim() || undefined,
      gender,
      role: String(row["役職"] ?? "").trim() || undefined,
      committees: splitList(row["所属委員会"]),
      profile: String(row["プロフィール"] ?? "").trim() || "情報確認中",
      profileUrl: profileUrl || undefined,
      // 取込機能では未対応の項目（既存データを保持したい場合は、この取込結果を手作業でマージしてください）
      sns: [],
      questions: [],
      votes: [],
      reports: [],
    });
  });

  console.log(`[import-members] ${rows.length}行を読み込みました。`);

  if (errors.length > 0) {
    console.error(`\n[import-members] ${errors.length}件のエラーが見つかったため、変換を中止しました。`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const backupPath = backupJson("src/data/members.json");
  if (backupPath) console.log(`[import-members] 既存データをバックアップしました: ${backupPath}`);

  const existing = readExistingJson("src/data/members.json");
  const existingIds = new Set(existing.map((m) => m.id));
  const newIds = new Set(results.map((m) => m.id));

  const diffLines = [
    `# members.json 取込プレビュー差分（${new Date().toISOString()}）`,
    "",
    `既存件数: ${existing.length} / 取込件数: ${results.length}`,
    "",
    "## 新規追加される議員ID",
    ...[...newIds].filter((id) => !existingIds.has(id)).map((id) => `- ${id}`),
    "",
    "## 既存データに存在するが、取込ファイルに含まれない議員ID（このままではプレビューに反映されません）",
    ...[...existingIds].filter((id) => !newIds.has(id)).map((id) => `- ${id}`),
    "",
    "## 双方に存在する議員ID（内容差分は手作業でご確認ください）",
    ...[...newIds].filter((id) => existingIds.has(id)).map((id) => `- ${id}`),
    "",
    "※ このプレビューは src/data/members.json を自動的に上書きしません。",
    "  内容を確認し、問題なければ手作業でsrc/data/members.jsonへ反映してください。",
  ];

  const outPath = writePreview("generated/import-preview/members.json", results);
  const diffPath = writeDiffReport("generated/import-preview/members-diff.txt", diffLines);

  console.log(`[import-members] プレビューを書き出しました: ${outPath}`);
  console.log(`[import-members] 差分レポートを書き出しました: ${diffPath}`);
  console.log("[import-members] src/data/members.json は変更していません。");
}

main().catch((err) => {
  console.error("[import-members] 変換に失敗しました:", err.message);
  process.exit(1);
});
