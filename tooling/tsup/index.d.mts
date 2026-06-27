import type { Options } from 'tsup'
import type { defineConfig } from 'tsup'

export type DefineConfig = ReturnType<typeof defineConfig>

export declare const getConfig: (customOptions: Options, env: string) => DefineConfig

export declare const baseOptions: (options: Options, env: string) => Options
