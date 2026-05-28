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

**Why only two?** Biome doesn't support configuration extension, so the only way to customise it is to own the file. TypeScript configs also benefit from being local so editors resolve them without hunting up the tree. All other configs (ESLint, Prettier, Vitest, etc.) can be imported or extended directly — see the [Configuration Reference](/js-tooling/reference/biome/) for usage.

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

Each row reports one of:

| Status | Meaning |
|---|---|
| `ok` | Config matches the preset (or required file present) |
| `drift` | Config exists but has diverged from the preset |
| `missing` | Config required but not found |
| `not configured` | Optional tool not present in the project |

### What gets checked

| Group | Checks |
|---|---|
| Environment | Node version (vs. minimum + LTS patch level), `engines.node` field |
| Repo baseline | `package.json`, `.editorconfig`, `.nvmrc` / `.node-version` |
| Tooling presets | TypeScript, Biome, ESLint, Prettier, Vitest, Commitlint |
| Automation | Husky, `lint-staged`, semantic-release, knip |
| CI / supply chain | GitHub Actions, Dependabot, CodeQL, GitLab CI |

After the per-row results, doctor prints a **Next steps:** footer listing the exact `fix` command to run for each non-ok item:

```ansi
  Next steps:
    - Run `npx @rtorcato/js-tooling fix engines` to align engines.node
    - Run `npx @rtorcato/js-tooling fix editorconfig` to scaffold EditorConfig
    - Run `npx @rtorcato/js-tooling fix dependabot` to scaffold Dependabot
    - Run `npx @rtorcato/js-tooling fix` to walk all findings interactively
```

Exits non-zero on `drift` or `missing` — useful as a CI gate.

## fix \[target\]

Applies scaffolders for items `doctor` flagged. Without a target it walks every non-ok result, prompting per item; with a target it applies just that one.

```bash
npx @rtorcato/js-tooling fix                    # walk all findings interactively
npx @rtorcato/js-tooling fix dependabot         # scaffold just .github/dependabot.yml
npx @rtorcato/js-tooling fix --yes              # apply every recommended fix without prompts
npx @rtorcato/js-tooling fix biome --dry-run    # print what would change, write nothing
```

### Flags

| Flag | Behaviour |
|---|---|
| `-d, --directory <path>` | Target directory (defaults to cwd) |
| `--yes` | Assume yes to every prompt, including drift overwrites |
| `--dry-run` | Print the files each fixer would write, without writing |

### Drift policy

When a file exists but doesn't extend the preset, `fix` defaults the confirm prompt to **No** — your customisations are preserved unless you explicitly say yes (or pass `--yes`). The prompt always tells you which file is about to be overwritten.

### Available targets

| Target | Doctor check it covers | Outputs |
|---|---|---|
| `package-json` | `package.json` | adds `@rtorcato/js-tooling` to `devDependencies` |
| `engines` | `engines.node` | sets `engines.node` (never overwrites) |
| `editorconfig` | `EditorConfig` | `.editorconfig` |
| `nvmrc` | `Node version pin` | `.nvmrc` |
| `tsconfig` | `TypeScript` | `tsconfig.json` |
| `biome` | `Biome` | `biome.json` |
| `eslint` | `ESLint` | `eslint.config.mjs` |
| `prettier` | `Prettier` | `prettier.config.mjs` |
| `vitest` | `Vitest` | `vitest.config.ts` (preserves existing `vitest.setup.ts`) |
| `commitlint` | `Commitlint` | `commitlint.config.mjs` |
| `husky` | `Husky` + `lint-staged` | `.husky/pre-commit`, package.json `lint-staged` field (deep-merges) |
| `semantic-release` | `semantic-release` | `release.config.mjs` (skipped on private packages) |
| `knip` | `knip` | `knip.json` |
| `github-actions` | `GitHub Actions` | `.github/workflows/ci.yml` |
| `dependabot` | `Dependabot` | `.github/dependabot.yml` |
| `codeql` | `CodeQL` | `.github/workflows/codeql.yml` |

### Typical workflow

```bash
npx @rtorcato/js-tooling doctor   # see what's missing
npx @rtorcato/js-tooling fix      # walk the list, accept defaults
npx @rtorcato/js-tooling doctor   # confirm everything is now ok
```
