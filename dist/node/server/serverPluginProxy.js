'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.proxyPlugin = void 0
const url_1 = require('url')
const proxyPlugin = ({ app, config, server }) => {
  if (!config.proxy) {
    return
  }
  const debug = require('debug')('vite:proxy')
  const proxy = require('koa-proxies')
  const options = config.proxy
  Object.keys(options).forEach((path) => {
    let opts = options[path]
    if (typeof opts === 'string') {
      opts = { target: opts }
    }
    opts.logs = (ctx, target) => {
      debug(
        `${ctx.req.method} ${ctx.req.oldPath} proxy to -> ${new url_1.URL(
          ctx.req.url,
          target
        )}`
      )
    }
    app.use(proxy(path, opts))
  })
  server.on('upgrade', (req, socket, head) => {
    if (req.headers['sec-websocket-protocol'] !== 'vite-hmr') {
      for (const path in options) {
        const opts = options[path]
        if (typeof opts === 'object' && opts.ws) {
          proxy.proxy.ws(req, socket, head, opts)
        }
      }
    }
  })
}
exports.proxyPlugin = proxyPlugin
//# sourceMappingURL=serverPluginProxy.js.map
