import { Plugin } from 'rollup'
import { InternalResolver } from '../resolver'
export declare const createDepAssetExternalPlugin: (
  resolver: InternalResolver
) => Plugin
export declare const createDepAssetPlugin: (
  resolver: InternalResolver,
  root: string
) => Plugin
