---
title: Vitest
description: Vitest configuration presets for Node.js and React projects.
---

## Node / base config

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config'
import baseConfig from '@rtorcato/js-tooling/vitest/config'

export default defineConfig({
  ...baseConfig,
  // Add project-specific settings
})
```

## React config

Extends the base config with `@vitejs/plugin-react`, jsdom environment, CSS stubbing, and `@` / `~` path aliases pointing to `src/`:

```javascript
// vitest.config.js
import reactConfig from '@rtorcato/js-tooling/vitest/react'
export default reactConfig
```

Requires `@vitejs/plugin-react` and `vitest` in your `devDependencies`.

## Setup file (CSS module mocking)

A minimal setup file that mocks all `*.module.css` imports:

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config'
import baseConfig from '@rtorcato/js-tooling/vitest/config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    setupFiles: ['@rtorcato/js-tooling/vitest/setup'],
  },
})
```

## Import paths

| Export | Use case |
|---|---|
| `@rtorcato/js-tooling/vitest/config` | Node.js / library projects |
| `@rtorcato/js-tooling/vitest/react` | React + jsdom projects |
| `@rtorcato/js-tooling/vitest/setup` | CSS module mocking setup file |
