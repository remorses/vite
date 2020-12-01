'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.appendQuery = exports.mapQuery = exports.removeUnRelatedHmrQuery = exports.parseNodeModuleId = exports.isImportRequest = exports.isStaticAsset = exports.isDataUrl = exports.isExternalUrl = exports.bareImportRE = exports.parseWithQuery = exports.cleanUrl = exports.hashRE = exports.queryRE = exports.osAgnosticPath = exports.resolveFrom = void 0
const slash_1 = __importDefault(require('slash'))
const path_1 = __importDefault(require('path'))
const querystring_1 = __importDefault(require('querystring'))
const resolve_1 = __importDefault(require('resolve'))
const resolver_1 = require('../resolver')
let isRunningWithYarnPnp = false
try {
  isRunningWithYarnPnp = Boolean(require('pnpapi'))
} catch {}
function resolveFrom(root, id) {
  return resolve_1.default.sync(id, {
    basedir: root,
    extensions: resolver_1.supportedExts,
    // necessary to work with pnpm
    preserveSymlinks: isRunningWithYarnPnp || false
  })
}
exports.resolveFrom = resolveFrom
function osAgnosticPath(absPath) {
  if (!absPath) {
    return absPath
  }
  if (!path_1.default.isAbsolute(absPath)) {
    absPath = path_1.default.resolve(absPath)
  }
  return slash_1.default(path_1.default.relative(process.cwd(), absPath))
}
exports.osAgnosticPath = osAgnosticPath
exports.queryRE = /\?.*$/
exports.hashRE = /#.*$/
const cleanUrl = (url) =>
  url.replace(exports.hashRE, '').replace(exports.queryRE, '')
exports.cleanUrl = cleanUrl
const parseWithQuery = (id) => {
  const queryMatch = id.match(exports.queryRE)
  if (queryMatch) {
    return {
      path: slash_1.default(exports.cleanUrl(id)),
      query: querystring_1.default.parse(queryMatch[0].slice(1))
    }
  }
  return {
    path: exports.cleanUrl(id),
    query: {}
  }
}
exports.parseWithQuery = parseWithQuery
exports.bareImportRE = /^[^\/\.]/
const externalRE = /^(https?:)?\/\//
const isExternalUrl = (url) => externalRE.test(url)
exports.isExternalUrl = isExternalUrl
const dataUrlRE = /^\s*data:/i
const isDataUrl = (url) => dataUrlRE.test(url)
exports.isDataUrl = isDataUrl
const imageRE = /\.(png|jpe?g|gif|svg|ico|webp)(\?.*)?$/
const mediaRE = /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/
const fontsRE = /\.(woff2?|eot|ttf|otf)(\?.*)?$/i
/**
 * Check if a file is a static asset that vite can process.
 */
const isStaticAsset = (file) => {
  const cleaned = exports.cleanUrl(file)
  return [imageRE, mediaRE, fontsRE].some((re) => {
    return re.test(file) || re.test(cleaned)
  })
}
exports.isStaticAsset = isStaticAsset
/**
 * Check if a request is an import from js instead of a native resource request
 * i.e. differentiate
 * `import('/style.css')`
 * from
 * `<link rel="stylesheet" href="/style.css">`
 *
 * The ?import query is injected by serverPluginModuleRewrite.
 */
const isImportRequest = (ctx) => {
  return ctx.query.import != null
}
exports.isImportRequest = isImportRequest
function parseNodeModuleId(id) {
  const parts = id.split('/')
  let scope = '',
    name = '',
    inPkgPath = ''
  if (id.startsWith('@')) scope = parts.shift()
  name = parts.shift()
  inPkgPath = parts.join('/')
  return {
    scope,
    name,
    inPkgPath
  }
}
exports.parseNodeModuleId = parseNodeModuleId
function removeUnRelatedHmrQuery(url) {
  const { path, query } = exports.parseWithQuery(url)
  delete query.t
  delete query.import
  if (Object.keys(query).length) {
    return path + '?' + querystring_1.default.stringify(query)
  }
  return path
}
exports.removeUnRelatedHmrQuery = removeUnRelatedHmrQuery
function mapQuery(url, mapper) {
  const { path, query } = exports.parseWithQuery(url)
  const newQuery = mapper(query)
  if (Object.keys(newQuery).length) {
    return path + '?' + querystring_1.default.encode(newQuery)
  }
  return path
}
exports.mapQuery = mapQuery
function appendQuery(url, query) {
  if (!query) {
    return url
  }
  if (query.startsWith('?')) {
    query = query.slice(1)
  }
  if (url.includes('?')) {
    return url + '&' + query
  }
  return url + '?' + query
}
exports.appendQuery = appendQuery
//# sourceMappingURL=pathUtils.js.map
