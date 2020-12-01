import { Ora } from 'ora'
import {
  Plugin,
  InputOption,
  InputOptions,
  OutputOptions,
  RollupOutput
} from 'rollup'
import { InternalResolver } from '../resolver'
import { BuildConfig } from '../config'
interface Build extends InputOptions {
  input: InputOption
  output: OutputOptions
  /** Runs before global post-build hooks. */
  onResult?: PostBuildHook
}
export interface BuildResult {
  build: Build
  html: string
  assets: RollupOutput['output']
}
/** For adding Rollup builds and mutating the Vite config. */
export declare type BuildPlugin = (
  config: BuildConfig,
  builds: Build[]
) => PostBuildHook | void
/** Returned by `configureBuild` hook to mutate a build's output. */
export declare type PostBuildHook = (
  result: BuildResult
) => Promise<void> | void
export declare function onRollupWarning(
  spinner: Ora | undefined,
  options: BuildConfig['optimizeDeps']
): InputOptions['onwarn']
/**
 * Creates non-application specific plugins that are shared between the main
 * app and the dependencies. This is used by the `optimize` command to
 * pre-bundle dependencies.
 */
export declare function createBaseRollupPlugins(
  root: string,
  resolver: InternalResolver,
  options: Partial<BuildConfig>
): Promise<Plugin[]>
/**
 * Bundles the app for production.
 * Returns a Promise containing the build result.
 */
export declare function build(
  options: Partial<BuildConfig>
): Promise<BuildResult[]>
/**
 * Bundles the app in SSR mode.
 * - All Vue dependencies are automatically externalized
 * - Imports to dependencies are compiled into require() calls
 * - Templates are compiled with SSR specific optimizations.
 */
export declare function ssrBuild(
  options: Partial<BuildConfig>
): Promise<BuildResult[]>
export {}
