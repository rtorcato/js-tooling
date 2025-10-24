# Biome Configuration

This package provides a standardized Biome configuration for consistent code formatting and linting across projects.

## Installation

```bash
npm install -D @rtorcato/js-tooling @biomejs/biome
```

## Usage

### Option 1: CLI Copy Command (Recommended)

```bash
npx @rtorcato/js-tooling copy biome
```

This will copy the base `biome.json` configuration to your project root.

### Option 2: Manual Copy

```bash
cp node_modules/@rtorcato/js-tooling/tooling/biome/biome.json ./biome.json
```

### Option 3: Reference in package.json

```json
{
  "scripts": {
    "lint": "biome lint .",
    "format": "biome format .",
    "check": "biome check .",
    "check:fix": "biome check --fix ."
  }
}
```

## Configuration Features

- **Formatter**: Tab indentation, 100 character line width, single quotes
- **Linter**: Recommended rules with sensible overrides
- **JavaScript**: ES5 trailing commas, semicolons as needed
- **Import organization**: Disabled to prevent conflicts
- **File patterns**: Excludes common build/config directories

## Customization

After copying the configuration, you can customize it for your project:

```json
{
  // Add project-specific rules
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  },
  // Add project-specific file patterns
  "files": {
    "includes": [
      "src/**/*",
      "!src/generated/**"
    ]
  }
}
```

## VS Code Integration

Add to your `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

## Why Biome Can't Extend Configurations

Unlike ESLint or TypeScript, Biome doesn't support configuration inheritance/extending. Each project needs its own complete `biome.json` file. This package provides a well-tested base configuration that you can copy and customize.