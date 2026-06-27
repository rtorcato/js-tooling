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

**Why only two?** Biome doesn't support configuration extension, so the only way to customise it is to own the file. TypeScript configs also benefit from being local so editors resolve them without hunting up the tree. All other configs (ESLint, Prettier, Vitest, etc.) can be imported or extended directly — see the [Configuration Reference](../reference/biome.md) for usage.

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
npx @rtorcato/js-tooling fix biome --diff       # show the exact diff before confirming
```

### Flags

| Flag | Behaviour |
|---|---|
| `-d, --directory <path>` | Target directory (defaults to cwd) |
| `--yes` | Assume yes to every prompt, including drift overwrites |
| `--dry-run` | Print the files each fixer would write, without writing |
| `--diff` | Print a unified diff of each change before the confirm prompt |

### Drift policy

When a file exists but doesn't extend the preset, `fix` defaults the confirm prompt to **No** — your customisations are preserved unless you explicitly say yes (or pass `--yes`). The prompt always tells you which file is about to be overwritten.

### Diff preview (`--diff`)

When you want to see *exactly* what would change before saying yes, pass `--diff`. For each output the fixer would touch, you'll see:

- a `create <path>` header if the file is new (no diff body to show), or
- a `modify <path>` header followed by a unified diff comparing the current file to what the fixer would write.

```text
$ npx @rtorcato/js-tooling fix biome --diff
🔧 biome — Biome is drift

  modify biome.json
    --- biome.json
    +++ biome.json
    @@ -1,3 +1,12 @@
    -{
    -  "rules": { "noConsole": "error" }
    -}
    +{
    +  "$schema": "https://biomejs.dev/schemas/2.4.16/schema.json",
    +  "extends": ["@rtorcato/js-tooling/biome"],
    +  …
    +}
? ⚠️  Scaffold biome.json … — overwrite existing file? user customizations will be lost (y/N)
```

The diff:

- is suppressed in `--json` mode (the structured output stream stays clean),
- is suppressed for safe-add fixers (those never overwrite existing files),
- honours `NO_COLOR` and the standard terminal-colour detection chalk uses,
- works in both targeted (`fix biome --diff`) and walk-all (`fix --diff`) modes.

Implementation note: the preview is computed by shadow-running the fixer in a temp copy of your project directory — your real files are never touched until you confirm.

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
| `attw` | `are-the-types-wrong` | adds `@arethetypeswrong/cli` + an `attw` script (esm-only profile when applicable), wires it into `verify` |

### Typical workflow

```bash
npx @rtorcato/js-tooling doctor   # see what's missing
npx @rtorcato/js-tooling fix      # walk the list, accept defaults
npx @rtorcato/js-tooling doctor   # confirm everything is now ok
```
