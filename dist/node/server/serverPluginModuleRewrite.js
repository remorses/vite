'use strict'
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        Object.defineProperty(o, k2, {
          enumerable: true,
          get: function () {
            return m[k]
          }
        })
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v })
      }
    : function (o, v) {
        o['default'] = v
      })
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod
    var result = {}
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k)
    __setModuleDefault(result, mod)
    return result
  }
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.transformCjsImport = exports.resolveImport = exports.rewriteImports = exports.moduleRewritePlugin = void 0
const path_1 = __importDefault(require('path'))
const fs = __importStar(require('fs-extra'))
const lru_cache_1 = __importDefault(require('lru-cache'))
const magic_string_1 = __importDefault(require('magic-string'))
const es_module_lexer_1 = require('es-module-lexer')
const pluginutils_1 = require('@rollup/pluginutils')
const resolver_1 = require('../resolver')
const serverPluginHmr_1 = require('./serverPluginHmr')
const serverPluginClient_1 = require('./serverPluginClient')
const utils_1 = require('../utils')
const chalk_1 = __importDefault(require('chalk'))
const cssUtils_1 = require('../utils/cssUtils')
const serverPluginEnv_1 = require('./serverPluginEnv')
const optimizer_1 = require('../optimizer')
const babelParse_1 = require('../utils/babelParse')
const slash_1 = __importDefault(require('slash'))
const debug = require('debug')('vite:rewrite')
const rewriteCache = new lru_cache_1.default({ max: 1024 })
// Plugin for rewriting served js.
// - Rewrites named module imports to `/@modules/:id` requests, e.g.
//   "vue" => "/@modules/vue"
// - Rewrites files containing HMR code (reference to `import.meta.hot`) to
//   inject `import.meta.hot` and track HMR boundary accept whitelists.
// - Also tracks importer/importee relationship graph during the rewrite.
//   The graph is used by the HMR plugin to perform analysis on file change.
const moduleRewritePlugin = ({ root, app, watcher, resolver }) => {
  app.use(async (ctx, next) => {
    await next()
    if (ctx.status === 304) {
      return
    }
    // we are doing the js rewrite after all other middlewares have finished;
    // this allows us to post-process javascript produced by user middlewares
    // regardless of the extension of the original files.
    const publicPath = ctx.path
    if (
      ctx.body &&
      ctx.response.is('js') &&
      !cssUtils_1.isCSSRequest(ctx.path) &&
      !ctx.path.endsWith('.map') &&
      !resolver.isPublicRequest(ctx.url) &&
      // skip internal client
      publicPath !== serverPluginClient_1.clientPublicPath &&
      // need to rewrite for <script>\<template> part in vue files
      !((ctx.path.endsWith('.vue') || ctx.vue) && ctx.query.type === 'style')
    ) {
      const content = await utils_1.readBody(ctx.body)
      const cacheKey = publicPath + content
      const isHmrRequest = !!ctx.query.t
      if (!isHmrRequest && rewriteCache.has(cacheKey)) {
        debug(`(cached) ${ctx.url}`)
        ctx.body = rewriteCache.get(cacheKey)
      } else {
        await es_module_lexer_1.init
        // dynamic import may contain extension-less path,
        // (.e.g import(runtimePathString))
        // so we need to normalize importer to ensure it contains extension
        // before we perform hmr analysis.
        // on the other hand, static import is guaranteed to have extension
        // because they must all have gone through module rewrite.
        const importer = utils_1.removeUnRelatedHmrQuery(
          resolver.normalizePublicPath(ctx.url)
        )
        ctx.body = rewriteImports(
          root,
          content,
          importer,
          resolver,
          ctx.query.t
        )
        if (!isHmrRequest) {
          rewriteCache.set(cacheKey, ctx.body)
        }
      }
    } else {
      debug(`(skipped) ${ctx.url}`)
    }
  })
  // bust module rewrite cache on file change
  watcher.on('change', async (filePath) => {
    const publicPath = resolver.fileToRequest(filePath)
    // #662 use fs.read instead of cacheRead, avoid cache hit when request file
    // and caused pass `notModified` into transform is always true
    const cacheKey = publicPath + (await fs.readFile(filePath)).toString()
    debug(`${publicPath}: cache busted`)
    rewriteCache.del(cacheKey)
  })
}
exports.moduleRewritePlugin = moduleRewritePlugin
function rewriteImports(root, source, importer, resolver, timestamp) {
  // #806 strip UTF-8 BOM
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1)
  }
  try {
    let imports = []
    try {
      imports = es_module_lexer_1.parse(source)[0]
    } catch (e) {
      console.error(
        chalk_1.default.yellow(
          `[vite] failed to parse ${chalk_1.default.cyan(
            importer
          )} for import rewrite.\nIf you are using ` +
            `JSX, make sure to named the file with the .jsx extension.`
        )
      )
    }
    const hasHMR = source.includes('import.meta.hot')
    const hasEnv = source.includes('import.meta.env')
    if (imports.length || hasHMR || hasEnv) {
      debug(`${importer}: rewriting`)
      const s = new magic_string_1.default(source)
      let hasReplaced = false
      const prevImportees = serverPluginHmr_1.importeeMap.get(importer)
      const currentImportees = new Set()
      serverPluginHmr_1.importeeMap.set(importer, currentImportees)
      for (let i = 0; i < imports.length; i++) {
        const {
          s: start,
          e: end,
          d: dynamicIndex,
          ss: expStart,
          se: expEnd
        } = imports[i]
        let id = source.substring(start, end)
        const hasViteIgnore = /\/\*\s*@vite-ignore\s*\*\//.test(id)
        let hasLiteralDynamicId = false
        if (dynamicIndex >= 0) {
          // #998 remove comment
          id = id.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '')
          const literalIdMatch = id.match(/^\s*(?:'([^']+)'|"([^"]+)")\s*$/)
          if (literalIdMatch) {
            hasLiteralDynamicId = true
            id = literalIdMatch[1] || literalIdMatch[2]
          }
        }
        if (dynamicIndex === -1 || hasLiteralDynamicId) {
          // do not rewrite external imports
          if (utils_1.isExternalUrl(id)) {
            continue
          }
          const resolved = exports.resolveImport(
            root,
            importer,
            id,
            resolver,
            timestamp
          )
          if (resolved.startsWith('.')) {
            console.error(
              Error(`import '${id}' in '${importer}' has not been resolved`)
            )
          }
          if (resolved !== id) {
            debug(`    "${id}" --> "${resolved}"`)
            if (isOptimizedCjs(root, resolver.requestToFile(importer), id)) {
              if (dynamicIndex === -1) {
                const exp = source.substring(expStart, expEnd)
                const replacement = transformCjsImport(exp, id, resolved, i)
                s.overwrite(expStart, expEnd, replacement)
              } else if (hasLiteralDynamicId) {
                // rewrite `import('package')`
                s.overwrite(
                  dynamicIndex,
                  end + 1,
                  `import('${resolved}').then(m=>m.default)`
                )
              }
            } else {
              s.overwrite(
                start,
                end,
                hasLiteralDynamicId ? `'${resolved}'` : resolved
              )
            }
            hasReplaced = true
          }
          // save the import chain for hmr analysis
          const importee = utils_1.removeUnRelatedHmrQuery(resolved)
          if (
            importee !== importer &&
            // no need to track hmr client or module dependencies
            importee !== serverPluginClient_1.clientPublicPath
          ) {
            currentImportees.add(importee)
            serverPluginHmr_1.debugHmr(
              `        ${importer} imports ${importee}`
            )
            serverPluginHmr_1
              .ensureMapEntry(serverPluginHmr_1.importerMap, importee)
              .add(importer)
          }
        } else if (id !== 'import.meta' && !hasViteIgnore) {
          console.warn(
            chalk_1.default.yellow(
              `[vite] ignored dynamic import(${id}) in ${importer}.`
            )
          )
        }
      }
      if (hasHMR) {
        serverPluginHmr_1.debugHmr(`rewriting ${importer} for HMR.`)
        serverPluginHmr_1.rewriteFileWithHMR(
          root,
          source,
          importer,
          resolver,
          s
        )
        hasReplaced = true
      }
      if (hasEnv) {
        debug(`    injecting import.meta.env for ${importer}`)
        s.prepend(
          `import __VITE_ENV__ from "${serverPluginEnv_1.envPublicPath}"; ` +
            `import.meta.env = __VITE_ENV__; `
        )
        hasReplaced = true
      }
      // since the importees may have changed due to edits,
      // check if we need to remove this importer from certain importees
      if (prevImportees) {
        prevImportees.forEach((importee) => {
          if (!currentImportees.has(importee)) {
            const importers = serverPluginHmr_1.importerMap.get(importee)
            if (importers) {
              importers.delete(importer)
            }
          }
        })
      }
      if (!hasReplaced) {
        debug(`    nothing needs rewriting.`)
      }
      return hasReplaced ? s.toString() : source
    } else {
      debug(`${importer}: no imports found.`)
    }
    return source
  } catch (e) {
    console.error(
      `[vite] Error: module imports rewrite failed for ${importer}.\n`,
      e
    )
    debug(source)
    return source
  }
}
exports.rewriteImports = rewriteImports
const resolveImport = (root, importer, id, resolver, timestamp) => {
  id = resolver.alias(id) || id
  if (utils_1.bareImportRE.test(id)) {
    // directly resolve bare module names to its entry path so that relative
    // imports from it (including source map urls) can work correctly
    id = `/@modules/${resolver_1.resolveBareModuleRequest(
      root,
      id,
      importer,
      resolver
    )}`
  } else {
    // 1. relative to absolute
    //    ./foo -> /some/path/foo
    id = resolver.resolveRelativeRequest(importer, id)
    // 2. resolve dir index and extensions.
    id = resolver.normalizePublicPath(id)
    // 3. mark non-src imports
    if (
      path_1.default.extname(utils_1.cleanUrl(id)) &&
      !resolver_1.jsSrcRE.test(utils_1.cleanUrl(id))
    ) {
      id += !id.match(utils_1.queryRE) ? `?import` : '&import'
    }
  }
  // 4. force re-fetch dirty imports by appending timestamp
  if (timestamp) {
    const dirtyFiles = serverPluginHmr_1.hmrDirtyFilesMap.get(timestamp)
    const cleanId = utils_1.cleanUrl(id)
    // only rewrite if:
    if (dirtyFiles && dirtyFiles.has(cleanId)) {
      // 1. this is a marked dirty file (in the import chain of the changed file)
      id += `${id.includes(`?`) ? `&` : `?`}t=${timestamp}`
    } else if (serverPluginHmr_1.latestVersionsMap.has(cleanId)) {
      // 2. this file was previously hot-updated and has an updated version
      id += `${
        id.includes(`?`) ? `&` : `?`
      }t=${serverPluginHmr_1.latestVersionsMap.get(cleanId)}`
    }
  }
  return id
}
exports.resolveImport = resolveImport
const analysisCache = new Map()
/**
 * read analysis result from optimize step
 * If we can't find analysis result, return null
 * (maybe because user set optimizeDeps.auto to false)
 */
