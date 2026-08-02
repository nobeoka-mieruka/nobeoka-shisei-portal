/**
 * public/council-documents/ 配下のPDFを走査し、src/data/councilSessions.json へ反映する。
 *
 * 目的：
 * - 既存資料（storageType: "external"）に対応するPDFがローカルに保存されていれば、
 *   storageType: "local" に切り替え、filePathを設定する（sourceUrlは保持する）。
 * - 既存データに存在しない新しいPDFが見つかった場合は、資料名などを推測せず
 *   verificationStatus: "要確認" を付けたうえで最小限の情報だけ登録する。
 * - 定例会フォルダ自体が未登録の場合も、フォルダ名から機械的に導出できる情報
 *   （ID・年度・元号・種別）だけを使って最小限の定例会データを作成し、
 *   status: "要確認" を付ける（会期日程・回次などは絶対に推測しない）。
 *
 * 手入力済みの title / description / sourceUrl / notes 等は上書きしない。
 * 複数回実行しても同じ結果になる（filePathを一意キーとして扱う）。
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORY_FOLDER_SET as CATEGORY_FOLDERS,
  eraYearFor,
  parseSessionId,
  titleForSessionId,
} from "./lib/council-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const councilDocsDir = join(root, "public", "council-documents");
const dataPath = join(root, "src", "data", "councilSessions.json");

function walkPdfFiles(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkPdfFiles(full, results);
    } else if (/\.pdf$/i.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

function titleFromFilename(filename) {
  const base = filename.replace(/\.pdf$/i, "");
  return base.replace(/[-_]+/g, " ").trim() || filename;
}

const pdfFiles = walkPdfFiles(councilDocsDir);

/** @type {any[]} */
const sessions = existsSync(dataPath) ? JSON.parse(readFileSync(dataPath, "utf8")) : [];
const sessionById = new Map(sessions.map((s) => [s.id, s]));

const stats = {
  detected: pdfFiles.length,
  switchedToLocal: 0,
  newDocuments: 0,
  newSessions: 0,
  alreadyLocal: 0,
  needsReview: [],
  warnings: [],
};

for (const absPath of pdfFiles) {
  const relFromCouncilDocs = relative(councilDocsDir, absPath).split(sep).join("/");
  const segments = relFromCouncilDocs.split("/");
  const filename = segments[segments.length - 1];
  const filePath = `/council-documents/${relFromCouncilDocs}`;

  if (/[^ -~]/.test(filename) || /\s/.test(filename)) {
    stats.warnings.push(`ファイル名に日本語または空白が含まれています（半角英数字とハイフンを推奨）: ${filePath}`);
  }
  if (/[()（）]/.test(filename)) {
    stats.warnings.push(`ファイル名に括弧が含まれています: ${filePath}`);
  }

  if (segments.length < 2) {
    stats.warnings.push(`年度・定例会フォルダの直下に置かれていないため対象外にしました: ${filePath}`);
    continue;
  }

  const yearFolder = segments[0];
  const sessionId = segments[1];
  const middleSegments = segments.slice(2, -1);
  const category = middleSegments.find((seg) => CATEGORY_FOLDERS.has(seg)) ?? null;

  let session = sessionById.get(sessionId);
  if (!session) {
    const parsed = parseSessionId(sessionId);
    const year = parsed?.year ?? Number(yearFolder);
    session = {
      id: sessionId,
      year,
      fiscalYear: Number(yearFolder),
      eraYear: eraYearFor(year),
      title: titleForSessionId(sessionId),
      sessionType: sessionId.includes("extraordinary") ? "臨時会" : "定例会",
      folderPath: `/council-documents/${yearFolder}/${sessionId}`,
      documents: [],
      officialSessionUrl: "https://www.city.nobeoka.miyazaki.jp/site/gikai/1456.html",
      status: "要確認",
    };
    sessions.push(session);
    sessionById.set(sessionId, session);
    stats.newSessions++;
    stats.needsReview.push(
      `[新規定例会] ${sessionId}：フォルダ名から機械的に作成しました（正式名称・回次・会期は未確認）。src/data/councilSessions.jsonで内容を確認してください。`,
    );
  }

  // 既にこのfilePathで登録済みなら何もしない（冪等性）。
  const alreadyMatched = session.documents.find((d) => d.filePath === filePath);
  if (alreadyMatched) {
    stats.alreadyLocal++;
    continue;
  }

  if (category) {
    // カテゴリフォルダが分かる場合：同カテゴリでまだfilePathが未設定の資料があればそれに合わせる。
    const target = session.documents.find((d) => d.category === category && !d.filePath);
    if (target) {
      target.storageType = "local";
      target.filePath = filePath;
      stats.switchedToLocal++;
      continue;
    }
    // 合致する既存資料がない → 新規資料として追加（内容は推測しない）。
    session.documents.push({
      id: `${sessionId}-${category}-auto-${session.documents.length + 1}`,
      category,
      title: titleFromFilename(filename),
      storageType: "local",
      filePath,
      fileType: "PDF",
      sourceUrl: "",
      isOfficial: true,
      verificationStatus: "要確認",
    });
    stats.newDocuments++;
    stats.needsReview.push(`[新規資料] ${sessionId} / ${filePath}：資料名・出典URLを確認してください。`);
    continue;
  }

  // カテゴリフォルダが無い（定例会フォルダ直下にPDFが1つだけ置かれているケース）。
  const unmatchedDocs = session.documents.filter((d) => !d.filePath);
  if (unmatchedDocs.length === 1) {
    const target = unmatchedDocs[0];
    target.storageType = "local";
    target.filePath = filePath;
    stats.switchedToLocal++;
    continue;
  }

  // 0件または複数件で一意に対応付けできない → 新規資料として"other"分類で追加し、要確認とする。
  session.documents.push({
    id: `${sessionId}-other-auto-${session.documents.length + 1}`,
    category: "other",
    title: titleFromFilename(filename),
    storageType: "local",
    filePath,
    fileType: "PDF",
    sourceUrl: "",
    isOfficial: true,
    verificationStatus: "要確認",
  });
  stats.newDocuments++;
  stats.needsReview.push(
    `[新規資料・分類要確認] ${sessionId} / ${filePath}：資料分類フォルダ（proposals/results/petitions/statements/minutes/newsletters/other）が無いため"other"としました。分類を確認してください。`,
  );
}

writeFileSync(dataPath, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");

console.log(
  `[generate-council-documents] 検出PDF=${stats.detected} 既に反映済み=${stats.alreadyLocal} localへ切替=${stats.switchedToLocal} 新規資料=${stats.newDocuments} 新規定例会=${stats.newSessions}`,
);
if (stats.warnings.length > 0) {
  console.warn("\n[警告]");
  for (const w of stats.warnings) console.warn(` - ${w}`);
}
if (stats.needsReview.length > 0) {
  console.log("\n[要確認]");
  for (const r of stats.needsReview) console.log(` - ${r}`);
}
