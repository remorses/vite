'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.defaultDefines = exports.loadEnv = exports.resolveConfig = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const chalk_1 = __importDefault(require('chalk'))
const dotenv_1 = __importDefault(require('dotenv'))
const dotenv_expand_1 = __importDefault(require('dotenv-expand'))
const buildPluginEsbuild_1 = require('./build/buildPluginEsbuild')
const resolver_1 = require('./resolver')
const utils_1 = require('./utils')
const debug = require('debug')('vite:config')
async function resolveConfig(mode, configPath) {
  const start = Date.now()
  const cwd = process.cwd()
  let resolvedPath
  if (configPath) {
    resolvedPath = path_1.default.resolve(cwd, configPath)
  } else {
    const jsConfigPath = path_1.default.resolve(cwd, 'vite.config.js')
    if (fs_extra_1.default.existsSync(jsConfigPath)) {
      resolvedPath = jsConfigPath
    } else {
      const tsConfigPath = path_1.default.resolve(cwd, 'vite.config.ts')
      if (fs_extra_1.default.existsSync(tsConfigPath)) {
        resolvedPath = tsConfigPath
      }
    }
  }
  if (!resolvedPath) {
    // load environment variables
    return {
      env: loadEnv(mode, cwd)
    }
  }
  const isTS = resolvedPath.endsWith('.ts')
  try {
    let userConfig
    if (!isTS) {
      try {
        userConfig = require(resolvedPath)
      } catch (e) {
        const ignored = /Cannot use import statement|Unexpected token 'export'|Must use import to load ES Module/
        if (!ignored.test(e.message)) {
          throw e
        }
      }
    }
    if (!userConfig) {
      // 2. if we reach here, the file is ts or using es import syntax, or
      // the user has type: "module" in their package.json (#917)
      // transpile es import syntax to require syntax using rollup.
      const rollup = require('rollup')
      const esbuildPlugin = await buildPluginEsbuild_1.createEsbuildPlugin({})
      const esbuildRenderChunkPlugin = buildPluginEsbuild_1.createEsbuildRenderChunkPlugin(
        'es2019',
        false
      )
      // use node-resolve to support .ts files
      const nodeResolve = require('@rollup/plugin-node-resolve').nodeResolve({
        extensions: resolver_1.supportedExts
      })
      const bundle = await rollup.rollup({
        external: (id) =>
          (id[0] !== '.' && !path_1.default.isAbsolute(id)) ||
          id.slice(-5, id.length) === '.json',
        input: resolvedPath,
        treeshake: false,
        plugins: [esbuildPlugin, nodeResolve, esbuildRenderChunkPlugin]
      })
      const {
        output: [{ code }]
      } = await bundle.generate({
        exports: 'named',
        format: 'cjs'
      })
      userConfig = await loadConfigFromBundledFile(resolvedPath, code)
    }
    let config =
      typeof userConfig === 'function' ? userConfig(mode) : userConfig
    // resolve plugins
    if (config.plugins) {
      for (const plugin of config.plugins) {
        config = resolvePlugin(config, plugin)
      }
    }
    // normalize config root to absolute
    if (config.root && !path_1.default.isAbsolute(config.root)) {
      config.root = path_1.default.resolve(
        path_1.default.dirname(resolvedPath),
        config.root
      )
    }
    if (typeof config.vueTransformAssetUrls === 'object') {
      config.vueTransformAssetUrls = normalizeAssetUrlOptions(
        config.vueTransformAssetUrls
      )
    }
    const env = loadEnv(mode, config.root || cwd)
    config.env = {
      ...config.env,
      ...env
    }
    debug(`config resolved in ${Date.now() - start}ms`)
    config.__path = resolvedPath
    return config
  } catch (e) {
    console.error(
      chalk_1.default.red(`[vite] failed to load config from ${resolvedPath}:`)
    )
    console.error(e)
    process.exit(1)
  }
}
exports.resolveConfig = resolveConfig
async function loadConfigFromBundledFile(fileName, bundledCode) {
  const extension = path_1.default.extname(fileName)
  const defaultLoader = require.extensions[extension]
  require.extensions[extension] = (module, filename) => {
    if (filename === fileName) {
      module._compile(bundledCode, filename)
    } else {
      defaultLoader(module, filename)
    }
  }
  delete require.cache[fileName]
  const raw = require(fileName)
  const config = raw.__esModule ? raw.default : raw
  require.extensions[extension] = defaultLoader
  return config
}
function resolvePlugin(config, plugin) {
  return {
    ...config,
    ...plugin,
    alias: {
      ...plugin.alias,
      ...config.alias
    },
    define: {
      ...plugin.define,
      ...config.define
    },
    transforms: [...(config.transforms || []), ...(plugin.transforms || [])],
    indexHtmlTransforms: [
      ...(config.indexHtmlTransforms || []),
      ...(plugin.indexHtmlTransforms || [])
    ],
    resolvers: [...(config.resolvers || []), ...(plugin.resolvers || [])],
    configureServer: [].concat(
      config.configureServer || [],
      plugin.configureServer || []
    ),
    configureBuild: [].concat(
      config.configureBuild || [],
      plugin.configureBuild || []
    ),
    vueCompilerOptions: {
      ...config.vueCompilerOptions,
      ...plugin.vueCompilerOptions
    },
    vueTransformAssetUrls: mergeAssetUrlOptions(
      config.vueTransformAssetUrls,
      plugin.vueTransformAssetUrls
    ),
    vueTemplatePreprocessOptions: {
      ...config.vueTemplatePreprocessOptions,
      ...plugin.vueTemplatePreprocessOptions
    },
    vueCustomBlockTransforms: {
      ...config.vueCustomBlockTransforms,
      ...plugin.vueCustomBlockTransforms
    },
    rollupInputOptions: mergeObjectOptions(
      config.rollupInputOptions,
      plugin.rollupInputOptions
    ),
    rollupOutputOptions: mergeObjectOptions(
      config.rollupOutputOptions,
      plugin.rollupOutputOptions
    ),
    enableRollupPluginVue:
      config.enableRollupPluginVue || plugin.enableRollupPluginVue
  }
}
function mergeAssetUrlOptions(to, from) {
  if (from === true) {
    return to
  }
  if (from === false) {
    return from
  }
  if (typeof to === 'boolean') {
    return from || to
  }
  return {
    ...normalizeAssetUrlOptions(to),
    ...normalizeAssetUrlOptions(from)
  }
}
function normalizeAssetUrlOptions(o) {
  if (o && Object.keys(o).some((key) => Array.isArray(o[key]))) {
    return {
      tags: o
    }
  } else {
    return o
  }
}
function mergeObjectOptions(to, from) {
  if (!to) return from
  if (!from) return to
  const res = { ...to }
  for (const key in from) {
    const existing = res[key]
    const toMerge = from[key]
    if (Array.isArray(existing) || Array.isArray(toMerge)) {
      res[key] = [].concat(existing, toMerge).filter(Boolean)
    } else {
      res[key] = toMerge
    }
  }
  return res
}
function loadEnv(mode, root, prefix = 'VITE_') {
  if (mode === 'local') {
    throw new Error(
      `"local" cannot be used as a mode name because it conflicts with ` +
        `the .local postfix for .env files.`
    )
  }
  debug(`env mode: ${mode}`)
  const env = {}
  const envFiles = [
    /** mode local file */ `.env.${mode}.local`,
    /** mode file */ `.env.${mode}`,
    /** local file */ `.env.local`,
    /** default file */ `.env`
  ]
  for (const file of envFiles) {
    const path = utils_1.lookupFile(root, [file], true)
    if (path) {
      const parsed = dotenv_1.default.parse(
        fs_extra_1.default.readFileSync(path),
        {
          debug: !!process.env.DEBUG || undefined
        }
      )
      // let environment variables use each other
      dotenv_expand_1.default({
        parsed,
        // prevent process.env mutation
        ignoreProcessEnv: true
      })
      // only keys that start with prefix are exposed.
      for (const [key, value] of Object.entries(parsed)) {
        if (key.startsWith(prefix) && env[key] === undefined) {
          env[key] = value
        }
      }
    }
  }
  debug(`env: %O`, env)
  return env
}
exports.loadEnv = loadEnv
// TODO move this into Vue plugin when we extract it
exports.defaultDefines = {
  __VUE_OPTIONS_API__: true,
  __VUE_PROD_DEVTOOLS__: false
}
//# sourceMappingURL=config.js.map
