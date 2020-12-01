'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.createEsbuildRenderChunkPlugin = exports.createEsbuildPlugin = void 0
const fs_extra_1 = __importDefault(require('fs-extra'))
const esbuildService_1 = require('../esbuildService')
const createEsbuildPlugin = async (jsx = 'vue') => {
  const jsxConfig = esbuildService_1.resolveJsxOptions(jsx)
  return {
    name: 'vite:esbuild',
    resolveId(id) {
      if (id === esbuildService_1.vueJsxPublicPath) {
        return esbuildService_1.vueJsxPublicPath
      }
    },
    load(id) {
      if (id === esbuildService_1.vueJsxPublicPath) {
        return fs_extra_1.default.readFileSync(
          esbuildService_1.vueJsxFilePath,
          'utf-8'
        )
      }
    },
    async transform(code, id) {
      const isVueTs = /\.vue\?/.test(id) && id.endsWith('lang.ts')
      if (esbuildService_1.tjsxRE.test(id) || isVueTs) {
        return esbuildService_1.transform(
          code,
          id,
          {
            ...jsxConfig,
            ...(isVueTs ? { loader: 'ts' } : null)
          },
          jsx
        )
      }
    }
  }
}
exports.createEsbuildPlugin = createEsbuildPlugin
const createEsbuildRenderChunkPlugin = (target, minify) => {
  return {
    name: 'vite:esbuild-transpile',
    async renderChunk(code, chunk) {
      return esbuildService_1.transform(code, chunk.fileName, {
        target,
        minify
      })
    }
  }
}
exports.createEsbuildRenderChunkPlugin = createEsbuildRenderChunkPlugin
//# sourceMappingURL=buildPluginEsbuild.js.map
