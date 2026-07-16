# Roadmap

The direction for `@rtorcato/js-tooling`. Tracked against GitHub
[milestones](https://github.com/rtorcato/js-tooling/milestones); this file and
the milestones should stay in sync. Version bumps are automated
(semantic-release) — the roadmap tracks the **public surface**, not releases.

## ✅ Shipped

The pre-1.0 foundation, published on npm and dogfooded here:

- `setup` wizard + non-interactive `--preset` / `--config` for JS/TS repos.
- `doctor` drift checks (TypeScript, Biome/ESLint, Prettier, Vitest, Husky,
  semantic-release, GitHub repo settings, and more) with a lockfile record.
- `fix` scaffolders for every check, plus `copy` and `list`.
- Published config bases: TypeScript, Biome, ESLint, Prettier, Vitest/Jest,
  tsup/esbuild/rollup/vite, semantic-release, Changesets, Docusaurus.
- Presets: Turborepo, Tailwind CSS v4.

## 🧪 Beta — pre-1.0 preview line

Hardening the surface before committing to a stable API. Breaking changes may
still land on the `2.x` line.

- Dogfood the bases internally and across the sibling fleet ([#148](https://github.com/rtorcato/js-tooling/issues/148)).
- Multi-language base + per-language modules umbrella ([#139](https://github.com/rtorcato/js-tooling/issues/139)).
- Dependabot strategy rollout ([#111](https://github.com/rtorcato/js-tooling/issues/111)).
- npm Trusted Publishing / OIDC migration ([#201](https://github.com/rtorcato/js-tooling/issues/201)).
- Docs-site scaffolding + shared Docusaurus helpers ([#100](https://github.com/rtorcato/js-tooling/issues/100), [#54](https://github.com/rtorcato/js-tooling/issues/54)).

## 🎯 v1.0 — Stable API

The commitments a `1.0` implies:

- Frozen `ProjectConfig` schema + `.js-tooling.json` lockfile format (documented,
  versioned, migrated).
- Stable `doctor` check names and `fix` target names (they're a public contract —
  scripts and CI depend on them).
- Stable export subpaths (`@rtorcato/js-tooling/*`).
- SemVer discipline: no breaking changes to the above without a major bump.

---

Have an idea? Open an [issue](https://github.com/rtorcato/js-tooling/issues) and,
if it fits a phase above, tag it with the matching milestone.
