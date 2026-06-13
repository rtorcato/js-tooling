---
title: Prettier
description: Prettier code formatter configuration.
---

## Usage

```javascript
// prettier.config.js
import config from '@rtorcato/js-tooling/prettier'
export default config
```

## What's included

- Single quotes, no semicolons
- `@ianvs/prettier-plugin-sort-imports` for import ordering
- Import groups ordered: types → React → Next.js → third-party → internal (`@acme/*`) → relative

## Customisation

Spread and override:

```javascript
// prettier.config.js
import base from '@rtorcato/js-tooling/prettier'

export default {
  ...base,
  printWidth: 120,
  plugins: [...(base.plugins ?? []), 'prettier-plugin-tailwindcss'],
}
```

## Tailwind CSS

The preset ships with `prettier-plugin-tailwindcss` commented out. To enable it, override `plugins` as shown above and ensure `prettier-plugin-tailwindcss` is installed.
