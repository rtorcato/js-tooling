# Oxlint preset

Shared [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) configuration for projects using `@rtorcato/js-tooling`.

Oxlint is a Rust-based linter that's 50–100× faster than ESLint. It is intentionally **additive** to Biome — Biome handles formatting and the broad lint baseline, Oxlint adds a faster pass for the type-aware and import rules Biome doesn't cover yet.

## Usage

```bash
npx @rtorcato/js-tooling copy oxlint
```

This drops `.oxlintrc.json` at the project root, extending the conventions in this preset. Run it with:

```bash
pnpm oxlint
# or
npx oxlint
```

## Notes

- Oxlint shares its rule catalog with ESLint's plugins (`typescript`, `unicorn`, `oxc`, `import`), so most ESLint rules you know already work here.
- The preset disables Biome-overlapping rules to keep CI noise down — Biome stays the source of truth for formatting and the baseline lint set.
- For projects without Biome, you can run Oxlint standalone and re-enable the `style` and `pedantic` categories.
