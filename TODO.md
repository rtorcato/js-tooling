# TODO

Live backlog for `@rtorcato/js-tooling`. Trim entries as they ship; promote ideas from the bottom as they're picked up.

## Recently shipped (v2.x)

- Unified `verify` script (typecheck + lint + tests) + Husky `pre-push` hook that runs `pnpm verify` (#42)
- Tree-shake verification scaffold via `fix treeshake-check` + setup wizard opt-in for libraries (#43)
- `fix` command — incremental scaffolder application with `--yes` / `--dry-run` / `--json`; drift never auto-overwrites
- `Fixer.riskLevel` so safe-merge fixers (`engines`, `husky`, `package-json`) get friendly prompts instead of the alarming "overwrite" wording
- Doctor checks for Node, `engines.node`, `.editorconfig`, `.nvmrc`, Husky + `lint-staged`, semantic-release, knip, GitHub Actions, GitLab CI, Dependabot, CodeQL
- Doctor "Next steps:" footer naming the exact `fix` command per finding
- `.editorconfig` / `.nvmrc` / `engines.node` / `knip.json` baseline always scaffolded by `setup`
- Setup "Include security automation?" prompt that scaffolds Dependabot + CodeQL workflows
- Setup post-run footer points at `fix <target>` for every capability the user opted out of
- Playwright preset shipped (`./playwright`); generator no longer emits a broken inline config that referenced `devices` without importing it
- Vite preset shipped (`./vite`); generator stubs re-export it (React apps layer the plugin via `mergeConfig`)
- Generators export their internal scaffolders so `fix` reuses them without duplication
- `copyPreset` utility shared by the `copy` command and the `biome` / `tsconfig` fixers

## Release pipeline

- [ ] **Set up npm Trusted Publishers (OIDC)** — eliminate the long-lived `NPM_TOKEN`. npm needs a trusted publisher config for this package before OIDC works. Docs: https://docs.npmjs.com/trusted-publishers

## Doctor / fix improvements

- [ ] **Lock file** — `setup` writes a `.js-tooling.json` recording what was chosen (linting tool, testing framework, bundler, etc.). `doctor` reads it to know what to expect for that project, so intentional choices (e.g. Jest over Vitest) aren't reported as `not configured`. New tools added to `setup` get a slot in the schema.
- [ ] **E2E tests for `fix`** — current tests mock inquirer; an e2e test that spawns `dist/cli/index.js fix dependabot --yes` against a tmp dir would catch wire-up bugs the unit tests miss.
- [ ] **`fix list-targets` (or `fix --list`)** — print the registry without running anything.
- [ ] **Optional diff preview** in `fix` when about to overwrite drift (currently just warns).
- [ ] **`setup --dry-run`** to mirror `fix --dry-run`.

## Coverage gaps

- [ ] **`.gitlab-ci.yml` fixer** — doctor checks it but no `fix gitlab-ci` exists yet.
- [ ] **Renovate config (`renovate.json`)** as an alternative to Dependabot.
- [ ] **`.github/CODEOWNERS` scaffolder**.

## Cleanup

- [ ] Pin `typescript-eslint` (currently `"latest"`).
- [ ] Fill in empty `tests/README.md`.

## Future releases

### High value
- [ ] **Oxlint** — Rust-based linter, 50–100× faster than ESLint. Good add alongside Biome for large codebases, or as a standalone. Export as `./oxlint`.
- [ ] **Changesets** — Popular alternative to semantic-release, especially for monorepos. Add wizard option + `tooling/changesets/` preset.
- [ ] **Release Please** — Google's release tool; changelog-driven rather than commit-message-driven. Popular in open-source projects as a semantic-release alternative.
- [ ] **Rollup** — Still widely used directly for library bundling (Rolldown is the future, but Rollup is the present). Add `tooling/rollup/rollup.config.mjs` + wizard option.
- [ ] **Bun** — Runtime + test runner + bundler. Add: TypeScript config variant for Bun, `bun test` compatible vitest-style preset, `bunfig.toml` template, and wizard support.
- [ ] **size-limit** — Enforces bundle size budgets in CI. High value for library authors. Config preset + CI step.
- [ ] **publint** — Validates `package.json` + dist for common npm publishing mistakes. Good `doctor` check candidate too.
- [ ] **Rolldown** — Rust-based next-gen bundler (Vite 6 uses it internally). Add as bundler option once stable API lands.
- [ ] **`@rtorcato/repo-tooling` base package** — Extract language-agnostic concerns (GitHub Actions skeleton, Dependabot, CodeQL, Husky, commitlint, semantic-release-github, CODEOWNERS, LICENSE, SECURITY.md, CONTRIBUTING.md, branch protection) into a standalone package. `js-tooling`, plus future `swift-tooling` and `python-tooling`, all depend on it so every repo (TS, Swift/iOS, Python) shares the same release + repo-hygiene baseline without duplicating logic per ecosystem.

### Medium value
- [ ] **Cypress** — Major E2E testing alternative alongside Playwright. Add `tooling/cypress/` preset + wizard option.
- [ ] **Tailwind CSS** — Tailwind config preset (`prettier-plugin-tailwindcss` is already in peerDeps). Add `tooling/tailwind/tailwind.config.mjs`.
- [ ] **PostCSS** — Natural companion to Tailwind. Add `tooling/postcss/postcss.config.mjs`.
- [ ] **TypeDoc** — API docs generation for library projects. Config preset + CI step to publish alongside the Astro docs site.
- [ ] **Turborepo** — `turbo.json` preset for teams on pnpm workspaces.
- [ ] **Nx** — Major Turborepo alternative with affected-build model and plugin ecosystem.
- [ ] **GitHub Actions templates** — More workflow templates: Docker build+push, Next.js deploy to Vercel/Cloudflare, preview deployments.

### Lower priority
- [ ] **are-the-types-wrong** — Validates TypeScript exports are correct. Good `doctor` subcommand check.
- [ ] **Preset-level versioning** — Let consumers lock to `typescript/base@1` while `typescript/base@2` ships.


