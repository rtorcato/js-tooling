# TODO

## Release pipeline

- [ ] **Set up npm Trusted Publishers (OIDC)** — eliminate the long-lived `NPM_TOKEN`. npm needs a trusted publisher config for this package before OIDC works. Docs: https://docs.npmjs.com/trusted-publishers

## Doctor improvements

- [ ] **Lock file** — `setup` writes a `.js-tooling.json` recording what was chosen (linting tool, testing framework, bundler, etc.). `doctor` reads it to know what to expect for that project, so intentional choices (e.g. Jest over Vitest) aren't reported as `not configured`. New tools added to `setup` get a slot in the schema. Scales cleanly as the backlog tools are added.

## Bugs & gaps (wizard offers it but it's broken or missing a preset)

- [ ] **Fix Playwright generator** — `src/cli/generators/testing.ts` uses `devices` without importing it from `@playwright/test`. Also add a proper `tooling/playwright/` preset so the generated config isn't a hardcoded inline string.
- [ ] **Add Vite preset** — wizard offers Vite for `web-app`/`react-app` projects but `src/cli/generators/build.ts` just inlines a hardcoded config string. Add `tooling/vite/vite.config.mjs` and wire the generator to copy it.

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

### Medium value
- [ ] **Cypress** — Major E2E testing alternative alongside Playwright. Add `tooling/cypress/` preset + wizard option.
- [ ] **Tailwind CSS** — Tailwind config preset (`prettier-plugin-tailwindcss` is already in peerDeps). Add `tooling/tailwind/tailwind.config.mjs`.
- [ ] **PostCSS** — Natural companion to Tailwind. Add `tooling/postcss/postcss.config.mjs`.
- [ ] **TypeDoc** — API docs generation for library projects. Config preset + CI step to publish alongside the Astro docs site.
- [ ] **Turborepo** — `turbo.json` preset for teams on pnpm workspaces.
- [ ] **Nx** — Major Turborepo alternative with affected-build model and plugin ecosystem. Worth listing alongside Turborepo.
- [ ] **GitHub Actions templates** — More workflow templates: Docker build+push, Next.js deploy to Vercel/Cloudflare, preview deployments.

### Lower priority
- [ ] **are-the-types-wrong** — Validates TypeScript exports are correct. Good `doctor` subcommand check.
- [ ] **Preset-level versioning** — Let consumers lock to `typescript/base@1` while `typescript/base@2` ships.
