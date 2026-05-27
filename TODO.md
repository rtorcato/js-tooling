# TODO

## Release pipeline

- [ ] **Set up npm Trusted Publishers (OIDC)** — eliminate the long-lived `NPM_TOKEN`. npm needs a trusted publisher config for this package before OIDC works. Docs: https://docs.npmjs.com/trusted-publishers

## Nice-to-haves

- [ ] Preset-level versioning — let consumers lock to `typescript/base@1` while `typescript/base@2` ships.
