import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'node:fs'

// 一時的なバンドル解析用の設定（Phase193の調査用・コミット対象外）
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'chunk-analyze',
      generateBundle(_o, bundle) {
        const cwd = process.cwd().replace(/\\/g, '/')
        const out = []
        for (const [file, c] of Object.entries(bundle)) {
          if (c.type !== 'chunk') continue
          const mods = Object.entries(c.modules)
            .map(([id, m]) => ({
              id: id.replace(/\\/g, '/').replace(cwd, ''),
              size: m.renderedLength,
            }))
            .sort((a, b) => b.size - a.size)
          out.push({
            file,
            isEntry: c.isEntry,
            isDynamicEntry: c.isDynamicEntry,
            total: c.code.length,
            imports: c.imports,
            moduleCount: mods.length,
            modules: mods.slice(0, 40),
          })
        }
        out.sort((a, b) => b.total - a.total)
        writeFileSync('chunk-analysis.json', JSON.stringify(out, null, 2))
      },
    },
  ],
})
