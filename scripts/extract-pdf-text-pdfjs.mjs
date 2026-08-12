// @ts-nocheck
/**
 * pdfjs-dist（Mozilla PDF.js、既存devDependency）を使ったPDFテキスト抽出フォールバック。
 *
 * Windows WinRT（Windows.Data.Pdf、scripts/ocr-*-windows.ps1）が
 * 「HRESULT 0x80048040（非標準PDF形式）」等で読み込めないPDFでも、pdf.jsは
 * より寛容なパーサーのため読み込めることがある（広報のべおかアーカイブの調査で、
 * WinRTが拒否した17号中16号がpdf.jsでは正常に読み込めることを確認済み）。
 *
 * この経路はOCR（画像認識）ではなく、PDF内部のテキストレイヤーを直接抽出する
 * ため、文字認識誤りは原理的に発生しない。ただしフォント埋め込みの問題により
 * 一部の文字が正しく抽出できない場合がある（"TT: undefined function"等の警告）。
 * そのため抽出結果はWinRT OCR結果と同様に「raw」（未検証）として扱い、重要な
 * 数値・固有名詞は元PDF画像との照合を経てから確定データへ反映すること。
 *
 * 使い方:
 *   node --experimental-strip-types scripts/extract-pdf-text-pdfjs.mjs <PDFパス> <出力ディレクトリ>
 *
 * 原本のPDFファイルは一切変更しない（読み込み専用）。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [pdfPath, outDir] = process.argv.slice(2);
if (!pdfPath || !outDir) {
  console.error("使い方: node extract-pdf-text-pdfjs.mjs <PDFパス> <出力ディレクトリ>");
  process.exit(1);
}

const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

mkdirSync(outDir, { recursive: true });
const data = new Uint8Array(readFileSync(pdfPath));

try {
  const doc = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise;
  console.log(`LOADED|${doc.numPages}`);
  let successPages = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((it) => it.str).join(" ");
      writeFileSync(`${outDir}/page-${String(i).padStart(3, "0")}.txt`, text, "utf8");
      successPages++;
    } catch (e) {
      console.error(`page ${i} FAILED: ${e?.message ?? e}`);
    }
  }
  console.log(`RESULT|OK|${doc.numPages}|${successPages}|${doc.numPages - successPages}`);
} catch (e) {
  console.log(`RESULT|LOAD_FAILED|0|0|0`);
  console.error(`load failed: ${e?.message ?? e}`);
  process.exit(1);
}
