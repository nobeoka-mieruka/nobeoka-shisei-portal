/**
 * pdfjs-dist（純Node.js実装、OS依存のexeやネイティブバイナリを使わない）による
 * PDF本文テキスト抽出。GitHub Actions・Cloudflare Pages・Windows/Mac/Linuxいずれでも
 * 同じコードで動作することを優先している。
 */
import { readFile } from "node:fs/promises";

/** 1ページあたりの抽出結果。rawText は視認用（アイテムをスペースで連結）、normalizedText は解析用（空白を除去）。 */
async function extractPage(page) {
  const content = await page.getTextContent();
  const rawText = content.items.map((it) => it.str).join(" ");
  const normalizedText = rawText.replace(/\s+/g, "");
  return { rawText, normalizedText, itemCount: content.items.length };
}

/**
 * PDFファイルからページごとのテキストを抽出する。
 * 画像のみで文字情報が実質的に取得できない場合は ocrRequired=true を返す
 * （誤った内容を自動生成しないよう、呼び出し側はこの場合に抽出結果を使ってはならない）。
 */
export async function extractPdfText(filePath, { minCharsPerPage = 20 } = {}) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buffer = await readFile(filePath);
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const pages = [];
  let totalChars = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const result = await extractPage(page);
    pages.push({ pageNumber: i, ...result });
    totalChars += result.normalizedText.length;
  }
  await doc.destroy();

  const ocrRequired = totalChars < minCharsPerPage * Math.max(doc.numPages, 1);
  return { numPages: doc.numPages, pages, totalChars, ocrRequired };
}
