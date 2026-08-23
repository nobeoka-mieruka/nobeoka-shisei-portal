#!/usr/bin/env node
/**
 * orphan ID（外部キー参照切れ）横断チェック
 *
 * 【既存資産との重複回避】
 * scripts/validate-data.mjs はファイルごとに「このフィールドはこのファイルのidを参照する」という
 * 知識を手書きで多数実装済み（例: generalQuestions.memberId → members.json、
 * billVotes.relatedMayorPromiseIds → mayorPromises.json）。本スクリプトはそれらを置き換えない。
 *
 * 本スクリプトが補うのは、validate-data.mjs にまだ実装されていない可能性がある
 * 「フィールド名パターン → 参照先ファイル」の組み合わせを、命名規則から機械的に推測して
 * 横断チェックすること。特に、新しくフィールドが追加された際に参照整合性チェックが
 * 抜け落ちるのを検知する保険として使う想定。
 *
 * 設計上の注意：
 * - フィールド名からの推測は誤検出（false positive）を含みうる（例：文脈依存の"categoryId"）。
 *   そのため、明確な1対1対応が取れる組み合わせのみをレジストリに登録し、それ以外は
 *   「未解決キー候補」として一覧化するに留める（エラー扱いにしない）。
 * - null/undefined/空文字は「未確認」を意味しうるため対象外（validate-data.mjs側の方針と同じ）。
 * 読み取り専用。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listDataJsonFiles, readJson, walk } from "./_lib.mjs";

function isBlank(v) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/** 参照先ファイルからidのSetを安全に取得する（idが直下配列でない場合はextractorで指定）。 */
function idSetFrom(relPath, extractor) {
  try {
    const data = readJson(relPath);
    const items = extractor ? extractor(data) : data;
    return new Set((items ?? []).map((x) => x?.id).filter((x) => typeof x === "string"));
  } catch {
    return null; // ファイルが読めない場合は「チェック対象外」を表す
  }
}

// フィールド名パターン → 参照先idセットのレジストリ。
// 「現職・元職の両方を許容する」等、validate-data.mjs内の既存の例外方針をなるべく踏襲している。
const memberIds = idSetFrom("src/data/members.json");
const formerMemberIds = idSetFrom("src/data/formerMembers.json");
const memberOrFormerIds = memberIds && formerMemberIds ? new Set([...memberIds, ...formerMemberIds]) : null;
const billIds = idSetFrom("src/data/billVotes.json");
const sessionIds = idSetFrom("src/data/councilSessions.json");
const factionIds = idSetFrom("src/data/factions.json");
const committeeIds = idSetFrom("src/data/committees.json");
const archiveMayorIds = idSetFrom("src/data/archiveMayors.json");
const archiveMayorTermIds = idSetFrom("src/data/archiveMayorTerms.json");
const archiveMemberProfileIds = idSetFrom("src/data/archiveMemberProfiles.json");
const mayorPromiseIds = idSetFrom("src/data/mayorPromises.json", (d) => d.promises);
const questionIds = idSetFrom("src/data/generalQuestions.json");
const themeIds = idSetFrom("src/data/themes.json");

// field name (exact key match, case-sensitive) -> { idSet, sourceLabel }
// idSetがnull（読み込み失敗）のエントリは自動的にスキップされる。
const REGISTRY = [
  { field: "memberId", idSet: memberOrFormerIds, sourceLabel: "members.json ∪ formerMembers.json" },
  { field: "billId", idSet: billIds, sourceLabel: "billVotes.json" },
  { field: "sessionId", idSet: sessionIds, sourceLabel: "councilSessions.json" },
  { field: "factionId", idSet: factionIds, sourceLabel: "factions.json" },
  { field: "committeeId", idSet: committeeIds, sourceLabel: "committees.json" },
  { field: "mayorId", idSet: archiveMayorIds, sourceLabel: "archiveMayors.json" },
  { field: "mayorTermId", idSet: archiveMayorTermIds, sourceLabel: "archiveMayorTerms.json" },
  { field: "previousMayorId", idSet: archiveMayorIds, sourceLabel: "archiveMayors.json" },
  { field: "nextMayorId", idSet: archiveMayorIds, sourceLabel: "archiveMayors.json" },
  { field: "memberProfileId", idSet: archiveMemberProfileIds, sourceLabel: "archiveMemberProfiles.json" },
  { field: "mayorPromiseId", idSet: mayorPromiseIds, sourceLabel: "mayorPromises.json (promises)" },
  { field: "questionId", idSet: questionIds, sourceLabel: "generalQuestions.json" },
  { field: "themeId", idSet: themeIds, sourceLabel: "themes.json" },
];
// 配列版（*Ids）も同じレジストリで扱う。
const ARRAY_REGISTRY = REGISTRY.map((r) => ({ ...r, field: `${r.field}s` }));

