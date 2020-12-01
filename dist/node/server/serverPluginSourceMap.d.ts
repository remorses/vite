import { ServerPlugin } from '.'
import { ExistingRawSourceMap } from 'rollup'
import { RawSourceMap } from 'source-map'
interface IRawSourceMap extends RawSourceMap {
  version: any
}
interface IExistingRawSourceMap extends ExistingRawSourceMap {
  version: any
}
export declare type SourceMap = IExistingRawSourceMap | IRawSourceMap
export declare function mergeSourceMap(
  oldMap: SourceMap | null | undefined,
  newMap: SourceMap
): SourceMap
export declare const sourceMapPlugin: ServerPlugin
export {}
