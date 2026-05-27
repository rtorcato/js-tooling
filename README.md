# js-tooling

A comprehensive collection of JavaScript/TypeScript development tools and configurations for modern projects.

## Why this exists

Most tooling libraries give you one piece — just TypeScript configs, or just an ESLint preset. This package covers the entire lifecycle: TypeScript, Biome/ESLint, Vitest/Jest, Commitlint, Husky, Semantic Release, and GitHub Actions CI, all wired together and validated against each other. The interactive `setup` wizard scaffolds all of it in one shot for a new project, and `doctor` checks an existing project for drift. Unlike turborepo (a monorepo task runner) or `@total-typescript/tsconfig` (TypeScript only), this is an opinionated end-to-end dev toolchain you can drop into any JS/TS project.

## Installation

Install the package globally or use it directly with npx:

```bash
# Install globally
npm install -g @rtorcato/js-tooling

# Or use with npx
npx @rtorcato/js-tooling setup
```

## Getting started

Use the interactive CLI to set up tooling for your project:

```bash
npx @rtorcato/js-tooling setup
```

Or import specific configurations:

```javascript
import '@rtorcato/js-tooling/typescript/base';
```

## Available Tools

This package includes configurations and presets for:

- **TypeScript** - Base configurations for different project types
- **ESLint** - Linting rules for JavaScript and TypeScript
- **Prettier** - Code formatting configuration
- **Biome** - Fast linter and formatter
- **Vitest** - Testing framework configuration
- **Jest** - Testing framework presets
- **Commitlint** - Commit message linting
- **Semantic Release** - Automated versioning and publishing
- **GitHub Actions** - CI/CD workflow templates
- **And more...**

## CI/CD Setup

The package includes GitHub Actions workflows and semantic-release configuration. For automated publishing, set these secrets in your GitHub repository:

1. **`NPM_TOKEN`** - npm authentication token for publishing packages
2. **`GITHUB_TOKEN`** - automatically provided by GitHub Actions

Repository settings: `https://github.com/your-username/your-repo/settings/secrets/actions`

## CLI Commands

### `setup` / `init`

Launches an interactive wizard that configures a new or existing project. `init` is an alias.

```bash
npx @rtorcato/js-tooling setup              # current directory
npx @rtorcato/js-tooling setup -d ./my-app  # specific directory
npx @rtorcato/js-tooling setup --skip-install  # skip npm/pnpm install
```

**Prompts (in order):**

| Prompt | Options |
|---|---|
| Project name | defaults to directory name |
| Project type | `library`, `web-app`, `node-api`, `nextjs-app`, `react-app` |
| TypeScript? | yes/no |
| TS config variant | `base`, `react`, `next`, `node`, `express` (context-filtered) |
| Linting/formatting tool | `biome` (recommended), `eslint`, `both`, `none` |
| ESLint config *(if ESLint)* | `base` or `nextjs` |
| Testing framework | `vitest` (recommended), `jest`, `playwright`, `none` |
| Test environment *(if Jest)* | `node`, `browser`, `both` |
| Git hooks (Husky + lint-staged)? | yes/no |
| Conventional commit linting? | yes/no *(if git hooks enabled)* |
| Semantic release? | yes/no *(library projects only)* |
| Bundler | `tsup`, `esbuild`, `vite` *(web apps)*, `none` |

**Files generated:**

- `package.json` — merged with chosen devDependencies and scripts
- `tsconfig.json` — extends the matching preset
- `biome.json` / `eslint.config.js` + `prettier.config.js` — based on linting choice
- `vitest.config.js` / `jest.config.js` — testing config
- `.husky/pre-commit`, `commitlint.config.js` — if git hooks chosen
- `release.config.js` — if semantic release chosen
- `.github/workflows/ci.yml` — CI workflow
- `README.md` — project README scaffold
- `reset.d.ts` — ts-reset type augmentation (if TypeScript)

### `copy <name>`

Copies a standalone config file into the current directory without running the full wizard. Useful when you only need one file.

```bash
npx @rtorcato/js-tooling copy biome     # → biome.json
npx @rtorcato/js-tooling copy tsconfig  # → tsconfig.json
```

### `list` / `ls`

Prints all available tooling configurations.

```bash
npx @rtorcato/js-tooling list
```

### Doctor

`doctor` audits an existing project against the presets and reports drift:

