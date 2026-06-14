# TODO

Backlog for `@rtorcato/js-tooling` lives on GitHub:

- **Open issues:** <https://github.com/rtorcato/js-tooling/issues>

Shipped work lives in [`CHANGELOG.md`](./CHANGELOG.md) and `git log`.

## Currently filed

### CLI / pipeline

| # | Title |
|---|---|
| [#56](https://github.com/rtorcato/js-tooling/issues/56) | Set up npm Trusted Publishers (OIDC) for releases |
| [#58](https://github.com/rtorcato/js-tooling/issues/58) | Add optional diff preview to `fix` when overwriting drift |
| [#54](https://github.com/rtorcato/js-tooling/issues/54) | Docusaurus docs-site helpers (`copy docusaurus-sync-changelog`, theme tokens, doctor check) |

### Tooling presets

| # | Title |
|---|---|
| [#55](https://github.com/rtorcato/js-tooling/issues/55) | Changesets (release tool, alternative to semantic-release) |
| [#57](https://github.com/rtorcato/js-tooling/issues/57) | Oxlint (linter, additive to Biome) |
| [#60](https://github.com/rtorcato/js-tooling/issues/60) | Bun (runtime + test runner + bundler) |
| [#61](https://github.com/rtorcato/js-tooling/issues/61) | Rolldown bundler (gated on v1) |
| [#62](https://github.com/rtorcato/js-tooling/issues/62) | Nx monorepo orchestrator |
| [#63](https://github.com/rtorcato/js-tooling/issues/63) | Tailwind CSS |
| [#64](https://github.com/rtorcato/js-tooling/issues/64) | Release Please (release tool) |
| [#65](https://github.com/rtorcato/js-tooling/issues/65) | PostCSS |
| [#66](https://github.com/rtorcato/js-tooling/issues/66) | More GitHub Actions workflow templates (Docker, Vercel, Cloudflare, previews) |
| [#67](https://github.com/rtorcato/js-tooling/issues/67) | Cypress E2E (peer to Playwright) |
| [#68](https://github.com/rtorcato/js-tooling/issues/68) | Turborepo |
| [#69](https://github.com/rtorcato/js-tooling/issues/69) | publint |
| [#70](https://github.com/rtorcato/js-tooling/issues/70) | Rollup bundler |

## Deliberately deferred

- **`@rtorcato/repo-tooling` base package** — Extract language-agnostic concerns (GitHub Actions skeleton, Dependabot, CodeQL, Husky, commitlint, semantic-release-github, CODEOWNERS, LICENSE, SECURITY.md, CONTRIBUTING.md, branch protection) into a standalone package so `js-tooling`, future `swift-tooling`, and future `python-tooling` share one repo-hygiene baseline. Worth doing once a second language ecosystem actually needs it — not before.
