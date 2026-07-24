/**
 * src/config/site.ts（唯一の情報源）から SITE_URL / SITE_NAME を読み取り、
 * ビルドスクリプト（.mjs）側で使い回すための小さなモジュール。
 *
 * .mjsファイルはTypeScriptを直接importできないため、対象ファイルの該当する
 * 定数宣言の行だけを正規表現で抽出する（scripts/lib/public-routes.mjsの
 * mayorPressConferences抽出と同じ方針）。抽出できない場合はビルドを止める
 * （ドメインの取り違えは検索エンジン側の影響が大きいため、黙って既定値に
 * フォールバックしない）。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function extractConst(src, name) {
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")`));
  if (!m) return undefined;
  return JSON.parse(m[1]);
}

const siteConfigSrc = readFileSync(join(root, "src", "config", "site.ts"), "utf8");

export const SITE_URL = extractConst(siteConfigSrc, "SITE_URL");
export const SITE_NAME = extractConst(siteConfigSrc, "SITE_NAME");

if (!SITE_URL || !SITE_NAME) {
  throw new Error(
    "[site-config] src/config/site.ts から SITE_URL / SITE_NAME を読み取れませんでした。定数の書式が変わっていないか確認してください。",
  );
}

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
