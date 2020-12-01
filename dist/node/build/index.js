'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.ssrBuild = exports.build = exports.createBaseRollupPlugins = exports.onRollupWarning = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const chalk_1 = __importDefault(require('chalk'))
const p_map_series_1 = __importDefault(require('p-map-series'))
const json_1 = require('klona/json')
const utils_1 = require('../utils')
const resolver_1 = require('../resolver')
const buildPluginResolve_1 = require('./buildPluginResolve')
const buildPluginHtml_1 = require('./buildPluginHtml')
const buildPluginCss_1 = require('./buildPluginCss')
const buildPluginAsset_1 = require('./buildPluginAsset')
const buildPluginEsbuild_1 = require('./buildPluginEsbuild')
const buildPluginReplace_1 = require('./buildPluginReplace')
const config_1 = require('../config')
const transform_1 = require('../transform')
const hash_sum_1 = __importDefault(require('hash-sum'))
const cssUtils_1 = require('../utils/cssUtils')
const buildPluginWasm_1 = require('./buildPluginWasm')
const buildPluginManifest_1 = require('./buildPluginManifest')
const esbuildService_1 = require('../esbuildService')
const writeColors = {
  [0 /* JS */]: chalk_1.default.cyan,
  [1 /* CSS */]: chalk_1.default.magenta,
  [2 /* ASSET */]: chalk_1.default.green,
  [3 /* HTML */]: chalk_1.default.blue,
  [4 /* SOURCE_MAP */]: chalk_1.default.gray
}
const warningIgnoreList = [`CIRCULAR_DEPENDENCY`, `THIS_IS_UNDEFINED`]
const dynamicImportWarningIgnoreList = [
  `Unsupported expression`,
  `statically analyzed`
]
const isBuiltin = require('isbuiltin')
function onRollupWarning(spinner, options) {
  return (warning, warn) => {
    if (warning.code === 'UNRESOLVED_IMPORT') {
      let message
      const id = warning.source
      const importer = warning.importer
      if (isBuiltin(id)) {
        let importingDep
        if (importer) {
          const pkg = JSON.parse(
            utils_1.lookupFile(importer, ['package.json']) || `{}`
          )
          if (pkg.name) {
            importingDep = pkg.name
          }
        }
        const allowList = options.allowNodeBuiltins
        if (importingDep && allowList && allowList.includes(importingDep)) {
          return
        }
        const dep = importingDep
          ? `Dependency ${chalk_1.default.yellow(importingDep)}`
          : `A dependency`
        message =
          `${dep} is attempting to import Node built-in module ${chalk_1.default.yellow(
            id
          )}.\n` +
          `This will not work in a browser environment.\n` +
          `Imported by: ${chalk_1.default.gray(importer)}`
      } else {
        message =
          `[vite]: Rollup failed to resolve import "${warning.source}" from "${warning.importer}".\n` +
          `This is most likely unintended because it can break your application at runtime.\n` +
          `If you do want to externalize this module explicitly add it to\n` +
          `\`rollupInputOptions.external\``
      }
      if (spinner) {
        spinner.stop()
      }
      throw new Error(message)
    }
    if (
      warning.plugin === 'rollup-plugin-dynamic-import-variables' &&
      dynamicImportWarningIgnoreList.some((msg) =>
        warning.message.includes(msg)
      )
    ) {
      return
    }
    if (!warningIgnoreList.includes(warning.code)) {
      // ora would swallow the console.warn if we let it keep running
      // https://github.com/sindresorhus/ora/issues/90
      if (spinner) {
        spinner.stop()
      }
      warn(warning)
      if (spinner) {
        spinner.start()
      }
    }
  }
}
exports.onRollupWarning = onRollupWarning
/**
 * Creates non-application specific plugins that are shared between the main
 * app and the dependencies. This is used by the `optimize` command to
 * pre-bundle dependencies.
 */
