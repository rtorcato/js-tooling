# AGENTS.md

Orientation for coding agents working with `@rtorcato/js-tooling`. Human-readable docs live at https://rtorcato.github.io/js-tooling/.

## What this is

A one-package JavaScript / TypeScript tooling distribution. Ships every preset (TypeScript, Biome, ESLint, Prettier, Vitest, Jest, Commitlint, semantic-release, tsup, esbuild, Vite, Playwright) plus a CLI to scaffold and audit projects. Consumers get one install.

## CLI surface (agent-friendly)

Every command supports `--json` and a non-interactive mode. Combine with `--yes` for fully autonomous use.

| Command | Non-interactive | JSON output | Use case |
|---|---|---|---|
| `setup --preset <name>` | ✅ | `--dry-run` only | Scaffold a new project. Presets: `library`, `web-app`, `node-api`, `nextjs-app`, `react-app`. |
| `setup --config <path>` | ✅ | `--dry-run` only | Scaffold with a full `ProjectConfig` JSON file. See `setup --config-schema`. |
| `setup --config-schema` | ✅ | ✅ (JSON Schema) | Print the JSON Schema for `ProjectConfig`. Use to validate configs before scaffolding. |
| `setup --dry-run` | ✅ | ✅ | Print resolved config + file list without writing. Pair with `--preset` or `--config`. |
| `doctor --json` | ✅ | ✅ | Audit a project. Returns `{ directory, results: [{ check, status, detail, hint? }] }`. Status: `ok` / `drift` / `missing` / `optional-missing`. |
| `fix --json --yes` | ✅ | ✅ | Walk every doctor finding, apply fixers. Returns `FixActionRecord[]` with `status: applied | dry-run | skipped | already-ok | unsupported`. |
| `fix <target> --json --yes` | ✅ | ✅ | Apply one fixer. Targets from `list --json`. |
| `fix --dry-run` | ✅ | ✅ | Print what each fixer would write without writing. Combine with `--json`. |
| `list --json` | ✅ | ✅ | Enumerate the library's surface area. Each entry has `{ name, description, exports, fixTarget }`. |
| `copy <name>` | ✅ | text only | Copy a single preset (`biome`, `tsconfig`) into the current directory. |

## Recommended workflows

### Scaffolding a new project from scratch

```bash
npx @rtorcato/js-tooling setup --preset library -d ./my-lib --skip-install
```

For full control:

```bash
# 1. Get the schema
npx @rtorcato/js-tooling setup --config-schema > project-config.schema.json

# 2. Write a config matching it
cat > project.json <<EOF
{
  "projectName": "my-lib",
  "projectType": "library",
  "typescript": {"enabled": true, "config": "base"},
  "linting": {"tool": "biome"},
  "formatting": {"tool": "biome"},
  "testing": {"framework": "vitest", "environment": "node"},
  "gitHooks": true,
  "commitLint": true,
  "semanticRelease": true,
  "securityAutomation": true,
  "bundler": "tsup"
}
EOF

# 3. Preview, then scaffold
npx @rtorcato/js-tooling setup --config project.json --dry-run
npx @rtorcato/js-tooling setup --config project.json -d ./my-lib --skip-install
```

### Auditing an existing project

```bash
# Get findings
npx @rtorcato/js-tooling doctor --json -d ./existing-repo > doctor.json

# Apply every fixable finding (no prompts, no surprises)
npx @rtorcato/js-tooling fix --yes --json -d ./existing-repo > applied.json

# Re-audit to confirm clean
npx @rtorcato/js-tooling doctor --json -d ./existing-repo
```

### Targeted fixes

```bash
# Apply one fixer from the list
npx @rtorcato/js-tooling fix dependabot --yes --json
npx @rtorcato/js-tooling fix engines --yes --json
```

## Drift policy (important)

`fix` defaults the confirm prompt to **No** for drift cases (existing file that doesn't extend our preset). The `--yes` flag is required to overwrite drift. Safe-merge fixers (`engines`, `husky`, `package-json`) never overwrite — they add/merge — and use friendlier prompt wording. `fix --json` implies `--yes` (prompts would corrupt JSON output).

## Source-of-truth files in the repo

- `src/cli/commands/setup.ts` — `ProjectConfig` interface and the setup orchestrator
- `src/cli/commands/setup-presets.ts` — preset definitions, JSON Schema, config validator, `computeFileList`
- `src/cli/commands/doctor.ts` — all checks and the public `runDoctor(dir)` / `evaluateNodeVersion(version)` / `nextStepSuggestions(results)`
- `src/cli/commands/fix.ts` — `Fixer` interface, fixer registry, `fixCommand`
- `src/cli/commands/fix-targets.ts` — shared check → fix target map (used by both doctor's footer and fix's lookup)
- `src/cli/generators/` — one file per concern (linting, testing, build, git, github-actions, security, misc)
- `tooling/` — every shipped preset, mirrored 1:1 with `package.json` `exports`

## Conventions in this repo

- Conventional commits enforced via commitlint; header max 72 chars
- Biome for lint + format (run via `pnpm exec biome check --config-path=tooling/biome/biome.json src scripts`)
- Tests live alongside source in `tests/`; vitest with no separate config
- semantic-release runs on push to `main`; `fix:` → patch, `feat:` → minor, `chore:` / `docs:` → no release

## Releasing — never publish by hand

Releases are fully automated by semantic-release on merge to `main`. **You don't
publish, commits do** — the version is derived from Conventional Commit messages:

- `fix:` → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE:` → major
- `chore:` / `docs:` / `refactor:` / `test:` / `ci:` → no release

Never run `npm publish`, `npm version`, or `git tag`, and never hand-edit the
`version` field — semantic-release owns it, and editing it causes drift and
merge conflicts. Run `pnpm verify` before pushing; a red CI blocks the release.
(This mirrors the `npm-publish` Claude skill in `skills/npm-publish/`.)

## Claude Code plugin

This repo self-hosts a Claude Code plugin with two skills (`js-tooling`,
`npm-publish`). Install it:

```
/plugin marketplace add rtorcato/js-tooling
/plugin install js-tooling@js-tooling
```

## Pointers

- Site index for LLMs: https://rtorcato.github.io/js-tooling/llms.txt
- Full CLI guide: https://rtorcato.github.io/js-tooling/guides/cli/
- For AI agents: https://rtorcato.github.io/js-tooling/guides/for-ai-agents/
- Source: https://github.com/rtorcato/js-tooling
