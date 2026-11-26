// @vitest-environment node
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { build } from 'vite'
import { expect, test } from 'vitest'
import { deploymentAssets } from '../../scripts/vite-deployment-assets.mjs'

test('a Vercel build pins entry assets, lazy imports, shared imports and lazy CSS', async () => {
  const root = await mkdtemp(join(tmpdir(), 'entomate-deploy-assets-'))
  const fixture = {
    'index.html': '<script type="module" src="/main.js"></script>',
    'main.js': 'window.openTasks = () => import("./tasks.js")',
    'tasks.js': 'import "./tasks.css"; export { task } from "./shared.js"',
    'shared.js': 'export const task = "Keep recording"',
    'tasks.css': 'body { color: red }',
  }

  try {
    await Promise.all(Object.entries(fixture).map(([file, content]) => writeFile(join(root, file), content)))
    const { output } = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [deploymentAssets('dpl_before_release')],
      build: {
        write: false,
        minify: false,
        rollupOptions: { output: { manualChunks: { shared: [join(root, 'shared.js')] } } },
      },
    })
    const html = output.find(file => file.fileName === 'index.html')
    const entry = output.find(file => file.type === 'chunk' && file.isEntry)
    const tasks = output.find(file => file.type === 'chunk' && file.isDynamicEntry)
    const shared = output.find(file => file.type === 'chunk' && file.name === 'shared')
    const css = output.find(file => file.fileName.endsWith('.css'))

    expect(html.source).toContain(`/${entry.fileName}?dpl=dpl_before_release`)
    expect(entry.code).toContain(`import("./${basename(tasks.fileName)}?dpl=dpl_before_release")`)
    expect(entry.code).toContain(`/${tasks.fileName}?dpl=dpl_before_release`)
    expect(tasks.code).toContain(`"./${basename(shared.fileName)}?dpl=dpl_before_release"`)
    expect(entry.code).toContain(`/${css.fileName}?dpl=dpl_before_release&type=.css`)
  } finally {
    await Promise.all(Object.keys(fixture).map(file => unlink(join(root, file)).catch(() => {})))
    await rmdir(root)
  }
})
