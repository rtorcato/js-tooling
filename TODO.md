# TODO

## Release pipeline

- [ ] **Set up npm Trusted Publishers (OIDC)** — eliminate the long-lived `NPM_TOKEN`. npm needs a trusted publisher config for this package before OIDC works. Docs: https://docs.npmjs.com/trusted-publishers

## Documentation

- [ ] Add CLI screenshot or asciinema cast to the docs site.
- [ ] Add badges: bundle size, code coverage.

## Nice-to-haves

- [ ] Unified build tool — currently esbuild + tsc. Dogfood `tsup` or `rolldown` (both shipped as presets).
- [ ] Preset-level versioning — let consumers lock to `typescript/base@1` while `typescript/base@2` ships.
