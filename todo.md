# TODO

## Assessment

`@rtorcato/js-tooling` has solid bones — clean `exports` map, well-organized CLI under `src/cli/`, proper semantic-release wiring — but had drifted (~7 months between feature work). The v2.0.0 cleanup pass fixed the inverted dependency split, broken build/typecheck/lint-staged scripts, missing CI gates, and Node-version enforcement. What remains below is the forward-looking backlog.

## 🟡 Package hygiene

- [ ] **Expose or remove undocumented `tooling/` subdirs**: `oxc/`, `tsdown/`, `vellite/`, `rolldown/`, `playwright/`, `nextjs/`, `vite/`. They exist on disk but aren't in `exports` or the README.
- [ ] **Add `types` condition to `exports`** — TS consumers importing `@rtorcato/js-tooling/eslint/base` don't get type hints because no `.d.ts` is emitted alongside the `.mjs`.
- [ ] **Pick a primary lint stance** (Biome OR ESLint) and document it. Both are shipped as presets, but the README doesn't say "pick one".
- [ ] **Fix dead build scripts**: `build-dev` / `build-prod` reference `node build.mjs` but `build.mjs` doesn't exist. Either alias them to `build-cli` or delete them — only `build-cli` is actually used by CI/release.
- [ ] **Pin `typescript-eslint`** — currently `"latest"`, a footgun for reproducible builds.

## 🟡 Documentation gaps

- [ ] README: walk through what `setup` actually does (which configs it writes, prompts it asks).
- [ ] README: document `init`, `copy <name>`, `list`, `commitmessage`, `helloworld` commands.
- [ ] README: add CLI screenshot or asciinema cast.
- [ ] README: link to CHANGELOG + a "What's new" section per minor version.
- [ ] Fill in `tests/README.md` (currently a stub).
- [ ] Add badges: bundle size, monthly downloads, code coverage.
- [ ] One-paragraph "Why this exists" — what does this give me that turborepo's defaults or `@total-typescript/tsconfig` don't?

## 🟢 Testing gaps

- [ ] Add unit tests for each generator under `src/cli/generators/` using a tmp-dir fixture pattern (`fs-extra` is already a dep).
- [ ] Add an e2e smoke test that spawns the CLI in a scratch dir and asserts produced files.
- [ ] Add a coverage threshold in `vitest.config.mjs` (start at something achievable and ratchet up).

## 🟢 Nice-to-haves

- [ ] `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`, `CODEOWNERS`, `SECURITY.md`, `FUNDING.yml`.
- [ ] Dependabot or Renovate config so deps don't go stale again.
- [ ] CI matrix testing across Node 22 + 24.
- [ ] **`npx js-tooling doctor`** subcommand — diagnose an existing project against the presets and report drift. Would be a real differentiator.
- [ ] Knip to surface unused deps/exports.
- [ ] Unified build tool — currently `build.mjs` (esbuild) + `tsc`. Pick `tsup` or `rolldown` (both already shipped as presets) and dogfood it.
- [ ] `docs/` site via GitHub Pages — README is one long scroll.
- [ ] Preset-level versioning — let consumers lock to `typescript/base@1` while `typescript/base@2` ships.

## Suggested order of attack

1. **`tooling/` audit** (1–2 hr): decide which experimental presets stay, document them in the README, add them to `exports`.
2. **Generator tests** (½–1 day): protects the CLI from regressions before adding new generators.
3. **`doctor` subcommand** (1–2 days, optional): the feature most likely to drive real adoption.