const files = listDataJsonFiles();
const violations = [];
const unresolvedFieldNames = new Map(); // フィールド名 -> 出現ファイルSet（レジストリ未登録の*Id/*Idsフィールド）

const REGISTERED_FIELD_NAMES = new Set([...REGISTRY, ...ARRAY_REGISTRY].map((r) => r.field));
const KNOWN_NON_FK_ID_FIELDS = new Set([
  "id",
  "categoryId", // 複数ファイルで文脈が異なるため個別のvalidate-data.mjs側チェックに委ねる
  "documentKey",
]);

for (const file of files) {
  let data;
  try {
    data = readJson(join("src", "data", file).replace(/\\/g, "/"));
  } catch {
    continue;
  }

  walk(data, (node, path) => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      const single = REGISTRY.find((r) => r.field === key);
      if (single && single.idSet && !isBlank(value)) {
        if (!single.idSet.has(value)) {
          violations.push({ file, path: `${path}.${key}`, field: key, value, expectedSource: single.sourceLabel });
        }
        continue;
      }
      const arr = ARRAY_REGISTRY.find((r) => r.field === key);
      if (arr && arr.idSet && Array.isArray(value)) {
        for (const v of value) {
          if (!isBlank(v) && !arr.idSet.has(v)) {
            violations.push({ file, path: `${path}.${key}[]`, field: key, value: v, expectedSource: arr.sourceLabel });
          }
        }
        continue;
      }
      // レジストリ未登録の *Id / *Ids フィールドを「未解決候補」として集計（人手レビュー用）。
      if (
        /Id$/.test(key) &&
        !REGISTERED_FIELD_NAMES.has(key) &&
        !REGISTERED_FIELD_NAMES.has(key.replace(/Id$/, "Ids")) &&
        !KNOWN_NON_FK_ID_FIELDS.has(key)
      ) {
        if (!unresolvedFieldNames.has(key)) unresolvedFieldNames.set(key, new Set());
        unresolvedFieldNames.get(key).add(file);
      }
      if (/Ids$/.test(key) && Array.isArray(value) && !REGISTERED_FIELD_NAMES.has(key) && !KNOWN_NON_FK_ID_FIELDS.has(key)) {
        if (!unresolvedFieldNames.has(key)) unresolvedFieldNames.set(key, new Set());
        unresolvedFieldNames.get(key).add(file);
      }
    }
  });
}

const findings = {
  generatedAt: new Date().toISOString(),
  registrySize: REGISTRY.filter((r) => r.idSet).length,
  registryUnavailable: REGISTRY.filter((r) => !r.idSet).map((r) => r.field),
  orphanCount: violations.length,
  orphans: violations,
  unresolvedFieldNames: Object.fromEntries(
    [...unresolvedFieldNames.entries()].map(([k, v]) => [k, [...v]]),
  ),
  note:
    "unresolvedFieldNamesは、命名規則上は外部キーらしいが本スクリプトのレジストリに未登録のフィールド一覧。" +
    "誤検出防止のため自動チェックはしていない。将来レジストリへ追加するか、既にvalidate-data.mjs側で" +
    "個別チェック済みかを人手で確認すること。",
};

const outPath = join(ROOT, "reports", "qa-checks", "_out-orphan-fk.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log(`[check-orphan-foreign-keys] registryFields=${findings.registrySize} orphans=${violations.length}`);
console.log("  unresolvedFieldNames:", Object.keys(findings.unresolvedFieldNames).length, "件");
if (violations.length > 0) console.log("  例:", violations.slice(0, 5));
process.exitCode = violations.length > 0 ? 1 : 0;
