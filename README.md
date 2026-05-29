# js-tooling

![js-common banner](./banner.jpeg)

JavaScript and TypeScript tooling for Node.js, React, Next.js, and Vitest.

[![CI](https://github.com/rtorcato/js-tooling/actions/workflows/ci.yml/badge.svg)](https://github.com/rtorcato/js-tooling/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@rtorcato%2Fjs-tooling.svg)](https://badge.fury.io/js/@rtorcato%2Fjs-tooling)
[![npm downloads](https://img.shields.io/npm/dm/@rtorcato%2Fjs-tooling)](https://www.npmjs.com/package/@rtorcato/js-tooling)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/@rtorcato/js-tooling)](https://bundlephobia.com/package/@rtorcato/js-tooling)
[![Coverage](https://codecov.io/gh/rtorcato/js-tooling/branch/main/graph/badge.svg)](https://codecov.io/gh/rtorcato/js-tooling)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Most tooling libraries give you one piece — just TypeScript configs, or just an ESLint preset. **js-tooling** covers the entire lifecycle: TypeScript, Biome/ESLint, Vitest/Jest, Commitlint, Husky, Semantic Release, GitHub Actions CI, and supply-chain security (Dependabot + CodeQL) — all wired together. The interactive `setup` wizard scaffolds everything in one shot; `doctor` checks an existing project for drift; `fix` applies the missing pieces incrementally.

**[Full documentation →](https://rtorcato.github.io/js-tooling/)**

## Quick start

```bash
npx @rtorcato/js-tooling setup
```

## What's new

See [CHANGELOG.md](CHANGELOG.md) for the full history.

**v2.4.0** — New `fix` command applies scaffolders for items `doctor` flags, with `--yes` and `--dry-run` flags. Drift never auto-overwrites — every existing file you'd lose is confirmed first. Doctor grew checks for `engines.node`, `.editorconfig`, `.nvmrc`, Husky, `lint-staged`, semantic-release, knip, GitHub Actions, GitLab CI, Dependabot, and CodeQL — plus a `Next steps:` footer that names the exact `fix` command to run for each finding. Setup wizard adds a "Include security automation?" prompt for Dependabot + CodeQL.

**v2.0.0** — All 39 tool packages moved from `dependencies` to `peerDependencies`. Add them to your own `devDependencies`. Also ships: `doctor` subcommand, generator unit tests, Dependabot, CI matrix (Node 22 + 24).

**v1.1.0** — Stricter commitlint limits, fix for CLI path resolution when copying configs.

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
