/**
 * public/robots.txt を SITE_URL（src/config/site.ts）から生成する。
 * ドメイン移行時にrobots.txtを手動で書き換え忘れることを防ぐ。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./lib/public-routes.mjs";
import { SITE_URL } from "./lib/site-config.mjs";

const body = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

writeFileSync(join(root, "public", "robots.txt"), body, "utf8");
console.log(`[generate-robots] wrote public/robots.txt (Sitemap: ${SITE_URL}/sitemap.xml)`);