function getAnalysis(root) {
  if (analysisCache.has(root)) return analysisCache.get(root)
  let analysis
  try {
    const cacheDir = optimizer_1.resolveOptimizedCacheDir(root)
    analysis = fs.readJsonSync(path_1.default.join(cacheDir, '_analysis.json'))
  } catch (error) {
    analysis = null
  }
  if (analysis && !utils_1.isPlainObject(analysis.isCommonjs)) {
    throw new Error(`[vite] invalid _analysis.json`)
  }
  analysisCache.set(root, analysis)
  return analysis
}
function isOptimizedCjs(root, importer, id) {
  const analysis = getAnalysis(root)
  if (!analysis) return false
  const modulePath = resolver_1.resolveNodeModuleFile(importer, id)
  if (!modulePath) {
    return false
  }
  return !!analysis.isCommonjs[
    slash_1.default(path_1.default.relative(root, modulePath))
  ]
}
function transformCjsImport(exp, id, resolvedPath, importIndex) {
  const ast = babelParse_1.parse(exp)[0]
  const importNames = []
  ast.specifiers.forEach((obj) => {
    if (obj.type === 'ImportSpecifier' && obj.imported.type === 'Identifier') {
      const importedName = obj.imported.name
      const localName = obj.local.name
      importNames.push({ importedName, localName })
    } else if (obj.type === 'ImportDefaultSpecifier') {
      importNames.push({ importedName: 'default', localName: obj.local.name })
    } else if (obj.type === 'ImportNamespaceSpecifier') {
      importNames.push({ importedName: '*', localName: obj.local.name })
    }
  })
  return generateCjsImport(importNames, id, resolvedPath, importIndex)
}
exports.transformCjsImport = transformCjsImport
function generateCjsImport(importNames, id, resolvedPath, importIndex) {
  // If there is multiple import for same id in one file,
  // importIndex will prevent the cjsModuleName to be duplicate
  const cjsModuleName = pluginutils_1.makeLegalIdentifier(
    `$viteCjsImport${importIndex}_${id}`
  )
  const lines = [`import ${cjsModuleName} from "${resolvedPath}";`]
  importNames.forEach(({ importedName, localName }) => {
    if (importedName === '*' || importedName === 'default') {
      lines.push(`const ${localName} = ${cjsModuleName};`)
    } else {
      lines.push(`const ${localName} = ${cjsModuleName}["${importedName}"];`)
    }
  })
  return lines.join('\n')
}
//# sourceMappingURL=serverPluginModuleRewrite.js.map
