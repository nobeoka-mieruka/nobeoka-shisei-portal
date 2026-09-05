/**
 * Phase240：クエリ付きURLへ直接アクセスしたときのハイドレーション不一致（React #418）の再発防止テスト。
 *
 * 背景：本サイトはビルド時にHTMLを書き出し（scripts/prerender.mjs）、静的ホスティング
 * （Cloudflare Pages）で配信する。静的ホスティングはクエリ文字列を無視して同じファイルを返すため、
 * プリレンダリング済みHTMLの中身は常に「クエリなし」の状態になる。
 * ページ側がレンダリング中に useSearchParams() の値を使って表示を変えていると、
 * 初回クライアントレンダリングだけが絞り込み後の内容になり、React のハイドレーションエラー
 * （本番ビルドでは Minified React error #418）になる。
 *
 * ブラウザでの実測は scripts/audit-hydration.mjs（npm run audit:hydration）が行う。
 * こちらはブラウザ不要で `npm test` に載せられる、ソースと生成物に対する構造の固定。
 *
 * 使い方: node --experimental-strip-types scripts/test-hydration-safety.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCompareSelection, MIN_COMPARE_ITEMS, MAX_COMPARE_ITEMS } from "../src/lib/archiveCompare.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let checks = 0;
const failures = [];

function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) failures.push(`${name}${detail ? `：${detail}` : ""}`);
}

function listFiles(dir, exts) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const srcFiles = listFiles(join(root, "src"), [".ts", ".tsx"]);
const read = (file) => readFileSync(file, "utf8");
const rel = (file) => relative(root, file).replace(/\\/g, "/");

// --- 1. 共通フックの契約（サーバー出力と初回クライアント出力を必ず一致させる） ---
const isHydratedSrc = read(join(root, "src/hooks/useIsHydrated.ts"));
check(
  "useIsHydrated は useSyncExternalStore で実装されている",
  isHydratedSrc.includes("useSyncExternalStore"),
);
check(
  "useIsHydrated のサーバー側スナップショットは false（＝未確定）",
  /getServerSnapshot\s*=\s*\(\)\s*=>\s*false/.test(isHydratedSrc),
);
check(
  "useIsHydrated のクライアント側スナップショットは true（＝確定）",
  /getClientSnapshot\s*=\s*\(\)\s*=>\s*true/.test(isHydratedSrc),
);

const hydratedParamsSrc = read(join(root, "src/hooks/useHydratedSearchParams.ts"));
check(
  "useHydratedSearchParams はハイドレーション完了前に空のクエリを返す",
  /hydrated\s*\?\s*searchParams\s*:\s*EMPTY_SEARCH_PARAMS/.test(hydratedParamsSrc),
);
check(
  "useInitialSearchParams はアクセス時のクエリを保持し、完了後に反映する",
  hydratedParamsSrc.includes("initialParamsRef") && /useEffect\(\(\)\s*=>\s*\{[\s\S]*applyRef\.current/.test(hydratedParamsSrc),
);

// --- 2. 不一致を「隠す」対処を禁止する ---
/** コメント（/* *​/ と //）を取り除く。方針を説明したコメント内の言及を検出対象から外すため。 */
function stripComments(source) {
  return source.replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const suppressUsers = srcFiles.filter((f) => stripComments(read(f)).includes("suppressHydrationWarning"));
check(
  "suppressHydrationWarning で不一致を隠していない",
  suppressUsers.length === 0,
  suppressUsers.map(rel).join(", "),
);

// --- 3. useSearchParams を使うページは、必ずハイドレーション安全な仕組みを併用している ---
const HYDRATION_GATES = ["useHydratedSearchParams", "useInitialSearchParams", "useIsHydrated"];
const rawUsers = srcFiles.filter(
  (f) => /\buseSearchParams\(\)/.test(read(f)) && rel(f) !== "src/hooks/useHydratedSearchParams.ts",
);
for (const file of rawUsers) {
  const s = read(file);
  const gated = HYDRATION_GATES.some((g) => s.includes(g));
  check(
    `${rel(file)} は useSearchParams をハイドレーション安全に扱っている`,
    gated,
    gated ? "" : "useHydratedSearchParams / useInitialSearchParams / useIsHydrated のいずれも使っていない",
  );
}
check("useSearchParams を直接使うファイルを把握できている", rawUsers.length > 0);

// --- 4. 比較ページはレンダリング中に生の useSearchParams を読まない ---
const comparePages = srcFiles.filter((f) => /src[\\/]pages[\\/]/.test(f) && read(f).includes("parseCompareSelection"));
check("parseCompareSelection を使うページを検出できている", comparePages.length > 0);
for (const file of comparePages) {
  const s = read(file);
  check(
    `${rel(file)} は useHydratedSearchParams を使っている`,
    s.includes("useHydratedSearchParams(") && !/\buseSearchParams\(\)/.test(s),
  );
}

// --- 5. 選択状態の解析そのものの契約（クエリなし＝未選択） ---
const dummyIds = ["a", "b", "c", "d", "e"];
check(
  "クエリなしのときの選択は0件（プリレンダリング済みHTMLと同じ状態）",
  parseCompareSelection(new URLSearchParams(), dummyIds).length === 0,
);
check(
  "クエリありのときは指定された順に選択される",
  parseCompareSelection(new URLSearchParams("items=b,a"), dummyIds).join(",") === "b,a",
);
check(
  "選択できる最大件数を超えない",
  parseCompareSelection(new URLSearchParams(`items=${dummyIds.join(",")}`), dummyIds).length === MAX_COMPARE_ITEMS,
);
check("比較に必要な最小件数は2件以上", MIN_COMPARE_ITEMS >= 2);

// --- 6. プリレンダリング済みHTMLが「未選択」の状態であること（dist がある場合だけ） ---
// 初回クライアントレンダリングも必ず未選択（＝上の 5.）なので、両者が一致する。
const distDir = join(root, "dist");
if (existsSync(join(distDir, "index.html"))) {
  const pickerPages = srcFiles.filter((f) => /src[\\/]pages[\\/]/.test(f) && read(f).includes("CompareItemPicker"));
  check("CompareItemPicker を使うページを検出できている", pickerPages.length > 0);

  // ルートは src/App.tsx の <Route path=... element={<Xxx />} /> から読み取る（対応表を二重管理しない）。
  const appSrc = read(join(root, "src/App.tsx"));
  const routeByComponent = new Map();
  for (const m of appSrc.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)\s*\/>\}/g)) {
    routeByComponent.set(m[2], m[1]);
  }

  for (const file of pickerPages) {
    const componentName = rel(file).replace(/^.*\//, "").replace(/\.tsx$/, "");
    const routePath = routeByComponent.get(componentName);
    check(`${componentName} のルートを App.tsx から特定できる`, !!routePath, routePath ?? "見つからない");
    if (!routePath) continue;
    const htmlPath = join(distDir, routePath.replace(/^\//, ""), "index.html");
    if (!existsSync(htmlPath)) {
      check(`${routePath} のプリレンダリング済みHTMLがある`, false, htmlPath);
      continue;
    }
    // React のサーバーレンダリングは式の境界に <!-- --> を挿入するため、比較前に取り除く。
    const html = readFileSync(htmlPath, "utf8").replace(/<!--[^]*?-->/g, "");
    check(
      `${routePath} のプリレンダリング済みHTMLは未選択の状態になっている`,
      html.includes("現在0件選択中"),
      "「現在0件選択中」が見つからない（クエリの内容が焼き付いている可能性）",
    );
    check(
      `${routePath} のプリレンダリング済みHTMLに比較結果が含まれていない`,
      !html.includes("比較結果"),
      "未選択なのに比較結果が描画されている",
    );
  }
} else {
  console.log("[test-hydration-safety] dist/ が無いため、プリレンダリング済みHTMLの検査は省略しました。");
}

if (failures.length > 0) {
  console.error(`[test-hydration-safety] ${failures.length} 件の不合格:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`[test-hydration-safety] ${checks} check(s) passed.`);
