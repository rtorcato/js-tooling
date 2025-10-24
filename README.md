# js-tooling

A comprehensive collection of JavaScript/TypeScript development tools and configurations for modern projects.

## Installation

Install the package globally or use it directly with npx:

```bash
# Global installation
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

The package provides several CLI commands:

```bash
# Interactive project setup wizard
npx @rtorcato/js-tooling setup

# Run commit message helper
npx @rtorcato/js-tooling commitmessage

# Hello world example
npx @rtorcato/js-tooling helloworld
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

## Status

[![CI](https://github.com/rtorcato/js-tooling/actions/workflows/ci.yml/badge.svg)](https://github.com/rtorcato/js-tooling/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@rtorcato%2Fjs-tooling.svg)](https://badge.fury.io/js/@rtorcato%2Fjs-tooling)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/rtorcato/js-tooling)](https://github.com/rtorcato/js-tooling/releases)
[![GitHub issues](https://img.shields.io/github/issues/rtorcato/js-tooling)](https://github.com/rtorcato/js-tooling/issues)

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) and feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.