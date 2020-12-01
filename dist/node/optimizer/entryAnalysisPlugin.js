'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.entryAnalysisPlugin = void 0
const path_1 = __importDefault(require('path'))
const slash_1 = __importDefault(require('slash'))
function entryAnalysisPlugin({ root }) {
  const analysis = { isCommonjs: {} }
  return {
    name: 'vite:cjs-entry-named-export',
    async generateBundle(options, bundles) {
      Object.values(bundles).forEach((bundle) => {
        var _a, _b
        if (bundle.type === 'chunk' && bundle.isEntry) {
          if (bundle.facadeModuleId) {
            const facadeInfo = this.getModuleInfo(bundle.facadeModuleId)
            // this info is exposed by rollup commonjs plugin
            if (
              (_b =
                (_a =
                  facadeInfo === null || facadeInfo === void 0
                    ? void 0
                    : facadeInfo.meta) === null || _a === void 0
                  ? void 0
                  : _a.commonjs) === null || _b === void 0
                ? void 0
                : _b.isCommonJS
            ) {
              const relativePath = slash_1.default(
                path_1.default.relative(root, bundle.facadeModuleId)
              )
              analysis.isCommonjs[relativePath] = true
            }
          }
        }
      })
      this.emitFile({
        type: 'asset',
        fileName: '_analysis.json',
        source: JSON.stringify(analysis)
      })
    }
  }
}
exports.entryAnalysisPlugin = entryAnalysisPlugin
//# sourceMappingURL=entryAnalysisPlugin.js.map
