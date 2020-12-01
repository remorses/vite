'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.createDepAssetPlugin = exports.createDepAssetExternalPlugin = void 0
const es_module_lexer_1 = require('es-module-lexer')
const cssUtils_1 = require('../utils/cssUtils')
const magic_string_1 = __importDefault(require('magic-string'))
const utils_1 = require('../utils')
const path_1 = __importDefault(require('path'))
const createDepAssetExternalPlugin = (resolver) => ({
  name: 'vite:optimize-dep-assets-external',
  resolveId(id) {
    if (cssUtils_1.isCSSRequest(id) || resolver.isAssetRequest(id)) {
      return {
        id,
        external: true
      }
    }
  }
})
exports.createDepAssetExternalPlugin = createDepAssetExternalPlugin
const createDepAssetPlugin = (resolver, root) => {
  return {
    name: 'vite:optimize-dep-assets',
    async transform(code, id) {
      if (id.endsWith('.js')) {
        await es_module_lexer_1.init
        const [imports] = es_module_lexer_1.parse(code)
        if (imports.length) {
          let s
          for (let i = 0; i < imports.length; i++) {
            const {
              s: start,
              e: end,
              d: dynamicIndex,
              ss: statementStart,
              se: statementEnd
            } = imports[i]
            if (dynamicIndex === -1) {
              const importee = code.slice(start, end)
              if (
                cssUtils_1.isCSSRequest(importee) ||
                resolver.isAssetRequest(importee)
              ) {
                // replace css/asset imports to deep imports to their original
                // location
                s = s || new magic_string_1.default(code)
                // #903 rollup-plugin-commonjs will inject proxy helper, it is unnecessary for assets
                if (importee.endsWith('?commonjs-proxy')) {
                  s.remove(statementStart, statementEnd)
                  continue
                }
                const deepPath = utils_1.cleanUrl(
                  resolver.fileToRequest(
                    utils_1.bareImportRE.test(importee)
                      ? utils_1.resolveFrom(root, importee)
                      : path_1.default.resolve(
                          path_1.default.dirname(id),
                          importee
                        )
                  )
                )
                s.overwrite(start, end, deepPath)
              }
            } else {
              // ignore dynamic import
            }
          }
          if (s) {
            return s.toString()
          }
        }
      }
      return null
    }
  }
}
exports.createDepAssetPlugin = createDepAssetPlugin
//# sourceMappingURL=pluginAssets.js.map
