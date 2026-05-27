# TODO

## Overall assessment

**Verdict: solid bones, drifting.** `@rtorcato/js-tooling` is a thoughtfully-scoped package — clean `exports` map, well-organized CLI (Commander + per-concern generators under `src/cli/generators/`), proper semantic-release wiring, conventional-commits enforced via husky + commitlint. The 18 preset directories under `tooling/` are a real value-add if you want to standardize a polyglot org's JS/TS stack.

**But the repo has drifted since Oct 2025.** The last substantive feature was the CLI setup wizard; everything since (~7 months) has been formatting, CI tweaks, and version bumps. The most recent CI runs on `main` are green, but only because the pipeline was anemic — `typecheck`, `test`, and `build` jobs were all commented out, so `semantic-release` was publishing after only `lint` + `commitlint` passed. On top of that, several concrete bugs would bite a new contributor today: a build script referenced a `tsconfig.build.json` that doesn't exist; the `typecheck` script was named `typecheck1` (typo) and pointed at no config; `lint-staged` ran Biome without the `--config-path` flag every other script uses, so pre-commit hit a different config than CI.

**Strategic concern (now fixed): dependency split was inverted.** Nearly the entire toolchain (esbuild, husky, lint-staged, semantic-release, vitest, playwright, commitizen, biome) used to sit in `dependencies`. That meant anyone installing this package for a single `tsconfig.base` was pulling hundreds of MB they didn't need. This pass rewrote the split so `dependencies` is now just the four packages the CLI actually imports at runtime (`chalk`, `commander`, `fs-extra`, `inquirer`); everything else moved to `devDependencies` (for working on this repo) and optional `peerDependencies` (for consumers using individual presets). **This is a breaking change for downstream consumers** that warrants a v2.0.0 — see "Release note" below.

## ✅ Fixed in this pass

- [x] **Removed broken `tsconfig.build.json` reference** from `build-dev` / `build-prod` in `package.json` — `build-cli` already emits the only TS source.
- [x] **Renamed `typecheck1` → `typecheck`** and pointed at `src/cli/tsconfig.json` (now actually works: `pnpm typecheck` passes).
- [x] **Fixed `lint-staged`** to use `--config-path=tooling/biome/biome.json` for both `lint` and `format`; switched `format` to `--write`; removed the obsolete trailing `git add` (lint-staged ≥v10 stages automatically).
- [x] **Restored the missing `npm install -g` line** in the README install block (was an empty `bash` block with a dangling comment).
- [x] **Untracked `.DS_Store`** (`git rm --cached`). It was already in `.gitignore` but had been committed previously.
- [x] **Uncommented `typecheck`, `test`, `build` jobs** in `.github/workflows/ci.yml`; bumped their `node-version` from `'20'` to `'22'`; added them to the `release` job's `needs:` so a broken build can't publish to npm.
- [x] **Added `engines.node: ">=22"`** to `package.json` (matches CONTRIBUTING.md claim, now enforced).
- [x] **Added `.nvmrc`** with `22` for contributors using nvm/fnm.
- [x] **Rewrote dependency split**: 43 packages in `dependencies` → 4 (`chalk`, `commander`, `fs-extra`, `inquirer`). Everything else is now `devDependencies` for this repo's own tooling, plus optional `peerDependencies` with `peerDependenciesMeta.<pkg>.optional = true` for consumers using specific presets. Consumers no longer pull the whole toolchain transitively.
- [x] **Removed legacy `husky.hooks` block** from `package.json` (v4 syntax, no-op alongside the v9 `.husky/` directory).
- [x] **Added `pnpm-workspace.yaml`** with `allowBuilds.esbuild: true` so pnpm 11+ doesn't gate the install on esbuild's postinstall script.

## Release note for v2.0.0 (when shipping the dep-split change)

The dependency split rewrite is a **breaking change** for downstream consumers. Use this in the release commit footer so semantic-release picks it up:

