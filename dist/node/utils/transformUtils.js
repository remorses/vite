'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.transformIndexHtml = exports.injectScriptToHtml = exports.asyncReplace = void 0
async function asyncReplace(input, re, replacer) {
  let match
  let remaining = input
  let rewritten = ''
  while ((match = re.exec(remaining))) {
    rewritten += remaining.slice(0, match.index)
    rewritten += await replacer(match)
    remaining = remaining.slice(match.index + match[0].length)
  }
  rewritten += remaining
  return rewritten
}
exports.asyncReplace = asyncReplace
const injectReplaceRE = [/<head>/, /<!doctype html>/i]
function injectScriptToHtml(html, script) {
  // inject after head or doctype
  for (const re of injectReplaceRE) {
    if (re.test(html)) {
      return html.replace(re, `$&${script}`)
    }
  }
  // if no <head> tag or doctype is present, just prepend
  return script + html
}
exports.injectScriptToHtml = injectScriptToHtml
async function transformIndexHtml(
  html,
  transforms = [],
  apply,
  isBuild = false
) {
  let code = html
  for (let t of transforms) {
    if (typeof t === 'function') {
      t = { apply: 'post', transform: t }
    }
    if (t.apply === apply) {
      code = await t.transform({ isBuild, code })
    }
  }
  return code
}
exports.transformIndexHtml = transformIndexHtml
//# sourceMappingURL=transformUtils.js.map
