'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.watchFileIfOutOfRoot = exports.lookupFile = exports.readBody = exports.cachedRead = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const chalk_1 = __importDefault(require('chalk'))
const lru_cache_1 = __importDefault(require('lru-cache'))
const stream_1 = require('stream')
const serverPluginServeStatic_1 = require('../server/serverPluginServeStatic')
const mime_types_1 = __importDefault(require('mime-types'))
const pathUtils_1 = require('./pathUtils')
const getETag = require('etag')
const fsReadCache = new lru_cache_1.default({
  max: 10000
})
/**
 * Read a file with in-memory cache.
 * Also sets appropriate headers and body on the Koa context.
 * This is exposed on middleware context as `ctx.read` with the `ctx` already
 * bound, so it can be used as `ctx.read(file)`.
 */
async function cachedRead(ctx, file) {
  file = pathUtils_1.cleanUrl(file)
  const lastModified = fs_extra_1.default.statSync(file).mtimeMs
  const cached = fsReadCache.get(file)
  if (ctx) {
    ctx.set('Cache-Control', 'no-cache')
    ctx.type =
      mime_types_1.default.lookup(path_1.default.extname(file)) ||
      'application/octet-stream'
  }
  if (cached && cached.lastModified === lastModified) {
    if (ctx) {
      // a private marker in case the user ticks "disable cache" during dev
      ctx.__notModified = true
      ctx.etag = cached.etag
      ctx.lastModified = new Date(cached.lastModified)
      if (
        ctx.get('If-None-Match') === ctx.etag &&
        serverPluginServeStatic_1.seenUrls.has(ctx.url)
      ) {
        ctx.status = 304
      }
      serverPluginServeStatic_1.seenUrls.add(ctx.url)
      ctx.body = cached.content
    }
    return cached.content
  }
  // #395 some file is an binary file, eg. font
  let content = await fs_extra_1.default.readFile(file)
  // Populate the "sourcesContent" array and resolve relative paths in the
  // "sources" array, so the debugger can trace back to the original source.
  if (file.endsWith('.map')) {
    const map = JSON.parse(content.toString('utf8'))
    if (!map.sourcesContent || !map.sources.every(path_1.default.isAbsolute)) {
      const sourcesContent = map.sourcesContent || []
      const sourceRoot = path_1.default.resolve(
        path_1.default.dirname(file),
        map.sourceRoot || ''
      )
      map.sources = await Promise.all(
        map.sources.map(async (source, i) => {
          const originalPath = path_1.default.resolve(sourceRoot, source)
          if (!sourcesContent[i]) {
            try {
              sourcesContent[i] = (
                await cachedRead(null, originalPath)
              ).toString('utf8')
            } catch (err) {
              if (err.code === 'ENOENT') {
                console.error(
                  chalk_1.default.red(
                    `[vite] Sourcemap "${file}" points to non-existent source: "${originalPath}"`
                  )
                )
                return source
              }
              throw err
            }
          }
          return originalPath
        })
      )
      map.sourcesContent = sourcesContent
      content = Buffer.from(JSON.stringify(map))
    }
  }
  const etag = getETag(content)
  fsReadCache.set(file, {
    content,
    etag,
    lastModified
  })
  if (ctx) {
    ctx.etag = etag
    ctx.lastModified = new Date(lastModified)
    ctx.body = content
    ctx.status = 200
    // watch the file if it's out of root.
    const { root, watcher } = ctx
    watchFileIfOutOfRoot(watcher, root, file)
  }
  return content
}
exports.cachedRead = cachedRead
/**
 * Read already set body on a Koa context and normalize it into a string.
 * Useful in post-processing middlewares.
 */
async function readBody(stream) {
  if (stream instanceof stream_1.Readable) {
    return new Promise((resolve, reject) => {
      let res = ''
      stream
        .on('data', (chunk) => (res += chunk))
        .on('error', reject)
        .on('end', () => {
          resolve(res)
        })
    })
  } else {
    return !stream || typeof stream === 'string' ? stream : stream.toString()
  }
}
exports.readBody = readBody
function lookupFile(dir, formats, pathOnly = false) {
  for (const format of formats) {
    const fullPath = path_1.default.join(dir, format)
    if (
      fs_extra_1.default.existsSync(fullPath) &&
      fs_extra_1.default.statSync(fullPath).isFile()
    ) {
      return pathOnly
        ? fullPath
        : fs_extra_1.default.readFileSync(fullPath, 'utf-8')
    }
  }
  const parentDir = path_1.default.dirname(dir)
  if (parentDir !== dir) {
    return lookupFile(parentDir, formats, pathOnly)
  }
}
exports.lookupFile = lookupFile
/**
 * Files under root are watched by default, but with user aliases we can still
 * serve files out of root. Add such files to the watcher (if not node_modules)
 */
function watchFileIfOutOfRoot(watcher, root, file) {
  if (!file.startsWith(root) && !/node_modules/.test(file)) {
    watcher.add(file)
  }
}
exports.watchFileIfOutOfRoot = watchFileIfOutOfRoot
//# sourceMappingURL=fsUtils.js.map
