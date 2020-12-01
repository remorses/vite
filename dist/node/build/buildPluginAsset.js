'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.createBuildAssetPlugin = exports.registerAssets = exports.resolveAsset = exports.injectAssetRe = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const utils_1 = require('../utils')
const slash_1 = __importDefault(require('slash'))
const mime_types_1 = __importDefault(require('mime-types'))
const debug = require('debug')('vite:build:asset')
const assetResolveCache = new Map()
const publicDirRE = /^public(\/|\\)/
exports.injectAssetRe = /import.meta.ROLLUP_FILE_URL_(\w+)/
const resolveAsset = async (id, root, publicBase, assetsDir, inlineLimit) => {
  id = utils_1.cleanUrl(id)
  const cached = assetResolveCache.get(id)
  if (cached) {
    return cached
  }
  let resolved
  const relativePath = path_1.default.relative(root, id)
  if (!fs_extra_1.default.existsSync(id)) {
    // try resolving from public dir
    const publicDirPath = path_1.default.join(root, 'public', relativePath)
    if (fs_extra_1.default.existsSync(publicDirPath)) {
      // file is resolved from public dir, it will be copied verbatim so no
      // need to read content here.
      resolved = {
        url: publicBase + slash_1.default(relativePath)
      }
    }
  }
  if (!resolved) {
    if (publicDirRE.test(relativePath)) {
      resolved = {
        url: publicBase + slash_1.default(relativePath.replace(publicDirRE, ''))
      }
    }
  }
  if (!resolved) {
    let url
    let content = await fs_extra_1.default.readFile(id)
    if (!id.endsWith(`.svg`) && content.length < Number(inlineLimit)) {
      url = `data:${mime_types_1.default.lookup(id)};base64,${content.toString(
        'base64'
      )}`
      content = undefined
    }
    resolved = {
      content,
      fileName: path_1.default.basename(id),
      url
    }
  }
  assetResolveCache.set(id, resolved)
  return resolved
}
exports.resolveAsset = resolveAsset
const registerAssets = (assets, bundle) => {
  for (const [fileName, source] of assets) {
    bundle[fileName] = {
      name: fileName,
      isAsset: true,
      type: 'asset',
      fileName,
      source
    }
  }
}
exports.registerAssets = registerAssets
const createBuildAssetPlugin = (
  root,
  resolver,
  publicBase,
  assetsDir,
  inlineLimit
) => {
  const handleToIdMap = new Map()
  return {
    name: 'vite:asset',
    async load(id) {
      if (resolver.isAssetRequest(id)) {
        let { fileName, content, url } = await exports.resolveAsset(
          id,
          root,
          publicBase,
          assetsDir,
          inlineLimit
        )
        if (!url && fileName && content) {
          const fileHandle = this.emitFile({
            name: fileName,
            type: 'asset',
            source: content
          })
          url = 'import.meta.ROLLUP_FILE_URL_' + fileHandle
          handleToIdMap.set(fileHandle, id)
        } else if (url && url.startsWith(`data:`)) {
          debug(`${id} -> base64 inlined`)
        }
        return `export default ${JSON.stringify(url)}`
      }
    },
    async renderChunk(code) {
      let match
      while ((match = exports.injectAssetRe.exec(code))) {
        const fileHandle = match[1]
        const outputFilepath =
          publicBase +
          slash_1.default(
            path_1.default.join(assetsDir, this.getFileName(fileHandle))
          )
        code = code.replace(match[0], outputFilepath)
        const originalId = handleToIdMap.get(fileHandle)
        if (originalId) {
          debug(`${originalId} -> ${outputFilepath}`)
        }
      }
      return { code, map: null }
    }
  }
}
exports.createBuildAssetPlugin = createBuildAssetPlugin
//# sourceMappingURL=buildPluginAsset.js.map
