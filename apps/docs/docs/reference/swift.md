---
title: Swift
description: SwiftLint and Periphery configs, plus the Swift checks doctor runs on a SwiftPM repo.
---

Swift is the first non-JavaScript language module. `doctor` and `fix` detect a Swift repo from `Package.swift` and layer Swift-specific checks on top of the language-agnostic ones (CI, CodeQL, Dependabot, GitHub repo settings).

The standard here is the one [`swift-common`](https://github.com/rtorcato/swift-common) actually runs — SwiftLint for lint *and* formatting, Periphery for dead code.

:::tip Scaffolding a new package
`setup --preset swift-library` scaffolds a SwiftPM package end to end (manifest, sources, tests, configs, CI). This page is the config + check reference; the [Swift guide](../guides/swift.md) covers the project lifecycle.
:::

## Checks

| Check | Status when absent | Fix target |
|---|---|---|
| `Package.swift` | `missing` | — (run `swift package init`) |
| SwiftLint | `missing` | `swiftlint` |
| Periphery | `optional-missing` | `periphery` |
| Swift `.gitignore` | `missing` | `swift-gitignore` |
| Release automation | `optional-missing` | `swift-release` |
| Git hooks | `optional-missing` | `swift-git-hooks` |
| Pre-push hook | `optional-missing` | `swift-git-hooks` |

`Package.swift` is checked for two things SwiftPM will not infer: a `// swift-tools-version:` comment (without it the manifest doesn't parse) and an explicit `platforms:` clause (without it SwiftPM assumes its oldest supported deployment target, which rejects modern APIs at build time). There's no fixer — rewriting someone's manifest isn't safe, so `doctor` reports and you edit.

`Git hooks` and `Pre-push hook` are language-agnostic checks (they run on a JS repo too, against `.husky/`); the Swift module only supplies the shape — `.githooks/` and `swift test`.

## Git hooks

Husky is an npm package, so a SwiftPM repo can't use it without dragging node into a toolchain that otherwise has none. The node-free equivalent is a committed hooks directory:

```bash
npx @rtorcato/repo-tooling fix swift-git-hooks
```

That writes two executable hooks and points git at them:

| Hook | Runs |
|---|---|
| `.githooks/pre-commit` | `swiftlint --fix` then `swiftlint lint` |
| `.githooks/pre-push` | `swift build`, `swift test`, `swiftlint lint --strict` — the same gate as CI |

The hooks run the tools directly rather than through a `verify` indirection. SwiftPM has no scripts field, and a `Makefile` target would be a third place to keep the CI commands in sync (they already live in `.github/workflows/ci.yml` and `.swiftlint.yml`).

`core.hooksPath` is per-clone local git config, not a committed file, so `doctor` never reports its absence as drift — a fresh CI checkout isn't broken. Each clone needs it once:

```bash
git config core.hooksPath .githooks
```

There's no `commit-msg` hook: commitlint is an npm package and needs node on `PATH`. The `Commitlint` check still runs (Conventional Commits is language-agnostic) and stays `optional-missing` on a Swift repo unless you opt in.

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

## CI

```bash
npx @rtorcato/repo-tooling fix swift-ci          # .github/workflows/ci.yml
npx @rtorcato/repo-tooling fix swift-codeql      # .github/workflows/codeql.yml
npx @rtorcato/repo-tooling fix swift-gitlab-ci   # .gitlab-ci.yml
```

The workflow is derived from `Package.swift` — there's no config object to fill in.

| Job | Runner | What it does |
|---|---|---|
| `build-test` | `macos-latest` | `swift build` + `swift test`, with a SwiftPM cache keyed on `Package.resolved` |
| `lint` | `macos-latest` | `swiftlint lint --strict` |
| `dead-code` | `macos-latest` | `periphery scan --strict`, `continue-on-error` |
| `platforms` | `macos-latest` | `xcodebuild` per declared platform |

The `platforms` matrix is emitted only when the manifest declares both a `platforms:` clause and a library product (the product name becomes the xcodebuild scheme). A server-side or CLI package with neither gets `build-test` + `lint` + `dead-code` and nothing else — `xcodebuild` against a package with no deployment targets has nothing to build.

`dead-code` is emitted unconditionally and always as `continue-on-error`. An established codebase almost always has unused declarations on day one, and a permanently red job trains people to ignore CI; drop the flag once the repo is clean.

CodeQL uses `language: swift` rather than the JS matrix.

### Releases

```bash
npx @rtorcato/repo-tooling fix swift-release   # .github/workflows/release.yml
```

SwiftPM has no registry publish step — a release *is* a semver git tag that
consumers resolve with `.package(url:from:)` — so the workflow fires on the tag
rather than on a merge:

| Trigger | What runs |
|---|---|
| push of `1.2.3` or `v1.2.3` | `swift build`, `swift test`, then `gh release create --generate-notes --verify-tag` |

The build/test gate runs *before* the release is cut because a tag is
effectively permanent: SwiftPM caches resolved tags, so re-pointing a bad one
doesn't reliably reach consumers who already resolved it. `gh` is preinstalled
on GitHub runners, which is one fewer third-party action pin to track.

`semantic-release` is deliberately not accepted as evidence for this check — its
pipeline is npm end to end, and a Swift repo running it publishes the wrong
thing. The lockfile's `semanticRelease` field is the release-automation flag
either way: set it to `false` and `doctor` records the check as intentionally
declined.

### GitLab

GitLab runs Swift in the official Linux image (`swift:6.0`), which has no Xcode — so `.gitlab-ci.yml` covers the Linux-portable half only, `swift build` then `swift test`. No SwiftLint, no platform matrix.

## Scaffolding

`setup --preset swift-library` writes all of the above plus `Package.swift`, a `Sources/`/`Tests/` pair that builds and tests green, and the CI workflows. See the [Swift guide](../guides/swift.md) for the full file list and the JS-vs-Swift comparison.

## What isn't covered yet

- **README badges.** The `README badges` check runs on a Swift repo, but there's no fixer: `fix badges` derives every badge URL from a package.json `name` + `repository`, which a SwiftPM repo hasn't got. `doctor` reports; you add the badges by hand.
- **DocC, swift-format and test configuration.** Tracked in [#311](https://github.com/rtorcato/repo-tooling/issues/311).
