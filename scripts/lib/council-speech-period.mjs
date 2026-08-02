/**
 * src/config/councilSpeechPeriod.json を読み込むだけの薄いラッパー（scripts/*.mjs用）。
 * 値そのものはsrc/config/councilSpeechPeriod.jsonが単一情報源。変更する場合はそちらを編集する。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

export const councilSpeechPeriod = JSON.parse(readFileSync(join(root, "src", "config", "councilSpeechPeriod.json"), "utf8"));

/** 発言日（ISO形式）が対象期間に含まれるかどうか。日付未確認（null/undefined）はfalseとして扱う。 */
export function isWithinCouncilSpeechPeriod(dateIso) {
  if (!dateIso) return false;
  const afterFrom = dateIso >= councilSpeechPeriod.from;
  const beforeTo = councilSpeechPeriod.to == null || dateIso <= councilSpeechPeriod.to;
  return afterFrom && beforeTo;
}