async function createBaseRollupPlugins(root, resolver, options) {
  const {
    transforms = [],
    vueCustomBlockTransforms = {},
    enableEsbuild = true,
    enableRollupPluginVue = true
  } = options
  const { nodeResolve } = require('@rollup/plugin-node-resolve')
  const dynamicImport = require('rollup-plugin-dynamic-import-variables')
  return [
    // vite:resolve
    buildPluginResolve_1.createBuildResolvePlugin(root, resolver),
    // vite:esbuild
    enableEsbuild
      ? await buildPluginEsbuild_1.createEsbuildPlugin(options.jsx)
      : null,
    // vue
    enableRollupPluginVue ? await createVuePlugin(root, options) : null,
    require('@rollup/plugin-json')({
      preferConst: true,
      indent: '  ',
      compact: false,
      namedExports: true
    }),
    // user transforms
    ...(transforms.length || Object.keys(vueCustomBlockTransforms).length
      ? [
          transform_1.createBuildJsTransformPlugin(
            transforms,
            vueCustomBlockTransforms
          )
        ]
      : []),
    nodeResolve({
      rootDir: root,
      extensions: resolver_1.supportedExts,
      preferBuiltins: false,
      dedupe: options.rollupDedupe || [],
      mainFields: resolver_1.mainFields
    }),
    require('@rollup/plugin-commonjs')({
      extensions: ['.js', '.cjs']
    }),
    dynamicImport({
      warnOnError: true,
      include: [/\.js$/],
      exclude: [/node_modules/]
    })
  ].filter(Boolean)
}
exports.createBaseRollupPlugins = createBaseRollupPlugins
async function createVuePlugin(
  root,
  {
    vueCustomBlockTransforms = {},
    rollupPluginVueOptions,
    cssPreprocessOptions,
    cssModuleOptions,
    vueCompilerOptions,
    vueTransformAssetUrls = {},
    vueTemplatePreprocessOptions = {}
  }
) {
  const {
    options: postcssOptions,
    plugins: postcssPlugins
  } = await cssUtils_1.resolvePostcssOptions(root, true)
  if (typeof vueTransformAssetUrls === 'object') {
    vueTransformAssetUrls = {
      includeAbsolute: true,
      ...vueTransformAssetUrls
    }
  }
  return require('rollup-plugin-vue')({
    ...rollupPluginVueOptions,
    templatePreprocessOptions: {
      ...vueTemplatePreprocessOptions,
      pug: {
        doctype: 'html',
        ...(vueTemplatePreprocessOptions && vueTemplatePreprocessOptions.pug)
      }
    },
    transformAssetUrls: vueTransformAssetUrls,
    postcssOptions,
    postcssPlugins,
    preprocessStyles: true,
    preprocessOptions: cssPreprocessOptions,
    preprocessCustomRequire: (id) => require(utils_1.resolveFrom(root, id)),
    compilerOptions: vueCompilerOptions,
    cssModulesOptions: {
      localsConvention: 'camelCase',
      generateScopedName: (local, filename) =>
        `${local}_${hash_sum_1.default(filename)}`,
      ...cssModuleOptions,
      ...(rollupPluginVueOptions && rollupPluginVueOptions.cssModulesOptions)
    },
    customBlocks: Object.keys(vueCustomBlockTransforms)
  })
}
/**
 * Clone the given config object and fill it with default values.
 */