```bash
npx @rtorcato/js-tooling doctor              # current dir
npx @rtorcato/js-tooling doctor -d ./app     # specific dir
npx @rtorcato/js-tooling doctor --json       # machine-readable output
```

For each tracked config (TypeScript, Biome, ESLint, Prettier, Vitest, Commitlint, `package.json`) it reports `ok`, `drift`, `missing`, or `not configured`, and exits non-zero on `drift` or `missing` — handy as a CI check.

## Linting & Formatting

**Use Biome.** It replaces both ESLint and Prettier in a single fast tool, and is what this repo dogfoods. ESLint is available as a preset for projects that need specific plugins not yet covered by Biome (e.g. migrating a large existing config, or ecosystem-specific rules like `eslint-plugin-vitest`).

| Scenario | Recommendation |
|---|---|
| New project | Biome |
| Existing ESLint config | Keep ESLint, migrate gradually |
| Need specific ESLint plugin | ESLint (or Biome + ESLint for that plugin only) |

## Configuration Usage

### Biome (Formatter & Linter)

Since Biome doesn't support configuration extension, use the copy command to get the base configuration:

```bash
# Copy base Biome configuration
npx @rtorcato/js-tooling copy biome
```

This creates a `biome.json` file with:
- Tab indentation, 100 character line width
- Single quotes, ES5 trailing commas
- Recommended linting rules with sensible overrides
- Smart file patterns excluding build directories

After copying, customize for your project:

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

### TypeScript

Import TypeScript configurations directly in your `tsconfig.json`:

```json
{
  "extends": "@rtorcato/js-tooling/typescript/base"
}
```

Available configurations:
- `typescript/base` - Base configuration for all projects
- `typescript/react` - React-specific settings
- `typescript/next` - Next.js optimized configuration
- `typescript/node` - Node.js server configuration
- `typescript/express` - Express.js API configuration

### ESLint

```javascript
// eslint.config.js
import baseConfig from '@rtorcato/js-tooling/eslint/base'
import nextjsConfig from '@rtorcato/js-tooling/eslint/nextjs'

export default [
  ...baseConfig,
  // Add project-specific rules
]
```

### Commitlint

```javascript
// commitlint.config.js
import config from '@rtorcato/js-tooling/commitlint/config'
export default config
```

### Vitest

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config'
import baseConfig from '@rtorcato/js-tooling/vitest/config'

export default defineConfig({
  ...baseConfig,
  // Add project-specific settings
})
```

### Semantic Release

```javascript
// release.config.js
import config from '@rtorcato/js-tooling/semantic-release/github'
export default config
```

## Using with Package Managers

### With pnpm
```bash
# Temporarily install and run
pnpm --package=@rtorcato/js-tooling dlx setup

# Or install globally
pnpm add -g @rtorcato/js-tooling
```

### With npm
```bash
# Use directly
npx @rtorcato/js-tooling setup

# Or install globally  
npm install -g @rtorcato/js-tooling
```

## Development

To work on this package locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/rtorcato/js-tooling.git
   cd js-tooling
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the CLI:
   ```bash
   pnpm run build-cli
   ```

4. Link globally for testing:
   ```bash
   pnpm link --global
   ```

For more details, refer to the [pnpm link documentation](https://pnpm.io/cli/link).

## What's new

See [CHANGELOG.md](CHANGELOG.md) for the full history.

**v2.0.0** — All 39 tool packages (vitest, @biomejs/biome, etc.) moved from `dependencies` to `peerDependencies`. Add them to your own `devDependencies`. Also ships: `doctor` subcommand, generator unit tests, Dependabot, CI matrix (Node 22 + 24).

**v1.1.0** — Stricter commitlint limits, fix for CLI path resolution when copying configs.

## Status

[![CI](https://github.com/rtorcato/js-tooling/actions/workflows/ci.yml/badge.svg)](https://github.com/rtorcato/js-tooling/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@rtorcato%2Fjs-tooling.svg)](https://badge.fury.io/js/@rtorcato%2Fjs-tooling)
[![npm downloads](https://img.shields.io/npm/dm/@rtorcato%2Fjs-tooling)](https://www.npmjs.com/package/@rtorcato/js-tooling)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/rtorcato/js-tooling)](https://github.com/rtorcato/js-tooling/releases)
[![GitHub issues](https://img.shields.io/github/issues/rtorcato/js-tooling)](https://github.com/rtorcato/js-tooling/issues)

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) and feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.