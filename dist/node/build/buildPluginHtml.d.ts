import { Plugin, OutputChunk, RollupOutput } from 'rollup'
import { InternalResolver } from '../resolver'
import { UserConfig } from '../config'
export declare const createBuildHtmlPlugin: (
  root: string,
  indexPath: string,
  publicBasePath: string,
  assetsDir: string,
  inlineLimit: number,
  resolver: InternalResolver,
  shouldPreload: ((chunk: OutputChunk) => boolean) | null,
  config: Partial<UserConfig>
) => Promise<
  | {
      renderIndex: () => string
      htmlPlugin: null
    }
  | {
      renderIndex: (bundleOutput: RollupOutput['output']) => Promise<string>
      htmlPlugin: Plugin
    }
>
