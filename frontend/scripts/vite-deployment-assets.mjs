import { posix } from 'node:path'

const MODULE_IMPORTS = new Set([
  'ImportDeclaration', 'ImportExpression', 'ExportNamedDeclaration', 'ExportAllDeclaration',
])

function moduleSpecifiers(node, found) {
  if (!node || typeof node !== 'object') return
  if (MODULE_IMPORTS.has(node.type) && typeof node.source?.value === 'string') {
    found.push(node.source)
  }
  for (const child of Object.values(node)) moduleSpecifiers(child, found)
}

export function deploymentAssets(deploymentId) {
  const query = new URLSearchParams({ dpl: deploymentId }).toString()

  return {
    name: 'entomate-vercel-deployment-assets',
    apply: 'build',
    config() {
      return {
        experimental: {
          renderBuiltUrl(file, { type }) {
            if (type !== 'asset') return
            // Vite 6 identifies lazy stylesheets by checking the end of the preload URL.
            return `/${file}?${query}${file.endsWith('.css') ? '&type=.css' : ''}`
          },
        },
      }
    },
    augmentChunkHash() {
      return deploymentId
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk') continue
          // renderBuiltUrl handles preloads and asset links. The module imports
          // themselves must match their preload URL after Rollup assigns filenames.
          const imports = []
          moduleSpecifiers(this.parse(chunk.code), imports)
          const directory = posix.dirname(chunk.fileName)
          for (const { start, end, value } of imports.sort((a, b) => b.start - a.start)) {
            if (!value.startsWith('.') || bundle[posix.join(directory, value)]?.type !== 'chunk') continue
            chunk.code = chunk.code.slice(0, start) + JSON.stringify(`${value}?${query}`) + chunk.code.slice(end)
          }
        }
      },
    },
  }
}
