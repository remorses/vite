import { IndexHtmlTransform } from '../transform'
export declare function asyncReplace(
  input: string,
  re: RegExp,
  replacer: (match: RegExpExecArray) => string | Promise<string>
): Promise<string>
export declare function injectScriptToHtml(html: string, script: string): string
export declare function transformIndexHtml(
  html: string,
  transforms: IndexHtmlTransform[] | undefined,
  apply: 'pre' | 'post',
  isBuild?: boolean
): Promise<string>
