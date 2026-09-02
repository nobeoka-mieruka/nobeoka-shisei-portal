/**
 * 背景色に対して十分なコントラスト比が得られる文字色を選ぶユーティリティ。
 *
 * Phase194（WCAG 2.1 AA / 1.4.3 コントラスト）対応。
 * 会派色などデータ側で管理している識別色は変更せず、表示側で文字色だけを切り替える。
 * 計算式はWCAG 2.1の相対輝度・コントラスト比の定義に従う。
 */

/** #RGB / #RRGGBB 形式の色を 0-255 のRGBへ変換する。解釈できない場合はnull。 */
function parseHexColor(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    const r = parseInt(value[0] + value[0], 16);
    const g = parseInt(value[1] + value[1], 16);
    const b = parseInt(value[2] + value[2], 16);
    return [r, g, b];
  }
  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
  }
  return null;
}

/** WCAG 2.1の相対輝度。 */
export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1のコントラスト比（1〜21）。 */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE: [number, number, number] = [255, 255, 255];
/** 純黒よりわずかに明るい濃色。MD3のon-surface相当で、黒ベタより見た目がなじむ。 */
const NEAR_BLACK: [number, number, number] = [26, 27, 32];

/**
 * 背景色に対してコントラスト比が高い方の文字色（白 or 濃色）を返す。
 * 解釈できない色が渡された場合は白（従来の表示）を返す。
 */
export function getReadableTextColor(backgroundHex: string): string {
  const bg = parseHexColor(backgroundHex);
  if (!bg) return "#ffffff";
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, NEAR_BLACK) ? "#ffffff" : "#1a1b20";
}
