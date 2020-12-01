/// <reference types="node" />
import { Plugin, OutputBundle } from 'rollup'
import { InternalResolver } from '../resolver'
interface AssetCacheEntry {
  content?: Buffer
  fileName?: string
  url: string | undefined
}
export declare const injectAssetRe: RegExp
export declare const resolveAsset: (
  id: string,
  root: string,
  publicBase: string,
  assetsDir: string,
  inlineLimit: number
) => Promise<AssetCacheEntry>
export declare const registerAssets: (
  assets: Map<string, Buffer>,
  bundle: OutputBundle
) => void
export declare const createBuildAssetPlugin: (
  root: string,
  resolver: InternalResolver,
  publicBase: string,
  assetsDir: string,
  inlineLimit: number
) => Plugin
export {}
