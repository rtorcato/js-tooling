---
name: npm-publish
description: >-
  Use when releasing or publishing any @rtorcato/* package, cutting a version,
  or writing commit messages intended to trigger a release. Releases are fully
  automated via semantic-release + Conventional Commits — never run
  `npm publish` or bump the version in package.json by hand.
---

# Publishing an @rtorcato/* package

Every package in the family releases the same way: **you don't publish, commits
do.** `semantic-release` runs in CI on merge to `main`, derives the next version
from commit messages, updates the changelog, tags, creates a GitHub release, and
publishes to npm (`publishConfig.access: "public"`).

## The version comes from the commit message

Conventional Commits are enforced by husky + commitlint, and they drive the
version bump:

- `fix: …` → patch (`1.2.0` → `1.2.1`)
- `feat: …` → minor (`1.2.0` → `1.3.0`)
- `feat!: …` or a `BREAKING CHANGE:` footer → major (`1.2.0` → `2.0.0`)
- `chore:`, `docs:`, `refactor:`, `test:`, `ci:` → no release

So the way to ship a change is to phrase the commit correctly, not to touch the
version field. semantic-release owns `version` in package.json — editing it by
hand causes drift and merge conflicts.

## Before you push

Run the family's gate locally; CI runs the same thing and a red build blocks the
release:

```bash
pnpm verify   # typecheck + biome check + vitest run  (some repos also add treeshake)
```

Then commit with a conventional message and open the PR:

```bash
git commit -m "feat: add createKvStore batch get"
```

On merge to `main`, semantic-release does the rest. Don't run `npm version`,
`npm publish`, or `git tag` manually — they fight the automation.

## House conventions (consistent across the family)

- Package manager: **pnpm**, Node **≥22**, ESM-only (`"type": "module"`).
- Lint/format: **Biome** (`pnpm check` / `pnpm check:fix`), not ESLint/Prettier.
- Build: **tsup** (or a `build.mjs` esbuild script) emitting `dist/` with `.d.ts`.
- Public API is the `exports` map only — never add deep-import paths into `dist`.
- New public surface ships with strict types + JSDoc and a matching update to the
  co-located SKILL.md in the **same PR**.
