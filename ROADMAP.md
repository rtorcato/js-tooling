# Roadmap

The direction for `@rtorcato/js-tooling`. Active work is organized by GitHub
[milestones](https://github.com/rtorcato/js-tooling/milestones) — this file
mirrors them so the roadmap and the tracker don't drift. Version bumps are
automated (semantic-release); the roadmap tracks the **public surface**, not
releases.

## ✅ Shipped

The pre-1.0 foundation, published on npm and dogfooded here:

- `setup` wizard + non-interactive `--preset` / `--config` for JS/TS repos.
- `doctor` drift checks (TypeScript, Biome/ESLint, Prettier, Vitest, Husky,
  semantic-release, GitHub repo settings, and more) with a lockfile record.
- `fix` scaffolders for every check, plus `copy` and `list`.
- Published config bases: TypeScript, Biome, ESLint, Prettier, Vitest/Jest,
  tsup/esbuild/rollup/vite, semantic-release, Changesets, Docusaurus.
- Presets: Turborepo, Tailwind CSS v4.

## 🚧 In progress — pre-1.0 milestones

Tracked one-to-one with the GitHub milestones. Breaking changes may still land
on the `2.x` line while these are open.

- **[Hardening — trustworthy generated output](https://github.com/rtorcato/js-tooling/milestone/3)** —
  fix every case where `setup`/`fix` emits broken or drifted output; lock it in
  with snapshot + integration tests. The tool must be safe on a real repo.
- **[GitHub settings sync](https://github.com/rtorcato/js-tooling/milestone/1)** —
  machine-check and apply repo settings (branch protection, merge, workflow
  perms) via `doctor`/`fix`, closing the prose-only gap.
- **[Repo & release hygiene](https://github.com/rtorcato/js-tooling/milestone/4)** —
  release-pipeline quality (OIDC, Dependabot, branch protection) for this repo.
- **[Multi-language support](https://github.com/rtorcato/js-tooling/milestone/2)** —
  a language-agnostic base + per-language modules (Swift, Perl, Python).
- **[Docs & docs-site](https://github.com/rtorcato/js-tooling/milestone/5)** —
  README, docs-site scaffolding, Docusaurus helpers, shared theme.
- **[Preset backlog](https://github.com/rtorcato/js-tooling/milestone/6)** —
  new tool presets (Bun, Nx, PostCSS, Renovate, more GHA workflows, …).

## 🎯 v1.0 — Stable API

The commitments a `1.0` implies, once the milestones above land:

- Frozen `ProjectConfig` schema + `.js-tooling.json` lockfile format (documented,
  versioned, migrated).
- Stable `doctor` check names and `fix` target names — they're a public contract
  that scripts and CI depend on.
- Stable export subpaths (`@rtorcato/js-tooling/*`).
- SemVer discipline: no breaking changes to the above without a major bump.

---

Have an idea? Open an [issue](https://github.com/rtorcato/js-tooling/issues) and,
if it fits an open milestone, tag it there.
