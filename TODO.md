# TODO

Backlog for `@rtorcato/js-tooling` lives on GitHub now:

- **Open issues:** <https://github.com/rtorcato/js-tooling/issues>
- **Tooling preset backlog (umbrella):** [#59](https://github.com/rtorcato/js-tooling/issues/59)

Shipped work lives in [`CHANGELOG.md`](./CHANGELOG.md) and `git log`.

## Currently filed

| # | Title |
|---|---|
| [#54](https://github.com/rtorcato/js-tooling/issues/54) | Docusaurus docs-site helpers: `copy docusaurus-sync-changelog`, theme tokens, doctor check |
| [#55](https://github.com/rtorcato/js-tooling/issues/55) | Add Changesets preset (alternative to semantic-release) |
| [#56](https://github.com/rtorcato/js-tooling/issues/56) | Set up npm Trusted Publishers (OIDC) for releases |
| [#57](https://github.com/rtorcato/js-tooling/issues/57) | Add Oxlint preset |
| [#58](https://github.com/rtorcato/js-tooling/issues/58) | Add optional diff preview to `fix` when overwriting drift |
| [#59](https://github.com/rtorcato/js-tooling/issues/59) | Tooling preset backlog (Release Please, Rollup, Bun, publint, Rolldown, Cypress, Tailwind, PostCSS, Turborepo, Nx, GH Actions templates) |

## Deliberately deferred

- **`@rtorcato/repo-tooling` base package** — Extract language-agnostic concerns (GitHub Actions skeleton, Dependabot, CodeQL, Husky, commitlint, semantic-release-github, CODEOWNERS, LICENSE, SECURITY.md, CONTRIBUTING.md, branch protection) into a standalone package so `js-tooling`, future `swift-tooling`, and future `python-tooling` share one repo-hygiene baseline. Worth doing once a second language ecosystem actually needs it — not before.
