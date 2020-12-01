'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.clientPlugin = exports.clientPublicPath = exports.clientFilePath = void 0
const fs_1 = __importDefault(require('fs'))
const path_1 = __importDefault(require('path'))
const chalk_1 = __importDefault(require('chalk'))
const config_1 = require('../config')
exports.clientFilePath = path_1.default.resolve(
  __dirname,
  '../../client/client.js'
)
exports.clientPublicPath = `/vite/client`
const legacyPublicPath = '/vite/hmr'
const clientPlugin = ({ app, config }) => {
  const clientCode = fs_1.default
    .readFileSync(exports.clientFilePath, 'utf-8')
    .replace(`__MODE__`, JSON.stringify(config.mode || 'development'))
    .replace(
      `__DEFINES__`,
      JSON.stringify({
        ...config_1.defaultDefines,
        ...config.define
      })
    )
  app.use(async (ctx, next) => {
    if (ctx.path === exports.clientPublicPath) {
      let socketPort = ctx.port
      // infer on client by default
      let socketProtocol = null
      let socketHostname = null
      let socketTimeout = 30000
      if (config.hmr && typeof config.hmr === 'object') {
        // hmr option has highest priory
        socketProtocol = config.hmr.protocol || null
        socketHostname = config.hmr.hostname || null
        socketPort = config.hmr.port || ctx.port
        if (config.hmr.timeout) {
          socketTimeout = config.hmr.timeout
        }
        if (config.hmr.path) {
          socketPort = `${socketPort}/${config.hmr.path}`
        }
      }
      ctx.type = 'js'
      ctx.status = 200
      ctx.body = clientCode
        .replace(`__HMR_PROTOCOL__`, JSON.stringify(socketProtocol))
        .replace(`__HMR_HOSTNAME__`, JSON.stringify(socketHostname))
        .replace(`__HMR_PORT__`, JSON.stringify(socketPort))
        .replace(`__HMR_TIMEOUT__`, JSON.stringify(socketTimeout))
    } else {
      if (ctx.path === legacyPublicPath) {
        console.error(
          chalk_1.default.red(
            `[vite] client import path has changed from "/vite/hmr" to "/vite/client". ` +
              `please update your code accordingly.`
          )
        )
      }
      return next()
    }
  })
}
exports.clientPlugin = clientPlugin
//# sourceMappingURL=serverPluginClient.js.map
