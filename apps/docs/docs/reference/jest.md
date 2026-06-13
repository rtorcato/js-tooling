---
title: Jest
description: Jest testing framework presets for browser and Node.js environments.
---

## Presets

Two presets are available — pick the one that matches your test environment.

### Node (default)

```javascript
// jest.config.js
import preset from '@rtorcato/js-tooling/jest-presets/node/jest-preset'
export default { ...preset }
```

Or in `package.json`:

```json
{
  "jest": {
    "preset": "@rtorcato/js-tooling/jest-presets/node/jest-preset"
  }
}
```

### Browser (jsdom)

```javascript
// jest.config.js
import preset from '@rtorcato/js-tooling/jest-presets/browser/jest-preset'
export default { ...preset }
```

## When to use Jest vs Vitest

Prefer Vitest for new projects — it's faster, has native ESM support, and shares Vite's config. Use Jest when you need specific plugins not yet available for Vitest (e.g. `jest-axe`, snapshot serialisers), or when migrating an existing Jest suite incrementally.
