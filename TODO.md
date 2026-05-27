# TODO

## Release pipeline

- [ ] **Set up npm Trusted Publishers (OIDC)** — eliminate the long-lived `NPM_TOKEN`. npm needs a trusted publisher config for this package before OIDC works. Docs: https://docs.npmjs.com/trusted-publishers

## Bugs & gaps (wizard offers it but it's broken or missing a preset)

- [ ] **Fix Playwright generator** — `src/cli/generators/testing.ts` uses `devices` without importing it from `@playwright/test`. Also add a proper `tooling/playwright/` preset so the generated config isn't a hardcoded inline string.
- [ ] **Add Vite preset** — wizard offers Vite for `web-app`/`react-app` projects but `src/cli/generators/build.ts` just inlines a hardcoded config string. Add `tooling/vite/vite.config.mjs` and wire the generator to copy it.

## Future releases

### High value
- [ ] **Oxlint** — Rust-based linter, 50–100× faster than ESLint. Good add alongside Biome for large codebases, or as a standalone. Export as `./oxlint`.
- [ ] **Changesets** — Popular alternative to semantic-release, especially for monorepos. Add wizard option + `tooling/changesets/` preset.
- [ ] **size-limit** — Enforces bundle size budgets in CI. High value for library authors. Config preset + CI step.
- [ ] **publint** — Validates `package.json` + dist for common npm publishing mistakes. Good `doctor` check candidate too.
- [ ] **Rolldown** — Rust-based next-gen bundler (Vite 6 uses it internally). Add as bundler option once stable API lands.

### Medium value
- [ ] **Tailwind CSS** — Tailwind config preset (`prettier-plugin-tailwindcss` is already in peerDeps). Add `tooling/tailwind/tailwind.config.mjs`.
- [ ] **TypeDoc** — API docs generation for library projects. Config preset + CI step to publish alongside the Astro docs site.
- [ ] **Turborepo** — `turbo.json` preset for teams on pnpm workspaces.
- [ ] **GitHub Actions templates** — More workflow templates: Docker build+push, Next.js deploy to Vercel/Cloudflare, preview deployments.

### Lower priority
- [ ] **are-the-types-wrong** — Validates TypeScript exports are correct. Good `doctor` subcommand check.
- [ ] **Preset-level versioning** — Let consumers lock to `typescript/base@1` while `typescript/base@2` ships.
