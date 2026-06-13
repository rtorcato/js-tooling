---
title: ESLint
description: ESLint configuration presets.
---

ESLint is available for projects that need specific plugins not yet covered by Biome (e.g. migrating a large existing config, or ecosystem-specific rules).

## Usage

```javascript
// eslint.config.js
import baseConfig from '@rtorcato/js-tooling/eslint/base'

export default [
  ...baseConfig,
  // Add project-specific rules
]
```

For Next.js projects:

```javascript
// eslint.config.js
import nextjsConfig from '@rtorcato/js-tooling/eslint/nextjs'

export default [
  ...nextjsConfig,
]
```

## Available presets

| Export | Includes |
|---|---|
| `eslint/base` | JS/TS rules, import ordering, airbnb base |
| `eslint/nextjs` | Base + Next.js specific rules |
