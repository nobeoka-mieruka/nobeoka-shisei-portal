import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "src", "data", "siteUpdate.json");

function getLastCommitDate() {
  try {
    const out = execSync("git log -1 --format=%cI", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (!out) throw new Error("empty git output");
    return out;
  } catch {
    // Gitが使えない環境（cloneされていない、コミットがない等）では、ビルド実行日時にフォールバックする。
    return new Date().toISOString();
  }
}

const lastUpdated = getLastCommitDate();
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify({ lastUpdated }, null, 2)}\n`, "utf8");
console.log(`[generate-site-update] lastUpdated = ${lastUpdated}`);
