'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.createBuildWasmPlugin = void 0
const buildPluginAsset_1 = require('./buildPluginAsset')
const wasmHelperId = 'vite/wasm-helper'
const wasmHelper = (opts = {}, url) => {
  let instance
  if (url.startsWith('data:')) {
    // @ts-ignore
    const binaryString = atob(url.replace(/^data:.*?base64,/, ''))
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    // @ts-ignore
    instance = WebAssembly.instantiate(bytes.buffer, opts)
  } else {
    // https://github.com/mdn/webassembly-examples/issues/5
    // WebAssembly.instantiateStreaming requires the server to provide the
    // correct MIME type for .wasm files, which unfortunately doesn't work for
    // a lot of static file servers, so we just work around it by getting the
    // raw buffer.
    // @ts-ignore
    instance = fetch(url)
      // @ts-ignore
      .then((r) => r.arrayBuffer())
      // @ts-ignore
      .then((bytes) => WebAssembly.instantiate(bytes, opts))
  }
  return instance.then((i) => i.instance.exports)
}
const wasmHelperCode = wasmHelper.toString()
const createBuildWasmPlugin = (root, publicBase, assetsDir, inlineLimit) => {
  return {
    name: 'vite:wasm',
    resolveId(id) {
      if (id === wasmHelperId) {
        return id
      }
    },
    async load(id) {
      if (id === wasmHelperId) {
        return `export default ${wasmHelperCode}`
      }
      if (id.endsWith('.wasm')) {
        let { fileName, content, url } = await buildPluginAsset_1.resolveAsset(
          id,
          root,
          publicBase,
          assetsDir,
          inlineLimit
        )
        if (!url && fileName && content) {
          url =
            'import.meta.ROLLUP_FILE_URL_' +
            this.emitFile({
              name: fileName,
              type: 'asset',
              source: content
            })
        }
        return `
import initWasm from "${wasmHelperId}"
export default opts => initWasm(opts, ${JSON.stringify(url)})
`
      }
    }
  }
}
exports.createBuildWasmPlugin = createBuildWasmPlugin
//# sourceMappingURL=buildPluginWasm.js.map
