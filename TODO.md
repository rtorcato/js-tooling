# TODO

## Assessment

`@rtorcato/js-tooling` has solid bones — clean `exports` map, well-organized CLI under `src/cli/`, proper semantic-release wiring — but had drifted (~7 months between feature work). The v2.0.0 cleanup pass fixed the inverted dependency split, broken build/typecheck/lint-staged scripts, missing CI gates, and Node-version enforcement. What remains below is the forward-looking backlog.

## 🔴 Release pipeline

- [ ] **Rotate `NPM_TOKEN`** — current secret in GitHub Actions is invalid (`EINVALIDNPMTOKEN 401`), blocking the v2.0.0 release. Generate a fresh Automation token at https://www.npmjs.com/settings/rtorcato/tokens with publish access on `@rtorcato/*`, then update `Settings → Secrets and variables → Actions → NPM_TOKEN`.
- [ ] **Re-run the failed release workflow** once `NPM_TOKEN` is fixed (Actions UI → failed run → Re-run all jobs). Commits since v1.1.0 still contain the `BREAKING CHANGE:` footer, so semantic-release will publish v2.0.0.
- [ ] **Set up npm Trusted Publishers (OIDC)** to eliminate long-lived tokens entirely. The current release attempt tried OIDC first (`OIDC token exchange ... 404 package not found`) — npm needs a trusted publisher config for this package. Docs: https://docs.npmjs.com/trusted-publishers. Once configured, drop `NPM_TOKEN` from Actions.
- [x] **Document the release secrets** — see [`RELEASING.md`](RELEASING.md) for `NPM_TOKEN` rotation, OIDC trusted-publisher setup, and re-run procedure.

## 🟡 Package hygiene

- [x] **Expose or remove undocumented `tooling/` subdirs**: removed `oxc/`, `tsdown/`, `vellite/`, `rolldown/`, `rollup/`, `playwright/`, `nextjs/`, `vite/` — all empty placeholders, not in `exports`.
- [x] **Add `types` condition to `exports`** — `.d.mts` files written for every `.mjs` preset (eslint, prettier, vitest, commitlint, semantic-release, jest-presets, esbuild) and `exports` updated with conditional `types`/`import` map.
- [ ] **Pick a primary lint stance** (Biome OR ESLint) and document it. Both are shipped as presets, but the README doesn't say "pick one".
- [x] **Fix dead build scripts**: removed broken `build-dev`/`build-prod` (referenced non-existent `build.mjs`); added a `build` alias to `build-cli`.
- [x] **Pin `typescript-eslint`** — pinned to `^8.60.0` (was `"latest"`).

## 🟡 Documentation gaps

- [ ] README: walk through what `setup` actually does (which configs it writes, prompts it asks).
- [ ] README: document `init`, `copy <name>`, `list`, `commitmessage`, `helloworld` commands.
- [ ] README: add CLI screenshot or asciinema cast.
- [ ] README: link to CHANGELOG + a "What's new" section per minor version.
- [x] Fill in `tests/README.md` — covers layout, run commands, and the tmp-dir fixture pattern.
- [ ] Add badges: bundle size, monthly downloads, code coverage.
- [ ] One-paragraph "Why this exists" — what does this give me that turborepo's defaults or `@total-typescript/tsconfig` don't?

## 🟢 Testing gaps

- [~] Add unit tests for each generator under `src/cli/generators/` using a tmp-dir fixture pattern. Covered so far: `tsconfig`, `linting`, `testing`, `git` (18 tests via `tests/helpers/tmp-dir.ts`). Remaining: `package-json`, `readme`, `build`, `github-actions`.
- [ ] Add an e2e smoke test that spawns the CLI in a scratch dir and asserts produced files.
- [x] Add a coverage threshold in `vitest.config.mjs` — set to 25% statements/lines, 40% functions, 17% branches (current floor). Switched provider to v8. Ratchet up as more generators get tested.

## 🟢 Nice-to-haves

- [ ] `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`, `CODEOWNERS`, `SECURITY.md`, `FUNDING.yml`.
- [x] Dependabot config added — weekly npm + github-actions updates, grouped (eslint, semantic-release, types).
- [x] CI matrix testing across Node 22 + 24 — test job runs on both versions; install is fresh per matrix instance.
- [x] **`npx js-tooling doctor`** subcommand — diagnoses an existing project against the presets, reports `ok`/`drift`/`missing`/`not configured` per check (TypeScript, Biome, ESLint, Prettier, Vitest, Commitlint, package.json), exits non-zero on drift, supports `--json`. Covered by 6 unit tests.
- [ ] Knip to surface unused deps/exports.
- [ ] Unified build tool — currently `build.mjs` (esbuild) + `tsc`. Pick `tsup` or `rolldown` (both already shipped as presets) and dogfood it.
- [ ] `docs/` site via GitHub Pages — README is one long scroll.
- [ ] Preset-level versioning — let consumers lock to `typescript/base@1` while `typescript/base@2` ships.

## Suggested order of attack

1. ~~**`tooling/` audit**~~ — done; empty placeholder dirs removed.
2. **Generator tests** — in progress; 4 of 8 generators covered. Finish: `package-json`, `readme`, `build`, `github-actions`.
3. ~~**`doctor` subcommand**~~ — MVP shipped; check coverage can grow (e.g., husky hooks, GitHub Actions workflow).
