/**
 * Phase193：/people/:slug のスラッグ操作と表示ラベルだけを切り出した軽量モジュール。
 *
 * 実装内容はsrc/lib/people.tsから移動しただけで、文字列変換のみ。議案・発言要約などの
 * 大きなデータは一切参照しない。people.tsは人物一覧の組み立て（統合タイムライン等）のため
 * billVotes.json・councilSpeechSummaries.jsonを読み込むため、SEOのようにスラッグ解釈しか
 * 必要としない側がpeople.tsをimportすると、初期ロードのチャンクへ数MBのデータが
 * 巻き込まれてしまう。その分離のためのファイル。
 * 既存の呼び出し側との互換のため、people.tsからも同じ名前で再エクスポートしている。
 */

export type PersonType = "member" | "former-member" | "mayor";

export function personSlug(personType: PersonType, id: string): string {
  return `${personType}-${id}`;
}

export function parsePersonSlug(slug: string): { personType: PersonType; id: string } | undefined {
  for (const type of ["member", "former-member", "mayor"] as PersonType[]) {
    const prefix = `${type}-`;
    if (slug.startsWith(prefix)) return { personType: type, id: slug.slice(prefix.length) };
  }
  return undefined;
}

export function personTypeLabel(type: PersonType): string {
  switch (type) {
    case "member":
      return "現職議員";
    case "former-member":
      return "元議員";
    case "mayor":
      return "市長";
  }
}