function prepareConfig(config) {
  const {
    alias = {},
    assetsDir = '_assets',
    assetsInclude = utils_1.isStaticAsset,
    assetsInlineLimit = 4096,
    base = '/',
    cssCodeSplit = true,
    cssModuleOptions = {},
    cssPreprocessOptions = {},
    define = {},
    emitAssets = true,
    emitIndex = true,
    enableEsbuild = true,
    enableRollupPluginVue = true,
    entry = 'index.html',
    env = {},
    esbuildTarget = 'es2020',
    indexHtmlTransforms = [],
    jsx = 'vue',
    minify = true,
    mode = 'production',
    optimizeDeps = {},
    outDir = 'dist',
    resolvers = [],
    rollupDedupe = [],
    rollupInputOptions = {},
    rollupOutputOptions = {},
    rollupPluginVueOptions = {},
    root = process.cwd(),
    shouldPreload = null,
    silent = false,
    sourcemap = false,
    terserOptions = {},
    transforms = [],
    vueCompilerOptions = {},
    vueCustomBlockTransforms = {},
    vueTransformAssetUrls = {},
    vueTemplatePreprocessOptions = {},
    write = true
  } = json_1.klona(config)
  return {
    ...config,
    alias,
    assetsDir,
    assetsInclude,
    assetsInlineLimit,
    base,
    cssCodeSplit,
    cssModuleOptions,
    cssPreprocessOptions,
    define,
    emitAssets,
    emitIndex,
    enableEsbuild,
    enableRollupPluginVue,
    entry,
    env,
    esbuildTarget,
    indexHtmlTransforms,
    jsx,
    minify,
    mode,
    optimizeDeps,
    outDir,
    resolvers,
    rollupDedupe,
    rollupInputOptions,
    rollupOutputOptions,
    rollupPluginVueOptions,
    root,
    shouldPreload,
    silent,
    sourcemap,
    terserOptions,
    transforms,
    vueCompilerOptions,
    vueCustomBlockTransforms,
    vueTransformAssetUrls,
    vueTemplatePreprocessOptions,
    write
  }
}
/**
 * Track parallel build calls and only stop the esbuild service when all
 * builds are done. (#1098)
 */
let parallelCallCounts = 0
/**
 * Bundles the app for production.
 * Returns a Promise containing the build result.
 */
