/**
 * サイトマップ・WebPage構造化データのlastmod（dateModified）を、
 * 「ビルドした日」ではなく実際の更新根拠から求めるための共通ヘルパー。
 *
 * 優先順位（呼び出し側でこの順に試す想定）：
 * 1. 各データにある verifiedAt / updatedAt / lastVerified / confirmedAt / lastChecked / questionDate 等
 * 2. 更新履歴（updateHistory.json）に記録された対象ページの更新日（linkUrlが一致するもの）
 * 3. データファイルのGit上の最終コミット日（内容が変わった日。checkoutのタイムスタンプではない）
 * 4. サイト全体の最終更新日（siteUpdate.json）
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// public-routes.mjsのrootと循環importにならないよう、ここでも独立して定義する。
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 未来日・1970年などの初期値らしき日付を除外し、YYYY-MM-DD形式のときだけ採用する。 */
export function asValidDate(value) {
  if (typeof value !== "string") return undefined;
  const dateOnly = DATE_RE.test(value) ? value : (value.match(/^(\d{4}-\d{2}-\d{2})T/)?.[1] ?? undefined);
  if (!dateOnly) return undefined;
  const year = Number(dateOnly.slice(0, 4));
  if (year < 2000) return undefined;
  const d = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // ビルド実行時のタイムゾーン差による1日程度のずれは許容する。
  if (d.getTime() > todayUtc + 2 * 24 * 60 * 60 * 1000) return undefined;
  return dateOnly;
}

/** 複数の日付候補から、有効なものだけを残して最も新しい日付を返す。 */
export function maxValidDate(values) {
  const valid = values.map(asValidDate).filter((v) => typeof v === "string");
  if (valid.length === 0) return undefined;
  return valid.sort().at(-1);
}

let shallowRepoWarned = false;
/**
 * 浅いclone（fetch-depth:1等）だと、直近コミットで変更されていないファイルの履歴を
 * git logで辿れず、gitLastCommitDateが実際には情報があるのに毎回undefinedを返し、
 * resolveLastmod()が最終フォールバック（サイト全体の最終更新日＝実質ビルド実行日）に
 * 落ちてしまう（実際には更新していないページのlastmodが常に「今日」に見える不具合。
 * 2026-08-08、GitHub Actionsのcheckout@v4がデフォルトのfetch-depth:1だったために発生）。
 * CI側はfetch-depth:0で全履歴を取得する設定にしたが、設定漏れを静かに再発させないよう、
 * 浅いcloneを検出した場合はビルドログへ警告を出す。
 */
function warnIfShallowRepo() {
  if (shallowRepoWarned) return;
  shallowRepoWarned = true;
  try {
    const isShallow = execSync("git rev-parse --is-shallow-repository", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (isShallow === "true") {
      console.warn(
        "[lastmod] 警告：Gitの浅いclone（shallow clone）を検出しました。ページのlastmod（最終更新日）が" +
          "実際の更新日ではなく、フォールバックのサイト全体最終更新日（ビルド実行日相当）になっている" +
          "可能性があります。CIのcheckoutステップにfetch-depth: 0を設定してください。",
      );
    }
  } catch {
    // git自体が使えない環境（通常のビルドでは想定外）は静かにスキップする。
  }
}

/** 対象ファイルのGit上の最終コミット日（YYYY-MM-DD）。Git情報がない場合はundefined。 */
export function gitLastCommitDate(relPathFromRoot) {
  warnIfShallowRepo();
  try {
    const out = execSync(`git log -1 --format=%cd --date=short -- "${relPathFromRoot}"`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return asValidDate(out);
  } catch {
    return undefined;
  }
}

let updateHistoryCache;
function loadUpdateHistory() {
  if (!updateHistoryCache) {
    updateHistoryCache = JSON.parse(readFileSync(join(root, "src", "data", "updateHistory.json"), "utf8"));
  }
  return updateHistoryCache;
}

/** 更新履歴の中から、linkUrlが指定ページと一致するものの最新日付を返す。 */
export function lastmodFromUpdateHistory(path) {
  const entries = loadUpdateHistory().filter((e) => e.linkUrl === path);
  return maxValidDate(entries.map((e) => e.date));
}

let siteUpdateCache;
/** サイト全体の最終更新日（siteUpdate.json、Gitの最新コミット日ベース）。最後のフォールバック。 */
export function siteWideLastmod() {
  if (!siteUpdateCache) {
    try {
      const data = JSON.parse(readFileSync(join(root, "src", "data", "siteUpdate.json"), "utf8"));
      siteUpdateCache = asValidDate(data.lastUpdated);
    } catch {
      siteUpdateCache = undefined;
    }
  }
  return siteUpdateCache;
}

/**
 * 優先順位に沿ってページのlastmodを解決する。
 * @param {string} path ルートパス
 * @param {(string | undefined)[]} dataDates 優先順位1：データ内の日付候補（複数可、最新のものを採用）
 * @param {string[]} dataFileRelPaths 優先順位3：dataDatesが無い場合に参照するデータファイル（複数可、Git最終更新が最も新しいもの）
 */
export function resolveLastmod(path, dataDates, dataFileRelPaths = []) {
  const fromData = maxValidDate(dataDates);
  if (fromData) return fromData;

  const fromHistory = lastmodFromUpdateHistory(path);
  if (fromHistory) return fromHistory;

  const fromFiles = maxValidDate(dataFileRelPaths.map(gitLastCommitDate));
  if (fromFiles) return fromFiles;

  return siteWideLastmod();
}
