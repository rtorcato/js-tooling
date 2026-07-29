---
title: Swift
description: SwiftLint and Periphery configs, plus the Swift checks doctor runs on a SwiftPM repo.
---

Swift is the first non-JavaScript language module. `doctor` and `fix` detect a Swift repo from `Package.swift` and layer Swift-specific checks on top of the language-agnostic ones (CI, CodeQL, Dependabot, GitHub repo settings).

The standard here is the one [`swift-common`](https://github.com/rtorcato/swift-common) actually runs — SwiftLint for lint *and* formatting, Periphery for dead code.

:::note No setup preset yet
`setup` can't scaffold a Swift project — it audits and fixes an existing one. Picking Swift in the setup wizard points you at `doctor` instead. The `swift-library` preset is tracked in [#288](https://github.com/rtorcato/repo-tooling/issues/288).
:::

## Checks

| Check | Status when absent | Fix target |
|---|---|---|
| `Package.swift` | `missing` | — (run `swift package init`) |
| SwiftLint | `missing` | `swiftlint` |
| Periphery | `optional-missing` | `periphery` |
| Swift `.gitignore` | `missing` | `swift-gitignore` |

`Package.swift` is checked for two things SwiftPM will not infer: a `// swift-tools-version:` comment (without it the manifest doesn't parse) and an explicit `platforms:` clause (without it SwiftPM assumes its oldest supported deployment target, which rejects modern APIs at build time). There's no fixer — rewriting someone's manifest isn't safe, so `doctor` reports and you edit.

## Configs

```bash
npx @rtorcato/repo-tooling fix swiftlint    # .swiftlint.yml
npx @rtorcato/repo-tooling fix periphery    # .periphery.yml
npx @rtorcato/repo-tooling fix swift-gitignore
```

`swiftlint` and `periphery` are also available via `copy`:

```bash
npx @rtorcato/repo-tooling copy swiftlint
```

### SwiftLint

Formatting is SwiftLint's job here — `swiftlint --fix` in a pre-commit hook, `swiftlint lint --strict` in CI. **SwiftFormat is deliberately not part of the standard**; a second formatter would fight the first.

```yaml
disabled_rules:
  - weak_delegate
  - cyclomatic_complexity
  - force_unwrapping
  - function_body_length
  - type_name
  - line_length
  - identifier_name
  - trailing_whitespace

excluded:
  - .build
  - .swiftpm
  - DerivedData

file_length:
  warning: 500
  error: 1200

nesting:
  type_level:
    warning: 3
    error: 6
```

### Periphery

`retain_public: true` keeps a library's public API from being reported as unused — for a SwiftPM package the public surface *is* the product.

```yaml
retain_public: true
```

Periphery is best run as an informational CI job (`continue-on-error: true`) until a codebase is clean, then promoted to blocking.

### `.gitignore`

The `swift-gitignore` fixer **appends** the Swift build artefacts rather than replacing the file, so project-specific entries survive. It adds only what's absent:

```gitignore
.DS_Store
/.build
/Packages
/*.xcodeproj
xcuserdata/
DerivedData/
.swiftpm/config/registries.json
.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata
.netrc
```

`.build` and `DerivedData` are the ones that matter — a single stray commit of either adds hundreds of megabytes to the repo's history.

## What isn't covered yet

- **CI generation.** `.github/workflows/ci.yml` for Swift (plus `language: swift` in the CodeQL matrix) lands in [#287](https://github.com/rtorcato/repo-tooling/issues/287).
- **Language-agnostic fixers.** `doctor` reports base findings (Dependabot, CodeQL, CODEOWNERS, community health) on a Swift repo, but `fix` reports them as `unsupported` — those fixers still live in the JS module and haven't been split out yet.
