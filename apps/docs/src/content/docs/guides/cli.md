---
title: CLI Commands
description: Full reference for the js-tooling CLI.
---

## setup / init

Launches the interactive wizard. `init` is an alias for `setup`.

```bash
npx @rtorcato/js-tooling setup              # current directory
npx @rtorcato/js-tooling setup -d ./my-app  # specific directory
npx @rtorcato/js-tooling setup --skip-install  # skip npm/pnpm install
```

## copy \<name\>

Copies a standalone config file into the current directory without running the full wizard.

```bash
npx @rtorcato/js-tooling copy biome     # → biome.json
npx @rtorcato/js-tooling copy tsconfig  # → tsconfig.json
```

## list / ls

Prints all available tooling configurations.

```bash
npx @rtorcato/js-tooling list
```

## doctor

Audits an existing project against the presets and reports drift.

```bash
npx @rtorcato/js-tooling doctor              # current dir
npx @rtorcato/js-tooling doctor -d ./app     # specific dir
npx @rtorcato/js-tooling doctor --json       # machine-readable output
```

For each tracked config (TypeScript, Biome, ESLint, Prettier, Vitest, Commitlint, `package.json`) it reports one of:

| Status | Meaning |
|---|---|
| `ok` | Config matches the preset |
| `drift` | Config exists but has diverged |
| `missing` | Config expected but not found |
| `not configured` | Tool not selected for this project |

Exits non-zero on `drift` or `missing` — useful as a CI gate.