```
BREAKING CHANGE: 39 packages moved from `dependencies` to `peerDependencies`
(optional). Consumers now install only the presets they use. If you were
relying on transitive installs of e.g. `vitest` or `@biomejs/biome` via this
package, add them to your own devDependencies.
```

## 🟡 Package hygiene (still TODO)

- [ ] **Expose or remove undocumented `tooling/` subdirs**: `oxc/`, `tsdown/`, `vellite/`, `rolldown/`, `playwright/`, `nextjs/`, `vite/`. Currently they exist on disk but aren't in the `exports` map and aren't in the README — confusing.
- [ ] **Add `types` condition to `exports`** — TS consumers importing `@rtorcato/js-tooling/eslint/base` don't get type hints because no `.d.ts` is emitted alongside the `.mjs`.
- [ ] **Pick a primary lint stance** (Biome OR ESLint) and document it. Currently both are shipped as presets which is intentional, but the README doesn't say "pick one" so naive consumers may install both.
- [ ] **Fix dead build scripts**: `build-dev`/`build-prod` reference `node build.mjs` but `build.mjs` doesn't exist at the repo root. Either alias them to `build-cli` or delete them. Only `build-cli` is actually used by CI/release.
- [ ] **Pin `typescript-eslint`** — currently `"latest"`, which is a footgun for reproducible builds.

## 🟡 Documentation gaps

- [ ] README: walk through what `setup` actually does (which configs it writes, prompts it asks).
- [ ] README: document `init`, `copy <name>`, `list`, `commitmessage`, `helloworld` commands.
- [ ] README: add CLI screenshot or asciinema cast.
- [ ] README: link to CHANGELOG + a "What's new" section per minor version.
- [ ] Fill in `tests/README.md` (currently 1 line, 41 bytes).
- [ ] Add badges: bundle size (bundlephobia), monthly downloads, code coverage.
- [ ] Drop a one-paragraph "Why this exists" — what does this give me that turborepo's defaults or `@total-typescript/tsconfig` don't?

## 🟢 Testing gaps

- [ ] Add unit tests for each generator under `src/cli/generators/` using a tmp-dir fixture pattern (`fs-extra` is already a dep, makes this easy). The generators touch users' filesystems — currently 0% covered.
- [ ] Add an e2e smoke test that spawns the CLI in a scratch dir and asserts produced files.
- [ ] Add a coverage threshold in `vitest.config.mjs` (start at something achievable like 30% and ratchet up).

## 🟢 Nice-to-haves

- [ ] `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`, `CODEOWNERS`, `SECURITY.md`, `FUNDING.yml`.
- [ ] Dependabot or Renovate config so deps don't go stale again.
- [ ] **CI matrix testing** across Node 22 + 24 (and whatever LTS lands next).
- [ ] **`npx js-tooling doctor`** subcommand — diagnoses an existing project against the presets and reports drift. This would be a real differentiator.
- [ ] **Knip** to surface unused deps/exports. Given how big `dependencies` is, it'll find a lot.
- [ ] Unified build tool — currently `build.mjs` (esbuild) + `tsc`. Pick `tsup` or `rolldown` (both already shipped as presets) and dogfood it.
- [ ] `docs/` site via GitHub Pages — README is one long scroll and discoverability of individual presets suffers.
- [ ] Preset-level versioning — would let consumers lock to `typescript/base@1` while you ship `typescript/base@2` in the same package.

## Suggested order of attack

1. **`pnpm install`** to refresh the lockfile after `package.json` edits.
2. **Verify CI green on the next push** — the three previously-disabled jobs will run for real.
3. **`tooling/` audit** (1–2 hr): decide which experimental presets stay, document them in the README, add them to `exports`.
4. **Dependency split** (½ day): the highest-leverage item but needs a v2 bump and a changelog note.
5. **Generator tests** (½–1 day): protects the CLI from regressions before adding new generators.
6. **`doctor` subcommand** (1–2 days, optional): the feature most likely to drive real adoption.
