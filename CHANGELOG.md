# [2.6.0](https://github.com/rtorcato/js-tooling/compare/v2.5.1...v2.6.0) (2026-05-28)


### Features

* **cli:** add list --json with exports and fixTarget ([bc27a19](https://github.com/rtorcato/js-tooling/commit/bc27a191a20409f129f2b41daed7a3c994668735))
* **setup:** support non-interactive scaffolding via flags ([78b1738](https://github.com/rtorcato/js-tooling/commit/78b17387331dc801b29c669de9e3520ec030a3e2))

## [2.5.1](https://github.com/rtorcato/js-tooling/compare/v2.5.0...v2.5.1) (2026-05-28)


### Bug Fixes

* **fix:** safe-merge wording for safe fixers ([5cb2fdc](https://github.com/rtorcato/js-tooling/commit/5cb2fdcff9d8cd65b339fc6c55c70e18859a745d))
* **playwright:** ship preset, stop inlining config ([1c09050](https://github.com/rtorcato/js-tooling/commit/1c090507f8e806d7909b0db005a211c1c26b74c0))
* **vite:** ship preset, stop inlining config ([7da4e77](https://github.com/rtorcato/js-tooling/commit/7da4e774a4431177bce0a0210890f46311cb5a96))

# [2.5.0](https://github.com/rtorcato/js-tooling/compare/v2.4.0...v2.5.0) (2026-05-28)


### Features

* **cli:** expand list output + wire fix --json ([9481c3a](https://github.com/rtorcato/js-tooling/commit/9481c3aaea5b712f20b7c4d0526420cea3bcc2c4))
* **fix:** add --json flag for CI / scripting ([a653305](https://github.com/rtorcato/js-tooling/commit/a65330574ad79c2a4b4adad2d2080041df904df4))
* **setup:** suggest fix for skipped tooling ([ddf3b9a](https://github.com/rtorcato/js-tooling/commit/ddf3b9a88bb513da9a93b2949f77330dae2adcd0))

# [2.4.0](https://github.com/rtorcato/js-tooling/compare/v2.3.0...v2.4.0) (2026-05-28)


### Features

* **cli:** add fix command ([35f4b2d](https://github.com/rtorcato/js-tooling/commit/35f4b2d8863306b01659fb959f48de3703d12e0c))
* **doctor:** add Dependabot and CodeQL checks ([6905fea](https://github.com/rtorcato/js-tooling/commit/6905feac48eb847b444fc566bacdbb136d090e31))
* **doctor:** add fix-suggestion footer ([ec6321a](https://github.com/rtorcato/js-tooling/commit/ec6321a1156ef260ed53198e8806d7b9e61a78d1))
* **generators:** add security + misc scaffolders ([3e8f299](https://github.com/rtorcato/js-tooling/commit/3e8f29977e1369ab63bd0e732a5668b5bec40748))

# [2.3.0](https://github.com/rtorcato/js-tooling/compare/v2.2.0...v2.3.0) (2026-05-28)


### Features

* **doctor:** add 9 new project checks ([e6d46c5](https://github.com/rtorcato/js-tooling/commit/e6d46c56e72c0336fe2ba2acad37b33627087503))

# [2.2.0](https://github.com/rtorcato/js-tooling/compare/v2.1.2...v2.2.0) (2026-05-27)


### Features

* **doctor:** add Node version check ([731be36](https://github.com/rtorcato/js-tooling/commit/731be36d8c10e8cde734b58f69fb6ce4a0d25a80))

## [2.1.2](https://github.com/rtorcato/js-tooling/compare/v2.1.1...v2.1.2) (2026-05-27)


### Bug Fixes

* **deps:** trim unused peer dependencies ([c8b3bc8](https://github.com/rtorcato/js-tooling/commit/c8b3bc8eabe4c46896fa94c3a7008354964544de))

## [2.1.1](https://github.com/rtorcato/js-tooling/compare/v2.1.0...v2.1.1) (2026-05-27)


### Bug Fixes

* **deps:** widen esbuild peer range for vite 8 ([f87c88b](https://github.com/rtorcato/js-tooling/commit/f87c88bae2852092aecf65f869e448b386cb276d))
* export vitest/react and vitest/setup, drop phantom biome.jsonc, add missing doc pages ([f7ae710](https://github.com/rtorcato/js-tooling/commit/f7ae71041fd1aaa5715cf99866ba1fa8768eb8ab))

# [2.1.0](https://github.com/rtorcato/js-tooling/compare/v2.0.0...v2.1.0) (2026-05-27)


### Features

* add types condition to preset exports ([1d3c4dd](https://github.com/rtorcato/js-tooling/commit/1d3c4dd8e2929e61dc2e3f9f10a786570f807559))
* **cli:** add doctor subcommand ([a71c63e](https://github.com/rtorcato/js-tooling/commit/a71c63ec1ec668cb85390477ffdb604b7209cb8d))

# [2.0.0](https://github.com/rtorcato/js-tooling/compare/v1.1.0...v2.0.0) (2026-05-27)


* feat!: rewrite deps to peer-deps, fix CI + scripts ([c330ded](https://github.com/rtorcato/js-tooling/commit/c330dedc857da700d7e0b154cbde24e713fb59e6))


### Bug Fixes

* **ci:** pass commit msg via env, rename TODO ([5bc6b96](https://github.com/rtorcato/js-tooling/commit/5bc6b96c1233d21e5c63d26aef808a5c9c109757))


### BREAKING CHANGES

* 39 packages moved from dependencies to
peerDependencies (optional). Consumers relying on transitive
installs of e.g. vitest or @biomejs/biome via this package must
add them to their own devDependencies.

# [1.1.0](https://github.com/rtorcato/js-tooling/compare/v1.0.9...v1.1.0) (2025-10-24)


### Bug Fixes

* correct CLI path resolution for config copying ([08bc2d3](https://github.com/rtorcato/js-tooling/commit/08bc2d36d5e7ed81730562f859a0690b2904f8b3))


### Features

* enforce stricter commit message limits ([f048600](https://github.com/rtorcato/js-tooling/commit/f04860048a9449de86d3684a6ab729e3728377ef))

## [1.0.9](https://github.com/rtorcato/js-tooling/compare/v1.0.8...v1.0.9) (2025-10-24)


### Bug Fixes

* improve skip CI detection regex pattern ([f29294b](https://github.com/rtorcato/js-tooling/commit/f29294bfa7f56d047923c4cecde09746ed4593ad))

## [1.0.8](https://github.com/rtorcato/js-tooling/compare/v1.0.7...v1.0.8) (2025-10-24)


### Bug Fixes

* improve commitlint validation in CI environment ([727fe98](https://github.com/rtorcato/js-tooling/commit/727fe98ccefb1eaba188515ee7de0fabe1530a2b))

## [1.0.7](https://github.com/rtorcato/js-tooling/compare/v1.0.6...v1.0.7) (2025-10-24)


### Bug Fixes

* add npm provenance and optimize workflow structure ([86f0bc4](https://github.com/rtorcato/js-tooling/commit/86f0bc408f472e437049cd1da7b0b8ccce5f8fc9))
* enhance config management and add CLI copy command ([36f973e](https://github.com/rtorcato/js-tooling/commit/36f973e3ef223bf19dcdc447227b0ed24d010b96))

## [1.0.6](https://github.com/rtorcato/js-tooling/compare/v1.0.5...v1.0.6) (2025-10-24)


### Bug Fixes

* prevent Husky setup failure in CI environment ([d40caf0](https://github.com/rtorcato/js-tooling/commit/d40caf01d453349843653b8f50579138131c3e55))

## [1.0.5](https://github.com/rtorcato/js-tooling/compare/v1.0.4...v1.0.5) (2025-10-24)


### Bug Fixes

* republish package after unpublished version conflict ([15b3ad4](https://github.com/rtorcato/js-tooling/commit/15b3ad460db9c49848fbc0c0dd564404f7e1b694))

## [1.0.4](https://github.com/rtorcato/js-tooling/compare/v1.0.3...v1.0.4) (2025-10-24)


### Bug Fixes

* trigger release with updated NPM automation token ([5f99afe](https://github.com/rtorcato/js-tooling/commit/5f99afe0b7b2a52bab947184521063278617c4cd))

## [1.0.3](https://github.com/rtorcato/js-tooling/compare/v1.0.2...v1.0.3) (2025-10-24)


### Bug Fixes

* ensure package publishing works after GitLab migration ([c53937d](https://github.com/rtorcato/js-tooling/commit/c53937d10697e090fd605819a0c74792c9836a60))

## [1.0.2](https://github.com/rtorcato/js-tooling/compare/v1.0.1...v1.0.2) (2025-10-24)


### Bug Fixes

* handle ignored files in fix-bins.sh script ([41b43c9](https://github.com/rtorcato/js-tooling/commit/41b43c90d76d35f8f9c3da71f0ad81a3ab03ecc6))
* remove non-existent dist assets from GitHub release ([d94a16f](https://github.com/rtorcato/js-tooling/commit/d94a16f720157c23c35cc83cc63e2bcf2bba2182))

## [1.0.1](https://github.com/rtorcato/js-tooling/compare/v1.0.0...v1.0.1) (2025-10-24)


### Bug Fixes

* add CLI build step to release workflow ([e10078a](https://github.com/rtorcato/js-tooling/commit/e10078aa9312e36c495ef1b8f6d433400b01576c))

# 1.0.0 (2025-10-24)


### Bug Fixes

* add docker semantic release ([61238ac](https://github.com/rtorcato/js-tooling/commit/61238ac79d99497200f183b1cc1b54714c7d4f7d))
* apply Biome formatting and disable problematic linting rules ([7d6914c](https://github.com/rtorcato/js-tooling/commit/7d6914cde952ae2fbe8e66680e1023bf234c5c74))
* for changelog release ([efb176d](https://github.com/rtorcato/js-tooling/commit/efb176dc2e2a2c94cf25b6ddcdff95f4bd97b274))
* initial release ([22fa31f](https://github.com/rtorcato/js-tooling/commit/22fa31fcff83bb0b5e33b1bb1e57e72a8d295932))
* initial release ([20588c9](https://github.com/rtorcato/js-tooling/commit/20588c91e9a94bac14c40d1c8b7b80b3e56d0875))
* initial release ([2fe80a7](https://github.com/rtorcato/js-tooling/commit/2fe80a745942f6e1d3043cfca1e960a97bf1cf8a))
* initial release ([6937aef](https://github.com/rtorcato/js-tooling/commit/6937aefa0a958ce01a47a609f250e45b2ebd339b))
* initial release ([3e00412](https://github.com/rtorcato/js-tooling/commit/3e00412c6b3524dafae96ab142d3941a43e23697))
* initial release ([61b61c1](https://github.com/rtorcato/js-tooling/commit/61b61c173d224ba096dff0616caa8826d79b537c))
* new release ([16aa21d](https://github.com/rtorcato/js-tooling/commit/16aa21d56ea97a09876dcb2cb60c6cac0229e578))
* new release ([767cb65](https://github.com/rtorcato/js-tooling/commit/767cb65cd15c0aa39bd395d4d17e4cd6b5aef8bb))
* new release ([ca8ac5a](https://github.com/rtorcato/js-tooling/commit/ca8ac5a35cd9f39791544cbd0ec23639f51907ad))
* ts base update ([c309126](https://github.com/rtorcato/js-tooling/commit/c30912693e017c57e0f000b8f7e9542d356d3010))
* update Node.js version to 22 for semantic-release compatibility ([b5ab497](https://github.com/rtorcato/js-tooling/commit/b5ab497f988d369e7ed0adb015c08cd41f36fe51))
* update ts ([728e386](https://github.com/rtorcato/js-tooling/commit/728e386479d9ba43298f333ce631dcfe6db02497))
* update ts base config ([2943996](https://github.com/rtorcato/js-tooling/commit/2943996fc322cd903ccfd8912550cbed8c880edf))
* vitest resolve ([78cd367](https://github.com/rtorcato/js-tooling/commit/78cd36779cbc74b024adc0738036ce99795ebf5a))


### Features

* add CLI with project setup wizard and migrate to GitHub ([73b81bc](https://github.com/rtorcato/js-tooling/commit/73b81bc44e435ace0e35b4732124d00e082fd20b))

---

*Changelog entries prior to v1.0.0 have been removed as part of the migration from GitLab to GitHub.*
