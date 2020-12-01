import { Plugin } from 'rollup'
export interface OptimizeAnalysisResult {
  isCommonjs: {
    [name: string]: true
  }
}
export declare function entryAnalysisPlugin({ root }: { root: string }): Plugin
