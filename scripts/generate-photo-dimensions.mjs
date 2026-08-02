#!/usr/bin/env node
/**
 * public/photos 内の議員写真（WebP）の実寸法を読み取り、
 * src/data/photoDimensions.json へ書き出す。
 *
 * 構造化データ（Person.image の ImageObject）で、実際の画像と異なる
 * width/height を指定しないようにするための情報源。写真ファイルを
 * 差し替えた場合は `node scripts/generate-photo-dimensions.mjs` を再実行すること。
 * （自動ビルドには組み込んでいない。写真の追加・差し替えは頻繁ではないため。）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const photosDir = path.join(rootDir, "public", "photos");
const outputPath = path.join(rootDir, "src", "data", "photoDimensions.json");

function getWebpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8X") {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  if (fourcc === "VP8 ") {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (fourcc === "VP8L") {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}

const result = {};
for (const file of fs.readdirSync(photosDir)) {
  if (!file.endsWith(".webp")) continue;
  const buf = fs.readFileSync(path.join(photosDir, file));
  const size = getWebpSize(buf);
  if (size) result[file] = size;
}

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
console.log(`[generate-photo-dimensions] ${Object.keys(result).length}件の寸法を書き出しました → ${path.relative(rootDir, outputPath)}`);