async function build(options) {
  parallelCallCounts++
  try {
    return await doBuild(options)
  } finally {
    parallelCallCounts--
    if (parallelCallCounts <= 0) {
      await esbuildService_1.stopService()
    }
  }
}
exports.build = build
async function doBuild(options) {
  const builds = []
  const config = prepareConfig(options)
  const postBuildHooks = utils_1
    .toArray(config.configureBuild)
    .map((configureBuild) => configureBuild(config, builds))
    .filter(Boolean)
  const {
    root,
    assetsDir,
    assetsInlineLimit,
    emitAssets,
    minify,
    silent,
    sourcemap,
    shouldPreload,
    env,
    mode: configMode,
    define: userDefineReplacements,
    write
  } = config
  const isTest = process.env.NODE_ENV === 'test'
  const resolvedMode = process.env.VITE_ENV || configMode
  // certain plugins like rollup-plugin-vue relies on NODE_ENV for behavior
  // so we should always set it
  process.env.NODE_ENV =
    resolvedMode === 'test' || resolvedMode === 'development'
      ? resolvedMode
      : 'production'
  const start = Date.now()
  let spinner
  const msg = `Building ${configMode} bundle...`
  if (!silent) {
    if (process.env.DEBUG || isTest) {
      console.log(msg)
    } else {
      spinner = require('ora')(msg + '\n').start()
    }
  }
  const outDir = path_1.default.resolve(root, config.outDir)
  const indexPath = path_1.default.resolve(root, 'index.html')
  const publicDir = path_1.default.join(root, 'public')
  const publicBasePath = config.base.replace(/([^/])$/, '$1/') // ensure ending slash
  const resolvedAssetsPath = path_1.default.join(outDir, assetsDir)
  const resolver = resolver_1.createResolver(
    root,
    config.resolvers,
    config.alias,
    config.assetsInclude
  )
  const {
    htmlPlugin,
    renderIndex
  } = await buildPluginHtml_1.createBuildHtmlPlugin(
    root,
    indexPath,
    publicBasePath,
    assetsDir,
    assetsInlineLimit,
    resolver,
    shouldPreload,
    options
  )
  const basePlugins = await createBaseRollupPlugins(root, resolver, config)
  // https://github.com/darionco/rollup-plugin-web-worker-loader
  // configured to support `import Worker from './my-worker?worker'`
  // this plugin relies on resolveId and must be placed before node-resolve
  // since the latter somehow swallows ids with query strings since 8.x
  basePlugins.splice(
    basePlugins.findIndex((p) => p.name.includes('node-resolve')),
    0,
    require('rollup-plugin-web-worker-loader')({
      targetPlatform: 'browser',
      pattern: /(.+)\?worker$/,
      extensions: resolver_1.supportedExts,
      sourcemap: false // it's inlined so it bloats the bundle
    })
  )
  // user env variables loaded from .env files.
  // only those prefixed with VITE_ are exposed.
  const userClientEnv = {}
  const userEnvReplacements = {}
  Object.keys(env).forEach((key) => {
    if (key.startsWith(`VITE_`)) {
      userEnvReplacements[`import.meta.env.${key}`] = JSON.stringify(env[key])
      userClientEnv[key] = env[key]
    }
  })
  const builtInClientEnv = {
    BASE_URL: publicBasePath,
    MODE: configMode,
    DEV: resolvedMode !== 'production',
    PROD: resolvedMode === 'production'
  }
  const builtInEnvReplacements = {}
  Object.keys(builtInClientEnv).forEach((key) => {
    builtInEnvReplacements[`import.meta.env.${key}`] = JSON.stringify(
      builtInClientEnv[key]
    )
  })
  Object.keys(userDefineReplacements).forEach((key) => {
    userDefineReplacements[key] = JSON.stringify(userDefineReplacements[key])
  })
  const {
    pluginsPreBuild = [],
    plugins = [],
    pluginsPostBuild = [],
    pluginsOptimizer,
    ...rollupInputOptions
  } = config.rollupInputOptions
  builds.unshift({
    input: config.entry,
    preserveEntrySignatures: false,
    treeshake: { moduleSideEffects: 'no-external' },
    ...rollupInputOptions,
    output: config.rollupOutputOptions,
    plugins: [
      ...plugins,
      ...pluginsPreBuild,
      ...basePlugins,
      // vite:html
      htmlPlugin,
      // we use a custom replacement plugin because @rollup/plugin-replace
      // performs replacements twice, once at transform and once at renderChunk
      // - which makes it impossible to exclude Vue templates from it since
      // Vue templates are compiled into js and included in chunks.
      buildPluginReplace_1.createReplacePlugin(
        (id) =>
          !/\?vue&type=template/.test(id) &&
          // also exclude css and static assets for performance
          !cssUtils_1.isCSSRequest(id) &&
          !resolver.isAssetRequest(id),
        {
          ...config_1.defaultDefines,
          ...userDefineReplacements,
          ...userEnvReplacements,
          ...builtInEnvReplacements,
          'import.meta.env.': `({}).`,
          'import.meta.env': JSON.stringify({
            ...userClientEnv,
            ...builtInClientEnv
          }),
          'process.env.NODE_ENV': JSON.stringify(resolvedMode),
          'process.env.': `({}).`,
          'process.env': JSON.stringify({ NODE_ENV: resolvedMode }),
          'import.meta.hot': `false`
        },
        !!sourcemap
      ),
      // vite:css
      buildPluginCss_1.createBuildCssPlugin({
        root,
        publicBase: publicBasePath,
        assetsDir,
        minify,
        inlineLimit: assetsInlineLimit,
        cssCodeSplit: config.cssCodeSplit,
        preprocessOptions: config.cssPreprocessOptions,
        modulesOptions: config.cssModuleOptions
      }),
      // vite:wasm
      buildPluginWasm_1.createBuildWasmPlugin(
        root,
        publicBasePath,
        assetsDir,
        assetsInlineLimit
      ),
      // vite:asset
      buildPluginAsset_1.createBuildAssetPlugin(
        root,
        resolver,
        publicBasePath,
        assetsDir,
        assetsInlineLimit
      ),
      config.enableEsbuild &&
        buildPluginEsbuild_1.createEsbuildRenderChunkPlugin(
          config.esbuildTarget,
          minify === 'esbuild'
        ),
      // minify with terser
      // this is the default which has better compression, but slow
      // the user can opt-in to use esbuild which is much faster but results
      // in ~8-10% larger file size.
      minify && minify !== 'esbuild'
        ? require('rollup-plugin-terser').terser(config.terserOptions)
        : undefined,
      // #728 user plugins should apply after `@rollup/plugin-commonjs`
      // #471#issuecomment-683318951 user plugin after internal plugin
      ...pluginsPostBuild,
      // vite:manifest
      config.emitManifest
        ? buildPluginManifest_1.createBuildManifestPlugin()
        : undefined
    ].filter(Boolean)
  })
  // lazy require rollup so that we don't load it when only using the dev server
  // importing it just for the types
  const rollup = require('rollup').rollup
  // multiple builds are processed sequentially, in case a build
  // depends on the output of a preceding build.
  const results = await p_map_series_1.default(builds, async (build, i) => {
    const { output: outputOptions, onResult, ...inputOptions } = build
    const indexHtmlPath = getIndexHtmlOutputPath(build, outDir)
    const emitIndex = config.emitIndex && indexHtmlPath !== ''
    // unset the `output.file` option once `indexHtmlPath` is declared,
    // or else Rollup throws an error since multiple chunks are generated.
    if (indexHtmlPath && outputOptions.file) {
      outputOptions.file = undefined
    }
    let result
    try {
      const bundle = await rollup({
        onwarn: onRollupWarning(spinner, config.optimizeDeps),
        ...inputOptions,
        plugins: [
          ...(inputOptions.plugins || []).filter(
            // remove vite:emit in case this build copied another build's plugins
            (plugin) => plugin.name !== 'vite:emit'
          ),
          // vite:emit
          createEmitPlugin(emitAssets, async (assets, name) => {
            // #1071 ignore bundles from rollup-plugin-worker-loader
            if (name !== outputOptions.name) return
            const html = emitIndex ? await renderIndex(assets) : ''
            result = { build, assets, html }
            if (onResult) {
              await onResult(result)
            }
            // run post-build hooks sequentially
            await postBuildHooks.reduce(
              (queue, hook) => queue.then(() => hook(result)),
              Promise.resolve()
            )
            if (write) {
              if (i === 0) {
                await fs_extra_1.default.emptyDir(outDir)
              }
              if (emitIndex) {
                await fs_extra_1.default.writeFile(indexHtmlPath, html)
              }
            }
          })
        ]
      })
      await bundle[write ? 'write' : 'generate']({
        dir: resolvedAssetsPath,
        format: 'es',
        sourcemap,
        entryFileNames: `[name].[hash].js`,
        chunkFileNames: `[name].[hash].js`,
        assetFileNames: `[name].[hash].[ext]`,
        // #764 add `Symbol.toStringTag` when build es module into cjs chunk
        // #1048 add `Symbol.toStringTag` for module default export
        namespaceToStringTag: true,
        ...outputOptions
      })
    } finally {
      spinner && spinner.stop()
    }
    if (write && !silent) {
      if (emitIndex) {
        printFileInfo(indexHtmlPath, result.html, 3 /* HTML */)
      }
      for (const chunk of result.assets) {
        if (chunk.type === 'chunk') {
          const filePath = path_1.default.join(
            resolvedAssetsPath,
            chunk.fileName
          )
          printFileInfo(filePath, chunk.code, 0 /* JS */)
          if (chunk.map) {
            printFileInfo(
              filePath + '.map',
              chunk.map.toString(),
              4 /* SOURCE_MAP */
            )
          }
        } else if (emitAssets && chunk.source)
          printFileInfo(
            path_1.default.join(resolvedAssetsPath, chunk.fileName),
            chunk.source,
            chunk.fileName.endsWith('.css') ? 1 /* CSS */ : 2 /* ASSET */
          )
      }
    }
    spinner && spinner.start()
    return result
  })
  // copy over /public if it exists
  if (write && emitAssets && fs_extra_1.default.existsSync(publicDir)) {
    for (const file of await fs_extra_1.default.readdir(publicDir)) {
      await fs_extra_1.default.copy(
        path_1.default.join(publicDir, file),
        path_1.default.resolve(outDir, file)
      )
    }
  }
  spinner && spinner.stop()
  if (!silent) {
    console.log(
      `Build completed in ${((Date.now() - start) / 1000).toFixed(2)}s.\n`
    )
  }
  return results
}
/**
 * Bundles the app in SSR mode.
 * - All Vue dependencies are automatically externalized
 * - Imports to dependencies are compiled into require() calls
 * - Templates are compiled with SSR specific optimizations.
 */
