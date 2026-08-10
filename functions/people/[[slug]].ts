/**
 * /people?type=member 等、既知のtype値でアクセスされた場合、通常配信されるクエリ文字列
 * 非対応の静的HTML（絞り込みなし・全件）ではなく、scripts/prerender.mjsが事前生成した
 * 対応するバリアントHTML（dist/_people-variants/type-<value>.html、絞り込み後の人数を
 * 初期HTMLへ反映済み）を差し替えて返す。
 *
 * 目的：検索エンジン・OGPプレビュー等、JavaScriptを実行しない閲覧者にも、
 * /people/?type=member が現職議員26名として正しく伝わるようにするため
 * （SSR/prerender/hydrationの整合性確保。src/pages/PeoplePage.tsxの対応するコメントも参照）。
 *
 * ファイル名について：Cloudflare Pagesは既定で、リクエストパスに一致する静的ファイル
 * （例：dist/people/index.html）が存在する場合、Functionsを呼び出さず直接その静的
 * ファイルを返す。/people/（トレイリングスラッシュ付き）はまさにこのケースに該当する
 * ため、public/_routes.jsonで/people・/people/*をFunctions優先へ明示的に切り替えている
 * （_routes.json参照）。また、ファイル名を[[slug]].ts（オプショナルなキャッチオール）に
 * しているのは、Cloudflareの厳密なルートマッチング（末尾一致）が"/people"という文字列
 * ちょうどにしかマッチせず、実際のリクエストパス"/people/"（末尾スラッシュ付き）には
 * マッチしないため（実機検証で確認済み）。
 *
 * 安全設計：
 * - 既知でないtype値・typeパラメータなし・バリアントファイルが見つからない場合は、
 *   通常の静的アセット配信（context.next()）へフォールバックする（安全な既定値）。
 * - env.ASSETSが利用できない、想定外のエラーが発生した場合も、例外を投げず
 *   context.next()へフォールバックする（この関数が原因でサイトが壊れることを防ぐ）。
 * - 議員データそのものの取得・生成・変更は一切行わない（既存の静的ビルド成果物を
 *   配信し分けるだけ）。
 */

interface Env {
  // Cloudflare Pagesが自動的に注入する、静的アセット（dist/配下）へアクセスするための
  // バインディング。プロジェクト側でwrangler.jsonc等への追加設定は不要。
  ASSETS: Fetcher;
}

const KNOWN_PEOPLE_TYPES = new Set(["member", "former-member", "mayor"]);

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    // /people・/people/ のどちらでも動作するようにする（Cloudflare Pagesの
    // トレイリングスラッシュ正規化のタイミングに依存しない）。
    const pathname = url.pathname.replace(/\/$/, "") || "/";
    if (pathname !== "/people") {
      return context.next();
    }

    const type = url.searchParams.get("type");
    if (!type || !KNOWN_PEOPLE_TYPES.has(type)) {
      return context.next();
    }

    // Cloudflare Pagesの「clean URLs」機能により、.html付きで直接fetchすると
    // 拡張子なしURLへの308リダイレクトが返ってしまうため、拡張子なしでリクエストする。
    //
    // ここは意図的に、context.request の内容（ヘッダー等）を一切引き継がない、新規の
    // 無条件GETリクエストとして作成する。context.requestをそのままinitに渡すと、
    // ブラウザが/people/?type=memberに対して送ったIf-None-Match等の条件付きヘッダーが
    // 別URL（/_people-variants/...）へそのまま転送されてしまい、条件が一致した場合に
    // ASSETSが本文なしの304を返し、hydrationの不整合を招く（実機検証で発見・修正済み）。
    // 常に本文付きの200を受け取れるよう、無条件のGETに限定する。
    const variantUrl = new URL(`/_people-variants/type-${type}`, url.origin);
    const variantRequest = new Request(variantUrl.toString(), { method: "GET" });
    const variantResponse = await context.env.ASSETS.fetch(variantRequest);
    if (!variantResponse.ok) {
      return context.next();
    }

    // Content-Type等、配信に必要なヘッダーのみバリアント側から引き継ぐ。ETag等
    // キャッシュ検証系のヘッダーは、実URL（/people/?type=X）とは異なるリソース
    // （/_people-variants/type-X）由来の値のため引き継がない（ブラウザ側の条件付き
    // リクエストが再び別URLへ誤転送されるのを避けるため）。
    const headers = new Headers();
    const contentType = variantResponse.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "public, max-age=0, must-revalidate");
    return new Response(variantResponse.body, {
      status: 200,
      headers,
    });
  } catch {
    return context.next();
  }
};
