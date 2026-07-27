---
title: Vitest
description: Vitest configuration presets for Node.js and React projects.
---

## Node / base config

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config'
import baseConfig from '@rtorcato/repo-tooling/vitest/config'

export default defineConfig({
  ...baseConfig,
  // Add project-specific settings
})
```

## React config

Extends the base config with `@vitejs/plugin-react`, jsdom environment, CSS stubbing, and `@` / `~` path aliases pointing to `src/`:

```javascript
// vitest.config.js
import reactConfig from '@rtorcato/repo-tooling/vitest/react'
export default reactConfig
```

Requires `@vitejs/plugin-react` and `vitest` in your `devDependencies`.

## Setup file (CSS module mocking)

A minimal setup file that mocks all `*.module.css` imports:

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config'
import baseConfig from '@rtorcato/repo-tooling/vitest/config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    setupFiles: ['@rtorcato/repo-tooling/vitest/setup'],
  },
})
```

## Import paths

| Export | Use case |
|---|---|
| `@rtorcato/repo-tooling/vitest/config` | Node.js / library projects |
| `@rtorcato/repo-tooling/vitest/react` | React + jsdom projects |
| `@rtorcato/repo-tooling/vitest/setup` | CSS module mocking setup file |