async function ssrBuild(options) {
  const {
    rollupInputOptions,
    rollupOutputOptions,
    rollupPluginVueOptions
  } = options
  return build({
    outDir: 'dist-ssr',
    ...options,
    rollupPluginVueOptions: {
      target: 'node',
      ...rollupPluginVueOptions
    },
    rollupInputOptions: {
      ...rollupInputOptions,
      external: resolveExternal(
        rollupInputOptions && rollupInputOptions.external
      )
    },
    rollupOutputOptions: {
      format: 'cjs',
      exports: 'named',
      entryFileNames: '[name].js',
      ...rollupOutputOptions
    },
    emitIndex: false,
    emitAssets: false,
    cssCodeSplit: false,
    minify: false
  })
}
exports.ssrBuild = ssrBuild
function createEmitPlugin(emitAssets, emit) {
  return {
    name: 'vite:emit',
    async generateBundle({ name }, output) {
      // assume the first asset in `output` is an entry chunk
      const assets = Object.values(output)
      // process the output before writing
      await emit(assets, name)
      // write any assets injected by post-build hooks
      for (const asset of assets) {
        output[asset.fileName] = asset
      }
      // remove assets from bundle if emitAssets is false
      if (!emitAssets) {
        for (const name in output) {
          if (output[name].type === 'asset') {
            delete output[name]
          }
        }
      }
    }
  }
}
/**
 * Resolve the output path of `index.html` for the given build (relative to
 * `outDir` in Vite config).
 */
function getIndexHtmlOutputPath({ input, output }, outDir) {
  return input === 'index.html'
    ? path_1.default.resolve(outDir, output.file || input)
    : ''
}
function resolveExternal(userExternal) {
  const required = ['vue', /^@vue\//]
  if (!userExternal) {
    return required
  }
  if (Array.isArray(userExternal)) {
    return [...required, ...userExternal]
  } else if (typeof userExternal === 'function') {
    return (src, importer, isResolved) => {
      if (src === 'vue' || /^@vue\//.test(src)) {
        return true
      }
      return userExternal(src, importer, isResolved)
    }
  } else {
    return [...required, userExternal]
  }
}
function printFileInfo(filePath, content, type) {
  const needCompression =
    type === 0 /* JS */ || type === 1 /* CSS */ || type === 3 /* HTML */
  const compressed = needCompression
    ? `, brotli: ${(require('brotli-size').sync(content) / 1024).toFixed(2)}kb`
    : ``
  console.log(
    `${chalk_1.default.gray(`[write]`)} ${writeColors[type](
      path_1.default.relative(process.cwd(), filePath)
    )} ${(content.length / 1024).toFixed(2)}kb${compressed}`
  )
}
//# sourceMappingURL=index.js.map
