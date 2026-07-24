import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getIndexableRoutes, root } from "./lib/public-routes.mjs";
import { SITE_URL } from "./lib/site-config.mjs";

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const routes = getIndexableRoutes();

const body = routes
  .map((r) => {
    const lastmod = r.lastmod ? `\n    <lastmod>${escapeXml(r.lastmod)}</lastmod>` : "";
    return `  <url>\n    <loc>${escapeXml(`${SITE_URL}${r.path}`)}</loc>${lastmod}\n  </url>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(root, "public", "sitemap.xml"), xml, "utf8");
console.log(`[generate-sitemap] wrote ${routes.length} URLs to public/sitemap.xml`);
