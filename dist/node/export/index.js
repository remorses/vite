'use strict'
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value)
          })
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value))
        } catch (e) {
          reject(e)
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value))
        } catch (e) {
          reject(e)
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected)
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next())
    })
  }
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.readFromUrlOrPath = exports.exportToStatic = void 0
const cheerio_1 = __importDefault(require('cheerio'))
const es_module_traversal_1 = require('es-module-traversal')
const events_1 = require('events')
const fs_extra_1 = __importDefault(require('fs-extra'))
const net_1 = __importDefault(require('net'))
const node_fetch_1 = __importDefault(require('node-fetch'))
const path_1 = __importDefault(require('path'))
const url_1 = require('url')
const server_1 = require('../server')
const host = '127.0.0.1'
function exportToStatic(options) {
  return __awaiter(this, void 0, void 0, function* () {
    const { root = process.cwd(), exportOutDir = 'static' } = options
    const port = yield getAvailablePort()
    const server = yield server_1.createServer(options)
    server.listen(port, host)
    yield events_1.once(server, 'listening')
    const baseUrl = `http://${host}:${port}`
    yield fs_extra_1.default.remove(exportOutDir)
    const indexHtml = yield readFromUrlOrPath(
      new url_1.URL('index.html', baseUrl).toString()
    )
    const entryPoints = getEntryPoints(indexHtml)
    yield es_module_traversal_1.traverseEsModules({
      entryPoints: entryPoints.map((entry) =>
        new url_1.URL(entry, baseUrl).toString()
      ),
      readFile: readFromUrlOrPath,
      resolver: es_module_traversal_1.urlResolver({ root, baseUrl }),
      onFile: (url) =>
        __awaiter(this, void 0, void 0, function* () {
          let pathname = url.startsWith('http')
            ? urlToRelativePath(url)
            : path_1.default.relative(root, url)
          pathname = path_1.default.join(exportOutDir, pathname)
          const content = yield readFromUrlOrPath(url)
          yield fs_extra_1.default.createFile(pathname)
          yield fs_extra_1.default.writeFile(pathname, content)
        })
    })
    yield fs_extra_1.default.writeFile(
      path_1.default.join(exportOutDir, 'index.html'),
      indexHtml
    )
    server.close()
    yield events_1.once(server, 'close')
  })
}
exports.exportToStatic = exportToStatic
function readFromUrlOrPath(url) {
  return __awaiter(this, void 0, void 0, function* () {
    let content = ''
    if (!url.startsWith('http')) {
      content = yield es_module_traversal_1.defaultReadFile(url)
    } else {
      const res = yield node_fetch_1.default(url, {})
      if (!res.ok) {
        throw new Error(
          `Cannot fetch '${url}': ${res.statusText} ${yield res
            .text()
            .catch(() => '')}`
        )
      }
      content = yield res.text()
    }
    return content
  })
}
exports.readFromUrlOrPath = readFromUrlOrPath
function getAvailablePort(startingAt = 3000) {
  function getNextAvailablePort(currentPort, cb) {
    const server = net_1.default.createServer()
    server.listen(currentPort, () => {
      server.once('close', () => {
        cb(currentPort)
      })
      server.close()
    })
    server.on('error', (_) => {
      getNextAvailablePort(++currentPort, cb)
    })
  }
  return new Promise((resolve) => {
    getNextAvailablePort(startingAt, resolve)
  })
}
function getEntryPoints(htmlCode) {
  const $ = cheerio_1.default.load(htmlCode, { xmlMode: false })
  const sources = $('script[type=module]')
    .filter(
      (_, element) =>
        Boolean(element.attribs.src) && isRelative(element.attribs.src)
    )
    .map((_, element) => element.attribs.src)
    .get()
  return sources.map(path_1.default.posix.normalize)
}
function isRelative(path) {
  return path.startsWith('.') || path.startsWith('/')
}
function urlToRelativePath(url) {
  let pathname = new url_1.URL(url).pathname
  pathname = pathname.startsWith('/') ? pathname.slice(1) : pathname
  return pathname
}
//# sourceMappingURL=index.js.map
