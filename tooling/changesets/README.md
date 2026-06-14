# Changesets preset

Shared [Changesets](https://github.com/changesets/changesets) configuration for projects using `@rtorcato/js-tooling`.

Changesets is a **monorepo-friendly alternative to semantic-release**. The release workflow is the same shape (CI bumps versions, generates a changelog, publishes to npm), but the *intent* is captured in changeset markdown files at PR time rather than parsed from commit messages.

Pick one — Changesets or semantic-release — per repo. The `doctor` check flags repos configured for both.

## Usage

```bash
npx @rtorcato/js-tooling copy changesets
```

This scaffolds `.changeset/config.json` from this preset. After that:

```bash
pnpm changeset           # interactive — author a changeset for the current change
pnpm changeset version   # consume changesets, bump versions, write CHANGELOG.md
pnpm changeset publish   # publish to npm
```

CI typically runs the [Changesets release bot](https://github.com/changesets/action), which opens a "Version Packages" PR when changesets are present and publishes on merge.

## Why pick this over semantic-release

- **Monorepos** — Changesets handles multi-package version bumps in a way semantic-release doesn't out of the box.
- **Explicit intent** — Authors declare a change's bump level in the changeset file rather than encoding it in commit message conventions, which is more forgiving for human commits.
- **Pre-release flows** — `--snapshot` and `pre enter <tag>` are first-class.

## Why pick semantic-release instead

- **Single-package repos** — Less ceremony; nothing to author per change.
- **Strict conventional-commits discipline already in place.**
- **Existing CI built around the `npm run release` path.**
