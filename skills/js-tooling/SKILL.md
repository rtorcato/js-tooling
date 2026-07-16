---
name: js-tooling
description: Use when setting up, auditing, or standardizing a JavaScript/TypeScript project that uses @rtorcato/js-tooling — scaffolding via the setup wizard, auditing with doctor, applying fixers, or extending the shared TypeScript/Biome/Vitest/semantic-release config bases. Covers the agent-friendly `--json` / `--yes` CLI surface.
---

# Using @rtorcato/js-tooling

`@rtorcato/js-tooling` is a one-package JavaScript/TypeScript tooling
distribution: a `setup` / `doctor` / `fix` CLI plus shared config **bases**
(TypeScript, Biome, ESLint, Prettier, Vitest, Jest, tsup/esbuild/rollup/vite,
semantic-release, Changesets). Adopt the presets and drive the CLI — this is not
a runtime import surface.

## The CLI is agent-friendly

Every command supports `--json` and a non-interactive mode. `fix --json` implies
`--yes` (a prompt would corrupt JSON).

```bash
# Scaffold a new project (no prompts, no install)
npx @rtorcato/js-tooling setup --preset library -d ./my-lib --skip-install

# Audit an existing repo → structured findings
npx @rtorcato/js-tooling doctor --json -d ./repo

# Apply every fixable finding, then re-audit
npx @rtorcato/js-tooling fix --yes --json -d ./repo
npx @rtorcato/js-tooling doctor --json -d ./repo

# One targeted fixer (targets come from `list --json`)
npx @rtorcato/js-tooling fix dependabot --yes --json
```

Presets for `--preset`: `library`, `web-app`, `node-api`, `nextjs-app`,
`react-app`. For full control, `setup --config-schema` prints the JSON Schema for
`ProjectConfig`; write a config against it and pass `--config <path>`
(`--dry-run` previews the resolved config + file list without writing).

## Rules

1. **Extend the shared bases; don't copy them.** In a consumer repo, reference
   the published config rather than duplicating it, so a base upgrade flows
   through:
   ```jsonc
   // tsconfig.json
   { "extends": "@rtorcato/js-tooling/typescript/base" }
   // biome.json
   { "extends": ["@rtorcato/js-tooling/biome"] }
   ```
   Config subpaths mirror the `exports` map 1:1 — run `list --json` to enumerate
   them.

2. **Let `doctor` decide, `fix` repair.** Don't hand-edit generated config to
   match the standard — run `doctor` to find drift and `fix <target>` to apply
   it. Check names and fix targets are a stable contract (`list --json`).

3. **Respect the drift policy.** `fix` defaults the confirm to **No** for drift
   (an existing file that doesn't extend the preset); `--yes` is required to
   overwrite. Safe-merge fixers (`engines`, `husky`, `package-json`) only
   add/merge, never clobber.

4. **Toolchain is fixed.** pnpm, Node ≥22, ESM-only (`"type": "module"`), Biome
   for lint+format (not ESLint/Prettier by default). Run the gate with
   `pnpm verify` (typecheck + biome + vitest) before pushing.

5. **Releases are automated — see the `npm-publish` skill.** Never run
   `npm publish`, `npm version`, or `git tag`, and never hand-edit the `version`
   field. semantic-release owns it.

## More

- Human docs: https://rtorcato.github.io/js-tooling/
- LLM index: https://rtorcato.github.io/js-tooling/llms.txt
- Repo `AGENTS.md` carries the same guidance for non-Claude tools.
