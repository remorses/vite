'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.webWorkerPlugin = void 0
const webWorkerPlugin = ({ app }) => {
  app.use((ctx, next) => {
    if (ctx.query.worker != null) {
      ctx.type = 'js'
      ctx.body = `export default function WrappedWorker() {
        return new Worker(${JSON.stringify(ctx.path)}, { type: 'module' })
      }`
      return
    }
    return next()
  })
}
exports.webWorkerPlugin = webWorkerPlugin
//# sourceMappingURL=serverPluginWebWorker.js.map
