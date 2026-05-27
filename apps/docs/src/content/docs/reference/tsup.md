---
title: tsup
description: tsup bundler configuration helpers.
---

## Usage

```typescript
// tsup.config.ts
import { getConfig } from '@rtorcato/js-tooling/tsup'

export default getConfig({
  entry: ['src/index.ts'],
}, process.env.NODE_ENV ?? 'development')
```

## API

### `getConfig(customOptions, env)`

Returns a `tsup` `DefineConfig` with opinionated defaults merged with your overrides.

| Option | Default |
|---|---|
| `format` | `['cjs', 'esm']` |
| `entry` | `src/**/*.ts` |
| `dts` | `true` |
| `clean` | `true` |
| `splitting` | `true` |
| `treeshake` | `true` |
| `skipNodeModulesBundle` | `true` |
| `minify` | production only |
| `bundle` | `false` |

### `baseOptions(options, env)`

Lower-level helper that returns the raw `Options` object. Use `getConfig` unless you need direct access.
