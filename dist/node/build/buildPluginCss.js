'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.createBuildCssPlugin = void 0
const path_1 = __importDefault(require('path'))
const buildPluginAsset_1 = require('./buildPluginAsset')
const cssUtils_1 = require('../utils/cssUtils')
const chalk_1 = __importDefault(require('chalk'))
const pluginutils_1 = require('@rollup/pluginutils')
const slash_1 = __importDefault(require('slash'))
const debug = require('debug')('vite:build:css')
const cssInjectionMarker = `__VITE_CSS__`
const cssInjectionRE = /__VITE_CSS__\(\);?/g
const createBuildCssPlugin = ({
  root,
  publicBase,
  assetsDir,
  minify = false,
  inlineLimit = 0,
  cssCodeSplit = true,
  preprocessOptions,
  modulesOptions = {}
}) => {
  const styles = new Map()
  let staticCss = ''
  const emptyChunks = new Set()
  return {
    name: 'vite:css',
    async transform(css, id) {
      if (cssUtils_1.isCSSRequest(id)) {
        // if this is a Vue SFC style request, it's already processed by
        // rollup-plugin-vue and we just need to rewrite URLs + collect it
        const isVueStyle = /\?vue&type=style/.test(id)
        const preprocessLang = (id.match(cssUtils_1.cssPreprocessLangRE) ||
          [])[1]
        const result = isVueStyle
          ? css
          : await cssUtils_1.compileCss(
              root,
              id,
              {
                id: '',
                source: css,
                filename: id,
                scoped: false,
                modules: cssUtils_1.cssModuleRE.test(id),
                preprocessLang,
                preprocessOptions,
                modulesOptions
              },
              true
            )
        let modules
        if (typeof result === 'string') {
          css = result
        } else {
          if (result.errors.length) {
            console.error(`[vite] error applying css transforms: `)
            result.errors.forEach(console.error)
          }
          css = result.code
          modules = result.modules
        }
        // process url() - register referenced files as assets
        // and rewrite the url to the resolved public path
        if (cssUtils_1.urlRE.test(css)) {
          const fileDir = path_1.default.dirname(id)
          css = await cssUtils_1.rewriteCssUrls(css, async (rawUrl) => {
            const file = path_1.default.posix.isAbsolute(rawUrl)
              ? path_1.default.join(root, rawUrl)
              : path_1.default.join(fileDir, rawUrl)
            let {
              fileName,
              content,
              url
            } = await buildPluginAsset_1.resolveAsset(
              file,
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
            debug(
              `url(${rawUrl}) -> ${
                url.startsWith('data:') ? `base64 inlined` : `${file}`
              }`
            )
            return url
          })
        }
        styles.set(id, css)
        return {
          code: modules
            ? pluginutils_1.dataToEsm(modules, { namedExports: true })
            : (cssCodeSplit
                ? // If code-splitting CSS, inject a fake marker to avoid the module
                  // from being tree-shaken. This preserves the .css file as a
                  // module in the chunk's metadata so that we can retrieve them in
                  // renderChunk.
                  `${cssInjectionMarker}()\n`
                : ``) + `export default ${JSON.stringify(css)}`,
          map: null,
          // #795 css always has side effect
          moduleSideEffects: true
        }
      }
    },
    async renderChunk(code, chunk) {
      let chunkCSS = ''
      for (const id in chunk.modules) {
        if (styles.has(id)) {
          chunkCSS += styles.get(id)
        }
      }
      let match
      while ((match = buildPluginAsset_1.injectAssetRe.exec(chunkCSS))) {
        const outputFilepath =
          publicBase +
          slash_1.default(
            path_1.default.join(assetsDir, this.getFileName(match[1]))
          )
        chunkCSS = chunkCSS.replace(match[0], outputFilepath)
      }
      if (cssCodeSplit) {
        code = code.replace(cssInjectionRE, '')
        if (!code.trim()) {
          // this is a shared CSS-only chunk that is empty.
          emptyChunks.add(chunk.fileName)
        }
        // for each dynamic entry chunk, collect its css and inline it as JS
        // strings.
        if (chunk.isDynamicEntry && chunkCSS) {
          chunkCSS = minifyCSS(chunkCSS)
          code =
            `let ${cssInjectionMarker} = document.createElement('style');` +
            `${cssInjectionMarker}.innerHTML = ${JSON.stringify(chunkCSS)};` +
            `document.head.appendChild(${cssInjectionMarker});` +
            code
        } else {
          staticCss += chunkCSS
        }
        return {
          code,
          map: null
        }
      } else {
        staticCss += chunkCSS
        return null
      }
    },
    async generateBundle(_options, bundle) {
      // minify css
      if (minify && staticCss) {
        staticCss = minifyCSS(staticCss)
      }
      // remove empty css chunks and their imports
      if (emptyChunks.size) {
        emptyChunks.forEach((fileName) => {
          delete bundle[fileName]
        })
        const emptyChunkFiles = [...emptyChunks].join('|').replace(/\./g, '\\.')
        const emptyChunkRE = new RegExp(
          `\\bimport\\s*"[^"]*(?:${emptyChunkFiles})";\n?`,
          'g'
        )
        for (const file in bundle) {
          const chunk = bundle[file]
          if (chunk.type === 'chunk') {
            chunk.code = chunk.code.replace(emptyChunkRE, '')
          }
        }
      }
      if (staticCss) {
        this.emitFile({
          name: 'style.css',
          type: 'asset',
          source: staticCss
        })
      }
    }
  }
}
exports.createBuildCssPlugin = createBuildCssPlugin
let CleanCSS
function minifyCSS(css) {
  CleanCSS = CleanCSS || require('clean-css')
  const res = new CleanCSS({ level: 2, rebase: false }).minify(css)
  if (res.errors && res.errors.length) {
    console.error(chalk_1.default.red(`[vite] error when minifying css:`))
    console.error(res.errors)
  }
  if (res.warnings && res.warnings.length) {
    console.error(chalk_1.default.yellow(`[vite] warnings when minifying css:`))
    console.error(res.warnings)
  }
  return res.styles
}
//# sourceMappingURL=buildPluginCss.js.map
