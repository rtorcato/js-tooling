# Roadmap

`@rtorcato/js-tooling` is a single-package TypeScript/JavaScript tooling
distribution — every preset plus a CLI to scaffold and audit projects. It ships
**continuously** via semantic-release (currently the `2.x` line), so there is no
staged "beta" release train: every merge to `main` carrying a `feat:`/`fix:`
publishes, and breaking changes go out as major bumps with migration notes in
the [CHANGELOG](./CHANGELOG.md).

This file tracks direction at the theme level. The issue-level detail lives in
**[GitHub milestones](https://github.com/rtorcato/js-tooling/milestones)** —
each theme below links to its milestone.

## Shipped

- **Core toolchain presets** — TypeScript, Biome/ESLint, Prettier, Vitest/Jest,
  Commitlint, Husky, semantic-release, and bundlers (tsup/esbuild/Rollup/
  Rolldown/Vite).
- **CLI** — `setup` (wizard + presets), `doctor` (drift audit), `fix`
  (incremental scaffolders), `list`, and `copy`.
- **Supply-chain security** — Dependabot + CodeQL scaffolding, and
  [GitHub settings sync](https://github.com/rtorcato/js-tooling/milestone/1)
  (branch protection, merge settings, workflow permissions).
- **[Preset backlog](https://github.com/rtorcato/js-tooling/milestone/6)** —
  the long tail of bundler/release/lint presets.
- **Docs site** — the shared Docusaurus assets and the `fix docs-site` generator
  (config, theme tokens, Pages deploy, Playwright smoke test, opt-in TypeDoc).
- **AI adoption** — generated agent rules (AGENTS.md, Cursor/Copilot, Claude
  skill) and a self-hosted Claude Code plugin.

## In progress

- **[Hardening — trustworthy generated output](https://github.com/rtorcato/js-tooling/milestone/3)**
  — every scaffolded project passes its own `doctor`/lint/build out of the box.
- **[Docs & docs-site](https://github.com/rtorcato/js-tooling/milestone/5)** —
  the docs-site generator and its Phase 2b riders (TypeDoc section, smoke test,
  retro-migrating the sibling repos onto the shared assets).
- **[Repo & release hygiene](https://github.com/rtorcato/js-tooling/milestone/4)**
  — release docs, OIDC trusted publishing, and the Dependabot grouping/auto-merge
  strategy.
- **[Multi-language support](https://github.com/rtorcato/js-tooling/milestone/2)**
  — a language-agnostic base with per-language modules (umbrella
  [#139](https://github.com/rtorcato/js-tooling/issues/139)); the JS core hardens
  first.

## Exploring

- OIDC trusted publishing to retire the long-lived `NPM_TOKEN`
  ([#201](https://github.com/rtorcato/js-tooling/issues/201)).
- Dependabot grouping + auto-merge + major-triage
  ([#111](https://github.com/rtorcato/js-tooling/issues/111)).
- Extracting more shared tooling out of the consumer repos
  ([#161](https://github.com/rtorcato/js-tooling/issues/161)).

## Versioning & stability

The public surface is the **CLI** (`setup`/`doctor`/`fix`/`list`/`copy` and their
JSON contracts) and the **preset exports** (`@rtorcato/js-tooling/*`). Both follow
semver: a breaking change to either is a major bump. The generated *output* is
expected to evolve — re-run `doctor`/`fix` to pick up preset improvements. See
[RELEASING.md](./RELEASING.md) for the release process and the pre-release
checklist.
