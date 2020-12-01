'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.createBuildManifestPlugin = void 0
const createBuildManifestPlugin = () => {
  const manifest = {}
  return {
    name: 'vite:manifest',
    generateBundle(_options, bundle) {
      for (const name in bundle) {
        const chunk = bundle[name]
        if (chunk.type === 'chunk') {
          manifest[chunk.name + '.js'] = chunk.fileName
        } else {
          manifest[chunk.name] = chunk.fileName
        }
      }
      this.emitFile({
        fileName: 'manifest.json',
        type: 'asset',
        source: JSON.stringify(manifest, null, 2)
      })
    }
  }
}
exports.createBuildManifestPlugin = createBuildManifestPlugin
//# sourceMappingURL=buildPluginManifest.js.map
