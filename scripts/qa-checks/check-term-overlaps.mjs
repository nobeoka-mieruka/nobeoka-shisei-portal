#!/usr/bin/env node
/**
 * 任期重複・任期逆転チェック（横断版）
 *
 * 【既存資産との重複回避】
 * scripts/lib/validate-archive-common.mjs の checkNoOverlappingPeriods / checkPeriodConsistency は
 * 既にarchiveMayorTerms.json等の一部ファイルでvalidate-data.mjsから呼び出されている
 * （grep結果: validate-data.mjs内でcheckNoOverlappingPeriodsが3箇所で使用済み）。
 * 本スクリプトはそれを置き換えず、以下を横断的に補う：
 *  - まだcheckNoOverlappingPeriods等が適用されていない期間データファイル
 *    （electionResults.json、archiveMemberAffiliations.json等）も対象に含める。
 *  - グループ化キー（対象人物・役職を表すフィールド）を複数パターン試行し、
 *    「同一人物内での終了日<開始日（逆転）」「同一人物内での期間重複」の両方を検出する。
 *
 * 開始日・終了日のフィールド名は startDate/endDate、termStart/termEnd 等ファイルによって
 * 異なるため、候補ペアを順に試す。該当ペアが見つからないファイルはスキップする。
 * 読み取り専用。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listDataJsonFiles, readJson } from "./_lib.mjs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 期間フィールドの候補ペア（start, end）。ファイルごとにどちらが存在するかを見て自動選択する。
const PERIOD_FIELD_CANDIDATES = [
  ["termStart", "termEnd"],
  ["startDate", "endDate"],
  ["electionDate", null], // 選挙は単発日程のため終了日なし（後段で単発イベントとして別扱い）
];

// グループ化キー（同一人物・同一役職とみなすフィールド）の候補。
const GROUP_FIELD_CANDIDATES = ["mayorId", "memberId", "memberProfileId", "personId", "linkedProfileId"];
// 同一人物でも「党派」「委員会役職」等、性質の異なる複数トラックが並行して存在しうるファイルがある
// （例: archiveMemberAffiliations.jsonのaffiliationType="party"/"committee"）。これらを同一グループとして
// 重複判定すると誤検出になるため、存在すればグループキーに合成する。
const TRACK_DISCRIMINATOR_CANDIDATES = ["affiliationType", "type", "category"];

const files = listDataJsonFiles();
const results = [];

function findArraysWithPeriods(data) {
  const arrays = [];
  if (Array.isArray(data)) arrays.push({ path: "$", items: data });
  else if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object")) {
        arrays.push({ path: `$.${k}`, items: v });
      }
    }
  }
  return arrays;
}

for (const file of files) {
  let data;
  try {
    data = readJson(join("src", "data", file).replace(/\\/g, "/"));
  } catch {
    continue;
  }

  for (const { path, items } of findArraysWithPeriods(data)) {
    // このファイル/配列にどの期間フィールドペア・グループキーが存在するか判定する。
    const sample = items.find((x) => x && typeof x === "object") ?? {};
    const periodPair = PERIOD_FIELD_CANDIDATES.find(([s]) => s in sample && DATE_RE.test(sample[s] ?? ""));
    if (!periodPair) continue;
    const [startField, endField] = periodPair;
    if (!endField) continue; // 単発日程（選挙日等）は期間重複の対象外

    const groupField = GROUP_FIELD_CANDIDATES.find((g) => items.some((x) => typeof x?.[g] === "string"));
    if (!groupField) continue;
    const discriminatorField = TRACK_DISCRIMINATOR_CANDIDATES.find((d) => items.some((x) => typeof x?.[d] === "string"));
    const groupKeyOf = (item) =>
      discriminatorField ? `${item[groupField]}::${item[discriminatorField] ?? ""}` : item[groupField];

    const fileTag = `${file}${path}`;

    // (1) 開始日 > 終了日（逆転）
    for (const item of items) {
      const s = item[startField];
      const e = item[endField];
      if (typeof s === "string" && DATE_RE.test(s) && typeof e === "string" && DATE_RE.test(e) && s > e) {
        results.push({
          type: "reversal",
          file: fileTag,
          id: item.id ?? "(id不明)",
          group: item[groupField],
          startField,
          endField,
          startValue: s,
          endValue: e,
        });
      }
    }

    // (2) 同一グループ内の期間重複
    const groups = new Map();
    for (const item of items) {
      if (typeof item[groupField] !== "string") continue;
      const g = groupKeyOf(item);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(item);
    }
    for (const [g, group] of groups.entries()) {
      const sorted = [...group].sort((a, b) => String(a[startField] ?? "").localeCompare(String(b[startField] ?? "")));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        const prevEnd = prev[endField];
        const curStart = cur[startField];
        if (typeof curStart !== "string" || !DATE_RE.test(curStart)) continue;
        // endDate=nullは「現在も継続中」を意味するため、それ自体は次のレコードと必ず重複扱いになる。
        // ただしarchive系の設計方針（1人が同時に2期を務めることは無い）に基づき、これも検出対象とする。
        if (prevEnd === null || prevEnd === undefined || (typeof prevEnd === "string" && DATE_RE.test(prevEnd) && prevEnd >= curStart)) {
          results.push({
            type: "overlap",
            file: fileTag,
            group: g,
            groupField: discriminatorField ? `${groupField}+${discriminatorField}` : groupField,
            prevId: prev.id ?? "(id不明)",
            prevEnd: prevEnd ?? null,
            curId: cur.id ?? "(id不明)",
            curStart,
          });
        }
      }
    }
  }
}

const findings = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  reversalCount: results.filter((r) => r.type === "reversal").length,
  overlapCount: results.filter((r) => r.type === "overlap").length,
  results,
  note:
    "既にscripts/validate-data.mjsでcheckNoOverlappingPeriods等が適用済みのファイル（archiveMayorTerms.json等）は" +
    "本スクリプトでも重複検出されるが、既存検証と同一の結果である可能性が高い（二重報告）。" +
    "本スクリプトの価値は、既存検証が及んでいない期間データファイルまで横断的に対象を広げている点にある。" +
    "endDate=nullの継続中レコードは、後続レコードとの比較で機械的にoverlap扱いになりうるため、" +
    "『現職の任期継続中に次の記録が誤って追加されていないか』という観点で読むこと。",
};

const outPath = join(ROOT, "reports", "qa-checks", "_out-term-overlaps.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log(`[check-term-overlaps] reversal=${findings.reversalCount} overlap=${findings.overlapCount}`);
if (results.length > 0) console.log("  例:", results.slice(0, 5));
process.exitCode = findings.reversalCount > 0 ? 1 : 0;
