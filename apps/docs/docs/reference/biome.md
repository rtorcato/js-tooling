---
title: Biome
description: Biome formatter and linter configuration.
---

**Use Biome.** It replaces both ESLint and Prettier in a single fast tool, and is what this repo dogfoods.

| Scenario | Recommendation |
|---|---|
| New project | Biome |
| Existing ESLint config | Keep ESLint, migrate gradually |
| Need a specific ESLint plugin | ESLint (or Biome + ESLint for that plugin only) |

## Usage

Because Biome doesn't support configuration extension, copy the base config into your project:

```bash
npx @rtorcato/js-tooling copy biome
```

This creates a `biome.json` with:
- Tab indentation, 100 character line width
- Single quotes, ES5 trailing commas
- Recommended linting rules with sensible overrides
- Smart file patterns excluding build directories

## Customisation

After copying, edit `biome.json` directly:

```json
{
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  }
}
```

## Import in scripts

```javascript
// biome.json path for lint-staged or other scripts
import config from '@rtorcato/js-tooling/biome'
```
